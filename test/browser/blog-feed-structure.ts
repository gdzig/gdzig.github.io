import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { requireChromePath, requireExternalDirectory } from '../helpers/browser-paths';
import { createProductionSite } from '../helpers/production-site';
import { formats, parseFeed } from '../helpers/feeds';

// Optional real-browser regression, deliberately not *.test.ts. Downloads nothing.
const output = requireExternalDirectory('BLOG_BROWSER_OUTPUT_DIR');
const executablePath = requireChromePath();
const articlePath = '/blog/godot-video-extensions-in-zig/';
const authored = await readFile(new URL('../../src/content/blog/godot-video-extensions-in-zig.md', import.meta.url), 'utf8');
const exactCode = [...authored.matchAll(/^```zig\n([\s\S]*?)\n```/gm)].map(match => match[1]);
const source = authored.match(/^source:\n  url: "([^"]+)"\n  publishedAt: "([^"]+)"/m);
assert.equal(exactCode.length, 2);
assert.ok(source, 'Clay source URL and original publication date must be present');
const sourceDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(source[2]));
const creditText = `Originally published on ${sourceDate}. Read the original article.`;
type Block = { tag: string; text: string | null | undefined };
const report = { article: articlePath, expectedBlocks: [] as Block[], formats: [] as { format: string; checks: Record<string, boolean>; blocks: Block[] }[], error: null as string | null };
let site: Awaited<ReturnType<typeof createProductionSite>> | undefined;
let browser: Browser | undefined;
try {
  site = await createProductionSite(output);
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const response = await page.goto(site.origin + articlePath);
  assert.equal(response?.status(), 200);
  const article = await page.locator('.blog-prose').evaluate(element => [...element.children].map(child => {
    const pre = child.matches('pre') ? child : child.querySelector('pre');
    if (!pre) return { tag: child.tagName.toLowerCase(), text: child.textContent };
    const lines = [...pre.querySelectorAll('.ec-line')];
    const text = lines.length ? lines.map(line => {
      const value = (line.querySelector('.code') ?? line).textContent;
      return value === '\n' ? '' : value;
    }).join('\n') : pre.querySelector('code')?.textContent;
    return { tag: 'pre', text };
  }));
  assert.equal(article.length, 26);
  assert.deepEqual(article.filter(block => block.tag === 'pre').map(block => block.text), exactCode);
  report.expectedBlocks = article;
  for (const format of formats) {
    const response = await fetch(site.origin + format.path);
    assert.equal(response.status, 200);
    const body = await response.text();
    await writeFile(join(output, format.path.slice(1)), body);
    const feed = parseFeed(body, format.id);
    const entry = feed.entries.find(entry => new URL(entry.url).pathname === articlePath);
    assert.ok(entry, `${format.id}: Clay article must be published`);
    await writeFile(join(output, `${format.id}-content.html`), entry.content);
    await page.setContent(`<main>${entry.content}</main>`);
    const actual = await page.locator('main').evaluate(element => ({
      blocks: [...element.children].map(child => {
        const pre = child.matches('pre') ? child : child.querySelector('pre');
        return pre ? { tag: 'pre', text: pre.querySelector('code')?.textContent } : { tag: child.tagName.toLowerCase(), text: child.textContent };
      }),
      code: [...element.querySelectorAll('pre code')].map(code => code.textContent),
      paragraphsInsideCode: element.querySelectorAll('code p').length,
      credit: { tag: element.lastElementChild?.tagName, text: element.lastElementChild?.textContent,
        links: [...(element.lastElementChild?.querySelectorAll('a') ?? [])].map(link => ({ href: link.getAttribute('href'), text: link.textContent })) },
    }));
    report.formats.push({ format: format.id, blocks: actual.blocks, checks: {
      articleBlocks: isDeepStrictEqual(actual.blocks.slice(0, 26), article),
      separateCreditBlock: actual.blocks.length === 27,
      exactCodeExamples: isDeepStrictEqual(actual.code, exactCode),
      noParagraphsInsideCode: actual.paragraphsInsideCode === 0,
      noSyntheticTags: !/feed-omit/i.test(entry.content),
      sourceCredit: actual.credit.tag === 'P' && actual.credit.text === creditText && isDeepStrictEqual(actual.credit.links, [{ href: source[1], text: 'Read the original article' }]),
    } });
  }
  console.log(JSON.stringify(report.formats.map(({ format, checks }) => ({ format, checks })), null, 2));
  assert.ok(report.formats.every(result => Object.values(result.checks).every(Boolean)), 'Feed structure checks failed; see results.json');
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  try { await writeFile(join(output, 'results.json'), JSON.stringify(report, null, 2)); }
  finally {
    try { await browser?.close(); }
    finally { await site?.dispose(); }
  }
}
