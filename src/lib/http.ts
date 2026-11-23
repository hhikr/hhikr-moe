// Helpers shared by the API routes.
import type { APIContext } from 'astro';
import { AuthError } from '@/server/auth.ts';
import { CommentError } from '@/server/comments.ts';
import { secureCookies, siteOrigin } from '@/server/config.ts';
import { ProjectError } from '@/server/projects.ts';
import { sessionCookieName, sessionCookieOptions, startSession } from '@/server/sessions.ts';
import type { User } from '@/server/users.ts';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const fail = (code: string, message: string, status = 400) => json({ error: { code, message } }, status);

/** Turn a thrown error into a response. Unexpected errors are logged and answered without detail. */
export function failFrom(err: unknown): Response {
  if (err instanceof AuthError) return fail(err.code, err.message, err.status);
  if (err instanceof CommentError) return fail('invalid', err.message, err.status);
  if (err instanceof ProjectError) return fail('invalid', err.message, err.status);
  console.error(err);
  return fail('server_error', '服务器出了点问题，请稍后再试', 500);
}

export async function readJson(request: Request): Promise<Record<string, any>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

/** Where the site is reachable from outside: the configured origin in production, the request's own otherwise. */
export const publicOrigin = (context: Pick<APIContext, 'url' | 'request'>) =>
  siteOrigin() ?? `http://${context.request.headers.get('host') ?? context.url.host}`;

/**
 * The visitor's address. In production every request arrives through Caddy
 * on the loopback interface, which appends the real address to X-Forwarded-For.
 */
export function clientAddress(context: Pick<APIContext, 'request' | 'clientAddress'>): string {
  let direct = 'unknown';
  try {
    direct = context.clientAddress;
  } catch {
    // Not available in some environments.
  }
  const viaProxy = direct === '127.0.0.1' || direct === '::1' || direct === '::ffff:127.0.0.1';
  const forwarded = context.request.headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  return viaProxy && forwarded ? forwarded : direct;
}

/** Only site-relative addresses are accepted as a place to return to after signing in. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) return '/';
  return value;
}

export function signIn(context: Pick<APIContext, 'cookies'>, user: User): void {
  const session = startSession(user);
  context.cookies.set(sessionCookieName(), session.token, sessionCookieOptions(session.expires));
}

/** Where a user lands after signing in: the endministrator goes to the dashboard. */
export const landingFor = (user: User, returnTo: string) => (user.role === 'endmin' ? '/endmin/' : returnTo);

/** Holds the state of a Google sign-in while the visitor is at Google. */
export const PENDING_COOKIE = 'g_pending';
export const pendingCookieOptions = () => ({
  httpOnly: true,
  secure: secureCookies(),
  // Lax so the cookie comes back when Google sends the visitor to the callback.
  sameSite: 'lax' as const,
  path: '/api/auth/google',
  maxAge: 600,
});

export const needSignIn = () => fail('signed_out', '请先登录', 401);
export const tooMany = () => fail('rate_limited', '操作太频繁了，请稍后再试', 429);

/**
 * Set while the endministrator is browsing as a guest. Readable by scripts on
 * purpose: the page shows an "exit preview" bar when it sees it. On its own it
 * grants nothing; the middleware honours it only for the endministrator.
 */
export const VIEW_AS_COOKIE = 'view_as';
export const viewAsCookieOptions = () => ({ httpOnly: false, secure: secureCookies(), sameSite: 'lax' as const, path: '/' });
