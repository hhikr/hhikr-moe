import type { APIRoute } from 'astro';
import { landingFor, PENDING_COOKIE, pendingCookieOptions, publicOrigin, safeReturnPath, signIn } from '@/lib/http';
import { AuthError, signInWithGoogle } from '@/server/auth.ts';
import { googleConfig } from '@/server/config.ts';
import { completeSignIn, type PendingSignIn } from '@/server/google.ts';
import { safeEqual } from '@/server/secrets.ts';

export const prerender = false;

const failed = (context: Parameters<APIRoute>[0], reason: string) => context.redirect(`/login/?error=${reason}`, 302);

export const GET: APIRoute = async (context) => {
  const config = googleConfig();
  const raw = context.cookies.get(PENDING_COOKIE)?.value;
  context.cookies.delete(PENDING_COOKIE, pendingCookieOptions());
  if (!config || !raw) return failed(context, 'expired');

  let pending: PendingSignIn;
  try {
    pending = JSON.parse(raw);
  } catch {
    return failed(context, 'expired');
  }
  const params = context.url.searchParams;
  const state = params.get('state') ?? '';
  const code = params.get('code');
  if (typeof pending.state !== 'string' || !safeEqual(state, pending.state)) return failed(context, 'expired');
  // The visitor pressed "cancel" on Google's page.
  if (!code) return failed(context, 'cancelled');

  try {
    const profile = await completeSignIn(config, `${publicOrigin(context)}/api/auth/google/callback`, pending, code);
    const user = signInWithGoogle(profile);
    signIn(context, user);
    return context.redirect(landingFor(user, safeReturnPath(pending.returnTo)), 302);
  } catch (err) {
    if (err instanceof AuthError && err.code === 'banned') return failed(context, 'banned');
    console.error('Google sign-in failed:', err instanceof Error ? err.message : err);
    return failed(context, 'google');
  }
};