// The Cosmo gate: the only door between a browser and the Hermes backend.
//
// It serves the web build of the Hermes Desktop renderer and forwards /api/*
// (HTTP and WebSocket) to a Hermes backend listening on the loopback
// interface. The backend's session token is fetched and attached here, after
// the caller's session has been checked; it is never sent to a browser.
//
// Configuration (environment):
//   COSMO_LISTEN         host:port to listen on            (127.0.0.1:4410)
//   COSMO_PUBLIC_ORIGIN  origin browsers use               (https://cosmo.hhikr.moe)
//   COSMO_STATIC_DIR     the built renderer                (./dist next to this folder)
//   COSMO_HERMES         backend origin                    (http://127.0.0.1:9119)
//   COSMO_AUTH           site | none                       (site)
//   COSMO_SITE_PUBLIC    main site, as browsers see it     (https://hhikr.moe)
//   COSMO_SITE_INTERNAL  main site, from this machine      (http://127.0.0.1:4400)
//   COSMO_GATE_SECRET    shared with the main site (site mode; at least 32 characters)
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth } from './auth.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const [listenHost, listenPort] = (env.COSMO_LISTEN ?? '127.0.0.1:4410').split(':');

const config = {
  host: listenHost,
  port: Number(listenPort),
  publicOrigin: (env.COSMO_PUBLIC_ORIGIN ?? `http://${listenHost}:${listenPort}`).replace(/\/+$/, ''),
  staticDir: path.resolve(env.COSMO_STATIC_DIR ?? path.join(here, '..', 'dist')),
  hermes: new URL(env.COSMO_HERMES ?? 'http://127.0.0.1:9119'),
  auth: env.COSMO_AUTH ?? 'site',
  sitePublic: (env.COSMO_SITE_PUBLIC ?? 'https://hhikr.moe').replace(/\/+$/, ''),
  siteInternal: (env.COSMO_SITE_INTERNAL ?? 'http://127.0.0.1:4400').replace(/\/+$/, ''),
  gateSecret: env.COSMO_GATE_SECRET ?? '',
  // How long an answer from the site about a session is trusted (milliseconds).
  recheckAfter: env.COSMO_RECHECK_MS ? Number(env.COSMO_RECHECK_MS) : undefined,
};

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
const publicHost = new URL(config.publicOrigin).host;

if (!LOOPBACK.has(config.host)) throw new Error('COSMO_LISTEN must be a loopback address; put a reverse proxy in front of it.');
if (!LOOPBACK.has(config.hermes.hostname)) throw new Error('COSMO_HERMES must be a loopback address.');
if (config.auth === 'none' && !LOOPBACK.has(new URL(config.publicOrigin).hostname)) {
  throw new Error('COSMO_AUTH=none is only for a loopback COSMO_PUBLIC_ORIGIN.');
}
if (config.auth === 'site' && config.gateSecret.length < 32) throw new Error('COSMO_GATE_SECRET must be set (at least 32 characters).');
if (config.auth !== 'site' && config.auth !== 'none') throw new Error('COSMO_AUTH must be "site" or "none".');

const auth = createAuth(config);

// ── The backend's session token ─────────────────────────────────────────────
// Hermes mints a token per process start and writes it into the page it serves
// on its own loopback port. Read it from there; read it again when the backend
// stops accepting it (it restarted).
let hermesToken;

async function readHermesToken() {
  const response = await fetch(new URL('/', config.hermes), { signal: AbortSignal.timeout(5000) });
  const found = (await response.text()).match(/__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/);
  if (!found) throw new Error('the Hermes backend did not present a session token');
  return found[1];
}

const currentToken = () => (hermesToken ??= readHermesToken().catch((error) => {
  hermesToken = undefined;
  throw error;
}));

// ── Responses of our own ────────────────────────────────────────────────────
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
};

// What the policy can and cannot do here. The renderer shows agent-made HTML
// (artifacts, inline previews) in sandboxed `srcdoc` frames, and a frame like
// that inherits this policy, so inline scripts have to be allowed or those
// features go blank. Upstream ships no policy at all and relies on sanitising
// what it renders and on the sandbox. What remains enforced: scripts load only
// from this origin, nothing may frame the page, plugins and <base> are out.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Voice providers and the plugin catalog are called straight from the page.
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  'frame-src https: http: blob: data:',
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, body = '', headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

const sendJson = (res, status, body, headers = {}) =>
  send(res, status, JSON.stringify(body), { 'Content-Type': 'application/json; charset=utf-8', ...headers });

async function serveStatic(req, res, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  } catch {
    return send(res, 400);
  }
  const file = path.resolve(config.staticDir, relative);
  if (file !== config.staticDir && !file.startsWith(config.staticDir + path.sep)) return send(res, 403);

  let stat;
  try {
    stat = await fs.promises.stat(file);
  } catch {
    return send(res, 404);
  }
  if (!stat.isFile()) return send(res, 404);

  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const page = type.startsWith('text/html');
  // Build output under assets/ is named by its content; everything else is checked again each time.
  const immutable = relative.startsWith('assets/');
  const etag = `"${stat.size.toString(36)}-${Math.round(stat.mtimeMs).toString(36)}"`;
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': type,
    'Cache-Control': page ? 'no-store' : immutable ? 'private, max-age=31536000, immutable' : 'private, no-cache',
    ETag: etag,
    ...(page ? { 'Content-Security-Policy': CONTENT_SECURITY_POLICY } : {}),
  };
  if (!page && req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

// ── Forwarding to Hermes ────────────────────────────────────────────────────
// Headers that describe this hop, or that would carry the browser's Cosmo
// session to the backend, stay behind.
const NOT_FORWARDED = new Set([
  'host', 'origin', 'referer', 'cookie', 'authorization', 'connection', 'keep-alive', 'proxy-authorization',
  'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'x-hermes-session-token',
  'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'forwarded',
]);

function upstreamHeaders(req, token) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (!NOT_FORWARDED.has(name) && !name.startsWith('sec-fetch-')) headers[name] = value;
  }
  headers.host = config.hermes.host;
  // The backend accepts requests from its own origin only.
  if (req.headers.origin) headers.origin = config.hermes.origin;
  headers['x-hermes-session-token'] = token;
  return headers;
}

/** The request target for the backend: any `token` the page sent is replaced with the real one. */
function upstreamTarget(url, token) {
  if (url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.pathname + url.search;
}

function forward(req, res, url, token, attempt = 0) {
  const upstream = http.request(
    {
      hostname: config.hermes.hostname,
      port: config.hermes.port,
      method: req.method,
      path: upstreamTarget(url, token),
      headers: upstreamHeaders(req, token),
    },
    async (reply) => {
      // The token is no longer accepted: the backend restarted. Fetch the new
      // one, and repeat the request when doing so cannot repeat a side effect.
      if (reply.statusCode === 401) {
        hermesToken = undefined;
        if (attempt === 0 && (req.method === 'GET' || req.method === 'HEAD')) {
          reply.resume();
          try {
            return forward(req, res, url, await currentToken(), 1);
          } catch {
            return sendJson(res, 502, { detail: 'Hermes is not reachable.' });
          }
        }
      }
      const headers = { ...reply.headers };
      delete headers['set-cookie'];
      delete headers.connection;
      delete headers['keep-alive'];
      res.writeHead(reply.statusCode ?? 502, { ...headers, 'X-Content-Type-Options': 'nosniff' });
      reply.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) sendJson(res, 502, { detail: 'Hermes is not reachable.' });
    else res.destroy();
  });
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
}

/** True when a request that changes something was made by this site's own page. */
function fromOwnPage(req) {
  const origin = req.headers.origin;
  if (origin) return origin === config.publicOrigin;
  // Browsers always send Origin on cross-site writes; its absence means a same-origin GET-like navigation or a non-browser client.
  return req.headers['sec-fetch-site'] === undefined || req.headers['sec-fetch-site'] === 'same-origin';
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== publicHost) return send(res, 421);
    const url = new URL(req.url, config.publicOrigin);
    const reading = req.method === 'GET' || req.method === 'HEAD';

    if (await auth.handle(req, res, url)) return;

    const session = await auth.session(req);

    if (url.pathname.startsWith('/api/')) {
      if (!session) return sendJson(res, 401, { detail: 'Sign in to Cosmo first.' }, { 'X-Cosmo-Auth': 'required' });
      if (!reading && !fromOwnPage(req)) return sendJson(res, 403, { detail: 'Request origin not accepted.' });
      let token;
      try {
        token = await currentToken();
      } catch {
        return sendJson(res, 502, { detail: 'Hermes is not reachable.' });
      }
      return forward(req, res, url, token);
    }

    if (!reading) return send(res, 405);
    if (!session) {
      // Only a page load starts a sign-in; a script or image request is just refused.
      const navigating = (req.headers['sec-fetch-mode'] ?? 'navigate') === 'navigate';
      return navigating ? auth.begin(res) : send(res, 401);
    }
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) send(res, 500);
    else res.destroy();
  }
});

// WebSockets: the JSON-RPC gateway and its siblings (voice, plugin sockets, displays).
server.on('upgrade', async (req, socket, head) => {
  const refuse = (status) => socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  try {
    if (req.headers.host !== publicHost) return refuse('421 Misdirected Request');
    const url = new URL(req.url, config.publicOrigin);
    if (!url.pathname.startsWith('/api/')) return refuse('404 Not Found');
    // A page on another site can open a socket here with the visitor's cookie; only ours may.
    if (req.headers.origin !== config.publicOrigin) return refuse('403 Forbidden');
    const session = await auth.session(req);
    if (!session) return refuse('401 Unauthorized');

    const token = await currentToken();
    const upstream = net.connect(Number(config.hermes.port), config.hermes.hostname, () => {
      const headers = upstreamHeaders(req, token);
      headers.connection = 'Upgrade';
      headers.upgrade = 'websocket';
      delete headers['x-hermes-session-token'];
      let request = `GET ${upstreamTarget(url, token)} HTTP/1.1\r\n`;
      for (const [name, value] of Object.entries(headers)) {
        for (const single of [].concat(value)) request += `${name}: ${single}\r\n`;
      }
      upstream.write(`${request}\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    // Ending the session closes its sockets with it.
    session.sockets.add(socket);
    const close = () => {
      session.sockets.delete(socket);
      upstream.destroy();
      socket.destroy();
    };
    upstream.on('error', close);
    upstream.on('close', close);
    socket.on('error', close);
    socket.on('close', close);
  } catch {
    refuse('502 Bad Gateway');
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Cosmo gate on ${config.host}:${config.port} for ${config.publicOrigin} (auth: ${auth.mode})`);
});
