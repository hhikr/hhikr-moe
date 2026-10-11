// Works: who sees what, versions and files, uploads and downloads.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { after, before, test } from 'node:test';
import sharp from 'sharp';

sharp.cache(false);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-test-'));
process.env.DATA_DIR = dir;

const { closeDb, db } = await import('../../src/server/db.ts');
const { savePost, setPostState } = await import('../../src/server/posts.ts');
const { deleteMedia, ingestUpload, listMedia } = await import('../../src/server/media.ts');
const P = await import('../../src/server/projects.ts');
const { attachmentCandidates } = await import('../../src/server/backup.ts');

const GUEST = { role: 'guest' };
const USER = { role: 'user' };
const ENDMIN = { role: 'endmin' };
const body = (buf) => Readable.from([buf]);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const png = (color) => sharp({ create: { width: 40, height: 30, channels: 3, background: color } }).png().toBuffer();
const base = (over = {}) => P.normalizeProject({ title: 'My Mod', slug: 'my-mod', kind: 'mod', summary: 'A mod.', descriptionMd: '# Hello\n\ntext', links: [], imageIds: [], hidden: false, ...over });

let id;
let postId;
let shot;
let other;

before(async () => {
  postId = await savePost({ slug: 'making-of', title: 'Making of', status: 'published', sourceMd: 'x', publishedAt: new Date('2026-01-01T00:00:00Z'), tags: [] });
  shot = await ingestUpload('shot.png', await png('#336699'));
  other = await ingestUpload('other.png', await png('#993366'));
  id = P.createProject();
});

after(() => {
  closeDb();
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      break;
    } catch {}
  }
});

test('a new work is hidden: only the endministrator sees it', () => {
  const created = P.getProjectById(id);
  assert.equal(created.hidden, true);
  assert.equal(P.listProjects(GUEST).length, 0);
  assert.equal(P.listProjects(USER).length, 0);
  assert.equal(P.listProjects(ENDMIN).length, 1);
  assert.equal(P.getProject(created.slug, GUEST), undefined);
  assert.equal(P.getProject(created.slug, ENDMIN).id, id);
});

test('saving renders the description and keeps only usable links and pictures', async () => {
  const input = P.normalizeProject({
    title: '  My Mod  ',
    slug: 'My-Mod',
    kind: 'nonsense',
    summary: 'A mod.',
    descriptionMd: '# Hello\n\n<b>bold</b> text',
    links: [
      { label: 'GitHub', url: 'https://github.com/hhikr/x' },
      { label: 'bad', url: 'javascript:alert(1)' },
      { label: '', url: 'https://example.com' },
      { label: 'nope', url: 'not a url' },
    ],
    imageIds: [shot.id, shot.id, 99999, 'x'],
    coverMediaId: shot.id,
    postId,
    hidden: false,
  });
  assert.equal(input.kind, 'mod');
  assert.deepEqual(input.links, [{ label: 'GitHub', url: 'https://github.com/hhikr/x' }]);
  await P.saveProject(id, input);

  const work = P.getProject('my-mod', GUEST);
  assert.equal(work.title, 'My Mod');
  assert.match(work.descriptionHtml, /<h1[^>]*>.*Hello/s);
  assert.deepEqual(work.images.map((i) => i.id), [shot.id]);
  assert.ok(work.cover.og.endsWith('.og.jpg'));
  assert.equal(work.postId, postId);
  assert.equal(P.listProjects(GUEST).length, 1);
});

test('bad names and addresses are refused', async () => {
  await assert.rejects(P.saveProject(id, base({ title: '' })), /名称/);
  await assert.rejects(P.saveProject(id, base({ slug: 'Has Space' })), /地址/);
  await assert.rejects(P.saveProject(id, base({ slug: '../etc' })), /地址/);
  await assert.rejects(P.saveProject(9999, base()), /不存在/);
  await assert.rejects(P.saveProject(id, base({ postId: 4242 })), /文章不存在/);
  const second = P.createProject();
  await assert.rejects(P.saveProject(second, base()), /已经被另一个作品使用/);
  assert.ok(P.deleteProject(second));
});

test('the related post follows the post\'s own visibility', () => {
  assert.deepEqual(P.projectPost(postId, GUEST), { slug: 'making-of', title: 'Making of' });
  setPostState(postId, { hidden: true });
  assert.equal(P.projectPost(postId, GUEST), undefined);
  assert.equal(P.projectPost(postId, ENDMIN).slug, 'making-of');
  setPostState(postId, { status: 'draft' });
  assert.equal(P.projectPost(postId, ENDMIN), undefined);
  setPostState(postId, { status: 'published', hidden: false });
  assert.equal(P.projectPost(undefined, GUEST), undefined);
});

let v1;
let v2;
let fileA;
const A = Buffer.from('first file '.repeat(1000));
const B = Buffer.from('second file '.repeat(500));

test('versions are listed newest first and their numbers are unique', async () => {
  v1 = await P.addRelease(id, { version: '1.0.0', notesMd: 'First **release**.' });
  await new Promise((r) => setTimeout(r, 5));
  v2 = await P.addRelease(id, { version: '1.1.0' });
  await assert.rejects(P.addRelease(id, { version: '1.0.0' }), /已经有/);
  await assert.rejects(P.addRelease(id, { version: '' }), /版本号/);
  await assert.rejects(P.addRelease(id, { version: 'a/b' }), /版本号/);
  await assert.rejects(P.addRelease(9999, { version: '1' }), /不存在/);
  const work = P.getProjectById(id);
  assert.deepEqual(work.releases.map((r) => r.version), ['1.1.0', '1.0.0']);
  assert.equal(work.latestVersion, '1.1.0');
  assert.match(work.releases[1].notesHtml, /<strong>release<\/strong>/);
  await P.updateRelease(v2, { version: '1.1.1', notesMd: 'Fixes.' });
  await assert.rejects(P.updateRelease(v2, { version: '1.0.0' }), /已经有/);
  assert.equal(P.getProjectById(id).releases[0].version, '1.1.1');
});

test('an upload is stored under its hash and described correctly', async () => {
  fileA = await P.storeAsset(v1, 'C:\\Users\\me\\my mod v1.zip', body(A), ' Windows ');
  assert.equal(fileA.filename, 'my mod v1.zip');
  assert.equal(fileA.note, 'Windows');
  assert.equal(fileA.size, A.length);
  assert.equal(fileA.sha256, sha(A));
  assert.ok(fs.readFileSync(path.join(dir, 'files', sha(A).slice(0, 2), sha(A))).equals(A));
  assert.equal(fileA.url, `/dl/${fileA.id}/my%20mod%20v1.zip`);
  assert.equal(fs.readdirSync(path.join(dir, 'tmp')).length, 0, 'no temporary file is left behind');

  await assert.rejects(P.storeAsset(v1, 'my mod v1.zip', body(B)), /已经有/);
  await assert.rejects(P.storeAsset(v1, 'empty.zip', body(Buffer.alloc(0))), /没有收到/);
  await assert.rejects(P.storeAsset(v1, '..', body(B)), /文件名/);
  await assert.rejects(P.storeAsset(9999, 'x.zip', body(B)), /不存在/);
  assert.equal(P.cleanFilename('../../etc/passwd'), 'passwd');
  assert.equal(P.cleanFilename('a<b>:"c".zip'), 'a_b___c_.zip');
  assert.equal(P.cleanFilename('模组.zip'), '模组.zip');
});

test('a file over the limit is refused and nothing is kept', async () => {
  process.env.MAX_FILE_BYTES = '1000';
  await assert.rejects(P.storeAsset(v2, 'big.bin', body(B)), /太大/);
  delete process.env.MAX_FILE_BYTES;
  assert.equal(fs.readdirSync(path.join(dir, 'tmp')).length, 0);
  assert.ok(!fs.existsSync(path.join(dir, 'files', sha(B).slice(0, 2), sha(B))));
  assert.equal(P.getProjectById(id).fileCount, 1);
});

test('downloads of a hidden work are for the endministrator only', async () => {
  assert.equal(P.findDownload(fileA.id, GUEST).filename, 'my mod v1.zip');
  assert.equal(P.findDownload(fileA.id, GUEST).size, A.length);
  assert.equal(P.findDownload(424242, GUEST), undefined);
  P.setProjectHidden(id, true);
  assert.equal(P.findDownload(fileA.id, GUEST), undefined);
  assert.equal(P.findDownload(fileA.id, USER), undefined);
  assert.equal(P.findDownload(fileA.id, ENDMIN).hidden, true);
  P.setProjectHidden(id, false);
});

test('download counts add up per file and per work', () => {
  P.countDownload(fileA.id);
  P.countDownload(fileA.id);
  const work = P.getProjectById(id);
  assert.equal(work.downloads, 2);
  assert.equal(work.releases[1].files[0].downloads, 2);
});

test('range requests are understood', () => {
  assert.equal(P.parseRange(null, 100), undefined);
  assert.equal(P.parseRange('items=0-1', 100), undefined);
  assert.deepEqual(P.parseRange('bytes=0-', 100), { start: 0, end: 99 });
  assert.deepEqual(P.parseRange('bytes=10-19', 100), { start: 10, end: 19 });
  assert.deepEqual(P.parseRange('bytes=90-500', 100), { start: 90, end: 99 });
  assert.deepEqual(P.parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(P.parseRange('bytes=-500', 100), { start: 0, end: 99 });
  assert.equal(P.parseRange('bytes=100-', 100), null);
  assert.equal(P.parseRange('bytes=50-40', 100), null);
  assert.equal(P.parseRange('bytes=-0', 100), null);
});

test('the same content in two versions is stored once and kept until the last one goes', async () => {
  const again = await P.storeAsset(v2, 'same content.zip', body(A));
  const file = path.join(dir, 'files', sha(A).slice(0, 2), sha(A));
  assert.equal(again.sha256, fileA.sha256);
  assert.ok(P.deleteAsset(fileA.id));
  assert.ok(fs.existsSync(file), 'still referenced by the other version');
  assert.ok(P.deleteAsset(again.id));
  assert.ok(!fs.existsSync(file));
  assert.equal(P.deleteAsset(again.id), false);
});

test('pictures used by a work cannot be deleted from the media library', async () => {
  const entries = new Map(listMedia().map((m) => [m.id, m]));
  assert.deepEqual(entries.get(shot.id).usedBy, [{ title: 'My Mod', href: `/endmin/works/${id}/` }]);
  assert.equal(entries.get(other.id).usedBy.length, 0);
  assert.equal(deleteMedia(shot.id), false);
  assert.equal(deleteMedia(other.id), true);
});

test('uploaded files are picked up by the backup as attachments', async () => {
  const stored = await P.storeAsset(v1, 'for-backup.zip', body(B));
  const paths = attachmentCandidates().attachments.map((f) => f.path);
  assert.deepEqual(paths, [`files/${stored.sha256.slice(0, 2)}/${stored.sha256}`]);
});

test('deleting a version or the work removes its files from disk', async () => {
  const file = path.join(dir, 'files', sha(B).slice(0, 2), sha(B));
  assert.ok(fs.existsSync(file));
  assert.ok(P.deleteRelease(v1));
  assert.ok(!fs.existsSync(file));
  assert.equal(P.deleteRelease(v1), false);

  const kept = await P.storeAsset(v2, 'last.zip', body(B));
  assert.ok(P.deleteProject(id));
  assert.ok(!fs.existsSync(path.join(dir, 'files', kept.sha256.slice(0, 2), kept.sha256)));
  assert.equal(P.findDownload(kept.id, ENDMIN), undefined);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM releases').get().n + db().prepare('SELECT COUNT(*) AS n FROM assets').get().n, 0);
  assert.equal(listMedia().find((m) => m.id === shot.id).usedBy.length, 0);
});

test('deleting the related post leaves the work in place', async () => {
  const work = P.createProject();
  await P.saveProject(work, base({ slug: 'another', postId }));
  db().prepare('DELETE FROM posts WHERE id = ?').run(postId);
  assert.equal(P.getProjectById(work).postId, undefined);
});
