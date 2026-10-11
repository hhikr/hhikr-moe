// BBCode for comments, in the style of bgm.tv.
//
// Safety rule: user input never becomes markup. Text is HTML-escaped, and each
// supported tag produces a fixed piece of HTML whose only variable parts are
// escaped text or an address that has been parsed and checked. Anything
// malformed — an unknown tag, a tag left open, tags closed in the wrong
// order — is shown as the plain text the user typed.

export const MAX_LENGTH = 5000;
const MAX_DEPTH = 5;
const MAX_IMAGES = 9;

const INLINE: Record<string, string> = { b: 'strong', i: 'em', u: 'u', s: 's' };
const CONTAINERS = new Set(['b', 'i', 'u', 's', 'mask', 'quote', 'url']);
const TOKEN = /\[(\/?)([a-z]+)(?:=([^\]\n]*))?\]/gi;

type Node = string | Element;
interface Element {
  tag: string;
  arg?: string;
  /** The opening tag exactly as typed, for when the element turns out to be malformed. */
  raw: string;
  children: Node[];
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The normalised address if it is an absolute http(s) URL, otherwise undefined. */
function safeUrl(value: string, httpsOnly: boolean): string | undefined {
  const text = value.trim();
  if (!/^https?:\/\//i.test(text) || /[\s<>"'`\\]/.test(text)) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && (httpsOnly || url.protocol !== 'http:')) return undefined;
    if (url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function parse(input: string): Node[] {
  const root: Element = { tag: '', raw: '', children: [] };
  const stack: Element[] = [root];
  const top = () => stack[stack.length - 1];
  const lower = input.toLowerCase();
  let at = 0;

  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(input); m; m = TOKEN.exec(input)) {
    const [raw, closing, name, arg] = m;
    const tag = name.toLowerCase();
    if (m.index > at) top().children.push(input.slice(at, m.index));
    at = TOKEN.lastIndex;

    // [code] and [img] take everything up to their closing tag literally.
    if (!closing && (tag === 'code' || tag === 'img') && arg === undefined) {
      const end = lower.indexOf(`[/${tag}]`, at);
      if (end === -1) {
        top().children.push(raw);
        continue;
      }
      top().children.push({ tag, raw, children: [input.slice(at, end)] });
      at = TOKEN.lastIndex = end + tag.length + 3;
      continue;
    }

    if (!CONTAINERS.has(tag) || (arg !== undefined && tag !== 'url')) {
      top().children.push(raw);
    } else if (!closing) {
      if (stack.length > MAX_DEPTH) top().children.push(raw);
      else stack.push({ tag, arg, raw, children: [] });
    } else if (stack.length > 1 && top().tag === tag && arg === undefined) {
      const done = stack.pop()!;
      top().children.push(done);
    } else {
      // A closing tag that does not match the innermost open one is just text.
      top().children.push(raw);
    }
  }
  if (at < input.length) top().children.push(input.slice(at));

  // Tags still open at the end were never closed: put back what was typed.
  while (stack.length > 1) {
    const open = stack.pop()!;
    top().children.push(open.raw, ...open.children);
  }
  return root.children;
}

const LINK_ATTRS = 'target="_blank" rel="nofollow ugc noopener noreferrer"';
// ASCII only, so an address ends where Chinese text or punctuation begins.
const BARE_URL = /https?:\/\/[A-Za-z0-9\-._~:/?#@!$&()*+,;=%]+/gi;

function renderText(text: string, linkify: boolean): string {
  if (!linkify) return escapeHtml(text).replace(/\n/g, '<br>');
  let out = '';
  let at = 0;
  for (const m of text.matchAll(BARE_URL)) {
    // Trailing punctuation belongs to the sentence, not the address.
    const candidate = m[0].replace(/[.,;:!?，。；：！？）)]+$/, '');
    const url = safeUrl(candidate, false);
    if (!url) continue;
    out += escapeHtml(text.slice(at, m.index)) + `<a href="${escapeHtml(url)}" ${LINK_ATTRS}>${escapeHtml(candidate)}</a>`;
    at = m.index! + candidate.length;
  }
  return (out + escapeHtml(text.slice(at))).replace(/\n/g, '<br>');
}

const plain = (nodes: Node[]): string => nodes.map((n) => (typeof n === 'string' ? n : n.raw + plain(n.children) + `[/${n.tag}]`)).join('');

function render(nodes: Node[], state: { images: number }, insideLink = false): string {
  let html = '';
  for (const node of nodes) {
    if (typeof node === 'string') {
      html += renderText(node, !insideLink);
      continue;
    }
    const { tag } = node;
    if (tag in INLINE) {
      html += `<${INLINE[tag]}>${render(node.children, state, insideLink)}</${INLINE[tag]}>`;
    } else if (tag === 'mask') {
      html += `<span class="spoiler" tabindex="0" role="button" title="点击显示">${render(node.children, state, insideLink)}</span>`;
    } else if (tag === 'quote') {
      html += `<blockquote>${render(node.children, state, insideLink)}</blockquote>`;
    } else if (tag === 'code') {
      html += `<pre><code>${escapeHtml(String(node.children[0]).replace(/^\n|\n$/g, ''))}</code></pre>`;
    } else if (tag === 'img') {
      const url = safeUrl(String(node.children[0]), true);
      if (url && state.images < MAX_IMAGES) {
        state.images++;
        html += `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
      } else {
        html += renderText(plain([node]), false);
      }
    } else if (tag === 'url') {
      const url = safeUrl(node.arg ?? plain(node.children), false);
      if (url && !insideLink) {
        html += `<a href="${escapeHtml(url)}" ${LINK_ATTRS}>${render(node.children, state, true)}</a>`;
      } else {
        html += renderText(node.raw, false) + render(node.children, state, insideLink) + renderText('[/url]', false);
      }
    }
  }
  return html;
}

/** Tidy line breaks around block elements, where the newline the user typed is not meant as an extra blank line. */
const tidy = (html: string) => html.replace(/(?:<br>)?(<\/?(?:blockquote|pre)>)(?:<br>)?/g, '$1');

export function renderBBCode(source: string): string {
  const text = source.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return tidy(render(parse(text), { images: 0 }));
}

/** Returns what is wrong with the comment text, or undefined when it can be posted. */
export function commentProblem(source: unknown): string | undefined {
  if (typeof source !== 'string' || !source.trim()) return '评论不能为空';
  if ([...source].length > MAX_LENGTH) return `评论不能超过 ${MAX_LENGTH} 个字符`;
  return undefined;
}
