import { SITE } from '@/site.config';
import { categoryOf, categoryUrl, getPosts, groupBy, postUrl, seriesUrl, tagUrl } from './posts';

// Prerendered pages. The Hot 100 lessons are discovered from their source files.
const lessons = Object.keys(import.meta.glob('../pages/hot100/*.astro'))
  .map((file) => /\/(\d+)\.astro$/.exec(file)?.[1])
  .filter((id): id is string => !!id)
  .sort((a, b) => Number(a) - Number(b));

const STATIC = ['/', '/about/', '/posts/', '/tags/', '/categories/', '/series/', '/hot100/', ...lessons.map((id) => `/hot100/${id}/`)];

/** Every public address. Hidden posts and drafts are never listed. */
export function sitemapEntries(): { loc: string; lastmod?: Date }[] {
  const posts = getPosts();
  const cats = new Set(posts.map((p) => categoryOf(p)?.slug).filter((s): s is string => !!s));
  return [
    ...STATIC.map((path) => ({ loc: path })),
    ...posts.map((p) => ({ loc: postUrl(p), lastmod: p.data.updated ?? p.data.date })),
    ...[...groupBy(posts, (p) => p.data.tags).keys()].map((t) => ({ loc: tagUrl(t) })),
    ...[...cats].map((slug) => ({ loc: categoryUrl(slug) })),
    ...[...groupBy(posts, (p) => p.data.series).keys()].map((s) => ({ loc: seriesUrl(s) })),
  ].map((e) => ({ ...e, loc: new URL(e.loc, SITE.url).href }));
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-cache' },
  });

export const urlset = () =>
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapEntries()
    .map((e) => `<url><loc>${escape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}</url>`)
    .join('')}</urlset>`;

export const sitemapIndex = () =>
  `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${new URL('/sitemap-0.xml', SITE.url).href}</loc></sitemap></sitemapindex>`;
