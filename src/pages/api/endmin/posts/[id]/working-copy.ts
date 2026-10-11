import type { APIRoute } from 'astro';
import { fail, json, readJson } from '@/lib/http';
import { discardWorkingCopy, normalizeFields, saveWorkingCopy } from '@/server/posts.ts';

export const prerender = false;

/** Autosave. Keeps unsaved edits without changing what readers see. */
export const PUT: APIRoute = async ({ params, request }) => {
  const body = await readJson(request);
  if (typeof body.sourceMd !== 'string') return fail('invalid', '缺少正文');
  const savedAt = saveWorkingCopy(Number(params.id), normalizeFields(body.fields), body.sourceMd);
  return savedAt ? json({ savedAt }) : fail('not_found', '文章不存在', 404);
};

export const DELETE: APIRoute = ({ params }) => {
  discardWorkingCopy(Number(params.id));
  return json({ ok: true });
};