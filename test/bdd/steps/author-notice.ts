import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';

const { Given, Then } = createBdd(test);
const variantFromStory = (story: string) => story.replace('marketing-authornotice--', '').replace(/-(light|dark)$/, '');
const authorName = (variant: string) => variant === 'long-name' ? 'FIXTURE_LONG_NAME_'.repeat(12) : 'Fixture author';
const credit: Record<string, string> = {
  'community-member': 'This is a guest post by Fixture author, a GDZig community member.',
  contributor: 'This is a guest post by Fixture author, a GDZig community member and contributor.',
  maintainer: 'This post is by Fixture author, a GDZig maintainer.',
  founder: 'This post is by Fixture author, a GDZig founder.',
  'founder-maintainer': 'This post is by Fixture author, a GDZig founder and maintainer.',
  'guest-maintainer': 'This is a guest post by Fixture author, a GDZig maintainer.',
  'all-roles': 'This post is by Fixture author, a GDZig community member, contributor, maintainer, and founder.',
  'no-roles': 'This post is by Fixture author.',
  'no-profile': 'This is a guest post by Fixture author, a GDZig community member and contributor.',
  'source-only': 'This is a guest post by Fixture author, a GDZig community member.',
  'source-dated': 'This is a guest post by Fixture author, a GDZig community member.',
  'team-source': 'This post is by Fixture author, a GDZig founder and maintainer.',
  'long-source': 'This is a guest post by Fixture author, a GDZig community member.',
};
const sourceUrl = (variant: string) => variant === 'long-source'
  ? `https://example.invalid/${'FIXTURE_ORIGINAL_SOURCE_'.repeat(16)}/`
  : 'https://example.invalid/original/';
const hasSource = (variant: string) => ['source-only', 'source-dated', 'team-source', 'long-source'].includes(variant);

Given('the author notice {string} canvas is opened at {int} pixels in {string}', async ({ page, catalogue, audit }, variant: string, width: number, theme: string) => {
  audit.story = `marketing-authornotice--${variant}-${theme}`;
  audit.width = width;
  audit.theme = theme;
  const response = await page.request.get(`${catalogue.origin}/index.json`);
  expect(response.ok(), 'real Storybook catalogue is available').toBe(true);
  const index = await response.json();
  expect(index.entries[audit.story], 'author notice is registered in the real catalogue').toBeDefined();
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
  const canvas = await page.goto(`${catalogue.origin}/iframe.html?id=${audit.story}&viewMode=story`, { waitUntil: 'networkidle' });
  expect(canvas?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.getByRole('complementary', { name: 'About the author' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

Then('the author notice credits only the selected roles and guest status', async ({ page, audit }) => {
  const variant = variantFromStory(audit.story);
  const notice = page.getByRole('complementary', { name: 'About the author' });
  const expected = variant === 'long-name'
    ? `This is a guest post by ${authorName(variant)}, a GDZig community member.`
    : credit[variant];
  expect(expected).toBeDefined();
  await expect(notice.locator('p').first()).toHaveText(expected);
  await expect(notice.getByRole('heading')).toHaveCount(0);
  await expect(notice.getByRole('button')).toHaveCount(0);
});

Then('the author notice preserves the optional author profile link', async ({ page, audit }) => {
  const variant = variantFromStory(audit.story);
  const notice = page.getByRole('complementary', { name: 'About the author' });
  const link = notice.locator('a[rel="author"]');
  if (variant === 'no-profile') {
    await expect(link).toHaveCount(0);
    await expect(notice).toContainText('Fixture author');
  } else {
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAccessibleName(authorName(variant));
    await expect(link).toHaveAttribute('href', 'https://example.invalid/FIXTURE-author');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect.poll(() => link.evaluate(node => {
      const style = getComputedStyle(node);
      return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
    }), { message: 'keyboard focus has a visible outline or the site focus ring' }).toBe(true);
  }
});

Then('the author notice includes only the supplied original source details', async ({ page, audit }) => {
  const variant = variantFromStory(audit.story);
  const notice = page.getByRole('complementary', { name: 'About the author' });
  if (!hasSource(variant)) {
    await expect(notice.locator('p')).toHaveCount(1);
    await expect(notice.locator('time')).toHaveCount(0);
    return;
  }
  const source = notice.locator('p').nth(1);
  const dated = ['source-dated', 'team-source'].includes(variant);
  await expect(source).toHaveText(`This post was originally published at ${sourceUrl(variant)}${dated ? ' on January 1, 1999' : ''}.`);
  const link = source.getByRole('link', { name: sourceUrl(variant), exact: true });
  await expect(link).toHaveAttribute('href', sourceUrl(variant));
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  await expect(source.locator('time')).toHaveCount(dated ? 1 : 0);
  if (dated) await expect(source.locator('time')).toHaveAttribute('datetime', '1999-01-01T00:00:00.000Z');
});

Then('the author notice stays readable within the viewport', async ({ page, audit, catalogue }) => {
  const metrics = await page.getByRole('complementary', { name: 'About the author' }).evaluate(notice => ({
    documentWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    boxes: [notice, ...notice.querySelectorAll('p, a, strong, time')].map(node => {
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

Then('the author notice controls can change guest status, roles, and source details live', async ({ page, catalogue, audit }) => {
  await page.goto(`${catalogue.origin}/?path=/story/${audit.story}`, { waitUntil: 'networkidle' });
  const canvas = page.frameLocator('#storybook-preview-iframe');
  const notice = canvas.getByRole('complementary', { name: 'About the author' });
  await expect(notice.locator('time')).toHaveText('January 1, 1999');
  if (catalogue.mode === 'static') {
    // The Astro renderer disables controls for prerendered static stories.
    await expect(page.locator('#control-roles-0')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Setup controls' }).first()).toBeVisible();
    return;
  }
  await page.locator('#control-roles-0').uncheck();
  await page.locator('#control-roles-2').check();
  await page.locator('#control-roles-3').check();
  await page.locator('label[for="control-guest"]').click();
  await expect(notice.locator('p').first()).toHaveText('This post is by Fixture author, a GDZig maintainer and founder.');

  await page.locator('#control-sourceUrl').fill('');
  await page.locator('#control-sourceUrl').press('Tab');
  await expect(notice.locator('p')).toHaveCount(1);
  await expect(notice.locator('time')).toHaveCount(0);

  await page.locator('#control-sourceUrl').fill('https://example.invalid/updated-original/');
  await page.locator('#control-sourceUrl').press('Tab');
  await expect(notice.getByRole('link', { name: 'https://example.invalid/updated-original/', exact: true })).toHaveAttribute('href', 'https://example.invalid/updated-original/');
  await expect(notice.locator('time')).toHaveText('January 1, 1999');
  await page.locator('#control-sourcePublishedAt').fill('');
  await page.locator('#control-sourcePublishedAt').press('Tab');
  await expect(notice.locator('p').nth(1)).toHaveText('This post was originally published at https://example.invalid/updated-original/.');
  await expect(notice.locator('time')).toHaveCount(0);
});
