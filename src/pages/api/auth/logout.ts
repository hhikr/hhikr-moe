import type { APIRoute } from 'astro';
import { json } from '@/lib/http';
import { endSession, sessionCookieName, sessionCookieOptions } from '@/server/sessions.ts';

export const prerender = false;

export const POST: APIRoute = ({ cookies }) => {
  endSession(cookies.get(sessionCookieName())?.value);
  cookies.delete(sessionCookieName(), sessionCookieOptions());
  return json({ ok: true });
};