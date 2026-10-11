import { defineMiddleware } from 'astro:middleware';
import { siteOrigin } from '@/server/config.ts';
import { readSession, sessionCookieName, sessionCookieOptions } from '@/server/sessions.ts';

// Pages live at addresses ending in "/". Routing itself accepts both forms
// (trailingSlash: 'ignore') so that API routes and files work without one;
// this keeps a single canonical address for pages.
const isPage = (pathname: string) =>
  !pathname.startsWith('/api/') && !pathname.startsWith('/media/') && !/\.[a-z0-9]+$/i.test(pathname);

const isManagement = (pathname: string) => pathname.startsWith('/endmin') || pathname.startsWith('/api/endmin');

const notFound = () => new Response(null, { status: 404 });

/**
 * True when the browser says the request was made by one of our own pages.
 * In production that means the configured origin. In development the Origin
 * header is compared with the Host header, which a page on another site
 * cannot make the visitor's browser lie about.
 */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const configured = siteOrigin();
  if (configured) return origin === configured;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const method = context.request.method;
  const reading = method === 'GET' || method === 'HEAD';

  // Prerendered pages are built without a request; there is nobody to identify.
  if (context.isPrerendered) {
    context.locals.viewer = { role: 'guest' };
    return next();
  }

  if (reading && !pathname.endsWith('/') && isPage(pathname)) {
    return context.redirect(`${pathname}/${search}`, 301);
  }

  // Anything that changes state must come from our own pages. JSON requests
  // are not covered by Astro's built-in form check, so this is done here.
  if (!reading) {
    if (!sameOrigin(context.request)) {
      return new Response(JSON.stringify({ error: { code: 'bad_origin', message: '请求来源不正确' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  }

  const session = readSession(context.cookies.get(sessionCookieName())?.value);
  if (session?.renewedUntil) {
    context.cookies.set(sessionCookieName(), context.cookies.get(sessionCookieName())!.value, sessionCookieOptions(session.renewedUntil));
  }
  context.locals.user = session?.user;
  context.locals.viewer = { role: session?.user.role ?? 'guest' };

  // The management area does not exist as far as anyone else can tell.
  if (isManagement(pathname) && session?.user.role !== 'endmin') return notFound();

  const response = await next();
  // Rendered pages come back as bare `text/html`; say which encoding it is.
  if (response.headers.get('Content-Type') === 'text/html') {
    response.headers.set('Content-Type', 'text/html; charset=utf-8');
  }
  // What the endministrator sees (hidden posts, management pages) must never be cached or shared.
  if (session?.user.role === 'endmin') response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
