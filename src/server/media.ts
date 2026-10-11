// Content-addressed store for images and attachments used in posts.
//
// Files live at <DATA_DIR>/media/<first two hex chars>/<sha256>.<ext> and are
// served from /media/... at the same relative path. Raster images also get a
// WebP "display" copy (<sha256>.d.webp), which is what pages reference.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { dataPath } from './config.ts';
import { db } from './db.ts';

const RASTER = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};
/** Longest edge of the display copy. Larger originals are scaled down. */
const DISPLAY_MAX = 2560;
export const COVER_WIDTHS = [640, 1000, 1400];

export interface Media {
  id: number;
  sha256: string;
  ext: string;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
}

const relDir = (sha: string) => `${sha.slice(0, 2)}`;
const fileOf = (sha: string, suffix: string) => dataPath('media', relDir(sha), `${sha}.${suffix}`);
const urlOf = (sha: string, suffix: string) => `/media/${relDir(sha)}/${sha}.${suffix}`;

export const isRaster = (m: Pick<Media, 'ext'>) => RASTER.has(m.ext);

/** URL of the file as uploaded. */
export const originalUrl = (m: Pick<Media, 'sha256' | 'ext'>) => urlOf(m.sha256, m.ext);

/** URL pages should use: the WebP display copy for raster images, the original otherwise. */
export const displayUrl = (m: Pick<Media, 'sha256' | 'ext'>) => (isRaster(m) ? urlOf(m.sha256, 'd.webp') : originalUrl(m));

/** The sha256 a /media/ URL points at, if it is one of ours. */
export function shaFromUrl(url: string): string | undefined {
  return /^\/media\/[0-9a-f]{2}\/([0-9a-f]{64})\./.exec(url)?.[1];
}

export function findMedia(sha: string): Media | undefined {
  return db().prepare('SELECT * FROM media WHERE sha256 = ?').get(sha) as Media | undefined;
}

export function mediaById(id: number): Media | undefined {
  return db().prepare('SELECT * FROM media WHERE id = ?').get(id) as Media | undefined;
}

/** Add a file to the store, or return the existing record for the same content. */
export async function ingestFile(source: string): Promise<Media> {
  const buf = fs.readFileSync(source);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const existing = findMedia(sha);
  const ext = path.extname(source).slice(1).toLowerCase() || 'bin';

  const original = fileOf(sha, ext);
  fs.mkdirSync(path.dirname(original), { recursive: true });
  if (!fs.existsSync(original)) fs.writeFileSync(original, buf);

  let width: number | null = null;
  let height: number | null = null;
  if (RASTER.has(ext)) {
    const display = fileOf(sha, 'd.webp');
    if (!fs.existsSync(display)) {
      await sharp(buf, { limitInputPixels: 100_000_000 })
        .rotate()
        .resize({ width: DISPLAY_MAX, height: DISPLAY_MAX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(display);
    }
    const meta = await sharp(display).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } else if (ext === 'svg') {
    const meta = await sharp(buf).metadata().catch(() => undefined);
    width = meta?.width ?? null;
    height = meta?.height ?? null;
  }

  if (existing) return existing;
  db()
    .prepare(
      'INSERT INTO media (sha256, ext, filename, mime, size, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(sha, ext, path.basename(source), MIME[ext] ?? 'application/octet-stream', buf.length, width, height, new Date().toISOString());
  return findMedia(sha)!;
}

export interface Cover {
  src: string;
  srcset: string;
  width: number;
  height: number;
  /** 1200×630 JPEG for link previews. */
  og: string;
}

/** Generate the responsive and link-preview copies a cover image needs. */
export async function ensureCoverVariants(m: Media): Promise<void> {
  if (!isRaster(m)) return;
  const source = fileOf(m.sha256, 'd.webp');
  for (const w of COVER_WIDTHS) {
    if (!m.width || w >= m.width) continue;
    const out = fileOf(m.sha256, `w${w}.webp`);
    if (!fs.existsSync(out)) await sharp(source).resize({ width: w }).webp({ quality: 80 }).toFile(out);
  }
  const og = fileOf(m.sha256, 'og.jpg');
  if (!fs.existsSync(og)) await sharp(source).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(og);
}

export function coverOf(m: Media | undefined): Cover | undefined {
  if (!m || !isRaster(m) || !m.width || !m.height) return undefined;
  const steps = COVER_WIDTHS.filter((w) => w < m.width!).map((w) => `${urlOf(m.sha256, `w${w}.webp`)} ${w}w`);
  steps.push(`${displayUrl(m)} ${m.width}w`);
  return { src: displayUrl(m), srcset: steps.join(', '), width: m.width, height: m.height, og: urlOf(m.sha256, 'og.jpg') };
}

/* ---------- management: uploads and the media library ---------- */

/** Largest upload accepted for a post image or attachment. */
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const ATTACHMENTS = new Set(['pdf', 'zip', 'txt', 'md', 'csv', 'json', 'java', 'py', 'c', 'cpp', 'h', 'js', 'ts', 'sh']);

/**
 * Store an upload. Raster images must actually decode as images; anything
 * else must have one of a short list of harmless extensions. SVG is refused
 * because an SVG opened directly can run scripts on this site's origin.
 */
export async function ingestUpload(filename: string, body: Buffer): Promise<Media> {
  if (body.length === 0) throw new Error('没有收到文件');
  if (body.length > MAX_MEDIA_BYTES) throw new Error('文件太大了（上限 50 MB）');
  const base = path.basename(filename).replace(/[\x00-\x1f<>:"/\\|?*]/g, '_').slice(-120) || 'file';
  const ext = path.extname(base).slice(1).toLowerCase();
  if (RASTER.has(ext)) {
    try {
      await sharp(body, { limitInputPixels: 100_000_000 }).metadata();
    } catch {
      throw new Error('这不是一张有效的图片');
    }
  } else if (!ATTACHMENTS.has(ext)) {
    throw new Error(`不支持上传 .${ext || '?'} 文件`);
  }
  const tmpDir = dataPath('tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmp = path.join(tmpDir, `${crypto.randomUUID()}.${ext}`);
  fs.writeFileSync(tmp, body);
  try {
    const media = await ingestFile(tmp);
    // ingestFile recorded the temporary name; keep the one the file was uploaded with.
    db().prepare('UPDATE media SET filename = ? WHERE id = ? AND filename = ?').run(base, media.id, path.basename(tmp));
    return findMedia(media.sha256)!;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export interface MediaEntry extends Media {
  url: string;
  /** Posts whose text or cover refers to this file. */
  usedBy: { id: number; title: string }[];
}

export function listMedia(): MediaEntry[] {
  const posts: any[] = db().prepare('SELECT id, title, source_md, cover_media_id FROM posts').all();
  const copies: any[] = db().prepare('SELECT post_id, source_md, fields_json FROM post_working_copies').all();
  return (db().prepare('SELECT * FROM media ORDER BY id DESC').all() as unknown as Media[]).map((m) => {
    const used = posts.filter(
      (p) => p.cover_media_id === m.id || p.source_md.includes(m.sha256) || copies.some((c) => c.post_id === p.id && (c.source_md.includes(m.sha256) || c.fields_json.includes(`"coverMediaId":${m.id}`))),
    );
    return { ...m, url: displayUrl(m), usedBy: used.map((p) => ({ id: Number(p.id), title: p.title })) };
  });
}

/** Delete a file nothing refers to. Returns false when it is still in use or unknown. */
export function deleteMedia(id: number): boolean {
  const entry = listMedia().find((m) => m.id === id);
  if (!entry || entry.usedBy.length > 0) return false;
  db().prepare('DELETE FROM media WHERE id = ?').run(id);
  const dir = dataPath('media', relDir(entry.sha256));
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) if (name.startsWith(`${entry.sha256}.`)) fs.rmSync(path.join(dir, name), { force: true });
  }
  return true;
}