import type { APIRoute } from 'astro';
import { clientAddress, fail, failFrom, json, readJson, signIn } from '@/lib/http';
import { register } from '@/server/auth.ts';
import { toPublic } from '@/server/users.ts';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (context.locals.user) return fail('signed_in', '已经登录了');
  try {
    const body = await readJson(context.request);
    const user = await register(
      { nickname: body.nickname, password: body.password, website: body.website, challenge: body.challenge },
      clientAddress(context),
    );
    signIn(context, user);
    return json({ user: toPublic(user) }, 201);
  } catch (err) {
    return failFrom(err);
  }
};