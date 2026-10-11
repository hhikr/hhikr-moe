import type { APIRoute } from 'astro';
import { fail, json, readJson } from '@/lib/http';
import { commentProblem, renderBBCode } from '@/server/bbcode.ts';

export const prerender = false;

/** Render BBCode without saving it. Open to guests so they can preview before being asked to sign in. */
export const POST: APIRoute = async ({ request }) => {
  const { source } = await readJson(request);
  const problem = commentProblem(source);
  return problem ? fail('invalid', problem) : json({ html: renderBBCode(source) });
};