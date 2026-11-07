import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';
import { themeIs, toggle } from './component-support';

const { Given, When, Then } = createBdd(test);
Given('storage preference {string}', async ({ context }, preference: string) => {
  await context.addInitScript(({ preference }) => {
    if (preference === 'blocked') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage unavailable for acceptance', 'SecurityError'); } });
    else if (preference !== 'empty' && !sessionStorage.getItem('fixture-seeded')) {
      localStorage.setItem('starlight-theme', preference);
      sessionStorage.setItem('fixture-seeded', '1');
    }
  }, { preference });
});
Then('the header native navigation and theme controls work', async ({ page, audit, catalogue }) => {
  expect(audit.story).toMatch(/^marketing-siteheader--/);
  const button = page.locator('#theme-toggle');
  if (audit.width === 390) {
    await expect(button).toBeHidden();
    const menu = page.locator('.mobile-nav'), summary = menu.locator('summary');
    await summary.click();
    await expect(menu).toHaveAttribute('open', '');
    await expect(menu.locator('a[href="/docs/"]')).toBeVisible();
    await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}-${audit.theme}-menu.png`)) });
    await summary.press('Enter');
    await expect(menu).not.toHaveAttribute('open');
    await summary.press('Space');
    await expect(menu).toHaveAttribute('open', '');
  } else {
    await expect(button).toBeVisible();
    await expect(page.locator('.mobile-nav')).toBeHidden();
    await toggle(page, audit.theme === 'light' ? 'dark' : 'light', audit);
  }
});
Then('native theme policy respects {string} and persists user changes', async ({ page, audit }, preference: string) => {
  await themeIs(page, preference === 'dark' ? 'dark' : 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await themeIs(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await themeIs(page, preference === 'dark' ? 'dark' : 'light');
  if (preference === 'blocked') {
    await page.locator('#theme-toggle').click();
    await themeIs(page, 'dark');
  } else {
    const next = preference === 'dark' ? 'light' : 'dark';
    await toggle(page, next, audit);
    expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBe(next);
    await page.reload({ waitUntil: 'networkidle' });
    await themeIs(page, next);
  }
});
When('I navigate between header stories three times in the manager', async ({ page, catalogue, audit }) => {
  await page.goto(`${catalogue.origin}/?path=/story/marketing-siteheader--default-light`, { waitUntil: 'networkidle' });
  await expect(page.locator('#storybook-preview-iframe')).toBeVisible();
  const managerBefore = await managerStyling(page);
  audit.measurements.push({ managerBefore });
  const frame = () => page.frames().find(frame => frame.url().includes('/iframe.html'))!;
  await expect(frame().locator('#theme-toggle')).toBeVisible();
  const documentToken = await frame().evaluate(() => {
    (window as any).__acceptanceDocumentId = crypto.randomUUID();
    return (window as any).__acceptanceDocumentId;
  });
  for (let n = 0; n < 3; n++) for (const id of ['marketing-siteheader--default-dark', 'marketing-siteheader--default-light']) {
    const previous = await frame().locator('gdzig-site-header').elementHandle();
    await page.locator(`[data-item-id="${id}"]`).click();
    await frame().waitForFunction(node => !node!.isConnected, previous, { timeout: 10_000 });
    await previous!.dispose();
    await expect(frame().locator('#theme-toggle')).toBeVisible();
    expect(await frame().evaluate(() => (window as any).__acceptanceDocumentId)).toBe(documentToken);
    await themeIs(frame(), id.endsWith('dark') ? 'dark' : 'light');
    await toggle(frame(), id.endsWith('dark') ? 'light' : 'dark', audit);
  }
});
Then('each remounted native theme button has exactly one listener', async ({ audit }) => {
  expect(audit.writes).toEqual([1, 1, 1, 1, 1, 1]);
});

function managerStyling(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { background: style.backgroundColor, color: style.color, font: style.fontFamily,
      theme: document.documentElement.getAttribute('data-theme'), pico: document.body.classList.contains('pico') };
  });
}
Then('the Storybook manager keeps its own styling', async ({ page, audit }) => {
  const before = audit.measurements.find(value => !!value && typeof value === 'object' && 'managerBefore' in value) as { managerBefore: Awaited<ReturnType<typeof managerStyling>> };
  const after = await managerStyling(page);
  expect(before.managerBefore.pico).toBe(false);
  expect(after).toEqual(before.managerBefore);
  audit.measurements.push({ managerAfter: after });
});
