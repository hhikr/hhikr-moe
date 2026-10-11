// What Markdown turns into. The expected HTML lives in markdown.test.mjs.snapshot;
// after an intended change to the renderer, regenerate it with
//   node --test --test-update-snapshots tests/server/markdown.test.mjs
// and read the diff before committing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-markdown-'));
process.env.DATA_DIR = dir;

const { closeDb } = await import('../../src/server/db.ts');
const { renderMarkdown } = await import('../../src/server/render.ts');

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const CASES = {
  'headings and inline text': '## 第一节\n\n正文里有 **粗体**、*斜体*、~~删除线~~ 和 `代码`。\n\n### English Heading & more\n\n第二段。',
  'links open other sites in a new tab': '[站内](/posts/a/) 和 [站外](https://example.com/page)。\n\n<https://example.org>',
  'lists and task lists': '- 一\n- 二\n  - 嵌套\n\n1. 甲\n2. 乙\n\n- [x] 做完了\n- [ ] 还没做',
  'a table': '| 名称 | 数量 |\n| :--- | ---: |\n| 苹果 | 3 |\n| 梨 | 12 |',
  'a quotation': '> 引用的话\n>\n> 第二段',
  'callouts': '> [!note]\n> 默认标题\n\n> [!warning] 自定义标题\n> 内容\n\n> [!tip]- 折叠起来的\n> 藏着的内容\n\n> [!tip]+ 展开的\n> 内容',
  'spoilers': '凶手是 ||管家||，不是 || 这个 ||。',
  'highlighted code': '```js\nconst answer = 42;\n```\n\n```Java\nint x = 1;\n```\n\n```\nplain\n```',
  'formulas': '行内 $a^2 + b^2 = c^2$ 公式。\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$',
  'images become figures': '![一张图](/media/ab/abcdef.png)\n\n![](https://example.com/remote.jpg "有标题")',
  'footnotes': '一句话[^1]。\n\n[^1]: 它的注脚。',
  'raw html is kept': '<div class="box">\n  <iframe src="https://player.example.com/v" allowfullscreen></iframe>\n</div>\n\n<details><summary>展开</summary>内容</details>',
};

for (const [name, source] of Object.entries(CASES)) {
  test(name, async (t) => {
    const { html, headings } = await renderMarkdown(source);
    t.assert.snapshot({ html, headings });
  });
}

test('typographic quotes are left as typed', async () => {
  const { html } = await renderMarkdown('He said "hello" -- and \'bye\'...');
  assert.match(html, /"hello" -- and 'bye'\.\.\./);
});

test('reading time counts Chinese characters and English words', async () => {
  const { words, minutes } = await renderMarkdown(`${'汉字'.repeat(300)} ${'word '.repeat(100)}`);
  assert.equal(words, 700);
  assert.ok(minutes >= 1);
});

test('headings get stable anchors', async () => {
  const { headings, html } = await renderMarkdown('## 同名\n\n## 同名\n\n### Sub Title');
  assert.deepEqual(headings.map((h) => h.slug), ['同名', '同名-1', 'sub-title']);
  assert.match(html, /id="同名-1"/);
});
