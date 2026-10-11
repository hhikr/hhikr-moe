// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { unified } from '@astrojs/markdown-remark';
import { rehypePlugins, remarkPlugins, shikiConfig } from './src/markdown/pipeline.mjs';

export default defineConfig({
  site: 'https://hhikr.moe',
  // Pages are redirected to their trailing-slash address in src/middleware.ts;
  // API routes and files answer without one.
  trailingSlash: 'ignore',
  // Pages stay prerendered unless they opt out with `export const prerender = false`.
  adapter: node({ mode: 'standalone' }),
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: {
    processor: unified({ smartypants: false, remarkPlugins, rehypePlugins }),
    shikiConfig,
  },
});
