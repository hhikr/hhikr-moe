// Server-side Markdown rendering with the same plugin chain the static build used.
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { visit } from 'unist-util-visit';
import { rehypePlugins, remarkPlugins, shikiConfig } from '../markdown/pipeline.mjs';
import { findMedia, shaFromUrl } from './media.ts';

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface Rendered {
  html: string;
  headings: Heading[];
  words: number;
  minutes: number;
}

/** Give images from the media store their dimensions so the page does not jump while loading. */
function rehypeMediaImages() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName !== 'img') return;
      const { src, alt, ...rest } = node.properties ?? {};
      const sha = typeof src === 'string' ? shaFromUrl(src) : undefined;
      const media = sha ? findMedia(sha) : undefined;
      node.properties = {
        alt: alt ?? '',
        loading: 'lazy',
        decoding: 'async',
        ...(media?.width && media.height ? { width: media.width, height: media.height } : {}),
        ...rest,
        src,
      };
    });
  };
}

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

export async function renderMarkdown(source: string): Promise<Rendered> {
  processor ??= createMarkdownProcessor({
    shikiConfig: shikiConfig as any,
    remarkPlugins: remarkPlugins as any,
    rehypePlugins: [...rehypePlugins, rehypeMediaImages] as any,
    smartypants: false,
  });
  const result = await (await processor).render(source);
  const fm = result.metadata.frontmatter ?? {};
  return {
    html: result.code,
    headings: result.metadata.headings.map(({ depth, slug, text }) => ({ depth, slug, text })),
    words: Number(fm.words ?? 0),
    minutes: Number(fm.minutes ?? 1),
  };
}
