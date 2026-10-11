// What users can do to their own account, and what the endministrator can do to theirs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-accounts-'));
process.env.DATA_DIR = dir;
process.env.ENDMIN_GOOGLE_EMAIL = 'owner@example.com';

const { closeDb, db } = await import('../../src/server/db.ts');
const { AuthError, changePassword, deleteOwnAccount, register, resetPassword, signInWithGoogle, signInWithPassword } = await import('../../src/server/auth.ts');
const { issueChallenge, solves } = await import('../../src/server/challenge.ts');
const { addComment } = await import('../../src/server/comments.ts');
const { savePost } = await import('../../src/server/posts.ts');
const { readSession, startSession } = await import('../../src/server/sessions.ts');
const { handleOf, toPublic, toSelf, userActivity, userById } = await import('../../src/server/users.ts');

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function solved() {
  const c = issueChallenge();
  for (let n = 0; ; n++) if (solves(c.salt, String(n), c.bits)) return { ...c, nonce: String(n) };
}
let addr = 0;
const freshAddress = () => `10.1.${Math.floor(addr / 250)}.${addr++ % 250}`;
const PASSWORD = 'correct horse battery';
const signUp = (nickname) => register({ nickname, password: PASSWORD, challenge: solved() }, freshAddress());
const signIn = (user, password) => signInWithPassword(handleOf(user), password, freshAddress());
const rejects = (promise, code) => assert.rejects(promise, (err) => err instanceof AuthError && err.code === code);
const google = (sub, email, name) => signInWithGoogle({ sub, email, emailVerified: true, name });

const owner = google('g-owner', 'owner@example.com', 'Owner');

test('a user is told how their own account signs in, and nobody else is', async () => {
  const user = await signUp('selfie');
  assert.equal(toSelf(user).login, 'password');
  assert.equal(toSelf(google('g-1', 'a@example.com', 'Gina')).login, 'google');
  assert.equal('login' in toPublic(user), false);
});

test('changing the password needs the current one and signs out every session', async () => {
  const user = await signUp('changer');
  const phone = startSession(user);
  const laptop = startSession(user);

  await rejects(changePassword(user, 'not the password', 'another long password'), 'bad_credentials');
  await rejects(changePassword(user, PASSWORD, 'short'), 'invalid');
  await rejects(changePassword(user, PASSWORD, PASSWORD), 'invalid');
  await rejects(changePassword(user, PASSWORD, undefined), 'invalid');
  assert.ok(readSession(phone.token), 'failed attempts leave the sessions alone');

  await changePassword(user, PASSWORD, 'another long password');
  assert.equal(readSession(phone.token), undefined);
  assert.equal(readSession(laptop.token), undefined);
  await rejects(signIn(user, PASSWORD), 'bad_credentials');
  assert.equal((await signIn(user, 'another long password')).id, user.id);
});

test('guessing the current password is rate limited', async () => {
  const user = await signUp('guessed');
  for (let i = 0; i < 8; i++) await rejects(changePassword(user, `wrong guess number ${i}`, 'another long password'), 'bad_credentials');
  await rejects(changePassword(user, PASSWORD, 'another long password'), 'rate_limited');
});

test('accounts without a password cannot set one this way', async () => {
  const user = google('g-2', 'b@example.com', 'Gabe');
  await rejects(changePassword(user, '', 'another long password'), 'invalid');
  await rejects(changePassword(owner, '', 'another long password'), 'invalid');
});

test('deleting your own account takes the password and removes your comments', async () => {
  const user = await signUp('leaver');
  const other = await signUp('stayer');
  await savePost({ sourceMd: '正文', publishedAt: new Date('2026-01-01T00:00:00Z'), slug: 'open', title: 'Open', status: 'published' });
  addComment({ slug: 'open', source: 'mine' }, { role: 'user' }, user);
  addComment({ slug: 'open', source: 'theirs' }, { role: 'user' }, other);
  const session = startSession(user);

  await rejects(deleteOwnAccount(user, 'not the password'), 'bad_credentials');
  await rejects(deleteOwnAccount(user, ''), 'invalid');
  assert.ok(userById(user.id));

  await deleteOwnAccount(user, PASSWORD);
  assert.equal(userById(user.id), undefined);
  assert.equal(readSession(session.token), undefined);
  const left = db().prepare('SELECT user_id FROM comments').all().map((r) => Number(r.user_id));
  assert.deepEqual(left, [other.id]);
});

test('a Google account confirms deletion by typing its full name', async () => {
  const user = google('g-3', 'c@example.com', 'Gwen');
  await rejects(deleteOwnAccount(user, 'Gwen'), 'bad_credentials');
  await deleteOwnAccount(user, ` ${handleOf(user)} `);
  assert.equal(userById(user.id), undefined);
});

test('the endministrator account cannot be deleted', async () => {
  await rejects(deleteOwnAccount(owner, handleOf(owner)), 'invalid');
  assert.ok(userById(owner.id));
});

test('a reset gives a new password, once, and signs the user out', async () => {
  const user = await signUp('forgetful');
  const session = startSession(user);
  const fresh = await resetPassword(user.id);
  assert.ok(fresh.length >= 12);
  assert.equal(readSession(session.token), undefined);
  await rejects(signIn(user, PASSWORD), 'bad_credentials');
  assert.equal((await signIn(user, fresh)).id, user.id);
  assert.notEqual(await resetPassword(user.id), fresh);

  await rejects(resetPassword(owner.id), 'not_found');
  await rejects(resetPassword(999999), 'not_found');
  await rejects(resetPassword(google('g-4', 'd@example.com', 'Gil').id), 'invalid');
});

test('activity counts live sessions only', async () => {
  const user = await signUp('active');
  assert.equal(userActivity().get(user.id), undefined);
  startSession(user);
  const second = startSession(user);
  assert.equal(userActivity().get(user.id).sessions, 2);
  db().prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').run(new Date(Date.now() - 1000).toISOString(), user.id);
  assert.equal(userActivity().get(user.id), undefined);
  assert.equal(readSession(second.token), undefined);
});
