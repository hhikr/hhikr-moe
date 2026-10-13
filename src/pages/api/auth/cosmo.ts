import type { APIRoute } from 'astro';
import { cosmoOrigin, issueCosmoCode, validState } from '@/server/cosmo.ts';
import { sessionCookieName } from '@/server/sessions.ts';

export const prerender = false;

/**
 * Hand the endministrator over to Cosmo. The Cosmo gate sends the browser here
 * with a `state` of its own; it goes back with a one-time code. The only place
 * this ever redirects to outside the site is the configured Cosmo origin.
 */
export const GET: APIRoute = (context) => {
  const origin = cosmoOrigin();
  const state = context.url.searchParams.get('state');
  if (!origin || !validState(state)) return new Response(null, { status: 404 });

  const token = context.cookies.get(sessionCookieName())?.value;
  const code = issueCosmoCode(token);
  if (!code) {
    // Signed in as someone else: there is nothing here. Signed out: sign in first, then come back.
    if (token && context.locals.viewer.role !== 'guest') return new Response(null, { status: 404 });
    return context.redirect(`/login/?return=${encodeURIComponent(`/api/auth/cosmo?state=${state}`)}`, 302);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/auth/callback?code=${code}&state=${state}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
};
