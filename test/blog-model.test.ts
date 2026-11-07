import { describe, expect, test } from 'bun:test';
import { blogSchema } from '../src/lib/blog/schema';
import { formatDate, isPublished, postCardPath, postPath, selectPosts } from '../src/lib/blog/policy';

const now = new Date('2026-11-01T00:00:00Z');
const draft = { title: 'Fixture title', description: 'Test fixture.', author: { name: 'Fixture author' } };
const share = { src: '/share.png', alt: 'Fixture illustration', width: 1200, height: 630, type: 'image/png' };

function post(id: string, fields: Record<string, unknown> = {}) {
  return { id, data: blogSchema.parse({ ...draft, ...fields }) };
}

test('publication is deliberate and boundary-inclusive', () => {
  const implicit = post('implicit');
  const boundary = post('boundary', { draft: false, publishedAt: now });
  const future = post('future', { draft: false, publishedAt: '9999-01-01' });
  expect(implicit.data.draft).toBe(true);
  expect(implicit.data.publishedAt).toBeUndefined();
  expect(isPublished(boundary, now)).toBe(true);
  expect(selectPosts([implicit, future, boundary], { preview: false, now }).map(p => p.id)).toEqual(['boundary']);
  expect(selectPosts([implicit, future, boundary], { preview: true, now }).map(p => p.id)).toEqual(['future', 'boundary', 'implicit']);
  expect(postPath('nested/fixture')).toBe('/blog/nested/fixture/');
  expect(postCardPath('nested/fixture')).toBe('/og/blog/nested/fixture.png');
});

describe('author notice metadata', () => {
  test('remains absent unless explicitly requested', () => {
    expect(blogSchema.parse(draft)).not.toHaveProperty('authorNotice');
  });

  test('defaults an opted-in notice to neutral credit without inferred roles', () => {
    expect(blogSchema.parse({ ...draft, authorNotice: {} })).toHaveProperty('authorNotice', { guest: false, roles: [] });
  });

  test('preserves explicit guest status and selected roles', () => {
    const authorNotice = { guest: true, roles: ['community member', 'contributor', 'maintainer', 'founder'] };
    expect(blogSchema.parse({ ...draft, authorNotice })).toHaveProperty('authorNotice', authorNotice);
  });

  test.each([
    { guest: 'true' },
    { roles: ['administrator'] },
    { roles: 'maintainer' },
  ])('rejects invalid notice metadata %j', authorNotice => {
    expect(blogSchema.safeParse({ ...draft, authorNotice }).success).toBe(false);
  });
});

describe('metadata validation', () => {
  const valid: [string, Record<string, unknown>][] = [
    ['minimal draft', {}],
    ['trimmed required strings', { title: ' Title ', description: ' Description ', author: { name: ' Author ' } }],
    ['HTTP author', { author: { name: 'Author', url: 'http://example.com' } }],
    ['explicit draft', { draft: true }],
    ['published date', { draft: false, publishedAt: '2026-11-01' }],
    ['Date instance', { publishedAt: now }],
    ['UTC timestamp', { publishedAt: '2026-11-01T00:00:00Z' }],
    ['offset timestamp', { publishedAt: '2026-11-01T11:00:00+11:00' }],
    ['update boundary', { publishedAt: now, updatedAt: now }],
    ['later update', { publishedAt: now, updatedAt: '2026-11-02' }],
    ['tags', { tags: [' Zig ', 'Godot'] }],
    ['section', { section: ' Updates ' }],
    ['root-relative cover', { cover: { src: '/images/cover.png', alt: ' Cover ' } }],
    ['HTTP cover', { cover: { src: 'http://example.com/cover.jpg', alt: 'Cover' } }],
    ['local share override', { ogImage: share }],
    ['HTTPS share override', { ogImage: { ...share, src: 'https://example.com/share.png' } }],
    ['JPEG share override', { ogImage: { ...share, type: 'image/jpeg' } }],
    ['WebP share override', { ogImage: { ...share, type: 'image/webp' } }],
    ['HTTP source', { source: { url: 'http://example.com/article' } }],
    ['original source date', { publishedAt: now, source: { url: 'https://example.com/article', publishedAt: '2020-01-01' } }],
  ];
  test.each(valid)('accepts %s', (_, fields) => {
    expect(blogSchema.safeParse({ ...draft, ...fields }).success).toBe(true);
  });

  const invalid: [string, Record<string, unknown>][] = [
    ['missing title', { title: undefined }],
    ['blank title', { title: '  ' }],
    ['blank description', { description: '\n' }],
    ['missing author', { author: undefined }],
    ['blank author name', { author: { name: ' ' } }],
    ['non-HTTP author URL', { author: { name: 'Author', url: 'mailto:author@example.com' } }],
    ['credentialed author URL', { author: { name: 'Author', url: 'https://user:pass@example.com' } }],
    ['invalid draft type', { draft: 'false' }],
    ['published without date', { draft: false }],
    ['malformed date', { publishedAt: 'not-a-date' }],
    ['overflow date', { publishedAt: '2026-02-30' }],
    ['overflow timestamp', { publishedAt: '2026-02-30T00:00:00Z' }],
    ['timezone-less timestamp', { publishedAt: '2026-11-01T00:00:00' }],
    ['invalid Date instance', { publishedAt: new Date(NaN) }],
    ['numeric date', { publishedAt: 0 }],
    ['null date', { publishedAt: null }],
    ['bad update date', { updatedAt: '2026-13-01' }],
    ['update before publication', { publishedAt: now, updatedAt: '2026-10-31' }],
    ['blank tag', { tags: [' '] }],
    ['non-array tags', { tags: 'Zig' }],
    ['blank section', { section: ' ' }],
    ['missing cover alt', { cover: { src: '/cover.png' } }],
    ['blank cover alt', { cover: { src: '/cover.png', alt: ' ' } }],
    ['protocol-relative cover', { cover: { src: '//example.com/cover.png', alt: 'Cover' } }],
    ['relative cover', { cover: { src: 'cover.png', alt: 'Cover' } }],
    ['cover fragment', { cover: { src: '/cover.png#x', alt: 'Cover' } }],
    ['cover query', { cover: { src: '/cover.png?x', alt: 'Cover' } }],
    ['cover backslash', { cover: { src: '/\\example.com/cover.png', alt: 'Cover' } }],
    ['non-HTTP cover', { cover: { src: 'ftp://example.com/cover.png', alt: 'Cover' } }],
    ['HTTP share override', { ogImage: { ...share, src: 'http://example.com/share.png' } }],
    ['protocol-relative share', { ogImage: { ...share, src: '//example.com/share.png' } }],
    ['missing share alt', { ogImage: { ...share, alt: undefined } }],
    ['blank share alt', { ogImage: { ...share, alt: ' ' } }],
    ['zero width', { ogImage: { ...share, width: 0 } }],
    ['negative height', { ogImage: { ...share, height: -1 } }],
    ['fractional width', { ogImage: { ...share, width: 1.5 } }],
    ['fractional height', { ogImage: { ...share, height: 1.5 } }],
    ['missing dimensions', { ogImage: { src: '/share.png', alt: 'Share', type: 'image/png' } }],
    ['unsupported MIME', { ogImage: { ...share, type: 'image/svg+xml' } }],
    ['missing MIME', { ogImage: { ...share, type: undefined } }],
    ['non-HTTP source', { source: { url: 'ftp://example.com/article' } }],
    ['credentialed source', { source: { url: 'https://user@example.com/article' } }],
    ['missing source URL', { source: {} }],
    ['overflow source date', { source: { url: 'https://example.com', publishedAt: '2026-02-30' } }],
  ];
  test.each(invalid)('rejects %s', (_, fields) => {
    expect(blogSchema.safeParse({ ...draft, ...fields }).success).toBe(false);
  });

  test('normalizes text and URLs while preserving absent dates', () => {
    const data = blogSchema.parse({ ...draft, title: ' Title ', description: ' Description ', author: { name: ' Author ', url: 'HTTPS://EXAMPLE.COM' }, tags: [' Zig '], section: ' Updates ' });
    expect(data.title).toBe('Title');
    expect(data.description).toBe('Description');
    expect(data.author).toEqual({ name: 'Author', url: 'https://example.com/' });
    expect(data.tags).toEqual(['Zig']);
    expect(data.section).toBe('Updates');
    expect(data.publishedAt).toBeUndefined();
    expect(data.updatedAt).toBeUndefined();
    expect(blogSchema.parse(draft).tags).toEqual([]);
  });

  test.each(['2026-11-01', '2026-11-01T00:00:00Z', '2026-11-01T11:00:00+11:00'])('normalizes %s to a UTC Date', value => {
    expect(blogSchema.parse({ ...draft, publishedAt: value }).publishedAt).toEqual(now);
  });
});

test('production excludes dated drafts and future posts but includes past posts', () => {
  expect(isPublished(post('draft', { publishedAt: now }), now)).toBe(false);
  expect(isPublished(post('future', { draft: false, publishedAt: '2026-11-02' }), now)).toBe(false);
  expect(isPublished(post('past', { draft: false, publishedAt: '2026-10-31' }), now)).toBe(true);
});

test('sorts ties and undated drafts by ID without mutating or losing entry fields', () => {
  const entries = [
    { ...post('b', { draft: false, publishedAt: now }), body: 'B' },
    { ...post('a', { draft: false, publishedAt: now }), body: 'A' },
    { ...post('z'), body: 'Z' },
    { ...post('c'), body: 'C' },
  ];
  const selected = selectPosts(entries, { preview: true, now });
  expect(selected.map(p => p.id)).toEqual(['a', 'b', 'c', 'z']);
  expect(selected[0]).toBe(entries[1]);
  expect(selected[0].body).toBe('A');
  expect(entries.map(p => p.id)).toEqual(['b', 'a', 'z', 'c']);
  expect(selectPosts([], { preview: false, now })).toEqual([]);
});

test('encodes each path segment and preserves filename-derived index IDs', () => {
  expect(postPath('nested/a b#?/index')).toBe('/blog/nested/a%20b%23%3F/index/');
  expect(postCardPath('nested/a b#?/index')).toBe('/og/blog/nested/a%20b%23%3F/index.png');
});

test('formats dates in UTC rather than the host timezone', () => {
  expect(formatDate(new Date('2026-11-01T00:30:00+11:00'))).toBe('October 31, 2026');
});
