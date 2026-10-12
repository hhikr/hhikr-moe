// Open off-site links in a new tab and mark them for styling.
import { visit } from 'unist-util-visit';

const SITE = 'hhikr.moe';

export default function rehypeExternalLinks() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return;
      const href = String(node.properties?.href ?? '');
      if (!/^(https?:)?\/\//.test(href)) return;
      try {
        if (new URL(href, `https://${SITE}`).hostname.endsWith(SITE)) return;
      } catch {
        return;
      }
      node.properties.target = '_blank';
      node.properties.rel = ['noopener', 'noreferrer'];
      node.properties.className = [...(node.properties.className ?? []), 'external'];
    });
  };
}
