// Accounts, sign-in rules and who can become the endministrator.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-auth-'));
process.env.DATA_DIR = dir;
process.env.ENDMIN_GOOGLE_EMAIL = 'Owner@Example.com';

const { closeDb, db } = await import('../../src/server/db.ts');
const { AuthError, createLoginLink, redeemLoginLink, register, signInWithGoogle, signInWithPassword } = await import('../../src/server/auth.ts');
const { issueChallenge, redeemChallenge, solves, DIFFICULTY_BITS } = await import('../../src/server/challenge.ts');
const { profileFromClaims } = await import('../../src/server/google.ts');
const { allow } = await import('../../src/server/ratelimit.ts');
const { hashPassword, verifyPassword } = await import('../../src/server/secrets.ts');
const { endSession, readSession, startSession } = await import('../../src/server/sessions.ts');
const { handleOf, nicknameProblem, passwordProblem, toPublic, userById } = await import('../../src/server/users.ts');

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

function solved() {
  const c = issueChallenge();
  for (let n = 0; ; n++) if (solves(c.salt, String(n), c.bits)) return { ...c, nonce: String(n) };
}
let addr = 0;
const freshAddress = () => `10.0.${Math.floor(addr / 250)}.${addr++ % 250}`;
const signUp = (nickname, password = 'correct horse battery') =>
  register({ nickname, password, challenge: solved() }, freshAddress());
const rejects = (promise, code) => assert.rejects(promise, (err) => err instanceof AuthError && err.code === code);

test('passwords are stored as salted argon2id hashes', async () => {
  const a = await hashPassword('correct horse battery');
  const b = await hashPassword('correct horse battery');
  assert.match(a, /^argon2id\$/);
  assert.notEqual(a, b);
  assert.ok(!a.includes('correct'));
  assert.equal(await verifyPassword('correct horse battery', a), true);
  assert.equal(await verifyPassword('wrong horse battery', a), false);
});

test('two people can share a nickname and get different tags', async () => {
  const a = await signUp('narrator');
  const b = await signUp('narrator');
  const c = await signUp('NARRATOR');
  assert.equal(a.nickname, 'narrator');
  assert.match(a.discriminator, /^\d{4}$/);
  assert.equal(new Set([a, b, c].map((u) => u.discriminator)).size, 3, 'nicknames are compared without regard to case');
  assert.equal(handleOf(a), `narrator#${a.discriminator}`);
  assert.equal((await signInWithPassword(handleOf(a), 'correct horse battery', freshAddress())).id, a.id);
  assert.equal((await signInWithPassword(handleOf(b), 'correct horse battery', freshAddress())).id, b.id);
});

test('reserved and malformed nicknames are refused', async () => {
  for (const name of ['hhikr', 'HHIKR', 'Endministrator', 'endmin', 'admin', '管理员', 'ｈｈｉｋｒ']) {
    assert.ok(nicknameProblem(name), name);
    await rejects(signUp(name), 'invalid');
  }
  for (const name of ['a', 'has space', 'with#hash', 'at@sign', 'x'.repeat(21), 'zero​width']) assert.ok(nicknameProblem(name), name);
  assert.equal(nicknameProblem('旅人'), undefined);
  assert.equal(nicknameProblem('narrator_01'), undefined);
});

test('weak passwords are refused', async () => {
  assert.ok(passwordProblem('short', 'someone'));
  assert.ok(passwordProblem('1234567890', 'someone'));
  assert.ok(passwordProblem('aaaaaaaaaaaa', 'someone'));
  assert.ok(passwordProblem('longnickname', 'LongNickname'));
  assert.equal(passwordProblem('correct horse battery', 'someone'), undefined);
  await rejects(signUp('weakling', 'password123'), 'invalid');
});

test('registration needs a solved, unused challenge and an empty trap field', async () => {
  const pw = 'correct horse battery';
  await rejects(register({ nickname: 'nochallenge', password: pw }, freshAddress()), 'challenge_failed');
  await rejects(register({ nickname: 'badnonce', password: pw, challenge: { ...issueChallenge(), nonce: 'x' } }, freshAddress()), 'challenge_failed');
  const forged = { ...solved(), bits: 1 };
  await rejects(register({ nickname: 'forged', password: pw, challenge: forged }, freshAddress()), 'challenge_failed');
  await rejects(register({ nickname: 'robot', password: pw, website: 'http://spam', challenge: solved() }, freshAddress()), 'challenge_failed');
  const once = solved();
  await register({ nickname: 'firstuse', password: pw, challenge: once }, freshAddress());
  await rejects(register({ nickname: 'seconduse', password: pw, challenge: once }, freshAddress()), 'challenge_failed');
  assert.equal(redeemChallenge({ ...solved(), expires: 1 }), false, 'expired or altered challenges fail');
  assert.ok(DIFFICULTY_BITS >= 12);
});

test('failed sign-ins all look the same', async () => {
  const user = await signUp('lookalike');
  const errors = [];
  for (const [handle, password] of [
    [handleOf(user), 'wrong password here'],
    ['nobody#0000', 'correct horse battery'],
    ['lookalike', 'correct horse battery'],
    ['', ''],
  ]) {
    try {
      await signInWithPassword(handle, password, freshAddress());
      assert.fail('should not sign in');
    } catch (err) {
      errors.push(`${err.code}|${err.status}|${err.message}`);
    }
  }
  assert.equal(new Set(errors).size, 1);
});

test('banned accounts cannot sign in and lose their sessions', async () => {
  const user = await signUp('troublemaker');
  const session = startSession(user);
  assert.equal(readSession(session.token)?.user.id, user.id);
  db().prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(user.id);
  assert.equal(readSession(session.token), undefined);
  await rejects(signInWithPassword(handleOf(user), 'correct horse battery', freshAddress()), 'bad_credentials');
});

test('sessions: only the hash is stored, and they end on sign-out and expiry', async () => {
  const user = await signUp('sessionuser');
  const { token } = startSession(user);
  const stored = db().prepare('SELECT token_hash FROM sessions WHERE user_id = ?').all(user.id).map((r) => r.token_hash);
  assert.ok(!stored.includes(token));
  assert.equal(readSession(token)?.user.id, user.id);
  assert.equal(readSession('not-a-token'), undefined);
  assert.equal(readSession(undefined), undefined);
  db().prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').run(new Date(Date.now() - 1000).toISOString(), user.id);
  assert.equal(readSession(token), undefined);
  const second = startSession(user);
  endSession(second.token);
  assert.equal(readSession(second.token), undefined);
});

test('rate limits count per key and window', () => {
  const limit = { max: 3, window: 60 };
  assert.deepEqual([1, 2, 3, 4, 5].map(() => allow('test:a', limit)), [true, true, true, false, false]);
  assert.equal(allow('test:b', limit), true);
});

test('repeated sign-in attempts against one account are cut off', async () => {
  const user = await signUp('target');
  let limited = false;
  for (let i = 0; i < 12; i++) {
    try {
      await signInWithPassword(handleOf(user), 'wrong password here', freshAddress());
    } catch (err) {
      if (err.code === 'rate_limited') limited = true;
    }
  }
  assert.ok(limited);
});

test('Google ID token claims are checked', () => {
  const now = 1_800_000_000;
  const good = { iss: 'https://accounts.google.com', aud: 'client', sub: '123', exp: now + 600, nonce: 'n', email: 'A@B.c', email_verified: true, name: 'Ann' };
  assert.deepEqual(profileFromClaims(good, 'client', 'n', now), { sub: '123', email: 'a@b.c', emailVerified: true, name: 'Ann' });
  for (const bad of [{ iss: 'https://evil.example' }, { aud: 'other' }, { exp: now - 600 }, { nonce: 'other' }, { sub: '' }]) {
    assert.throws(() => profileFromClaims({ ...good, ...bad }, 'client', 'n', now));
  }
});

test('only the configured Google account becomes the endministrator, and only once', async () => {
  const stranger = signInWithGoogle({ sub: 'g-stranger', email: 'someone@example.com', emailVerified: true, name: 'Some One' });
  assert.equal(stranger.role, 'user');
  assert.equal(stranger.nickname, 'SomeOne');

  const unverified = signInWithGoogle({ sub: 'g-unverified', email: 'owner@example.com', emailVerified: false, name: 'Faker' });
  assert.equal(unverified.role, 'user', 'an unverified address proves nothing');

  const named = signInWithGoogle({ sub: 'g-named', email: 'x@example.com', emailVerified: true, name: 'hhikr' });
  assert.equal(named.role, 'user');
  assert.notEqual(named.nickname.toLowerCase(), 'hhikr', 'a Google display name cannot claim a reserved nickname');

  const owner = signInWithGoogle({ sub: 'g-owner', email: 'owner@example.com', emailVerified: true, name: 'Whoever' });
  assert.equal(owner.role, 'endmin');
  assert.equal(owner.nickname, 'hhikr');
  assert.deepEqual(toPublic(owner), { nickname: 'hhikr', tag: '', handle: 'hhikr', role: 'endmin', avatar: null });
  assert.equal(signInWithGoogle({ sub: 'g-owner', emailVerified: true }).role, 'endmin', 'afterwards the Google id alone identifies them');

  // Someone else later arriving with the same address does not get the role.
  const impostor = signInWithGoogle({ sub: 'g-impostor', email: 'owner@example.com', emailVerified: true, name: 'Impostor' });
  assert.equal(impostor.role, 'user');
  assert.equal(db().prepare("SELECT count(*) AS n FROM users WHERE role = 'endmin'").get().n, 1);
  assert.equal(signInWithGoogle({ sub: 'g-stranger', emailVerified: true }).id, stranger.id, 'returning users keep their account');
});

test('the endministrator cannot be reached through password sign-in or registration', async () => {
  const owner = db().prepare("SELECT * FROM users WHERE role = 'endmin'").get();
  db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword('correct horse battery'), owner.id);
  await rejects(signInWithPassword('hhikr#0000', 'correct horse battery', freshAddress()), 'bad_credentials');
  await rejects(register({ nickname: 'hhikr', password: 'correct horse battery', role: 'endmin', challenge: solved() }, freshAddress()), 'invalid');
  const sneaky = await register({ nickname: 'sneaky', password: 'correct horse battery', role: 'endmin', challenge: solved() }, freshAddress());
  assert.equal(userById(sneaky.id).role, 'user', 'extra fields in the request are ignored');
});

test('emergency sign-in links work once and expire', () => {
  const token = createLoginLink();
  assert.equal(redeemLoginLink(token, freshAddress()).role, 'endmin');
  assert.throws(() => redeemLoginLink(token, freshAddress()), (err) => err.code === 'bad_link');
  assert.throws(() => redeemLoginLink('made-up', freshAddress()), (err) => err.code === 'bad_link');
  const stale = createLoginLink();
  db().prepare('UPDATE login_links SET expires_at = 1').run();
  assert.throws(() => redeemLoginLink(stale, freshAddress()), (err) => err.code === 'bad_link');
});