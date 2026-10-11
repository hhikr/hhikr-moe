// Proof of work for registration (and later for comments): the browser must
// find a number whose hash with the server's salt starts with enough zero
// bits. Cheap for one person, costly for a script creating accounts in bulk.
import crypto from 'node:crypto';
import { db } from './db.ts';
import { hmac, randomToken, safeEqual } from './secrets.ts';

export const DIFFICULTY_BITS = 15;
const LIFETIME = 300;

export interface Challenge {
  salt: string;
  bits: number;
  expires: number;
  signature: string;
}

const sign = (salt: string, bits: number, expires: number) => hmac(`pow:${salt}:${bits}:${expires}`);
const now = () => Math.floor(Date.now() / 1000);

export function issueChallenge(): Challenge {
  const salt = randomToken(16);
  const expires = now() + LIFETIME;
  return { salt, bits: DIFFICULTY_BITS, expires, signature: sign(salt, DIFFICULTY_BITS, expires) };
}

function leadingZeroBits(buf: Buffer): number {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

export const solves = (salt: string, nonce: string, bits: number) =>
  leadingZeroBits(crypto.createHash('sha256').update(`${salt}:${nonce}`).digest()) >= bits;

export interface Solution extends Challenge {
  nonce: string;
}

/** Check a solved challenge and mark it spent. Each challenge works once. */
export function redeemChallenge(s: Partial<Solution> | undefined): boolean {
  if (!s || typeof s.salt !== 'string' || typeof s.nonce !== 'string' || typeof s.signature !== 'string') return false;
  if (typeof s.expires !== 'number' || typeof s.bits !== 'number') return false;
  if (s.bits < DIFFICULTY_BITS || s.expires < now()) return false;
  if (!safeEqual(s.signature, sign(s.salt, s.bits, s.expires))) return false;
  if (s.nonce.length > 32 || !solves(s.salt, s.nonce, s.bits)) return false;

  const conn = db();
  conn.prepare('DELETE FROM used_challenges WHERE expires_at < ?').run(now());
  const spent = conn.prepare('INSERT OR IGNORE INTO used_challenges (salt, expires_at) VALUES (?, ?)').run(s.salt, s.expires);
  return Number(spent.changes) === 1;
}
