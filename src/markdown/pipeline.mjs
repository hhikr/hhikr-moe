// The Markdown plugin chain, shared by astro.config.mjs and the server-side
// renderer in src/server/render.ts so both produce the same HTML.
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkCallouts from '../plugins/remark-callouts.mjs';
import remarkSpoiler from '../plugins/remark-spoiler.mjs';
import remarkReadingTime from '../plugins/remark-reading-time.mjs';
import rehypeFigure from '../plugins/rehype-figure.mjs';
import rehypeExternalLinks from '../plugins/rehype-external-links.mjs';
import rehypeHeadingAnchors from '../plugins/rehype-heading-anchors.mjs';

/** @type {any[]} */
export const remarkPlugins = [remarkMath, remarkCallouts, remarkSpoiler, remarkReadingTime];

/** @type {any[]} */
export const rehypePlugins = [
  [rehypeKatex, { strict: false, throwOnError: false }],
  rehypeFigure,
  rehypeExternalLinks,
  rehypeHeadingIds,
  rehypeHeadingAnchors,
];

/** @type {any} */
export const shikiConfig = {
  themes: { light: 'github-light', dark: 'github-dark-dimmed' },
  wrap: false,
  langAlias: { C: 'c', Java: 'java', pseudo: 'txt' },
};
