import { render } from 'astro:content';
import type { Post } from './posts';

const cache = new Map<string, { words: number; minutes: number }>();

/** Word count and reading time, computed by remark-reading-time during render. */
export async function readingStats(post: Post) {
  const hit = cache.get(post.id);
  if (hit) return hit;
  const { remarkPluginFrontmatter: fm } = await render(post);
  const stats = { words: Number(fm.words ?? 0), minutes: Number(fm.minutes ?? 1) };
  cache.set(post.id, stats);
  return stats;
}

export const fmtWords = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : n.toLocaleString('zh-CN'));
