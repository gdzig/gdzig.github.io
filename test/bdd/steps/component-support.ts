import type { Frame, Page } from '@playwright/test';
import { expect, type Audit } from '../fixtures';

export const storyIds = [
  ...['primary-light', 'primary-dark', 'outline-light', 'outline-dark', 'long-label-light', 'long-label-dark'].map(id => `marketing-actionlink--${id}`),
  ...['default-light', 'default-dark', 'overlay-light', 'overlay-dark', 'system'].map(id => `marketing-siteheader--${id}`),
];
export async function themeIs(page: Page | Frame, theme: string) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}
export async function toggle(page: Page | Frame, theme: string, audit: Audit) {
  const before = await page.evaluate(() => (window as any).__themeWrites);
  await page.locator('#theme-toggle').click();
  await themeIs(page, theme);
  const label = `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`;
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', label);
  await expect(page.locator('#theme-toggle')).toHaveAttribute('title', label);
  const writes = await page.evaluate(() => (window as any).__themeWrites) - before;
  audit.writes.push(writes);
  expect(writes, 'one preference write per real click, no duplicate listeners').toBe(1);
}
