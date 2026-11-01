import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { externalDestination, requireChromePath, requireExternalDirectory } from './test/helpers/browser-paths';

const output = requireExternalDirectory('MARKETING_BROWSER_OUTPUT_DIR');
const artifact = (name: string) => externalDestination(join(output, name));
// Generated files live outside the ESM website package, so declare their module
// format explicitly rather than depending on a user's parent-directory package.
const generated = artifact('generated');
mkdirSync(generated, { recursive: true });
writeFileSync(externalDestination(join(generated, 'package.json')), '{"type":"module"}\n');
const components = defineBddConfig({
  features: 'test/bdd/components/**/*.feature',
  steps: ['test/bdd/fixtures.ts', 'test/bdd/steps/**/*.ts'],
  outputDir: artifact('generated/components'),
});
const site = defineBddConfig({
  features: 'test/bdd/site/**/*.feature',
  steps: ['test/bdd/site/fixtures.ts', 'test/bdd/site/steps.ts'],
  outputDir: artifact('generated/site'),
});

export default defineConfig({
  outputDir: artifact('results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: artifact('report'), open: 'never' }],
    ['json', { outputFile: artifact('report.json') }],
  ],
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    browserName: 'chromium',
    launchOptions: { executablePath: requireChromePath() },
    viewport: { width: 1447, height: 900 },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'development', testDir: components, metadata: { mode: 'dev' } },
    { name: 'static', testDir: components, metadata: { mode: 'static' } },
    { name: 'site', testDir: site },
  ],
});
