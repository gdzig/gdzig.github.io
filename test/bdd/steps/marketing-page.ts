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

Then('the responsive reading surface fits the viewport', async ({ page, audit, catalogue }) => {
  const metrics = await page.locator('.reading-panel').evaluate(panel => {
    const box = panel.getBoundingClientRect();
    const css = getComputedStyle(panel);
    return { background: css.backgroundColor, image: css.backgroundImage, radius: css.borderRadius, shadow: css.boxShadow, border: css.borderWidth, marginTop: css.marginTop, left: box.left, right: box.right,
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth };
  });
  audit.measurements.push(metrics);
  expect(metrics.image).toBe('none');
  if (metrics.viewport <= 576) {
    expect(metrics.background).toBe('rgba(0, 0, 0, 0)');
    expect(metrics.marginTop).toBe('0px');
    expect(metrics.border).toBe('0px');
    expect(metrics.left, 'mobile reading surface starts at the screen edge').toBe(0);
    expect(metrics.right, 'mobile reading surface reaches the screen edge').toBe(metrics.viewport);
    expect(metrics.radius).toBe('0px');
    expect(metrics.shadow).toBe('none');
  } else {
    expect(metrics.background).toMatch(/^rgb\(/);
    expect(metrics.shadow).not.toBe('none');
    expect(metrics.radius).not.toBe('0px');
    expect(metrics.left).toBeGreaterThanOrEqual(7);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewport - 7);
  }
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport + 1);
  await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}.png`)), fullPage: true });
});

Then('the responsive reading panel follows the introduction without covering its title', async ({ page, audit }) => {
  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const panel = rect('.reading-panel'), intro = rect('.page-intro'), title = rect('.page-intro h1');
    // The overlay header includes empty bottom padding, especially when links wrap at 577px.
    // Avoid its visible text and buttons, not the unpainted container bounds.
    const headerPaintBottom = Math.max(...Array.from(document.querySelectorAll('.site-header a, .site-header summary, .site-header button')).flatMap(control => {
      if (!control.checkVisibility({ checkVisibilityCSS: true })) return [];
      if (control.tagName === 'BUTTON') return [control.getBoundingClientRect().bottom];
      const text = document.createRange();
      text.selectNodeContents(control);
      return [text.getBoundingClientRect().bottom];
    }));
    return { viewport: innerWidth, panelTop: panel.top, introBottom: intro.bottom, titleBottom: title.bottom, titleTop: title.top, headerPaintBottom };
  });
  audit.measurements.push(metrics);
  if (metrics.viewport <= 576) expect(Math.abs(metrics.panelTop - metrics.introBottom), 'mobile reading content follows the hero without overlap').toBeLessThanOrEqual(1);
  else expect(metrics.panelTop, 'desktop inset panel retains its overlap').toBeLessThan(metrics.introBottom - 1);
  expect(metrics.panelTop).toBeGreaterThan(metrics.titleBottom + 8);
  expect(metrics.titleTop, 'the title stays below visible navigation text and controls').toBeGreaterThanOrEqual(metrics.headerPaintBottom);
});

Then('the reading column uses the available width up to 65 characters', async ({ page, audit }) => {
  const metrics = await page.locator('.reading-panel > .reading-column').evaluate(column => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;width:65ch;height:0;visibility:hidden';
    column.append(probe);
    const cap = probe.getBoundingClientRect().width;
    probe.remove();
    const box = column.getBoundingClientRect();
    const introduction = document.querySelector('.page-intro--article .reading-column')?.getBoundingClientRect();
    return { width: box.width, expected: Math.min(cap, innerWidth - 2 * parseFloat(getComputedStyle(document.documentElement).fontSize)), left: box.left, right: innerWidth - box.right,
      introduction: introduction ? { left: introduction.left, width: introduction.width } : null };
  });
  audit.measurements.push(metrics);
  expect(Math.abs(metrics.width - metrics.expected)).toBeLessThanOrEqual(1);
  expect(Math.abs(metrics.left - metrics.right)).toBeLessThanOrEqual(1);
  if (metrics.introduction) {
    expect(Math.abs(metrics.introduction.left - metrics.left), 'article introduction and prose share the same left edge').toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.introduction.width - metrics.width), 'article introduction retains the same reading measure').toBeLessThanOrEqual(1);
  }
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

Then('the responsive marketing background preserves the {string} desktop variant', async ({ page, audit }, background: string) => {
  const metrics = await page.locator('.marketing-page').evaluate(surface => {
    const box = surface.getBoundingClientRect(), intro = surface.querySelector('.page-intro')!.getBoundingClientRect();
    const css = getComputedStyle(surface), hero = surface.querySelector('.page-intro')!;
    const fade = getComputedStyle(hero, '::after');
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--marketing-reading-surface)';
    surface.append(probe);
    const readingSurface = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { viewport: innerWidth, image: css.backgroundImage, base: css.backgroundColor, readingSurface, heroImage: getComputedStyle(hero).backgroundImage,
      fadeHeight: parseFloat(fade.height), fadeImage: fade.backgroundImage, rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      height: box.height, introHeight: intro.height, introBottom: intro.bottom + scrollY, sampleY: Math.floor(box.bottom + scrollY - 20) };
  });
  audit.measurements.push(metrics);
  expect(metrics.height).toBeGreaterThan(metrics.introHeight + 400);
  // Sample the final canvas gutter below the panel, not its intentional shadow.
  const image = await page.screenshot({ fullPage: true });
  const { data, info } = await sharp(image).extract({ left: 2, top: metrics.sampleY, width: 4, height: 4 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const expected = metrics.base.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  const delta = Math.max(...expected.map((channel, index) => Math.abs(channel - data[index])));
  audit.measurements.push({ sample: [...data.slice(0, info.channels)], base: expected, delta });
  if (metrics.viewport <= 576) {
    expect.soft(metrics.heroImage, 'every mobile variant paints artwork on its introduction').toContain('repeating-linear-gradient');
    expect.soft(metrics.fadeImage, 'every mobile variant fades its introduction').toContain('linear-gradient');
    expect.soft(metrics.fadeHeight, 'the mobile fade occupies the last 3rem').toBe(3 * metrics.rem);
    expect(metrics.base, 'the whole mobile canvas uses the opaque reading surface').toBe(metrics.readingSurface);
    expect(metrics.base).toMatch(/^rgb\(/);
    expect(metrics.image, 'no repeating artwork beneath prose or near the footer').toBe('none');
    expect(delta, 'the lower canvas actually renders the reading surface').toBeLessThanOrEqual(1);
    const surface = metrics.readingSurface.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const distances: number[] = [];
    for (const offset of [metrics.fadeHeight - 2, metrics.fadeHeight / 2, 1]) {
      const { data, info } = await sharp(image).extract({ left: 0, top: Math.floor(metrics.introBottom - offset), width: metrics.viewport, height: 1 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let distance = 0;
      for (let x = 0; x < info.width; x++) for (let channel = 0; channel < 3; channel++) distance += Math.abs(data[x * info.channels + channel] - surface[channel]);
      distances.push(distance / (info.width * 3));
    }
    audit.measurements.push({ fadePixelDistancesFromReadingSurface: distances });
    expect(distances[0], 'visible patterned hero at the start of the fade').toBeGreaterThan(1);
    expect(distances[1], 'rendered pattern fades towards the canvas').toBeLessThan(distances[0]);
    expect(distances[2], 'hero bottom merges into the flat reading canvas').toBeLessThanOrEqual(1);
  } else if (background === 'pattern') {
    expect(metrics.image).toContain('repeating-linear-gradient');
    expect(delta, 'the lower outer canvas visibly paints the artwork rather than a flat fallback').toBeGreaterThan(1);
  } else {
    expect(metrics.image).toBe('none');
    expect(delta, 'the lower outer canvas is a calm flat surface after the fade').toBeLessThanOrEqual(1);
  }
});
