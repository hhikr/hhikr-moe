// Backups to a private GitHub repository. Text and small files are committed
// with git, using the data directory itself as the work tree so nothing is
// stored twice. Files too large for git become release attachments named by
// their SHA-256.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dataDir, dataPath } from './config.ts';
import { db } from './db.ts';
import { formatBytes } from './system.ts';

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Every threshold the backup acts or warns on. */
export const BACKUP_LIMITS = {
  /** Larger files stay out of git and are uploaded as release attachments. GitHub warns at 50 MB and refuses at 100 MB. */
  gitFile: 50 * MB,
  /** GitHub's ceiling for one release attachment. */
  asset: 2 * GB,
  /** GitHub's recommended and hard-ish repository sizes. */
  repoWarn: 1 * GB,
  repoDanger: 5 * GB,
  /** A release holds 1000 attachments. */
  assetsPerRelease: 900,
  /** Warn this many days before the access token expires. */
  tokenDays: 14,
  /** A backup older than this is a problem. */
  staleHours: 48,
};
export type BackupLimits = typeof BACKUP_LIMITS;

export interface BackupWarning {
  level: 'red' | 'yellow';
  message: string;
}

export interface BackupConfig {
  /** owner/name of the private repository. */
  repo: string;
  token: string;
  gitDir: string;
}

export function backupConfig(): BackupConfig | undefined {
  const repo = process.env.BACKUP_REPO?.trim();
  const token = process.env.BACKUP_GITHUB_TOKEN?.trim();
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return undefined;
  return { repo, token, gitDir: process.env.BACKUP_GIT_DIR || path.resolve(dataDir(), '..', 'backup.git') };
}

export interface BackupOptions {
  config?: BackupConfig;
  now?: Date;
  limits?: Partial<BackupLimits>;
  /** Where to push instead of github.com. For tests. */
  remoteUrl?: string;
  fetch?: typeof fetch;
  apiBase?: string;
  uploadBase?: string;
}

const getSetting = (key: string) => (db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as any)?.value as string | undefined;
function setSetting(key: string, value: string | undefined): void {
  if (value === undefined) db().prepare('DELETE FROM settings WHERE key = ?').run(key);
  else db().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

/* ---------- export ---------- */

// Rows that are only meaningful while the site is running, or that would make
// every backup differ from the last. Their tables are still created on restore.
const NOT_EXPORTED = new Set(['sessions', 'rate_limits', 'login_links', 'used_challenges', 'stats_seen', 'backup_runs']);

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** The whole database as SQL text, in a stable order so that git shows real differences. */
export function dumpSql(): string {
  const conn = db();
  const objects = conn
    .prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY (type = 'table') DESC, name")
    .all() as { type: string; name: string; sql: string }[];
  const out = ['PRAGMA foreign_keys = OFF;', 'BEGIN TRANSACTION;'];
  for (const object of objects) {
    out.push(`${object.sql};`);
    if (object.type !== 'table' || NOT_EXPORTED.has(object.name)) continue;
    const keys = (conn.prepare(`PRAGMA table_info("${object.name}")`).all() as any[])
      .filter((c) => Number(c.pk) > 0)
      .sort((a, b) => Number(a.pk) - Number(b.pk))
      .map((c) => `"${c.name}"`);
    const rows = conn.prepare(`SELECT * FROM "${object.name}" ORDER BY ${keys.length ? keys.join(', ') : 'rowid'}`).all() as Record<string, unknown>[];
    for (const row of rows) out.push(`INSERT INTO "${object.name}" VALUES (${Object.values(row).map(literal).join(', ')});`);
  }
  out.push('COMMIT;', '');
  return out.join('\n');
}

/** Each post as a Markdown file with front matter, for people to read and for per-post history on GitHub. */
function exportPosts(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  const rows = db()
    .prepare('SELECT id, slug, title, summary, category, series, series_order, status, hidden, pinned, comments_enabled, published_at, updated_at, source_md FROM posts ORDER BY slug')
    .all() as any[];
  const tags = db().prepare('SELECT tag FROM post_tags WHERE post_id = ? ORDER BY rowid');
  const wanted = new Set<string>();
  for (const row of rows) {
    const front: [string, unknown][] = [
      ['title', row.title],
      ['slug', row.slug],
      ['date', row.published_at],
      ['updated', row.updated_at],
      ['status', row.status],
      ['hidden', !!row.hidden],
      ['pinned', !!row.pinned],
      ['comments', !!row.comments_enabled],
      ['category', row.category],
      ['series', row.series],
      ['seriesOrder', row.series_order],
      ['tags', tags.all(row.id).map((t: any) => String(t.tag))],
      ['summary', row.summary],
    ];
    const head = front.filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
    const name = `${row.slug}.md`;
    wanted.add(name);
    fs.writeFileSync(path.join(dir, name), `---\n${head.join('\n')}\n---\n\n${row.source_md}\n`);
  }
  for (const name of fs.readdirSync(dir)) if (!wanted.has(name)) fs.rmSync(path.join(dir, name), { force: true });
}

/** Write the database dump and the Markdown copies into <data>/export. */
export function writeExport(): void {
  fs.mkdirSync(dataPath('export'), { recursive: true });
  fs.writeFileSync(dataPath('export', 'db.sql'), dumpSql());
  exportPosts(dataPath('export', 'posts'));
}

/* ---------- what goes where ---------- */

interface Candidate {
  /** Relative to the data directory, with forward slashes. */
  path: string;
  size: number;
}

function walk(top: string): Candidate[] {
  const dir = dataPath(top);
  if (!fs.existsSync(dir)) return [];
  const found: Candidate[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    found.push({ path: path.relative(dataDir(), file).split(path.sep).join('/'), size: fs.statSync(file).size });
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

// Never committed: the live database (the dump is), things that can be rebuilt,
// and downloads, which always travel as attachments.
const ALWAYS_EXCLUDED = ['/site.db*', '/pagefind/', '/pagefind.next/', '/pagefind.old/', '/tmp/', '/files/', '/apps/'];

/** Files that are backed up as release attachments: all downloads, and media too large for git. */
export function attachmentCandidates(limits: BackupLimits = BACKUP_LIMITS): { attachments: Candidate[]; oversizedMedia: Candidate[] } {
  const oversizedMedia = [...walk('media'), ...walk('avatars')].filter((f) => f.size > limits.gitFile);
  return { attachments: [...walk('files'), ...oversizedMedia], oversizedMedia };
}

// Downloads are stored under their own SHA-256, so it need not be computed
// again. Media is always hashed: its resized copies carry the original's name.
const nameHash = (file: string) => (file.startsWith('files/') ? /^[0-9a-f]{64}$/.exec(path.posix.basename(file))?.[0] : undefined);

async function hashFile(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

/* ---------- git ---------- */

class TokenError extends Error {}

function run(command: string, args: string[], env: NodeJS.ProcessEnv, cwd: string, secret: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, cwd, windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('error', (e) => reject(new Error(`${command}: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) return resolve(out);
      const text = (err || out).trim().split(secret).join('***').slice(-600);
      const refused = /authentication failed|could not read username|invalid credentials|returned error: 40[13]/i.test(text);
      reject(refused ? new TokenError(text) : new Error(`git ${args.find((a, i) => a !== '-c' && args[i - 1] !== '-c')}: ${text}`));
    });
  });
}

function gitRunner(config: BackupConfig) {
  const base: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_DIR: config.gitDir,
    GIT_WORK_TREE: dataDir(),
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'hhikr.moe',
    GIT_AUTHOR_EMAIL: 'backup@hhikr.moe',
    GIT_COMMITTER_NAME: 'hhikr.moe',
    GIT_COMMITTER_EMAIL: 'backup@hhikr.moe',
  };
  // The token travels in the environment only: it is never written to the
  // repository's configuration and does not show up in the process list.
  const withToken: NodeJS.ProcessEnv = {
    ...base,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.extraHeader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${config.token}`).toString('base64')}`,
  };
  const fixed = ['-c', 'core.autocrlf=false', '-c', 'core.quotepath=false', '-c', 'commit.gpgsign=false', '-c', 'core.fileMode=false'];
  return (args: string[], authenticated = false) => run('git', [...fixed, ...args], authenticated ? withToken : base, dataDir(), config.token);
}

/* ---------- GitHub ---------- */

function parseExpiry(header: string | null): string | undefined {
  const m = header && /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ?(UTC|[+-]\d{4})?$/.exec(header.trim());
  if (!m) return undefined;
  const zone = !m[3] || m[3] === 'UTC' ? 'Z' : `${m[3].slice(0, 3)}:${m[3].slice(3)}`;
  const date = new Date(`${m[1]}T${m[2]}${zone}`);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function githubClient(config: BackupConfig, options: BackupOptions) {
  const doFetch = options.fetch ?? fetch;
  const headers = {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'hhikr-moe-backup',
  };
  const client = {
    api: `${options.apiBase ?? 'https://api.github.com'}/repos/${config.repo}`,
    uploads: `${options.uploadBase ?? 'https://uploads.github.com'}/repos/${config.repo}`,
    /** When the token expires, once a response has said so. `null` means it does not expire. */
    expiry: undefined as string | null | undefined,
    async call(method: string, url: string, init: RequestInit & { duplex?: 'half' } = {}): Promise<Response> {
      const res = await doFetch(url, { ...init, method, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
      if (res.status === 401) throw new TokenError('GitHub rejected the token');
      if (res.ok) client.expiry = parseExpiry(res.headers.get('github-authentication-token-expiration')) ?? null;
      return res;
    },
  };
  return client;
}

async function problem(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  let message = text.slice(0, 200);
  try {
    message = JSON.parse(text).message ?? message;
  } catch {}
  return `GitHub 返回 ${res.status}${message ? `：${message}` : ''}`;
}

/* ---------- one run ---------- */

export interface BackupRun {
  id: number;
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
  committed: boolean;
  uploaded: number;
  repoBytes?: number;
  warnings: BackupWarning[];
  error?: string;
}

const toRun = (row: any): BackupRun => ({
  id: Number(row.id),
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined,
  ok: !!row.ok,
  committed: !!row.committed,
  uploaded: Number(row.uploaded),
  repoBytes: row.repo_bytes === null ? undefined : Number(row.repo_bytes),
  warnings: JSON.parse(row.warnings_json),
  error: row.error ?? undefined,
});

const RUNNING_WINDOW_MS = 2 * 3600_000;

/** A run that started recently and has not finished. One that old is taken to have died. */
function runningRow(now: Date): any {
  return db()
    .prepare('SELECT * FROM backup_runs WHERE finished_at IS NULL AND started_at > ? ORDER BY id DESC LIMIT 1')
    .get(new Date(now.getTime() - RUNNING_WINDOW_MS).toISOString());
}

/**
 * Export, commit, push and upload. Never throws: what went wrong is recorded
 * with the run. Returns undefined when another backup is still in progress.
 */
export async function runBackup(options: BackupOptions = {}): Promise<BackupRun | undefined> {
  const now = options.now ?? new Date();
  const limits = { ...BACKUP_LIMITS, ...options.limits };
  const config = options.config ?? backupConfig();
  const conn = db();
  if (runningRow(now)) return undefined;
  const id = Number(conn.prepare('INSERT INTO backup_runs (started_at) VALUES (?)').run(now.toISOString()).lastInsertRowid);

  const warnings: BackupWarning[] = [];
  let ok = false;
  let committed = false;
  let uploaded = 0;
  let repoBytes: number | undefined;
  let error: string | undefined;

  try {
    if (!config) throw new Error('备份还没有配置：缺少 BACKUP_REPO 或 BACKUP_GITHUB_TOKEN');
    const git = gitRunner(config);
    const github = githubClient(config, options);

    // Ask GitHub about the repository first: this proves the token works,
    // tells us when it expires, and stops everything if the repository has
    // been made public, since the backup holds password hashes and drafts.
    const about = await github.call('GET', github.api);
    if (!about.ok) throw new Error(await problem(about));
    if ((await about.json()).private !== true) throw new Error(`备份仓库 ${config.repo} 不是私有的，已停止备份。`);
    setSetting('backup_token_expires', github.expiry ?? undefined);
    setSetting('backup_token_invalid', undefined);

    writeExport();
    // Clones must be byte-for-byte: no line-ending conversion on any platform.
    fs.writeFileSync(dataPath('.gitattributes'), '* -text\n');
    const { attachments, oversizedMedia } = attachmentCandidates(limits);

    fs.mkdirSync(config.gitDir, { recursive: true });
    if (!fs.existsSync(path.join(config.gitDir, 'HEAD'))) await git(['init', '-q', '-b', 'main']);
    fs.mkdirSync(path.join(config.gitDir, 'info'), { recursive: true });
    fs.writeFileSync(path.join(config.gitDir, 'info', 'exclude'), [...ALWAYS_EXCLUDED, ...oversizedMedia.map((f) => `/${f.path}`), ''].join('\n'));

    const commitAndPush = async () => {
      await git(['add', '-A']);
      if ((await git(['status', '--porcelain'])).trim()) {
        await git(['commit', '-q', '-m', `Backup ${now.toISOString()}`]);
        committed = true;
      }
      // Pushed every time, so a run whose push failed is made up for by the next.
      await git(['push', '-q', options.remoteUrl ?? `https://github.com/${config.repo}.git`, 'HEAD:refs/heads/main'], true);
    };
    await commitAndPush();
    await git(['gc', '--auto', '-q']).catch(() => {});
    const sizes = await git(['count-objects', '-v']);
    const kib = (name: string) => Number(new RegExp(`^${name}: (\\d+)`, 'm').exec(sizes)?.[1] ?? 0);
    repoBytes = (kib('size') + kib('size-pack')) * 1024;
    // The repository itself is safe at this point, whatever happens to the attachments.
    ok = true;

    if (repoBytes > limits.repoDanger) warnings.push({ level: 'red', message: `备份仓库已有 ${formatBytes(repoBytes)}，超过 ${formatBytes(limits.repoDanger)}，GitHub 可能要求清理。` });
    else if (repoBytes > limits.repoWarn) warnings.push({ level: 'yellow', message: `备份仓库已有 ${formatBytes(repoBytes)}，超过 GitHub 建议的 ${formatBytes(limits.repoWarn)}。` });

    // Attachments. One failing does not stop the others.
    const tag = `blobs-${now.toISOString().slice(0, 7)}`;
    const known = new Map((conn.prepare('SELECT * FROM backup_blobs').all() as any[]).map((r) => [String(r.path), r]));
    let releaseId: number | undefined;
    const release = async () => {
      if (releaseId) return releaseId;
      let res = await github.call('GET', `${github.api}/releases/tags/${tag}`);
      if (res.status === 404) {
        res = await github.call('POST', `${github.api}/releases`, {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_name: tag, target_commitish: 'main', name: tag, body: 'Files too large for git. Each attachment is named by its SHA-256.' }),
        });
      }
      if (!res.ok) throw new Error(await problem(res));
      return (releaseId = Number((await res.json()).id));
    };
    const upload = async (file: Candidate, sha: string, retry = true): Promise<number> => {
      const to = await release();
      const res = await github.call('POST', `${github.uploads}/releases/${to}/assets?name=${sha}`, {
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(file.size) },
        body: Readable.toWeb(fs.createReadStream(dataPath(file.path))) as any,
        duplex: 'half',
      });
      if (res.status === 201) {
        const asset = await res.json();
        if (Number(asset.size) !== file.size) throw new Error(`上传后的大小不符（${asset.size} 与 ${file.size}）`);
        return Number(asset.id);
      }
      if (res.status !== 422) throw new Error(await problem(res));
      // Already there: the same content under another path, or the remains of an interrupted upload.
      for (let page = 1; page <= 10; page++) {
        const list = await github.call('GET', `${github.api}/releases/${to}/assets?per_page=100&page=${page}`);
        if (!list.ok) throw new Error(await problem(list));
        const assets = (await list.json()) as any[];
        const existing = assets.find((a) => a.name === sha);
        if (existing && Number(existing.size) === file.size && existing.state === 'uploaded') return Number(existing.id);
        if (existing && retry) {
          await github.call('DELETE', `${github.api}/releases/assets/${existing.id}`);
          return upload(file, sha, false);
        }
        if (assets.length < 100) break;
      }
      throw new Error('GitHub 拒绝了这个附件');
    };

    for (const file of attachments) {
      if (file.size > limits.asset) {
        warnings.push({ level: 'red', message: `${file.path}（${formatBytes(file.size)}）超过单个附件的上限 ${formatBytes(limits.asset)}，无法备份。` });
        continue;
      }
      const done = known.get(file.path);
      const named = nameHash(file.path);
      if (done && Number(done.size) === file.size && (!named || done.sha256 === named)) continue;
      try {
        const sha = named ?? (await hashFile(dataPath(file.path)));
        const assetId = await upload(file, sha);
        conn
          .prepare('INSERT OR REPLACE INTO backup_blobs (path, sha256, size, release_tag, asset_id, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(file.path, sha, file.size, tag, assetId, new Date().toISOString());
        uploaded++;
      } catch (err) {
        if (err instanceof TokenError) throw err;
        warnings.push({ level: 'red', message: `${file.path} 没有备份成功：${err instanceof Error ? err.message : err}` });
      }
    }
    // The dump was written before these uploads; record where they went so a restore can find them.
    if (uploaded > 0) {
      writeExport();
      await commitAndPush();
    }
    if (oversizedMedia.length) warnings.push({ level: 'yellow', message: `有 ${oversizedMedia.length} 个超过 ${formatBytes(limits.gitFile)} 的媒体文件以附件方式备份，不在 git 里。` });
    const inRelease = Number((conn.prepare('SELECT COUNT(*) AS n FROM backup_blobs WHERE release_tag = ?').get(tag) as any).n);
    if (inRelease > limits.assetsPerRelease) warnings.push({ level: 'yellow', message: `本月的附件已有 ${inRelease} 个，一个 Release 最多 1000 个。` });
  } catch (err) {
    if (err instanceof TokenError) {
      setSetting('backup_token_invalid', '1');
      error = '访问令牌无效或已过期，GitHub 拒绝了请求。';
    } else {
      error = err instanceof Error ? err.message : String(err);
    }
    if (config) error = error.split(config.token).join('***');
    warnings.push({ level: 'red', message: ok ? `附件没有全部上传：${error}` : `备份失败：${error}` });
  }

  conn
    .prepare('UPDATE backup_runs SET finished_at = ?, ok = ?, committed = ?, uploaded = ?, repo_bytes = ?, warnings_json = ?, error = ? WHERE id = ?')
    .run(new Date().toISOString(), ok && !error ? 1 : 0, committed ? 1 : 0, uploaded, repoBytes ?? null, JSON.stringify(warnings), error ?? null, id);
  return toRun(conn.prepare('SELECT * FROM backup_runs WHERE id = ?').get(id));
}

/* ---------- status ---------- */

export interface BackupStatus {
  configured: boolean;
  repo?: string;
  running: boolean;
  last?: BackupRun;
  lastOk?: BackupRun;
  /** What needs attention now: the last run's warnings plus anything time has since made true. */
  warnings: BackupWarning[];
  /** Files that should be attachments and are not yet. */
  pending: number;
  attachments: number;
  tokenExpires?: Date;
  runs: BackupRun[];
}

export function backupStatus(now: Date = new Date(), limits: BackupLimits = BACKUP_LIMITS): BackupStatus {
  const conn = db();
  const config = backupConfig();
  const runs = (conn.prepare('SELECT * FROM backup_runs ORDER BY id DESC LIMIT 20').all() as any[]).map(toRun);
  const running = !!runningRow(now);
  const last = runs.find((r) => r.finishedAt);
  const lastOkRow = conn.prepare('SELECT * FROM backup_runs WHERE ok = 1 ORDER BY id DESC LIMIT 1').get();
  const lastOk = lastOkRow ? toRun(lastOkRow) : undefined;

  const done = new Map((conn.prepare('SELECT path, size FROM backup_blobs').all() as any[]).map((r) => [String(r.path), Number(r.size)]));
  const { attachments } = attachmentCandidates(limits);
  const pending = attachments.filter((f) => done.get(f.path) !== f.size).length;

  const warnings: BackupWarning[] = [];
  const expires = getSetting('backup_token_expires');
  const tokenExpires = expires ? new Date(expires) : undefined;
  if (!config) {
    warnings.push({ level: 'yellow', message: '备份还没有配置。' });
  } else {
    if (getSetting('backup_token_invalid')) warnings.push({ level: 'red', message: '访问令牌无效或已过期，备份无法进行。请创建新的令牌并更新服务器配置。' });
    else if (tokenExpires && tokenExpires.getTime() < now.getTime()) warnings.push({ level: 'red', message: '访问令牌已经过期，备份无法进行。' });
    else if (tokenExpires && tokenExpires.getTime() - now.getTime() < limits.tokenDays * 86_400_000) {
      warnings.push({ level: 'yellow', message: `访问令牌将在 ${Math.max(1, Math.ceil((tokenExpires.getTime() - now.getTime()) / 86_400_000))} 天后过期，请提前更换。` });
    }
    if (!lastOk) warnings.push({ level: 'red', message: '还没有成功备份过。' });
    else if (now.getTime() - new Date(lastOk.startedAt).getTime() > limits.staleHours * 3600_000) {
      warnings.push({ level: 'red', message: `已经超过 ${limits.staleHours} 小时没有成功备份。` });
    }
    if (last) warnings.push(...last.warnings);
    if (pending && !running) warnings.push({ level: 'yellow', message: `有 ${pending} 个文件还没有备份，下次备份时上传。` });
  }
  return { configured: !!config, repo: config?.repo, running, last, lastOk, warnings, pending, attachments: done.size, tokenExpires, runs };
}

/* ---------- restore ---------- */

export interface RestoreResult {
  posts: number;
  attachments: number;
}

/**
 * Turn a clone of the backup repository into a usable data directory: rebuild
 * the database from the dump and fetch every attachment back to its place,
 * checking each against its SHA-256.
 */
export async function restoreInto(dir: string, options: BackupOptions & { attachments?: boolean } = {}): Promise<RestoreResult> {
  const dump = path.join(dir, 'export', 'db.sql');
  const target = path.join(dir, 'site.db');
  if (!fs.existsSync(dump)) throw new Error(`${dump} does not exist; is this a clone of the backup repository?`);
  if (fs.existsSync(target)) throw new Error(`${target} already exists; restore into a fresh clone`);

  const conn = new DatabaseSync(target);
  let blobs: any[];
  let posts: number;
  try {
    conn.exec(fs.readFileSync(dump, 'utf8'));
    conn.exec('PRAGMA journal_mode = WAL');
    blobs = conn.prepare('SELECT * FROM backup_blobs ORDER BY path').all();
    posts = Number((conn.prepare('SELECT COUNT(*) AS n FROM posts').get() as any).n);
  } finally {
    conn.close();
  }
  if (options.attachments === false || blobs.length === 0) return { posts, attachments: 0 };

  const config = options.config ?? backupConfig();
  if (!config) throw new Error('BACKUP_REPO and BACKUP_GITHUB_TOKEN are needed to download the attachments');
  const github = githubClient(config, options);
  for (const blob of blobs) {
    const file = path.join(dir, ...String(blob.path).split('/'));
    if (!path.resolve(file).startsWith(path.resolve(dir) + path.sep)) throw new Error(`refusing to write outside the target: ${blob.path}`);
    const res = await github.call('GET', `${github.api}/releases/assets/${blob.asset_id}`, { headers: { Accept: 'application/octet-stream' } });
    if (!res.ok || !res.body) throw new Error(`${blob.path}: ${await problem(res)}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const partial = `${file}.part`;
    await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(partial));
    const sha = await hashFile(partial);
    if (sha !== blob.sha256 || fs.statSync(partial).size !== Number(blob.size)) {
      fs.rmSync(partial, { force: true });
      throw new Error(`${blob.path}: the downloaded file does not match its recorded SHA-256`);
    }
    fs.renameSync(partial, file);
  }
  return { posts, attachments: blobs.length };
}
