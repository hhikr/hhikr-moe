import type { APIRoute } from 'astro';
import { json, readJson, VIEW_AS_COOKIE, viewAsCookieOptions } from '@/lib/http';

export const prerender = false;

/** Turn "browse as a guest" on or off for the endministrator. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const { guest } = await readJson(request);
  if (guest === true) cookies.set(VIEW_AS_COOKIE, 'guest', viewAsCookieOptions());
  else cookies.delete(VIEW_AS_COOKIE, viewAsCookieOptions());
  return json({ ok: true });
};