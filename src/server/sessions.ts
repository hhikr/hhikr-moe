// Sign-in sessions. The browser holds a random token; the database holds only its hash.
import { secureCookies } from './config.ts';
import { db } from './db.ts';
import { randomToken, sha256 } from './secrets.ts';
import { userById, type User } from './users.ts';

const DAY = 86_400_000;
const lifetime = (role: User['role']) => (role === 'endmin' ? 7 : 30) * DAY;

export const sessionCookieName = () => (secureCookies() ? '__Host-sid' : 'sid');

export const sessionCookieOptions = (expires?: Date) => ({
  httpOnly: true,
  secure: secureCookies(),
  sameSite: 'lax' as const,
  path: '/',
  ...(expires ? { expires } : {}),
});

export interface StartedSession {
  token: string;
  expires: Date;
}

export function startSession(user: User): StartedSession {
  const token = randomToken();
  const expires = new Date(Date.now() + lifetime(user.role));
  db()
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), user.id, new Date().toISOString(), expires.toISOString());
  db().prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  return { token, expires };
}

export interface ActiveSession {
  user: User;
  /** Set when the session was extended and the cookie should be sent again. */
  renewedUntil?: Date;
}

/** The signed-in user for a session token, or undefined when it is unknown, expired or the account is banned. */
export function readSession(token: string | undefined): ActiveSession | undefined {
  if (!token) return undefined;
  const hash = sha256(token);
  const row: any = db().prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(hash);
  if (!row) return undefined;
  const expires = new Date(row.expires_at);
  if (expires.valueOf() <= Date.now()) {
    db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    return undefined;
  }
  const user = userById(Number(row.user_id));
  if (!user || user.status !== 'active') return undefined;

  // Sessions slide: once half the lifetime is gone, extend it.
  const full = lifetime(user.role);
  if (expires.valueOf() - Date.now() < full / 2) {
    const renewedUntil = new Date(Date.now() + full);
    db().prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(renewedUntil.toISOString(), hash);
    return { user, renewedUntil };
  }
  return { user };
}

export function endSession(token: string | undefined): void {
  if (token) db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function endAllSessions(userId: number): void {
  db().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}
