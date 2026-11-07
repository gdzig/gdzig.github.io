import { beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const siteDirectory = join(testDirectory, '..');
const outputDirectory = join(siteDirectory, 'dist');
const apiReferenceHref = 'href="/docs/reference/"';
const generatedApiDocsHrefs = [
  'href="https://gdzig.github.io/gdzig/"',
  'href="https://gdzig.github.io/bbcodez/"',
  'href="https://gdzig.github.io/casez/"',
  'href="https://gdzig.github.io/oopz/"',
];


async function readLinkedCss(html: string) {
  const stylesheetPaths = [...html.matchAll(/href="(\/_astro\/[^\"]+\.css)"/g)].map(
    ([, path]) => path,
  );

  return (
    await Promise.all(
      stylesheetPaths.map((path) => readFile(join(outputDirectory, path.slice(1)), 'utf8')),
    )
  ).join('\n');
}


function expectInOrder(html: string, values: string[]) {
  let lastIndex = -1;

  for (const value of values) {
    const index = html.indexOf(value);
    expect(index).toBeGreaterThan(lastIndex);
    lastIndex = index;
  }
}

function expectTopLevelNavigation(html: string) {
  expect(html).toContain('class="wordmark" href="/"');
  expectInOrder(html, ['href="/blog/"', 'href="/showcase/"', 'href="/docs/"']);
  for (const href of generatedApiDocsHrefs) {
    expect(html).not.toContain(href);
  }
}


function expectDocsTopLevelLinks(html: string) {
  for (const href of ['href="/"', 'href="/blog/"', 'href="/showcase/"', 'href="/docs/"']) {
    expect(html).toContain(href);
  }
}


function expectStarlightLightPalette(css: string) {
  const lightThemeRule = css.match(/:root\[data-theme=light\]\{[^}]*\}/)?.[0] ?? '';

  expect(lightThemeRule).toContain('--sl-color-black:#fffaf2');
  expect(lightThemeRule).toContain('--sl-color-white:#17130b');
}


function expectDesktopMobileMenuHidden(css: string) {
  const hiddenRuleIndex = css.search(/\.pico \.mobile-nav\{[^}]*display:none/);
  const mobileMediaIndex = css.indexOf('@media (width<=576px){', hiddenRuleIndex);
  const visibleMobileRuleIndex = css.indexOf('.pico .mobile-nav{display:block}', mobileMediaIndex);

  expect(hiddenRuleIndex).toBeGreaterThanOrEqual(0);
  expect(mobileMediaIndex).toBeGreaterThan(hiddenRuleIndex);
  expect(visibleMobileRuleIndex).toBeGreaterThan(mobileMediaIndex);
}

beforeAll(() => {
  const result = spawnSync('bun', ['run', 'build'], {
    cwd: siteDirectory,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
  });

  if (result.status !== 0) {
    throw new Error(
      ['Site build failed.', result.stdout, result.stderr].filter(Boolean).join('\n'),
    );
  }
}, 180_000);

describe('static site artifact', () => {
  test.each([
    'index.html',
    'blog/index.html',
    'blog/godot-video-extensions-in-zig/index.html',
    'showcase/index.html',
    'docs/index.html',
  ])('advertises all three blog feeds only in the head of %s', async (path) => {
    const html = await readFile(join(outputDirectory, path), 'utf8');
    const feeds: { href: string | null; type: string | null; title: string | null }[] = [];
    const visibleFeedLinks: string[] = [];

    await new HTMLRewriter()
      .on('head link[rel="alternate"]', {
        element(element) {
          feeds.push({
            href: element.getAttribute('href'),
            type: element.getAttribute('type'),
            title: element.getAttribute('title'),
          });
        },
      })
      .on('body [href]', {
        element(element) {
          const href = element.getAttribute('href')!;
          if (/\/(rss\.xml|atom\.xml|feed\.json)$/.test(href)) visibleFeedLinks.push(href);
        },
      })
      .transform(new Response(html))
      .text();

    expect(feeds).toEqual([
      { href: 'https://gdzig.github.io/rss.xml', type: 'application/rss+xml', title: 'GDZig Blog RSS Feed' },
      { href: 'https://gdzig.github.io/atom.xml', type: 'application/atom+xml', title: 'GDZig Blog Atom Feed' },
      { href: 'https://gdzig.github.io/feed.json', type: 'application/feed+json', title: 'GDZig Blog JSON Feed' },
    ]);
    expect(visibleFeedLinks).toEqual([]);
  });

  test('contains the Astro landing page', async () => {
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');

    expect(html).toContain('Idiomatic Zig bindings for Godot 4');
    expect(html).toContain('For extension developers');
    expect(html).toContain('For game developers');
    expect(html).toContain('href="/docs/"');
    expectTopLevelNavigation(html);
  });


  test('supports a system-aware remembered color theme', async () => {
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    const css = await readLinkedCss(html);

    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('starlight-theme');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(css).toContain('[data-theme=dark]');
  });


  test('includes scoped Pico styles on the Astro landing page', async () => {
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    const css = await readLinkedCss(html);

    expect(html).toContain('class="pico home-page"');
    expect(css).toContain('--pico-font-family');
    expect(css).toContain('.pico');
  });


  test('hides the mobile menu on desktop widths', async () => {
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    const css = await readLinkedCss(html);

    expect(html).toContain('class="mobile-nav"');
    expectDesktopMobileMenuHidden(css);
  });


  test('initializes pageview-only cookieless analytics on marketing and docs pages', async () => {
    for (const path of ['index.html', join('docs', 'index.html')]) {
      const html = await readFile(join(outputDirectory, path), 'utf8');
      const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
        .map(([, body]) => body)
        .find((body) => body.includes('posthog.init(apiKey'));
      expect(script).toBeDefined();

      const context: Record<string, unknown> = {
        document: {
          createElement: () => ({}),
          getElementsByTagName: () => [{ parentNode: { insertBefore: () => {} } }],
        },
      };
      context.window = context;
      runInNewContext(script!, context);

      const [token, options] = (
        context.posthog as { _i: [string, Record<string, unknown>, string][] }
      )._i[0];
      expect(token).toBeTruthy();
      expect(JSON.parse(JSON.stringify(options))).toMatchObject({
        cookieless_mode: 'always',
        person_profiles: 'never',
        capture_pageview: true,
        autocapture: false,
        disable_session_recording: true,
        capture_pageleave: false,
        capture_dead_clicks: false,
        rageclick: false,
        capture_heatmaps: false,
        capture_performance: false,
        advanced_disable_flags: true,
        capture_exceptions: false,
      });
    }
  });

  test('rejects a production build without PostHog configuration', async () => {
    const output = await mkdtemp(join(tmpdir(), 'gdzig-posthog-test-'));
    try {
      const result = spawnSync('bun', ['run', 'build:astro', '--outDir', output], {
        cwd: siteDirectory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PUBLIC_POSTHOG_PROJECT_TOKEN: '',
          PUBLIC_POSTHOG_HOST: '',
        },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr + result.stdout).toContain('PUBLIC_POSTHOG_PROJECT_TOKEN');
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  }, 180_000);

  test('keeps wide blog tables readable inside a local scroll container', async () => {
    const html = await readFile(join(outputDirectory, 'blog', 'index.html'), 'utf8');
    const css = [
      await readLinkedCss(html),
      ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(([, body]) => body),
    ].join('\n');
    const tableRule = css.match(/\.pico \.blog-prose table\{([^}]*)\}/)?.[1] ?? '';

    expect(tableRule).toContain('max-width:100%');
    expect(tableRule).toContain('overflow-x:auto');
    expect(tableRule).toContain('overflow-wrap:normal');
  });

  test('contains the collection-backed Blog page with Clay’s published article', async () => {
    const html = await readFile(join(outputDirectory, 'blog', 'index.html'), 'utf8');

    expect(html).toContain('<title>Blog | GDZig</title>');
    expect(html).not.toContain('No posts published yet.');
    expect(html).toContain('href="/blog/godot-video-extensions-in-zig/"');
    expect(html).toContain('From godot-cpp to Zig');
    expect(html).toContain('November 7, 2026');
    expect(html).toContain('rel="canonical" href="https://gdzig.github.io/blog/"');
    expect(html).toContain('property="og:image" content="https://gdzig.github.io/og/blog.png"');
    expect(html).toContain('href="https://github.com/gdzig/gdzig"');
    expectTopLevelNavigation(html);
  });


  test('publishes Clay’s article with separate GDZig and original dates and contributor credit', async () => {
    const html = await readFile(join(outputDirectory, 'blog', 'godot-video-extensions-in-zig', 'index.html'), 'utf8');

    expect(html).not.toContain('Unpublished preview');
    expect(html).not.toContain('noindex');
    expect(html).toContain('datetime="2026-11-07T00:00:00.000Z">November 7, 2026</time>');
    expect(html).toContain('datetime="2026-09-26T00:00:00.000Z">September 26, 2026</time>');
    expect(html).toContain('a GDZig community member and contributor.');
    expect(html.match(/<hr\b/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/<footer class="blog-source-footer"[^>]*>\s*<hr\b/);
    expect(html).toContain('rel="author"');
    expect((await stat(join(outputDirectory, 'og', 'blog', 'godot-video-extensions-in-zig.png'))).size).toBeGreaterThan(0);
  });


  test('keeps generated API documentation links in the reference section', async () => {
    const [homeHtml, docsHtml, referenceHtml, howToHtml] = await Promise.all([
      readFile(join(outputDirectory, 'index.html'), 'utf8'),
      readFile(join(outputDirectory, 'docs', 'index.html'), 'utf8'),
      readFile(join(outputDirectory, 'docs', 'reference', 'index.html'), 'utf8'),
      readFile(join(outputDirectory, 'docs', 'how-to', 'index.html'), 'utf8'),
    ]);

    for (const href of generatedApiDocsHrefs) {
      expect(referenceHtml).toContain(href);
      for (const html of [homeHtml, docsHtml, howToHtml]) {
        expect(html).not.toContain(href);
      }
    }

    for (const label of [
      'GDZig API reference',
      'BBCodeZ API reference',
      'CaseZ API reference',
      'OopZ API reference',
    ]) {
      expect(referenceHtml).toContain(label);
    }
    expect(referenceHtml).not.toContain('API docs');

    for (const html of [homeHtml, docsHtml, referenceHtml, howToHtml]) {
      expect(html).not.toContain('href="/api/"');
    }

    await expect(stat(join(outputDirectory, 'api'))).rejects.toThrow();
  });


  const docsSections = [
    ['tutorials', 'Tutorials — Guide in progress'],
    ['how-to', 'How-to guides — Guide in progress'],
    ['explanations', 'Explanations'],
    ['reference', 'Reference'],
  ];

  test.each(docsSections)('contains the %s docs placeholder page', async (slug, heading) => {
    const html = await readFile(join(outputDirectory, 'docs', slug, 'index.html'), 'utf8');

    expect(html).toContain(heading);
    expectDocsTopLevelLinks(html);
  });


  test('contains the explanations overview', async () => {
    const html = await readFile(join(outputDirectory, 'docs', 'explanations', 'index.html'), 'utf8');

    expect(html).toContain('Explanations');
    expect(html).toContain('href="/docs/explanations/math-and-random-apis/"');
    expect(html).toContain('Choosing math and random APIs');
    expectDocsTopLevelLinks(html);
  });

  test('contains the math and random API choice explanation', async () => {
    const html = await readFile(
      join(outputDirectory, 'docs', 'explanations', 'math-and-random-apis', 'index.html'),
      'utf8',
    );

    expect(html).toContain('Choosing math and random APIs');
    for (const api of ['gdzig.math', 'std.math', 'gdzig.random', 'std.Random']) {
      expect(html).toContain(api);
    }
    expect(html).toContain(apiReferenceHref);
    for (const href of generatedApiDocsHrefs) {
      expect(html).not.toContain(href);
    }
    expect(html).not.toContain('href="/api/"');
    expectDocsTopLevelLinks(html);
  });


  test('uses a light Starlight palette with a light page background', async () => {
    const html = await readFile(join(outputDirectory, 'docs', 'index.html'), 'utf8');
    const css = await readLinkedCss(html);

    expectStarlightLightPalette(css);
  });


  test('contains the Starlight docs landing page without Pico styles', async () => {
    const html = await readFile(join(outputDirectory, 'docs', 'index.html'), 'utf8');
    const css = await readLinkedCss(html);

    expect(html).toContain('GDZig documentation');
    expect(html).toContain('For extension developers');
    expect(html).toContain('For game developers');
    for (const href of [
      'href="/docs/tutorials/"',
      'href="/docs/how-to/"',
      'href="/docs/explanations/"',
      apiReferenceHref,
    ]) {
      expect(html).toContain(href);
    }
    expectDocsTopLevelLinks(html);
    expect(html).not.toContain('class="pico');
    expect(css).not.toContain('--pico-font-family');
  });
});
