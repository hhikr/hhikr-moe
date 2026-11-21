import { SITE } from '@/site.config';
import { listProjects } from '@/server/projects.ts';
import { categoryOf, categoryUrl, getPosts, groupBy, postUrl, seriesUrl, tagUrl } from './posts';
import { catalog } from './hot100/curriculum.mjs';

// Prerendered pages. The Hot 100 lessons come from the curriculum catalog.
const lessons = catalog.map((q: { id: number }) => q.id).sort((a: number, b: number) => a - b);

const STATIC = ['/', '/about/', '/privacy/', '/posts/', '/works/', '/tags/', '/categories/', '/series/', '/hot100/', ...lessons.map((id) => `/hot100/${id}/`)];

/** Every public address. Hidden posts and drafts are never listed. */
export function sitemapEntries(): { loc: string; lastmod?: Date }[] {
  const posts = getPosts();
  const cats = new Set(posts.map((p) => categoryOf(p)?.slug).filter((s): s is string => !!s));
  return [
    ...STATIC.map((path) => ({ loc: path })),
    ...posts.map((p) => ({ loc: postUrl(p), lastmod: p.data.updated ?? p.data.date })),
    ...listProjects().map((p) => ({ loc: `/works/${p.slug}/`, lastmod: p.updatedAt })),
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
