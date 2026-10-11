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
  // src/middleware.ts checks the Origin of every request that is not a GET.
  // Astro's own check covers only form-like requests and, behind the proxy,
  // compares against the wrong origin, so it would reject legitimate ones.
  security: { checkOrigin: false },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Small scripts would otherwise be written into the page itself, where the
  // content security policy (src/lib/csp.ts) refuses to run them.
  vite: { build: { assetsInlineLimit: 0 } },
  markdown: {
    processor: unified({ smartypants: false, remarkPlugins, rehypePlugins }),
    shikiConfig,
  },
});
