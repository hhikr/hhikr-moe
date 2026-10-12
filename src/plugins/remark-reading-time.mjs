// Adds `words` and `minutes` to the rendered frontmatter.
// CJK characters count one each; Latin text counts by words.
import { visit } from 'unist-util-visit';

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g;

export default function remarkReadingTime() {
  return (tree, file) => {
    let cjk = 0;
    let latin = 0;
    visit(tree, ['text', 'inlineCode', 'code'], (node) => {
      const value = node.value ?? '';
      const chars = value.match(CJK)?.length ?? 0;
      cjk += chars;
      latin += value.replace(CJK, ' ').split(/\s+/).filter((w) => /\w/.test(w)).length;
    });
    const words = cjk + latin;
    const minutes = Math.max(1, Math.round(cjk / 400 + latin / 220));
    const fm = (file.data.astro ??= {}).frontmatter ??= {};
    fm.words = words;
    fm.minutes = minutes;
  };
}
