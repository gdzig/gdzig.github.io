import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteDirectory = join(scriptDirectory, '..');

function run(command: string, arguments_: string[], cwd: string) {
  const result = spawnSync(command, arguments_, { cwd, stdio: 'inherit' });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('bun', ['run', 'build:astro'], siteDirectory);
