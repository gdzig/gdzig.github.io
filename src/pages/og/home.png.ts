import type { APIRoute } from 'astro';
import { renderCardResponse } from '../../lib/blog/card';

export const GET: APIRoute = async () => renderCardResponse({
  eyebrow: 'GDZig',
  title: 'Idiomatic Zig bindings for Godot 4',
});
