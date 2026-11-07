import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { createBlogSite } from '../../helpers/blog-site';

type Site = Awaited<ReturnType<typeof createBlogSite>>;
export const escapingTitle = 'FIXTURE "quoted" & </script><script data-fixture-breakout>bad()</script> → Godot’s API\u2028\u2029FIXTURE_END';
export const description = 'FIXTURE_DESCRIPTION "quoted" & <safe> →';
export const image = { src: '/images/fixture.png', alt: 'FIXTURE_ORANGE_SHARE', width: 1200, height: 630, type: 'image/png' };
export const baseFields = { title: 'FIXTURE_POST', description, author: { name: 'Fixture author' }, draft: false, publishedAt: '2001-01-01' };
export function post(fields: Record<string, unknown> = {}, body = 'FIXTURE_MARKDOWN_BODY'): string {
  return `---\n${JSON.stringify({ ...baseFields, ...fields })}\n---\n\n${body}\n`;
}

export const fixtures = [
  { id: 'old', extension: 'md', fields: { title: 'FIXTURE_OLD', publishedAt: '2000-01-01', cover: { src: '/images/fixture.png', alt: 'FIXTURE_COVER_ONLY' } } },
  { id: 'nested/new', extension: 'mdx', fields: { title: 'FIXTURE_NESTED', publishedAt: '2002-01-01', updatedAt: '2002-02-03', author: { name: 'Fixture guest', url: 'https://example.invalid/guest' }, tags: ['Fixture Zig', 'Fixture Godot'], section: 'Fixture section' }, body: 'FIXTURE_MARKDOWN_BODY\n\n<span data-mdx-fixture>{1 + 1}</span>' },
  { id: 'syndicated', extension: 'md', fields: { title: 'FIXTURE_SYNDICATED', author: { name: 'Fixture original author', url: 'https://example.invalid/original-author' }, source: { url: 'https://example.invalid/original/', publishedAt: '1999-01-01' } } },
  { id: 'override', extension: 'md', fields: { title: 'FIXTURE_OVERRIDE', ogImage: image } },
  { id: 'draft', extension: 'md', fields: { title: 'FIXTURE_DRAFT', draft: true } },
  { id: 'implicit', extension: 'md', fields: { title: 'FIXTURE_IMPLICIT', draft: undefined, publishedAt: undefined } },
  { id: 'future', extension: 'md', fields: { title: 'FIXTURE_FUTURE', publishedAt: '9999-01-01' } },
  { id: 'escaping', extension: 'md', fields: { title: escapingTitle } },
] satisfies { id: string; extension: 'md' | 'mdx'; fields: Record<string, unknown>; body?: string }[];

export async function writeFixtures(site: Site) {
  await mkdir(join(site.root, 'public/images'), { recursive: true });
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#f6a31d' } })
    .png().toFile(join(site.root, 'public/images/fixture.png'));
  for (const fixture of fixtures) {
    await site.writePost(fixture.id, fixture.extension, post(fixture.fields, 'body' in fixture ? fixture.body : undefined));
  }
}
