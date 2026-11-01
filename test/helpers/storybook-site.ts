import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { externalDestination } from './browser-paths';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const inside = (parent: string, child: string) => {
  const path = relative(parent, child);
  return !path || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
};
export async function externalDirectory(path: string) {
  const destination = externalDestination(path);
  await mkdir(destination, { recursive: true });
  return destination;
}

/** Actual production inputs and Storybook, with private caches and no .env copy. */
export async function createStorybookSite(output: string) {
  const scratch = await externalDirectory(join(output, 'scratch'));
  const root = await mkdtemp(join(scratch, 'gdzig-storybook-'));
  const stops = new Set<() => Promise<void>>();
  try {
    for (const input of ['src', 'public', 'scripts', 'package.json', 'bun.lock', 'tsconfig.json', '.storybook']) {
      await cp(join(repository, input), join(root, input), { recursive: true });
    }
    await cp(join(repository, 'astro.config.mjs'), join(root, 'astro.production.config.mjs'));
    await writeFile(join(root, 'astro.config.mjs'), `import base from './astro.production.config.mjs';
export default { ...base, cacheDir: './.astro-cache/', vite: { ...base.vite, cacheDir: './.astro-vite-cache/' } };
`);
    await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir');
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
  const logs: Record<string, { stdout: string; stderr: string }> = {};
  function run(name: string, args: string[]) {
    const log = logs[name] = { stdout: '', stderr: '' };
    const child = spawn(process.execPath, [join(root, 'node_modules/.bin/storybook'), ...args], { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: name === 'dev' ? 'development' : 'production', ASTRO_TELEMETRY_DISABLED: '1', STORYBOOK_DISABLE_TELEMETRY: '1' } });
    child.stdout!.on('data', data => { log.stdout = (log.stdout + data).slice(-128_000); });
    child.stderr!.on('data', data => { log.stderr = (log.stderr + data).slice(-128_000); });
    let finished = false;
    const completion = new Promise<number | null>(resolve => {
      child.once('error', error => { log.stderr += error.message; finished = true; resolve(null); });
      child.once('close', code => { finished = true; resolve(code); });
    });
    const signal = (name: NodeJS.Signals) => {
      if (!child.pid) return;
      try { process.kill(-child.pid, name); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    };
    let stopping: Promise<void> | undefined;
    const stop = () => stopping ??= (async () => {
      signal('SIGTERM');
      await Promise.race([completion, delay(1500)]);
      signal('SIGKILL');
      await Promise.race([completion, delay(1500)]);
      stops.delete(stop);
    })();
    stops.add(stop);
    return { completion, stop, finished: () => finished };
  }
  async function port() {
    const server = createServer();
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No local port');
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return address.port;
  }
  let disposed = false;
  return {
    root, logs,
    async startDev() {
      const origin = `http://127.0.0.1:${await port()}`;
      const child = run('dev', ['dev', '--host', '127.0.0.1', '--port', new URL(origin).port, '--ci', '--no-open', '--disable-telemetry']);
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline && !child.finished()) {
        try {
          const response = await fetch(`${origin}/index.json`, { signal: AbortSignal.timeout(2000) });
          if (response.ok) { await response.arrayBuffer(); return origin; }
        } catch { /* Compilation is not ready yet. */ }
        await delay(200);
      }
      throw new Error(`Storybook dev readiness failed: ${JSON.stringify(logs.dev)}`);
    },
    async startStatic() {
      const directory = join(root, 'storybook-static');
      const child = run('build', ['build', '--disable-telemetry', '--output-dir', directory]);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const status = await Promise.race([child.completion, new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Storybook build timed out after 180s')), 180_000);
        })]);
        if (status !== 0) throw new Error(`Storybook build exited ${status}: ${JSON.stringify(logs.build)}`);
      } finally { clearTimeout(timer); await child.stop(); }
      const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
      const server = createServer(async (request, response) => {
        try {
          const path = resolve(directory, `.${decodeURIComponent(new URL(request.url!, 'http://localhost').pathname)}`);
          if (!inside(directory, path)) { response.writeHead(403).end(); return; }
          const file = (await stat(path)).isDirectory() ? join(path, 'index.html') : path;
          response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
        } catch { response.writeHead(404).end(); }
      });
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Static server did not bind');
      stops.add(async () => {
        server.closeAllConnections();
        // Some runtimes stop listening when the last socket is drained.
        if (!server.listening) return;
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      });
      return `http://127.0.0.1:${address.port}`;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      try { await Promise.all([...stops].map(stop => stop())); }
      finally {
        try { await writeFile(externalDestination(join(output, 'server-logs.json')), JSON.stringify(logs, null, 2)); }
        finally { await rm(root, { recursive: true, force: true }); }
      }
    },
  };
}
