import { switchTheme } from './theme-transition.mjs';
// Site-wide progressive enhancement. Every feature degrades to plain HTML.
export {};

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(sel),
];

/* ---------- theme ---------- */
type Pref = 'auto' | 'light' | 'dark';
const media = matchMedia('(prefers-color-scheme: dark)');

function applyTheme(pref: Pref) {
  const dark = pref === 'dark' || (pref === 'auto' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePref = pref;
  document.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
}

function currentPref(): Pref {
  try {
    return (localStorage.getItem('theme') as Pref) || 'auto';
  } catch {
    return 'auto';
  }
}

$('[data-theme-toggle]')?.addEventListener('click', (event) => {
  const button = event.currentTarget as HTMLElement;
  const next: Pref = (button.dataset.themeTarget || document.documentElement.dataset.theme) === 'dark' ? 'light' : 'dark';
  button.dataset.themeTarget = next;
  void switchTheme(() => {
    try { localStorage.setItem('theme', next); } catch {}
    applyTheme(next);
  }, button);
});
document.addEventListener('click', (event) => {
  if (!document.documentElement.classList.contains('day-night-transition')) return;
  const button = $<HTMLButtonElement>('[data-theme-toggle]');
  if (!button || button.contains(event.target as Node)) return;
  const rect = button.getBoundingClientRect();
  if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
    event.preventDefault();event.stopImmediatePropagation();button.click();
  }
}, true);
media.addEventListener('change', () => currentPref() === 'auto' && applyTheme('auto'));

/* ---------- header: scrolled state + reading progress ---------- */
const header = $('[data-header]');
const bar = $('[data-progress]');
const article = $('[data-article]');
let ticking = false;
function onScroll() {
  ticking = false;
  header?.classList.toggle('scrolled', scrollY > 8);
  if (bar && article) {
    const r = article.getBoundingClientRect();
    const total = r.height - innerHeight * 0.6;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(total, 1)));
    bar.style.setProperty('--p', String(p));
  }
}
addEventListener('scroll', () => !ticking && (ticking = true) && requestAnimationFrame(onScroll), { passive: true });
onScroll();

$('[data-to-top]')?.addEventListener('click', () => scrollTo({ top: 0 }));

/* ---------- mobile menu ---------- */
const menuBtn = $('[data-menu-toggle]');
const menu = $('#mobile-menu');
menuBtn?.addEventListener('click', () => {
  const open = menu!.hidden;
  menu!.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
});

/* ---------- search (Pagefind) ---------- */
type PagefindResult = { data: () => Promise<{ url: string; excerpt: string; meta: { title?: string; date?: string; category?: string } }> };
type Pagefind = { search: (q: string) => Promise<{ results: PagefindResult[] }>; init?: () => Promise<void>; options?: (o: object) => Promise<void> };

const dialog = $<HTMLDialogElement>('[data-search]');
const input = $<HTMLInputElement>('[data-search-input]');
const list = $('[data-search-results]');
const statusEl = $('[data-search-status]');
const quick = $('[data-search-quick]');
let pagefind: Pagefind | null = null;
let selected = -1;
let seq = 0;

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
$$('[data-kbd]').forEach((k) => (k.textContent = isMac ? '⌘ K' : 'Ctrl K'));

async function loadPagefind() {
  if (pagefind) return pagefind;
  const url = '/pagefind/pagefind.js';
  pagefind = (await import(/* @vite-ignore */ url)) as Pagefind;
  await pagefind.options?.({ excerptLength: 40 });
  await pagefind.init?.();
  return pagefind;
}

function openSearch() {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  input?.select();
  loadPagefind().catch(() => {});
}

function setStatus(text: string) {
  if (!statusEl) return;
  statusEl.hidden = !text;
  statusEl.textContent = text;
}

function select(i: number) {
  const links = $$<HTMLAnchorElement>('a', list!);
  if (!links.length) return;
  selected = (i + links.length) % links.length;
  links.forEach((a, j) => a.setAttribute('aria-selected', String(j === selected)));
  links[selected].scrollIntoView({ block: 'nearest' });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function runSearch(q: string) {
  const mine = ++seq;
  selected = -1;
  if (!q.trim()) {
    list!.innerHTML = '';
    quick!.hidden = false;
    setStatus('');
    return;
  }
  quick!.hidden = true;
  let pf: Pagefind;
  try {
    pf = await loadPagefind();
  } catch {
    setStatus('搜索索引仅在构建后可用（npm run build && npm run preview）');
    return;
  }
  const res = await pf.search(q);
  const data = await Promise.all(res.results.slice(0, 12).map((r) => r.data()));
  if (mine !== seq) return;
  setStatus(data.length ? `${res.results.length} 条结果` : '没有找到相关内容 — Don’t panic.');
  list!.innerHTML = data
    .map(
      (d) => `<li><a href="${d.url}">
        <span class="r-title">${escapeHtml(d.meta.title ?? d.url)}</span>
        <span class="r-excerpt">${d.excerpt}</span>
        <span class="r-sub">${escapeHtml([d.meta.date, d.meta.category].filter(Boolean).join(' · '))}</span>
      </a></li>`,
    )
    .join('');
  if (data.length) select(0);
}

let timer: number | undefined;
input?.addEventListener('input', () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => runSearch(input.value), 120);
});
input?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') (e.preventDefault(), select(selected + 1));
  else if (e.key === 'ArrowUp') (e.preventDefault(), select(selected - 1));
  else if (e.key === 'Enter') {
    const a = $$<HTMLAnchorElement>('a', list!)[selected];
    if (a) (e.preventDefault(), (location.href = a.href));
  }
});
$$('[data-search-open]').forEach((b) => b.addEventListener('click', openSearch));
$('[data-search-close]')?.addEventListener('click', () => dialog?.close());
dialog?.addEventListener('click', (e) => e.target === dialog && dialog.close());

addEventListener('keydown', (e) => {
  const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable]');
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
    e.preventDefault();
    openSearch();
  }
});

/* ---------- article enhancements ---------- */
const prose = $('.prose');
if (prose) {
  // spoilers
  prose.addEventListener('click', (e) => {
    const s = (e.target as HTMLElement).closest('.spoiler');
    if (s) s.classList.add('revealed');
  });
  prose.addEventListener('keydown', (e) => {
    const s = (e.target as HTMLElement).closest('.spoiler');
    if (s && (e.key === 'Enter' || e.key === ' ')) (e.preventDefault(), s.classList.add('revealed'));
  });

  // tables scroll horizontally on small screens
  $$('table', prose).forEach((t) => {
    const w = document.createElement('div');
    w.className = 'table-wrap';
    t.replaceWith(w);
    w.append(t);
  });

  // code blocks: language label + copy button
  $$<HTMLPreElement>('pre', prose).forEach((pre) => {
    const frame = document.createElement('div');
    frame.className = 'code-frame';
    pre.replaceWith(frame);
    frame.append(pre);
    const lang = pre.dataset.language;
    if (lang && lang !== 'plaintext') {
      const tag = document.createElement('span');
      tag.className = 'code-lang';
      tag.textContent = lang;
      frame.prepend(tag);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = '复制';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ''));
        btn.textContent = '已复制 ✓';
      } catch {
        btn.textContent = '复制失败';
      }
      setTimeout(() => (btn.textContent = '复制'), 1600);
    });
    frame.append(btn);
  });

  // image lightbox
  const box = document.createElement('dialog');
  box.className = 'lightbox';
  box.innerHTML = '<img alt=""><p></p>';
  document.body.append(box);
  const big = box.querySelector('img')!;
  const cap = box.querySelector('p')!;
  // Pictures in the text, and anywhere else marked with data-zoom (a gallery).
  document.addEventListener('click', (e) => {
    const img = (e.target as HTMLElement).closest<HTMLImageElement>('.prose img, [data-zoom] img');
    if (!img || img.closest('a')) return;
    big.src = img.dataset.full || img.currentSrc || img.src;
    big.alt = img.alt;
    cap.textContent = img.closest('figure')?.querySelector('figcaption')?.textContent || img.alt || '';
    box.showModal();
  });
  box.addEventListener('click', () => box.close());
}

/* ---------- table of contents scroll spy ---------- */
const tocLinks = $$<HTMLAnchorElement>('[data-toc] a');
if (tocLinks.length) {
  const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const heads = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  const spy = () => {
    let current = heads[0];
    for (const h of heads) if (h.getBoundingClientRect().top < 120) current = h;
    tocLinks.forEach((a) => a.classList.remove('active'));
    const link = current && byId.get(current.id);
    if (link) {
      link.classList.add('active');
      const box = link.closest('[data-toc]') as HTMLElement;
      const lr = link.offsetTop - box.clientHeight / 2;
      if (box.scrollHeight > box.clientHeight) box.scrollTo({ top: lr });
    }
  };
  addEventListener('scroll', () => requestAnimationFrame(spy), { passive: true });
  spy();
}

/* ---------- visit count ---------- */
// One anonymous count per page view (see /privacy/). Only the host name of the
// referring site is sent. For a post the reply says how often it has been read.
{
  let referrer = '';
  try {
    const from = new URL(document.referrer);
    if (from.host !== location.host) referrer = from.hostname;
  } catch {}
  fetch('/api/hit', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: location.pathname, referrer }),
  })
    .then((res) => (res.status === 200 ? res.json() : undefined))
    .then((data) => {
      const slot = $('[data-views]');
      if (!slot || typeof data?.views !== 'number') return;
      $('[data-views-n]', slot)!.textContent = data.views.toLocaleString('zh-CN');
      slot.hidden = false;
    })
    .catch(() => {});
}
/* ---------- forms handled entirely by script never navigate ---------- */
document.addEventListener('submit', (e) => {
  if ((e.target as HTMLElement).matches('form[data-scripted]')) e.preventDefault();
});

/* ---------- browsing as a guest ---------- */
// The endministrator browsing as a guest gets a way back. The cookie is only a
// marker; the server decides what it means.
if (document.cookie.split('; ').includes('view_as=guest')) {
  const bar = document.createElement('button');
  bar.type = 'button';
  bar.className = 'view-as-bar';
  bar.textContent = '正在以游客视角浏览 · 退出';
  bar.addEventListener('click', async () => {
    await fetch('/api/endmin/view-as', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"guest":false}' });
    location.assign('/endmin/');
  });
  document.body.append(bar);
}
