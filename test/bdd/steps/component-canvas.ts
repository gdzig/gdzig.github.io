import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';
import { storyIds, themeIs } from './component-support';

const { Given, When, Then } = createBdd(test);
Given('the actual Storybook catalogue is running', async ({ catalogue }) => {
  expect(new URL(catalogue.origin).hostname).toBe('127.0.0.1');
});
Given('a canvas at {int} pixels with operating system theme {string}', async ({ page, audit }, width: number, theme: string) => {
  audit.width = width;
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
});
When('I open marketing story {string}', async ({ page, catalogue, audit }, story: string) => {
  expect(storyIds).toContain(story);
  audit.story = story;
  const response = await page.goto(`${catalogue.origin}/iframe.html?id=${story}&viewMode=story`, { waitUntil: 'networkidle' });
  expect(response?.status()).toBe(200);
  await expect(page.locator(story.startsWith('marketing-action') ? '.hero-actions a' : '.site-header')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});
Then('the production component is visible in theme {string} without overflow', async ({ page, audit, catalogue }, theme: string) => {
  audit.theme = theme;
  await themeIs(page, theme);
  const metrics = await page.evaluate(() => {
    const action = document.querySelector<HTMLElement>('.hero-actions a');
    const node = action ?? document.querySelector<HTMLElement>('.wordmark')!;
    const s = getComputedStyle(node), box = node.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth, width: innerWidth, color: s.color, background: s.backgroundColor,
      border: s.borderColor, fontWeight: s.fontWeight, height: box.height, role: action?.getAttribute('role'), href: action?.getAttribute('href'),
      outline: action?.classList.contains('outline'), body: document.body.className, colorScheme: getComputedStyle(document.documentElement).colorScheme };
  });
  audit.measurements.push(metrics);
  expect(metrics.overflow).toBeLessThanOrEqual(audit.width + 1);
  expect(metrics.body).toContain('pico');
  expect(metrics.body).toContain('home-page');
  expect(Number(metrics.fontWeight)).toBeGreaterThanOrEqual(700);
  expect(metrics.height).toBeGreaterThan(20);
  expect(metrics.colorScheme).toBe(theme);
  if (audit.story.startsWith('marketing-action')) {
    expect(metrics.href).toBe('#fixture-action');
    expect(metrics.role).toBe('button');
    expect(metrics.outline).toBe(audit.story.includes('--outline'));
    expect(metrics.color).toBe(metrics.outline ? 'rgb(248, 239, 227)' : 'rgb(23, 19, 11)');
    expect(metrics.background).toBe(metrics.outline ? 'rgba(0, 0, 0, 0)' : 'rgb(246, 163, 29)');
  } else {
    for (const href of ['/blog/', '/showcase/', '/docs/', 'https://github.com/gdzig/gdzig', 'https://discord.gg/GEUZGRGeDj']) {
      await expect(page.locator(`.site-header a[href="${href}"]`)).toHaveCount(2);
    }
    expect(metrics.color).toBe(audit.story.includes('--overlay') ? 'rgb(255, 255, 255)' : theme === 'dark' ? 'rgb(248, 239, 227)' : 'rgb(23, 19, 11)');
    await expect(page.locator('.wordmark[href="/"]')).toHaveCount(1);
    await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
    await expect(page.locator('.site-header')).toHaveClass(audit.story.includes('--overlay') ? /site-header-overlay/ : /^(?!.*site-header-overlay)/);
  }
  await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}-${theme}.png`)) });
});
