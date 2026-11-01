import { access, mkdir, realpath, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBlogSite } from '../helpers/blog-site';
import { proseSlug, quoteVariants, writeProseFixture } from '../fixtures/blog/prose';

// Deliberately not *.test.ts: browser tooling is optional and never auto-installed.
const repository = resolve(import.meta.dir, '../..');
const widths = [390, 576, 768, 1447];
const themes = ['light', 'dark'] as const;
type Check = { name: string; pass: boolean; actual: unknown; expected: unknown };
const report = { startedAt: new Date().toISOString(), build: null as unknown, cases: [] as { width: number; theme: string; checks: Check[] }[], blockedExternal: [] as string[], error: null as string | null };

function inside(parent: string, child: string) {
  const path = relative(parent, child);
  return !path || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

// Resolve existing ancestors first so a symlink cannot disguise a repo descendant.
async function canonicalDestination(path: string): Promise<string> {
  try { return await realpath(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return join(await canonicalDestination(dirname(path)), basename(path));
  }
}
async function outputDirectory() {
  const configured = process.env.BLOG_BROWSER_OUTPUT_DIR;
  if (!configured) return undefined;
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
    throw new Error(`Cannot load Playwright module ${JSON.stringify(configured)}. Set PLAYWRIGHT_MODULE to an installed ESM module or install it yourself. Nothing was downloaded.\n${error}`);
  }
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath) throw new Error('Set CHROME_PATH to an existing Chrome/Chromium executable. This harness never downloads a browser.');
  try { await access(executablePath, constants.X_OK); } catch {
    throw new Error(`CHROME_PATH is not an executable: ${JSON.stringify(executablePath)}`);
  }
  if (!runtime.chromium?.launch) throw new Error('PLAYWRIGHT_MODULE must export chromium.launch.');
  return runtime.chromium.launch({ executablePath, headless: true });
}

// All values below are measured in the production DOM, not parsed CSS source.
function measureProse(variants: readonly string[]): Check[] {
  const checks: Check[] = [];
  const check = (name: string, pass: boolean, actual: unknown, expected: unknown) => checks.push({ name, pass, actual, expected });
  const near = (name: string, actual: number, expected: number) => check(name, Math.abs(actual - expected) <= 1, actual, expected);
  const element = (selector: string, parent: ParentNode = document) => {
    const found = parent.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`Missing fixture element: ${selector}`);
    return found;
  };
  const css = (node: Element) => getComputedStyle(node);
  const px = (node: Element, property: string) => parseFloat(css(node).getPropertyValue(property));
  const rect = (node: Element) => node.getBoundingClientRect();
  const rem = px(document.documentElement, 'font-size');
  const prose = element('.blog-prose');
  const article = element('.blog-post');
  const quotes = [...prose.querySelectorAll<HTMLElement>(':scope > blockquote')];
  check('fixture quote variants', quotes.length === variants.length, quotes.length, variants.length);
  const inspectQuote = (quote: HTMLElement, label: string) => {
    const first = quote.firstElementChild!, last = quote.lastElementChild!;
    const top = rect(first).top - rect(quote).top - px(quote, 'border-top-width');
    const bottom = rect(quote).bottom - rect(last).bottom - px(quote, 'border-bottom-width');
    near(`${label}: compact top edge`, top, .25 * rem);
    near(`${label}: compact bottom edge`, bottom, .25 * rem);
    near(`${label}: symmetric edges`, top, bottom);
    near(`${label}: first child top margin`, px(first, 'margin-top'), 0);
    near(`${label}: final child bottom margin`, px(last, 'margin-bottom'), 0);
    near(`${label}: left padding`, px(quote, 'padding-left'), 1.5 * rem);
    near(`${label}: border width`, px(quote, 'border-left-width'), 3);
    near(`${label}: top margin`, px(quote, 'margin-top'), 1.5 * rem);
    const isFinalNestedQuote = quote.parentElement?.matches('blockquote') && quote === quote.parentElement.lastElementChild;
    near(`${label}: bottom margin`, px(quote, 'margin-bottom'), isFinalNestedQuote ? 0 : 1.5 * rem);
  };
  quotes.forEach((quote, index) => inspectQuote(quote, `quote ${variants[index]}`));
  inspectQuote(element('blockquote blockquote', prose), 'quote nested inner');
  const multiple = quotes[1];
  const paragraphs = multiple.querySelectorAll(':scope > p');
  check('fixture multiparagraph quote', paragraphs.length === 2, paragraphs.length, 2);
  const internalGap = rect(paragraphs[1]).top - rect(paragraphs[0]).bottom;
  near('multiparagraph internal spacing retained', internalGap, rem);
  for (const [index, item] of [...prose.querySelectorAll('li:last-child')].entries()) {
    near(`final list item ${index}: no trailing margin`, px(item, 'margin-bottom'), 0);
    if (item.lastElementChild) near(`final list item ${index}: final child no trailing margin`, px(item.lastElementChild, 'margin-bottom'), 0);
  }
  const h1 = element('.blog-post > header h1');
  near('header h1 top margin', px(h1, 'margin-top'), 0);
  near('header h1 bottom margin', px(h1, 'margin-bottom'), rem);
  const titleGap = rect(h1.nextElementSibling!).top - rect(h1).bottom;
  check('header h1 positive bottom gap', titleGap > 0, titleGap, '> 0');
  near('first prose child has no top margin', px(prose.firstElementChild!, 'margin-top'), 0);
  const h2 = element('#fixture_second_heading, #fixture-second-heading', prose);
  const h3 = element('h3', prose);
  near('h2 top rhythm', px(h2, 'margin-top'), 2 * rem);
  near('h2 bottom rhythm', px(h2, 'margin-bottom'), rem);
  near('h3 top rhythm', px(h3, 'margin-top'), 1.5 * rem);
  near('h3 bottom rhythm', px(h3, 'margin-bottom'), .75 * rem);
  near('h2 following paragraph gap', rect(h2.nextElementSibling!).top - rect(h2).bottom, rem);
  near('h3 following paragraph gap', rect(h3.nextElementSibling!).top - rect(h3).bottom, .75 * rem);
  for (const selector of [':scope > ul', ':scope > ol', ':scope > p:not(:has(img))']) {
    const node = element(selector, prose);
    near(`${selector}: top margin`, px(node, 'margin-top'), 0);
    near(`${selector}: bottom margin`, px(node, 'margin-bottom'), rem);
  }
  const nestedList = element('li > ul', prose);
  near('nested list top rhythm', px(nestedList, 'margin-top'), .5 * rem);
  near('nested list bottom rhythm', px(nestedList, 'margin-bottom'), 0);
  const image = element('img', prose) as HTMLImageElement;
  check('fixture image loaded', image.complete && image.naturalWidth > 0, image.naturalWidth, '> 0');
  near('image top spacing', px(image, 'margin-top'), 1.5 * rem);
  near('image bottom spacing', px(image, 'margin-bottom'), 1.5 * rem);
  near('image radius', px(image, 'border-top-left-radius'), .5 * rem);
  const imageParent = image.parentElement!;
  check('image preceding visible gap', rect(image).top - rect(imageParent.previousElementSibling!).bottom >= 1.5 * rem - 1,
    rect(image).top - rect(imageParent.previousElementSibling!).bottom, '>= 1.5rem');
  check('image following visible gap', rect(imageParent.nextElementSibling!).top - rect(image).bottom >= 1.5 * rem - 1,
    rect(imageParent.nextElementSibling!).top - rect(image).bottom, '>= 1.5rem');
  const pre = element('pre', prose), code = element('pre code', prose), table = element('table', prose);
  for (const [label, node] of [['pre', pre], ['table', table]] as const) {
    check(`${label}: local horizontal overflow`, node.scrollWidth > node.clientWidth + 20, { scroll: node.scrollWidth, client: node.clientWidth }, 'scroll > client + 20');
    check(`${label}: horizontal scroll container`, ['auto', 'scroll'].includes(css(node).overflowX), css(node).overflowX, 'auto or scroll');
    check(`${label}: fits reading column`, rect(node).width <= rect(prose).width + 1, rect(node).width, `<= ${rect(prose).width}`);
    node.scrollLeft = 50;
    check(`${label}: scroll is usable`, node.scrollLeft > 0, node.scrollLeft, '> 0');
    node.scrollLeft = 0;
  }
  near('pre top rhythm', px(pre, 'margin-top'), 1.5 * rem);
  near('pre bottom rhythm', px(pre, 'margin-bottom'), 1.5 * rem);
  near('pre radius', px(pre, 'border-top-left-radius'), .5 * rem);
  check('pre code preserves whitespace', css(code).whiteSpace === 'pre', css(code).whiteSpace, 'pre');
  // Syntax highlighting adds element rectangles with different font ascents.
  // Count only nonempty text fragment rows, not enclosing span boxes.
  const lines = document.createRange();
  const text = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  const lineTops = new Set<number>();
  while (text.nextNode()) {
    if (!text.currentNode.textContent?.trim()) continue;
    lines.selectNodeContents(text.currentNode);
    for (const box of lines.getClientRects()) if (box.width > 0) lineTops.add(Math.round(box.top * 10) / 10);
  }
  const visualLines = lineTops.size;
  check('pre code remains two visual lines', visualLines === 2, visualLines, 2);
  const inline = element('p > code', prose);
  near('inline code vertical padding', px(inline, 'padding-top'), .125 * rem);
  near('inline code horizontal padding', px(inline, 'padding-left'), .25 * rem);
  near('inline code font ratio', px(inline, 'font-size'), .9 * px(inline.parentElement!, 'font-size'));
  // Pico deliberately pads pre > code. Guard that baseline instead of imposing
  // inline-code padding on fenced code, which is outside the approved change.
  const preCodeProperties = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'font-size', 'white-space'];
  const preCodeStyle = () => preCodeProperties.map(property => css(code).getPropertyValue(property));
  const styledCode = preCodeStyle();
  prose.classList.remove('blog-prose');
  const baselineCode = preCodeStyle();
  prose.classList.add('blog-prose');
  check('inline code rules leave fenced code styling unchanged', JSON.stringify(styledCode) === JSON.stringify(baselineCode), styledCode, baselineCode);
  check('document has no horizontal overflow', document.documentElement.scrollWidth <= innerWidth + 1, document.documentElement.scrollWidth, `<= ${innerWidth + 1}`);
  check('prose has no horizontal overflow', prose.scrollWidth <= prose.clientWidth + 1, prose.scrollWidth, `<= ${prose.clientWidth + 1}`);
  // Measure 65ch using the actual article font, rather than assuming ch equals half an em.
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;width:65ch;visibility:hidden';
  article.append(probe);
  const readingLimit = rect(probe).width;
  probe.remove();
  check('reading width bounded by 65ch', rect(article).width <= readingLimit + 1, rect(article).width, `<= ${readingLimit + 1}`);
  const main = element('main');
  const available = main.clientWidth - px(main, 'padding-left') - px(main, 'padding-right');
  near('reading width uses available space up to cap', rect(article).width, Math.min(available, readingLimit));
  near('reading column centered', rect(article).left - rect(main).left, rect(main).right - rect(article).right);
  return checks;
}

async function main() {
  const output = await outputDirectory();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let site: Awaited<ReturnType<typeof createBlogSite>> | undefined;
  let browser: any;
  try {
    browser = await browserRuntime();
    site = await createBlogSite();
    await writeProseFixture(site);
    report.build = await site.build();
    if ((report.build as { status: number }).status !== 0) throw new Error(`Production build failed: ${JSON.stringify(report.build)}`);
    const server = await site.start('preview');
    for (const width of widths) for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, serviceWorkers: 'block' });
      try {
        await context.route('**/*', async (route: any) => {
          const url = route.request().url();
          if (new URL(url).origin === server.origin) return route.continue();
          report.blockedExternal.push(url);
          return route.abort('blockedbyclient');
        });
        const page = await context.newPage();
        const response = await page.goto(`${server.origin}/blog/${proseSlug}/`, { waitUntil: 'networkidle' });
        if (response?.status() !== 200) throw new Error(`Fixture route returned ${response?.status()}`);
        await page.evaluate(() => document.fonts.ready);
        const checks: Check[] = await page.evaluate(measureProse, quoteVariants);
        checks.push({ name: 'requested theme applied', pass: await page.getAttribute('html', 'data-theme') === theme, actual: await page.getAttribute('html', 'data-theme'), expected: theme });
        // Inject the actual built blog styles into home. Any global leak changes the
        // same controls with and without that asset, without a fragile pixel baseline.
        const styles: string[] = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(link => link.href));
        await page.goto(server.origin, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const snapshot = () => page.evaluate(() => {
          const selectors = ['.site-header', '.site-nav', '#theme-toggle', '.hero h1', '.hero p', '.actions a', '.section-heading h2', '.site-footer'];
          const properties = ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'margin-top', 'margin-bottom', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-left-width', 'border-radius', 'white-space'];
          return selectors.map(selector => {
            const node = document.querySelector(selector);
            if (!node) throw new Error(`Missing marketing control ${selector}`);
            const style = getComputedStyle(node), box = node.getBoundingClientRect();
            return { selector, box: [box.x, box.y, box.width, box.height], styles: properties.map(key => style.getPropertyValue(key)) };
          });
        });
        const before = await snapshot();
        const existing: string[] = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(link => link.href));
        for (const url of styles.filter(url => !existing.includes(url))) await page.addStyleTag({ url });
        const after = await snapshot();
        checks.push({ name: 'marketing controls unchanged with blog assets', pass: JSON.stringify(before) === JSON.stringify(after), actual: after, expected: before });
        report.cases.push({ width, theme, checks });
        const failed = checks.filter(check => !check.pass);
        console.log(`${width}/${theme}: ${checks.length - failed.length}/${checks.length} passed`);
        for (const check of failed) console.error(`  FAIL ${check.name}: ${JSON.stringify(check.actual)} expected ${JSON.stringify(check.expected)}`);
        if (output) {
          await page.goto(`${server.origin}/blog/${proseSlug}/`, { waitUntil: 'networkidle' });
          await page.screenshot({ path: join(output, `${stamp}-${width}-${theme}.png`), fullPage: true });
        }
      } finally { await context.close(); }
    }
  } catch (error) {
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(report.error);
  } finally {
    await browser?.close();
    await site?.dispose();
    if (output) {
      const path = join(output, `${stamp}-report.json`);
      await writeFile(path, JSON.stringify(report, null, 2) + '\n');
      console.log(`Evidence: ${path}`);
    }
  }
  const failures = report.cases.flatMap(entry => entry.checks.filter(check => !check.pass));
  const failed = !!report.error || failures.length > 0 || report.cases.length !== widths.length * themes.length;
  console.log(`${failed ? 'RED' : 'GREEN'}: ${report.cases.length}/8 cases, ${failures.length} assertion failures`);
  process.exitCode = failed ? 1 : 0;
}
await main();
