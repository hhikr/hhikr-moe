// Serves profile pictures in development. In production Caddy answers
// /avatars/* straight from the data directory.
import fs from 'node:fs';
import type { APIRoute } from 'astro';
import { dataPath } from '@/server/config.ts';

export const prerender = false;

export const GET: APIRoute = ({ params }) => {
  const name = params.file ?? '';
  if (!/^[0-9a-f]{64}\.webp$/.test(name)) return new Response(null, { status: 404 });
  const file = dataPath('avatars', name);
  if (!fs.existsSync(file)) return new Response(null, { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
};