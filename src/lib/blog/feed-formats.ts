export const FEED_FORMATS = [
  { path: '/rss.xml', type: 'application/rss+xml', title: 'GDZig Blog RSS Feed' },
  { path: '/atom.xml', type: 'application/atom+xml', title: 'GDZig Blog Atom Feed' },
  { path: '/feed.json', type: 'application/feed+json', title: 'GDZig Blog JSON Feed' },
] as const;
