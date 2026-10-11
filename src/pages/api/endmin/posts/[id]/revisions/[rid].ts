import type { APIRoute } from 'astro';
import { fail, json } from '@/lib/http';
import { getRevision } from '@/server/posts.ts';

export const prerender = false;

export const GET: APIRoute = ({ params }) => {
  const revision = getRevision(Number(params.id), Number(params.rid));
  return revision ? json(revision) : fail('not_found', '找不到这个版本', 404);
};