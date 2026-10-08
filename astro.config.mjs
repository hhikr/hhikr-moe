// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified, rehypeHeadingIds } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkCallouts from './src/plugins/remark-callouts.mjs';
import remarkSpoiler from './src/plugins/remark-spoiler.mjs';
import remarkReadingTime from './src/plugins/remark-reading-time.mjs';
import rehypeFigure from './src/plugins/rehype-figure.mjs';
import rehypeExternalLinks from './src/plugins/rehype-external-links.mjs';
import rehypeHeadingAnchors from './src/plugins/rehype-heading-anchors.mjs';

export default defineConfig({
  site: 'https://hhikr.moe',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: {
    processor: unified({
      smartypants: false,
      remarkPlugins: [remarkMath, remarkCallouts, remarkSpoiler, remarkReadingTime],
      rehypePlugins: [
        [rehypeKatex, { strict: false, throwOnError: false }],
        rehypeFigure,
        rehypeExternalLinks,
        rehypeHeadingIds,
        rehypeHeadingAnchors,
      ],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      wrap: false,
      langAlias: { C: 'c', Java: 'java', pseudo: 'txt' },
    },
  },
});
