import type { APIRoute } from 'astro';
import { getBlogPosts } from '../../../lib/blog/posts';
import { formatDate } from '../../../lib/blog/policy';
import { renderCard } from '../../../lib/blog/card';

export async function getStaticPaths() {
  return (await getBlogPosts()).filter(post => !post.data.ogImage).map(post => ({
    params: { slug: post.id },
    props: { input: {
      title: post.data.title,
      eyebrow: post.data.publishedAt ? formatDate(post.data.publishedAt) : 'Draft preview',
      author: post.data.author.name,
    } },
  }));
}

export const GET: APIRoute = async ({ props }) => new Response(
  new Uint8Array(await renderCard(props.input)),
  { headers: { 'Content-Type': 'image/png' } },
);
