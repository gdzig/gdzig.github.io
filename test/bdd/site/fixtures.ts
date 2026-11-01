import { test as base } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { externalDestination, requireExternalDirectory } from '../../helpers/browser-paths';
import { createProductionSite } from '../../helpers/production-site';

type Website = { origin: string; output: string };
export const test = base.extend<{}, { website: Website }>({
  website: [async ({}, use) => {
    const output = externalDestination(join(requireExternalDirectory('MARKETING_BROWSER_OUTPUT_DIR'), 'site'));
    await mkdir(output, { recursive: true });
    const site = await createProductionSite(output);
    try { await use({ origin: site.origin, output }); }
    finally { await site.dispose(); }
  }, { scope: 'worker', timeout: 240_000 }],
  context: async ({ context, website }, use, testInfo) => {
    const errors: string[] = [], unexpected: string[] = [], blocked: string[] = [];
    const record = (list: string[], value: string) => { if (list.length < 100) list.push(value); };
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === website.origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      record(blocked, url.href);
      if (url.href !== 'https://example.invalid/static/array.js') record(unexpected, url.href);
      return route.fulfill({ status: 204, body: '' });
    });
    context.on('page', page => {
      page.on('pageerror', error => record(errors, error.message));
      page.on('console', message => { if (message.type() === 'error') record(errors, message.text()); });
      page.on('response', response => { if (response.status() >= 400) record(errors, `${response.status()} ${response.url()}`); });
    });
    try { await use(context); }
    finally {
      const filename = testInfo.testId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = externalDestination(join(website.output, `${filename}.json`));
      await writeFile(path, JSON.stringify({ errors, unexpected, blocked }, null, 2));
      await testInfo.attach('website-browser-evidence', { path, contentType: 'application/json' });
      expect.soft(unexpected, 'only dummy analytics is intercepted, no other external requests').toEqual([]);
      expect.soft(errors, 'no broken resources or browser runtime errors').toEqual([]);
    }
  },
});
export { expect };
