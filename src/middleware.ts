import { defineMiddleware } from 'astro:middleware';

// Pages live at addresses ending in "/". Routing itself accepts both forms
// (trailingSlash: 'ignore') so that API routes and files work without one;
// this keeps a single canonical address for pages.
const isPage = (pathname: string) =>
  !pathname.startsWith('/api/') && !pathname.startsWith('/media/') && !/\.[a-z0-9]+$/i.test(pathname);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const method = context.request.method;
  if ((method === 'GET' || method === 'HEAD') && !pathname.endsWith('/') && isPage(pathname)) {
    return context.redirect(`${pathname}/${search}`, 301);
  }
  const response = await next();
  // Rendered pages come back as bare `text/html`; say which encoding it is.
  if (response.headers.get('Content-Type') === 'text/html') {
    response.headers.set('Content-Type', 'text/html; charset=utf-8');
  }
  return response;
});
