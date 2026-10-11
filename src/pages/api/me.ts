import type { APIRoute } from 'astro';
import { json } from '@/lib/http';
import { toPublic } from '@/server/users.ts';

export const prerender = false;

/** The signed-in user, or null. Pages ask this after loading; the HTML itself is the same for everyone. */
export const GET: APIRoute = ({ locals }) => json({ user: locals.user ? toPublic(locals.user) : null });