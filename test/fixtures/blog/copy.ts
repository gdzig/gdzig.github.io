import { post } from './posts';
import type { createBlogSite } from '../../helpers/blog-site';

export const copySlug = 'fixture-copy';
export const copyText = 'FIXTURE_COPY_FIRST\nFIXTURE_COPY_SECOND <>& "FIXTURE_COPY_END"';

export async function writeCopyFixture(site: Awaited<ReturnType<typeof createBlogSite>>) {
  await site.writePost(copySlug, 'md', post({ title: 'FIXTURE_COPY_TITLE' },
    'FIXTURE_COPY_PARAGRAPH\n\n```text\n' + copyText + '\n```\n\nFIXTURE_COPY_AFTER'));
}
