// Android PKCE broker at the real site-auth gate. No website grant or Hermes key leaves the gate.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CALLBACK = 'https://cosmo.hhikr.moe/android/auth/callback';
export const CLIENT_ID = 'moe.hhikr.cosmo.focus';
const random = () => crypto.randomBytes(32).toString('base64url');
const hash = value => crypto.createHash('sha256').update(value).digest('base64url');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const VALID43 = { test: value => typeof value === 'string' && value.length === 43 && !/[^A-Za-z0-9_-]/.test(value) };
const API = new Set(['GET /api/plugins/cosmo-tasks/rules', 'POST /api/plugins/cosmo-tasks/device-status', 'POST /api/plugins/cosmo-tasks/sleep/report']);
const LIMIT = 256;
const BODY_LIMIT = 4096;
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const answer = (res, status, data, extra = {}) => {
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(data));
};

export function createNative(config, auth, { now = Date.now } = {}) {
  const pending = new Map(), codes = new Map(), access = new Map(), rates = new Map();
  const association = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./association/assetlinks.json', import.meta.url)), 'utf8'));
  const landing = fs.readFileSync(fileURLToPath(new URL('./association/callback.html', import.meta.url)), 'utf8');
  function gc() {
    const time = now();
    for (const store of [pending, codes, access]) for (const [key, entry] of store) if (entry.expires <= time) store.delete(key);
    for (const [key, entry] of rates) if (entry.until <= time) rates.delete(key);
  }
  function limited(req, endpoint) {
    gc();const key = `${endpoint}:${req.socket?.remoteAddress ?? 'unknown'}`;
    let entry = rates.get(key);
    if (!entry) {
      if (rates.size >= 512) return true;
      rates.set(key, entry = { count: 0, until: now() + 60000 });
    }
    return ++entry.count > 30;
  }
  const capacity = () => pending.size + codes.size + access.size < LIMIT;
  const ownWrite = req => (!req.headers.origin || req.headers.origin === config.publicOrigin) &&
    (req.headers['sec-fetch-site'] === undefined || req.headers['sec-fetch-site'] === 'same-origin');
  function only(url, allowed) {
    for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) return false;
    return !url.hash;
  }
  async function body(req) {
    if (String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') throw Object.assign(new Error(), { status: 415 });
    if (Number(req.headers['content-length']) > BODY_LIMIT) throw Object.assign(new Error(), { status: 413 });
    const chunks = [];let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > BODY_LIMIT) throw Object.assign(new Error(), { status: 413 });
      chunks.push(chunk);
    }
    try {
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
      return result;
    } catch { throw Object.assign(new Error(), { status: 400 }); }
  }
  async function issue(res, handle, session) {
    const entry = pending.get(hash(handle));pending.delete(hash(handle));
    if (!entry || entry.expires <= now() || !session) return answer(res, 400, { detail: 'Restart sign-in.' });
    const code = random();codes.set(hash(code), { ...entry, sessionId: session.id, expires: now() + 120000 });
    res.writeHead(302, { ...headers, Location: `${CALLBACK}?code=${code}&state=${entry.state}` });res.end();
  }
  async function handle(req, res, url) {
    if (url.pathname === '/.well-known/assetlinks.json' || url.pathname === '/android/auth/callback') {
      if (!['GET', 'HEAD'].includes(req.method)) { answer(res, 405, { detail: 'Method not allowed.' });return true; }
      const isJson = url.pathname === '/.well-known/assetlinks.json';
      res.writeHead(200, { ...headers, 'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
      res.end(req.method === 'HEAD' ? '' : isJson ? JSON.stringify(association) : landing);return true;
    }
    if (!url.pathname.startsWith('/auth/native/')) return false;
    if (config.auth !== 'site' || config.publicOrigin !== 'https://cosmo.hhikr.moe') { answer(res, 503, { detail: 'Native authentication unavailable.' });return true; }
    if (limited(req, url.pathname)) { answer(res, 429, { detail: 'Try again later.' });return true; }
    try {
      if (url.pathname === '/auth/native/authorize' && req.method === 'GET') {
        if (url.searchParams.has('request')) {
          const id = url.searchParams.get('request');
          if (!only(url, ['request']) || !VALID43.test(id) || !pending.has(hash(id))) return answer(res, 400, { detail: 'Restart sign-in.' }), true;
          const session = await auth.nativeSession(req);
          if (!session) return answer(res, 401, { detail: 'Restart sign-in.' }), true;
          await issue(res, id, session);return true;
        }
        if (!only(url, ['code_challenge', 'code_challenge_method', 'redirect_uri', 'state']) ||
            url.searchParams.get('redirect_uri') !== CALLBACK || url.searchParams.get('code_challenge_method') !== 'S256' ||
            !VALID43.test(url.searchParams.get('code_challenge') ?? '') || !VALID43.test(url.searchParams.get('state') ?? '')) {
          answer(res, 400, { detail: 'Invalid native request.' });return true;
        }
        if (!capacity()) { answer(res, 503, { detail: 'Try again later.' });return true; }
        const id = random();pending.set(hash(id), { challenge: url.searchParams.get('code_challenge'), state: url.searchParams.get('state'),
          redirect: CALLBACK, client: CLIENT_ID, expires: now() + 600000 });
        const session = await auth.nativeSession(req);
        if (session) await issue(res, id, session);
        else auth.begin(res, `/auth/native/authorize?request=${id}`);
        return true;
      }
      if (url.pathname === '/auth/native/token' && req.method === 'POST') {
        if (!ownWrite(req) || url.search) return answer(res, 403, { detail: 'Request not accepted.' }), true;
        const data = await body(req);
        // Delete synchronously BEFORE await/PKCE checks: one winner even with concurrent requests.
        const entry = typeof data.code === 'string' && codes.get(hash(data.code));
        if (typeof data.code === 'string') codes.delete(hash(data.code));
        if (!entry || entry.expires <= now() || Object.keys(data).some(k => !['code','code_verifier','redirect_uri','client_id'].includes(k)) ||
            data.redirect_uri !== entry.redirect || data.client_id !== entry.client || typeof data.code_verifier !== 'string' ||
            (data.code_verifier.length < 43 || data.code_verifier.length > 128 || /[^A-Za-z0-9._~-]/.test(data.code_verifier)) || !same(hash(data.code_verifier), entry.challenge)) {
          answer(res, 400, { detail: 'Invalid or expired authorization.' });return true;
        }
        const session = await auth.nativeSessionById(entry.sessionId);
        if (!session) return answer(res, 401, { detail: 'Sign-in expired.' }), true;
        if (!capacity()) return answer(res, 503, { detail: 'Try again later.' }), true;
        const token = random(), expires = Math.min(now() + 3600000, session.expires);
        if (expires <= now()) return answer(res, 401, { detail: 'Sign-in expired.' }), true;
        access.set(hash(token), { sessionId: session.id, expires });
        answer(res, 200, { access_token: token, token_type: 'Bearer', expires_at: Math.floor(expires / 1000) });return true;
      }
      if (url.pathname === '/auth/native/authorize' || url.pathname === '/auth/native/token') {
        answer(res, 405, { detail: 'Method not allowed.' }, { Allow: url.pathname.endsWith('/token') ? 'POST' : 'GET' });return true;
      }
      answer(res, 404, { detail: 'Unknown native route.' });return true;
    } catch (error) {
      answer(res, error.status ?? 503, { detail: error.status ? 'Invalid native request.' : 'Authentication service unavailable.' });return true;
    }
  }
  async function apiSession(req, url) {
    gc();
    if (!API.has(`${req.method} ${url.pathname}`) || url.search) return { status: 403 };
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(String(req.headers.authorization ?? ''));
    const entry = match && access.get(hash(match[1]));
    if (!entry || entry.expires <= now()) return { status: 401 };
    try {
      const session = await auth.nativeSessionById(entry.sessionId);
      if (!session || entry.expires <= now()) { access.delete(hash(match[1]));return { status: 401 }; }
      return { session };
    } catch { return { status: 503 }; }
  }
  return { handle, apiSession };
}
