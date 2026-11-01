import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';

const { Given, Then } = createBdd(test);
const longTitle = `FIXTURE_LONG_TITLE ${'FIXTURE wrapping title specimen '.repeat(12).trim()}`;
const variantFromStory = (story: string) => story.replace('marketing-postsummary--', '').replace(/-(light|dark)$/, '');

Given('the post summary {string} canvas is opened at {int} pixels in {string}', async ({ page, catalogue, audit }, variant: string, width: number, theme: string) => {
  audit.story = `marketing-postsummary--${variant}-${theme}`;
  audit.width = width;
  audit.theme = theme;
  const response = await page.request.get(`${catalogue.origin}/index.json`);
  expect(response.ok(), 'real Storybook catalogue is available').toBe(true);
  const index = await response.json();
  expect(index.entries[audit.story], 'real PostSummary story registered in the catalogue').toBeDefined();
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
  const canvas = await page.goto(`${catalogue.origin}/iframe.html?id=${audit.story}&viewMode=story`, { waitUntil: 'networkidle' });
  expect(canvas?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.getByRole('list')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

Then('the post summary preserves its semantic list and publication metadata', async ({ page, audit }) => {
  const variant = variantFromStory(audit.story);
  const list = page.getByRole('list');
  await expect(list).toHaveCount(1);
  expect(await list.evaluate(node => node.tagName)).toBe('OL');
  await expect(list).toHaveClass(/\bblog-list\b/);
  const item = list.getByRole('listitem');
  await expect(item).toHaveCount(1);
  expect(await item.evaluate(node => node.parentElement?.tagName)).toBe('OL');
  const preview = item.locator('.blog-preview');
  if (['draft', 'scheduled', 'no-date'].includes(variant)) await expect(preview).toHaveText('Unpublished preview');
  else await expect(preview).toHaveCount(0);
  const time = item.locator('time');
  if (variant === 'no-date') await expect(time).toHaveCount(0);
  else {
    const scheduled = variant === 'scheduled';
    await expect(time).toHaveCount(1);
    await expect(time).toHaveAttribute('datetime', scheduled ? '2001-02-04T00:00:00.000Z' : '2001-02-03T00:00:00.000Z');
    await expect(time).toHaveText(scheduled ? 'February 4, 2001' : 'February 3, 2001');
    await expect(time.locator('..')).toHaveClass(/\bblog-meta\b/);
  }
  expect(await item.evaluate(node => [...node.children].map(child => child.tagName))).toEqual([
    ...(['draft', 'scheduled', 'no-date'].includes(variant) ? ['P'] : []),
    ...(variant === 'no-date' ? [] : ['P']), 'H2', 'P', 'P',
  ]);
});

Then('the post summary preserves its title description and author destinations', async ({ page, audit }) => {
  const variant = variantFromStory(audit.story);
  const item = page.getByRole('listitem');
  const title = variant === 'long-title' ? longTitle : `FIXTURE_${variant.toUpperCase().replaceAll('-', '_')}_TITLE`;
  const heading = item.getByRole('heading', { level: 2 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText(title);
  await expect(heading.getByRole('link')).toHaveAttribute('href', '/blog/FIXTURE%20group/FIXTURE%20summary/');
  await expect(heading.locator('+ p')).toHaveText('FIXTURE_DESCRIPTION: Synthetic summary specimen, not publishable content.');
  const author = item.locator('p').last();
  await expect(author).toHaveClass(/\bblog-meta\b/);
  await expect(author).toHaveText('By FIXTURE_AUTHOR');
  if (variant === 'no-author-url') {
    await expect(author.getByRole('link')).toHaveCount(0);
    await expect(item.getByRole('link')).toHaveCount(1);
  } else {
    await expect(author.getByRole('link', { name: 'FIXTURE_AUTHOR', exact: true })).toHaveAttribute('href', 'https://example.invalid/FIXTURE-author');
    await expect(author.getByRole('link')).toHaveAttribute('rel', 'author');
    await expect(item.getByRole('link')).toHaveCount(2);
  }
});

Then('the post summary fits within the viewport', async ({ page, audit, catalogue }) => {
  const metrics = await page.getByRole('listitem').evaluate(item => ({
    documentWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    boxes: [item, ...item.querySelectorAll('h2, p, a, time')].map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    }),
    titleHeight: item.querySelector('h2')!.getBoundingClientRect().height,
    titleLineHeight: parseFloat(getComputedStyle(item.querySelector('h2')!).lineHeight),
  }));
  audit.measurements.push(metrics);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
  for (const box of metrics.boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(metrics.viewport);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  }
  if (variantFromStory(audit.story) === 'long-title') expect(metrics.titleHeight).toBeGreaterThan(metrics.titleLineHeight * 2);
  await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}.png`)), fullPage: true });
});
