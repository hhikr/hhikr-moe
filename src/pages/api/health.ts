import type { APIRoute } from 'astro';

export const prerender = false;

const startedAt = Date.now();

export const GET: APIRoute = () =>
  Response.json(
    { ok: true, uptime: Math.round((Date.now() - startedAt) / 1000) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
