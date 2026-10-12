import type { APIRoute } from 'astro';
import { json, readJson } from '@/lib/http';
import { setModeratingFirstComments } from '@/server/comments.ts';

export const prerender = false;

export const PATCH: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (typeof body.moderateFirstComment === 'boolean') setModeratingFirstComments(body.moderateFirstComment);
  return json({ ok: true });
};