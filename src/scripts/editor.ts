// The post editor: Markdown on the left, the rendered result on the right.
// Edits are autosaved as a working copy; readers see nothing until 发布.
import { defaultHighlightStyle, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { api } from './account';

interface Fields {
  slug: string;
  title: string;
  summary?: string;
  category?: string;
  series?: string;
  seriesOrder?: number;
  coverMediaId?: number;
  hidden: boolean;
  pinned: boolean;
  commentsEnabled: boolean;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
}
interface Data {
  id: number;
  status: 'draft' | 'published';
  fields: Fields;
  sourceMd: string;
  cover: string | null;
}

const data: Data = JSON.parse(document.getElementById('editor-data')!.textContent!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const form = $<HTMLFormElement>('[data-fields]');
const statusLine = $('[data-save-state]');
const preview = $('[data-preview]');
const count = $('[data-count]');

/* ---------- dates: shown and edited in the author's timezone (UTC+8) ---------- */
const OFFSET = 8 * 3600_000;
const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).valueOf() + OFFSET).toISOString().slice(0, 16) : '');
const fromLocal = (value: string) => (value ? new Date(`${value}:00+08:00`).toISOString() : undefined);

/* ---------- form <-> fields ---------- */
const field = <T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement = HTMLInputElement>(name: string) => form.elements.namedItem(name) as T;

function fill(f: Fields) {
  field('title').value = f.title;
  field('slug').value = f.slug;
  field<HTMLTextAreaElement>('summary').value = f.summary ?? '';
  field<HTMLSelectElement>('category').value = f.category ?? '';
  field('tags').value = f.tags.join(', ');
  field('series').value = f.series ?? '';
  field('seriesOrder').value = f.seriesOrder?.toString() ?? '';
  field('publishedAt').value = toLocal(f.publishedAt);
  field('updatedAt').value = toLocal(f.updatedAt);
  field('hidden').checked = f.hidden;
  field('pinned').checked = f.pinned;
  field('commentsEnabled').checked = f.commentsEnabled;
  field('coverMediaId').value = f.coverMediaId?.toString() ?? '';
}

function collect(): Fields {
  return {
    title: field('title').value.trim(),
    slug: field('slug').value.trim(),
    summary: field<HTMLTextAreaElement>('summary').value.trim() || undefined,
    category: field<HTMLSelectElement>('category').value || undefined,
    tags: field('tags').value.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    series: field('series').value.trim() || undefined,
    seriesOrder: field('seriesOrder').value === '' ? undefined : Number(field('seriesOrder').value),
    publishedAt: fromLocal(field('publishedAt').value) ?? new Date().toISOString(),
    updatedAt: fromLocal(field('updatedAt').value),
    hidden: field('hidden').checked,
    pinned: field('pinned').checked,
    commentsEnabled: field('commentsEnabled').checked,
    coverMediaId: field('coverMediaId').value ? Number(field('coverMediaId').value) : undefined,
  };
}

/* ---------- the editor ---------- */
// Colours come from the site's own variables, so the editor follows the light and dark themes.
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '0.95rem', backgroundColor: 'var(--card)', color: 'var(--ink)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.75' },
  '.cm-content': { padding: '1rem 0', caretColor: 'var(--sky)' },
  '.cm-line': { padding: '0 1rem' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--ink-3)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--paper-2)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--sky)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--mark) !important' },
});
const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--sky-ink)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--sky-ink)' },
  { tag: tags.monospace, color: 'var(--signal)' },
  { tag: tags.quote, color: 'var(--ink-2)' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--ink-3)' },
]);

let dirty = false;
let previewTimer: number | undefined;
let saveTimer: number | undefined;

function changed() {
  dirty = true;
  statusLine.textContent = '有未保存的修改';
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(renderPreview, 400);
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(autosave, 3000);
}

const view = new EditorView({
  doc: data.sourceMd,
  parent: $('[data-editor]'),
  extensions: [
    basicSetup,
    markdown(),
    EditorView.lineWrapping,
    theme,
    syntaxHighlighting(highlight),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.updateListener.of((u) => u.docChanged && changed()),
    EditorView.domEventHandlers({
      paste: (e) => takeFiles(e, e.clipboardData?.files),
      drop: (e) => takeFiles(e, e.dataTransfer?.files),
    }),
  ],
});
const source = () => view.state.doc.toString();
const insert = (text: string) => view.dispatch(view.state.replaceSelection(text));

/* ---------- preview ---------- */
let previewRun = 0;
async function renderPreview() {
  const run = ++previewRun;
  const res = await api('/api/endmin/preview', { sourceMd: source() });
  if (run !== previewRun) return; // a newer render is on its way
  if (!res.ok) return void (preview.textContent = res.error.message);
  preview.innerHTML = res.data.html;
  count.textContent = `${res.data.words.toLocaleString('zh-CN')} 字 · 约 ${res.data.minutes} 分钟`;
}

/* ---------- saving ---------- */
const hm = () => new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());

async function autosave() {
  if (!dirty) return true;
  const res = await api(`/api/endmin/posts/${data.id}/working-copy`, { fields: collect(), sourceMd: source() }, 'PUT');
  if (!res.ok) {
    statusLine.textContent = `自动保存失败：${res.error.message}`;
    return false;
  }
  dirty = false;
  statusLine.textContent = `修改已自动保存 ${hm()}，尚未${data.status === 'published' ? '更新到网站' : '存为草稿'}`;
  return true;
}

async function save(status: 'draft' | 'published') {
  clearTimeout(saveTimer);
  statusLine.textContent = '正在保存…';
  const res = await api(`/api/endmin/posts/${data.id}`, { fields: collect(), sourceMd: source(), status }, 'PUT');
  if (!res.ok) return void (statusLine.textContent = res.error.message);
  dirty = false;
  // Reload so the buttons, the address and the revision list reflect the new state.
  location.assign(`/endmin/posts/${data.id}/?saved=${status}`);
}

document.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-do]');
  if (!button) return;
  const action = button.dataset.do!;
  if (action === 'save-draft') return save('draft');
  if (action === 'publish') {
    if (data.status === 'draft' && !confirm(collect().hidden ? '发布为隐藏文章？只有你能看到。' : '发布这篇文章？所有人都能看到它。')) return;
    return save('published');
  }
  if (action === 'withdraw') {
    if (!confirm('撤回为草稿？它会从网站上消失，直到再次发布。')) return;
    return save('draft');
  }
  if (action === 'preview') {
    if (await autosave()) window.open(`/endmin/posts/${data.id}/preview/`, '_blank');
    return;
  }
  if (action === 'discard') {
    if (!confirm('丢弃尚未保存的修改，回到上次保存的内容？')) return;
    await api(`/api/endmin/posts/${data.id}/working-copy`, undefined, 'DELETE');
    dirty = false;
    return location.reload();
  }
  if (action === 'delete') {
    if (!confirm('删除这篇文章？它的评论和修订记录会一并删除，无法恢复。')) return;
    const res = await api(`/api/endmin/posts/${data.id}`, undefined, 'DELETE');
    if (!res.ok) return void (statusLine.textContent = res.error.message);
    dirty = false;
    return location.assign('/endmin/posts/');
  }
  if (action === 'revision') {
    if (!confirm('把这个版本的内容载入编辑器？当前未保存的修改会被替换。载入后还需要点保存才会生效。')) return;
    const res = await api(`/api/endmin/posts/${data.id}/revisions/${button.dataset.id}`);
    if (!res.ok) return void (statusLine.textContent = res.error.message);
    fill({ ...res.data.fields, slug: collect().slug });
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: res.data.sourceMd } });
    changed();
    return;
  }
  if (action === 'today') {
    field('updatedAt').value = toLocal(new Date().toISOString());
    return changed();
  }
  if (action === 'cover') return $<HTMLInputElement>('[data-cover-input]').click();
  if (action === 'cover-remove') {
    field('coverMediaId').value = '';
    showCover(null);
    return changed();
  }
  if (action === 'upload') return $<HTMLInputElement>('[data-file-input]').click();
});

form.addEventListener('input', changed);

/* ---------- uploads ---------- */
async function upload(file: File, cover = false) {
  statusLine.textContent = `正在上传 ${file.name}…`;
  const res = await api(`/api/endmin/media?name=${encodeURIComponent(file.name)}${cover ? '&cover=1' : ''}`, file, 'POST');
  statusLine.textContent = res.ok ? '' : `上传失败：${res.error.message}`;
  return res.ok ? res.data : undefined;
}

// Pasted or dropped files are uploaded and linked where the cursor is.
function takeFiles(e: Event, files?: FileList | null) {
  if (!files?.length) return false;
  e.preventDefault();
  (async () => {
    for (const file of files) {
      const media = await upload(file);
      if (media) insert(media.image ? `![](${media.url})\n` : `[${media.filename}](${media.url})\n`);
    }
  })();
  return true;
}

$<HTMLInputElement>('[data-file-input]').addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  takeFiles(e, input.files);
  input.value = '';
});

function showCover(url: string | null) {
  const box = $('[data-cover]');
  box.replaceChildren();
  if (url) box.append(Object.assign(document.createElement('img'), { src: url, alt: '' }));
  $('[data-do="cover-remove"]').hidden = !url;
}

$<HTMLInputElement>('[data-cover-input]').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const media = await upload(file, true);
  if (!media) return;
  field('coverMediaId').value = String(media.id);
  showCover(media.cover ?? media.url);
  changed();
});

/* ---------- start ---------- */
fill(data.fields);
showCover(data.cover);
renderPreview();

window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});
// Leaving the page: make one last attempt to keep unsaved work.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && dirty) autosave();
});
