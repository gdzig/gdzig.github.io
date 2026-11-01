import { createBdd } from 'playwright-bdd';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../fixtures';
import { externalDestination, requireExternalDirectory } from '../../helpers/browser-paths';
import { storyIds } from './component-support';

const { Then } = createBdd(test);
Then('its index includes all eleven marketing story IDs', async ({ catalogue }) => {
  const response = await fetch(`${catalogue.origin}/index.json`, { signal: AbortSignal.timeout(5000) });
  expect(response.status).toBe(200);
  const index: any = await response.json();
  expect(Object.keys(index.entries).filter(id => id.startsWith('marketing-')).sort()).toEqual([...storyIds].sort());
});
Then('the output guard rejects missing configuration and direct or symlink repository destinations', async ({ catalogue }) => {
  const name = 'MARKETING_GUARD_MISSING_FIXTURE';
  const previous = process.env[name];
  delete process.env[name];
  try { expect(() => requireExternalDirectory(name)).toThrow(/Set MARKETING_GUARD_MISSING_FIXTURE/); }
  finally { if (previous !== undefined) process.env[name] = previous; }
  const repository = fileURLToPath(new URL('../../../', import.meta.url));
  expect(() => externalDestination(join(repository, 'missing-browser-output/nested'))).toThrow(/outside/);
  const directory = await mkdtemp(externalDestination(join(catalogue.output, 'guard-')));
  try {
    await symlink(repository, join(directory, 'repository-link'), 'dir');
    expect(() => externalDestination(join(directory, 'repository-link/missing/nested'))).toThrow(/outside/);
    await symlink(join(repository, 'missing-browser-output'), join(directory, 'dangling-link'), 'dir');
    expect(() => externalDestination(join(directory, 'dangling-link/nested'))).toThrow(/outside/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
