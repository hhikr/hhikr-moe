// Posts and who may see them.
//
//   published, not hidden  everyone
//   published, hidden      the endministrator only, on the public pages too
//   draft                  nobody on the public pages; management screens only
import { db, transaction } from './db.ts';
import { coverOf, mediaById, type Cover } from './media.ts';
import { renderMarkdown, type Heading } from './render.ts';

export type Role = 'guest' | 'user' | 'endmin';
export interface Viewer {
  role: Role;
}
export const GUEST: Viewer = { role: 'guest' };

export type PostStatus = 'draft' | 'published';

export interface PostSummary {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  category?: string;
  series?: string;
  seriesOrder?: number;
  cover?: Cover;
  coverMediaId?: number;
  status: PostStatus;
  hidden: boolean;
  pinned: boolean;
  commentsEnabled: boolean;
  words: number;
  minutes: number;
  publishedAt: Date;
  updatedAt?: Date;
  tags: string[];
}

export interface PostFull extends PostSummary {
  sourceMd: string;
  html: string;
  headings: Heading[];
}

export interface PostInput {
  slug: string;
  title: string;
  summary?: string;
  category?: string;
  series?: string;
  seriesOrder?: number;
  coverMediaId?: number;
  status: PostStatus;
  hidden?: boolean;
  pinned?: boolean;
  commentsEnabled?: boolean;
  sourceMd: string;
  publishedAt: Date;
  updatedAt?: Date;
  tags?: string[];
}

const LIST_COLUMNS =
  'id, slug, title, summary, category, series, series_order, cover_media_id, status, hidden, pinned, comments_enabled, words, minutes, published_at, updated_at';

/** SQL condition for what `viewer` may see on the public pages. */
function visibleTo(viewer: Viewer): string {
  return viewer.role === 'endmin' ? "status = 'published'" : "status = 'published' AND hidden = 0";
}

function tagsByPost(): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const row of db().prepare('SELECT post_id, tag FROM post_tags ORDER BY rowid').all()) {
    const id = Number(row.post_id);
    map.set(id, [...(map.get(id) ?? []), String(row.tag)]);
  }
  return map;
}

function toSummary(row: any, tags: string[]): PostSummary {
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? undefined,
    category: row.category ?? undefined,
    series: row.series ?? undefined,
    seriesOrder: row.series_order ?? undefined,
    cover: row.cover_media_id ? coverOf(mediaById(Number(row.cover_media_id))) : undefined,
    coverMediaId: row.cover_media_id ? Number(row.cover_media_id) : undefined,
    status: row.status,
    hidden: !!row.hidden,
    pinned: !!row.pinned,
    commentsEnabled: !!row.comments_enabled,
    words: Number(row.words),
    minutes: Number(row.minutes),
    publishedAt: new Date(row.published_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    tags,
  };
}

/** Posts `viewer` may see on the public pages, newest first. Drafts are never included. */
export function listPosts(viewer: Viewer = GUEST): PostSummary[] {
  const rows = db().prepare(`SELECT ${LIST_COLUMNS} FROM posts WHERE ${visibleTo(viewer)} ORDER BY published_at DESC`).all();
  const tags = tagsByPost();
  return rows.map((r: any) => toSummary(r, tags.get(Number(r.id)) ?? []));
}

/** One post for the public pages, or undefined when it does not exist or `viewer` may not see it. */
export function getPost(slug: string, viewer: Viewer = GUEST): PostFull | undefined {
  const row: any = db().prepare(`SELECT * FROM posts WHERE slug = ? AND ${visibleTo(viewer)}`).get(slug);
  if (!row) return undefined;
  const tags = db().prepare('SELECT tag FROM post_tags WHERE post_id = ? ORDER BY rowid').all(row.id).map((t: any) => String(t.tag));
  return { ...toSummary(row, tags), sourceMd: row.source_md, html: row.html, headings: JSON.parse(row.headings_json) };
}

/** Where an old address now lives, if the post behind it is visible to `viewer`. */
export function resolveRedirect(oldSlug: string, viewer: Viewer = GUEST): string | undefined {
  const row: any = db()
    .prepare(`SELECT p.slug FROM post_redirects r JOIN posts p ON p.id = r.post_id WHERE r.old_slug = ? AND ${visibleTo(viewer)}`)
    .get(oldSlug);
  return row?.slug;
}

/** Every post regardless of status, for management screens and scripts. */
export function listAllPosts(): PostSummary[] {
  const rows = db().prepare(`SELECT ${LIST_COLUMNS} FROM posts ORDER BY published_at DESC`).all();
  const tags = tagsByPost();
  return rows.map((r: any) => toSummary(r, tags.get(Number(r.id)) ?? []));
}

/** Create the post, or replace the one with the same slug. Renders the Markdown. */
export async function savePost(input: PostInput): Promise<number> {
  const rendered = await renderMarkdown(input.sourceMd);
  return transaction(() => {
    const conn = db();
    const values = [
      input.title,
      input.summary ?? null,
      input.category ?? null,
      input.series ?? null,
      input.seriesOrder ?? null,
      input.coverMediaId ?? null,
      input.status,
      input.hidden ? 1 : 0,
      input.pinned ? 1 : 0,
      input.commentsEnabled === false ? 0 : 1,
      input.sourceMd,
      rendered.html,
      JSON.stringify(rendered.headings),
      rendered.words,
      rendered.minutes,
      input.publishedAt.toISOString(),
      input.updatedAt?.toISOString() ?? null,
    ];
    const existing: any = conn.prepare('SELECT id FROM posts WHERE slug = ?').get(input.slug);
    let id: number;
    if (existing) {
      id = Number(existing.id);
      conn
        .prepare(
          `UPDATE posts SET title = ?, summary = ?, category = ?, series = ?, series_order = ?, cover_media_id = ?,
             status = ?, hidden = ?, pinned = ?, comments_enabled = ?, source_md = ?, html = ?, headings_json = ?,
             words = ?, minutes = ?, published_at = ?, updated_at = ? WHERE id = ?`,
        )
        .run(...values, id);
      conn.prepare('DELETE FROM post_tags WHERE post_id = ?').run(id);
    } else {
      const result = conn
        .prepare(
          `INSERT INTO posts (title, summary, category, series, series_order, cover_media_id, status, hidden, pinned,
             comments_enabled, source_md, html, headings_json, words, minutes, published_at, updated_at, slug)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...values, input.slug);
      id = Number(result.lastInsertRowid);
    }
    const addTag = conn.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)');
    for (const tag of input.tags ?? []) addTag.run(id, tag);
    return id;
  });
}

export function postIdBySlug(slug: string, viewer: Viewer = GUEST): number | undefined {
  const row: any = db().prepare(`SELECT id FROM posts WHERE slug = ? AND ${visibleTo(viewer)}`).get(slug);
  return row ? Number(row.id) : undefined;
}

/** Publish, withdraw to draft, hide or unhide a post. Management only. */
export function setPostState(id: number, change: { status?: PostStatus; hidden?: boolean }): boolean {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (change.status === 'draft' || change.status === 'published') {
    sets.push('status = ?');
    args.push(change.status);
  }
  if (typeof change.hidden === 'boolean') {
    sets.push('hidden = ?');
    args.push(change.hidden ? 1 : 0);
  }
  if (sets.length === 0) return false;
  return Number(db().prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`).run(...args, id).changes) === 1;
}
/* ---------- management: writing and editing ---------- */

/** The editable properties of a post, as the editor sends them. */
export interface PostFields {
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
  /** ISO date-times. */
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isoDate = (v: unknown) => {
  const d = typeof v === 'string' && v ? new Date(v) : undefined;
  return d && !Number.isNaN(d.valueOf()) ? d.toISOString() : undefined;
};

/** Clean up what the editor sent. Unknown properties are dropped. */
export function normalizeFields(input: any): PostFields {
  const tags = Array.isArray(input?.tags) ? input.tags : typeof input?.tags === 'string' ? input.tags.split(/[,，]/) : [];
  const order = Number(input?.seriesOrder);
  const cover = Number(input?.coverMediaId);
  return {
    slug: text(input?.slug, 80).toLowerCase(),
    title: text(input?.title, 200),
    summary: text(input?.summary, 500) || undefined,
    category: text(input?.category, 40) || undefined,
    series: text(input?.series, 80) || undefined,
    seriesOrder: input?.seriesOrder !== '' && input?.seriesOrder != null && Number.isFinite(order) ? order : undefined,
    coverMediaId: Number.isInteger(cover) && cover > 0 ? cover : undefined,
    hidden: input?.hidden === true,
    pinned: input?.pinned === true,
    commentsEnabled: input?.commentsEnabled !== false,
    publishedAt: isoDate(input?.publishedAt) ?? new Date().toISOString(),
    updatedAt: isoDate(input?.updatedAt),
    tags: [...new Set<string>(tags.map((t: unknown) => text(t, 40)).filter(Boolean))].slice(0, 20),
  };
}

/** Returns what stops these fields from being saved for post `id`, or undefined. */
export function fieldsProblem(id: number, f: PostFields): string | undefined {
  if (!f.title) return '请填写标题';
  if (!SLUG_PATTERN.test(f.slug)) return '地址只能用小写字母、数字和连字符，例如 my-first-post';
  if (db().prepare('SELECT 1 FROM posts WHERE slug = ? AND id <> ?').get(f.slug, id)) return '这个地址已经被另一篇文章使用';
  if (f.coverMediaId && !mediaById(f.coverMediaId)) return '封面图片不存在';
  return undefined;
}

export interface EditablePost {
  id: number;
  status: PostStatus;
  fields: PostFields;
  sourceMd: string;
}

function fieldsOfRow(row: any, tags: string[]): PostFields {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? undefined,
    category: row.category ?? undefined,
    series: row.series ?? undefined,
    seriesOrder: row.series_order ?? undefined,
    coverMediaId: row.cover_media_id ? Number(row.cover_media_id) : undefined,
    hidden: !!row.hidden,
    pinned: !!row.pinned,
    commentsEnabled: !!row.comments_enabled,
    publishedAt: row.published_at,
    updatedAt: row.updated_at ?? undefined,
    tags,
  };
}

const tagsOf = (id: number) => db().prepare('SELECT tag FROM post_tags WHERE post_id = ? ORDER BY rowid').all(id).map((t: any) => String(t.tag));

/** A post in any status, as stored. */
export function getEditablePost(id: number): EditablePost | undefined {
  const row: any = db().prepare('SELECT * FROM posts WHERE id = ?').get(id);
  return row ? { id: Number(row.id), status: row.status, fields: fieldsOfRow(row, tagsOf(id)), sourceMd: row.source_md } : undefined;
}

/** Start a new, empty draft and return its id. */
export function createDraft(): number {
  const conn = db();
  let n = Number((conn.prepare('SELECT coalesce(max(id), 0) + 1 AS n FROM posts').get() as any).n);
  while (conn.prepare('SELECT 1 FROM posts WHERE slug = ?').get(`untitled-${n}`)) n++;
  const result = conn
    .prepare(
      `INSERT INTO posts (slug, title, status, source_md, html, headings_json, words, minutes, published_at)
       VALUES (?, '未命名', 'draft', '', '', '[]', 0, 1, ?)`,
    )
    .run(`untitled-${n}`, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

/**
 * Store the editor's content as the post itself.
 * Publishing (status 'published') also records a revision. The autosaved
 * working copy is cleared either way, since it is now what is stored.
 */
export async function writePost(id: number, fields: PostFields, sourceMd: string, status: PostStatus): Promise<void> {
  const rendered = await renderMarkdown(sourceMd);
  transaction(() => {
    const conn = db();
    const before: any = conn.prepare('SELECT slug FROM posts WHERE id = ?').get(id);
    if (!before) throw new Error('post not found');
    conn
      .prepare(
        `UPDATE posts SET slug = ?, title = ?, summary = ?, category = ?, series = ?, series_order = ?, cover_media_id = ?,
           status = ?, hidden = ?, pinned = ?, comments_enabled = ?, source_md = ?, html = ?, headings_json = ?,
           words = ?, minutes = ?, published_at = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        fields.slug, fields.title, fields.summary ?? null, fields.category ?? null, fields.series ?? null, fields.seriesOrder ?? null,
        fields.coverMediaId ?? null, status, fields.hidden ? 1 : 0, fields.pinned ? 1 : 0, fields.commentsEnabled ? 1 : 0,
        sourceMd, rendered.html, JSON.stringify(rendered.headings), rendered.words, rendered.minutes,
        fields.publishedAt, fields.updatedAt ?? null, id,
      );
    conn.prepare('DELETE FROM post_tags WHERE post_id = ?').run(id);
    const addTag = conn.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)');
    for (const tag of fields.tags) addTag.run(id, tag);

    // The address now belongs to this post; an old redirect from it would loop.
    conn.prepare('DELETE FROM post_redirects WHERE old_slug = ?').run(fields.slug);
    if (before.slug !== fields.slug && status === 'published') {
      conn.prepare('INSERT OR REPLACE INTO post_redirects (old_slug, post_id) VALUES (?, ?)').run(before.slug, id);
    }
    if (status === 'published') {
      conn
        .prepare('INSERT INTO post_revisions (post_id, fields_json, source_md, created_at) VALUES (?, ?, ?, ?)')
        .run(id, JSON.stringify(fields), sourceMd, new Date().toISOString());
    }
    conn.prepare('DELETE FROM post_working_copies WHERE post_id = ?').run(id);
  });
}

export function deletePost(id: number): boolean {
  return Number(db().prepare('DELETE FROM posts WHERE id = ?').run(id).changes) === 1;
}

export interface WorkingCopy {
  fields: PostFields;
  sourceMd: string;
  savedAt: string;
}

/** Autosave: keep the editor's unsaved state without touching the post itself. */
export function saveWorkingCopy(id: number, fields: PostFields, sourceMd: string): string | undefined {
  if (!db().prepare('SELECT 1 FROM posts WHERE id = ?').get(id)) return undefined;
  const savedAt = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO post_working_copies (post_id, fields_json, source_md, saved_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(post_id) DO UPDATE SET fields_json = excluded.fields_json, source_md = excluded.source_md, saved_at = excluded.saved_at`,
    )
    .run(id, JSON.stringify(fields), sourceMd, savedAt);
  return savedAt;
}

export function getWorkingCopy(id: number): WorkingCopy | undefined {
  const row: any = db().prepare('SELECT fields_json, source_md, saved_at FROM post_working_copies WHERE post_id = ?').get(id);
  return row ? { fields: JSON.parse(row.fields_json), sourceMd: row.source_md, savedAt: row.saved_at } : undefined;
}

export function discardWorkingCopy(id: number): void {
  db().prepare('DELETE FROM post_working_copies WHERE post_id = ?').run(id);
}

export interface Revision {
  id: number;
  createdAt: string;
  title: string;
  characters: number;
}

export function listRevisions(postId: number): Revision[] {
  return db()
    .prepare('SELECT id, created_at, fields_json, length(source_md) AS n FROM post_revisions WHERE post_id = ? ORDER BY id DESC LIMIT 50')
    .all(postId)
    .map((r: any) => ({ id: Number(r.id), createdAt: r.created_at, title: JSON.parse(r.fields_json).title ?? '', characters: Number(r.n) }));
}

export function getRevision(postId: number, revisionId: number): { fields: PostFields; sourceMd: string } | undefined {
  const row: any = db().prepare('SELECT fields_json, source_md FROM post_revisions WHERE id = ? AND post_id = ?').get(revisionId, postId);
  return row ? { fields: JSON.parse(row.fields_json), sourceMd: row.source_md } : undefined;
}

/** How a post would look with these fields and this text, without storing anything. */
export async function renderDraft(fields: PostFields, sourceMd: string): Promise<PostFull> {
  const rendered = await renderMarkdown(sourceMd);
  return {
    id: 0,
    slug: fields.slug,
    title: fields.title,
    summary: fields.summary,
    category: fields.category,
    series: fields.series,
    seriesOrder: fields.seriesOrder,
    cover: fields.coverMediaId ? coverOf(mediaById(fields.coverMediaId)) : undefined,
    coverMediaId: fields.coverMediaId,
    status: 'draft',
    hidden: fields.hidden,
    pinned: fields.pinned,
    commentsEnabled: fields.commentsEnabled,
    words: rendered.words,
    minutes: rendered.minutes,
    publishedAt: new Date(fields.publishedAt),
    updatedAt: fields.updatedAt ? new Date(fields.updatedAt) : undefined,
    tags: fields.tags,
    sourceMd,
    html: rendered.html,
    headings: rendered.headings,
  };
}