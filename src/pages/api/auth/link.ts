import type { APIRoute } from 'astro';
import { clientAddress, signIn } from '@/lib/http';
import { redeemLoginLink } from '@/server/auth.ts';

export const prerender = false;

/** One-time sign-in link printed by scripts/endmin-login-link.mjs, for when Google cannot be reached. */
export const GET: APIRoute = (context) => {
  try {
    const user = redeemLoginLink(context.url.searchParams.get('token') ?? '', clientAddress(context));
    signIn(context, user);
    return context.redirect('/endmin/', 302);
  } catch {
    return context.redirect('/login/?error=link', 302);
  }
};