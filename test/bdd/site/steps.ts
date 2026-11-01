import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import sharp from 'sharp';
import { test, expect } from './fixtures';
import { externalDestination } from '../../helpers/browser-paths';

const { Given, When, Then } = createBdd(test);

Given('the built website at {int} pixels with system theme {string}', async ({ page }, width: number, theme: string) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
});
Given('a saved website theme preference of {string}', async ({ context }, theme: string) => {
  await context.addInitScript(theme => {
    if (!sessionStorage.getItem('fixture-preference-seeded')) {
      localStorage.setItem('starlight-theme', theme);
      sessionStorage.setItem('fixture-preference-seeded', '1');
    }
  }, theme);
});
When('I visit the website home page', async ({ page, website }) => {
  const response = await page.goto(website.origin, { waitUntil: 'networkidle' });
  expect(response?.status()).toBe(200);
  await expect(page.locator('.site-header')).toBeVisible();
});
When('I follow the primary navigation link {string}', async ({ page }, label: string) => {
  const mobile = page.locator('.site-header .mobile-nav');
  const links = await mobile.isVisible() ? mobile : page.locator('.site-header .primary-links');
  if (await mobile.isVisible()) await mobile.locator('summary').click();
  await links.getByRole('link', { name: label, exact: true }).click();
  await page.waitForLoadState('networkidle');
});
Then('I arrive at the website path {string}', async ({ page, website }, path: string) => {
  await expect(page).toHaveURL(`${website.origin}${path}`);
  await expect(page.locator('main')).toBeVisible();
});
Then('the page fits the viewport and has one main heading and landmark', async ({ page, website }) => {
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: externalDestination(join(website.output, `${test.info().testId.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`)), fullPage: true });
});
When('I reach documentation using only the keyboard', async ({ page }) => {
  const mobile = page.locator('.site-header .mobile-nav');
  const target = await mobile.isVisible() ? mobile.locator('summary') : page.locator('.site-header .primary-links').getByRole('link', { name: 'Docs', exact: true });
  for (let i = 0; i < 20 && !await target.evaluate(node => document.activeElement === node); i++) await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
  if (await mobile.isVisible()) {
    await page.keyboard.press('Enter');
    await expect(mobile).toHaveAttribute('open', '');
    const docs = mobile.getByRole('link', { name: 'Docs', exact: true });
    for (let i = 0; i < 10 && !await docs.evaluate(node => document.activeElement === node); i++) await page.keyboard.press('Tab');
    await expect(docs).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle');
});
Then('the website uses the {string} theme', async ({ page }, theme: string) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  // The toggle intentionally is not exposed on mobile. Check its label only
  // when visible, rather than treating an inaccessible control as UI.
  const toggle = page.locator('#theme-toggle');
  if (await toggle.isVisible()) await expect(toggle).toHaveAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
});
When('I choose the {string} website theme', async ({ page }, theme: string) => {
  await page.getByRole('button', { name: `Switch to ${theme} theme`, exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBe(theme);
});
When('the operating system switches to the {string} theme', async ({ page }, theme: string) => {
  await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
});
When('I reload the website', async ({ page }) => { await page.reload({ waitUntil: 'networkidle' }); });

When('I return to the website home page through its wordmark', async ({ page, website }) => {
  await page.locator('.site-header .wordmark').click();
  await expect(page).toHaveURL(`${website.origin}/`);
  await page.waitForLoadState('networkidle');
});

const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);

Then('the landing page paints readable {string} surfaces', async ({ page, website }, theme: string) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('.band-hero')).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  const name = `${test.info().testId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${test.info().attachments.length}-${theme}`;
  const path = externalDestination(join(website.output, `${name}.png`));
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await test.info().attach('rendered-landing', { path, contentType: 'image/png' });

  const geometry = await page.evaluate(() => {
    const rect = (node: Element) => {
      const box = node.getBoundingClientRect();
      return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
    };
    const surfaces = ['.site-header', '.band-hero', '.band-dark', '.band-glow', '.landing-footer'].map(selector => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`Missing landing surface: ${selector}`);
      return { selector, ...rect(node) };
    });
    // Cover primary/muted/accent text, both CTAs, navigation and every section.
    const selectors = ['.site-header .wordmark', '.site-header .primary-links a', '.mobile-nav summary',
      '.hero-kicker', '#hero-title', '.hero-sub', '.hero-meta span:not([aria-hidden])', '.hero-actions a',
      '.band h2', '.band h3 a', '.band-heading p', '.feature p', '.status-lede',
      '.status-emphasis', '.status-note', '.update p', '.landing-footer p', '.landing-footer a'];
    const text = selectors.flatMap(selector => {
      const visible = [...document.querySelectorAll(selector)].filter(node => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility === 'visible';
      });
      if (!visible.length && !['.site-header .primary-links a', '.mobile-nav summary'].includes(selector)) {
        throw new Error(`Missing visible landing text: ${selector}`);
      }
      return visible.map(node => {
        const style = getComputedStyle(node);
        const rgb = style.color.match(/^rgba?\(([^)]+)\)$/);
        if (!rgb) throw new Error(`Unsupported foreground color for ${selector}: ${style.color}`);
        let opacity = 1;
        for (let parent: Element | null = node; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
        const size = parseFloat(style.fontSize);
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        return { selector, text: node.textContent?.trim(), color: rgb[1].split(',').map(Number), opacity,
          minimum: large ? 3 : 4.5, x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
      });
    });
    return { surfaces, text };
  });

  // Read actual browser-painted pixels, including stacked gradients and ancestor
  // backgrounds. Transparent background-color is never assumed to be a backdrop.
  // Hide glyphs only in this separate sampling image so antialiasing does not
  // contaminate the backdrop. The attached evidence above is the unmodified page.
  const backdrop = await page.screenshot({ fullPage: true, animations: 'disabled', style:
    '* { -webkit-text-fill-color: transparent !important; text-shadow: none !important; } svg, img { visibility: hidden !important; }' });
  const { data, info } = await sharp(backdrop).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => {
    const px = Math.floor(x), py = Math.floor(y);
    if (px < 0 || py < 0 || px >= info.width || py >= info.height) throw new Error(`Sample outside screenshot: ${x},${y}`);
    const offset = (py * info.width + px) * info.channels;
    return [...data.subarray(offset, offset + 3)];
  };
  const evidence: unknown[] = [];
  for (const surface of geometry.surfaces) {
    // Header samples stay within its top padding, away from the wordmark icon
    // and control borders. Other samples use the empty outer section gutter.
    const samples = [0.2, 0.5, 0.8].map(y => luminance(pixel(
      surface.x + (surface.selector === '.site-header' ? surface.width / 2 : 8),
      surface.y + (surface.selector === '.site-header' ? 4 + y * 4 : surface.height * y),
    )));
    evidence.push({ surface: surface.selector, luminances: samples });
    for (const value of samples) {
      const message = `${surface.selector} must paint a ${theme} surface (sampled luminance ${value.toFixed(3)})`;
      if (theme === 'light') expect.soft(value, message).toBeGreaterThan(0.55);
      else expect.soft(value, message).toBeLessThan(0.2);
    }
  }
  for (const text of geometry.text) {
    const ratios = [0.2, 0.5, 0.8].map(x => {
      const bg = pixel(text.x + text.width * x, text.y + text.height / 2);
      const alpha = (text.color[3] ?? 1) * text.opacity;
      const fg = text.color.slice(0, 3).map((channel, i) => channel * alpha + bg[i] * (1 - alpha));
      const a = luminance(fg), b = luminance(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    evidence.push({ selector: text.selector, text: text.text, sampledContrast: ratios, minimum: text.minimum });
    expect.soft(Math.min(...ratios), `${text.selector} "${text.text}" sampled text/backdrop contrast in ${theme}`).toBeGreaterThanOrEqual(text.minimum);
  }
  await test.info().attach('paint-and-sampled-contrast', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  // Three backdrop samples per text box detect palette regressions, not a full
  // per-glyph WCAG audit or a proof of the minimum across an arbitrary gradient.
});
