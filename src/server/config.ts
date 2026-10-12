// Runtime configuration. Everything under src/server/ stays free of `astro:`
// imports so it also runs in plain Node scripts and tests.
import path from 'node:path';

/** Where the database and uploaded files live. Read on every call so tests can point it elsewhere. */
export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR ?? '.data');
}

export function dataPath(...parts: string[]): string {
  return path.join(dataDir(), ...parts);
}

/** The public origin in production (https://hhikr.moe). Unset in development. */
export function siteOrigin(): string | undefined {
  return process.env.SITE_ORIGIN || undefined;
}

/** Cookies are marked Secure and use the __Host- prefix whenever the site is served over HTTPS. */
export function secureCookies(): boolean {
  return siteOrigin()?.startsWith('https://') ?? false;
}

/** Key for signing challenges and hashing addresses. Development falls back to a fixed value. */
export function secretKey(): string {
  const key = process.env.SECRET_KEY;
  if (key && key.length >= 32) return key;
  if (secureCookies()) throw new Error('SECRET_KEY must be set (at least 32 characters) in production');
  return 'development-only-secret-key-not-for-production';
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export function googleConfig(): GoogleConfig | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

/** The Google account that becomes the endministrator the first time it signs in. */
export function endminEmail(): string | undefined {
  return process.env.ENDMIN_GOOGLE_EMAIL?.trim().toLowerCase() || undefined;
}
