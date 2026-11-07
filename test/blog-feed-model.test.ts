import { describe, expect, test } from 'bun:test';
import { serializeFeed } from '../src/lib/blog/feed';
import { blogSchema } from '../src/lib/blog/schema';
import { formats, inspectHtml, parseFeed } from './helpers/feeds';

const site = new URL('https://gdzig.github.io/');
const now = new Date('2026-11-07T00:00:00.000Z');
const fields = { title: 'A post', description: 'A summary.', author: { name: 'A contributor' }, draft: false, publishedAt: '2026-11-01' };
const post = (id: string, extra: Record<string, unknown> = {}) => ({ id, data: blogSchema.parse({ ...fields, ...extra }), content: '<p>A full article.</p>' });

for (const format of formats) describe(`${format.id} feed mapping`, () => {
  test('includes the informative cover with an absolute URL and escaped alternative text', async () => {
    const article = post('cover', { cover: { src: 'https://cdn.example.com/cover.png?a=1&b=2', alt: 'A "diagram" & <detail>' } });
    const entry = parseFeed(serializeFeed([article], site, now, format.id), format.id).entries[0];
    const images: { src: string | null; alt: string | null }[] = [];
    await new HTMLRewriter().on('img', { element(element) {
      images.push({ src: element.getAttribute('src'), alt: element.getAttribute('alt') });
    } }).transform(new Response(entry.content)).text();
    expect(images).toEqual([{ src: 'https://cdn.example.com/cover.png?a=1&amp;b=2', alt: 'A &quot;diagram&quot; &amp; &lt;detail&gt;' }]);
    expect((await inspectHtml(entry.content)).text).toBe('A full article.');
  });

  test('keeps the summary separate even when the article body is empty', async () => {
    const entry = parseFeed(serializeFeed([{ ...post('empty'), content: '' }], site, now, format.id), format.id).entries[0];
    const summary = format.id === 'json' ? entry.summary : (await inspectHtml(entry.summary)).text;
    expect(summary).toBe('A summary.');
    expect((await inspectHtml(entry.content)).text).toBe('');
  });

  test('publishes the supplied full article separately from the concise summary', async () => {
    const article = {
      ...post('full', { source: { url: 'https://example.com/original/', publishedAt: '2020-01-01' } }),
      content: '<h2 id="middle">Full article heading</h2><p>Article start &amp; detail.</p><pre><code>const x = "&amp;amp;"; // ]]> and ]]></code></pre><p>Article ending.</p>',
    };
    const entry = parseFeed(serializeFeed([article], site, now, format.id), format.id).entries[0];
    const content = await inspectHtml(entry.content);
    expect(content.text).toContain('Full article heading');
    expect(content.text).toContain('Article start & detail.');
    expect(content.text).toContain('const x = "&amp;"; // ]]> and ]]>');
    expect(content.text).toContain('Article ending.');
    expect(content.text).not.toContain('A summary.');
    expect(content.text).toContain('January 1, 2020');
    expect(content.elements.map(element => element.tag)).toContain('h2');
    expect(content.elements.map(element => element.tag)).toContain('pre');
    expect(content.elements.map(element => element.tag)).toContain('code');
    const summary = format.id === 'json' ? entry.summary : (await inspectHtml(entry.summary)).text;
    expect(summary).toBe('A summary.');
    expect(entry.author).toBe('A contributor');
  });

  test('selects public posts at the UTC boundary and keeps deterministic equal-date order', () => {
    const posts = [
      post('z-boundary', { publishedAt: '2026-11-07T11:00:00+11:00' }),
      post('future', { publishedAt: '2026-11-07T00:00:00.001Z' }),
      post('draft', { draft: true }),
      post('implicit', { draft: undefined, publishedAt: undefined }),
      post('old'),
      post('a-boundary', { publishedAt: now }),
    ];
    const original = posts.map(post => post.id);
    const parsed = parseFeed(serializeFeed(posts, site, now, format.id), format.id);
    expect(parsed.entries.map(entry => entry.id)).toEqual([
      'https://gdzig.github.io/blog/a-boundary/', 'https://gdzig.github.io/blog/z-boundary/', 'https://gdzig.github.io/blog/old/',
    ]);
    expect(parsed.entries[0].published).toBe('2026-11-07T00:00:00.000Z');
    expect(posts.map(post => post.id)).toEqual(original);
  });

  test('uses local stable URLs and the GDZig publication date for syndicated articles', async () => {
    const article = post('godot-video-extensions-in-zig', {
      title: 'From godot-cpp to Zig', author: { name: 'Clay Tercek', url: 'https://tercek.me/' },
      publishedAt: '2026-11-07', source: { url: 'https://tercek.me/blog/godot-video-extensions-in-zig/', publishedAt: '2026-09-26' },
    });
    const body = serializeFeed([article], site, now, format.id);
    const entry = parseFeed(body, format.id).entries[0];
    expect(entry.id).toBe('https://gdzig.github.io/blog/godot-video-extensions-in-zig/');
    expect(entry.url).toBe(entry.id);
    expect(entry.published).toBe('2026-11-07T00:00:00.000Z');
    expect(entry.author).toBe('Clay Tercek');
    const content = await inspectHtml(entry.content);
    expect(content.text).toContain('September 26, 2026');
    expect(content.elements).toContainEqual({ tag: 'a', href: 'https://tercek.me/blog/godot-video-extensions-in-zig/' });
    expect(body).not.toMatch(/feed-view|tracking|<img/i);
    if (format.id === 'rss') {
      expect(body).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
      expect(body).not.toContain('<author>'); // RSS author requires an email address, which our schema does not require.
    } else expect(entry.authorUrl).toBe('https://tercek.me/');
  });

  test('supports source URLs without an original date and escapes query attributes', async () => {
    const article = post('source', { source: { url: 'https://example.com/original/?a=1&b=%22quoted%22' } });
    const entry = parseFeed(serializeFeed([article], site, now, format.id), format.id).entries[0];
    const content = await inspectHtml(entry.content);
    expect(content.text).toContain('Originally published');
    expect(content.text).not.toMatch(/undefined|Invalid Date/);
    expect(content.elements.find(element => element.tag === 'a')?.href).toBe('https://example.com/original/?a=1&amp;b=%22quoted%22');
  });

  test('preserves IDs and publication dates while updating modification timestamps', () => {
    const old = post('old');
    const newer = post('newer', { publishedAt: '2026-11-02' });
    const before = parseFeed(serializeFeed([old, newer], site, now, format.id), format.id);
    const edited = post('old', { title: 'Edited title', updatedAt: '2026-11-06' });
    const after = parseFeed(serializeFeed([edited, newer], site, now, format.id), format.id);
    expect(after.entries.map(entry => entry.id)).toEqual(before.entries.map(entry => entry.id));
    expect(after.entries[1].published).toBe('2026-11-01T00:00:00.000Z');
    if (format.id !== 'rss') expect(after.entries[1].updated).toBe('2026-11-06T00:00:00.000Z');
    if (format.id !== 'json') expect(after.updated).toBe('2026-11-06T00:00:00.000Z');
    expect(serializeFeed([edited, newer], site, new Date('2026-12-01'), format.id)).toBe(serializeFeed([edited, newer], site, now, format.id));
  });

  test('keeps empty feeds valid and deterministic rather than using the current wall clock', () => {
    const body = serializeFeed([], site, now, format.id);
    const parsed = parseFeed(body, format.id);
    expect(parsed.entries).toEqual([]);
    expect(parsed.self).toBe(`https://gdzig.github.io${format.path}`);
    if (format.id !== 'json') expect(parsed.updated).toBe('1970-01-01T00:00:00.000Z');
    expect(body).toBe(serializeFeed([], site, new Date('2026-12-01'), format.id));
  });

  test('escapes HTML, entities and repeated CDATA delimiters without corrupting plain text', async () => {
    const title = 'Zig &amp; Godot <script>bad()</script> "quoted" ]]> ]]> →';
    const description = 'Summary &amp; <img src=x onerror="bad()"> "quoted" ]]> ]]> →';
    const author = 'Author &amp; <name>';
    const article = post('guides/café & Zig', { title, description, author: { name: author }, tags: ['Zig &amp; Godot', '→'] });
    const parsed = parseFeed(serializeFeed([article], site, now, format.id), format.id);
    const entry = parsed.entries[0];
    const parsedTitle = format.id === 'atom' ? await inspectHtml(entry.title) : { text: entry.title, elements: [] };
    expect(parsedTitle.text).toBe(title);
    expect(parsedTitle.elements.every(element => element.tag === 'div')).toBe(true);
    expect(entry.id).toBe('https://gdzig.github.io/blog/guides/caf%C3%A9%20%26%20Zig/');
    expect(entry.author).toBe(author);
    expect(entry.tags).toEqual(['Zig &amp; Godot', '→']);
    const content = await inspectHtml(entry.content);
    expect(content.text).toBe('A full article.');
    expect(content.elements.map(element => element.tag)).toEqual(['div', 'p']);
    const summary = format.id === 'json' ? entry.summary : (await inspectHtml(entry.summary)).text;
    expect(summary).toBe(description);
  });
});
