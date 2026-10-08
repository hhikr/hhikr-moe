import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  // Each post is a page bundle: posts/<slug>/index.md(x) with its images next to it.
  loader: glob({
    base: './src/content/posts',
    pattern: '**/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.mdx?$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      summary: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).default([]),
      series: z.string().optional(),
      seriesOrder: z.number().optional(),
      cover: image().optional(),
      draft: z.boolean().default(false),
      pinned: z.boolean().default(false),
      comments: z.boolean().default(true),
    }),
});

export const collections = { posts };
