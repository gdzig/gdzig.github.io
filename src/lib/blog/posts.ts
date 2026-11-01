import { getCollection, type CollectionEntry } from 'astro:content';
import { resolve } from 'node:path';
import { validateShareImage } from './images';
import { selectPosts, type PublicationContext } from './policy';

declare const __BLOG_BUILD_TIME__: string;

export function publicationContext(): PublicationContext {
  return {
    preview: import.meta.env.DEV,
    now: import.meta.env.DEV ? new Date() : new Date(__BLOG_BUILD_TIME__),
  };
}

export async function getBlogPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = selectPosts(await getCollection('blog'), publicationContext());
  const publicDirectory = resolve(process.cwd(), 'public');
  await Promise.all(posts.map(post => post.data.ogImage
    ? validateShareImage(post.data.ogImage, publicDirectory)
    : undefined));
  return posts;
}
