import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { AUTHOR, SITE } from '@/site.config';
import { categoryOf, getPosts, postUrl } from '@/lib/posts';

export const prerender = false;

// The feed is public: it never includes hidden posts, whoever asks.
export async function GET(context: APIContext) {
  const posts = getPosts();
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    trailingSlash: true,
    customData: `<language>zh-cn</language>`,
    items: posts.map((p) => ({
      title: p.data.title,
      link: postUrl(p),
      pubDate: p.data.date,
      description: p.data.summary,
      author: AUTHOR.name,
      categories: [categoryOf(p)?.name, ...p.data.tags].filter((x): x is string => !!x),
    })),
  });
}
