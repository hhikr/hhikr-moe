import type { APIRoute } from 'astro';
import { fail, failFrom, json, needSignIn, readJson, tooMany } from '@/lib/http';
import { redeemChallenge } from '@/server/challenge.ts';
import { addComment, listComments } from '@/server/comments.ts';
import { allow, LIMITS } from '@/server/ratelimit.ts';

export const prerender = false;

export const GET: APIRoute = ({ url, locals }) => {
  const result = listComments(url.searchParams.get('slug') ?? '', locals.viewer, locals.user);
  return result ? json(result) : fail('not_found', '找不到这篇文章', 404);
};

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return needSignIn();
  const body = await readJson(context.request);
  // Same trap and proof of work as registration; bots get one vague answer.
  if (body.website || !redeemChallenge(body.challenge)) return fail('challenge_failed', '验证没有通过，请刷新页面后重试');
  if (user.role !== 'endmin' && !allow(`comment:${user.id}`, LIMITS.comment)) return tooMany();
  try {
    return json({ comment: addComment({ slug: body.slug, source: body.source, parentId: body.parentId }, context.locals.viewer, user) }, 201);
  } catch (err) {
    return failFrom(err);
  }
};