// The Cosmo gate, run as it runs in production (sign-in through the site),
// between a stand-in for the site and a stand-in for the Hermes backend.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SECRET = 'a-shared-secret-of-at-least-32-characters';
const HERMES_TOKEN = 'the-real-hermes-token';
const PUBLIC = 'https://cosmo.test';

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const body = async (req) => {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text;
};

// ── Stand-in for the Hermes backend ─────────────────────────────────────────
const hermesSeen = [];
const hermes = http.createServer(async (req, res) => {
  hermesSeen.push({ method: req.method, url: req.url, headers: req.headers, body: await body(req) });
  // Its dashboard: any path that is not the API is the page, with the token and the prefix it was told written in.
  if (req.url.startsWith('/assets/')) return res.writeHead(200, { 'Content-Type': 'text/css' }).end('.dashboard{}');
  if (!req.url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><html><head><script>window.__HERMES_SESSION_TOKEN__="${HERMES_TOKEN}";window.__HERMES_BASE_PATH__="${req.headers['x-forwarded-prefix'] ?? ''}";</script></head></html>`);
  }
  if (req.headers['x-hermes-session-token'] !== HERMES_TOKEN) return res.writeHead(401).end('{"detail":"Unauthorized"}');
  res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'backend=1' });
  res.end(JSON.stringify({ ok: true }));
});
hermes.on('upgrade', (req, socket) => {
  hermesSeen.push({ method: 'UPGRADE', url: req.url, headers: req.headers });
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
  socket.on('error', () => {});
});

// ── Stand-in for the site's internal endpoint ───────────────────────────────
const site = { codes: new Map([['good-code', 'grant-1']]), standing: new Set(['grant-1']), calls: [] };
const siteServer = http.createServer(async (req, res) => {
  const authorised = req.headers.authorization === `Bearer ${SECRET}`;
  const payload = JSON.parse((await body(req)) || '{}');
  site.calls.push({ url: req.url, authorised, ...payload });
  if (req.url !== '/api/internal/cosmo' || !authorised) return res.writeHead(404).end();
  const json = (status, value) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
  if (payload.action === 'redeem') {
    const grant = site.codes.get(payload.code);
    site.codes.delete(payload.code);
    return grant ? json(200, { ok: true, grant, user: { id: 1, nickname: 'owner' } }) : json(403, { ok: false });
  }
  if (payload.action === 'check') return json(200, { ok: true, valid: site.standing.has(payload.grant) });
  if (payload.action === 'revoke') return site.standing.delete(payload.grant), json(200, { ok: true });
  return json(400, { ok: false });
});

let gate;
let gatePort;
const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmo-gate-'));

before(async () => {
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>Cosmo</title>');
  fs.mkdirSync(path.join(staticDir, 'assets'));
  fs.writeFileSync(path.join(staticDir, 'assets', 'app-abc123.js'), 'console.log(1)');
  const hermesPort = await listen(hermes);
  const sitePort = await listen(siteServer);
  const probe = http.createServer();
  gatePort = await listen(probe);
  await new Promise((resolve) => probe.close(resolve));

  gate = spawn(process.execPath, [path.join(root, 'tools/cosmo/gate/server.mjs')], {
    env: {
      ...process.env,
      COSMO_LISTEN: `127.0.0.1:${gatePort}`,
      COSMO_PUBLIC_ORIGIN: PUBLIC,
      COSMO_STATIC_DIR: staticDir,
      COSMO_HERMES: `http://127.0.0.1:${hermesPort}`,
      COSMO_AUTH: 'site',
      COSMO_SITE_PUBLIC: 'https://site.test',
      COSMO_SITE_INTERNAL: `http://127.0.0.1:${sitePort}`,
      COSMO_GATE_SECRET: SECRET,
      COSMO_RECHECK_MS: '0',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    gate.stdout.once('data', resolve);
    gate.once('exit', (code) => reject(new Error(`the gate exited with ${code}`)));
  });
});

after(() => {
  gate?.kill();
  hermes.close();
  siteServer.close();
  fs.rmSync(staticDir, { recursive: true, force: true });
});

/** A request as Caddy would pass it on: to the loopback port, under the public host name. */
function ask(target, { method = 'GET', headers = {}, payload } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: gatePort, path: target, method, headers: { host: 'cosmo.test', ...headers } },
      async (res) => resolve({ status: res.statusCode, headers: res.headers, text: await body(res) }),
    );
    req.on('error', reject);
    req.end(payload);
  });
}

function upgrade(target, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: gatePort,
      path: target,
      headers: { host: 'cosmo.test', connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', 'sec-websocket-version': '13', ...headers },
    });
    req.on('upgrade', (res, socket) => resolve({ status: res.statusCode, socket }));
    req.on('response', (res) => resolve({ status: res.statusCode }));
    req.on('error', reject);
    req.end();
  });
}

const cookieValue = (res, name) =>
  [].concat(res.headers['set-cookie'] ?? []).map((line) => line.match(new RegExp(`^${name}=([^;]*)`))?.[1]).find((value) => value !== undefined);

async function signIn() {
  site.codes.set('good-code', 'grant-1');
  site.standing.add('grant-1');
  const start = await ask('/', { headers: { 'sec-fetch-mode': 'navigate' } });
  const state = cookieValue(start, '__Host-cosmo-state');
  const done = await ask(`/auth/callback?code=good-code&state=${state}`, { headers: { cookie: `__Host-cosmo-state=${state}` } });
  return { state, done, cookie: `__Host-cosmo=${cookieValue(done, '__Host-cosmo')}` };
}

test('a signed-out page load is sent to the site, with a state to bring back', async () => {
  const res = await ask('/', { headers: { 'sec-fetch-mode': 'navigate' } });
  assert.equal(res.status, 302);
  const state = cookieValue(res, '__Host-cosmo-state');
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(res.headers.location, `https://site.test/api/auth/cosmo?state=${state}`);
  assert.match(res.headers['set-cookie'][0], /; Path=\/; HttpOnly; Secure; SameSite=Lax/);
});

test('signed out, nothing is served and nothing reaches Hermes', async () => {
  const before = hermesSeen.length;
  const api = await ask('/api/status');
  assert.equal(api.status, 401);
  assert.equal(api.headers['x-cosmo-auth'], 'required');
  assert.equal((await ask('/assets/app-abc123.js', { headers: { 'sec-fetch-mode': 'no-cors' } })).status, 401);
  assert.equal((await upgrade('/api/ws?token=x', { origin: PUBLIC })).status, 401);
  assert.equal(hermesSeen.length, before);
});

test('the callback needs the state this browser was given and a code the site accepts', async () => {
  const start = await ask('/', { headers: { 'sec-fetch-mode': 'navigate' } });
  const state = cookieValue(start, '__Host-cosmo-state');
  const jar = { cookie: `__Host-cosmo-state=${state}` };
  assert.equal((await ask(`/auth/callback?code=good-code&state=${state}`)).status, 400, 'no state cookie');
  assert.equal((await ask(`/auth/callback?code=good-code&state=${'x'.repeat(43)}`, { headers: jar })).status, 400, 'someone else’s state');
  assert.ok(site.codes.has('good-code'), 'a refused callback does not spend the code');
  assert.equal((await ask(`/auth/callback?code=made-up&state=${state}`, { headers: jar })).status, 403);

  const { done } = await signIn();
  assert.equal(done.status, 302);
  assert.equal(done.headers.location, '/');
  assert.match(cookieValue(done, '__Host-cosmo'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(cookieValue(done, '__Host-cosmo-state'), '', 'the state cookie is cleared');
  // The state is spent by the first successful callback, so a replay is refused before the code is tried.
  assert.equal((await ask(`/auth/callback?code=good-code&state=${state}`, { headers: jar })).status, 400, 'the state works once');
});

test('signed in, pages are served with a content security policy and assets are cacheable', async () => {
  const { cookie } = await signIn();
  const page = await ask('/', { headers: { cookie } });
  assert.equal(page.status, 200);
  assert.match(page.text, /<title>Cosmo<\/title>/);
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.doesNotMatch(page.headers['content-security-policy'], /script-src[^;]*https:/, 'scripts load from this origin only');
  assert.equal(page.headers['cache-control'], 'no-store');
  assert.equal(page.headers['x-frame-options'], 'DENY');
  const asset = await ask('/assets/app-abc123.js', { headers: { cookie } });
  assert.match(asset.headers['cache-control'], /immutable/);
  assert.equal((await ask('/..%2f..%2fsecret', { headers: { cookie } })).status, 403);
  assert.equal((await ask('/missing.js', { headers: { cookie } })).status, 404);
  const theirs = await ask('/assets/xterm-def456.css', { headers: { cookie } });
  assert.equal(theirs.text, '.dashboard{}', 'build output that is not ours is the dashboard’s');
  assert.equal(hermesSeen.at(-1).headers['x-forwarded-prefix'], '/admin');
});

test('requests to Hermes carry the backend token and never the browser’s credentials', async () => {
  const { cookie } = await signIn();
  // A page-supplied Authorization header is refused outright (native bearer rules), never forwarded or swapped for the cookie.
  const bearer = await ask('/api/files/download?path=%2Fa&token=cosmo', { headers: { cookie, authorization: 'Bearer from-the-page' } });
  assert.equal(bearer.status, 403);
  const res = await ask('/api/files/download?path=%2Fa&token=cosmo', {
    headers: { cookie, 'x-hermes-session-token': 'from-the-page', 'x-forwarded-for': '203.0.113.9' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers['set-cookie'], undefined, 'the backend cannot set cookies on this origin');
  const seen = hermesSeen.at(-1);
  assert.equal(seen.url, `/api/files/download?path=%2Fa&token=${HERMES_TOKEN}`);
  assert.equal(seen.headers['x-hermes-session-token'], HERMES_TOKEN);
  for (const name of ['cookie', 'authorization', 'x-forwarded-for']) assert.equal(seen.headers[name], undefined, name);
  assert.match(seen.headers.host, /^127\.0\.0\.1:\d+$/);
});

test('writes are accepted from Cosmo’s own pages only', async () => {
  const { cookie } = await signIn();
  const json = { 'content-type': 'application/json' };
  const foreign = await ask('/api/config', { method: 'PUT', headers: { cookie, origin: 'https://evil.test', ...json }, payload: '{}' });
  assert.equal(foreign.status, 403);
  const crossSite = await ask('/api/config', { method: 'PUT', headers: { cookie, 'sec-fetch-site': 'cross-site', ...json }, payload: '{}' });
  assert.equal(crossSite.status, 403);
  const own = await ask('/api/config', { method: 'PUT', headers: { cookie, origin: PUBLIC, ...json }, payload: '{"a":1}' });
  assert.equal(own.status, 200);
  assert.equal(hermesSeen.at(-1).body, '{"a":1}');
  assert.match(hermesSeen.at(-1).headers.origin, /^http:\/\/127\.0\.0\.1:\d+$/, 'the backend sees its own origin');
});

test('sockets open for Cosmo’s own pages and close when the site withdraws the grant', async () => {
  const { cookie } = await signIn();
  assert.equal((await upgrade('/api/ws?token=cosmo', { cookie })).status, 403, 'no Origin');
  assert.equal((await upgrade('/api/ws?token=cosmo', { cookie, origin: 'https://evil.test' })).status, 403);
  assert.equal((await upgrade('/elsewhere', { cookie, origin: PUBLIC })).status, 404);

  const open = await upgrade('/api/ws?token=cosmo', { cookie, origin: PUBLIC });
  assert.equal(open.status, 101);
  assert.equal(hermesSeen.at(-1).url, `/api/ws?token=${HERMES_TOKEN}`);
  assert.equal(hermesSeen.at(-1).headers.cookie, undefined);
  const closed = new Promise((resolve) => open.socket.once('close', resolve));
  open.socket.on('error', () => {});

  site.standing.delete('grant-1');
  assert.equal((await ask('/api/status', { headers: { cookie } })).status, 401, 'the next request finds the grant gone');
  await closed;
  assert.equal((await ask('/', { headers: { cookie, 'sec-fetch-mode': 'navigate' } })).status, 302, 'and the session with it');
});

test('the dashboard is served under /admin/ to a signed-in browser, without the backend token', async () => {
  const before = hermesSeen.length;
  assert.equal((await ask('/admin/sessions', { headers: { 'sec-fetch-mode': 'navigate' } })).status, 302);
  assert.equal((await ask('/admin/assets/app.js', { headers: { 'sec-fetch-mode': 'no-cors' } })).status, 401);
  assert.equal((await ask('/admin/api/status')).status, 401);
  assert.equal((await upgrade('/admin/api/pty?token=cosmo', { origin: PUBLIC })).status, 401);
  assert.equal(hermesSeen.length, before, 'signed out, nothing reaches Hermes');

  const { cookie } = await signIn();
  const bare = await ask('/admin?profile=a', { headers: { cookie } });
  assert.equal(bare.status, 308);
  assert.equal(bare.headers.location, '/admin/?profile=a');

  const page = await ask('/admin/sessions?profile=a', { headers: { cookie, 'accept-encoding': 'gzip', 'x-forwarded-prefix': '/elsewhere' } });
  assert.equal(page.status, 200);
  assert.doesNotMatch(page.text, new RegExp(HERMES_TOKEN));
  assert.match(page.text, /__HERMES_SESSION_TOKEN__="cosmo"/);
  assert.match(page.text, /__HERMES_BASE_PATH__="\/admin"/);
  assert.match(page.text, /<head><script>[^<]*'hermes-locale','zh'/, 'Chinese unless a language was chosen');
  assert.equal(page.headers['cache-control'], 'no-store');
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(page.headers['x-frame-options'], 'DENY');
  assert.equal(hermesSeen.at(-1).url, '/sessions?profile=a');
  assert.equal(hermesSeen.at(-1).headers['accept-encoding'], undefined, 'pages are asked for uncompressed');
  assert.equal(hermesSeen.at(-1).headers.cookie, undefined);

  await ask('/api/status', { headers: { cookie, 'x-forwarded-prefix': '/elsewhere' } });
  assert.equal(hermesSeen.at(-1).headers['x-forwarded-prefix'], undefined, 'a browser cannot name a prefix');

  const api = await ask('/admin/api/status?token=cosmo', { headers: { cookie } });
  assert.equal(api.status, 200);
  assert.equal(hermesSeen.at(-1).url, `/api/status?token=${HERMES_TOKEN}`);
  assert.equal(hermesSeen.at(-1).headers['x-hermes-session-token'], HERMES_TOKEN);

  const json = { 'content-type': 'application/json' };
  assert.equal((await ask('/admin/api/config', { method: 'PUT', headers: { cookie, origin: 'https://evil.test', ...json }, payload: '{}' })).status, 403);
  assert.equal((await ask('/admin/auth/logout', { method: 'POST', headers: { cookie, origin: 'https://evil.test' } })).status, 403);

  const open = await upgrade('/admin/api/pty?token=cosmo', { cookie, origin: PUBLIC });
  assert.equal(open.status, 101);
  assert.equal(hermesSeen.at(-1).url, `/api/pty?token=${HERMES_TOKEN}`);
  open.socket.on('error', () => {});
  open.socket.destroy();
});

test('signing out revokes the grant at the site', async () => {
  const { cookie } = await signIn();
  assert.equal((await ask('/auth/logout', { method: 'POST', headers: { cookie, origin: 'https://evil.test' } })).status, 403);
  const out = await ask('/auth/logout', { method: 'POST', headers: { cookie, origin: PUBLIC } });
  assert.equal(out.status, 204);
  assert.equal(site.standing.has('grant-1'), false);
  assert.equal((await ask('/api/status', { headers: { cookie } })).status, 401);
});

test('requests under any other host name are refused', async () => {
  const { cookie } = await signIn();
  assert.equal((await ask('/', { headers: { cookie, host: 'evil.test' } })).status, 421);
  assert.equal((await upgrade('/api/ws', { cookie, origin: PUBLIC, host: 'evil.test' })).status, 421);
});

test('the site is only ever called with the shared secret', () => {
  assert.ok(site.calls.length > 0);
  assert.ok(site.calls.every((call) => call.authorised && call.url === '/api/internal/cosmo'));
});
