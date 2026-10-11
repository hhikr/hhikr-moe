import type { APIRoute } from 'astro';
import { fail, json, needSignIn, tooMany } from '@/lib/http';
import { MAX_UPLOAD_BYTES, saveAvatar } from '@/server/avatars.ts';
import { allow, LIMITS } from '@/server/ratelimit.ts';
import { setAvatar, toSelf, userById } from '@/server/users.ts';

export const prerender = false;

/** Upload a profile picture. The request body is the image itself. */
export const PUT: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return needSignIn();
  // Refuse oversized uploads before reading them.
  if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES) return fail('too_large', '图片太大了', 413);
  if (!allow(`avatar:${user.id}`, LIMITS.avatar)) return tooMany();
  const body = Buffer.from(await request.arrayBuffer());
  try {
    setAvatar(user.id, await saveAvatar(body));
  } catch (err) {
    return fail('invalid', err instanceof Error ? err.message : '图片无法处理');
  }
  return json({ user: toSelf(userById(user.id)!) });
};

export const DELETE: APIRoute = ({ locals }) => {
  if (!locals.user) return needSignIn();
  setAvatar(locals.user.id, null);
  return json({ user: toSelf(userById(locals.user.id)!) });
};