import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
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
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
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
