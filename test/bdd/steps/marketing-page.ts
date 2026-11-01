import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import sharp from 'sharp';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';

const { Given, Then } = createBdd(test);

Given('the marketing page story {string} at {int} pixels in {string}', async ({ page, catalogue, audit }, story: string, width: number, theme: string) => {
  audit.story = `marketing-marketingpage--${story}`;
  audit.width = width;
  audit.theme = theme;
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
  const index = await (await page.request.get(`${catalogue.origin}/index.json`)).json();
  expect(index.entries[audit.story], 'real MarketingPage story registered').toBeDefined();
  const response = await page.goto(`${catalogue.origin}/iframe.html?id=${audit.story}&viewMode=story`, { waitUntil: 'networkidle' });
  expect(response?.status()).toBe(200);
  await expect(page.locator('.marketing-page')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.evaluate(() => document.fonts.ready);
});

Then('the reading surface is opaque and fits the viewport', async ({ page, audit, catalogue }) => {
  const metrics = await page.locator('.reading-panel').evaluate(panel => {
    const box = panel.getBoundingClientRect();
    const css = getComputedStyle(panel);
    return { background: css.backgroundColor, image: css.backgroundImage, left: box.left, right: box.right,
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth };
  });
  audit.measurements.push(metrics);
  expect(metrics.background).toMatch(/^rgb\(/);
  expect(metrics.image).toBe('none');
  expect(metrics.left).toBeGreaterThanOrEqual(7);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport - 7);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport + 1);
  await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}.png`)), fullPage: true });
});

Then('the inset panel overlaps the introduction without covering its title', async ({ page, audit }) => {
  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const panel = rect('.reading-panel'), intro = rect('.page-intro'), title = rect('.page-intro h1');
    const header = rect('.site-header');
    return { panelTop: panel.top, introBottom: intro.bottom, titleBottom: title.bottom, titleTop: title.top, headerBottom: header.bottom };
  });
  audit.measurements.push(metrics);
  expect(metrics.panelTop).toBeLessThan(metrics.introBottom - 1);
  expect(metrics.panelTop).toBeGreaterThan(metrics.titleBottom + 8);
  expect(metrics.titleTop).toBeGreaterThanOrEqual(metrics.headerBottom);
});

Then('the reading column uses the available width up to 65 characters', async ({ page, audit }) => {
  const metrics = await page.locator('.reading-panel > .reading-column').evaluate(column => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;width:65ch;height:0;visibility:hidden';
    column.append(probe);
    const cap = probe.getBoundingClientRect().width;
    probe.remove();
    const box = column.getBoundingClientRect();
    return { width: box.width, expected: Math.min(cap, innerWidth - 2 * parseFloat(getComputedStyle(document.documentElement).fontSize)), left: box.left, right: innerWidth - box.right };
  });
  audit.measurements.push(metrics);
  expect(Math.abs(metrics.width - metrics.expected)).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.left - metrics.right)).toBeLessThanOrEqual(1);
});

Then('the introduction title uses {string} treatment without overflow', async ({ page, audit }, treatment: string) => {
  await expect(page.locator('main h1')).toHaveCount(1);
  const metrics = await page.locator('.page-intro h1').evaluate(title => {
    const box = title.getBoundingClientRect();
    return { treatment: getComputedStyle(title).textTransform, text: title.textContent, left: box.left, right: box.right, viewport: innerWidth };
  });
  audit.measurements.push(metrics);
  expect(metrics.treatment).toBe(treatment);
  expect(metrics.text).toContain(treatment === 'none' ? 'Article typography specimen' : 'Blog');
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport);
});

Then('the marketing background {string} is painted beyond the introduction', async ({ page, audit }, background: string) => {
  const metrics = await page.locator('.marketing-page').evaluate(surface => {
    const box = surface.getBoundingClientRect(), intro = surface.querySelector('.page-intro')!.getBoundingClientRect();
    const css = getComputedStyle(surface);
    return { image: css.backgroundImage, base: css.backgroundColor, height: box.height, introHeight: intro.height, sampleY: Math.floor(box.bottom - 20) };
  });
  audit.measurements.push(metrics);
  expect(metrics.height).toBeGreaterThan(metrics.introHeight + 400);
  // Sample the final canvas gutter below the panel, not its intentional shadow.
  const image = await page.screenshot({ fullPage: true });
  const { data, info } = await sharp(image).extract({ left: 2, top: metrics.sampleY, width: 4, height: 4 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const expected = metrics.base.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  const delta = Math.max(...expected.map((channel, index) => Math.abs(channel - data[index])));
  audit.measurements.push({ sample: [...data.slice(0, info.channels)], base: expected, delta });
  if (background === 'pattern') {
    expect(metrics.image).toContain('repeating-linear-gradient');
    expect(delta, 'the lower outer canvas visibly paints the artwork rather than a flat fallback').toBeGreaterThan(1);
  } else {
    expect(metrics.image).toBe('none');
    expect(delta, 'the lower outer canvas is a calm flat surface after the fade').toBeLessThanOrEqual(1);
  }
});
