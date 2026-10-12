// Append a permalink to h2–h4. Runs after rehypeHeadingIds.
// The "#" glyph comes from CSS so it never leaks into the collected heading text.
import { visit } from 'unist-util-visit';

export default function rehypeHeadingAnchors() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (!/^h[2-4]$/.test(node.tagName) || !node.properties?.id) return;
      node.children.push({
        type: 'element',
        tagName: 'a',
        properties: { href: `#${node.properties.id}`, className: ['anchor'], ariaHidden: 'true', tabIndex: -1 },
        children: [],
      });
    });
  };
}
