import type { APIRoute } from 'astro';
import { fail, json, readJson } from '@/lib/http';
import { setPostState } from '@/server/posts.ts';
import { scheduleSearchRebuild } from '@/server/search.ts';

export const prerender = false;

/** Publish, withdraw to draft, hide or unhide. */
export const PATCH: APIRoute = async ({ params, request }) => {
  const { status, hidden } = await readJson(request);
  if (!setPostState(Number(params.id), { status, hidden })) return fail('not_found', '文章不存在，或没有可改的内容', 404);
  // What guests can read has changed, so the search index must follow.
  scheduleSearchRebuild();
  return json({ ok: true });
};