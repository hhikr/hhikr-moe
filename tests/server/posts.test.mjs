// Who can see which posts. Runs against a throwaway database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-test-'));
process.env.DATA_DIR = dir;

const { closeDb, db } = await import('../../src/server/db.ts');
const { GUEST, getPost, listAllPosts, listPosts, resolveRedirect, savePost } = await import('../../src/server/posts.ts');

const USER = { role: 'user' };
const ENDMIN = { role: 'endmin' };
const base = { sourceMd: '# 标题\n\n正文 body text', publishedAt: new Date('2026-01-01T00:00:00Z'), tags: ['a'] };

before(async () => {
  await savePost({ ...base, slug: 'public', title: 'Public', status: 'published' });
  await savePost({ ...base, slug: 'hidden', title: 'Hidden', status: 'published', hidden: true, tags: ['a', 'secret'] });
  await savePost({ ...base, slug: 'draft', title: 'Draft', status: 'draft' });
  // A hidden draft is still a draft.
  await savePost({ ...base, slug: 'hidden-draft', title: 'Hidden draft', status: 'draft', hidden: true });
});

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

const slugs = (viewer) => listPosts(viewer).map((p) => p.slug).sort();

test('guests and signed-in users see only published, non-hidden posts', () => {
  assert.deepEqual(slugs(GUEST), ['public']);
  assert.deepEqual(slugs(USER), ['public']);
  assert.deepEqual(slugs(), ['public'], 'the default viewer is a guest');
});

test('the endministrator also sees hidden posts in listings', () => {
  assert.deepEqual(slugs(ENDMIN), ['hidden', 'public']);
});

test('drafts never appear on the public pages, not even for the endministrator', () => {
  for (const viewer of [GUEST, USER, ENDMIN]) {
    assert.ok(!slugs(viewer).includes('draft'));
    assert.ok(!slugs(viewer).includes('hidden-draft'));
    assert.equal(getPost('draft', viewer), undefined);
    assert.equal(getPost('hidden-draft', viewer), undefined);
  }
});

test('a hidden post cannot be fetched directly unless the viewer is the endministrator', () => {
  assert.equal(getPost('hidden', GUEST), undefined);
  assert.equal(getPost('hidden', USER), undefined);
  assert.equal(getPost('hidden', ENDMIN)?.title, 'Hidden');
  assert.equal(getPost('public', GUEST)?.title, 'Public');
});

test('tags that only hidden posts carry do not leak into guest listings', () => {
  const guestTags = new Set(listPosts(GUEST).flatMap((p) => p.tags));
  assert.ok(!guestTags.has('secret'));
});

test('redirects from old addresses follow the same visibility rules', () => {
  const id = (slug) => db().prepare('SELECT id FROM posts WHERE slug = ?').get(slug).id;
  const add = db().prepare('INSERT INTO post_redirects (old_slug, post_id) VALUES (?, ?)');
  add.run('old-public', id('public'));
  add.run('old-hidden', id('hidden'));
  add.run('old-draft', id('draft'));
  assert.equal(resolveRedirect('old-public', GUEST), 'public');
  assert.equal(resolveRedirect('old-hidden', GUEST), undefined);
  assert.equal(resolveRedirect('old-hidden', ENDMIN), 'hidden');
  assert.equal(resolveRedirect('old-draft', ENDMIN), undefined);
});

test('management listing includes everything', () => {
  assert.deepEqual(listAllPosts().map((p) => p.slug).sort(), ['draft', 'hidden', 'hidden-draft', 'public']);
});

test('saving renders the Markdown and replaces an existing post with the same slug', async () => {
  const first = getPost('public');
  assert.match(first.html, /<h1[^>]*>.*标题/s);
  assert.ok(first.words > 0);
  assert.equal(first.headings[0].text, '标题');
  await savePost({ ...base, slug: 'public', title: 'Public v2', status: 'published', tags: ['b'] });
  const second = getPost('public');
  assert.equal(second.title, 'Public v2');
  assert.deepEqual(second.tags, ['b']);
  assert.equal(listAllPosts().length, 4);
});
