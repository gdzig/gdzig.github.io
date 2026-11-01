import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { externalDestination } from './browser-paths';
import { fixtureProcess } from './fixture-process';

const source = fileURLToPath(new URL('../../', import.meta.url));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Build the actual website without loading Storybook or copying source .env files. */
export async function createProductionSite(output: string) {
  output = externalDestination(output);
  await mkdir(output, { recursive: true });
  const root = await mkdtemp(join(output, 'website-'));
  const stops = new Set<() => Promise<void>>();
  const logs: Record<string, { stdout: string; stderr: string }> = {};
  try {
    for (const input of ['src', 'public', 'scripts', 'package.json', 'bun.lock', 'tsconfig.json']) {
      await cp(join(source, input), join(root, input), { recursive: true });
    }
    await cp(join(source, 'astro.config.mjs'), join(root, 'astro.production.config.mjs'));
    await writeFile(join(root, 'astro.config.mjs'), `import base from './astro.production.config.mjs';
export default { ...base, cacheDir: './.astro-cache/', vite: { ...base.vite, cacheDir: './.astro-vite-cache/' } };
`);
    await symlink(join(source, 'node_modules'), join(root, 'node_modules'), 'dir');
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }

  function run(name: string, args: string[]) {
    const log = logs[name] = { stdout: '', stderr: '' };
    const child = spawn('bun', ['run', ...args], {
      cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production', ASTRO_TELEMETRY_DISABLED: '1',
        PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_fixture_dummy', PUBLIC_POSTHOG_HOST: 'https://example.invalid' },
    });
    child.stdout!.on('data', data => { log.stdout = (log.stdout + data).slice(-128_000); });
    child.stderr!.on('data', data => { log.stderr = (log.stderr + data).slice(-128_000); });
    return fixtureProcess(child, stops, error => { log.stderr += error.message; });
  }

  async function dispose() {
    try { await Promise.all([...stops].map(stop => stop())); }
    finally {
      try { await writeFile(externalDestination(join(output, 'server-logs.json')), JSON.stringify(logs, null, 2)); }
      finally { await rm(root, { recursive: true, force: true }); }
    }
  }

  try {
    const build = run('build', ['build']);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const status = await Promise.race([build.completion, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Production website build timed out')), 180_000);
      })]);
      if (status !== 0) throw new Error(`Production website build exited ${status}: ${JSON.stringify(logs.build)}`);
    } finally { clearTimeout(timer); await build.stop(); }

    const socket = createServer();
    await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('No website preview port allocated');
    await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
    const origin = `http://127.0.0.1:${address.port}`;
    const preview = run('preview', ['preview', '--host', '127.0.0.1', '--port', String(address.port)]);
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && !preview.finished()) {
      try {
        const response = await fetch(origin, { signal: AbortSignal.timeout(2000) });
        if (response.ok) { await response.arrayBuffer(); return { origin, root, dispose }; }
      } catch { /* Wait for the actual production preview to bind. */ }
      await delay(100);
    }
    throw new Error(`Production preview failed readiness: ${JSON.stringify(logs.preview)}`);
  } catch (error) { await dispose(); throw error; }
}
