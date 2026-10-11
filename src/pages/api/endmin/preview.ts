import type { APIRoute } from 'astro';
import { fail, json, readJson } from '@/lib/http';
import { renderMarkdown } from '@/server/render.ts';

export const prerender = false;

/** Render Markdown exactly as a saved post would be rendered. */
export const POST: APIRoute = async ({ request }) => {
  const { sourceMd } = await readJson(request);
  if (typeof sourceMd !== 'string') return fail('invalid', '缺少正文');
  if (sourceMd.length > 2_000_000) return fail('invalid', '正文太长了');
  const { html, words, minutes } = await renderMarkdown(sourceMd);
  return json({ html, words, minutes });
};