import { getCollection, render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import mdxRenderer from '@astrojs/mdx/server.js';
import { FEED_FORMATS } from './feed-formats';
import { serializeFeed, type FeedFormat, type FeedPost } from './feed';
import { articleFeedHtml } from './feed-content';
import { publicationContext } from './posts';
import { postPath, selectPosts } from './policy';

export async function feedResponse(site: URL | undefined, format: FeedFormat): Promise<Response> {
  if (!site) throw new Error('Blog feeds require a configured Astro.site.');
  const { now } = publicationContext();
  const posts = selectPosts(await getCollection('blog'), { preview: false, now });
  const container = await AstroContainer.create();
  container.addServerRenderer({ renderer: mdxRenderer });
  const rendered: FeedPost[] = [];
  for (const post of posts) {
    const { Content } = await render(post);
    const url = new URL(postPath(post.id), site);
    const html = await container.renderToString(Content, { request: new Request(url) });
    rendered.push({ ...post, content: articleFeedHtml(html, url) });
  }
  const { type } = FEED_FORMATS.find(candidate => candidate.id === format)!;
  return new Response(serializeFeed(rendered, site, now, format), {
    headers: { 'Content-Type': `${type}; charset=utf-8` },
  });
}
