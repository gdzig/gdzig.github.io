import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createBlogSite } from './helpers/blog-site';
import { baseFields, description, escapingTitle, fixtures, image, post, writeFixtures } from './fixtures/blog/posts';

type Site = Awaited<ReturnType<typeof createBlogSite>>;
const origin = 'https://gdzig.github.io';
const hidden = ['draft', 'implicit', 'future'];
const iso = (date: string) => `${date}T00:00:00.000Z`;
const page = (site: Site, id: string) => join(site.root, 'dist/blog', id, 'index.html');
const card = (site: Site, id: string) => join(site.root, 'dist/og/blog', `${id}.png`);

// HTMLRewriter parses real elements. Its attribute/text API preserves entities,
// so decode the entities Astro's HTML serializer emits, after parsing structure.
function decode(value: string) {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, key: string) => {
    if (key[0] !== '#') return entities[key] ?? all;
    return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10));
  });
}

async function parse(html: string) {
  const meta: Record<string, string[]> = {};
  const canonicals: string[] = [], json: string[] = [], titles: string[] = [], links: string[] = [];
  const times: string[] = [], authors: string[] = [], sources: string[] = [], images: { src: string | null; alt: string | null }[] = [];
  let breakout = 0, mdx = '', preview = '', body = '', heading = '', byline = '';
  const parser = new HTMLRewriter()
    .on('head meta', { element(element) {
      const key = element.getAttribute('property') ?? element.getAttribute('name');
      if (key) (meta[key] ??= []).push(decode(element.getAttribute('content') ?? ''));
    } })
    .on('head link[rel="canonical"]', { element(element) { canonicals.push(decode(element.getAttribute('href') ?? '')); } })
    .on('head title', { text(chunk) { titles.push(chunk.text); } })
    .on('script[type="application/ld+json"]', {
      element() { json.push(''); }, text(chunk) { json[json.length - 1] += chunk.text; },
    })
    .on('script[data-fixture-breakout]', { element() { breakout++; } })
    .on('.blog-list h2 a', { element(element) { links.push(element.getAttribute('href')!); } })
    .on('.blog-post time', { element(element) { times.push(element.getAttribute('datetime')!); } })
    .on('.blog-post a[rel="author"]', { element(element) { authors.push(element.getAttribute('href')!); } })
    .on('.blog-post header p.blog-meta', { text(chunk) { byline += chunk.text; } })
    .on('.blog-post footer a', { element(element) { sources.push(element.getAttribute('href')!); } })
    .on('.blog-post img', { element(element) { images.push({ src: element.getAttribute('src'), alt: element.getAttribute('alt') }); } })
    .on('[data-mdx-fixture]', { text(chunk) { mdx += chunk.text; } })
    .on('.blog-preview', { text(chunk) { preview += chunk.text; } })
    .on('.blog-prose', { text(chunk) { body += chunk.text; } })
    .on('.blog-post h1', { text(chunk) { heading += chunk.text; } });
  await parser.transform(new Response(html)).text();
  return { meta, canonicals, json, jsonLd: json.map(value => JSON.parse(value)), title: decode(titles.join('')), links, times, authors, sources, byline: decode(byline).replace(/\s+/g, ' ').trim(), images, breakout, mdx, preview: decode(preview), body: decode(body), heading: decode(heading) };
}

type Parsed = Awaited<ReturnType<typeof parse>>;
function expectHead(head: Parsed, options: {
  title: string; canonical: string; type?: 'article' | 'website'; description?: string;
  image?: string; alt?: string;
}) {
  const imageUrl = options.image ?? `${origin}/og/blog.png`;
  const expected = {
    description: [options.description ?? description],
    'og:title': [options.title], 'og:description': [options.description ?? description],
    'og:site_name': ['GDZig'], 'og:locale': ['en_US'], 'og:type': [options.type ?? 'article'],
    'og:url': [options.canonical], 'og:image': [imageUrl], 'og:image:secure_url': [imageUrl],
    'og:image:alt': [options.alt ?? `GDZig: ${options.title}`], 'og:image:width': ['1200'],
    'og:image:height': ['630'], 'og:image:type': ['image/png'],
    'twitter:card': ['summary_large_image'], 'twitter:title': [options.title],
    'twitter:description': [options.description ?? description], 'twitter:image': [imageUrl],
    'twitter:image:alt': [options.alt ?? `GDZig: ${options.title}`],
  };
  expect(head.meta).toMatchObject(expected);
  expect(head.title).toBe(`${options.title} | GDZig`);
  expect(head.canonicals).toEqual([options.canonical]);
  for (const values of Object.values(head.meta)) {
    for (const value of values) expect(value).not.toMatch(/localhost|127\.0\.0\.1/);
  }
}

async function build(site: Site) {
  const result = await site.build();
  expect(result.status, result.stdout + result.stderr).toBe(0);
}
async function expectPng(input: string | Buffer) {
  expect(await sharp(input).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
  const decoded = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  expect(decoded.data.length).toBe(1200 * 630 * decoded.info.channels);
}
async function get(url: string) { return fetch(url, { signal: AbortSignal.timeout(30_000) }); }
async function expectHttpPng(url: string) {
  const response = await get(url);
  expect(response.status, url).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/^image\/png(?:;|$)/);
  await expectPng(Buffer.from(await response.arrayBuffer()));
}
async function fingerprint(directory: string) {
  const entries = await readdir(directory, { recursive: true }).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  });
  if (entries === null) return null;
  return Promise.all(entries.sort().map(async name => {
    const path = join(directory, name);
    return (await lstat(path)).isFile() ? `${name}:${createHash('sha256').update(await readFile(path)).digest('hex')}` : `${name}/`;
  }));
}

// One production build exercises all published metadata/body/image contracts.
test('real production publishing, parsed head/JSON-LD, ordered listing and HTTP cards', async () => {
  const source = resolve(import.meta.dir, '..');
  const originalPublic = await fingerprint(join(source, 'public'));
  const originalContent = await fingerprint(join(source, 'src/content/blog'));
  const site = await createBlogSite();
  try {
    await writeFixtures(site);
    const fixturePublic = await fingerprint(join(site.root, 'public'));
    await build(site);
    expect((await lstat(join(site.root, '.astro-cache'))).isDirectory()).toBe(true);
    expect((await lstat(join(site.root, 'node_modules'))).isSymbolicLink()).toBe(true);
    for (const excluded of ['.env', '.git', '.jj']) expect(await lstat(join(site.root, excluded)).catch(() => null)).toBeNull();

    const index = await parse(await readFile(page(site, ''), 'utf8'));
    expectHead(index, { title: 'Blog', canonical: `${origin}/blog/`, type: 'website', description: 'Release notes and project updates for GDZig.', alt: 'GDZig blog' });
    expect(index.jsonLd).toEqual([]);
    expect(index.links).toEqual(['/blog/nested/new/', '/blog/escaping/', '/blog/override/', '/blog/syndicated/', '/blog/old/']);

    for (const fixture of fixtures.filter(fixture => !hidden.includes(fixture.id))) {
      const fields = { ...baseFields, ...fixture.fields } as Record<string, any>;
      const html = await readFile(page(site, fixture.id), 'utf8');
      const head = await parse(html);
      const canonical = fields.source?.url ?? `${origin}/blog/${fixture.id}/`;
      const imageUrl = fields.ogImage ? `${origin}${image.src}` : `${origin}/og/blog/${fixture.id}.png`;
      expectHead(head, { title: fields.title, canonical, image: imageUrl, alt: fields.ogImage?.alt });
      expect(head.heading).toBe(fields.title);
      expect(head.body).toContain('FIXTURE_MARKDOWN_BODY');
      expect(head.byline).toContain(`By ${fields.author.name}`);
      expect(head.meta.author).toEqual([fields.author.name]);
      expect(head.meta['article:author']).toEqual(fields.author.url ? [fields.author.url] : undefined);
      expect(head.meta['article:published_time']).toEqual([iso(fields.source?.publishedAt ?? fields.publishedAt)]);
      expect(head.meta['article:modified_time']).toEqual(fields.updatedAt ? [iso(fields.updatedAt)] : undefined);
      expect(head.meta['article:tag']).toEqual(fields.tags);
      expect(head.meta['article:section']).toEqual(fields.section ? [fields.section] : undefined);
      expect(head.meta.robots).toBeUndefined();
      expect(head.preview).toBe('');
      expect(head.jsonLd).toEqual([{
        '@context': 'https://schema.org', '@type': 'BlogPosting', headline: fields.title, description,
        url: canonical, mainEntityOfPage: canonical,
        datePublished: iso(fields.source?.publishedAt ?? fields.publishedAt),
        ...(fields.updatedAt ? { dateModified: iso(fields.updatedAt) } : {}),
        author: { '@type': 'Person', ...fields.author },
        publisher: { '@type': 'Organization', name: 'GDZig', url: `${origin}/` },
        image: { '@type': 'ImageObject', url: imageUrl, width: 1200, height: 630 }, keywords: fields.tags ?? [],
      }]);
      expect(head.breakout).toBe(0);
      if (!fields.ogImage) await expectPng(card(site, fixture.id));
      else expect(await Bun.file(card(site, fixture.id)).exists()).toBe(false);
    }
    const nested = await parse(await readFile(page(site, 'nested/new'), 'utf8'));
    expect(nested.mdx).toBe('2');
    expect(nested.authors).toEqual(['https://example.invalid/guest']);
    expect(nested.times).toEqual([iso('2002-01-01'), iso('2002-02-03')]);
    const old = await parse(await readFile(page(site, 'old'), 'utf8'));
    expect(old.images).toEqual([{ src: image.src, alt: 'FIXTURE_COVER_ONLY' }]);
    expect(old.meta['og:image']).not.toEqual([`${origin}${image.src}`]);
    const syndicatedHtml = await readFile(page(site, 'syndicated'), 'utf8');
    const syndicated = await parse(syndicatedHtml);
    expect(syndicated.times).toEqual([iso('2001-01-01'), iso('1999-01-01'), iso('2001-01-01')]);
    expect(syndicated.authors).toEqual(['https://example.invalid/original-author']);
    expect(syndicated.sources).toEqual(['https://example.invalid/original/']);
    expect(syndicatedHtml).toContain('Original source:');
    expect(syndicatedHtml).toContain('Originally published');
    expect(syndicatedHtml).toContain('Published on GDZig');
    const escaped = await parse(await readFile(page(site, 'escaping'), 'utf8'));
    expect(escaped.json[0]).toContain('\\u003c/script>');
    expect(escaped.json[0]).toContain('\\u2028\\u2029');
    expect(escaped.json[0]).not.toContain('</script>');
    expect(escaped.meta['og:title']).toEqual([escapingTitle]);
    for (const id of hidden) {
      expect(await Bun.file(page(site, id)).exists()).toBe(false);
      expect(await Bun.file(card(site, id)).exists()).toBe(false);
    }
    await expectPng(join(site.root, 'dist/og/blog.png'));
    const server = await site.start('preview');
    try {
      await expectHttpPng(`${server.origin}/og/blog.png`);
      for (const id of ['old', 'nested/new', 'escaping', 'syndicated']) {
        expect((await get(`${server.origin}/blog/${id}/`)).status).toBe(200);
        await expectHttpPng(`${server.origin}/og/blog/${id}.png`);
      }
      await expectHttpPng(`${server.origin}${image.src}`);
      for (const id of hidden) {
        for (const path of [`/blog/${id}/`, `/og/blog/${id}.png`]) expect((await get(server.origin + path)).status, path).toBe(404);
      }
    } finally { await server.stop(); }
    expect(await fingerprint(join(site.root, 'public'))).toEqual(fixturePublic);
  } finally {
    await site.dispose();
    expect(await fingerprint(join(source, 'public'))).toEqual(originalPublic);
    expect(await fingerprint(join(source, 'src/content/blog'))).toEqual(originalContent);
  }
}, 180_000);

test('real dev serves unpublished previews with labels, noindex, no JSON-LD or invented date', async () => {
  const site = await createBlogSite();
  try {
    await writeFixtures(site);
    const server = await site.start('dev');
    try {
      for (const id of hidden) {
        const response = await get(`${server.origin}/blog/${id}/`);
        expect(response.status, id).toBe(200);
        const head = await parse(await response.text());
        expectHead(head, { title: `FIXTURE_${id.toUpperCase()}`, canonical: `${origin}/blog/${id}/`, image: `${origin}/og/blog/${id}.png` });
        expect(head.preview).toBe('Unpublished preview');
        expect(head.meta.robots).toEqual(['noindex']);
        expect(head.jsonLd).toEqual([]);
        expect(head.body).toContain('FIXTURE_MARKDOWN_BODY');
        if (id === 'implicit') {
          expect(head.times).toEqual([]);
          expect(head.meta['article:published_time']).toBeUndefined();
          expect(head.meta['article:modified_time']).toBeUndefined();
        } else {
          const date = iso(id === 'future' ? '9999-01-01' : '2001-01-01');
          expect(head.times).toEqual([date]);
          expect(head.meta['article:published_time']).toEqual([date]);
        }
        await expectHttpPng(`${server.origin}/og/blog/${id}.png`);
      }
      const listing = await parse(await (await get(`${server.origin}/blog/`)).text());
      expect(listing.links).toEqual(['/blog/future/', '/blog/nested/new/', '/blog/draft/', '/blog/escaping/', '/blog/override/', '/blog/syndicated/', '/blog/old/', '/blog/implicit/']);
      expect(listing.preview).toBe('Unpublished preview'.repeat(3));
      await expectHttpPng(`${server.origin}/og/blog.png`);
    } finally { await server.stop(); }
  } finally { await site.dispose(); }
}, 180_000);

test('rebuilds remove stale pages/cards after draft transitions and deletion', async () => {
  const site = await createBlogSite();
  const absent = async () => {
    expect(await Bun.file(page(site, 'changing')).exists()).toBe(false);
    expect(await Bun.file(card(site, 'changing')).exists()).toBe(false);
    expect((await parse(await readFile(page(site, ''), 'utf8'))).links).not.toContain('/blog/changing/');
  };
  try {
    await site.writePost('changing', 'md', post());
    await build(site);
    expect(await Bun.file(page(site, 'changing')).exists()).toBe(true);
    await expectPng(card(site, 'changing'));
    await site.writePost('changing', 'md', post({ draft: true }));
    await build(site);
    await absent();
    // Restore publication so deletion has real stale artifacts to remove too.
    await site.writePost('changing', 'md', post());
    await build(site);
    expect(await Bun.file(page(site, 'changing')).exists()).toBe(true);
    expect(await Bun.file(card(site, 'changing')).exists()).toBe(true);
    await site.removePost('changing', 'md');
    await build(site);
    await absent();
  } finally { await site.dispose(); }
}, 180_000);

for (const failure of ['missing', 'dimensions', 'type', 'symlink'] as const) {
  test(`build rejects ${failure} override with asset-specific diagnostics`, async () => {
    const site = await createBlogSite();
    const asset = `/images/fixture-${failure}.png`;
    try {
      await mkdir(join(site.root, 'public/images'), { recursive: true });
      if (failure !== 'missing') {
        const path = failure === 'symlink' ? join(site.root, 'outside-public.png') : join(site.root, 'public', asset);
        await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#f6a31d' } }).png().toFile(path);
        if (failure === 'symlink') await symlink(path, join(site.root, 'public', asset));
      }
      await site.writePost('invalid', 'md', post({ ogImage: {
        ...image, src: asset, ...(failure === 'dimensions' ? { width: 1201 } : {}), ...(failure === 'type' ? { type: 'image/jpeg' } : {}),
      } }));
      const result = await site.build();
      const logs = result.stdout + result.stderr;
      expect(result.status, logs).not.toBe(0);
      expect(logs).toContain(`Invalid blog ogImage ${asset}`);
      if (failure === 'dimensions') expect(logs).toContain('Expected 1201x630 image/png');
      if (failure === 'type') expect(logs).toContain('Expected 1200x630 image/jpeg');
      if (failure === 'symlink') expect(logs).toContain('inside public/');
      if (failure === 'missing') expect(logs).toContain('ENOENT');
    } finally { await site.dispose(); }
  }, 180_000);
}

test('HTTPS overrides are metadata only, never fetched in the build process', async () => {
  const site = await createBlogSite();
  try {
    // Instrument the child process, not this test's fetch. Network requests
    // fail even if swallowed. Satori's bundled data: WASM is not network I/O.
    await writeFile(join(site.root, 'deny-network.mjs'), `
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
const deny = (...args) => { writeFileSync('network-attempted', String(args[0])); throw new Error('FIXTURE_NETWORK_FORBIDDEN'); };
const localFetch = globalThis.fetch;
globalThis.fetch = (input, ...args) => String(input instanceof Request ? input.url : input).startsWith('data:')
  ? localFetch(input, ...args) : deny(input);
for (const module of [http, https]) { module.request = deny; module.get = deny; }
`);
    const config = join(site.root, 'astro.fixture.config.mjs');
    await writeFile(config, `import './deny-network.mjs';\n${await readFile(config, 'utf8')}`);
    const remote = 'https://example.invalid/FIXTURE_MUST_NOT_FETCH.png';
    await site.writePost('remote', 'md', post({ ogImage: { ...image, src: remote } }));
    await build(site);
    expect(await Bun.file(join(site.root, 'network-attempted')).exists()).toBe(false);
    const head = await parse(await readFile(page(site, 'remote'), 'utf8'));
    expectHead(head, { title: baseFields.title, canonical: `${origin}/blog/remote/`, image: remote, alt: image.alt });
    expect(head.jsonLd[0].image.url).toBe(remote);
    expect(await Bun.file(card(site, 'remote')).exists()).toBe(false);
  } finally { await site.dispose(); }
}, 180_000);

test('helper rejects escaping IDs and cleans up its copy', async () => {
  const site = await createBlogSite();
  try {
    for (const id of ['../outside', '/absolute', 'nested/../../outside', 'nested\\outside', '%2e%2e/outside', '.', '']) {
      await expect(site.writePost(id, 'md', post())).rejects.toThrow('Unsafe blog fixture ID');
      await expect(site.removePost(id, 'md')).rejects.toThrow('Unsafe blog fixture ID');
    }
    await site.writePost('safe/nested', 'mdx', post());
    expect(await Bun.file(join(site.root, 'src/content/blog/safe/nested.mdx')).exists()).toBe(true);
    await site.removePost('safe/nested', 'mdx');
    expect(await Bun.file(join(site.root, 'src/content/blog/safe/nested.mdx')).exists()).toBe(false);
  } finally { await site.dispose(); }
  expect(await lstat(site.root).catch(() => null)).toBeNull();
});
