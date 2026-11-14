import { beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { parseFeed } from './helpers/feeds';

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
const mastodonFollowUrl = 'https://fed.brid.gy/web/gdzig.github.io/followers';
const mastodonFollowTitle = 'Follow @gdzig.github.io@web.brid.gy from Mastodon or any fediverse server';
const blueskyProfileUrl = 'https://bsky.app/profile/gdzig.github.io.web.brid.gy';
const bridgyVerificationUrl = 'https://web.brid.gy/r/https://gdzig.github.io/';


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

type DocumentHead = {
  html: string;
  canonicals: string[];
  metas: { property: string | null; name: string | null; content: string | null }[];
};

type IconLink = {
  rel: string | null;
  href: string | null;
  type: string | null;
  sizes: string | null;
};

async function readIconLinks(path: string): Promise<IconLink[]> {
  const html = await readFile(join(outputDirectory, path), 'utf8');
  const links: IconLink[] = [];

  await new HTMLRewriter()
    .on('head link[rel]', {
      element(element) {
        const rel = element.getAttribute('rel') ?? '';
        if (!/(^|\s)(shortcut\s+)?icon(\s|$)/.test(rel)) return;
        links.push({
          rel,
          href: element.getAttribute('href'),
          type: element.getAttribute('type'),
          sizes: element.getAttribute('sizes'),
        });
      },
    })
    .transform(new Response(html))
    .text();

  return links;
}

async function readDocumentHead(path: string): Promise<DocumentHead> {
  const html = await readFile(join(outputDirectory, path), 'utf8');
  const canonicals: string[] = [];
  const metas: DocumentHead['metas'] = [];

  await new HTMLRewriter()
    .on('head link[rel="canonical"]', {
      element(element) {
        canonicals.push(element.getAttribute('href') ?? '');
      },
    })
    .on('head meta', {
      element(element) {
        metas.push({
          property: element.getAttribute('property'),
          name: element.getAttribute('name'),
          content: element.getAttribute('content'),
        });
      },
    })
    .transform(new Response(html))
    .text();

  return { html, canonicals, metas };
}

async function readRepresentativeHCard(html: string) {
  let hidden = false;
  let name = '';
  let url: string | null = null;
  let photo: { src: string | null; alt: string | null; width: string | null; height: string | null } | null = null;
  let note = '';

  await new HTMLRewriter()
    .on('div.h-card', {
      element(element) {
        hidden = element.getAttribute('hidden') !== null;
      },
    })
    .on('.h-card .p-name', { text(chunk) { name += chunk.text; } })
    .on('.h-card .u-url', { element(element) { url = element.getAttribute('href'); } })
    .on('.h-card .u-photo', {
      element(element) {
        photo = {
          src: element.getAttribute('src'),
          alt: element.getAttribute('alt'),
          width: element.getAttribute('width'),
          height: element.getAttribute('height'),
        };
      },
    })
    .on('.h-card .p-note', { text(chunk) { note += chunk.text; } })
    .transform(new Response(html))
    .text();

  return { hidden, name: name.trim(), url, photo, note: note.trim() };
}

interface FooterFollowLink {
  href: string;
  label: string;
  title: string;
  rel: string;
  hidden: boolean;
}

async function readFooterFollowLinks(html: string) {
  const links: FooterFollowLink[] = [];
  let current: FooterFollowLink | undefined;

  await new HTMLRewriter()
    .on('footer nav[aria-label="Follow GDZig"] a', {
      element(element) {
        current = {
          href: element.getAttribute('href') ?? '',
          label: '',
          title: element.getAttribute('title') ?? '',
          rel: element.getAttribute('rel') ?? '',
          hidden: element.hasAttribute('hidden'),
        };
        links.push(current);
      },
      text(text) {
        current!.label += text.text;
      },
    })
    .transform(new Response(html))
    .text();

  return links.map(link => ({ ...link, label: link.label.trim() }));
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
  ])('advertises all three blog feeds in the head and only RSS in the marketing footer of %s', async (path) => {
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
    expect(visibleFeedLinks).toEqual(path === 'docs/index.html' ? [] : ['/rss.xml']);
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

describe('bridged profile and marketing metadata', () => {
  test('home page exposes one canonical and a representative h-card for Bridgy', async () => {
    const { html, canonicals, metas } = await readDocumentHead('index.html');
    const card = await readRepresentativeHCard(html);

    expect(canonicals).toEqual(['https://gdzig.github.io/']);
    expect(card).toEqual({
      hidden: true,
      name: 'GDZig',
      url: 'https://gdzig.github.io/',
      photo: {
        src: 'https://gdzig.github.io/gdzig-logo.png',
        alt: 'GDZig logo',
        width: '512',
        height: '512',
      },
      note: 'GDZig provides idiomatic Zig bindings for Godot 4.',
    });
    expect(metas.filter((meta) => meta.property === 'og:title')).toHaveLength(1);
    for (const [property, content] of Object.entries({
      'og:type': 'website',
      'og:site_name': 'GDZig',
      'og:url': 'https://gdzig.github.io/',
      'og:image': 'https://gdzig.github.io/og/home.png',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:type': 'image/png',
    })) {
      expect(metas).toContainEqual({ property, name: null, content });
    }
    expect(metas).toContainEqual({ property: null, name: 'twitter:card', content: 'summary_large_image' });
  });

  test('emits the avatar and home card at their advertised sizes', async () => {
    const [avatar, home] = await Promise.all([
      sharp(join(outputDirectory, 'gdzig-logo.png')).metadata(),
      sharp(join(outputDirectory, 'og', 'home.png')).metadata(),
    ]);

    expect(avatar).toMatchObject({ format: 'png', width: 512, height: 512 });
    expect(home).toMatchObject({ format: 'png', width: 1200, height: 630 });
  });

  test('blog pages keep single metadata and the original guest canonical', async () => {
    const post = await readDocumentHead(join('blog', 'godot-video-extensions-in-zig', 'index.html'));

    expect(post.canonicals).toEqual(['https://tercek.me/blog/godot-video-extensions-in-zig/']);
    expect(post.metas.filter((meta) => meta.property === 'og:title')).toHaveLength(1);
  });

  test('the showcase page gets a canonical and a social image', async () => {
    const { canonicals, metas } = await readDocumentHead(join('showcase', 'index.html'));

    expect(canonicals).toEqual(['https://gdzig.github.io/showcase/']);
    expect(metas).toContainEqual({
      property: 'og:image',
      name: null,
      content: 'https://gdzig.github.io/og/home.png',
    });
  });
});

describe('blog feed categories', () => {
  const postUrl = 'https://gdzig.github.io/blog/godot-video-extensions-in-zig/';
  const tags = ['zig', 'godot', 'gdextension', 'video', 'gdzig'];

  test('publishes the real post categories in RSS', async () => {
    const body = await readFile(join(outputDirectory, 'rss.xml'), 'utf8');
    const entry = parseFeed(body, 'rss').entries.find(entry => entry.id === postUrl);

    expect(entry).toBeDefined();
    expect(entry!.tags).toEqual(tags);
    for (const tag of tags) {
      expect(body).toContain(`<category>${tag}</category>`);
    }
  });

  test('keeps the real post tags in head metadata but not in the article body', async () => {
    const html = await readFile(
      join(outputDirectory, 'blog', 'godot-video-extensions-in-zig', 'index.html'),
      'utf8',
    );

    for (const tag of tags) {
      expect(html).toContain(`<meta property="article:tag" content="${tag}">`);
    }
    expect(html).toContain(`"keywords":${JSON.stringify(tags)}`);
    expect(html).not.toContain('class="blog-tags"');
    expect(html).not.toContain('class="blog-cover"');
  });
});

describe('bridged identity links', () => {
  test('links to Mastodon, Bluesky, and RSS from the home page follow nav', async () => {
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    const links = await readFooterFollowLinks(html);

    expect(links.filter(link => !link.hidden).map(({ href, label, title }) => ({ href, label, title }))).toEqual([
      { href: mastodonFollowUrl, label: 'Mastodon', title: mastodonFollowTitle },
      { href: blueskyProfileUrl, label: 'Bluesky', title: '' },
      { href: '/rss.xml', label: 'RSS', title: '' },
    ]);
  });

  test('includes the hidden Bridgy rel="me" verification link on the home page', async () => {
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    const links = await readFooterFollowLinks(html);

    expect(links.filter(link => link.hidden)).toEqual([
      {
        href: bridgyVerificationUrl,
        label: 'GDZig on the fediverse',
        title: '',
        rel: 'me',
        hidden: true,
      },
    ]);
  });

  test('shares the social links with the blog index footer', async () => {
    const html = await readFile(join(outputDirectory, 'blog', 'index.html'), 'utf8');
    const links = await readFooterFollowLinks(html);

    for (const href of [mastodonFollowUrl, blueskyProfileUrl]) {
      expect(links.some(link => link.href === href && !link.hidden)).toBe(true);
    }
  });
});

describe('brand logo', () => {
  test('the home page links the shared GDZig logo as its favicon', async () => {
    const links = await readIconLinks('index.html');
    const svg = links.find((link) => link.type === 'image/svg+xml');

    expect(svg?.rel).toBe('icon');
    expect(svg?.href).toMatch(/^\/_astro\/gdzig-logo\.[A-Za-z0-9_-]+\.svg$/);
    expect(links).toContainEqual({
      rel: 'icon',
      href: '/gdzig-logo.png',
      type: 'image/png',
      sizes: '512x512',
    });
  });

  test('the docs page uses the PNG favicon', async () => {
    const links = await readIconLinks(join('docs', 'index.html'));

    expect(links).toContainEqual({
      rel: 'shortcut icon',
      href: '/gdzig-logo.png',
      type: 'image/png',
      sizes: null,
    });
  });

  test('the marketing header shows the logo in the wordmark', async () => {
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');
    const logos: { classList: string[]; src: string | null; alt: string | null }[] = [];

    await new HTMLRewriter()
      .on('.wordmark img', {
        element(element) {
          logos.push({
            classList: (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean),
            src: element.getAttribute('src'),
            alt: element.getAttribute('alt'),
          });
        },
      })
      .transform(new Response(html))
      .text();

    expect(logos).toHaveLength(1);
    expect(logos[0]).toMatchObject({ classList: ['wordmark-logo'], alt: '' });
    expect(logos[0].src).toMatch(/^\/_astro\/gdzig-logo\.[A-Za-z0-9_-]+\.svg$/);
  });

  test('the docs header shows the Starlight logo image', async () => {
    const html = await readFile(join(outputDirectory, 'docs', 'index.html'), 'utf8');
    const logoSources: string[] = [];

    await new HTMLRewriter()
      .on('.site-title img', {
        element(element) {
          logoSources.push(element.getAttribute('src') ?? '');
        },
      })
      .transform(new Response(html))
      .text();

    expect(logoSources).toHaveLength(1);
    expect(logoSources[0]).toMatch(/^\/_astro\/gdzig-logo\.[A-Za-z0-9_-]+\.svg$/);
  });

  test('the home page does not reference the removed favicon.svg', async () => {
    const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');

    expect(html).not.toContain('href="/favicon.svg"');
  });

  test('ships one SVG logo asset and no duplicate public copy', async () => {
    const svgAssets = (await readdir(join(outputDirectory, '_astro')))
      .filter((file) => /^gdzig-logo\.[A-Za-z0-9_-]+\.svg$/.test(file));

    expect(svgAssets).toHaveLength(1);
    await expect(stat(join(outputDirectory, 'gdzig-logo.svg'))).rejects.toThrow();
  });
});
