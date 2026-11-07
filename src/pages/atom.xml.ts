import type { APIContext } from 'astro';
import { feedResponse } from '../lib/blog/feed-response';

export function GET(context: APIContext): Promise<Response> {
  return feedResponse(context.site, 'atom');
}
