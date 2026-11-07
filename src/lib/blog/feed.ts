import { Feed } from 'feed';
import { FEED_FORMATS } from './feed-formats';
import { formatDate, postPath, selectPosts, type BlogPost } from './policy';

export type FeedFormat = typeof FEED_FORMATS[number]['id'];
const serializers = { rss: 'rss2', atom: 'atom1', json: 'json1' } as const;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);
// feed's XML serializer desanitizes &amp; once before escaping text nodes.
// Escape ampersands first so literal entity-looking text survives unchanged.
const xmlText = (value: string): string => value.replace(/&/g, '&amp;');

/** Adapted from simonhartcher.com's shared feed generator, without tracking. */
export function serializeFeed(posts: BlogPost[], site: URL, now: Date, format: FeedFormat): string {
  const published = selectPosts(posts, { preview: false, now });
  const updated = published.length
    ? new Date(Math.max(...published.map(post => (post.data.updatedAt ?? post.data.publishedAt!).getTime())))
    : new Date(0);
  const feed = new Feed({
    title: 'GDZig Blog',
    description: 'Release notes and project updates for GDZig.',
    id: new URL('/blog/', site).href,
    link: new URL('/blog/', site).href,
    language: 'en-us',
    updated,
    author: { name: 'GDZig', link: site.href },
    feedLinks: Object.fromEntries(FEED_FORMATS.map(({ id, path }) => [id, new URL(path, site).href])),
  });

  for (const post of published) {
    const { data } = post;
    const link = new URL(postPath(post.id), site).href;
    const original = data.source
      ? `<p>Originally published${data.source.publishedAt ? ` on ${formatDate(data.source.publishedAt)}` : ''}. <a href="${escapeHtml(data.source.url)}">Read the original article</a>.</p>`
      : '';
    feed.addItem({
      title: format === 'atom' ? escapeHtml(data.title) : data.title,
      id: link,
      link,
      description: format === 'json' ? data.description : escapeHtml(data.description),
      content: `<p>${escapeHtml(data.description)}</p>${original}`,
      date: data.updatedAt ?? data.publishedAt!,
      published: data.publishedAt,
      author: format === 'rss' ? undefined : [{
        name: format === 'json' ? data.author.name : xmlText(data.author.name),
        link: data.author.url,
      }],
      category: data.tags.map(name => ({
        name: format === 'rss' ? xmlText(name) : format === 'atom' ? escapeHtml(name) : name,
        term: format === 'atom' ? escapeHtml(name) : undefined,
      })),
      // RSS author requires an email. Dublin Core preserves name-only credit.
      // A text title also avoids the serializer's single-CDATA-terminator limit.
      extensions: format === 'rss' ? [
        { name: 'title', objects: { _text: xmlText(data.title) } },
        { name: 'dc:creator', objects: { _text: xmlText(data.author.name) } },
      ] : undefined,
    });
  }

  return feed[serializers[format]]();
}
