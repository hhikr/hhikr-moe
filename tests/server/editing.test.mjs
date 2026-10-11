// Writing and editing posts, autosave, revisions, address changes and uploads.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import sharp from 'sharp';

sharp.cache(false);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-editing-'));
process.env.DATA_DIR = dir;

const { closeDb, db } = await import('../../src/server/db.ts');
const media = await import('../../src/server/media.ts');
const posts = await import('../../src/server/posts.ts');

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const GUEST = { role: 'guest' };
const ENDMIN = { role: 'endmin' };
const fields = (over = {}) => posts.normalizeFields({ title: '标题', slug: 'first', publishedAt: '2026-03-01T00:00:00Z', tags: ['a'], ...over });
const png = (w = 40, h = 30) => sharp({ create: { width: w, height: h, channels: 3, background: '#2b78d6' } }).png().toBuffer();

test('editor input is cleaned up before it is stored', () => {
  const f = posts.normalizeFields({
    title: '  T  ', slug: ' My-Slug ', tags: 'x， y, x,,', seriesOrder: '2.5', hidden: 'yes', pinned: true, commentsEnabled: false,
    publishedAt: 'not a date', coverMediaId: '7', role: 'endmin', status: 'published',
  });
  assert.equal(f.title, 'T');
  assert.equal(f.slug, 'my-slug');
  assert.deepEqual(f.tags, ['x', 'y']);
  assert.equal(f.seriesOrder, 2.5);
  assert.equal(f.hidden, false, 'only a real boolean turns a flag on');
  assert.equal(f.pinned, true);
  assert.equal(f.commentsEnabled, false);
  assert.ok(!Number.isNaN(new Date(f.publishedAt).valueOf()));
  assert.equal(f.coverMediaId, 7);
  assert.ok(!('role' in f) && !('status' in f));
});

test('a new draft is invisible until published', async () => {
  const id = posts.createDraft();
  const draft = posts.getEditablePost(id);
  assert.equal(draft.status, 'draft');
  assert.match(draft.fields.slug, /^untitled-\d+$/);
  await posts.writePost(id, fields(), '# 你好\n\n正文', 'draft');
  assert.equal(posts.getPost('first', ENDMIN), undefined);
  assert.equal(posts.listRevisions(id).length, 0, 'saving a draft leaves no revision');

  await posts.writePost(id, fields(), '# 你好\n\n正文', 'published');
  const live = posts.getPost('first', GUEST);
  assert.equal(live.title, '标题');
  assert.match(live.html, /<h1/);
  assert.deepEqual(live.tags, ['a']);
  assert.equal(posts.listRevisions(id).length, 1);
});

test('problems with the fields are reported', async () => {
  const other = posts.createDraft();
  assert.match(posts.fieldsProblem(other, fields({ title: '' })), /标题/);
  for (const slug of ['', 'Has Space', '中文', '-lead', 'trail-', 'a--b', '../x', 'a/b']) {
    assert.ok(posts.fieldsProblem(other, fields({ slug })), slug);
  }
  assert.match(posts.fieldsProblem(other, fields()), /已经被/);
  assert.equal(posts.fieldsProblem(other, fields({ slug: 'second' })), undefined);
  assert.match(posts.fieldsProblem(other, fields({ slug: 'second', coverMediaId: 9999 })), /封面/);
  const first = db().prepare("SELECT id FROM posts WHERE slug = 'first'").get().id;
  assert.equal(posts.fieldsProblem(first, fields()), undefined, 'a post may keep its own address');
});

test('autosave does not change what readers see', async () => {
  const id = db().prepare("SELECT id FROM posts WHERE slug = 'first'").get().id;
  assert.ok(posts.saveWorkingCopy(id, fields({ title: '改到一半' }), '还没写完'));
  assert.equal(posts.getPost('first', GUEST).title, '标题');
  assert.equal(posts.getWorkingCopy(id).fields.title, '改到一半');
  assert.equal(posts.getWorkingCopy(id).sourceMd, '还没写完');
  assert.equal(posts.saveWorkingCopy(424242, fields(), 'x'), undefined);

  const preview = await posts.renderDraft(posts.getWorkingCopy(id).fields, '## 预览');
  assert.match(preview.html, /<h2/);
  assert.equal(posts.getPost('first', GUEST).title, '标题', 'previewing stores nothing');

  await posts.writePost(id, fields({ title: '改好了' }), '定稿', 'published');
  assert.equal(posts.getWorkingCopy(id), undefined, 'saving clears the autosave');
  assert.equal(posts.getPost('first', GUEST).title, '改好了');
  posts.saveWorkingCopy(id, fields(), 'x');
  posts.discardWorkingCopy(id);
  assert.equal(posts.getWorkingCopy(id), undefined);
});

test('each publish is kept as a revision that can be read back', async () => {
  const id = db().prepare("SELECT id FROM posts WHERE slug = 'first'").get().id;
  const revisions = posts.listRevisions(id);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].title, '改好了');
  const oldest = posts.getRevision(id, revisions[1].id);
  assert.equal(oldest.fields.title, '标题');
  assert.equal(oldest.sourceMd, '# 你好\n\n正文');
  assert.equal(posts.getRevision(id + 1, revisions[1].id), undefined, 'a revision belongs to its own post');
});

test('changing a published address leaves a redirect; taking an address back removes it', async () => {
  const id = db().prepare("SELECT id FROM posts WHERE slug = 'first'").get().id;
  await posts.writePost(id, fields({ slug: 'renamed' }), '定稿', 'published');
  assert.equal(posts.getPost('first', GUEST), undefined);
  assert.equal(posts.resolveRedirect('first', GUEST), 'renamed');
  await posts.writePost(id, fields({ slug: 'first' }), '定稿', 'published');
  assert.equal(posts.resolveRedirect('first', GUEST), undefined, 'no redirect from an address that is in use');
  assert.equal(posts.resolveRedirect('renamed', GUEST), 'first');

  const draft = posts.createDraft();
  await posts.writePost(draft, fields({ slug: 'draft-a' }), 'x', 'draft');
  await posts.writePost(draft, fields({ slug: 'draft-b' }), 'x', 'draft');
  assert.equal(posts.resolveRedirect('draft-a', ENDMIN), undefined, 'drafts never had a public address');
});

test('withdrawing and deleting', async () => {
  const id = db().prepare("SELECT id FROM posts WHERE slug = 'first'").get().id;
  await posts.writePost(id, fields(), '定稿', 'draft');
  assert.equal(posts.getPost('first', ENDMIN), undefined);
  assert.equal(posts.deletePost(id), true);
  assert.equal(posts.getEditablePost(id), undefined);
  assert.equal(posts.listRevisions(id).length, 0);
  assert.equal(posts.deletePost(id), false);
});

test('uploads: images are checked, risky types refused, names cleaned', async () => {
  const image = await media.ingestUpload('截图 1.PNG', await png());
  assert.equal(image.ext, 'png');
  assert.equal(image.filename, '截图 1.PNG');
  assert.deepEqual([image.width, image.height], [40, 30]);
  assert.match(media.displayUrl(image), /^\/media\/[0-9a-f]{2}\/[0-9a-f]{64}\.d\.webp$/);
  assert.equal((await media.ingestUpload('again.png', await png())).id, image.id, 'the same content is stored once');

  const note = await media.ingestUpload('..\\..\\notes.txt', Buffer.from('hello'));
  assert.equal(note.filename, 'notes.txt');
  assert.equal(media.isRaster(note), false);

  await assert.rejects(media.ingestUpload('x.png', Buffer.from('not an image')), /图片/);
  await assert.rejects(media.ingestUpload('x.svg', Buffer.from('<svg onload="alert(1)"/>')), /不支持/);
  await assert.rejects(media.ingestUpload('x.html', Buffer.from('<script>alert(1)</script>')), /不支持/);
  await assert.rejects(media.ingestUpload('x.exe', Buffer.from('MZ')), /不支持/);
  await assert.rejects(media.ingestUpload('noext', Buffer.from('x')), /不支持/);
  await assert.rejects(media.ingestUpload('empty.png', Buffer.alloc(0)));
  assert.deepEqual(fs.readdirSync(path.join(dir, 'tmp')), [], 'nothing is left behind in the temporary directory');
});

test('the media library knows what is in use, and only unused files can be deleted', async () => {
  const used = await media.ingestUpload('used.png', await png(50, 50));
  const cover = await media.ingestUpload('cover.png', await png(60, 60));
  const spare = await media.ingestUpload('spare.png', await png(70, 70));
  const pending = await media.ingestUpload('pending.png', await png(80, 80));
  await media.ensureCoverVariants(cover);

  const id = posts.createDraft();
  await posts.writePost(id, fields({ slug: 'with-media', coverMediaId: cover.id }), `![](${media.displayUrl(used)})`, 'published');
  posts.saveWorkingCopy(id, fields({ slug: 'with-media' }), `![](${media.displayUrl(pending)})`);

  const entries = new Map(media.listMedia().map((m) => [m.id, m]));
  assert.equal(entries.get(used.id).usedBy[0].title, '标题');
  assert.equal(entries.get(cover.id).usedBy.length, 1);
  assert.equal(entries.get(pending.id).usedBy.length, 1, 'a file used only in unsaved edits still counts');
  assert.equal(entries.get(spare.id).usedBy.length, 0);

  assert.equal(media.deleteMedia(used.id), false);
  assert.equal(media.deleteMedia(cover.id), false);
  assert.equal(media.deleteMedia(pending.id), false);
  const file = path.join(dir, 'media', spare.sha256.slice(0, 2), `${spare.sha256}.png`);
  assert.ok(fs.existsSync(file));
  assert.equal(media.deleteMedia(spare.id), true);
  assert.ok(!fs.existsSync(file) && !fs.existsSync(file.replace(/\.png$/, '.d.webp')));
  assert.equal(media.deleteMedia(spare.id), false);

  const rendered = posts.getPost('with-media', GUEST);
  assert.match(rendered.html, /width="50" height="50"/);
  assert.ok(rendered.cover.og.endsWith('.og.jpg'));
});
