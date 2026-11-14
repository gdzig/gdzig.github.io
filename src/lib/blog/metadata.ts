import type { ShareImage } from './images';
import { isPublished, postCardPath, postPath, type BlogPost, type PublicationContext } from './policy';

export type HeadMeta = { property: string; content: string } | { name: string; content: string };
export type BlogHeadData = {
  title: string;
  description: string;
  canonical: string;
  meta: HeadMeta[];
  jsonLd?: Record<string, unknown>;
};

type HeadMetadataInput = {
  title: string,
  description: string,
  canonical: string,
  image: ShareImage,
  type: 'article' | 'website',
  documentTitle?: string,
};

export function headMetadata({
  title,
  description,
  canonical,
  image,
  type,
  documentTitle = `${title} | GDZig`,
}: HeadMetadataInput): BlogHeadData {
  const property = (property: string, content: string): HeadMeta => ({ property, content });
  const name = (name: string, content: string): HeadMeta => ({ name, content });
  return {
    title: documentTitle, description, canonical,
    meta: [
      property('og:title', title), property('og:description', description),
      property('og:site_name', 'GDZig'), property('og:locale', 'en_US'),
      property('og:type', type), property('og:url', canonical),
      property('og:image', image.src), property('og:image:secure_url', image.src),
      property('og:image:alt', image.alt), property('og:image:width', String(image.width)),
      property('og:image:height', String(image.height)), property('og:image:type', image.type),
      name('twitter:card', 'summary_large_image'), name('twitter:title', title),
      name('twitter:description', description), name('twitter:image', image.src),
      name('twitter:image:alt', image.alt),
    ],
  };
}

export function postMetadata(post: BlogPost, site: URL, context: PublicationContext): BlogHeadData {
  const { data } = post;
  const image: ShareImage = data.ogImage
    ? { ...data.ogImage, src: new URL(data.ogImage.src, site).href }
    : { src: new URL(postCardPath(post.id), site).href, alt: `GDZig: ${data.title}`, width: 1200, height: 630, type: 'image/png' };
  const canonical = data.source?.url ?? new URL(postPath(post.id), site).href;
  const publishedAt = data.source?.publishedAt ?? data.publishedAt;
  const head = headMetadata({
    title: data.title,
    description: data.description,
    canonical,
    image,
    type: 'article',
  });
  head.meta.push({ name: 'author', content: data.author.name });
  if (data.author.url) head.meta.push({ property: 'article:author', content: data.author.url });
  for (const tag of data.tags) head.meta.push({ property: 'article:tag', content: tag });
  if (data.section) head.meta.push({ property: 'article:section', content: data.section });
  if (publishedAt) head.meta.push({ property: 'article:published_time', content: publishedAt.toISOString() });
  if (data.updatedAt) head.meta.push({ property: 'article:modified_time', content: data.updatedAt.toISOString() });

  if (!isPublished(post, context.now)) {
    head.meta.push({ name: 'robots', content: 'noindex' });
  } else {
    head.jsonLd = {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: data.title, description: data.description,
      url: canonical, mainEntityOfPage: canonical,
      datePublished: publishedAt?.toISOString(), dateModified: data.updatedAt?.toISOString(),
      author: { '@type': 'Person', name: data.author.name, url: data.author.url },
      publisher: { '@type': 'Organization', name: 'GDZig', url: site.href },
      image: { '@type': 'ImageObject', url: image.src, width: image.width, height: image.height },
      keywords: data.tags,
    };
  }
  return head;
}

export function indexMetadata(site: URL): BlogHeadData {
  return headMetadata({
    title: 'Blog',
    description: 'Release notes and project updates for GDZig.',
    canonical: new URL('/blog/', site).href,
    image: {
      src: new URL('/og/blog.png', site).href,
      alt: 'GDZig blog',
      width: 1200,
      height: 630,
      type: 'image/png',
    },
    type: 'website',
  });
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
