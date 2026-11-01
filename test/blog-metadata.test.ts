import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { blogSchema } from '../src/lib/blog/schema';
import { indexMetadata, postMetadata, safeJsonLd } from '../src/lib/blog/metadata';
import { validateShareImage, type ShareImage } from '../src/lib/blog/images';

const site = new URL('https://gdzig.github.io/');
const context = { preview: false, now: new Date('2026-11-01T00:00:00Z') };
const fixture = { title: 'Fixture title', description: 'Test fixture.', author: { name: 'Fixture author' } };
function post(fields: Record<string, unknown> = {}, id = 'nested/fixture name') {
  return { id, data: blogSchema.parse({ ...fixture, draft: false, publishedAt: '2001-01-01', ...fields }) };
}

// Regressions: replacing source identity with local identity, choosing cover over
// ogImage, or emitting incomplete social properties must each break these tests.
test('original metadata uses encoded local canonical and complete generated social image', () => {
  const head = postMetadata(post({ cover: { src: '/cover.jpg', alt: 'Not the share image' } }), site, context);
  expect(head.title).toBe('Fixture title | GDZig');
  expect(head.description).toBe('Test fixture.');
  expect(head.canonical).toBe('https://gdzig.github.io/blog/nested/fixture%20name/');
  for (const [property, content] of Object.entries({
    'og:title': fixture.title, 'og:description': fixture.description,
    'og:site_name': 'GDZig', 'og:locale': 'en_US', 'og:type': 'article',
    'og:url': head.canonical,
    'og:image': 'https://gdzig.github.io/og/blog/nested/fixture%20name.png',
    'og:image:secure_url': 'https://gdzig.github.io/og/blog/nested/fixture%20name.png',
    'og:image:alt': 'GDZig: Fixture title', 'og:image:width': '1200',
    'og:image:height': '630', 'og:image:type': 'image/png',
    'article:published_time': '2001-01-01T00:00:00.000Z',
  })) expect(head.meta).toContainEqual({ property, content });
  for (const [name, content] of Object.entries({
    author: 'Fixture author', 'twitter:card': 'summary_large_image',
    'twitter:title': fixture.title, 'twitter:description': fixture.description,
    'twitter:image': 'https://gdzig.github.io/og/blog/nested/fixture%20name.png',
    'twitter:image:alt': 'GDZig: Fixture title',
  })) expect(head.meta).toContainEqual({ name, content });
  expect(head.jsonLd).toEqual({
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: fixture.title, description: fixture.description,
    url: head.canonical, mainEntityOfPage: head.canonical,
    datePublished: '2001-01-01T00:00:00.000Z', dateModified: undefined,
    author: { '@type': 'Person', name: 'Fixture author', url: undefined },
    publisher: { '@type': 'Organization', name: 'GDZig', url: site.href },
    image: { '@type': 'ImageObject', url: 'https://gdzig.github.io/og/blog/nested/fixture%20name.png', width: 1200, height: 630 },
    keywords: [],
  });
  const serialized = JSON.parse(safeJsonLd(head.jsonLd));
  expect(serialized).not.toHaveProperty('dateModified');
  expect(serialized.author).not.toHaveProperty('url');
  expect(head.meta.some(meta => 'name' in meta && ['robots', 'twitter:site', 'twitter:creator'].includes(meta.name))).toBe(false);
  expect(head.meta.some(meta => 'property' in meta && ['article:modified_time', 'article:author', 'article:section', 'article:tag'].includes(meta.property))).toBe(false);
});

test('syndication retains original identity, first-source date, original author and article taxonomy', () => {
  const head = postMetadata(post({
    author: { name: 'Guest fixture', url: 'https://example.org/author' },
    source: { url: 'https://example.org/original/', publishedAt: '2000-01-01' },
    updatedAt: '2002-01-01', tags: ['fixture-a', 'fixture-b'], section: 'Updates',
  }), site, context);
  expect(head.canonical).toBe('https://example.org/original/');
  for (const [property, content] of [
    ['og:url', head.canonical], ['article:published_time', '2000-01-01T00:00:00.000Z'],
    ['article:modified_time', '2002-01-01T00:00:00.000Z'],
    ['article:author', 'https://example.org/author'],
    ['article:tag', 'fixture-a'], ['article:tag', 'fixture-b'], ['article:section', 'Updates'],
  ]) expect(head.meta).toContainEqual({ property, content });
  expect(head.meta).toContainEqual({ name: 'author', content: 'Guest fixture' });
  expect(head.jsonLd).toMatchObject({
    url: head.canonical, mainEntityOfPage: head.canonical,
    datePublished: '2000-01-01T00:00:00.000Z', dateModified: '2002-01-01T00:00:00.000Z',
    author: { '@type': 'Person', name: 'Guest fixture', url: 'https://example.org/author' },
    keywords: ['fixture-a', 'fixture-b'],
  });
});

test('a source without its own date falls back to local publication date', () => {
  const head = postMetadata(post({ source: { url: 'http://example.org/original/' } }), site, context);
  expect(head.canonical).toBe('http://example.org/original/');
  expect(head.jsonLd?.datePublished).toBe('2001-01-01T00:00:00.000Z');
});

test.each(['/images/fixture%20share.webp', 'https://images.example.org/fixture.webp'])('explicit share image %s wins over cover and generated card', src => {
  const image = { src, alt: 'Accurate share description', width: 800, height: 400, type: 'image/webp' };
  const head = postMetadata(post({ ogImage: image }), site, context);
  const url = new URL(src, site).href;
  for (const [property, content] of Object.entries({
    'og:image': url, 'og:image:secure_url': url, 'og:image:alt': image.alt,
    'og:image:width': '800', 'og:image:height': '400', 'og:image:type': image.type,
  })) expect(head.meta).toContainEqual({ property, content });
  expect(head.meta).toContainEqual({ name: 'twitter:image', content: url });
  expect(head.meta).toContainEqual({ name: 'twitter:image:alt', content: image.alt });
  expect(head.jsonLd?.image).toEqual({ '@type': 'ImageObject', url, width: 800, height: 400 });
});

test.each([
  ['undated draft', { draft: true, publishedAt: undefined }],
  ['dated draft', { draft: true }],
  ['scheduled post', { publishedAt: '9999-01-01' }],
] as const)('%s is noindex without structured data in either context', (_, fields) => {
  for (const preview of [false, true]) {
    const head = postMetadata(post(fields), site, { ...context, preview });
    expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex' });
    expect(head.jsonLd).toBeUndefined();
    if ('publishedAt' in fields && fields.publishedAt === undefined) {
      expect(head.meta.some(meta => 'property' in meta && meta.property === 'article:published_time')).toBe(false);
    }
  }
});

test('source date does not override local scheduling or draft status', () => {
  const head = postMetadata(post({ publishedAt: '9999-01-01', source: { url: 'https://example.org/original', publishedAt: '2000-01-01' } }), site, { ...context, preview: true });
  expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex' });
  expect(head.jsonLd).toBeUndefined();
});

test('publication boundary includes structured data even in preview', () => {
  const head = postMetadata(post({ publishedAt: context.now }), site, { ...context, preview: true });
  expect(head.jsonLd?.datePublished).toBe(context.now.toISOString());
  expect(head.meta).not.toContainEqual({ name: 'robots', content: 'noindex' });
});

test('index has website metadata and no article identity or unverified handles', () => {
  const head = indexMetadata(site);
  expect(head.title).toBe('Blog | GDZig');
  expect(head.description).toBe('Release notes and project updates for GDZig.');
  expect(head.canonical).toBe('https://gdzig.github.io/blog/');
  for (const [property, content] of Object.entries({
    'og:type': 'website', 'og:url': head.canonical,
    'og:image': 'https://gdzig.github.io/og/blog.png',
    'og:image:secure_url': 'https://gdzig.github.io/og/blog.png',
    'og:image:width': '1200', 'og:image:height': '630',
    'og:image:type': 'image/png', 'og:image:alt': 'GDZig blog',
  })) expect(head.meta).toContainEqual({ property, content });
  expect(head.jsonLd).toBeUndefined();
  expect(head.meta.some(meta => 'property' in meta && meta.property.startsWith('article:'))).toBe(false);
  expect(head.meta.some(meta => 'name' in meta && ['author', 'twitter:site', 'twitter:creator'].includes(meta.name))).toBe(false);
});

test('JSON-LD preserves malicious titles while escaping script delimiters and line separators', () => {
  const title = 'Fixture </script><script>bad()</script>\u2028\u2029 & "quoted"';
  const head = postMetadata(post({ title }), site, context);
  const serialized = safeJsonLd(head.jsonLd);
  expect(JSON.parse(serialized).headline).toBe(title);
  expect(serialized).not.toContain('<');
  expect(serialized).not.toContain('\u2028');
  expect(serialized).not.toContain('\u2029');
  expect(serialized).toContain('\\u2028');
  expect(serialized).toContain('\\u2029');
});

describe('local share image validation', () => {
  let directory: string;
  let publicDirectory: string;
  const image: ShareImage = { src: '/fixture.png', alt: 'Fixture image', width: 12, height: 8, type: 'image/png' };
  beforeAll(async () => {
    const scratch = process.env.JCODE_SCRATCH_DIR || tmpdir();
    await mkdir(scratch, { recursive: true });
    directory = await mkdtemp(join(scratch, 'blog-metadata-'));
    publicDirectory = join(directory, 'public');
    await mkdir(publicDirectory);
    const png = await sharp({ create: { width: 12, height: 8, channels: 4, background: '#123456' } }).png().toBuffer();
    await writeFile(join(publicDirectory, 'fixture.png'), png);
    await writeFile(join(publicDirectory, 'fixture space.png'), png);
    await writeFile(join(directory, 'outside.png'), png);
    await writeFile(join(publicDirectory, 'broken.png'), 'not an image');
    await writeFile(join(publicDirectory, 'unsupported.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"></svg>');
    for (const format of ['jpeg', 'webp'] as const) {
      await sharp(png).toFormat(format).toFile(join(publicDirectory, `fixture.${format}`));
    }
    await symlink(join(directory, 'outside.png'), join(publicDirectory, 'escape.png'));
    await symlink(directory, join(publicDirectory, 'escape-directory'));
    await symlink(join(publicDirectory, 'fixture.png'), join(publicDirectory, 'inside.png'));
    await symlink(publicDirectory, join(directory, 'public-link'));
  });
  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  test('accepts matching local PNG and encoded spaces', async () => {
    await expect(validateShareImage(image, publicDirectory)).resolves.toBeUndefined();
    await expect(validateShareImage({ ...image, src: '/fixture%20space.png' }, publicDirectory)).resolves.toBeUndefined();
  });
  test.each(['jpeg', 'webp'] as const)('accepts matching %s', async format => {
    await expect(validateShareImage({ ...image, src: `/fixture.${format}`, type: `image/${format}` }, publicDirectory)).resolves.toBeUndefined();
  });
  test('accepts in-root symlinks and a symlinked public root', async () => {
    await expect(validateShareImage({ ...image, src: '/inside.png' }, publicDirectory)).resolves.toBeUndefined();
    await expect(validateShareImage(image, join(directory, 'public-link'))).resolves.toBeUndefined();
  });
  test('returns for HTTPS overrides without fetching or accessing public', async () => {
    // The reserved .invalid domain cannot supply this image. An absent root also
    // proves remote overrides do not enter local filesystem validation.
    await expect(validateShareImage({ ...image, src: 'https://no-fetch.invalid/image.png' }, join(directory, 'absent'))).resolves.toBeUndefined();
  });
  test.each([
    { width: 13 }, { height: 9 }, { type: 'image/jpeg' as const },
  ])('rejects incorrect declared metadata %j with expected and actual diagnostics', async fields => {
    await expect(validateShareImage({ ...image, ...fields }, publicDirectory)).rejects.toThrow(/Invalid blog ogImage \/fixture\.png: Expected .* found 12x8 image\/png/);
  });
  test.each(['/missing.png', '/broken.png', '/unsupported.svg'])('rejects missing, corrupt or unsupported asset %s by name', async src => {
    await expect(validateShareImage({ ...image, src }, publicDirectory)).rejects.toThrow(`Invalid blog ogImage ${src}:`);
  });
  test.each([
    '/../outside.png', '/%2e%2e/outside.png', '/%2E%2E%2Foutside.png',
    '/escape.png', '/escape-directory/outside.png',
  ])('rejects traversal or symlink escape %s', async src => {
    await expect(validateShareImage({ ...image, src }, publicDirectory)).rejects.toThrow(`Invalid blog ogImage ${src}: Share image must remain inside public/.`);
  });
  test.each([
    '/%zz.png', '/%00.png', '//example.org/fixture.png', '/%2fexample.org/fixture.png',
    '/%5cfixture.png', '/fixture.png?x', '/fixture.png#x', 'fixture.png',
    'http://example.org/fixture.png',
  ])('rejects malformed or non-local path %s', async src => {
    await expect(validateShareImage({ ...image, src }, publicDirectory)).rejects.toThrow(`Invalid blog ogImage ${src}:`);
  });
});
