import type { Frame, Page } from '@playwright/test';
import { expect, type Audit } from '../fixtures';

export const storyIds = [
  ...['primary-light', 'primary-dark', 'outline-light', 'outline-dark', 'long-label-light', 'long-label-dark'].map(id => `marketing-actionlink--${id}`),
  ...['default-light', 'default-dark', 'overlay-light', 'overlay-dark', 'system'].map(id => `marketing-siteheader--${id}`),
  ...['light', 'dark'].map(id => `marketing-sitefooter--${id}`),
  ...['page-light', 'page-dark', 'article-light', 'article-dark', 'long-article'].map(id => `marketing-pageintro--${id}`),
  ...['default-light', 'default-dark', 'pattern-light', 'pattern-dark', 'roomy', 'compact'].map(id => `marketing-readingpanel--${id}`),
  ...['fade-light', 'fade-dark', 'pattern-light', 'pattern-dark', 'article-fade-light', 'article-fade-dark', 'article-pattern-light', 'article-pattern-dark', 'empty-fade', 'empty-pattern', 'long-article-title', 'roomy-panel', 'compact-panel'].map(id => `marketing-marketingpage--${id}`),
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
