import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { post } from './posts';
import type { createBlogSite } from '../../helpers/blog-site';

export const proseSlug = 'fixture-prose';
export const quoteVariants = ['single', 'multiple', 'list-ending', 'list-starting', 'nested'] as const;

// Real Markdown, not HTML facsimiles. Labels are placeholders, never article copy.
export const proseMarkdown = [
  '## FIXTURE_FIRST_HEADING',
  'FIXTURE_PARAGRAPH `FIXTURE_INLINE_CODE` FIXTURE_PARAGRAPH_END.',
  '> FIXTURE_QUOTE_SINGLE',
  '> FIXTURE_QUOTE_MULTIPLE_FIRST\n>\n> FIXTURE_QUOTE_MULTIPLE_LAST',
  '> FIXTURE_QUOTE_LIST_ENDING\n>\n> - FIXTURE_LIST_FIRST\n> - FIXTURE_LIST_LAST\n>\n>   FIXTURE_LIST_LAST_PARAGRAPH',
  '> - FIXTURE_LIST_START_FIRST\n> - FIXTURE_LIST_START_LAST\n>\n> FIXTURE_QUOTE_LIST_STARTING_END',
  '> FIXTURE_QUOTE_OUTER\n>\n> > FIXTURE_QUOTE_NESTED',
  '## FIXTURE_SECOND_HEADING',
  'FIXTURE_AFTER_SECOND_HEADING',
  '### FIXTURE_THIRD_HEADING',
  'FIXTURE_AFTER_THIRD_HEADING',
  '- FIXTURE_TOP_LIST_FIRST\n  - FIXTURE_NESTED_LIST_FIRST\n  - FIXTURE_NESTED_LIST_LAST\n- FIXTURE_TOP_LIST_LAST',
  '1. FIXTURE_ORDERED_FIRST\n2. FIXTURE_ORDERED_LAST',
  'FIXTURE_BEFORE_IMAGE',
  '![FIXTURE_IMAGE](/images/fixture-prose.svg)',
  'FIXTURE_AFTER_IMAGE',
  '```text\n' + 'FIXTURE_CODE_'.repeat(70) + '\nFIXTURE_CODE_SECOND_LINE\n```',
  '| FIXTURE_TABLE_A | FIXTURE_TABLE_B |\n| --- | --- |\n| ' + 'FIXTURE_CELL_'.repeat(65) + ' | FIXTURE_CELL_END |',
  'FIXTURE_FINAL_PARAGRAPH',
].join('\n\n');

export async function writeProseFixture(site: Awaited<ReturnType<typeof createBlogSite>>) {
  await mkdir(join(site.root, 'public/images'), { recursive: true });
  await writeFile(join(site.root, 'public/images/fixture-prose.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#888"/></svg>');
  await site.writePost(proseSlug, 'md', post({ title: 'FIXTURE_PROSE_TITLE', tags: ['FIXTURE_TAG'] }, proseMarkdown));
}
