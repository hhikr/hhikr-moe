// Fixed-window counters in SQLite. Addresses are stored only as keyed hashes.
import { db } from './db.ts';
import { hmac } from './secrets.ts';

export interface Limit {
  /** Requests allowed per window. */
  max: number;
  /** Window length in seconds. */
  window: number;
}

export const LIMITS = {
  register: { max: 5, window: 3600 },
  loginByAddress: { max: 20, window: 600 },
  loginByAccount: { max: 10, window: 600 },
  challenge: { max: 60, window: 600 },
  comment: { max: 5, window: 600 },
  avatar: { max: 5, window: 3600 },
  rename: { max: 5, window: 3600 },
  password: { max: 8, window: 3600 },
  hit: { max: 240, window: 600 },
} satisfies Record<string, Limit>;

const now = () => Math.floor(Date.now() / 1000);

/** A stable, non-reversible stand-in for an IP address. */
export const addressKey = (address: string) => hmac(`addr:${address}`).slice(0, 22);

/**
 * Count one attempt. Returns false when the limit is already used up.
 * @param key what is being limited, e.g. `login:<address hash>`
 */
export function allow(key: string, limit: Limit): boolean {
  const conn = db();
  const t = now();
  const row: any = conn.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?').get(key);
  if (!row || t - Number(row.window_start) >= limit.window) {
    conn
      .prepare('INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start')
      .run(key, t);
    // Addresses are kept only as long as they are needed: drop windows that ended a day ago.
    conn.prepare('DELETE FROM rate_limits WHERE window_start < ?').run(t - 86400);
    return true;
  }
  if (Number(row.count) >= limit.max) return false;
  conn.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return true;
}
