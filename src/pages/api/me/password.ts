import type { APIRoute } from 'astro';
import { failFrom, json, needSignIn, readJson, signIn } from '@/lib/http';
import { changePassword } from '@/server/auth.ts';

export const prerender = false;

/** Change one's own password. Every other browser is signed out; this one stays signed in. */
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return needSignIn();
  const { current, next } = await readJson(context.request);
  try {
    await changePassword(user, current, next);
  } catch (err) {
    return failFrom(err);
  }
  signIn(context, user);
  return json({ ok: true });
};