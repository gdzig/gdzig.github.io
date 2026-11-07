import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fixtureProcess } from './fixture-process';

const source = resolve(import.meta.dir, '../..');
const commandTimeout = 180_000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture port allocated');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

/** Actual site inputs, empty blog content, isolated cache/output, and no source .env files. */
export async function createBlogSite(): Promise<{
  root: string;
  writePost(id: string, extension: 'md' | 'mdx', content: string): Promise<void>;
  removePost(id: string, extension: 'md' | 'mdx'): Promise<void>;
  build(): Promise<{ status: number | null; stdout: string; stderr: string }>;
  start(mode: 'dev' | 'preview'): Promise<{ origin: string; stop(): Promise<void> }>;
  dispose(): Promise<void>;
}> {
  const scratch = resolve(process.env.JCODE_SCRATCH_DIR ?? join(source, '..', 'research', 'site-test-scratch'));
  const withinSource = relative(source, scratch);
  if (!withinSource || (!isAbsolute(withinSource) && withinSource !== '..' && !withinSource.startsWith(`..${sep}`))) {
    throw new Error('Blog fixture scratch directory must be outside the website repository');
  }
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, 'gdzig-blog-'));
  const stops = new Set<() => Promise<void>>();
  let disposed = false;
  try {
    for (const input of ['src', 'public', 'scripts', 'astro.config.mjs', 'package.json', 'bun.lock', 'tsconfig.json']) {
      await cp(join(source, input), join(root, input), { recursive: true });
    }
    const blog = join(root, 'src/content/blog');
    await rm(blog, { recursive: true, force: true });
    await mkdir(blog, { recursive: true });
    await symlink(join(source, 'node_modules'), join(root, 'node_modules'), 'dir');
    await writeFile(join(root, 'astro.fixture.config.mjs'), `import { defineConfig } from 'astro/config';
import base from './astro.config.mjs';
export default defineConfig({ ...base, cacheDir: './.astro-cache/' });
`);
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }

  function run(args: string[], mode: 'production' | 'development') {
    if (disposed) throw new Error('Blog fixture has been disposed');
    const child: ChildProcess = spawn('bun', ['run', ...args], {
      cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: mode, ASTRO_TELEMETRY_DISABLED: '1', PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_fixture_dummy', PUBLIC_POSTHOG_HOST: 'https://example.invalid' },
    });
    // Keep diagnostics bounded even if a broken server floods its output.
    let stdout = '', stderr = '';
    child.stdout!.on('data', data => { stdout = (stdout + data.toString()).slice(-128_000); });
    child.stderr!.on('data', data => { stderr = (stderr + data.toString()).slice(-128_000); });
    const lifecycle = fixtureProcess(child, stops, error => { stderr += `\n${error.message}`; }, 2_000);
    return { ...lifecycle, logs: () => ({ stdout, stderr }) };
  }

  async function postPath(id: string, extension: 'md' | 'mdx') {
    if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(id) || !['md', 'mdx'].includes(extension)) {
      throw new Error(`Unsafe blog fixture ID or extension: ${id}`);
    }
    const base = join(root, 'src/content/blog');
    const file = join(base, `${id}.${extension}`);
    await mkdir(dirname(file), { recursive: true });
    const actual = await realpath(dirname(file));
    const path = relative(base, actual);
    if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) throw new Error(`Escaping blog fixture ID: ${id}`);
    return file;
  }

  return {
    root,
    async writePost(id, extension, content) { await writeFile(await postPath(id, extension), content); },
    async removePost(id, extension) { await rm(await postPath(id, extension), { force: true }); },
    async build() {
      const child = run(['build:astro', '--config', 'astro.fixture.config.mjs'], 'production');
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const status = await Promise.race([
          child.completion,
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Fixture build timed out\n${JSON.stringify(child.logs())}`)), commandTimeout); }),
        ]);
        return { status, ...child.logs() };
      } finally {
        clearTimeout(timer);
        await child.stop();
      }
    },
    async start(mode) {
      const port = await freePort();
      const origin = `http://127.0.0.1:${port}`;
      const child = run([mode, '--config', 'astro.fixture.config.mjs', '--host', '127.0.0.1', '--port', String(port)], mode === 'dev' ? 'development' : 'production');
      try {
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline && !child.finished()) {
          try {
            const response = await fetch(`${origin}/blog/`, { signal: AbortSignal.timeout(2_000) });
            await response.arrayBuffer();
            if (response.status < 500) return { origin, stop: child.stop };
          } catch { /* Server is still compiling or binding. */ }
          await delay(100);
        }
        throw new Error(`Fixture ${mode} failed readiness at ${origin}\n${JSON.stringify(child.logs())}`);
      } catch (error) {
        await child.stop();
        throw error;
      }
    },
    async dispose() {
      disposed = true;
      await Promise.all([...stops].map(stop => stop()));
      await rm(root, { recursive: true, force: true });
    },
  };
}
