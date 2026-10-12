import type { APIRoute } from 'astro';
import { clientAddress, failFrom, json, readJson, signIn } from '@/lib/http';
import { signInWithPassword } from '@/server/auth.ts';
import { toSelf } from '@/server/users.ts';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const body = await readJson(context.request);
    const user = await signInWithPassword(body.handle, body.password, clientAddress(context));
    signIn(context, user);
    return json({ user: toSelf(user) });
  } catch (err) {
    return failFrom(err);
  }
};