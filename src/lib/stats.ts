import type { Post } from './posts';

/** Word count and reading time, computed by remark-reading-time when the post was saved. */
export const readingStats = (post: Post) => ({ words: post.words, minutes: post.minutes });

export const fmtWords = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : n.toLocaleString('zh-CN'));
