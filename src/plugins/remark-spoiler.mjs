// ||spoiler|| -> <span class="spoiler">, revealed on click (see Base.astro).
import { visit, SKIP } from 'unist-util-visit';

const PATTERN = /\|\|(?=\S)(.+?)(?<=\S)\|\|/g;

export default function remarkSpoiler() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('||')) return;
      const parts = [];
      let last = 0;
      for (const m of node.value.matchAll(PATTERN)) {
        if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
        parts.push({
          type: 'emphasis',
          data: {
            hName: 'span',
            hProperties: { className: ['spoiler'], tabIndex: 0, role: 'button', title: '点击显示' },
          },
          children: [{ type: 'text', value: m[1] }],
        });
        last = m.index + m[0].length;
      }
      if (parts.length === 0) return;
      if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
      return [SKIP, index + parts.length];
    });
  };
}
