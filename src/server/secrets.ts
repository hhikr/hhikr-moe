// Tokens, hashes and password storage. Built-in node:crypto only.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { secretKey } from './config.ts';

const argon2 = promisify(crypto.argon2);

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const hmac = (value: string) => crypto.createHmac('sha256', secretKey()).update(value).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// argon2id with OWASP's baseline parameters. They are stored with each hash,
// so they can be raised later without invalidating existing passwords.
const PARAMS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };

export async function hashPassword(password: string): Promise<string> {
  const nonce = crypto.randomBytes(16);
  const tag = await argon2('argon2id', { message: password, nonce, ...PARAMS });
  return ['argon2id', PARAMS.memory, PARAMS.passes, PARAMS.parallelism, nonce.toString('base64url'), tag.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, memory, passes, parallelism, nonce, tag] = stored.split('$');
  if (algorithm !== 'argon2id' || !tag) return false;
  const expected = Buffer.from(tag, 'base64url');
  const actual = await argon2('argon2id', {
    message: password,
    nonce: Buffer.from(nonce, 'base64url'),
    memory: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
    tagLength: expected.length,
  });
  return crypto.timingSafeEqual(actual, expected);
}

/** A hash of nothing in particular, verified when the account does not exist so timing gives nothing away. */
let decoy: Promise<string> | undefined;
export const decoyHash = () => (decoy ??= hashPassword(randomToken()));
