import type { APIRoute } from 'astro';
import { json, needSignIn, signIn } from '@/lib/http';
import { endAllSessions } from '@/server/sessions.ts';

export const prerender = false;

/** Sign out everywhere else: every session ends and this browser gets a new one. */
export const DELETE: APIRoute = (context) => {
  const user = context.locals.user;
  if (!user) return needSignIn();
  endAllSessions(user.id);
  signIn(context, user);
  return json({ ok: true });
};