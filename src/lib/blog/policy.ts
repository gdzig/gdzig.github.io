import type { BlogData } from './schema';

export type BlogPost = { id: string; data: BlogData };
export type PublicationContext = { preview: boolean; now: Date };

export function isPublished(post: BlogPost, now: Date): boolean {
  return !post.data.draft && post.data.publishedAt !== undefined && post.data.publishedAt <= now;
}

export function selectPosts<T extends BlogPost>(posts: T[], context: PublicationContext): T[] {
  return posts.filter(post => context.preview || isPublished(post, context.now)).sort((a, b) => {
    const difference = (b.data.publishedAt?.getTime() ?? -Infinity) - (a.data.publishedAt?.getTime() ?? -Infinity);
    return difference || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

const encodedId = (id: string) => id.split('/').map(encodeURIComponent).join('/');
export const postPath = (id: string): string => `/blog/${encodedId(id)}/`;
export const postCardPath = (id: string): string => `/og/blog/${encodedId(id)}.png`;
export const formatDate = (date: Date): string => new Intl.DateTimeFormat('en', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
}).format(date);
