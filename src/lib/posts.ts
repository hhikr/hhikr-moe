import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, SITE } from '@/site.config';

export type Post = CollectionEntry<'posts'>;

const visible = (p: Post) => import.meta.env.DEV || SITE.showDrafts || !p.data.draft;

/** All visible posts, newest first. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', visible);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const postUrl = (p: Post) => `/posts/${p.id}/`;

/** Same rules as Hugo's urlize so old links keep working. */
export const slugify = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-');

export const tagUrl = (t: string) => `/tags/${slugify(t)}/`;
export const seriesUrl = (s: string) => `/series/${slugify(s)}/`;

export function categoryOf(p: Post) {
  const key = p.data.category;
  return key ? { key, ...(CATEGORIES[key] ?? { name: key, slug: slugify(key), en: key, description: '' }) } : undefined;
}

export const categoryUrl = (slug: string) => `/categories/${slug}/`;

export function groupBy<T>(items: T[], key: (item: T) => string | string[] | undefined) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    for (const one of Array.isArray(k) ? k : k ? [k] : []) {
      map.set(one, [...(map.get(one) ?? []), item]);
    }
  }
  return map;
}

/** Posts of a series in reading order: numbered chapters first, then the rest by date. */
export function sortSeries(posts: Post[]) {
  return [...posts].sort((a, b) => {
    const ao = a.data.seriesOrder ?? Infinity;
    const bo = b.data.seriesOrder ?? Infinity;
    return ao !== bo ? ao - bo : a.data.date.valueOf() - b.data.date.valueOf();
  });
}

/** Display name for a series: drop the "笔记-" prefix used in front matter. */
export const seriesName = (s: string) => s.replace(/^笔记-/, '');

export function relatedPosts(post: Post, all: Post[], limit = 3) {
  const tags = new Set(post.data.tags);
  return all
    .filter((p) => p.id !== post.id)
    .map((p) => ({
      p,
      score:
        p.data.tags.filter((t) => tags.has(t)).length +
        (p.data.series && p.data.series === post.data.series ? 2 : 0) +
        (p.data.category === post.data.category ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.data.date.valueOf() - a.p.data.date.valueOf())
    .slice(0, limit)
    .map((x) => x.p);
}

// Dates are shown in the author's timezone regardless of where the site is built.
const parts = (d: Date) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, day] = f.format(d).split('-');
  return { y, m, d: day };
};
export const fmtDate = (d: Date) => {
  const p = parts(d);
  return `${p.y}.${p.m}.${p.d}`;
};
export const fmtShort = (d: Date) => {
  const p = parts(d);
  return `${p.m}.${p.d}`;
};
export const yearOf = (d: Date) => parts(d).y;
export const isoDay = (d: Date) => {
  const p = parts(d);
  return `${p.y}-${p.m}-${p.d}`;
};
