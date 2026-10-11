import type { APIRoute } from 'astro';
import { fail, json, readJson } from '@/lib/http';
import { deletePost, fieldsProblem, getEditablePost, normalizeFields, setPostState, writePost } from '@/server/posts.ts';
import { scheduleSearchRebuild } from '@/server/search.ts';

export const prerender = false;

/** Publish, withdraw to draft, hide or unhide, without touching the text. */
export const PATCH: APIRoute = async ({ params, request }) => {
  const { status, hidden } = await readJson(request);
  if (!setPostState(Number(params.id), { status, hidden })) return fail('not_found', '文章不存在，或没有可改的内容', 404);
  // What guests can read has changed, so the search index must follow.
  scheduleSearchRebuild();
  return json({ ok: true });
};

/** Save the editor's content as the post. `status` says whether it is (or stays) published. */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const existing = getEditablePost(id);
  if (!existing) return fail('not_found', '文章不存在', 404);
  const body = await readJson(request);
  if (typeof body.sourceMd !== 'string') return fail('invalid', '缺少正文');
  if (body.status !== 'draft' && body.status !== 'published') return fail('invalid', '状态不正确');
  const fields = normalizeFields(body.fields);
  const problem = fieldsProblem(id, fields);
  if (problem) return fail('invalid', problem);
  await writePost(id, fields, body.sourceMd, body.status);
  if (body.status === 'published' || existing.status === 'published') scheduleSearchRebuild();
  return json({ ok: true, slug: fields.slug, status: body.status });
};

export const DELETE: APIRoute = ({ params }) => {
  if (!deletePost(Number(params.id))) return fail('not_found', '文章不存在', 404);
  scheduleSearchRebuild();
  return json({ ok: true });
};