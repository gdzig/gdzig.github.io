import { expect, test } from 'bun:test';
import { cp, mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { buildCardTree, renderCard } from '../src/lib/blog/card';
import { GET as indexCard } from '../src/pages/og/blog.png';

const site = resolve(import.meta.dir, '..');
const unicode = 'Fixture: Zig → Godot’s API & <safe> · Příliš žluťoučký kůň';

// Real decoding catches invalid/truncated output, not just plausible PNG headers.
test.each([unicode, 'Long fixture title '.repeat(14).slice(0, 250), 'UnbrokenIdentifier'.repeat(30)])(
  'renders a complete portable 1200 × 630 PNG: %s', async title => {
    const png = await renderCard({ title, eyebrow: 'November 1, 2026', author: 'Fixture author' });
    expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
    const decoded = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect(decoded.info).toMatchObject({ width: 1200, height: 630 });
    expect(decoded.data.length).toBe(1200 * 630 * decoded.info.channels);
  },
);

test('renders the required arrow as a glyph, not the missing-glyph box', async () => {
  const arrow = await renderCard({ title: '→', eyebrow: 'GDZig' });
  const missing = await renderCard({ title: '\u{10ffff}', eyebrow: 'GDZig' });
  const arrowPixels = await sharp(arrow).raw().toBuffer();
  const missingPixels = await sharp(missing).raw().toBuffer();
  expect(arrowPixels.equals(missingPixels)).toBe(false);
});

test('uses GDZig framing, literal text, local sans aliases and constrained bylines', () => {
  const tree = buildCardTree({ title: unicode, eyebrow: 'Fixture eyebrow', author: 'Long author '.repeat(50) });
  const serialized = JSON.stringify(tree);
  for (const expected of ['#15120d', '#f8efe3', '#cbbca8', '#f6a31d', 'GDZig · ', 'gdzig.github.io', unicode, 'GDZig Sans Extended']) {
    expect(serialized).toContain(expected);
  }
  for (const forbidden of ['Simon Hartcher', 'simonhartcher.com', 'Source Serif', 'IBM Plex', '#052014', '#00a66e']) {
    expect(serialized).not.toContain(forbidden);
  }
  const root = tree as { props: { style: Record<string, unknown>; children: { props: { style: Record<string, unknown>; children: unknown } }[] } };
  expect(root.props.style).toMatchObject({ width: 1200, height: 630, padding: 72 });
  expect(root.props.children[1].props.style).toMatchObject({ display: 'block', whiteSpace: 'nowrap', lineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word' });
  const titleStyle = (root.props.children[0].props.children as { props: { style: Record<string, unknown> } }[])[1].props.style;
  expect(titleStyle).toMatchObject({ display: 'block', lineClamp: 4, wordBreak: 'break-word' });
  expect(JSON.stringify(buildCardTree({ title: 'Blog', eyebrow: 'GDZig' }))).toContain('GDZig · gdzig.github.io');
});

test('renders an unusually long byline without losing PNG framing', async () => {
  const png = await renderCard({ title: 'Fixture', eyebrow: 'GDZig', author: 'UnbrokenAuthor'.repeat(80) });
  expect((await sharp(png).raw().toBuffer({ resolveWithObject: true })).info).toMatchObject({ width: 1200, height: 630 });
});

test('index endpoint returns PNG content with image/png MIME type', async () => {
  const response = await indexCard({} as Parameters<typeof indexCard>[0]);
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('image/png');
  const png = Buffer.from(await response.arrayBuffer());
  expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
  await sharp(png).raw().toBuffer();
});

// Copy only explicit build inputs, never .env. The independent cwd catches a
// public-root resolution accidentally tied to source modules or build chunks.
test('static fixture builds preserve .png URLs, filter posts and validate selected overrides', async () => {
  const scratch = process.env.JCODE_SCRATCH_DIR ?? join(site, '..', 'research', 'site-test-scratch');
  await mkdir(scratch, { recursive: true });
  const fixture = await mkdtemp(join(scratch, 'gdzig-card-test-'));
  const env = { ...process.env, NODE_ENV: 'production', PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_fixture_dummy', PUBLIC_POSTHOG_HOST: 'https://example.invalid' };
  const build = () => spawnSync('bun', ['run', 'build:astro', '--config', 'astro.fixture.config.mjs'], { cwd: fixture, env, encoding: 'utf8', timeout: 180_000 });
  const assertSuccess = (result: ReturnType<typeof build>) => {
    expect(result.status, result.stdout + result.stderr).toBe(0);
  };
  const publicFiles = async () => (await readdir(join(fixture, 'public'), { recursive: true })).sort();
  const post = async (id: string, fields: Record<string, unknown> = {}) => {
    const path = join(fixture, 'src/content/blog', `${id}.md`);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, `---\n${JSON.stringify({ title: unicode, description: 'Fixture only.', author: { name: 'Fixture author' }, draft: false, publishedAt: '2001-01-01', ...fields })}\n---\n`);
  };
  try {
    for (const input of ['src', 'public', 'scripts', 'astro.config.mjs', 'package.json', 'tsconfig.json', 'bun.lock']) {
      await cp(join(site, input), join(fixture, input), { recursive: true });
    }
    await writeFile(join(fixture, 'astro.fixture.config.mjs'), `import { defineConfig } from 'astro/config';
import base from './astro.config.mjs';
export default defineConfig({ ...base, cacheDir: './.astro-cache/' });
`);
    await symlink(join(site, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    const originalPublic = await publicFiles();
    assertSuccess(build());
    expect((await stat(join(fixture, '.astro-cache'))).isDirectory()).toBe(true);
    const index = join(fixture, 'dist/og/blog.png');
    expect(await sharp(index).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
    await sharp(index).raw().toBuffer();
    expect((await stat(index)).isFile()).toBe(true);
    expect(await publicFiles()).toEqual(originalPublic);

    const image = { src: '/fixture-share.png', alt: 'Fixture share image', width: 80, height: 40, type: 'image/png' };
    await sharp({ create: { width: 80, height: 40, channels: 3, background: '#f6a31d' } }).png().toFile(join(fixture, 'public/fixture-share.png'));
    await post('index');
    await post('nested/fixture');
    await post('overridden', { ogImage: image });
    await post('remote', { ogImage: { ...image, src: 'https://example.invalid/never-fetch.png' } });
    await post('hidden-draft', { draft: true, ogImage: { ...image, src: '/missing-draft.png' } });
    await post('hidden-future', { publishedAt: '9999-01-01', ogImage: { ...image, src: '/missing-future.png' } });
    const withOverride = await publicFiles();
    assertSuccess(build());
    for (const relative of ['og/blog.png', 'og/blog/index.png', 'og/blog/nested/fixture.png']) {
      const path = join(fixture, 'dist', relative);
      expect((await stat(path)).isFile()).toBe(true);
      expect(await sharp(path).metadata()).toMatchObject({ format: 'png', width: 1200, height: 630 });
      await sharp(path).raw().toBuffer();
    }
    for (const id of ['overridden', 'remote', 'hidden-draft', 'hidden-future']) {
      expect(await stat(join(fixture, 'dist/og/blog', `${id}.png`)).catch(() => null)).toBeNull();
    }
    expect(await publicFiles()).toEqual(withOverride);
    await post('overridden', { ogImage: { ...image, width: 81 } });
    const invalid = build();
    expect(invalid.status).not.toBe(0);
    expect(invalid.stdout + invalid.stderr).toContain('Invalid blog ogImage /fixture-share.png');
    expect(invalid.stdout + invalid.stderr).toContain('Expected 81x40 image/png');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 600_000);
