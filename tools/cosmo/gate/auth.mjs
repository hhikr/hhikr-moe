// Who may use Cosmo. Two modes:
//
//   site  The endministrator of the main site, handed over with a one-time
//         code (see src/server/cosmo.ts there). Used on the public domain.
//   none  Everyone who can reach the port. Refused unless the gate listens on
//         the loopback interface under a loopback address: it exists for
//         working on the interface locally through the SSH tunnel.
import crypto from 'node:crypto';

const SESSION_COOKIE = '__Host-cosmo';
const STATE_COOKIE = '__Host-cosmo-state';
const SESSION_LIFETIME = 7 * 86_400_000;
const RECHECK_AFTER = 30_000;
const STATE_LIFETIME = 600;

const token = () => crypto.randomBytes(32).toString('base64url');

function cookies(req) {
  const jar = new Map();
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0) jar.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return jar;
}

const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export function createAuth(config) {
  if (config.auth === 'none') {
    return {
      mode: 'none',
      session: async () => ({ id: 'local', sockets: new Set() }),
      handle: async () => false,
      begin: () => {},
    };
  }

  /** id → { grant, user, expires, checkedAt, sockets } */
  const sessions = new Map();
  const attempts = new Map();

  async function site(action, body) {
    const response = await fetch(`${config.siteInternal}/api/internal/cosmo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.gateSecret}` },
      body: JSON.stringify({ action, ...body }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? response.json() : undefined;
  }

  function end(id) {
    const session = sessions.get(id);
    if (!session) return;
    sessions.delete(id);
    for (const socket of session.sockets) socket.destroy();
  }

  /** The session behind a request, re-checked with the site when the last answer has gone stale. */
  async function session(req) {
    const id = cookies(req).get(SESSION_COOKIE);
    const found = id && sessions.get(id);
    if (!found) return undefined;
    if (found.expires <= Date.now()) return void end(id);
    if (Date.now() - found.checkedAt > (config.recheckAfter ?? RECHECK_AFTER)) {
      // One check at a time per session; requests arriving meanwhile share it.
      found.checking ??= site('check', { grant: found.grant })
        .then((answer) => {
          // No answer (the site is restarting) is not a refusal: keep the last verdict.
          if (answer) {
            found.checkedAt = Date.now();
            if (!answer.valid) end(id);
          }
        })
        .catch(() => {})
        .finally(() => {
          found.checking = undefined;
        });
      await found.checking;
      if (!sessions.has(id)) return undefined;
    }
    return found;
  }

  /** Send a signed-out browser to the site, remembering the state it must bring back. */
  function begin(res, returnTo = '/') {
    for (const [key, entry] of attempts) if (entry.expires <= Date.now()) attempts.delete(key);
    if (attempts.size >= 256) return plain(res, 503, '请稍后重新开始登录。');
    if (returnTo !== '/' && !/^\/auth\/native\/authorize\?request=[A-Za-z0-9_-]{43}$/.test(returnTo)) return plain(res, 400, '无效返回地址。');
    const state = token();
    attempts.set(state, { returnTo, expires: Date.now() + STATE_LIFETIME * 1000 });
    res.writeHead(302, {
      Location: `${config.sitePublic}/api/auth/cosmo?state=${state}`,
      'Set-Cookie': cookie(STATE_COOKIE, state, STATE_LIFETIME),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    });
    res.end();
  }

  const plain = (res, status, text, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers });
    res.end(text);
  };

  /** Answer /auth/* requests. Returns false for anything else. */
  async function handle(req, res, url) {
    if (url.pathname === '/auth/callback' && req.method === 'GET') {
      const jar = cookies(req);
      const state = url.searchParams.get('state') ?? '';
      const expected = jar.get(STATE_COOKIE) ?? '';
      const code = url.searchParams.get('code') ?? '';
      const attempt = attempts.get(state);
      const stateMatches = state.length === 43 && expected.length === 43 && !/[^A-Za-z0-9_-]/.test(state + expected) &&
        crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected)) && attempt && attempt.expires > Date.now() &&
        url.searchParams.getAll('state').length === 1 && url.searchParams.getAll('code').length === 1 &&
        code.length > 0 && code.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(code);
      if (stateMatches) attempts.delete(state);
      if (!stateMatches || !code) return plain(res, 400, '登录请求已失效，请重新打开 Cosmo。', { 'Set-Cookie': cookie(STATE_COOKIE, '', 0) }), true;

      const redeemed = await site('redeem', { code }).catch(() => undefined);
      if (!redeemed?.ok) return plain(res, 403, '没有访问权限。', { 'Set-Cookie': cookie(STATE_COOKIE, '', 0) }), true;

      const id = token();
      sessions.set(id, {
        id,
        grant: redeemed.grant,
        user: redeemed.user,
        expires: Date.now() + SESSION_LIFETIME,
        checkedAt: Date.now(),
        sockets: new Set(),
      });
      // The code is spent and leaves the address bar with this redirect.
      res.writeHead(302, {
        Location: attempt.returnTo,
        'Set-Cookie': [cookie(SESSION_COOKIE, id, SESSION_LIFETIME / 1000), cookie(STATE_COOKIE, '', 0)],
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
      res.end();
      return true;
    }

    if (url.pathname === '/auth/logout' && req.method === 'POST') {
      if (req.headers.origin !== config.publicOrigin) return plain(res, 403, ''), true;
      const id = cookies(req).get(SESSION_COOKIE);
      const found = id && sessions.get(id);
      if (found) {
        await site('revoke', { grant: found.grant }).catch(() => {});
        end(id);
      }
      res.writeHead(204, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0), 'Cache-Control': 'no-store' });
      res.end();
      return true;
    }

    if (url.pathname.startsWith('/auth/')) return plain(res, 404, ''), true;
    return false;
  }

  async function nativeSessionById(id) {
    const found = id && sessions.get(id);
    if (!found || found.expires <= Date.now()) { if (id) end(id);return undefined; }
    // Native requests never use the browser's stale verdict on website outage.
    let answer;
    try { answer = await site('check', { grant: found.grant }); } catch { throw new Error('auth-unavailable'); }
    if (!answer || typeof answer.valid !== 'boolean') throw new Error('auth-unavailable');
    if (!answer.valid) { end(id);return undefined; }
    if (!sessions.has(id)) return undefined;
    found.checkedAt = Date.now();return found;
  }
  const nativeSession = req => nativeSessionById(cookies(req).get(SESSION_COOKIE));

  // Forget sessions that ran out without being used again.
  setInterval(() => {
    for (const [id, found] of sessions) if (found.expires <= Date.now()) end(id);
  }, 600_000).unref();

  return { mode: 'site', session, handle, begin, nativeSession, nativeSessionById };
}
