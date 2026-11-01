import { access, mkdir, realpath, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBlogSite } from '../helpers/blog-site';
import { copySlug, copyText, writeCopyFixture } from '../fixtures/blog/copy';

// Optional real production test, deliberately not *.test.ts. Never installs tooling.
const repository = resolve(import.meta.dir, '../..');
const widths = [390, 1447], themes = ['light', 'dark'] as const, modes = ['desktop', 'touch'] as const;
const selector = '.blog-prose .expressive-code .copy button';
type Check = { name: string; pass: boolean; actual: unknown; expected: unknown };
const report = { startedAt: new Date().toISOString(), build: null as unknown,
  cases: [] as { width: number; theme: string; mode: string; checks: Check[] }[],
  blockedExternal: [] as string[], runtimeErrors: [] as string[], error: null as string | null };

function inside(parent: string, child: string) {
  const path = relative(parent, child);
  return !path || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}
// Canonicalize existing ancestors too, including destinations not yet created.
async function canonicalDestination(path: string): Promise<string> {
  try { return await realpath(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return join(await canonicalDestination(dirname(path)), basename(path));
  }
}
async function outputDirectory() {
  const configured = process.env.BLOG_BROWSER_OUTPUT_DIR;
  if (!configured) throw new Error('Set BLOG_BROWSER_OUTPUT_DIR to an evidence directory outside the website repository.');
  const destination = await canonicalDestination(resolve(configured));
  if (inside(await realpath(repository), destination)) {
    throw new Error('BLOG_BROWSER_OUTPUT_DIR must be outside the website repository (including symlinks).');
  }
  await mkdir(destination, { recursive: true });
  return destination;
}
async function browserRuntime() {
  const configured = process.env.PLAYWRIGHT_MODULE ?? 'playwright';
  let runtime;
  try {
    runtime = await import(isAbsolute(configured) || configured.startsWith('.') ? pathToFileURL(resolve(configured)).href : configured);
  } catch (error) {
    throw new Error(`Cannot load Playwright module ${JSON.stringify(configured)}. Set PLAYWRIGHT_MODULE to an installed ESM module. Nothing was downloaded.\n${error}`);
  }
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath) throw new Error('Set CHROME_PATH to an existing Chrome/Chromium executable. Nothing is downloaded.');
  try { await access(executablePath, constants.X_OK); } catch {
    throw new Error(`CHROME_PATH is not an executable: ${JSON.stringify(executablePath)}`);
  }
  if (!runtime.chromium?.launch) throw new Error('PLAYWRIGHT_MODULE must export chromium.launch.');
  return runtime.chromium.launch({ executablePath, headless: true });
}

// Only inspect the actual Astro/Expressive Code DOM. No replacement buttons or JS.
function measureCopy({ selector, state }: { selector: string; state: string }): Check[] {
  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing production button: ${selector}`);
  const checks: Check[] = [];
  const check = (name: string, pass: boolean, actual: unknown, expected: unknown) => checks.push({ name: `${state}: ${name}`, pass, actual, expected });
  const style = getComputedStyle(button), icon = getComputedStyle(button, '::after');
  const before = getComputedStyle(button, '::before'), box = button.getBoundingClientRect();
  const rgba = (value: string) => {
    const values = value.match(/[\d.]+/g)?.map(Number) ?? [];
    return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
  };
  const opaque = (value: string) => rgba(value)[3] > .1;
  const amber = (value: string) => {
    const [r, g, b, a] = rgba(value);
    return a > .1 && r > g * 1.15 && g > b * 1.3 && r - b > 50;
  };
  const dark = (value: string) => Math.max(...rgba(value).slice(0, 3)) < 90;
  let opacity = 1, displayed = true;
  for (let node: Element | null = button; node; node = node.parentElement) {
    const s = getComputedStyle(node);
    opacity *= Number(s.opacity);
    displayed &&= s.display !== 'none' && s.visibility === 'visible';
  }
  check('visible button', displayed && opacity >= .5 && box.width > 0 && box.height > 0, { displayed, opacity, width: box.width, height: box.height }, 'visible, effective opacity >= .5');
  check('small square', box.width >= 24 && box.width <= 52 && Math.abs(box.width - box.height) <= 2, { width: box.width, height: box.height }, '24..52px square');
  const radius = parseFloat(style.borderTopLeftRadius);
  check('rounded, not circular', radius > 0 && radius < box.height / 2, radius, `0 < radius < ${box.height / 2}`);
  const padding = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
  check('no inherited Pico padding', padding.every(value => parseFloat(value) === 0), padding, '0 on all sides');
  check('native masked copy glyph', icon.content !== 'none' && icon.maskImage !== 'none' && parseFloat(icon.width) > 0 && parseFloat(icon.height) > 0,
    { content: icon.content, mask: icon.maskImage, width: icon.width, height: icon.height }, 'existing nonempty ::after mask');
  check('nontransparent glyph', opaque(icon.backgroundColor) && Number(icon.opacity) >= .5, { color: icon.backgroundColor, opacity: icon.opacity }, 'painted, opaque glyph');
  const blend = (top: number[], bottom: number[]) => top.slice(0, 3).map((channel, index) => channel * top[3] + bottom[index] * (1 - top[3]));
  let surface = [255, 255, 255];
  const ancestors: Element[] = [];
  for (let node: Element | null = button; node; node = node.parentElement) ancestors.unshift(node);
  for (const node of ancestors) surface = blend(rgba(getComputedStyle(node).backgroundColor), surface);
  const visibleLayers = [...button.children].filter(node => {
    const s = getComputedStyle(node);
    return s.display !== 'none' && s.visibility === 'visible' && Number(s.opacity) > 0;
  });
  for (const node of visibleLayers) {
    const s = getComputedStyle(node), color = rgba(s.backgroundColor);
    color[3] *= Number(s.opacity);
    surface = blend(color, surface);
  }
  const luminance = (color: number[]) => color.slice(0, 3).map(channel => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  const foreground = blend(rgba(icon.backgroundColor), surface), a = luminance(foreground), b = luminance(surface);
  const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  check('discernible glyph against surface', contrast >= 3, contrast, 'contrast >= 3:1');
  const surfaces = [style.backgroundColor, ...visibleLayers.map(node => getComputedStyle(node).backgroundColor)];
  if (state === 'idle' || state === 'reset' || state === 'touch-idle') {
    check('neutral idle surface', Math.max(...surface) - Math.min(...surface) <= 45, surface, 'rendered neutral surface (channel spread <= 45)');
    check('truly idle', !button.matches(':focus-visible') && !button.matches(':active'), { focusVisible: button.matches(':focus-visible'), active: button.matches(':active') }, 'not focus-visible or pressed');
  }
  if (['hover', 'focus', 'pressed'].includes(state)) {
    const accents = [icon.backgroundColor, style.color, style.borderColor, style.outlineColor, style.boxShadow, before.borderColor, ...surfaces];
    // An amber computed outline only counts if it is actually drawn.
    const paintedAccents = [icon.backgroundColor, ...surfaces,
      ...(parseFloat(style.borderWidth) > 0 ? [style.borderColor] : []),
      ...(style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 ? [style.outlineColor] : []),
      ...(Number(before.opacity) > 0 && before.content !== 'none' && parseFloat(before.borderWidth) > 0 ? [before.borderColor] : [])];
    const shadowColors = style.boxShadow.match(/rgba?\([^)]+\)/g) ?? [];
    check('amber interaction accent', paintedAccents.some(amber) || shadowColors.some(amber), accents, 'visible amber accent');
    check('interaction reached', button.matches(state === 'focus' ? ':focus-visible' : state === 'pressed' ? ':active' : ':hover'), state, 'native matching interaction pseudo-class');
  }
  if (state === 'copied') {
    const feedback = button.parentElement!.querySelector<HTMLElement>('.feedback');
    const s = feedback && getComputedStyle(feedback);
    check('native Copied! feedback', !!feedback?.classList.contains('show') && feedback.textContent === 'Copied!' && Number(s?.opacity) >= .9,
      { text: feedback?.textContent, opacity: s?.opacity }, 'visible native Copied!');
    check('amber tooltip and dark foreground', !!s && amber(s.backgroundColor) && dark(s.color), { background: s?.backgroundColor, foreground: s?.color }, 'amber background, dark text');
    check('tooltip stays in viewport', !!feedback && feedback.getBoundingClientRect().left >= 0 && feedback.getBoundingClientRect().right <= innerWidth,
      feedback && { left: feedback.getBoundingClientRect().left, right: feedback.getBoundingClientRect().right }, `within 0..${innerWidth}`);
  }
  return checks;
}

async function main() {
  const output = await outputDirectory(), stamp = new Date().toISOString().replace(/[:.]/g, '-');
  // The helper's build, caches, preview output and reports all remain external.
  const scratch = await canonicalDestination(join(output, 'scratch'));
  if (inside(await realpath(repository), scratch)) throw new Error('Browser fixture scratch must remain outside the repository (including symlinks).');
  process.env.JCODE_SCRATCH_DIR = scratch;
  let site: Awaited<ReturnType<typeof createBlogSite>> | undefined, browser: any;
  try {
    browser = await browserRuntime();
    site = await createBlogSite();
    await writeCopyFixture(site);
    report.build = await site.build();
    if ((report.build as { status: number }).status !== 0) throw new Error(`Production build failed: ${JSON.stringify(report.build)}`);
    const server = await site.start('preview');
    for (const width of widths) for (const theme of themes) for (const mode of modes) {
      const entry = { width, theme, mode, checks: [] as Check[] };
      report.cases.push(entry);
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme,
        hasTouch: mode === 'touch', isMobile: mode === 'touch', deviceScaleFactor: 1,
        permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'block' });
      try {
        await context.route('**/*', async (route: any) => {
          const url = route.request().url();
          if (new URL(url).origin === server.origin) return route.continue();
          report.blockedExternal.push(url);
          return route.fulfill({ status: 204, body: '' });
        });
        const page = await context.newPage();
        page.on('pageerror', (error: Error) => report.runtimeErrors.push(`${width}/${theme}/${mode}: ${error.stack ?? error.message}`));
        page.on('console', (message: any) => { if (message.type() === 'error') report.runtimeErrors.push(`${width}/${theme}/${mode}: ${message.text()}`); });
        const response = await page.goto(`${server.origin}/blog/${copySlug}/`, { waitUntil: 'networkidle' });
        if (response?.status() !== 200) throw new Error(`Fixture returned ${response?.status()}`);
        await page.evaluate(() => document.fonts.ready);
        const button = page.locator(selector), frame = page.locator('.blog-prose .expressive-code').first();
        await frame.scrollIntoViewIfNeeded();
        let capture = 0;
        const record = async (state: string) => {
          await page.waitForTimeout(250); // Native opacity/background transitions are 200ms.
          entry.checks.push(...await page.evaluate(measureCopy, { selector, state }));
          const box = await frame.boundingBox();
          if (!box) throw new Error('Missing fixture frame rectangle');
          const x = Math.max(0, Math.floor(box.x - 8)), y = Math.max(0, Math.floor(box.y - 48));
          await page.screenshot({ path: join(output, `${stamp}-${width}-${theme}-${mode}-${++capture}-${state}.png`),
            clip: { x, y, width: Math.min(width - x, Math.ceil(box.width + 16)), height: Math.ceil(box.height + 96) } });
        };
        const check = (name: string, pass: boolean, actual: unknown, expected: unknown) => entry.checks.push({ name, pass, actual, expected });
        check('requested theme applied', await page.getAttribute('html', 'data-theme') === theme, await page.getAttribute('html', 'data-theme'), theme);
        check('real fixture code', await frame.locator('pre code').innerText() === copyText, await frame.locator('pre code').innerText(), copyText);
        await page.mouse.move(0, 0);
        await record(mode === 'desktop' ? 'idle' : 'touch-idle');
        const copied = async () => {
          await page.waitForFunction(() => {
            const node = document.querySelector('.blog-prose .copy .feedback.show');
            return node && Number(getComputedStyle(node).opacity) >= .95;
          }, undefined, { timeout: 5000 });
          await record('copied');
          const actual = await page.evaluate(() => navigator.clipboard.readText());
          check('real clipboard equals synthetic multiline fixture', actual === copyText, actual, copyText);
          await page.waitForFunction(() => !document.querySelector('.blog-prose .copy .feedback'), undefined, { timeout: 6000 });
        };
        if (mode === 'desktop') {
          await button.hover();
          await record('hover');
          await page.mouse.move(0, 0);
          for (let tabs = 0; tabs < 50 && !await button.evaluate((node: Element) => node === document.activeElement); tabs++) await page.keyboard.press('Tab');
          await record('focus');
          await page.keyboard.press('Enter');
          await copied();
          await button.hover();
          await page.mouse.down();
          await record('pressed');
          await page.mouse.up();
          await copied();
          await page.mouse.move(0, 0);
          await page.keyboard.press('Tab');
        } else {
          await button.tap();
          await copied();
          await page.locator('.blog-prose > p').first().tap();
        }
        await record('reset');
        check('feedback removed after reset', await page.locator('.blog-prose .copy .feedback').count() === 0, await page.locator('.blog-prose .copy .feedback').count(), 0);
        check('no page horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), await page.evaluate(() => document.documentElement.scrollWidth), `<= ${width + 1}`);
        // Real home controls with/without the built article asset catch global leaks.
        const styles: string[] = await page.locator('link[rel="stylesheet"]').evaluateAll((nodes: HTMLLinkElement[]) => nodes.map(node => node.href));
        await page.goto(server.origin, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const snapshot = () => page.evaluate(() => ['.site-header', '.site-nav', '#theme-toggle', '#hero-title', '.hero-actions a', '.landing-footer'].map(selector => {
          const node = document.querySelector(selector);
          if (!node) throw new Error(`Missing marketing control ${selector}`);
          const s = getComputedStyle(node), r = node.getBoundingClientRect();
          const properties = ['color', 'background-color', 'border', 'border-radius', 'box-shadow', 'outline', 'opacity', 'font-size', 'line-height', 'padding', 'margin'];
          return { selector, box: [r.x, r.y, r.width, r.height], styles: properties.map(key => [key, s.getPropertyValue(key)]) };
        }));
        const before = await snapshot();
        const existing: string[] = await page.locator('link[rel="stylesheet"]').evaluateAll((nodes: HTMLLinkElement[]) => nodes.map(node => node.href));
        for (const url of styles.filter(url => !existing.includes(url))) await page.addStyleTag({ url });
        const after = await snapshot();
        check('marketing controls unchanged by article styles', JSON.stringify(before) === JSON.stringify(after), after, before);
      } catch (error) {
        entry.checks.push({ name: 'case completed without runtime/harness error', pass: false, actual: String(error), expected: 'all native interactions completed' });
      } finally { await context.close(); }
      const failed = entry.checks.filter(check => !check.pass);
      console.log(`${width}/${theme}/${mode}: ${entry.checks.length - failed.length}/${entry.checks.length} passed`);
      for (const check of failed) console.error(`  FAIL ${check.name}: ${JSON.stringify(check.actual)} expected ${JSON.stringify(check.expected)}`);
    }
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(report.error);
  } finally {
    await browser?.close();
    await site?.dispose();
    const path = join(output, `${stamp}-report.json`);
    await writeFile(path, JSON.stringify(report, null, 2) + '\n');
    console.log(`Evidence: ${path}`);
  }
  const failures = report.cases.flatMap(entry => entry.checks.filter(check => !check.pass));
  const failed = !!report.error || failures.length > 0 || report.runtimeErrors.length > 0 || report.cases.length !== 8;
  const count = report.cases.reduce((sum, entry) => sum + entry.checks.length, 0);
  console.log(`${failed ? 'RED' : 'GREEN'}: ${report.cases.length}/8 cases, ${count} checks, ${failures.length} assertion failures, ${report.runtimeErrors.length} runtime errors`);
  process.exitCode = failed ? 1 : 0;
}
await main();
