import type { APIRoute } from 'astro';
import { fail, failFrom, json, needSignIn } from '@/lib/http';
import { deleteComment } from '@/server/comments.ts';

export const prerender = false;

export const DELETE: APIRoute = ({ params, locals }) => {
  if (!locals.user) return needSignIn();
  try {
    return deleteComment(Number(params.id), locals.user) ? json({ ok: true }) : fail('not_found', '评论不存在', 404);
  } catch (err) {
    return failFrom(err);
  }
};