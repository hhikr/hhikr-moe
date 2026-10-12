import type { APIRoute } from 'astro';
import { clientAddress, json, publicOrigin, readJson } from '@/lib/http';
import { sitemapEntries } from '@/lib/sitemap';
import { postIdBySlug } from '@/server/posts.ts';
import { addressKey, allow, LIMITS } from '@/server/ratelimit.ts';
import { postViews, recordHit } from '@/server/stats.ts';

export const prerender = false;

const readable = (pathname: string) => {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
};

// The addresses a guest can open, refreshed every few seconds. Only these are
// counted, so nobody can fill the statistics with made-up paths.
let paths: Set<string> | undefined;
let pathsAt = 0;
function publicPaths(): Set<string> {
  if (!paths || Date.now() - pathsAt > 15_000) {
    paths = new Set(sitemapEntries().map((e) => readable(new URL(e.loc).pathname)));
    pathsAt = Date.now();
  }
  return paths;
}

const nothing = () => new Response(null, { status: 204 });

/** Count one page view. For a post the reply carries how often it has been read. */
export const POST: APIRoute = async (context) => {
  const body = await readJson(context.request);
  const path = typeof body.path === 'string' && body.path.length <= 300 ? readable(body.path) : '';
  const address = clientAddress(context);

  // The endministrator's own visits are not counted, also while browsing as a guest.
  if (!context.locals.endmin && publicPaths().has(path) && allow(`hit:${addressKey(address)}`, LIMITS.hit)) {
    recordHit({
      path,
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 300) : undefined,
      userAgent: context.request.headers.get('user-agent') ?? '',
      address,
      ownHost: new URL(publicOrigin(context)).hostname,
    });
  }

  const slug = /^\/posts\/([^/]+)\/$/.exec(path)?.[1];
  const postId = slug ? postIdBySlug(slug, context.locals.viewer) : undefined;
  return postId ? json({ views: postViews(postId) }) : nothing();
};
