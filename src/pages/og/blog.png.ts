import type { APIRoute } from 'astro';
import { renderCard } from '../../lib/blog/card';

export const GET: APIRoute = async () => new Response(
  new Uint8Array(await renderCard({ title: 'Blog', eyebrow: 'GDZig' })),
  { headers: { 'Content-Type': 'image/png' } },
);
