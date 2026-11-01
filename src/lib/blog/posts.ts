import { getCollection, type CollectionEntry } from 'astro:content';
import { selectPosts, type PublicationContext } from './policy';

declare const __BLOG_BUILD_TIME__: string;

export function publicationContext(): PublicationContext {
  return {
    preview: import.meta.env.DEV,
    now: import.meta.env.DEV ? new Date() : new Date(__BLOG_BUILD_TIME__),
  };
}

export async function getBlogPosts(): Promise<CollectionEntry<'blog'>[]> {
  return selectPosts(await getCollection('blog'), publicationContext());
}
