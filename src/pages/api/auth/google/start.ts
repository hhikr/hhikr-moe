import type { APIRoute } from 'astro';
import { clientAddress, PENDING_COOKIE, pendingCookieOptions, publicOrigin, safeReturnPath } from '@/lib/http';
import { googleConfig } from '@/server/config.ts';
import { beginSignIn } from '@/server/google.ts';
import { addressKey, allow, LIMITS } from '@/server/ratelimit.ts';

export const prerender = false;

export const GET: APIRoute = (context) => {
  const config = googleConfig();
  if (!config) return new Response('Google sign-in is not configured.', { status: 503 });
  if (!allow(`login:${addressKey(clientAddress(context))}`, LIMITS.loginByAddress)) {
    return new Response('操作太频繁了，请稍后再试', { status: 429 });
  }
  const returnTo = safeReturnPath(context.url.searchParams.get('return'));
  const { url, pending } = beginSignIn(config, `${publicOrigin(context)}/api/auth/google/callback`, returnTo);
  context.cookies.set(PENDING_COOKIE, JSON.stringify(pending), pendingCookieOptions());
  return context.redirect(url, 302);
};