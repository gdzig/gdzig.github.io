import { createBdd } from 'playwright-bdd';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { externalDestination } from '../../helpers/browser-paths';
import projects from '../../../src/content/showcase/projects.json' with { type: 'json' };

const { Given, Then } = createBdd(test);
const longToken = 'FIXTURE_LONG_TEXT_'.repeat(12);

for (const [kind, component] of [['heading', 'sectionheading'], ['project', 'showcasecard']] as const) {
  Given(`the showcase ${kind} {string} canvas is opened at {int} pixels in {string}`, async ({ page, catalogue, audit }, variant: string, width: number, theme: string) => {
    audit.story = `marketing-${component}--${variant}-${theme}`;
    audit.width = width;
    audit.theme = theme;
    const response = await page.request.get(`${catalogue.origin}/index.json`);
    expect(response.ok(), 'real Storybook catalogue is available').toBe(true);
    const index = await response.json();
    expect(index.entries[audit.story], `real ${component} story registered before navigation`).toBeDefined();
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme as 'light' | 'dark', reducedMotion: 'reduce' });
    const canvas = await page.goto(`${catalogue.origin}/iframe.html?id=${audit.story}&viewMode=story`, { waitUntil: 'networkidle' });
    expect(canvas?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.evaluate(() => document.fonts.ready);
  });
}

Then('the showcase heading retains its title association and description', async ({ page, audit }) => {
  const long = audit.story.includes('--long-');
  const title = long ? longToken : 'Games';
  const description = long ? `FIXTURE_DESCRIPTION ${longToken}` : 'Built with GDZig';
  const section = page.getByRole('region', { name: title, exact: true });
  await expect(section).toBeVisible();
  await expect(section.locator('header > h2')).toHaveText(title);
  await expect(section.locator('header > h2')).toHaveAttribute('id', 'fixture-section-title');
  await expect(section.locator('header > p')).toHaveText(description);
  await expect(section.getByRole('heading')).toHaveCount(1);
  const paint = await section.locator('header').evaluate(node => ({ border: getComputedStyle(node).borderTopWidth, radius: getComputedStyle(node).borderRadius }));
  audit.measurements.push(paint);
  expect(parseFloat(paint.border), 'visible angular heading rule').toBeGreaterThan(0);
  expect(paint.radius).toBe('0px');
});

Then('the showcase card retains all supplied project content and destinations', async ({ page, audit }) => {
  const variant = audit.story.replace('marketing-showcasecard--', '').replace(/-(light|dark)$/, '');
  const real = projects.find(project => project.id === variant);
  const long = variant === 'long';
  const project = real ? { details: [], ...real } : {
    title: long ? longToken : 'FIXTURE_MINIMAL_PROJECT',
    summary: 'FIXTURE_SUMMARY: synthetic project, not a community submission.',
    tags: long ? [longToken, 'FIXTURE_TAG'] : [],
    details: long ? ['FIXTURE_DETAIL: synthetic project detail.'] : [],
    primaryLink: { label: long ? longToken : 'FIXTURE_DESTINATION', url: 'https://example.invalid/fixture-project' },
  };
  const card = page.getByRole('article');
  await expect(card).toHaveCount(1);
  const paint = await card.evaluate(node => {
    const style = getComputedStyle(node);
    return { radius: style.borderRadius, shadow: style.boxShadow, border: style.borderTopWidth };
  });
  audit.measurements.push(paint);
  expect(paint.radius, 'angular marketing card surface').toBe('0px');
  expect(paint.shadow).toBe('none');
  expect(parseFloat(paint.border)).toBe(2);
  await expect(card.locator('h3 > a')).toHaveText(project.title);
  await expect(card.locator('h3 > a')).toHaveAttribute('href', project.primaryLink.url);
  await expect(card.locator(':scope > p')).toHaveText([project.summary, ...project.details]);
  await expect(card.locator('.showcase-author')).toHaveCount(real?.author ? 1 : 0);
  if (real?.author) await expect(card.locator('.showcase-author')).toHaveText(real.author);
  await expect(card.locator('.showcase-note')).toHaveCount(real && 'note' in real ? 1 : 0);
  if (real && 'note' in real) await expect(card.locator('.showcase-note')).toHaveText(real.note!);
  await expect(card.getByRole('img')).toHaveCount(real?.image ? 1 : 0);
  if (real?.image) {
    await expect(card.getByRole('img')).toHaveAttribute('src', real.image.src);
    await expect(card.getByRole('img')).toHaveAttribute('alt', real.image.alt);
    expect(await card.getByRole('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await expect(card.locator('.showcase-tags')).toHaveCount(project.tags.length ? 1 : 0);
  if (project.tags.length) {
    await expect(card.getByRole('list', { name: `${project.title} tags` }).getByRole('listitem')).toHaveText(project.tags);
  }
  const actions = card.locator('.actions');
  await expect(actions).toHaveAttribute('aria-label', `${project.title} links`);
  const primary = actions.getByRole('button', { name: `Open ${project.title} on ${project.primaryLink.label}`, exact: true });
  await expect(primary).toHaveAttribute('href', project.primaryLink.url);
  await expect(primary).toHaveText(project.primaryLink.label);
  const primaryPaint = await primary.evaluate(node => {
    const style = getComputedStyle(node);
    const icon = node.querySelector('svg')!.getBoundingClientRect();
    const label = node.querySelector('span')!.getBoundingClientRect();
    return { display: style.display, gap: label.left - icon.right, color: style.color, background: style.backgroundColor, radius: parseFloat(style.borderRadius) };
  });
  audit.measurements.push(primaryPaint);
  expect(['flex', 'inline-flex'], 'icon action uses actual flex layout, including blockified flex items').toContain(primaryPaint.display);
  expect(primaryPaint.gap, 'visible horizontal gap between icon and label').toBeGreaterThan(0);
  expect(primaryPaint.radius).toBeLessThanOrEqual(5);
  expect(primaryPaint.color, 'dark text remains legible on amber in either theme').toBe('rgb(23, 19, 11)');
  expect(primaryPaint.background, 'opaque amber primary surface').toBe('rgb(246, 163, 29)');
  expect(await card.evaluate(node => getComputedStyle(node).backgroundColor), 'opaque themed card surface').toBe(audit.theme === 'dark' ? 'rgb(21, 18, 13)' : 'rgb(255, 248, 239)');
  await expect(primary.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  const source = real && 'sourceLink' in real ? real.sourceLink : undefined;
  await expect(actions.getByRole('button')).toHaveCount(source ? 2 : 1);
  if (source) {
    const secondary = actions.getByRole('button', { name: `Open ${project.title} source on GitHub`, exact: true });
    await expect(secondary).toHaveAttribute('href', source.url);
    await expect(secondary).toHaveText(source.label);
    await expect(secondary).toHaveClass(/outline/);
    const secondaryLayout = await secondary.evaluate(node => {
      const icon = node.querySelector('svg')!.getBoundingClientRect();
      const label = node.querySelector('span')!.getBoundingClientRect();
      return { display: getComputedStyle(node).display, gap: label.left - icon.right };
    });
    audit.measurements.push(secondaryLayout);
    expect(['flex', 'inline-flex']).toContain(secondaryLayout.display);
    expect(secondaryLayout.gap).toBeGreaterThan(0);
    expect(await secondary.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  }
});

Then('the showcase card has native focused links without a card overlay', async ({ page, audit }) => {
  const card = page.getByRole('article');
  await expect(card.locator('a')).toHaveCount(await card.locator('.actions a').count() + 1);
  expect(await card.evaluate(node => ({ tabindex: node.getAttribute('tabindex'), onclick: node.getAttribute('onclick') }))).toEqual({ tabindex: null, onclick: null });
  for (const link of await card.locator('a').all()) {
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    const focus = await link.evaluate(node => {
      const style = getComputedStyle(node);
      return { visible: node.matches(':focus-visible'), outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, shadow: style.boxShadow, position: style.position, after: getComputedStyle(node, '::after').content };
    });
    audit.measurements.push(focus);
    expect(focus.visible).toBe(true);
    expect((parseFloat(focus.outlineWidth) > 0 && focus.outlineStyle !== 'none') || focus.shadow !== 'none').toBe(true);
    expect(focus.position).not.toBe('absolute');
    expect(['none', 'normal']).toContain(focus.after);
  }
  const neutralPoint = await card.locator(':scope > p').first().evaluate(node => {
    const box = node.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('a') === null;
  });
  expect(neutralPoint, 'summary is not a card-wide clickable overlay').toBe(true);
});

Then('the showcase component fits the viewport', async ({ page, audit, catalogue }) => {
  const metrics = await page.locator('main').evaluate(node => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, overflowing: [...node.querySelectorAll('*')].filter(child => { const box = child.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1; }).map(child => child.tagName) }));
  audit.measurements.push(metrics);
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.overflowing).toEqual([]);
  await page.screenshot({ path: externalDestination(join(catalogue.output, `${audit.story}-${audit.width}.png`)), fullPage: true });
});
