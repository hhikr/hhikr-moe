// Comments on posts.
import { commentProblem, renderBBCode } from './bbcode.ts';
import { db } from './db.ts';
import { postIdBySlug, type Viewer } from './posts.ts';
import { toPublic, userById, type PublicUser, type User } from './users.ts';

export type CommentStatus = 'visible' | 'hidden' | 'deleted';

export interface CommentView {
  id: number;
  parentId: number | null;
  html: string;
  createdAt: string;
  /** Null once the comment has been removed and only a placeholder remains. */
  author: PublicUser | null;
  mine: boolean;
  status: CommentStatus;
}

export class CommentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const getSetting = (key: string) => (db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as any)?.value as string | undefined;

/** When on, a person's first comment waits for the endministrator before others can see it. */
export const moderatingFirstComments = () => getSetting('moderate_first_comment') === '1';
export function setModeratingFirstComments(on: boolean): void {
  db().prepare("INSERT INTO settings (key, value) VALUES ('moderate_first_comment', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(on ? '1' : '0');
}

function commentsEnabled(postId: number): boolean {
  return !!(db().prepare('SELECT comments_enabled FROM posts WHERE id = ?').get(postId) as any)?.comments_enabled;
}

/**
 * The comments under a post as `viewer` may see them.
 * Hidden comments are shown only to their author and the endministrator.
 * Removed ones stay as placeholders while they still have replies.
 */
export function listComments(slug: string, viewer: Viewer, me?: User): { enabled: boolean; comments: CommentView[] } | undefined {
  const postId = postIdBySlug(slug, viewer);
  if (!postId) return undefined;
  const rows: any[] = db().prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at, id').all(postId);
  const isEndmin = viewer.role === 'endmin';
  const authors = new Map<number, PublicUser | null>();
  const authorOf = (id: number) => {
    if (!authors.has(id)) {
      const u = userById(id);
      authors.set(id, u ? toPublic(u) : null);
    }
    return authors.get(id)!;
  };

  const shown = (r: any) => r.status === 'visible' || (r.status === 'hidden' && (isEndmin || r.user_id === me?.id));
  const withVisibleReply = new Set(rows.filter((r) => r.parent_id && shown(r)).map((r) => Number(r.parent_id)));

  const comments: CommentView[] = [];
  for (const r of rows) {
    const mine = r.user_id === me?.id;
    if (shown(r)) {
      comments.push({ id: Number(r.id), parentId: r.parent_id, html: r.html, createdAt: r.created_at, author: authorOf(Number(r.user_id)), mine, status: r.status });
    } else if (!r.parent_id && withVisibleReply.has(Number(r.id))) {
      comments.push({ id: Number(r.id), parentId: null, html: '', createdAt: r.created_at, author: null, mine: false, status: 'deleted' });
    }
  }
  return { enabled: commentsEnabled(postId), comments };
}

export interface NewComment {
  slug: string;
  source: unknown;
  parentId?: unknown;
}

export function addComment(input: NewComment, viewer: Viewer, author: User): CommentView {
  const postId = postIdBySlug(String(input.slug ?? ''), viewer);
  if (!postId) throw new CommentError('找不到这篇文章', 404);
  if (!commentsEnabled(postId)) throw new CommentError('这篇文章没有开放评论', 403);
  const problem = commentProblem(input.source);
  if (problem) throw new CommentError(problem);
  const source = String(input.source).trim();

  let parentId: number | null = null;
  if (input.parentId !== undefined && input.parentId !== null) {
    const parent: any = db().prepare("SELECT id, parent_id, post_id, status FROM comments WHERE id = ?").get(Number(input.parentId));
    if (!parent || parent.post_id !== postId || parent.status === 'deleted') throw new CommentError('要回复的评论不存在', 404);
    // A reply to a reply joins the same thread.
    parentId = Number(parent.parent_id ?? parent.id);
  }

  const first = !db().prepare('SELECT 1 FROM comments WHERE user_id = ?').get(author.id);
  const status: CommentStatus = author.role !== 'endmin' && first && moderatingFirstComments() ? 'hidden' : 'visible';
  const createdAt = new Date().toISOString();
  const html = renderBBCode(source);
  const result = db()
    .prepare('INSERT INTO comments (post_id, user_id, parent_id, source, html, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(postId, author.id, parentId, source, html, status, createdAt);
  return { id: Number(result.lastInsertRowid), parentId, html, createdAt, author: toPublic(author), mine: true, status };
}

/** Remove a comment. Authors may remove their own; the endministrator may remove any. */
export function deleteComment(id: number, actor: User): boolean {
  const row: any = db().prepare('SELECT user_id FROM comments WHERE id = ?').get(id);
  if (!row) return false;
  if (row.user_id !== actor.id && actor.role !== 'endmin') throw new CommentError('不能删除别人的评论', 403);
  // The text is dropped; the row stays so that replies keep their place.
  db().prepare("UPDATE comments SET status = 'deleted', source = '', html = '' WHERE id = ?").run(id);
  return true;
}

/** Hide or restore a comment. Management only. */
export function setCommentStatus(id: number, status: 'visible' | 'hidden'): boolean {
  return Number(db().prepare("UPDATE comments SET status = ? WHERE id = ? AND status <> 'deleted'").run(status, id).changes) === 1;
}

export interface ModerationRow extends CommentView {
  postSlug: string;
  postTitle: string;
}

/** Every comment that still has text, newest first, for the management screen. */
export function listAllComments(limit = 200): ModerationRow[] {
  const rows: any[] = db()
    .prepare(
      `SELECT c.*, p.slug AS post_slug, p.title AS post_title FROM comments c JOIN posts p ON p.id = c.post_id
       WHERE c.status <> 'deleted' ORDER BY c.created_at DESC, c.id DESC LIMIT ?`,
    )
    .all(limit);
  return rows.map((r) => {
    const u = userById(Number(r.user_id));
    return {
      id: Number(r.id), parentId: r.parent_id, html: r.html, createdAt: r.created_at, author: u ? toPublic(u) : null,
      mine: false, status: r.status, postSlug: r.post_slug, postTitle: r.post_title,
    };
  });
}

export function commentCounts(): { total: number; hidden: number } {
  const row: any = db().prepare("SELECT count(*) AS total, sum(status = 'hidden') AS hidden FROM comments WHERE status <> 'deleted'").get();
  return { total: Number(row.total), hidden: Number(row.hidden ?? 0) };
}