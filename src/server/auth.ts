// Registration and sign-in rules.
//
// The endministrator role is granted in exactly one place, signInWithGoogle,
// and only to the Google account named in the server's configuration.
import { endminEmail } from './config.ts';
import { redeemChallenge, type Solution } from './challenge.ts';
import { db } from './db.ts';
import type { GoogleProfile } from './google.ts';
import { addressKey, allow, LIMITS } from './ratelimit.ts';
import { decoyHash, hashPassword, randomToken, sha256, verifyPassword } from './secrets.ts';
import {
  createUser,
  endminUser,
  nicknameFromProfile,
  nicknameProblem,
  passwordProblem,
  promoteToEndmin,
  userByGoogleSub,
  userByHandle,
  type User,
} from './users.ts';

export class AuthError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const TOO_MANY = () => new AuthError('rate_limited', '操作太频繁了，请稍后再试', 429);
/** One message for every failed sign-in, so it never reveals whether the account exists. */
const BAD_LOGIN = () => new AuthError('bad_credentials', '名字或密码不正确', 401);

export interface Registration {
  nickname: string;
  password: string;
  /** Hidden form field. Real people leave it empty. */
  website?: string;
  challenge?: Partial<Solution>;
}

export async function register(input: Registration, address: string): Promise<User> {
  if (!allow(`register:${addressKey(address)}`, LIMITS.register)) throw TOO_MANY();
  if (typeof input.nickname !== 'string' || typeof input.password !== 'string') throw new AuthError('invalid', '请填写昵称和密码');
  // Bots that fill in the hidden field get the same answer as a bad challenge.
  if (input.website || !redeemChallenge(input.challenge)) throw new AuthError('challenge_failed', '验证没有通过，请刷新页面后重试');

  const problem = nicknameProblem(input.nickname) ?? passwordProblem(input.password, input.nickname);
  if (problem) throw new AuthError('invalid', problem);
  try {
    return createUser({ nickname: input.nickname, passwordHash: await hashPassword(input.password) });
  } catch (err) {
    if (err instanceof Error && err.message === 'NICKNAME_FULL') throw new AuthError('invalid', '这个昵称用的人太多了，请换一个');
    throw err;
  }
}

export async function signInWithPassword(handle: string, password: string, address: string): Promise<User> {
  if (typeof handle !== 'string' || typeof password !== 'string') throw BAD_LOGIN();
  if (!allow(`login:${addressKey(address)}`, LIMITS.loginByAddress)) throw TOO_MANY();
  if (!allow(`login-account:${handle.trim().toLowerCase().slice(0, 64)}`, LIMITS.loginByAccount)) throw TOO_MANY();

  const user = userByHandle(handle);
  // Always do the expensive check, even for unknown accounts.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await decoyHash()));
  if (!user || !user.passwordHash || !ok || user.status !== 'active') throw BAD_LOGIN();
  // The endministrator signs in through Google only.
  if (user.role === 'endmin') throw BAD_LOGIN();
  return user;
}

export function signInWithGoogle(profile: GoogleProfile): User {
  const conn = db();
  const boundSub = (conn.prepare("SELECT value FROM settings WHERE key = 'endmin_google_sub'").get() as any)?.value as string | undefined;

  let user = userByGoogleSub(profile.sub) ?? createUser({ nickname: nicknameFromProfile(profile.name), googleSub: profile.sub });
  if (user.status !== 'active') throw new AuthError('banned', '这个账号已被停用', 403);

  // First sign-in of the configured account binds the role to its Google id.
  const configured = endminEmail();
  if (!boundSub && configured && profile.emailVerified && profile.email === configured && !endminUser()) {
    conn.prepare("INSERT INTO settings (key, value) VALUES ('endmin_google_sub', ?)").run(profile.sub);
    user = promoteToEndmin(user.id);
  }
  return user;
}

const LINK_LIFETIME = 300;

/** Create a one-time sign-in link for the endministrator. Called from the server's command line only. */
export function createLoginLink(): string {
  if (!endminUser()) throw new Error('No endministrator exists yet. Sign in with the configured Google account first.');
  const token = randomToken();
  db().prepare('INSERT INTO login_links (token_hash, expires_at) VALUES (?, ?)').run(sha256(token), Math.floor(Date.now() / 1000) + LINK_LIFETIME);
  return token;
}

export function redeemLoginLink(token: string, address: string): User {
  if (!allow(`link:${addressKey(address)}`, LIMITS.loginByAddress)) throw TOO_MANY();
  const conn = db();
  const now = Math.floor(Date.now() / 1000);
  conn.prepare('DELETE FROM login_links WHERE expires_at < ?').run(now);
  const used = conn.prepare('DELETE FROM login_links WHERE token_hash = ? AND expires_at >= ?').run(sha256(String(token)), now);
  const user = endminUser();
  if (Number(used.changes) !== 1 || !user || user.status !== 'active') throw new AuthError('bad_link', '链接无效或已过期', 401);
  return user;
}
