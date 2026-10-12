// Backups: what goes into git, what becomes an attachment, the warnings, and
// that a restore gives the same site back. Uses real git against a local bare
// repository and a stand-in for the GitHub API.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-backup-'));
const dir = path.join(root, 'data');
const remote = path.join(root, 'remote.git');
process.env.DATA_DIR = dir;
process.env.BACKUP_REPO = 'someone/backup';
process.env.BACKUP_GITHUB_TOKEN = 'github_pat_TESTTOKENTESTTOKEN';

const { closeDb, db } = await import('../../src/server/db.ts');
const { savePost } = await import('../../src/server/posts.ts');
const { backupStatus, dumpSql, restoreInto, runBackup } = await import('../../src/server/backup.ts');

const TOKEN = process.env.BACKUP_GITHUB_TOKEN;
const config = { repo: 'someone/backup', token: TOKEN, gitDir: path.join(root, 'backup.git') };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const put = (rel, buf) => {
  const file = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return rel;
};
const bytes = (n, seed) => Buffer.alloc(n, seed);
const remoteFiles = () => execFileSync('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' }).trim().split('\n');

// ---- a stand-in for GitHub's release API ----
const hub = { releases: new Map(), nextId: 1, mode: 'ok', private: true, failName: undefined, expires: '2027-10-11 00:00:00 UTC', uploads: [] };
const reply = (status, body) =>
  new Response(body === undefined ? null : typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body), {
    status,
    headers: hub.expires ? { 'github-authentication-token-expiration': hub.expires } : {},
  });
async function fakeFetch(url, init = {}) {
  assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
  if (hub.mode === 'unauthorized') return reply(401, { message: 'Bad credentials' });
  const { pathname, searchParams } = new URL(url);
  const route = `${init.method} ${pathname.replace('/repos/someone/backup', '')}`;
  let m;
  if (route === 'GET ') return reply(200, { full_name: 'someone/backup', private: hub.private });
  if ((m = /^GET \/releases\/tags\/(.+)$/.exec(route))) {
    const release = hub.releases.get(m[1]);
    return release ? reply(200, { id: release.id }) : reply(404, { message: 'Not Found' });
  }
  if (route === 'POST /releases') {
    const { tag_name } = JSON.parse(init.body);
    const release = { id: hub.nextId++, assets: [] };
    hub.releases.set(tag_name, release);
    return reply(201, { id: release.id });
  }
  const byId = (id) => [...hub.releases.values()].find((r) => r.id === Number(id));
  if ((m = /^POST \/releases\/(\d+)\/assets$/.exec(route))) {
    const data = Buffer.from(await new Response(init.body).arrayBuffer());
    const name = searchParams.get('name');
    if (name === hub.failName) return reply(500, { message: 'boom' });
    const release = byId(m[1]);
    if (release.assets.some((a) => a.name === name)) return reply(422, { message: 'Validation Failed', errors: [{ code: 'already_exists' }] });
    const asset = { id: hub.nextId++, name, size: data.length, state: 'uploaded', data };
    release.assets.push(asset);
    hub.uploads.push(name);
    return reply(201, { id: asset.id, size: asset.size });
  }
  if ((m = /^GET \/releases\/(\d+)\/assets$/.exec(route))) return reply(200, byId(m[1]).assets.map(({ data, ...rest }) => rest));
  if ((m = /^GET \/releases\/assets\/(\d+)$/.exec(route))) {
    const asset = [...hub.releases.values()].flatMap((r) => r.assets).find((a) => a.id === Number(m[1]));
    return asset ? reply(200, asset.data) : reply(404, { message: 'Not Found' });
  }
  return reply(404, { message: `no route for ${route}` });
}

// Anything over 2000 bytes counts as "too large for git" here, anything over 20000 as "too large to attach".
const options = (over = {}) => ({ config, remoteUrl: remote, fetch: fakeFetch, apiBase: 'https://api.test', uploadBase: 'https://uploads.test', limits: { gitFile: 2000, asset: 20000 }, ...over });
const NOW = new Date('2026-10-11T20:00:00Z');

const small = bytes(100, 1);
const big = bytes(5000, 2);
const variant = bytes(4000, 3);
const mod = bytes(300, 4);
let bigPath;
let variantPath;
let modPath;

before(async () => {
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  await savePost({ slug: 'hello', title: 'Hello "world"', status: 'published', sourceMd: "It's a post.\n\nSecond line.", publishedAt: new Date('2026-01-01T00:00:00Z'), tags: ['a', 'b'] });
  await savePost({ slug: 'wip', title: 'Unfinished', status: 'draft', sourceMd: 'draft text', publishedAt: new Date('2026-02-01T00:00:00Z'), tags: [] });
  db().prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) SELECT 'SESSIONHASH', 1, 'x', 'y' WHERE 0").run();
  db().prepare("INSERT INTO rate_limits (key, count, window_start) VALUES ('login:ADDRESSHASH', 3, 1)").run();
  put(`media/aa/${sha(small)}.png`, small);
  bigPath = put(`media/bb/${sha(big)}.png`, big);
  // A resized copy carries the original's hash in its name but has other content.
  variantPath = put(`media/bb/${sha(big)}.d.webp`, variant);
  modPath = put(`files/cc/${sha(mod)}`, mod);
  put('pagefind/index.bin', bytes(50, 5));
  put('tmp/upload.part', bytes(50, 6));
});

after(() => {
  closeDb();
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
      break;
    } catch {}
  }
});

test('the dump leaves out sessions and rate limits but keeps their tables', () => {
  const sql = dumpSql();
  assert.match(sql, /CREATE TABLE sessions/);
  assert.match(sql, /CREATE TABLE rate_limits/);
  assert.ok(!sql.includes('ADDRESSHASH'));
  assert.match(sql, /INSERT INTO "posts" VALUES \(/);
  assert.match(sql, /It''s a post\./);
});

test('a run commits text and small files and uploads the rest as attachments', async () => {
  const run = await runBackup(options({ now: NOW }));
  assert.equal(run.error, undefined);
  assert.equal(run.ok, true);
  assert.equal(run.committed, true);
  assert.equal(run.uploaded, 3);
  assert.ok(run.repoBytes > 0);

  const files = remoteFiles();
  assert.ok(files.includes('export/db.sql'));
  assert.ok(files.includes('export/posts/hello.md'));
  assert.ok(files.includes('export/posts/wip.md'));
  assert.ok(files.includes(`media/aa/${sha(small)}.png`));
  for (const kept of [bigPath, variantPath, modPath]) assert.ok(!files.includes(kept), `${kept} went into git`);
  assert.ok(!files.some((f) => f.startsWith('site.db') || f.startsWith('pagefind/') || f.startsWith('tmp/') || f.startsWith('files/')));

  // Attachments are named by the SHA-256 of their own content.
  assert.deepEqual([...hub.uploads].sort(), [sha(big), sha(variant), sha(mod)].sort());
  assert.ok(hub.releases.has('blobs-2026-10'));
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM backup_blobs').get().n, 3);
  assert.ok(run.warnings.some((w) => w.level === 'yellow' && w.message.includes('以附件方式备份')));

  // The pushed dump already knows where the attachments are.
  const pushed = execFileSync('git', ['--git-dir', remote, 'show', 'main:export/db.sql'], { encoding: 'utf8' });
  assert.ok(pushed.includes(sha(mod)));
});

test('the Markdown copy carries the post and its front matter', () => {
  const md = fs.readFileSync(path.join(dir, 'export', 'posts', 'hello.md'), 'utf8');
  assert.match(md, /^---\ntitle: "Hello \\"world\\""\nslug: "hello"/);
  assert.match(md, /tags: \["a","b"\]/);
  assert.match(md, /status: "published"/);
  assert.ok(md.endsWith("It's a post.\n\nSecond line.\n"));
});

test('the token is not written into the repository', () => {
  for (const entry of fs.readdirSync(config.gitDir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || entry.parentPath.includes(`${path.sep}objects`)) continue;
    const text = fs.readFileSync(path.join(entry.parentPath, entry.name), 'latin1');
    assert.ok(!text.includes(TOKEN) && !text.includes(Buffer.from(`x-access-token:${TOKEN}`).toString('base64')), entry.name);
  }
});

test('with nothing new there is no commit and no upload', async () => {
  const before = hub.uploads.length;
  const head = execFileSync('git', ['--git-dir', remote, 'rev-parse', 'main'], { encoding: 'utf8' });
  const run = await runBackup(options({ now: new Date(NOW.getTime() + 60_000) }));
  assert.equal(run.ok, true);
  assert.equal(run.committed, false);
  assert.equal(run.uploaded, 0);
  assert.equal(hub.uploads.length, before);
  assert.equal(execFileSync('git', ['--git-dir', remote, 'rev-parse', 'main'], { encoding: 'utf8' }), head);
});

test('a restore from a clone gives back the posts and the attachments', async () => {
  const clone = path.join(root, 'restored');
  execFileSync('git', ['clone', '-q', remote, clone]);
  const result = await restoreInto(clone, options());
  assert.deepEqual(result, { posts: 2, attachments: 3 });
  for (const [rel, content] of [[bigPath, big], [variantPath, variant], [modPath, mod]]) {
    assert.ok(fs.readFileSync(path.join(clone, ...rel.split('/'))).equals(content), rel);
  }
  const restored = new DatabaseSync(path.join(clone, 'site.db'), { readOnly: true });
  const live = db();
  for (const table of ['posts', 'post_tags', 'schema_migrations', 'backup_blobs']) {
    const all = (conn) => JSON.stringify(conn.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all());
    assert.equal(all(restored), all(live), table);
  }
  assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM rate_limits').get().n, 0);
  restored.close();
  await assert.rejects(restoreInto(clone, options()), /already exists/);
});

test('a download that does not match its hash is refused', async () => {
  const clone = path.join(root, 'tampered');
  execFileSync('git', ['clone', '-q', remote, clone]);
  const asset = [...hub.releases.values()].flatMap((r) => r.assets).find((a) => a.name === sha(mod));
  const original = asset.data;
  asset.data = bytes(300, 9);
  await assert.rejects(restoreInto(clone, options()), /does not match/);
  asset.data = original;
  assert.ok(!fs.existsSync(path.join(clone, ...modPath.split('/'))));
});

test('a failed upload is a red warning and does not stop the others', async () => {
  const a = bytes(400, 7);
  const b = bytes(500, 8);
  put(`files/dd/${sha(a)}`, a);
  put(`files/dd/${sha(b)}`, b);
  hub.failName = sha(a);
  const run = await runBackup(options({ now: new Date(NOW.getTime() + 120_000) }));
  assert.equal(run.ok, true);
  assert.equal(run.uploaded, 1);
  assert.ok(run.warnings.some((w) => w.level === 'red' && w.message.includes(sha(a)) && w.message.includes('没有备份成功')));
  assert.equal(backupStatus(new Date(NOW.getTime() + 130_000)).pending, 1);

  hub.failName = undefined;
  const again = await runBackup(options({ now: new Date(NOW.getTime() + 180_000) }));
  assert.equal(again.uploaded, 1);
  assert.equal(backupStatus(new Date(NOW.getTime() + 190_000)).pending, 0);
});

test('a file above the attachment ceiling cannot be backed up and says so', async () => {
  const huge = bytes(25000, 10);
  const rel = put(`files/ee/${sha(huge)}`, huge);
  const run = await runBackup(options({ now: new Date(NOW.getTime() + 240_000) }));
  assert.equal(run.ok, true);
  assert.ok(run.warnings.some((w) => w.level === 'red' && w.message.includes(rel) && w.message.includes('无法备份')));
  assert.ok(!hub.uploads.includes(sha(huge)));
  fs.rmSync(path.join(dir, ...rel.split('/')));
});

test('repository size thresholds raise warnings', async () => {
  const yellow = await runBackup(options({ now: new Date(NOW.getTime() + 300_000), limits: { gitFile: 2000, asset: 20000, repoWarn: 1, repoDanger: 1e12 } }));
  assert.ok(yellow.warnings.some((w) => w.level === 'yellow' && w.message.includes('备份仓库已有')));
  const red = await runBackup(options({ now: new Date(NOW.getTime() + 360_000), limits: { gitFile: 2000, asset: 20000, repoWarn: 1, repoDanger: 2 } }));
  assert.ok(red.warnings.some((w) => w.level === 'red' && w.message.includes('备份仓库已有')));
});

test('a rejected token fails the run and is reported until a run succeeds', async () => {
  put(`files/ff/${sha(bytes(600, 11))}`, bytes(600, 11));
  hub.mode = 'unauthorized';
  const t = new Date(NOW.getTime() + 420_000);
  const run = await runBackup(options({ now: t }));
  assert.equal(run.ok, false);
  assert.match(run.error, /令牌/);
  assert.ok(!JSON.stringify(run).includes(TOKEN));
  assert.ok(backupStatus(t).warnings.some((w) => w.level === 'red' && w.message.includes('令牌无效')));

  hub.mode = 'ok';
  const fixed = await runBackup(options({ now: new Date(t.getTime() + 60_000) }));
  assert.equal(fixed.ok, true);
  assert.ok(!backupStatus(new Date(t.getTime() + 70_000)).warnings.some((w) => w.message.includes('令牌无效')));
});

test('nothing is pushed to a repository that is not private', async () => {
  const head = execFileSync('git', ['--git-dir', remote, 'rev-parse', 'main'], { encoding: 'utf8' });
  await savePost({ slug: 'secret', title: 'Secret', status: 'draft', sourceMd: 'not for the public', publishedAt: NOW, tags: [] });
  hub.private = false;
  const t = new Date(NOW.getTime() + 500_000);
  const run = await runBackup(options({ now: t }));
  hub.private = true;
  assert.equal(run.ok, false);
  assert.match(run.error, /不是私有的/);
  assert.equal(execFileSync('git', ['--git-dir', remote, 'rev-parse', 'main'], { encoding: 'utf8' }), head);
  assert.equal((await runBackup(options({ now: new Date(t.getTime() + 30_000) }))).ok, true);
});

test('status warns about an expiring token and about stale backups', async () => {
  const lastOk = backupStatus(NOW).lastOk;
  const soon = new Date(new Date(lastOk.startedAt).getTime() + 3600_000);
  assert.equal(backupStatus(soon).warnings.filter((w) => w.level === 'red').length, 0);
  assert.equal(backupStatus(soon).tokenExpires.toISOString(), '2027-10-11T00:00:00.000Z');

  const later = new Date(new Date(lastOk.startedAt).getTime() + 49 * 3600_000);
  assert.ok(backupStatus(later).warnings.some((w) => w.level === 'red' && w.message.includes('48 小时')));

  const nearExpiry = new Date('2027-10-01T00:00:00Z');
  assert.ok(backupStatus(nearExpiry).warnings.some((w) => w.level === 'yellow' && w.message.includes('10 天后过期')));
  const expired = new Date('2027-10-12T00:00:00Z');
  assert.ok(backupStatus(expired).warnings.some((w) => w.level === 'red' && w.message.includes('已经过期')));
});

test('a second run does not start while one is in progress', async () => {
  const t = new Date(NOW.getTime() + 600_000);
  db().prepare('INSERT INTO backup_runs (started_at) VALUES (?)').run(new Date(t.getTime() - 60_000).toISOString());
  assert.equal(await runBackup(options({ now: t })), undefined);
  assert.equal(backupStatus(t).running, true);
  // One that started hours ago is taken to have died.
  assert.equal(backupStatus(new Date(t.getTime() + 3 * 3600_000)).running, false);
});

test('without configuration a run fails cleanly', async () => {
  db().prepare('DELETE FROM backup_runs WHERE finished_at IS NULL').run();
  const saved = process.env.BACKUP_REPO;
  process.env.BACKUP_REPO = '';
  const run = await runBackup({ now: new Date(NOW.getTime() + 900_000) });
  process.env.BACKUP_REPO = saved;
  assert.equal(run.ok, false);
  assert.match(run.error, /没有配置/);
});
