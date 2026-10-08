import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { AUTHOR, SITE } from '@/site.config';
import { categoryOf, getPosts, postUrl } from '@/lib/posts';

export async function GET(context: APIContext) {
  const posts = (await getPosts()).filter((p) => !p.data.draft);
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
