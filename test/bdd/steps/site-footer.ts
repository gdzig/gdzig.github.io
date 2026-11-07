import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';

const { Given, Then } = createBdd(test);
const destinations = [
  { label: 'Blog', href: '/blog/' },
  { label: 'Showcase', href: '/showcase/' },
  { label: 'Docs', href: '/docs/' },
  { label: 'GitHub', href: 'https://github.com/gdzig/gdzig' },
  { label: 'Discord', href: 'https://discord.gg/GEUZGRGeDj' },
];

Given('the shared footer canvas is opened at {int} pixels in {string}', async ({ page, catalogue, audit }, width: number, theme: string) => {
  audit.width = width;
  audit.theme = theme;
  audit.story = `marketing-sitefooter--${theme}`;
  const response = await page.request.get(`${catalogue.origin}/index.json`);
  expect(response.ok(), 'real Storybook catalogue is available').toBe(true);
  const catalogueIndex = await response.json();
  expect(catalogueIndex.entries[audit.story], 'real SiteFooter story registered in the catalogue').toBeDefined();
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
  const canvas = await page.goto(`${catalogue.origin}/iframe.html?id=${audit.story}&viewMode=story`, { waitUntil: 'networkidle' });
  expect(canvas?.status()).toBe(200);
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.evaluate(() => document.fonts.ready);
});

Then('the footer retains all five destinations and its existing tagline', async ({ page, audit }) => {
  const footer = page.getByRole('contentinfo');
  await expect(footer).toHaveCount(1);
  await expect(footer.locator('p')).toHaveText('Build Godot games and extensions with Zig.');
  const navigation = footer.getByRole('navigation', { name: 'Footer', exact: true });
  await expect(navigation.getByRole('link')).toHaveCount(5);
  expect(await navigation.getByRole('link').evaluateAll(links => links.map(link => ({ label: link.textContent?.trim(), href: link.getAttribute('href') })))).toEqual(destinations);
  const paint = await footer.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color }));
  audit.measurements.push(paint);
  expect(paint.background).toBe(audit.theme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(234, 223, 206)');
  expect(paint.color).toBe(audit.theme === 'dark' ? 'rgb(153, 153, 153)' : 'rgb(95, 85, 71)');
});

Then('the footer wraps within the viewport', async ({ page, audit, catalogue }) => {
  const metrics = await page.getByRole('contentinfo').evaluate(footer => {
    const tagline = footer.querySelector('p')!.getBoundingClientRect();
    const navigation = footer.querySelector('nav')!.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      taglineBottom: tagline.bottom,
      navigationTop: navigation.top,
      links: [...footer.querySelectorAll('a')].map(link => {
        const box = link.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width, height: box.height };
      }),
    };
  });
  audit.measurements.push(metrics);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
  for (const box of metrics.links) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(metrics.viewport);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  }
  if (audit.width === 390) expect(metrics.navigationTop, 'footer rows wrap at narrow width').toBeGreaterThanOrEqual(metrics.taglineBottom);
  await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}.png`)) });
});

Then('the footer exposes visible keyboard focus on every destination', async ({ page, audit, catalogue }) => {
  for (const destination of destinations) {
    const link = page.getByRole('contentinfo').getByRole('link', { name: destination.label, exact: true });
    const restingShadow = await link.evaluate(node => getComputedStyle(node).boxShadow);
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const focus = await link.evaluate(node => {
      const style = getComputedStyle(node);
      return { visible: node.matches(':focus-visible'), outlineColor: style.outlineColor, outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, shadow: style.boxShadow };
    });
    audit.measurements.push({ destination: destination.label, ...focus });
    expect(focus.visible).toBe(true);
    const outline = focus.outlineColor === 'rgb(246, 163, 29)' && parseFloat(focus.outlineWidth) > 0 && focus.outlineStyle !== 'none';
    const shadow = focus.shadow !== restingShadow && focus.shadow.includes('rgba(246, 163, 29, 0.45)') && /[1-9][\d.]*px/.test(focus.shadow);
    expect(outline || shadow, 'visible production amber keyboard-focus ring').toBe(true);
  }
  await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}-keyboard-focus.png`)) });
});
