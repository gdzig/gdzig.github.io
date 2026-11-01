import { accessSync, constants, lstatSync, mkdirSync, readlinkSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));

function inside(parent: string, child: string) {
  const path = relative(parent, child);
  return !path || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

// Resolve existing ancestors before creating anything, including missing children
// beneath an external-looking symlink that actually points into the repository.
function canonicalDestination(path: string, links = 0): string {
  if (links > 40) throw new Error('Too many output path symlinks.');
  try { return realpathSync(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    let target: string | undefined;
    try {
      if (lstatSync(path).isSymbolicLink()) target = resolve(dirname(path), readlinkSync(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return target ? canonicalDestination(target, links + 1) : join(canonicalDestination(dirname(path), links), basename(path));
  }
}

export function externalDestination(path: string, label = 'Browser output'): string {
  if (!isAbsolute(path)) throw new Error(`${label} must be an absolute path outside the website repository.`);
  const logical = resolve(path);
  const destination = canonicalDestination(logical);
  if (inside(repository, logical) || inside(repository, destination)) {
    throw new Error(`${label} must be outside the website repository, including symlinks.`);
  }
  return destination;
}

export function requireExternalDirectory(name: string): string {
  const configured = process.env[name];
  if (!configured) throw new Error(`Set ${name} to an absolute directory outside the website repository.`);
  const destination = externalDestination(configured, name);
  mkdirSync(destination, { recursive: true });
  return destination;
}

export function requireChromePath(): string {
  const executable = process.env.CHROME_PATH;
  if (!executable || !isAbsolute(executable)) throw new Error('Set CHROME_PATH to an existing Chrome/Chromium executable. No browser is downloaded.');
  accessSync(executable, constants.X_OK);
  return executable;
}
