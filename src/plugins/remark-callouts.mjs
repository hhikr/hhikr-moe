// Obsidian / GitHub style callouts:
//   > [!note] Optional title
//   > body
// `[!tip]-` renders collapsed, `[!tip]+` collapsible but open.
import { visit } from 'unist-util-visit';

const LABELS = {
  note: '笔记',
  info: '信息',
  tip: '提示',
  hint: '提示',
  important: '重要',
  success: '完成',
  question: '问题',
  warning: '注意',
  caution: '小心',
  danger: '危险',
  bug: 'Bug',
  example: '例',
  quote: '引用',
  abstract: '摘要',
  summary: '摘要',
  todo: '待办',
};

export default function remarkCallouts() {
  return (tree) => {
    visit(tree, 'blockquote', (node) => {
      const first = node.children[0];
      if (first?.type !== 'paragraph') return;
      const text = first.children[0];
      if (text?.type !== 'text') return;
      const m = text.value.match(/^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)\n?/);
      if (!m) return;

      const [, rawType, fold, title] = m;
      const type = rawType.toLowerCase();
      text.value = text.value.slice(m[0].length);
      if (!text.value) first.children.shift();
      if (first.children.length === 0) node.children.shift();

      const collapsible = fold !== '';
      node.data = {
        hName: collapsible ? 'details' : 'aside',
        hProperties: {
          className: ['callout'],
          dataCallout: type,
          ...(fold === '+' ? { open: true } : {}),
        },
      };
      node.children.unshift({
        type: 'paragraph',
        data: { hName: collapsible ? 'summary' : 'p', hProperties: { className: ['callout-title'] } },
        children: [{ type: 'text', value: title.trim() || LABELS[type] || rawType }],
      });
    });
  };
}
