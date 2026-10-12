// BBCode rendering: every supported tag, malformed input, and attempts to inject markup.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { commentProblem, MAX_LENGTH, renderBBCode: r } = await import('../../src/server/bbcode.ts');

test('inline tags', () => {
  assert.equal(r('[b]粗[/b] [i]斜[/i] [u]线[/u] [s]删[/s]'), '<strong>粗</strong> <em>斜</em> <u>线</u> <s>删</s>');
  assert.equal(r('[B]大写[/B]'), '<strong>大写</strong>');
  assert.equal(r('[b][i]嵌套[/i][/b]'), '<strong><em>嵌套</em></strong>');
  assert.match(r('[mask]剧透[/mask]'), /^<span class="spoiler"[^>]*>剧透<\/span>$/);
});

test('line breaks, quotes and code', () => {
  assert.equal(r('一\n二\r\n三'), '一<br>二<br>三');
  assert.equal(r('a\n\n\n\n\nb'), 'a<br><br>b');
  assert.equal(r('前\n[quote]引用[/quote]\n后'), '前<blockquote>引用</blockquote>后');
  assert.equal(r('[code]\nif (a < b) [b]x[/b];\n[/code]'), '<pre><code>if (a &lt; b) [b]x[/b];</code></pre>', 'tags inside code are not interpreted');
});

test('links', () => {
  assert.equal(r('[url]https://example.com/a?b=1&c=2[/url]'), '<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="nofollow ugc noopener noreferrer">https://example.com/a?b=1&amp;c=2</a>');
  assert.match(r('[url=https://example.com]这里[/url]'), /^<a href="https:\/\/example\.com\/" [^>]*>这里<\/a>$/);
  assert.match(r('看 https://example.com/x。然后'), /^看 <a href="https:\/\/example\.com\/x" [^>]*>https:\/\/example\.com\/x<\/a>。然后$/);
  assert.equal((r('[url=https://a.example]https://b.example[/url]').match(/<a /g) ?? []).length, 1, 'no link inside a link');
});

test('images must be https and are limited in number', () => {
  assert.equal(r('[img]https://i.example/a.png[/img]'), '<img src="https://i.example/a.png" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">');
  for (const bad of ['http://i.example/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)', '//i.example/a.png', '/local.png', 'https://user:pw@i.example/a.png', 'https://i.example/a.png" onerror="x']) {
    assert.ok(!r(`[img]${bad}[/img]`).includes('<img'), bad);
  }
  const many = r(Array.from({ length: 12 }, (_, i) => `[img]https://i.example/${i}.png[/img]`).join(''));
  assert.equal((many.match(/<img /g) ?? []).length, 9);
});

test('malformed input is shown as typed', () => {
  assert.equal(r('[b]没有闭合'), '[b]没有闭合');
  assert.equal(r('多余的[/b]闭合'), '多余的[/b]闭合');
  assert.equal(r('[b][i]交叉[/b][/i]'), '[b]<em>交叉[/b]</em>', 'a tag closed out of order stays text; the properly nested one still applies');
  assert.equal(r('[color=red]不支持[/color]'), '[color=red]不支持[/color]');
  assert.equal(r('[b=x]参数[/b]'), '[b=x]参数[/b]');
  assert.equal(r('[img]没有闭合'), '[img]没有闭合');
  assert.equal(r('[url=javascript:alert(1)]点我[/url]'), '[url=javascript:alert(1)]点我[/url]');
  const deep = '[b]'.repeat(8) + 'x' + '[/b]'.repeat(8);
  assert.ok((r(deep).match(/<strong>/g) ?? []).length <= 5);
});

test('nothing the user types becomes markup', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[b]<svg onload=alert(1)>[/b]',
    '[url=https://example.com" onmouseover="alert(1)]x[/url]',
    '[url=https://example.com]<script>alert(1)</script>[/url]',
    '[url]javascript:alert(1)[/url]',
    '[url= javascript:alert(1)]x[/url]',
    '[url=JaVaScRiPt:alert(1)]x[/url]',
    '[url=data:text/html,<script>alert(1)</script>]x[/url]',
    '[img]https://i.example/a.png"><script>alert(1)</script>[/img]',
    "[img]https://i.example/a.png' onerror='alert(1)[/img]",
    '[mask]</span><script>alert(1)</script>[/mask]',
    '[quote]</blockquote><iframe src=//evil>[/quote]',
    '[code]</code></pre><script>alert(1)</script>[/code]',
    'https://example.com/"><script>alert(1)</script>',
    'https://example.com/<b>',
    '&lt;script&gt; &amp; "quotes" \'single\'',
  ];
  for (const attack of attacks) {
    const html = r(attack);
    // Every "<" in the output must start one of the tags the renderer itself emits.
    const tags = html.match(/<[^>]*>?/g) ?? [];
    for (const tag of tags) {
      assert.match(tag, /^<\/?(strong|em|u|s|blockquote|pre|code|br)>$|^<\/(span|a)>$|^<span class="spoiler" tabindex="0" role="button" title="点击显示">$|^<a href="https?:\/\/[^"<>]*" target="_blank" rel="nofollow ugc noopener noreferrer">$|^<img src="https:\/\/[^"<>]*" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">$/, `${attack} -> ${html}`);
    }
    assert.ok(!/javascript:|data:text/i.test(html.replace(/&[a-z#0-9]+;/g, '').match(/(href|src)="[^"]*"/g)?.join(' ') ?? ''), attack);
  }
});

test('length limits', () => {
  assert.ok(commentProblem(''));
  assert.ok(commentProblem('   \n '));
  assert.ok(commentProblem(undefined));
  assert.ok(commentProblem('x'.repeat(MAX_LENGTH + 1)));
  assert.equal(commentProblem('好'.repeat(MAX_LENGTH)), undefined);
});
