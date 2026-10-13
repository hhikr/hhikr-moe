// Sign-in for Cosmo (the Hermes workspace on its own subdomain).
//
// The session cookie is `__Host-` scoped and never reaches a subdomain, so the
// endministrator is handed over in two steps. The site gives the browser a
// code that works once and expires within a minute; the Cosmo gate, a service
// on the same machine, exchanges it for a grant. A grant is only as good as the
// site session it came from: sign out, a ban or a change of role ends it.
import { db } from './db.ts';
import { randomToken, safeEqual, sha256 } from './secrets.ts';
import { readSession } from './sessions.ts';

const CODE_LIFETIME = 60_000;

/** Where Cosmo is served (https://cosmo.hhikr.moe). Unset means Cosmo sign-in is off. */
export function cosmoOrigin(): string | undefined {
  const origin = process.env.COSMO_ORIGIN?.trim().replace(/\/+$/, '');
  return origin && /^https?:\/\/[^/]+$/.test(origin) ? origin : undefined;
}

/** True when `presented` is the secret the site shares with the Cosmo gate. */
export function isCosmoGate(presented: string | null | undefined): boolean {
  const secret = process.env.COSMO_GATE_SECRET;
  if (!secret || secret.length < 32 || !presented) return false;
  return safeEqual(presented, secret);
}

/** The gate chooses `state`; it comes back untouched with the code. */
export const validState = (state: string | null | undefined): state is string => !!state && /^[A-Za-z0-9_-]{22,64}$/.test(state);

/** A one-time code for the endministrator behind `sessionToken`, or undefined for anyone else. */
export function issueCosmoCode(sessionToken: string | undefined): string | undefined {
  if (!sessionToken || readSession(sessionToken)?.user.role !== 'endmin') return undefined;
  const code = randomToken();
  db().prepare('DELETE FROM cosmo_codes WHERE expires_at < ?').run(Date.now());
  db()
    .prepare('INSERT INTO cosmo_codes (code_hash, session_hash, expires_at) VALUES (?, ?, ?)')
    .run(sha256(code), sha256(sessionToken), Date.now() + CODE_LIFETIME);
  return code;
}

export interface CosmoGrant {
  grant: string;
  user: { id: number; nickname: string };
}

/** Exchange a code for a grant. A code works once; a second attempt gets nothing. */
export function redeemCosmoCode(code: unknown): CosmoGrant | undefined {
  if (typeof code !== 'string' || !code) return undefined;
  const row: any = db().prepare('DELETE FROM cosmo_codes WHERE code_hash = ? RETURNING session_hash, expires_at').get(sha256(code));
  if (!row || Number(row.expires_at) <= Date.now()) return undefined;
  const user = endminBehind(String(row.session_hash));
  if (!user) return undefined;
  const grant = randomToken();
  db()
    .prepare('INSERT INTO cosmo_grants (grant_hash, session_hash, created_at) VALUES (?, ?, ?)')
    .run(sha256(grant), String(row.session_hash), new Date().toISOString());
  return { grant, user };
}

/** Whether the grant still stands for a signed-in, active endministrator. */
export function cosmoGrantStands(grant: unknown): boolean {
  if (typeof grant !== 'string' || !grant) return false;
  const row: any = db().prepare('SELECT session_hash FROM cosmo_grants WHERE grant_hash = ?').get(sha256(grant));
  return !!row && !!endminBehind(String(row.session_hash));
}

export function revokeCosmoGrant(grant: unknown): void {
  if (typeof grant === 'string' && grant) db().prepare('DELETE FROM cosmo_grants WHERE grant_hash = ?').run(sha256(grant));
}

/** The endministrator a live session belongs to. Reads the session row directly: a grant check must not extend it. */
function endminBehind(sessionHash: string): CosmoGrant['user'] | undefined {
  const row: any = db()
    .prepare(
      `SELECT u.id, u.nickname FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active' AND u.role = 'endmin'`,
    )
    .get(sessionHash, new Date().toISOString());
  return row ? { id: Number(row.id), nickname: String(row.nickname) } : undefined;
}
