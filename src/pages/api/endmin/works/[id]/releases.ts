import type { APIRoute } from 'astro';
import { failFrom, json, readJson } from '@/lib/http';
import { addRelease } from '@/server/projects.ts';
import { scheduleSearchRebuild } from '@/server/search.ts';

export const prerender = false;

/** Add a version to a work. Files are uploaded to it afterwards. */
export const POST: APIRoute = async ({ params, request }) => {
  const body = await readJson(request);
  try {
    const id = await addRelease(Number(params.id), { version: body.version, notesMd: body.notesMd });
    scheduleSearchRebuild();
    return json({ id }, 201);
  } catch (err) {
    return failFrom(err);
  }
};
