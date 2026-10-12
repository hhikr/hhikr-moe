// A paragraph holding a single titled image becomes <figure> with a caption.
//   ![alt](pic.png "caption")
import { visit } from 'unist-util-visit';

const isBlank = (n) => n.type === 'text' && !n.value.trim();

export default function rehypeFigure() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'p' || !parent || index === undefined) return;
      const kids = node.children.filter((n) => !isBlank(n));
      if (kids.length !== 1 || kids[0].type !== 'element' || kids[0].tagName !== 'img') return;
      const img = kids[0];
      const caption = img.properties?.title;
      if (!caption) return;
      delete img.properties.title;
      parent.children[index] = {
        type: 'element',
        tagName: 'figure',
        properties: {},
        children: [
          img,
          { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: String(caption) }] },
        ],
      };
    });
  };
}
