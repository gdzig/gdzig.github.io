import { getCollection } from 'astro:content';
import { FEED_FORMATS } from './feed-formats';
import { serializeFeed, type FeedFormat } from './feed';
import { publicationContext } from './posts';

export async function feedResponse(site: URL | undefined, format: FeedFormat): Promise<Response> {
  if (!site) throw new Error('Blog feeds require a configured Astro.site.');
  const posts = await getCollection('blog');
  const { type } = FEED_FORMATS.find(candidate => candidate.id === format)!;
  return new Response(serializeFeed(posts, site, publicationContext().now, format), {
    headers: { 'Content-Type': `${type}; charset=utf-8` },
  });
}
