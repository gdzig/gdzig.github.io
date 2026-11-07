import { test as base } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { externalDestination, requireExternalDirectory } from '../helpers/browser-paths';
import { createStorybookSite, externalDirectory } from '../helpers/storybook-site';

export type Audit = { story: string; theme: string; width: number; errors: string[]; external: string[]; failedResponses: string[]; measurements: unknown[]; writes: number[] };
type Catalogue = { origin: string; output: string; mode: string };
export const test = base.extend<{ audit: Audit }, { catalogue: Catalogue }>({
  serviceWorkers: 'block',
  catalogue: [async ({}, use, workerInfo) => {
    const mode = String(workerInfo.project.metadata.mode);
    const output = await externalDirectory(externalDestination(join(requireExternalDirectory('MARKETING_BROWSER_OUTPUT_DIR'), mode)));
    const site = await createStorybookSite(output);
    try {
      const origin = mode === 'dev' ? await site.startDev() : await site.startStatic();
      await use({ origin, output, mode });
    } finally { await site.dispose(); }
  }, { scope: 'worker', timeout: 240_000 }],
  audit: [async ({ context, catalogue }, use, testInfo) => {
    const audit: Audit = { story: '', theme: '', width: 1447, errors: [], external: [], failedResponses: [], measurements: [], writes: [] };
    const record = (list: string[], message: string) => { if (list.length < 100) list.push(message); };
    await context.route('**/*', route => {
      const url = route.request().url();
      if (new URL(url).origin === catalogue.origin || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      record(audit.external, url);
      return route.fulfill({ status: 204, body: '' });
    });
    await context.addInitScript(() => {
      const original = Storage.prototype.setItem;
      (window as any).__themeWrites = 0;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'starlight-theme') (window as any).__themeWrites++;
        return original.call(this, key, value);
      };
    });
    context.on('page', page => {
      page.on('pageerror', error => record(audit.errors, `${page.url()}: ${error.stack ?? error.message}`));
      page.on('console', message => { if (message.type() === 'error') record(audit.errors, `${page.url()}: ${message.text()}`); });
      page.on('response', response => { if (response.status() >= 400) record(audit.failedResponses, `${response.status()} ${response.url()}`); });
    });
    try { await use(audit); }
    finally {
      const name = `${testInfo.testId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
      const path = externalDestination(join(catalogue.output, name));
      await writeFile(path, JSON.stringify(audit, null, 2));
      await testInfo.attach('browser-evidence', { path, contentType: 'application/json' });
      expect.soft(audit.external, 'no analytics or other external network attempts').toEqual([]);
      expect.soft(audit.failedResponses, 'no failed local resource responses').toEqual([]);
      expect.soft(audit.errors, 'no browser console errors or runtime exceptions').toEqual([]);
    }
  }, { auto: false }],
});
export { expect };
