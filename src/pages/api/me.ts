import type { APIRoute } from 'astro';
import { fail, failFrom, json, needSignIn, readJson, tooMany } from '@/lib/http';
import { deleteOwnAccount } from '@/server/auth.ts';
import { allow, LIMITS } from '@/server/ratelimit.ts';
import { sessionCookieName, sessionCookieOptions } from '@/server/sessions.ts';
import { nicknameProblem, renameUser, toSelf } from '@/server/users.ts';

export const prerender = false;

/** The signed-in user, or null. Pages ask this after loading; the HTML itself is the same for everyone. */
export const GET: APIRoute = ({ locals }) => json({ user: locals.user ? toSelf(locals.user) : null });

/** Change one's own nickname. */
export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return needSignIn();
  if (user.role === 'endmin') return fail('invalid', '这个名字是固定的');
  const { nickname } = await readJson(request);
  const problem = typeof nickname === 'string' ? nicknameProblem(nickname) : '请填写昵称';
  if (problem) return fail('invalid', problem);
  if (!allow(`rename:${user.id}`, LIMITS.rename)) return tooMany();
  try {
    return json({ user: toSelf(renameUser(user, nickname)) });
  } catch {
    return fail('invalid', '这个昵称用的人太多了，请换一个');
  }
};

/** Delete one's own account and everything it wrote. `proof` is the password, or the full name for a Google account. */
export const DELETE: APIRoute = async ({ request, locals, cookies }) => {
  const user = locals.user;
  if (!user) return needSignIn();
  try {
    await deleteOwnAccount(user, (await readJson(request)).proof);
  } catch (err) {
    return failFrom(err);
  }
  cookies.delete(sessionCookieName(), sessionCookieOptions());
  return json({ ok: true });
};
