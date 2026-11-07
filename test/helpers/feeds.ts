import { xml2js, type ElementCompact } from 'xml-js';

export const formats = [
  { id: 'rss', path: '/rss.xml', type: 'application/rss+xml' },
  { id: 'atom', path: '/atom.xml', type: 'application/atom+xml' },
  { id: 'json', path: '/feed.json', type: 'application/feed+json' },
] as const;
export type Format = typeof formats[number]['id'];

const list = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = (node?: ElementCompact): string => node ? list(node._text ?? node._cdata).join('') : '';

export type FeedEntry = {
  id: string; url: string; title: string; summary: string; content: string;
  author: string; authorUrl?: string; published: string; updated?: string; tags: string[];
};

export function parseFeed(body: string, format: Format): {
  title: string; url: string; self: string; updated?: string; entries: FeedEntry[];
} {
  if (format === 'json') {
    const feed = JSON.parse(body);
    if (feed.version !== 'https://jsonfeed.org/version/1') throw new Error('Unexpected JSON Feed version.');
    return {
      title: feed.title, url: feed.home_page_url, self: feed.feed_url,
      entries: feed.items.map((item: Record<string, any>) => ({
        id: item.id, url: item.url, title: item.title, summary: item.summary, content: item.content_html,
        author: item.author?.name, authorUrl: item.author?.url, published: item.date_published,
        updated: item.date_modified, tags: item.tags ?? [],
      })),
    };
  }
  const document = xml2js(body, { compact: true }) as ElementCompact;
  if (format === 'rss') {
    if (document.rss?._attributes?.version !== '2.0') throw new Error('Unexpected RSS version.');
    const channel = document.rss.channel;
    return {
      title: text(channel.title), url: text(channel.link),
      self: list<ElementCompact>(channel['atom:link']).find(link => link._attributes?.rel === 'self')?._attributes?.href as string,
      updated: new Date(text(channel.lastBuildDate)).toISOString(),
      entries: list<ElementCompact>(channel.item).map(item => ({
        id: text(item.guid), url: text(item.link), title: text(item.title), summary: text(item.description),
        content: text(item['content:encoded']), author: text(item['dc:creator']) || text(list<ElementCompact>(item.author)[0]),
        published: new Date(text(item.pubDate)).toISOString(), tags: list<ElementCompact>(item.category).map(text),
      })),
    };
  }
  const feed = document.feed;
  if (feed?._attributes?.xmlns !== 'http://www.w3.org/2005/Atom') throw new Error('Unexpected Atom namespace.');
  return {
    title: text(feed.title), url: list<ElementCompact>(feed.link).find(link => link._attributes?.rel === 'alternate')?._attributes?.href as string,
    self: list<ElementCompact>(feed.link).find(link => link._attributes?.rel === 'self')?._attributes?.href as string,
    updated: text(feed.updated),
    entries: list<ElementCompact>(feed.entry).map(item => ({
      id: text(item.id), url: list<ElementCompact>(item.link)[0]?._attributes?.href as string,
      title: text(item.title), summary: text(item.summary), content: text(item.content),
      author: text(list<ElementCompact>(item.author)[0]?.name), authorUrl: text(list<ElementCompact>(item.author)[0]?.uri) || undefined,
      published: text(item.published), updated: text(item.updated),
      tags: list<ElementCompact>(item.category).map(category => category._attributes?.term as string),
    })),
  };
}

/** Read feed HTML as a reader would, checking text independently of its encoding. */
export async function inspectHtml(html: string) {
  let value = '';
  const elements: { tag: string; href: string | null }[] = [];
  await new HTMLRewriter().on('*', {
    element(element) { elements.push({ tag: element.tagName, href: element.getAttribute('href') }); },
    text(chunk) { value += chunk.text; },
  }).transform(new Response(`<div>${html}</div>`)).text();
  // Bun's HTMLRewriter text API preserves entities rather than decoding them.
  value = value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, key: string) => {
    if (key[0] === '#') return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10));
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[key] ?? match;
  });
  return { text: value, elements };
}
