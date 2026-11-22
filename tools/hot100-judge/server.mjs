// Hot 100 online judge. Runs readers' Java against a lesson's sample, their own inputs, or the
// hidden cases, one program at a time.
//
//   GET  /api/hot100/health
//   POST /api/hot100/run     {id, code, inputs?}   sample, or up to 3 inputs of the reader's own
//   POST /api/hot100/submit  {id, code}            every hidden case
//
// Environment: HOT100_PORT (4310), HOT100_HOST (127.0.0.1), HOT100_ORIGINS (comma list allowed to
// POST; default the local dev origins), HOT100_SANDBOX (bwrap | none), HOT100_WORK (scratch folder),
// HOT100_TRUST_PROXY=1 to take the client address from X-Forwarded-For (set behind Caddy).

import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { lessons } from '../../public/hot100-assets/lessons.mjs';
import { allCases, check } from './cases.mjs';
import { Compiler, javaBinary, runProgram, workFolder } from './java.mjs';

export const LIMITS = { body: 64 * 1024, code: 32000, inputs: 3, queue: 8, runPerMinute: 20, submitPerMinute: 6 };

/** Sliding one-minute window per client and action. */
export class RateLimit {
  constructor(now = () => Date.now()) { this.now = now; this.hits = new Map(); }
  allow(key, perMinute) {
    const t = this.now(), list = (this.hits.get(key) || []).filter((x) => t - x < 60000);
    if (list.length >= perMinute) { this.hits.set(key, list); return Math.ceil((60000 - (t - list[0])) / 1000); }
    list.push(t); this.hits.set(key, list);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((x) => t - x < 60000)) this.hits.delete(k);
    return 0;
  }
}

/** One job at a time; a short queue behind it. */
export class Queue {
  constructor(max) { this.max = max; this.waiting = 0; this.tail = Promise.resolve(); }
  push(task) {
    if (this.waiting >= this.max) return null;
    this.waiting++;
    const run = this.tail.then(task).finally(() => { this.waiting--; });
    this.tail = run.catch(() => {});
    return run;
  }
}

const preview = (text, n = 400) => (text.length > n ? `${text.slice(0, n)}…` : text);

/** Turn one program run into per-case verdicts. */
export function verdicts(id, run, cases) {
  let blamed = false;
  return cases.map((testCase, i) => {
    const r = run.results.get(i), base = { input: testCase.input, expected: testCase.expected };
    if (!r) {
      if (blamed) return { ...base, status: 'skipped' };
      blamed = true;
      if (run.reason === 'timeout') return { ...base, status: 'timeout', message: '运行超时：这组输入没有在时间限制内完成，可能出现了死循环。' };
      if (run.reason === 'output') return { ...base, status: 'error', message: '输出过多，程序已被终止。' };
      return { ...base, status: 'error', message: `程序提前退出${run.code == null ? '' : `（退出码 ${run.code}）`}。${preview([run.extra, run.stderr].filter(Boolean).join('\n'))}`.trim() };
    }
    const ms = Math.round(r.micros / 100) / 10, printed = r.printed ? preview(r.printed, 2000) : undefined;
    if (r.status === 'error') return { ...base, status: 'error', message: r.value, printed, ms };
    const verdict = check(id, r.value, testCase);
    if (verdict.kind === 'format') return { ...base, status: 'error', actual: r.value, message: '结果无法转换成可比较的值。', printed, ms };
    return { ...base, status: verdict.kind === 'passed' ? 'passed' : 'wrong', actual: JSON.parse(r.value), printed, ms };
  });
}

/** Expected answer for a reader's own input, from the lesson's trace (which also validates it). */
export function customCase(lesson, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('输入格式无效。');
  for (const key of Object.keys(lesson.sample)) if (!(key in input)) throw new Error(`输入缺少 ${key}。`);
  const frames = lesson.trace(JSON.stringify(input));
  return { input, expected: frames.at(-1).answer };
}

export function createJudge({ runner, origins, trustProxy = false, limits = LIMITS, now } = {}) {
  const rate = new RateLimit(now), queue = new Queue(limits.queue);
  const cases = allCases();

  const json = (res, status, data, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(JSON.stringify(data));
  };
  const client = (req) => {
    const forwarded = trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.socket.remoteAddress || '?';
  };
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > limits.body) throw Object.assign(new Error('请求太大：代码不能超过 32 KB。'), { status: 413 }); chunks.push(c); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('请求格式无效。'), { status: 400 }); }
  }

  async function handle(req, res) {
    const path = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
    if (req.method === 'GET' && path === '/api/hot100/health') return json(res, 200, { ok: true, lessons: cases.size, waiting: queue.waiting });
    const action = { '/api/hot100/run': 'run', '/api/hot100/submit': 'submit' }[path];
    if (!action) return json(res, 404, { error: '没有这个接口。' });
    if (req.method !== 'POST') return json(res, 405, { error: '只接受 POST。' }, { Allow: 'POST' });
    if (!origins.has(String(req.headers.origin || ''))) return json(res, 403, { error: '请从 hhikr.moe 的题目页面提交。' });
    if (!/^application\/json\b/.test(String(req.headers['content-type'] || ''))) return json(res, 415, { error: '请求格式无效。' });
    const data = await body(req);
    const lesson = lessons[Number(data.id)];
    if (!lesson) return json(res, 400, { error: '没有这道题。' });
    if (typeof data.code !== 'string' || !data.code.trim()) return json(res, 400, { error: '请先写代码。' });
    if (data.code.length > limits.code) return json(res, 413, { error: '代码不能超过 32000 个字符。' });

    let list;
    if (action === 'submit') list = cases.get(lesson.id);
    else if (Array.isArray(data.inputs) && data.inputs.length) {
      if (data.inputs.length > limits.inputs) return json(res, 400, { error: `一次最多运行 ${limits.inputs} 组输入。` });
      try { list = data.inputs.map((input) => customCase(lesson, input)); } catch (e) { return json(res, 400, { error: `输入不符合本题要求：${e.message}` }); }
    } else list = cases.get(lesson.id).slice(0, 1);

    const wait = rate.allow(`${client(req)}:${action}`, action === 'submit' ? limits.submitPerMinute : limits.runPerMinute);
    if (wait) return json(res, 429, { error: `操作太频繁，请 ${wait} 秒后再试。` }, { 'Retry-After': String(wait) });

    const job = queue.push(() => runner({ lesson, code: data.code, inputs: list.map((c) => c.input), timeout: action === 'submit' ? 6000 : 4000 }));
    if (!job) return json(res, 503, { error: '判题机正忙，请稍后再试。' }, { 'Retry-After': '5' });
    const started = Date.now(), run = await job;
    if (run.kind === 'compile') return json(res, 200, { kind: 'compile', diagnostics: run.diagnostics });
    const results = verdicts(lesson.id, run, list), passed = results.filter((r) => r.status === 'passed').length;
    const summary = { kind: action, total: list.length, passed, ms: Date.now() - started };
    if (action === 'run') return json(res, 200, { ...summary, cases: results });
    // Submit: statuses of all cases, details only for the first one that failed.
    const first = results.findIndex((r) => r.status !== 'passed');
    return json(res, 200, { ...summary, statuses: results.map((r) => r.status), failed: first < 0 ? undefined : { index: first, ...results[first] }, slowest: Math.max(0, ...results.map((r) => r.ms || 0)) });
  }

  return (req, res) => handle(req, res).catch((e) => {
    if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : '判题服务出错，请稍后再试。' });
    if (!e.status) console.error(e);
  });
}

async function main() {
  const env = process.env, work = await workFolder(env), java = javaBinary(env);
  const compiler = new Compiler({ java, work });
  await compiler.start();
  const sandbox = env.HOT100_SANDBOX || 'none', sandboxJava = env.HOT100_SANDBOX_JAVA || '/usr/bin/java';
  const origins = new Set((env.HOT100_ORIGINS || 'http://localhost:4321,http://127.0.0.1:4321').split(',').map((s) => s.trim()).filter(Boolean));
  const handler = createJudge({
    origins, trustProxy: env.HOT100_TRUST_PROXY === '1',
    runner: (job) => runProgram({ compiler, sandbox, java: sandbox === 'bwrap' ? sandboxJava : java, ...job }),
  });
  const port = Number(env.HOT100_PORT || 4310), host = env.HOT100_HOST || '127.0.0.1';
  const server = http.createServer(handler);
  server.requestTimeout = 30000;
  server.listen(port, host, () => console.log(`hot100 judge on http://${host}:${port} (sandbox: ${sandbox}, work: ${work})`));
  const stop = () => { compiler.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch((e) => { console.error(e); process.exit(1); });
