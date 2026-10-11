import type { APIRoute } from 'astro';
import { json } from '@/lib/http';
import { createDraft } from '@/server/posts.ts';

export const prerender = false;

/** Start a new draft. */
export const POST: APIRoute = () => json({ id: createDraft() }, 201);