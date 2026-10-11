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