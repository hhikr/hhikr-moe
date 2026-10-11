// Accounts. A user's full name is "nickname#1234": nicknames may repeat, the
// four-digit tag makes the pair unique.
import crypto from 'node:crypto';
import { db } from './db.ts';
import type { Role } from './posts.ts';

export interface User {
  id: number;
  role: Exclude<Role, 'guest'>;
  nickname: string;
  discriminator: string;
  passwordHash: string | null;
  googleSub: string | null;
  avatarSha256: string | null;
  status: 'active' | 'banned';
  createdAt: Date;
}

/** What the browser is told about the signed-in user. */
export interface PublicUser {
  nickname: string;
  /** Empty for the endministrator, who is shown by name alone. */
  tag: string;
  handle: string;
  role: User['role'];
  avatar: string | null;
}

/** Names nobody may register, so that nobody can pose as the site owner. */
const RESERVED = ['hhikr', 'endmin', 'endministrator', 'admin', 'administrator', 'root', 'moderator', '站长', '管理员'];

const WEAK_PASSWORDS = new Set([
  '1234567890', '0123456789', '0987654321', '1234567891', '12345678910', '123456789a', 'qwertyuiop', 'qwerty12345',
  'password123', 'password1234', 'passwordpassword', '1q2w3e4r5t', '1qaz2wsx3edc', 'iloveyou123', 'abcdefghij',
  'abc1234567', 'a123456789', 'asdfghjkl;', 'zxcvbnm123', '1122334455', '1111111111', '0000000000', 'woaini1314520',
  '5201314520', '1314520520', 'qq123456789', 'aa12345678', '147258369a', 'letmein123', 'welcome123', 'adminadmin',
]);

export const handleOf = (u: Pick<User, 'nickname' | 'discriminator' | 'role'>) =>
  u.role === 'endmin' ? u.nickname : `${u.nickname}#${u.discriminator}`;

export const toPublic = (u: User): PublicUser => ({
  nickname: u.nickname,
  tag: u.role === 'endmin' ? '' : u.discriminator,
  handle: handleOf(u),
  role: u.role,
  avatar: u.avatarSha256 ? `/avatars/${u.avatarSha256}.webp` : null,
});

function toUser(row: any): User {
  return {
    id: Number(row.id),
    role: row.role,
    nickname: row.nickname,
    discriminator: row.discriminator,
    passwordHash: row.password_hash,
    googleSub: row.google_sub,
    avatarSha256: row.avatar_sha256,
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}

const one = (sql: string, ...args: any[]): User | undefined => {
  const row = db().prepare(sql).get(...args);
  return row ? toUser(row) : undefined;
};

export const userById = (id: number) => one('SELECT * FROM users WHERE id = ?', id);
export const userByGoogleSub = (sub: string) => one('SELECT * FROM users WHERE google_sub = ?', sub);
export const endminUser = () => one("SELECT * FROM users WHERE role = 'endmin' LIMIT 1");

/** Find a password account by its full name, "nickname#1234". */
export function userByHandle(handle: string): User | undefined {
  const at = handle.lastIndexOf('#');
  if (at < 1) return undefined;
  return one('SELECT * FROM users WHERE nickname = ? AND discriminator = ?', handle.slice(0, at).trim(), handle.slice(at + 1).trim());
}

/** Returns a message describing what is wrong with the nickname, or undefined when it is fine. */
export function nicknameProblem(raw: string): string | undefined {
  const name = raw.trim();
  const length = [...name].length;
  if (length < 2 || length > 20) return '昵称需要 2 到 20 个字符';
  if (/[#@\s\p{Cc}\p{Cf}]/u.test(name)) return '昵称不能包含 #、@ 或空白字符';
  if (RESERVED.includes(name.normalize('NFKC').toLowerCase())) return '这个昵称不能使用';
  return undefined;
}

export function passwordProblem(password: string, nickname: string): string | undefined {
  if ([...password].length < 10) return '密码至少需要 10 个字符';
  if (password.length > 200) return '密码太长了';
  const lower = password.toLowerCase();
  if (lower === nickname.trim().toLowerCase()) return '密码不能和昵称相同';
  if (WEAK_PASSWORDS.has(lower) || new Set(lower).size < 4) return '这个密码太常见了，请换一个';
  return undefined;
}

/** Turn whatever name Google gives us into an acceptable nickname. */
export function nicknameFromProfile(name: string | undefined): string {
  const cleaned = [...(name ?? '').replace(/[#@\s\p{Cc}\p{Cf}]/gu, '')].slice(0, 20).join('');
  return nicknameProblem(cleaned) ? '用户' : cleaned;
}

/** Pick an unused four-digit tag for this nickname. */
function freeDiscriminator(nickname: string): string {
  const taken = new Set(
    db().prepare('SELECT discriminator FROM users WHERE nickname = ?').all(nickname).map((r: any) => String(r.discriminator)),
  );
  if (taken.size >= 10000) throw new Error('NICKNAME_FULL');
  for (;;) {
    const candidate = String(crypto.randomInt(10000)).padStart(4, '0');
    if (!taken.has(candidate)) return candidate;
  }
}

export interface NewUser {
  nickname: string;
  passwordHash?: string;
  googleSub?: string;
  role?: User['role'];
}

export function createUser(input: NewUser): User {
  const nickname = input.nickname.trim();
  const result = db()
    .prepare('INSERT INTO users (role, nickname, discriminator, password_hash, google_sub, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(input.role ?? 'user', nickname, freeDiscriminator(nickname), input.passwordHash ?? null, input.googleSub ?? null, new Date().toISOString());
  return userById(Number(result.lastInsertRowid))!;
}

/** Make this account the endministrator. Only the Google sign-in path calls this. */
export function promoteToEndmin(userId: number): User {
  db().prepare("UPDATE users SET role = 'endmin', nickname = 'hhikr', discriminator = '0000' WHERE id = ?").run(userId);
  return userById(userId)!;
}

export function listUsers(): User[] {
  return db().prepare('SELECT * FROM users ORDER BY id DESC').all().map(toUser);
}

/** Change a nickname. The tag is kept unless someone with the new nickname already has it. */
export function renameUser(user: User, nickname: string): User {
  const name = nickname.trim();
  const clash = db().prepare('SELECT 1 FROM users WHERE nickname = ? AND discriminator = ? AND id <> ?').get(name, user.discriminator, user.id);
  db()
    .prepare('UPDATE users SET nickname = ?, discriminator = ? WHERE id = ?')
    .run(name, clash ? freeDiscriminator(name) : user.discriminator, user.id);
  return userById(user.id)!;
}

export function setAvatar(userId: number, sha256: string | null): void {
  db().prepare('UPDATE users SET avatar_sha256 = ? WHERE id = ?').run(sha256, userId);
}

/** Ban or reinstate an ordinary account. The endministrator cannot be banned. */
export function setUserStatus(userId: number, status: User['status']): boolean {
  const changed = db().prepare("UPDATE users SET status = ? WHERE id = ? AND role <> 'endmin'").run(status, userId);
  if (status === 'banned') db().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  return Number(changed.changes) === 1;
}

/** Delete an ordinary account together with its sessions and comments. */
export function deleteUser(userId: number): boolean {
  return Number(db().prepare("DELETE FROM users WHERE id = ? AND role <> 'endmin'").run(userId).changes) === 1;
}