import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createBlogSite } from './helpers/blog-site';
import { formats, inspectHtml, parseFeed } from './helpers/feeds';
import { escapingTitle, post, writeFixtures } from './fixtures/blog/posts';
import { articleSummary, literalCode, writeArticleFixtures } from './fixtures/blog/full-articles';

const origin = 'https://gdzig.github.io';
const ids = ['nested/new', 'escaping', 'override', 'syndicated', 'old', 'covered'];
const urls = ids.map(id => `${origin}/blog/${id}/`);
const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(30_000) });

// A missing route, preview leakage, or a format-specific mapping regression breaks
// the same real production artifacts and HTTP endpoints that subscribers use.
test('serves matching public RSS, Atom and JSON feeds in production and development', async () => {
  const site = await createBlogSite();
  try {
    await writeFixtures(site);
    await writeArticleFixtures(site);
    const build = await site.build();
    expect(build.status, build.stdout + build.stderr).toBe(0);
    for (const mode of ['preview', 'dev'] as const) {
      const server = await site.start(mode);
      try {
        const homepage = await get(server.origin + '/');
        expect(homepage.status).toBe(200);
        const discovered = new Map<string, string>();
        await new HTMLRewriter().on('head link[rel="alternate"]', { element(element) {
          discovered.set(element.getAttribute('type')!, element.getAttribute('href')!);
        } }).transform(new Response(await homepage.text())).text();
        for (const format of formats) {
          expect(discovered.get(format.type)).toBe(origin + format.path);
          const response = await get(server.origin + new URL(discovered.get(format.type)!).pathname);
          expect(response.status, `${mode} ${format.path}`).toBe(200);
          const type = response.headers.get('content-type')?.split(';')[0];
          // Static hosting serves files by extension, not endpoint response headers.
          const allowedTypes = mode === 'dev' ? [format.type]
            : format.id === 'json' ? [format.type, 'application/json']
              : [format.type, 'application/xml', 'text/xml'];
          expect(allowedTypes).toContain(type);
          const body = await response.text();
          if (mode === 'preview') expect(body).toBe(await readFile(join(site.root, 'dist', format.path.slice(1)), 'utf8'));
          const feed = parseFeed(body, format.id);
          expect(feed.title).toBe('GDZig Blog');
          expect(feed.url).toBe(`${origin}/blog/`);
          expect(feed.self).toBe(origin + format.path);
          expect(feed.entries.map(entry => entry.id)).toEqual(urls);
          expect(feed.entries.map(entry => entry.url)).toEqual(urls);
          for (const hidden of ['FIXTURE_DRAFT', 'FIXTURE_IMPLICIT', 'FIXTURE_FUTURE', '/api/feed-view', 'localhost', '127.0.0.1']) {
            expect(body).not.toContain(hidden);
          }
          for (const [id, kind] of [['old', 'MARKDOWN'], ['nested/new', 'MDX']] as const) {
            const entry = feed.entries.find(entry => entry.id === `${origin}/blog/${id}/`)!;
            const label = `${mode} ${format.id} ${kind}`;
            const html = await inspectHtml(entry.content);
            expect(html.text, label).toContain(`FULL_${kind}_START`);
            expect(html.text, label).toContain(`FULL_${kind}_MIDDLE`);
            expect(html.text, label).toContain(`FULL_${kind}_END`);
            expect(html.text.indexOf(`FULL_${kind}_START`), label).toBeLessThan(html.text.indexOf(`FULL_${kind}_MIDDLE`));
            expect(html.text.indexOf(`FULL_${kind}_MIDDLE`), label).toBeLessThan(html.text.indexOf(`FULL_${kind}_END`));
            expect(html.elements, label).toContainEqual({ tag: 'h2', href: null });
            expect(html.text, label).toContain(`Full ${kind} heading`);
            expect(html.elements, label).toContainEqual({ tag: 'pre', href: null });
            expect(html.elements, label).toContainEqual({ tag: 'code', href: null });
            expect(html.text, label).toContain(literalCode);
            expect(entry.summary, label).toBe(articleSummary);
            expect(html.text, label).not.toContain(articleSummary);
            for (const href of [`${origin}/docs/intro/`, `${entry.url}#full-${kind.toLowerCase()}-heading`, new URL('../sibling/?view=full#part', entry.url).href]) {
              expect(html.elements, label).toContainEqual({ tag: 'a', href });
            }
            const images: string[] = [];
            const covers: { src: string | null; alt: string | null }[] = [];
            const boundaries: string[] = [];
            const unsafeAttributes: string[] = [];
            await new HTMLRewriter().on('*', { element(element) {
              if (element.tagName === 'img') {
                images.push(element.getAttribute('src')!);
                if (element.getAttribute('alt') === 'FIXTURE_COVER_ONLY') {
                  covers.push({ src: element.getAttribute('src'), alt: element.getAttribute('alt') });
                }
              }
              const title = element.getAttribute('title');
              if (title?.startsWith('XML_BOUNDARY ')) boundaries.push(title);
              for (const [name] of element.attributes) {
                if (name === 'style' || /^on/i.test(name) || /^(?:data-astro|client:|server:)/.test(name)) unsafeAttributes.push(name);
              }
            } }).transform(new Response(entry.content)).text();
            expect(images, label).toContain(`${origin}/images/full-root.png`);
            expect(images, label).toContain(new URL('./images/full-relative.png', entry.url).href);
            expect(covers, label).toEqual(kind === 'MARKDOWN'
              ? [{ src: `${origin}/images/fixture.png`, alt: 'FIXTURE_COVER_ONLY' }]
              : []);
            expect(boundaries, label).toHaveLength(1);
            expect((await inspectHtml(boundaries[0])).text, label).toBe('XML_BOUNDARY ]]> first ]]> second');
            expect(unsafeAttributes, label).toEqual([]);
            for (const forbidden of ['html', 'head', 'body', 'nav', 'header', 'footer', 'script', 'style', 'button', 'astro-island']) {
              expect(html.elements.map(element => element.tag), label).not.toContain(forbidden);
            }
            expect(entry.content, label).not.toMatch(/<!--|<!doctype|Copy code|Guest author|This is a guest post by|FEED_(?:COMMENT|COPY|SCRIPT|STYLE|HANDLER)_SENTINEL/i);
            if (kind === 'MDX') {
              expect(html.text, label).toContain('IMPORTED_ASTRO_OUTPUT');
              expect(html.text, label).toContain('IMPORTED_MDX_OUTPUT');
              expect(html.elements, label).toContainEqual({ tag: 'h3', href: null });
              expect(html.elements, label).toContainEqual({ tag: 'a', href: `${entry.url}component-link/` });
              expect(html.text, label).toContain('MDX_EVALUATED_2');
              expect(entry.content, label).not.toContain('{1 + 1}');
            }
          }
          const nested = feed.entries[0];
          const article = await get(server.origin + new URL(nested.url).pathname);
          expect(article.status).toBe(200);
          const articleHtml = await article.text();
          expect(articleHtml).toContain('FIXTURE_NESTED');
          expect(articleHtml).toContain('This is a guest post by');
          expect(nested.author).toBe('Fixture guest');
          expect(nested.published).toBe('2002-01-01T00:00:00.000Z');
          expect(nested.tags).toEqual(['Fixture Zig', 'Fixture Godot']);
          if (format.id !== 'rss') {
            expect(nested.updated).toBe('2002-02-03T00:00:00.000Z');
            expect(nested.authorUrl).toBe('https://example.invalid/guest');
          }
          const syndicated = feed.entries[3];
          expect(syndicated.id).toBe(`${origin}/blog/syndicated/`);
          expect(syndicated.author).toBe('Fixture original author');
          expect(syndicated.published).toBe('2001-01-01T00:00:00.000Z');
          const credit = await inspectHtml(syndicated.content);
          expect(credit.text).toContain('FIXTURE_MARKDOWN_BODY');
          expect(credit.text).toContain('January 1, 1999');
          expect(credit.elements).toContainEqual({ tag: 'a', href: 'https://example.invalid/original/' });
          const title = format.id === 'atom' ? (await inspectHtml(feed.entries[1].title)).text : feed.entries[1].title;
          expect(title).toBe(escapingTitle);
          const covered = feed.entries.find(entry => entry.id === `${origin}/blog/covered/`)!;
          const coveredLabel = `${mode} ${format.id} covered`;
          // Each format exposes the same categories, and the bridge maps them
          // to its own shape: RSS <category>, Atom term, JSON tags.
          expect(covered.tags, coveredLabel).toEqual(['Fixture Cover Zig', 'Fixture Cover Godot']);
          if (format.id === 'rss') {
            expect(body, coveredLabel).toContain('<category>Fixture Cover Zig</category>');
          } else if (format.id === 'atom') {
            expect(body, coveredLabel).toMatch(/<category\b[^>]*\bterm="Fixture Cover Zig"/);
          }
          const coveredImages: { src: string | null; alt: string | null }[] = [];
          await new HTMLRewriter().on('img', { element(element) {
            coveredImages.push({ src: element.getAttribute('src'), alt: element.getAttribute('alt') });
          } }).transform(new Response(covered.content)).text();
          expect(coveredImages, coveredLabel).toEqual([
            { src: `${origin}/images/fixture.png`, alt: 'FIXTURE_COVER_AND_TAGS' },
          ]);
          expect(covered.content.match(/<img\b/g), coveredLabel).toHaveLength(1);
        }
      } finally { await server.stop(); }
    }
  } finally { await site.dispose(); }
}, 240_000);

test('publishes valid empty feeds when the only authored posts are unpublished', async () => {
  const site = await createBlogSite();
  try {
    await site.writePost('draft', 'md', post({ draft: true }));
    await site.writePost('future', 'md', post({ publishedAt: '9999-01-01' }));
    const build = await site.build();
    expect(build.status, build.stdout + build.stderr).toBe(0);
    const server = await site.start('preview');
    try {
      for (const format of formats) {
        const response = await get(server.origin + format.path);
        expect(response.status).toBe(200);
        const feed = parseFeed(await response.text(), format.id);
        expect(feed.entries).toEqual([]);
        expect(feed.self).toBe(origin + format.path);
        if (format.id !== 'json') expect(feed.updated).toBe('1970-01-01T00:00:00.000Z');
      }
    } finally { await server.stop(); }
  } finally { await site.dispose(); }
}, 180_000);
