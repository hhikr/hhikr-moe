// Telling a visitor's click apart from the browser fetching ahead of one.
//
// The site prefetches links on hover (astro.config.mjs). That is right for
// pages and wrong for addresses that do something when requested: starting a
// sign-in, sending a file. Those links opt out in the markup; these checks are
// for the request that arrives anyway.

type HeaderSource = Pick<Headers, 'get'>;

/** True when the browser says it is fetching ahead (`<link rel="prefetch">`, prerender). */
export function isPrefetch(headers: HeaderSource): boolean {
  const purpose = `${headers.get('sec-purpose') ?? ''} ${headers.get('purpose') ?? ''} ${headers.get('x-moz') ?? ''}`;
  return /prefetch|prerender/i.test(purpose);
}

/**
 * True when the request is the visitor going to the address: not a prefetch,
 * and not a script or a subresource. Browsers that do not say what a request
 * is for are given the benefit of the doubt.
 */
export function isNavigation(headers: HeaderSource): boolean {
  if (isPrefetch(headers)) return false;
  const dest = headers.get('sec-fetch-dest');
  return !dest || dest === 'document';
}
