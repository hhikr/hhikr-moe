import type { APIRoute } from 'astro';
import { fail, json, readJson } from '@/lib/http';
import { deleteComment, setCommentStatus } from '@/server/comments.ts';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  const { status } = await readJson(request);
  if (status !== 'visible' && status !== 'hidden') return fail('invalid', '状态不正确');
  return setCommentStatus(Number(params.id), status) ? json({ ok: true }) : fail('not_found', '评论不存在', 404);
};

export const DELETE: APIRoute = ({ params, locals }) =>
  deleteComment(Number(params.id), locals.user!) ? json({ ok: true }) : fail('not_found', '评论不存在', 404);