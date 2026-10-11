// Comments, moderation, account removal and profile pictures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import sharp from 'sharp';

// Without this, sharp keeps the files it read open and Windows refuses to delete them.
sharp.cache(false);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-comments-'));
process.env.DATA_DIR = dir;

const { closeDb, db } = await import('../../src/server/db.ts');
const { avatarFile, MAX_UPLOAD_BYTES, saveAvatar } = await import('../../src/server/avatars.ts');
const { addComment, commentCounts, CommentError, deleteComment, listAllComments, listComments, setCommentStatus, setModeratingFirstComments } = await import('../../src/server/comments.ts');
const { getPost, listPosts, savePost, setPostState } = await import('../../src/server/posts.ts');
const { readSession, startSession } = await import('../../src/server/sessions.ts');
const { createUser, deleteUser, handleOf, promoteToEndmin, renameUser, setUserStatus, userById } = await import('../../src/server/users.ts');

const GUEST = { role: 'guest' };
const USER = { role: 'user' };
const ENDMIN = { role: 'endmin' };
let alice, bob, owner;

before(async () => {
  const base = { sourceMd: '正文', publishedAt: new Date('2026-01-01T00:00:00Z') };
  await savePost({ ...base, slug: 'open', title: 'Open', status: 'published' });
  await savePost({ ...base, slug: 'closed', title: 'Closed', status: 'published', commentsEnabled: false });
  await savePost({ ...base, slug: 'secret', title: 'Secret', status: 'published', hidden: true });
  await savePost({ ...base, slug: 'wip', title: 'WIP', status: 'draft' });
  alice = createUser({ nickname: 'alice' });
  bob = createUser({ nickname: 'bob' });
  owner = promoteToEndmin(createUser({ nickname: 'someone', googleSub: 'g' }).id);
});

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const refuses = (fn, status) => assert.throws(fn, (err) => err instanceof CommentError && err.status === status);
const ids = (slug, viewer, me) => listComments(slug, viewer, me).comments.map((c) => c.id);

test('posting, replying and reading', () => {
  const first = addComment({ slug: 'open', source: '[b]你好[/b] <script>' }, USER, alice);
  assert.equal(first.html, '<strong>你好</strong> &lt;script&gt;');
  assert.equal(first.author.handle, handleOf(alice));
  const reply = addComment({ slug: 'open', source: '回复', parentId: first.id }, USER, bob);
  assert.equal(reply.parentId, first.id);
  const nested = addComment({ slug: 'open', source: '回复的回复', parentId: reply.id }, USER, alice);
  assert.equal(nested.parentId, first.id, 'replies stay one level deep');

  const seen = listComments('open', GUEST);
  assert.equal(seen.enabled, true);
  assert.deepEqual(seen.comments.map((c) => c.id), [first.id, reply.id, nested.id]);
  assert.ok(seen.comments.every((c) => !c.mine));
  assert.deepEqual(listComments('open', USER, alice).comments.map((c) => c.mine), [true, false, true]);
});

test('comments cannot be posted where they should not be', () => {
  refuses(() => addComment({ slug: 'closed', source: 'x' }, USER, alice), 403);
  refuses(() => addComment({ slug: 'secret', source: 'x' }, USER, alice), 404);
  refuses(() => addComment({ slug: 'wip', source: 'x' }, ENDMIN, owner), 404);
  refuses(() => addComment({ slug: 'nope', source: 'x' }, USER, alice), 404);
  refuses(() => addComment({ slug: 'open', source: '   ' }, USER, alice), 400);
  refuses(() => addComment({ slug: 'open', source: 'x'.repeat(5001) }, USER, alice), 400);
  refuses(() => addComment({ slug: 'open', source: 'x', parentId: 99999 }, USER, alice), 404);
  assert.ok(addComment({ slug: 'secret', source: '只有站长能看到这里' }, ENDMIN, owner).id);
});

test('comments on a hidden post are not readable by others', () => {
  assert.equal(listComments('secret', GUEST), undefined);
  assert.equal(listComments('secret', USER, alice), undefined);
  assert.equal(listComments('secret', ENDMIN, owner).comments.length, 1);
  assert.equal(listComments('wip', ENDMIN, owner), undefined);
});

test('people remove their own comments; the endministrator can remove any', () => {
  const mine = addComment({ slug: 'open', source: '我的' }, USER, alice);
  refuses(() => deleteComment(mine.id, bob), 403);
  assert.equal(deleteComment(mine.id, alice), true);
  assert.ok(!ids('open', GUEST).includes(mine.id));
  assert.equal(db().prepare('SELECT source, html FROM comments WHERE id = ?').get(mine.id).source, '', 'the text itself is erased');
  const theirs = addComment({ slug: 'open', source: '别人的' }, USER, bob);
  assert.equal(deleteComment(theirs.id, owner), true);
  assert.equal(deleteComment(424242, owner), false);
});

test('a removed comment leaves a placeholder while it has replies', () => {
  const top = addComment({ slug: 'open', source: '楼主' }, USER, alice);
  const reply = addComment({ slug: 'open', source: '跟帖', parentId: top.id }, USER, bob);
  deleteComment(top.id, alice);
  const placeholder = listComments('open', GUEST).comments.find((c) => c.id === top.id);
  assert.deepEqual([placeholder.status, placeholder.html, placeholder.author], ['deleted', '', null]);
  deleteComment(reply.id, bob);
  assert.ok(!ids('open', GUEST).includes(top.id));
});

test('hidden comments are visible only to their author and the endministrator', () => {
  const c = addComment({ slug: 'open', source: '待处理' }, USER, bob);
  assert.equal(setCommentStatus(c.id, 'hidden'), true);
  assert.ok(!ids('open', GUEST).includes(c.id));
  assert.ok(!ids('open', USER, alice).includes(c.id));
  assert.ok(ids('open', USER, bob).includes(c.id));
  assert.ok(ids('open', ENDMIN, owner).includes(c.id));
  assert.equal(commentCounts().hidden, 1);
  setCommentStatus(c.id, 'visible');
  assert.ok(ids('open', GUEST).includes(c.id));
});

test('first-comment moderation holds back a newcomer once', () => {
  const carol = createUser({ nickname: 'carol' });
  setModeratingFirstComments(true);
  const first = addComment({ slug: 'open', source: '第一次' }, USER, carol);
  assert.equal(first.status, 'hidden');
  assert.equal(addComment({ slug: 'open', source: '站长' }, ENDMIN, owner).status, 'visible');
  assert.equal(addComment({ slug: 'open', source: '老用户' }, USER, alice).status, 'visible');
  assert.equal(addComment({ slug: 'open', source: '第二次' }, USER, carol).status, 'visible');
  setModeratingFirstComments(false);
  assert.equal(addComment({ slug: 'open', source: '关闭后' }, USER, createUser({ nickname: 'dave' })).status, 'visible');
});

test('banning signs the user out; deleting removes their comments; the endministrator is exempt', () => {
  const eve = createUser({ nickname: 'eve' });
  const c = addComment({ slug: 'open', source: '我来了' }, USER, eve);
  const { token } = startSession(eve);
  assert.equal(setUserStatus(eve.id, 'banned'), true);
  assert.equal(readSession(token), undefined);
  assert.ok(ids('open', GUEST).includes(c.id), 'existing comments stay');
  assert.equal(deleteUser(eve.id), true);
  assert.ok(!ids('open', GUEST).includes(c.id));
  assert.equal(setUserStatus(owner.id, 'banned'), false);
  assert.equal(deleteUser(owner.id), false);
  assert.equal(userById(owner.id).role, 'endmin');
});

test('renaming keeps the tag unless it is taken', () => {
  const a = createUser({ nickname: 'first' });
  const b = createUser({ nickname: 'second' });
  db().prepare('UPDATE users SET discriminator = ? WHERE id IN (?, ?)').run('1234', a.id, b.id);
  assert.equal(renameUser(userById(a.id), 'renamed').discriminator, '1234');
  const moved = renameUser(userById(b.id), 'renamed');
  assert.equal(moved.nickname, 'renamed');
  assert.notEqual(moved.discriminator, '1234');
});

test('publishing, withdrawing and hiding posts', () => {
  const id = (slug) => db().prepare('SELECT id FROM posts WHERE slug = ?').get(slug).id;
  const guestSees = () => listPosts(GUEST).map((p) => p.slug).sort();
  assert.deepEqual(guestSees(), ['closed', 'open']);
  setPostState(id('wip'), { status: 'published' });
  assert.deepEqual(guestSees(), ['closed', 'open', 'wip']);
  setPostState(id('wip'), { hidden: true });
  assert.equal(getPost('wip', GUEST), undefined);
  assert.equal(getPost('wip', ENDMIN)?.title, 'WIP');
  setPostState(id('wip'), { status: 'draft', hidden: false });
  assert.equal(getPost('wip', ENDMIN), undefined);
  assert.equal(setPostState(id('wip'), { status: 'nonsense' }), false);
  assert.equal(setPostState(987654, { hidden: true }), false);
});

test('the moderation list shows every comment that still has text', () => {
  const all = listAllComments();
  assert.ok(all.length > 0);
  assert.ok(all.every((c) => c.status !== 'deleted' && c.postSlug && c.postTitle));
});

test('profile pictures are re-encoded to a 256×256 WebP', async () => {
  const big = await sharp({ create: { width: 900, height: 500, channels: 3, background: '#2b78d6' } }).jpeg().toBuffer();
  const sha = await saveAvatar(big);
  const meta = await sharp(avatarFile(sha)).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 256, 256]);
  assert.equal(await saveAvatar(big), sha, 'same picture, same file');

  const withExif = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#fff' } })
    .withExif({ IFD0: { Copyright: 'secret location' } })
    .jpeg()
    .toBuffer();
  const stored = fs.readFileSync(avatarFile(await saveAvatar(withExif)));
  assert.ok(!stored.includes('secret location'), 'metadata is dropped');

  await assert.rejects(saveAvatar(Buffer.alloc(0)));
  await assert.rejects(saveAvatar(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')));
  await assert.rejects(saveAvatar(Buffer.from('GIF89a' + 'x'.repeat(50))));
  await assert.rejects(saveAvatar(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('not really a jpeg')])));
  await assert.rejects(saveAvatar(Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff)));
});
