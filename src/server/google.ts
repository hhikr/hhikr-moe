// Google sign-in: OpenID Connect authorization-code flow with PKCE.
import crypto from 'node:crypto';
import type { GoogleConfig } from './config.ts';
import { randomToken } from './secrets.ts';

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** What must be remembered between sending the visitor to Google and their return. */
export interface PendingSignIn {
  state: string;
  nonce: string;
  verifier: string;
  /** Site-relative address to return to afterwards. */
  returnTo: string;
}

export interface GoogleProfile {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

export function beginSignIn(config: GoogleConfig, redirectUri: string, returnTo: string): { url: string; pending: PendingSignIn } {
  const pending = { state: randomToken(24), nonce: randomToken(24), verifier: randomToken(48), returnTo };
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: crypto.createHash('sha256').update(pending.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return { url: url.href, pending };
}

/** Check the claims of an ID token. The token came straight from Google over TLS, which is what vouches for it. */
export function profileFromClaims(claims: any, clientId: string, nonce: string, nowSeconds = Date.now() / 1000): GoogleProfile {
  if (!claims || typeof claims.sub !== 'string' || !claims.sub) throw new Error('ID token has no subject');
  if (!ISSUERS.includes(claims.iss)) throw new Error('ID token has the wrong issuer');
  if (claims.aud !== clientId) throw new Error('ID token is for another application');
  if (typeof claims.exp !== 'number' || claims.exp < nowSeconds - 60) throw new Error('ID token has expired');
  if (claims.nonce !== nonce) throw new Error('ID token does not match this sign-in attempt');
  return {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : undefined,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: typeof claims.name === 'string' ? claims.name : undefined,
  };
}

export async function completeSignIn(config: GoogleConfig, redirectUri: string, pending: PendingSignIn, code: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: pending.verifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google token endpoint answered ${res.status}`);
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  const payload = idToken?.split('.')[1];
  if (!payload) throw new Error('Google did not return an ID token');
  return profileFromClaims(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')), config.clientId, pending.nonce);
}
