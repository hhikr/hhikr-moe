// Handing the endministrator over to Cosmo: one-time codes and the grants behind them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-cosmo-'));
process.env.DATA_DIR = dir;
process.env.COSMO_GATE_SECRET = 'a-shared-secret-of-at-least-32-characters';

const { closeDb, db } = await import('../../src/server/db.ts');
const { cosmoGrantStands, cosmoOrigin, isCosmoGate, issueCosmoCode, redeemCosmoCode, revokeCosmoGrant, validState } = await import('../../src/server/cosmo.ts');
const { sha256 } = await import('../../src/server/secrets.ts');
const { endSession, startSession } = await import('../../src/server/sessions.ts');
const { createUser, promoteToEndmin, setUserStatus } = await import('../../src/server/users.ts');

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

const owner = promoteToEndmin(createUser({ nickname: 'owner', googleSub: 'g-owner' }).id);
const visitor = createUser({ nickname: 'visitor', googleSub: 'g-visitor' });
const signedIn = (user) => startSession(user).token;

test('only the endministrator is given a code', () => {
  assert.equal(issueCosmoCode(undefined), undefined);
  assert.equal(issueCosmoCode('not-a-session'), undefined);
  assert.equal(issueCosmoCode(signedIn(visitor)), undefined);
  assert.match(issueCosmoCode(signedIn(owner)), /^[A-Za-z0-9_-]{40,}$/);
});

test('a code is stored as a hash, works once and names the endministrator', () => {
  const code = issueCosmoCode(signedIn(owner));
  assert.equal(db().prepare('SELECT count(*) AS n FROM cosmo_codes WHERE code_hash = ?').get(code).n, 0, 'the code itself is not kept');

  const redeemed = redeemCosmoCode(code);
  assert.deepEqual(redeemed.user, { id: owner.id, nickname: owner.nickname });
  assert.equal(cosmoGrantStands(redeemed.grant), true);
  assert.equal(redeemCosmoCode(code), undefined, 'a second exchange gets nothing');
  for (const junk of [undefined, '', 'made-up', 42, {}]) assert.equal(redeemCosmoCode(junk), undefined);
});

test('a code that has expired, or whose session has ended, is refused', () => {
  const stale = issueCosmoCode(signedIn(owner));
  db().prepare('UPDATE cosmo_codes SET expires_at = 1').run();
  assert.equal(redeemCosmoCode(stale), undefined);

  const token = signedIn(owner);
  const orphaned = issueCosmoCode(token);
  endSession(token);
  assert.equal(redeemCosmoCode(orphaned), undefined);
});

test('a grant ends with the session it came from', () => {
  const token = signedIn(owner);
  const { grant } = redeemCosmoCode(issueCosmoCode(token));
  const other = redeemCosmoCode(issueCosmoCode(signedIn(owner))).grant;
  assert.equal(cosmoGrantStands(grant), true);

  endSession(token);
  assert.equal(cosmoGrantStands(grant), false, 'signing out of the site signs out of Cosmo');
  assert.equal(db().prepare('SELECT count(*) AS n FROM cosmo_grants WHERE grant_hash = ?').get(sha256(grant)).n, 0, 'the grant row goes with the session');
  assert.equal(cosmoGrantStands(other), true, 'other sign-ins are untouched');
});

test('a grant stops standing when the session expires, the role changes or the account is banned', () => {
  const expiring = redeemCosmoCode(issueCosmoCode(signedIn(owner))).grant;
  db().prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE token_hash IN (SELECT session_hash FROM cosmo_grants)").run();
  assert.equal(cosmoGrantStands(expiring), false);

  const demoted = redeemCosmoCode(issueCosmoCode(signedIn(owner))).grant;
  db().prepare("UPDATE users SET role = 'user' WHERE id = ?").run(owner.id);
  assert.equal(cosmoGrantStands(demoted), false);
  db().prepare("UPDATE users SET role = 'endmin' WHERE id = ?").run(owner.id);
  assert.equal(cosmoGrantStands(demoted), true);

  db().prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(owner.id);
  assert.equal(cosmoGrantStands(demoted), false);
  db().prepare("UPDATE users SET status = 'active' WHERE id = ?").run(owner.id);
  assert.equal(setUserStatus(visitor.id, 'banned'), true);
});

test('checking a grant does not extend the site session', () => {
  const token = signedIn(owner);
  const { grant } = redeemCosmoCode(issueCosmoCode(token));
  // Close enough to its end that reading the session the usual way would renew it.
  const soon = new Date(Date.now() + 60_000).toISOString();
  db().prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(soon, sha256(token));
  assert.equal(cosmoGrantStands(grant), true);
  assert.equal(db().prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(sha256(token)).expires_at, soon, 'expiry was left as it was');
});

test('revoking a grant ends it', () => {
  const { grant } = redeemCosmoCode(issueCosmoCode(signedIn(owner)));
  revokeCosmoGrant(grant);
  assert.equal(cosmoGrantStands(grant), false);
  for (const junk of [undefined, '', 'made-up', 42]) assert.equal(cosmoGrantStands(junk), false);
});

test('the gate is recognised by the shared secret only', () => {
  assert.equal(isCosmoGate('a-shared-secret-of-at-least-32-characters'), true);
  for (const wrong of [undefined, null, '', 'a-shared-secret-of-at-least-32-characterz', 'short']) assert.equal(isCosmoGate(wrong), false);
  process.env.COSMO_GATE_SECRET = 'too-short';
  assert.equal(isCosmoGate('too-short'), false, 'a weak secret turns the door off');
  delete process.env.COSMO_GATE_SECRET;
  assert.equal(isCosmoGate(''), false);
});

test('the Cosmo origin and the state are validated', () => {
  delete process.env.COSMO_ORIGIN;
  assert.equal(cosmoOrigin(), undefined);
  process.env.COSMO_ORIGIN = 'https://cosmo.example.com/';
  assert.equal(cosmoOrigin(), 'https://cosmo.example.com');
  for (const bad of ['cosmo.example.com', 'https://cosmo.example.com/path', 'javascript:alert(1)']) {
    process.env.COSMO_ORIGIN = bad;
    assert.equal(cosmoOrigin(), undefined, bad);
  }
  assert.equal(validState('A'.repeat(43)), true);
  for (const bad of [null, '', 'short', 'has space in it, twenty-two', `${'A'.repeat(43)}&x=1`, 'A'.repeat(65)]) assert.equal(validState(bad), false);
});
