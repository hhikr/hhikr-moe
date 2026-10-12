import type { APIRoute } from 'astro';
import { json } from '@/lib/http';
import { createProject } from '@/server/projects.ts';

export const prerender = false;

/** Start a new, hidden work and say where to edit it. */
export const POST: APIRoute = () => json({ id: createProject() }, 201);
