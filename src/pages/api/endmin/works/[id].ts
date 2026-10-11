import type { APIRoute } from 'astro';
import { fail, failFrom, json, readJson } from '@/lib/http';
import { deleteProject, normalizeProject, saveProject, setProjectHidden } from '@/server/projects.ts';
import { scheduleSearchRebuild } from '@/server/search.ts';

export const prerender = false;

/** Save the work's page: name, address, text, links, pictures, related post. */
export const PUT: APIRoute = async ({ params, request }) => {
  const input = normalizeProject(await readJson(request));
  try {
    await saveProject(Number(params.id), input);
  } catch (err) {
    return failFrom(err);
  }
  scheduleSearchRebuild();
  return json({ ok: true, slug: input.slug });
};

/** Show or hide the work without touching anything else. */
export const PATCH: APIRoute = async ({ params, request }) => {
  const { hidden } = await readJson(request);
  if (typeof hidden !== 'boolean' || !setProjectHidden(Number(params.id), hidden)) return fail('not_found', '作品不存在', 404);
  scheduleSearchRebuild();
  return json({ ok: true });
};

export const DELETE: APIRoute = ({ params }) => {
  if (!deleteProject(Number(params.id))) return fail('not_found', '作品不存在', 404);
  scheduleSearchRebuild();
  return json({ ok: true });
};
