export const FEED_FORMATS = [
  { id: 'rss', path: '/rss.xml', type: 'application/rss+xml', title: 'GDZig Blog RSS Feed' },
  { id: 'atom', path: '/atom.xml', type: 'application/atom+xml', title: 'GDZig Blog Atom Feed' },
  { id: 'json', path: '/feed.json', type: 'application/feed+json', title: 'GDZig Blog JSON Feed' },
] as const;
