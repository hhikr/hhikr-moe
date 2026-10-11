import type { APIRoute } from 'astro';
import { fail, failFrom, json, readJson } from '@/lib/http';
import { deleteRelease, updateRelease } from '@/server/projects.ts';
import { scheduleSearchRebuild } from '@/server/search.ts';

export const prerender = false;

/** Change a version's number or its notes. */
export const PATCH: APIRoute = async ({ params, request }) => {
  const body = await readJson(request);
  try {
    await updateRelease(Number(params.id), { version: body.version, notesMd: body.notesMd });
  } catch (err) {
    return failFrom(err);
  }
  scheduleSearchRebuild();
  return json({ ok: true });
};

/** Remove a version together with its files. */
export const DELETE: APIRoute = ({ params }) => {
  if (!deleteRelease(Number(params.id))) return fail('not_found', '版本不存在', 404);
  scheduleSearchRebuild();
  return json({ ok: true });
};
