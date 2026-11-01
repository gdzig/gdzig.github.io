import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';

const { Then } = createBdd(test);
Then('the action link exposes native interaction states', async ({ page, audit, catalogue }) => {
  expect(audit.story).toMatch(/^marketing-actionlink--/);
  if (audit.width === 390 || audit.story.includes('long-label')) return;
  const action = page.locator('.hero-actions a');
  for (const state of ['hover', 'focus', 'pressed']) {
    if (state === 'hover') await action.hover();
    if (state === 'focus') {
      await page.mouse.move(0, 0);
      for (let n = 0; n < 20 && !await action.evaluate(node => node === document.activeElement); n++) await page.keyboard.press('Tab');
    }
    if (state === 'pressed') { await action.hover(); await page.mouse.down(); }
    await page.waitForTimeout(250); // Wait for the real production paint transition.
    const reached = await action.evaluate((node, state) => node.matches(state === 'focus' ? ':focus-visible' : state === 'pressed' ? ':active' : ':hover'), state);
    expect(reached, `native ${state} pseudo-class`).toBe(true);
    const paint = await action.evaluate(node => {
      const s = getComputedStyle(node);
      return { background: s.backgroundColor, color: s.color, outline: s.outline, outlineColor: s.outlineColor, outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, shadow: s.boxShadow };
    });
    audit.measurements.push({ state, ...paint });
    if (state === 'hover') expect(paint.background).toBe(audit.story.includes('--outline') ? 'rgb(248, 239, 227)' : 'rgb(255, 183, 67)');
    if (state === 'focus') {
      const outline = paint.outlineColor === 'rgb(246, 163, 29)' && parseFloat(paint.outlineWidth) > 0 && paint.outlineStyle !== 'none';
      const shadow = paint.shadow.includes('rgba(246, 163, 29, 0.45)') && /[1-9][\d.]*px/.test(paint.shadow);
      expect(outline || shadow, 'visible production amber keyboard-focus ring').toBe(true);
    }
    await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}-${state}.png`)) });
    if (state === 'pressed') { await page.mouse.move(0, 0); await page.mouse.up(); }
  }
});
