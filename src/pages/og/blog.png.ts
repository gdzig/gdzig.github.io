import type { APIRoute } from 'astro';
import { renderCardResponse } from '../../lib/blog/card';

export const GET: APIRoute = async () => renderCardResponse({ title: 'Blog', eyebrow: 'GDZig' });
