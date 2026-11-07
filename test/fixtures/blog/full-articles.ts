import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { createBlogSite } from '../../helpers/blog-site';
import { post } from './posts';

export const articleSummary = 'FULL_ARTICLE_SUMMARY must stay separate from the body';
export const literalCode = 'const xml = "]]> first ]]> second";\nconst entities = "&amp; &lt; &gt; &#65; &#x41;";';

function body(kind: 'MARKDOWN' | 'MDX') {
  return `FULL_${kind}_START

## Full ${kind} heading

FULL_${kind}_MIDDLE

\`\`\`text
${literalCode}
\`\`\`

[Root link](/docs/intro/)
[Fragment link](#full-${kind.toLowerCase()}-heading)
[Relative link](../sibling/?view=full#part)
![Root image](/images/full-root.png)
<img src="./images/full-relative.png" alt="Relative image" />

<div title="XML_BOUNDARY ]]> first ]]> second">XML_BOUNDARY_TEXT</div>

FULL_${kind}_END`;
}

export async function writeArticleFixtures(site: Awaited<ReturnType<typeof createBlogSite>>) {
  await site.writePost('old', 'md', post({
    title: 'FIXTURE_OLD', publishedAt: '2000-01-01', description: articleSummary,
    cover: { src: '/images/fixture.png', alt: 'FIXTURE_COVER_ONLY' },
  }, body('MARKDOWN')));
  await mkdir(join(site.root, 'src/components'), { recursive: true });
  await writeFile(join(site.root, 'src/components/FeedFixture.astro'), `---
const unsafe = '<!--FEED_COMMENT_SENTINEL--><button class="copy">FEED_COPY_SENTINEL</button><script>FEED_SCRIPT_SENTINEL</script><style>.FEED_STYLE_SENTINEL{color:red}</style>';
---
<aside data-imported-astro style="color:red" onclick="FEED_HANDLER_SENTINEL()">IMPORTED_ASTRO_OUTPUT <a href="./component-link/">Component link</a></aside>
<Fragment set:html={unsafe} />
`);
  await writeFile(join(site.root, 'src/components/FeedFixture.mdx'), `### Imported MDX heading

IMPORTED_MDX_OUTPUT
`);
  await site.writePost('nested/new', 'mdx', post({
    title: 'FIXTURE_NESTED', publishedAt: '2002-01-01', updatedAt: '2002-02-03',
    description: articleSummary, author: { name: 'Fixture guest', url: 'https://example.invalid/guest' },
    tags: ['Fixture Zig', 'Fixture Godot'], section: 'Fixture section',
    authorNotice: { guest: true, roles: ['contributor'] },
  }, `import AstroFixture from '../../../components/FeedFixture.astro';
import MdxFixture from '../../../components/FeedFixture.mdx';

${body('MDX')}

<AstroFixture />
<MdxFixture />
<span data-mdx-fixture>MDX_EVALUATED_{1 + 1}</span>
`));
}
