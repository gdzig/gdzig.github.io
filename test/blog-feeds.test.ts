import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createBlogSite } from './helpers/blog-site';
import { formats, inspectHtml, parseFeed } from './helpers/feeds';
import { escapingTitle, post, writeFixtures } from './fixtures/blog/posts';

const origin = 'https://gdzig.github.io';
const ids = ['nested/new', 'escaping', 'override', 'syndicated', 'old'];
const urls = ids.map(id => `${origin}/blog/${id}/`);
const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(30_000) });

// A missing route, preview leakage, or a format-specific mapping regression breaks
// the same real production artifacts and HTTP endpoints that subscribers use.
test('serves matching public RSS, Atom and JSON feeds in production and development', async () => {
  const site = await createBlogSite();
  try {
    await writeFixtures(site);
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
          for (const hidden of ['FIXTURE_DRAFT', 'FIXTURE_IMPLICIT', 'FIXTURE_FUTURE', 'FIXTURE_MARKDOWN_BODY', 'data-mdx-fixture', '/api/feed-view', 'localhost', '127.0.0.1']) {
            expect(body).not.toContain(hidden);
          }
          const nested = feed.entries[0];
          const article = await get(server.origin + new URL(nested.url).pathname);
          expect(article.status).toBe(200);
          expect(await article.text()).toContain('FIXTURE_NESTED');
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
          expect(credit.text).toContain('January 1, 1999');
          expect(credit.elements).toContainEqual({ tag: 'a', href: 'https://example.invalid/original/' });
          const title = format.id === 'atom' ? (await inspectHtml(feed.entries[1].title)).text : feed.entries[1].title;
          expect(title).toBe(escapingTitle);
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
