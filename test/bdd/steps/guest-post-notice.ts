import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';

const { Given, Then } = createBdd(test);
const variantFromStory = (story: string) => story.replace('marketing-guestpostnotice--', '').replace(/-(light|dark)$/, '');
const authorName = (variant: string) => variant === 'long-name' ? 'FIXTURE_LONG_NAME_'.repeat(12) : 'Fixture author';

Given('the guest post notice {string} canvas is opened at {int} pixels in {string}', async ({ page, catalogue, audit }, variant: string, width: number, theme: string) => {
  audit.story = `marketing-guestpostnotice--${variant}-${theme}`;
  audit.width = width;
  audit.theme = theme;
  const response = await page.request.get(`${catalogue.origin}/index.json`);
  expect(response.ok(), 'real Storybook catalogue is available').toBe(true);
  const index = await response.json();
  expect(index.entries[audit.story], 'guest post notice is registered in the real catalogue').toBeDefined();
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
  const canvas = await page.goto(`${catalogue.origin}/iframe.html?id=${audit.story}&viewMode=story`, { waitUntil: 'networkidle' });
  expect(canvas?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.getByRole('complementary', { name: 'Guest post' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

Then('the guest post notice credits the author with the selected community role', async ({ page, audit }) => {
  const variant = variantFromStory(audit.story);
  const notice = page.getByRole('complementary', { name: 'Guest post' });
  const contributor = ['contributor', 'no-profile'].includes(variant);
  await expect(notice).toHaveText(`This is a guest post by ${authorName(variant)}, a GDZig community member${contributor ? ' and contributor' : ''}.`);
  await expect(notice.getByRole('heading')).toHaveCount(0);
  await expect(notice.getByRole('button')).toHaveCount(0);
});

Then('the guest post notice preserves the optional author profile link', async ({ page, audit }) => {
  const variant = variantFromStory(audit.story);
  const notice = page.getByRole('complementary', { name: 'Guest post' });
  const link = notice.getByRole('link');
  if (variant === 'no-profile') {
    await expect(link).toHaveCount(0);
    await expect(notice).toContainText('Fixture author');
  } else {
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAccessibleName(authorName(variant));
    await expect(link).toHaveAttribute('href', 'https://example.invalid/FIXTURE-author');
    await expect(link).toHaveAttribute('rel', 'author');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect.poll(() => link.evaluate(node => {
      const style = getComputedStyle(node);
      return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
    }), { message: 'keyboard focus has a visible outline or the site focus ring' }).toBe(true);
  }
});

Then('the guest post notice stays readable within the viewport', async ({ page, audit, catalogue }) => {
  const metrics = await page.getByRole('complementary', { name: 'Guest post' }).evaluate(notice => ({
    documentWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    boxes: [notice, ...notice.querySelectorAll('p, a, strong')].map(node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    }),
    color: getComputedStyle(notice).color,
  }));
  audit.measurements.push(metrics);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
  for (const box of metrics.boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(metrics.viewport);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  }
  expect(metrics.color).toBe(audit.theme === 'dark' ? 'rgb(203, 188, 168)' : 'rgb(95, 85, 71)');
  await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}.png`)), fullPage: true });
});
