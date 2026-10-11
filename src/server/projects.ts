// Works the author publishes for download: a project has versions, a version
// has files. Files are stored by content at <DATA_DIR>/files/<aa>/<sha256>.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dataPath } from './config.ts';
import { db, transaction } from './db.ts';
import { coverOf, displayUrl, ensureCoverVariants, isRaster, mediaById, originalUrl, type Cover } from './media.ts';
import { GUEST, SLUG_PATTERN, type Viewer } from './posts.ts';
import { renderMarkdown } from './render.ts';

export const PROJECT_KINDS = { mod: 'Mod', app: '应用', other: '其他' } as const;
export type ProjectKind = keyof typeof PROJECT_KINDS;

/** Largest single file. Kept under GitHub's 2 GiB attachment ceiling so every file can be backed up. */
export const maxFileBytes = () => Number(process.env.MAX_FILE_BYTES) || Math.floor(1.9 * 1024 ** 3);

export class ProjectError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface ProjectLink {
  label: string;
  url: string;
}

export interface ProjectImage {
  id: number;
  /** The display copy, for the page. */
  url: string;
  /** The file as uploaded, for the enlarged view. */
  full: string;
  width: number | null;
  height: number | null;
}

export interface ProjectFile {
  id: number;
  filename: string;
  note?: string;
  sha256: string;
  size: number;
  downloads: number;
  createdAt: Date;
  url: string;
}

export interface ProjectRelease {
  id: number;
  version: string;
  notesMd: string;
  notesHtml: string;
  createdAt: Date;
  files: ProjectFile[];
}

export interface ProjectSummary {
  id: number;
  slug: string;
  kind: ProjectKind;
  title: string;
  summary?: string;
  cover?: Cover;
  coverMediaId?: number;
  /** Visible to the endministrator only. */
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
  latestVersion?: string;
  downloads: number;
  fileCount: number;
}

export interface ProjectFull extends ProjectSummary {
  descriptionMd: string;
  descriptionHtml: string;
  links: ProjectLink[];
  images: ProjectImage[];
  /** A post about this work. Resolve it with `projectPost`, which applies the viewer's rights. */
  postId?: number;
  /** Newest first. */
  releases: ProjectRelease[];
}

/** The post a project points to, if `viewer` can read it. Drafts and (for guests) hidden posts yield nothing. */
export function projectPost(postId: number | undefined, viewer: Viewer = GUEST): { slug: string; title: string } | undefined {
  if (!postId) return undefined;
  const hiddenToo = viewer.role === 'endmin' ? '' : ' AND hidden = 0';
  const row: any = db().prepare(`SELECT slug, title FROM posts WHERE id = ? AND status = 'published'${hiddenToo}`).get(postId);
  return row ? { slug: row.slug, title: row.title } : undefined;
}

const visibleTo = (viewer: Viewer) => (viewer.role === 'endmin' ? '1 = 1' : 'hidden = 0');
export const downloadUrl = (assetId: number, filename: string) => `/dl/${assetId}/${encodeURIComponent(filename)}`;
const blobPath = (sha: string) => dataPath('files', sha.slice(0, 2), sha);

function toSummary(row: any): ProjectSummary {
  const totals: any = db()
    .prepare('SELECT COUNT(a.id) AS files, COALESCE(SUM(a.downloads), 0) AS downloads FROM releases r LEFT JOIN assets a ON a.release_id = r.id WHERE r.project_id = ?')
    .get(row.id);
  const latest: any = db().prepare('SELECT version FROM releases WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT 1').get(row.id);
  return {
    id: Number(row.id),
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    summary: row.summary ?? undefined,
    cover: row.cover_media_id ? coverOf(mediaById(Number(row.cover_media_id))) : undefined,
    coverMediaId: row.cover_media_id ? Number(row.cover_media_id) : undefined,
    hidden: !!row.hidden,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    latestVersion: latest?.version,
    downloads: Number(totals.downloads),
    fileCount: Number(totals.files),
  };
}

function toFull(row: any): ProjectFull {
  const images: ProjectImage[] = [];
  for (const id of JSON.parse(row.images_json) as number[]) {
    const m = mediaById(id);
    if (m && isRaster(m)) images.push({ id: m.id, url: displayUrl(m), full: originalUrl(m), width: m.width, height: m.height });
  }
  const files = db().prepare('SELECT * FROM assets WHERE release_id = ? ORDER BY filename');
  const releases = (db().prepare('SELECT * FROM releases WHERE project_id = ? ORDER BY created_at DESC, id DESC').all(row.id) as any[]).map(
    (r): ProjectRelease => ({
      id: Number(r.id),
      version: r.version,
      notesMd: r.notes_md,
      notesHtml: r.notes_html,
      createdAt: new Date(r.created_at),
      files: (files.all(r.id) as any[]).map((a) => ({
        id: Number(a.id),
        filename: a.filename,
        note: a.note ?? undefined,
        sha256: a.sha256,
        size: Number(a.size),
        downloads: Number(a.downloads),
        createdAt: new Date(a.created_at),
        url: downloadUrl(Number(a.id), a.filename),
      })),
    }),
  );
  return { ...toSummary(row), descriptionMd: row.description_md, descriptionHtml: row.description_html, links: JSON.parse(row.links_json), images, postId: row.post_id ? Number(row.post_id) : undefined, releases };
}

/** Projects `viewer` may see, most recently updated first. */
export function listProjects(viewer: Viewer = GUEST): ProjectSummary[] {
  return (db().prepare(`SELECT * FROM projects WHERE ${visibleTo(viewer)} ORDER BY updated_at DESC, id DESC`).all() as any[]).map(toSummary);
}

export function getProject(slug: string, viewer: Viewer = GUEST): ProjectFull | undefined {
  const row = db().prepare(`SELECT * FROM projects WHERE slug = ? AND ${visibleTo(viewer)}`).get(slug);
  return row ? toFull(row) : undefined;
}

export function getProjectById(id: number): ProjectFull | undefined {
  const row = db().prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return row ? toFull(row) : undefined;
}

const touch = (projectId: number) => db().prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), projectId);

/** A new, hidden project with placeholder values, ready to be edited. */
export function createProject(): number {
  const now = new Date().toISOString();
  const conn = db();
  for (let n = Number((conn.prepare('SELECT COALESCE(MAX(id), 0) AS n FROM projects').get() as any).n) + 1; ; n++) {
    const slug = `work-${n}`;
    if (conn.prepare('SELECT 1 FROM projects WHERE slug = ?').get(slug)) continue;
    return Number(conn.prepare("INSERT INTO projects (slug, title, hidden, created_at, updated_at) VALUES (?, '未命名作品', 1, ?, ?)").run(slug, now, now).lastInsertRowid);
  }
}

export interface ProjectInput {
  title: string;
  slug: string;
  kind: ProjectKind;
  summary?: string;
  descriptionMd: string;
  links: ProjectLink[];
  imageIds: number[];
  coverMediaId?: number;
  postId?: number;
  hidden: boolean;
}

const text =(value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Reduce whatever the form sent to well-formed values. Unusable links and images are dropped. */
export function normalizeProject(input: any): ProjectInput {
  const links: ProjectLink[] = [];
  for (const item of Array.isArray(input?.links) ? input.links.slice(0, 10) : []) {
    const label = text(item?.label, 40);
    let url: URL;
    try {
      url = new URL(text(item?.url, 500));
    } catch {
      continue;
    }
    if ((url.protocol === 'https:' || url.protocol === 'http:') && label) links.push({ label, url: url.href });
  }
  const ids = (Array.isArray(input?.imageIds) ? input.imageIds : []).map(Number).filter((id: number) => Number.isInteger(id) && id > 0);
  const cover = Number(input?.coverMediaId);
  const post = Number(input?.postId);
  return {
    postId: Number.isInteger(post) && post > 0 ? post : undefined,
    title: text(input?.title, 120),
    slug: text(input?.slug, 80).toLowerCase(),
    kind: input?.kind in PROJECT_KINDS ? input.kind : 'mod',
    summary: text(input?.summary, 300) || undefined,
    descriptionMd: typeof input?.descriptionMd === 'string' ? input.descriptionMd : '',
    links,
    imageIds: [...new Set<number>(ids)].slice(0, 60),
    coverMediaId: Number.isInteger(cover) && cover > 0 ? cover : undefined,
    hidden: input?.hidden !== false,
  };
}

/** Save the project's page. Throws ProjectError when something does not fit. */
export async function saveProject(id: number, input: ProjectInput): Promise<void> {
  const conn = db();
  if (!conn.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)) throw new ProjectError('作品不存在', 404);
  if (!input.title) throw new ProjectError('请填写名称');
  if (!SLUG_PATTERN.test(input.slug)) throw new ProjectError('地址只能用小写字母、数字和连字符');
  if (conn.prepare('SELECT 1 FROM projects WHERE slug = ? AND id <> ?').get(input.slug, id)) throw new ProjectError('这个地址已经被另一个作品使用');
  const images = input.imageIds.filter((mediaId) => {
    const m = mediaById(mediaId);
    return m && isRaster(m);
  });
  const cover = input.coverMediaId ? mediaById(input.coverMediaId) : undefined;
  if (input.coverMediaId && (!cover || !isRaster(cover))) throw new ProjectError('封面必须是媒体库里的一张图片');
  if (cover) await ensureCoverVariants(cover);
  if (input.postId && !conn.prepare('SELECT 1 FROM posts WHERE id = ?').get(input.postId)) throw new ProjectError('关联的文章不存在');
  const rendered = await renderMarkdown(input.descriptionMd);
  conn
    .prepare(
      `UPDATE projects SET title = ?, slug = ?, kind = ?, summary = ?, description_md = ?, description_html = ?,
         cover_media_id = ?, images_json = ?, links_json = ?, post_id = ?, hidden = ?, updated_at = ? WHERE id = ?`,
    )
    .run(input.title, input.slug, input.kind, input.summary ?? null, input.descriptionMd, rendered.html, cover?.id ?? null, JSON.stringify(images), JSON.stringify(input.links), input.postId ?? null, input.hidden ? 1 : 0, new Date().toISOString(), id);
}

export function setProjectHidden(id: number, hidden: boolean): boolean {
  return Number(db().prepare('UPDATE projects SET hidden = ?, updated_at = ? WHERE id = ?').run(hidden ? 1 : 0, new Date().toISOString(), id).changes) > 0;
}

/** Remove stored files that no version refers to any more. */
function sweep(shas: string[]): void {
  for (const sha of new Set(shas)) {
    if (!db().prepare('SELECT 1 FROM assets WHERE sha256 = ?').get(sha)) fs.rmSync(blobPath(sha), { force: true });
  }
}

const shasOf = (where: string, id: number) => (db().prepare(`SELECT a.sha256 FROM assets a JOIN releases r ON r.id = a.release_id WHERE ${where} = ?`).all(id) as any[]).map((r) => String(r.sha256));

export function deleteProject(id: number): boolean {
  const shas = shasOf('r.project_id', id);
  const done = Number(db().prepare('DELETE FROM projects WHERE id = ?').run(id).changes) > 0;
  sweep(shas);
  return done;
}

/* ---------- versions ---------- */

function cleanVersion(value: unknown): string {
  const version = text(value, 40);
  if (!version || /[\x00-\x1f/\\]/.test(version)) throw new ProjectError('请填写版本号，例如 1.0.0');
  return version;
}

export async function addRelease(projectId: number, input: { version: unknown; notesMd?: unknown }): Promise<number> {
  const conn = db();
  if (!conn.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) throw new ProjectError('作品不存在', 404);
  const version = cleanVersion(input.version);
  if (conn.prepare('SELECT 1 FROM releases WHERE project_id = ? AND version = ?').get(projectId, version)) throw new ProjectError(`已经有 ${version} 这个版本`);
  const notes = typeof input.notesMd === 'string' ? input.notesMd : '';
  const html = (await renderMarkdown(notes)).html;
  const id = Number(conn.prepare('INSERT INTO releases (project_id, version, notes_md, notes_html, created_at) VALUES (?, ?, ?, ?, ?)').run(projectId, version, notes, html, new Date().toISOString()).lastInsertRowid);
  touch(projectId);
  return id;
}

export async function updateRelease(id: number, input: { version: unknown; notesMd?: unknown }): Promise<void> {
  const conn = db();
  const row: any = conn.prepare('SELECT project_id FROM releases WHERE id = ?').get(id);
  if (!row) throw new ProjectError('版本不存在', 404);
  const version = cleanVersion(input.version);
  if (conn.prepare('SELECT 1 FROM releases WHERE project_id = ? AND version = ? AND id <> ?').get(row.project_id, version, id)) throw new ProjectError(`已经有 ${version} 这个版本`);
  const notes = typeof input.notesMd === 'string' ? input.notesMd : '';
  conn.prepare('UPDATE releases SET version = ?, notes_md = ?, notes_html = ? WHERE id = ?').run(version, notes, (await renderMarkdown(notes)).html, id);
  touch(Number(row.project_id));
}

export function deleteRelease(id: number): boolean {
  const row: any = db().prepare('SELECT project_id FROM releases WHERE id = ?').get(id);
  if (!row) return false;
  const shas = shasOf('r.id', id);
  db().prepare('DELETE FROM releases WHERE id = ?').run(id);
  sweep(shas);
  touch(Number(row.project_id));
  return true;
}

/* ---------- files ---------- */

/** A name safe to store and to offer as a download: no path, no control characters. */
export function cleanFilename(value: unknown): string {
  const name = String(value ?? '')
    .split(/[/\\]/)
    .pop()!
    .replace(/[\x00-\x1f\x7f<>:"|?*]/g, '_')
    .trim()
    .slice(-150);
  if (!name || /^\.+$/.test(name)) throw new ProjectError('文件名不可用');
  return name;
}

/**
 * Store an upload as a file of a version. The body is streamed to disk while
 * its size is checked and its SHA-256 computed; nothing is kept in memory.
 */
export async function storeAsset(releaseId: number, filename: unknown, body: ReadableStream<Uint8Array> | Readable | null, note?: unknown): Promise<ProjectFile> {
  const conn = db();
  const release: any = conn.prepare('SELECT project_id FROM releases WHERE id = ?').get(releaseId);
  if (!release) throw new ProjectError('版本不存在', 404);
  const name = cleanFilename(filename);
  if (conn.prepare('SELECT 1 FROM assets WHERE release_id = ? AND filename = ?').get(releaseId, name)) throw new ProjectError(`这个版本里已经有 ${name}，请先删除原来的`);
  if (!body) throw new ProjectError('没有收到文件');

  const limit = maxFileBytes();
  const hash = crypto.createHash('sha256');
  let size = 0;
  const meter = new Transform({
    transform(chunk, _encoding, done) {
      size += chunk.length;
      if (size > limit) return done(new ProjectError(`文件太大了（上限 ${(limit / 1024 ** 3).toFixed(1)} GB）`, 413));
      hash.update(chunk);
      done(null, chunk);
    },
  });
  fs.mkdirSync(dataPath('tmp'), { recursive: true });
  const tmp = dataPath('tmp', `${crypto.randomUUID()}.upload`);
  try {
    await pipeline(body instanceof Readable ? body : Readable.fromWeb(body as any), meter, fs.createWriteStream(tmp));
    if (size === 0) throw new ProjectError('没有收到文件');
    const sha = hash.digest('hex');
    const target = blobPath(sha);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) fs.rmSync(tmp, { force: true });
    else fs.renameSync(tmp, target);
    const id = Number(
      conn
        .prepare('INSERT INTO assets (release_id, filename, note, sha256, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(releaseId, name, text(note, 120) || null, sha, size, new Date().toISOString()).lastInsertRowid,
    );
    touch(Number(release.project_id));
    return { id, filename: name, note: text(note, 120) || undefined, sha256: sha, size, downloads: 0, createdAt: new Date(), url: downloadUrl(id, name) };
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    if (err instanceof ProjectError) throw err;
    throw new ProjectError('上传中断了，请重试');
  }
}

export function deleteAsset(id: number): boolean {
  const row: any = db().prepare('SELECT a.sha256, r.project_id FROM assets a JOIN releases r ON r.id = a.release_id WHERE a.id = ?').get(id);
  if (!row) return false;
  transaction(() => db().prepare('DELETE FROM assets WHERE id = ?').run(id));
  sweep([row.sha256]);
  touch(Number(row.project_id));
  return true;
}

export interface Download {
  file: string;
  filename: string;
  size: number;
  sha256: string;
  /** The project is hidden, so the response must not be cached by anyone else. */
  hidden: boolean;
}

/** The file behind a download address, if `viewer` may have it. */
export function findDownload(assetId: number, viewer: Viewer = GUEST): Download | undefined {
  const row: any = db()
    .prepare(
      `SELECT a.filename, a.size, a.sha256, p.hidden FROM assets a
         JOIN releases r ON r.id = a.release_id JOIN projects p ON p.id = r.project_id
       WHERE a.id = ? AND ${visibleTo(viewer).replace('hidden', 'p.hidden')}`,
    )
    .get(assetId);
  if (!row) return undefined;
  const file = blobPath(row.sha256);
  return fs.existsSync(file) ? { file, filename: row.filename, size: Number(row.size), sha256: row.sha256, hidden: !!row.hidden } : undefined;
}

export function countDownload(assetId: number): void {
  db().prepare('UPDATE assets SET downloads = downloads + 1 WHERE id = ?').run(assetId);
}

/**
 * Which part of a file a Range header asks for. Returns undefined for the
 * whole file (no header, or one we do not understand) and null when the range
 * cannot be satisfied.
 */
export function parseRange(header: string | null, size: number): { start: number; end: number } | undefined | null {
  const m = header && /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return undefined;
  let start: number;
  let end: number;
  if (!m[1]) {
    // "the last N bytes"
    const n = Number(m[2]);
    if (n === 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  return start >= size || start > end ? null : { start, end };
}
