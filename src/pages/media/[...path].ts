// Serves files from the media store. In production Caddy answers /media/*
// straight from disk and this route is only a fallback; in development it is
// the only thing serving them.
import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { dataPath } from '@/server/config.ts';

export const prerender = false;

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  avif: 'image/avif',
};

export const GET: APIRoute = ({ params }) => {
  const rel = params.path ?? '';
  // Only the store's own naming scheme is accepted, which also rules out path traversal.
  if (!/^[0-9a-f]{2}\/[0-9a-f]{64}(\.[a-z0-9]+){1,2}$/.test(rel)) return new Response(null, { status: 404 });
  const file = dataPath('media', rel);
  if (!fs.existsSync(file)) return new Response(null, { status: 404 });
  const type = TYPES[path.extname(file).slice(1)];
  return new Response(fs.readFileSync(file), {
    headers: {
      'Content-Type': type ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // Anything that is not a plain raster image is downloaded, never rendered.
      ...(type ? {} : { 'Content-Disposition': 'attachment' }),
    },
  });
};
