import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const base = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(await fs.readFile(path.join(base, 'connection-private.json'), 'utf8'));
const roots = await Promise.all(cfg.projectRoots.map(p => fs.realpath(p)));
const pending = new Map();
const routes = new Map();
const children = [];
const allowedFiles = new Set(['read_file', 'read_multiple_files', 'write_file', 'edit_block',
  'list_directory', 'create_directory', 'move_file', 'get_file_info', 'start_search',
  'get_more_search_results', 'stop_search', 'list_searches']);
const allowedProcess = new Set(['start_process', 'read_process_output', 'interact_with_process',
  'force_terminate', 'list_sessions', 'list_processes']);
const textResult = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] });
const sameSecret = (a, b) => {
  if (typeof a !== 'string') return false;
  const actual = Buffer.from(a), expected = Buffer.from(b);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};
const below = (p, root) => { const rel = path.relative(root, p); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

function mapPath(input) {
  if (typeof input !== 'string') return input;
  for (const mapping of cfg.pathMappings || []) {
    if (input === mapping.remote || input.startsWith(mapping.remote + '/')) {
      const suffix = input.slice(mapping.remote.length).replaceAll('/', path.sep);
      return path.resolve(mapping.local + suffix);
    }
  }
  return input;
}

function mapArguments(args) {
  const actual = { ...args };
  for (const key of ['path', 'source', 'destination', 'cwd']) {
    if (actual[key]) actual[key] = mapPath(actual[key]);
  }
  for (const key of ['paths', 'files']) {
    if (Array.isArray(actual[key])) actual[key] = actual[key].map(mapPath);
  }
  return actual;
}

async function checkPath(input, write = false) {
  input = mapPath(input);
  if (typeof input !== 'string' || !path.isAbsolute(input)) throw new Error('文件路径必须是 Windows 绝对路径。');
  let probe = path.resolve(input), suffix = [];
  while (true) {
    try { probe = path.join(await fs.realpath(probe), ...suffix.reverse()); break; }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      const parent = path.dirname(probe);
      if (parent === probe) throw e;
      suffix.push(path.basename(probe)); probe = parent;
    }
  }
  if (!roots.some(root => below(probe, root))) throw new Error('此路径不在已配置的项目内。请由用户在本机扩展项目列表。');
  const parts = probe.split(/[\\/]/).map(s => s.toLowerCase());
  const sensitive = ['.deployment', '.ssh', '.aws', '.codex', '.claude'];
  if (parts.some(s => sensitive.includes(s))) throw new Error('此目录包含连接或账户配置，不向开发工具开放。');
  if (write && parts.includes('.git')) throw new Error('Git 内部文件禁止直接写入，请通过待审批的 Git 命令处理。');
  return probe;
}

async function validate(route, args) {
  if (route.kind === 'desktop') {
    const write = ['write_file', 'edit_block', 'create_directory', 'move_file'].includes(route.name);
    for (const key of ['path', 'source', 'destination']) if (args[key]) args[key] = await checkPath(args[key], write);
    if (args.paths) for (const p of args.paths) await checkPath(p, false);
    if (args.cwd) {
      const cwd = await checkPath(args.cwd, false);
      if (!(await fs.stat(cwd)).isDirectory()) throw new Error('工作目录必须是已授权的项目目录。');
    }
    if (args.isUrl) throw new Error('网页内容请通过浏览器工具读取。');
  } else {
    for (const p of args.paths || args.files || []) await checkPath(p, false);
    if (args.url) {
      const url = new URL(args.url);
      if (!['http:', 'https:', 'about:'].includes(url.protocol)) throw new Error('浏览器只接受网页地址。');
      if (['127.0.0.1', 'localhost'].includes(url.hostname) &&
        [String(cfg.port), String(cfg.approvalPort), '9119', '1455'].includes(url.port)) {
        throw new Error('连接管理、审批和登录页面不向自动浏览器开放。');
      }
    }
    if (args.filename && path.basename(args.filename) !== args.filename) throw new Error('浏览器输出文件只能使用文件名，不能指定其他目录。');
  }
}

function needsApproval(route, args) {
  if (route.kind === 'desktop') {
    if (['write_file', 'edit_block', 'create_directory', 'move_file'].includes(route.name)) {
      const targets = ['path', 'source', 'destination'].filter(key => args[key]).map(key => mapPath(args[key]));
      if (targets.some(target => ['AGENTS.md', 'SOUL.md'].includes(path.basename(target)) ||
          (cfg.protectedWritePaths || []).some(root => below(target, root)))) return true;
    }
    if (route.name === 'start_process') {
      // Permit authorized project workflows; other shell code needs approval.
      const command = String(args.command || '').trim();
      if (/^python (?:--version|run_windows_tests\.py|android[\\/](?:test_release|build)\.py|backend-auth-work[\\/]verify_artifacts\.py)$/.test(command)) return false;
      if (/^node --test backend-auth-work[\\/]tests[\\/]test_gate_native\.mjs backend-auth-work[\\/]tests[\\/]test_gate_real_guard\.mjs$/.test(command)) return false;
      return !/^(?:git (?:status(?: --short)?|diff(?: --stat)?|log -[1-9][0-9]? --oneline)|(?:node|npm|git) --version|npm (?:test|run (?:build|test|check|lint|typecheck|dev)))$/.test(command);
    }
    return ['interact_with_process', 'force_terminate', 'move_file'].includes(route.name);
  }
  return !['browser_navigate', 'browser_snapshot', 'browser_take_screenshot', 'browser_console_messages',
    'browser_network_requests', 'browser_close', 'browser_resize', 'browser_wait_for'].includes(route.name);
}

async function execute(route, args) {
  await validate(route, args);
  let actual = mapArguments(args);
  if (route.name === 'start_process') {
    const cwd = (actual.cwd || roots[0]).replaceAll("'", "''");
    actual.command = `Set-Location -LiteralPath '${cwd}'; ${args.command}`;
    actual.shell = 'powershell.exe';
    delete actual.cwd;
  }
  route.lastUsed = Date.now();
  return await route.client.callTool({ name: route.name, arguments: actual }, undefined, { timeout: 120000 });
}

async function connect(kind, file, args) {
  const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA',
    'LOCALAPPDATA', 'TEMP', 'TMP', 'PATHEXT', 'COMSPEC'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  Object.assign(env, cfg.developmentEnvironment || {});
  const inheritedPath = env.PATH || env.Path || '';
  delete env.Path;
  env.PATH = [...(cfg.developmentBinPaths || []), inheritedPath].join(path.delimiter);
  env.DESKTOP_COMMANDER_DISABLE_TELEMETRY = '1';
  env.HERMES_WINDOWS_CONFIG_DIR = path.join(base, 'state');
  env.HERMES_WINDOWS_EXCLUDE_DIRS = '.deployment,.ssh,.aws,.codex,.claude,.git,signing,codex-home';
  env.PLAYWRIGHT_BROWSERS_PATH = path.join(base, 'browsers');
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [file, ...args], cwd: roots[0], env, stderr: 'pipe' });
  const client = new Client({ name: 'hermes-windows-bridge', version: '1.0.0' });
  transport.stderr?.on('data', () => {});
  await client.connect(transport);
  children.push(client);
  const listing = await client.listTools();
  for (const tool of listing.tools) {
    if (kind === 'desktop' && !allowedFiles.has(tool.name) && !allowedProcess.has(tool.name)) continue;
    if (kind === 'browser' && ['browser_install', 'browser_tabs'].includes(tool.name)) continue;
    const name = `${kind === 'desktop' ? 'windows' : 'web'}_${tool.name}`;
    if (kind === 'desktop' && tool.name === 'start_process') {
      tool.inputSchema = { ...tool.inputSchema, properties: { ...tool.inputSchema.properties,
        cwd: { type: 'string', description: 'Windows 项目工作目录，可使用已映射的 VPS 项目路径。默认使用网站项目。' } } };
    }
    routes.set(name, { kind, name: tool.name, client, lastUsed: Date.now(), tool: {
      ...tool, name,
      description: `${kind === 'desktop' ? '在用户 Windows 电脑上操作。文件路径支持 /opt/hermes-hhikr 到本机开发副本的映射；进程命令使用 PowerShell，可传 cwd。' : '操作 Windows 上专用的测试浏览器。'}${tool.description || ''}${needsApproval({ kind, name: tool.name }, {}) ? ' 此操作可能进入本机审批，收到 approval_id 后应告知用户，并在用户确认后查询 approval_status。' : ''}`,
    } });
  }
}

await connect('desktop', path.join(base, 'node_modules/@wonderwhy-er/desktop-commander/dist/index.js'), ['--no-onboarding']);
await connect('browser', path.join(base, 'node_modules/@playwright/mcp/cli.js'),
  ['--browser', 'msedge', '--headless', '--isolated', '--no-webmcp', '--output-dir', path.join(base, 'browser-output')]);

function makeServer() {
  const server = new Server({ name: 'hermes-windows-connection', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
    { name: 'connection_status', description: '查看 Windows 连接、项目路径和待审批数量。', inputSchema: { type: 'object', properties: {} } },
    { name: 'approval_status', description: '查询本机审批及执行结果。pending 不代表许可，没有回答时必须继续等待。',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    ...[...routes.values()].map(r => r.tool),
  ] }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args = {} } = request.params;
    try {
      if (name === 'connection_status') return textResult({ online: true, projects: roots, pathMappings: cfg.pathMappings || [],
        pending: [...pending.values()].filter(p => p.status === 'pending').length });
      if (name === 'approval_status') {
        const item = pending.get(args.id);
        if (!item) throw new Error('审批记录不存在，连接停止后旧审批不会执行。');
        if (item.result) { const result = item.result; pending.delete(args.id); return result; }
        return textResult({ approval_id: args.id, status: item.status });
      }
      const route = routes.get(name);
      if (!route) throw new Error('工具不存在。');
      await validate(route, args);
      if (needsApproval(route, args)) {
        if ([...pending.values()].filter(item => item.status === 'pending').length >= 64) {
          throw new Error('已有较多待审批操作，请先处理本机审批页面中的请求。');
        }
        const id = crypto.randomUUID();
        pending.set(id, { id, tool: name, args, route, status: 'pending', createdAt: new Date().toISOString() });
        return textResult({ approval_id: id, status: 'pending',
          message: '请用户在 Windows 的 Hermes 操作审批页面确认；没有超时，不得视为已批准。确认后调用 approval_status 获取结果。' });
      }
      return await execute(route, args);
    } catch (e) { return { ...textResult(e.message), isError: true }; }
  });
  return server;
}

async function body(req) {
  const parts = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) throw new Error('请求过大。'); parts.push(chunk); }
  return JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function localRequest(req, port) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
    [`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host) && !req.headers.origin;
}
const mcp = http.createServer(async (req, res) => {
  if (!localRequest(req, cfg.port)) return json(res, 403, { error: '请求来源不允许。' });
  if (!sameSecret(req.headers.authorization, `Bearer ${cfg.token}`)) return json(res, 401, { error: '需要连接凭据。' });
  if (req.url === '/health' && req.method === 'GET') return json(res, 200, { online: true, tools: routes.size });
  if (req.url !== '/mcp') return json(res, 404, { error: '接口不存在。' });
  if (req.method !== 'POST') return json(res, 405, { error: '仅支持 POST。' });
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    const payload = await body(req);
    await server.connect(transport);
    res.on('close', () => { transport.close(); server.close(); });
    await transport.handleRequest(req, res, payload);
  } catch (e) { if (!res.headersSent) json(res, 500, { error: e.message }); }
});

const ui = await fs.readFile(path.join(base, 'approval.html'), 'utf8');
const approvals = http.createServer(async (req, res) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) ||
    ![`127.0.0.1:${cfg.approvalPort}`, `localhost:${cfg.approvalPort}`].includes(req.headers.host)) return json(res, 403, {});
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY' });
    return res.end(ui);
  }
  if (!sameSecret(req.headers['x-approval-token'], cfg.approvalToken)) return json(res, 401, {});
  const origin = req.headers.origin;
  if (origin && ![`http://127.0.0.1:${cfg.approvalPort}`, `http://localhost:${cfg.approvalPort}`].includes(origin)) return json(res, 403, {});
  if (req.url === '/shutdown' && req.method === 'POST') {
    json(res, 200, { stopping: true });
    setTimeout(shutdown, 200);
    return;
  }
  if (req.url === '/pending' && req.method === 'GET') return json(res, 200,
    [...pending.values()].map(({ id, tool, args, status, createdAt }) => ({ id, tool, args, status, createdAt })));
  if (req.url === '/decision' && req.method === 'POST') {
    try {
      const data = await body(req), item = pending.get(data.id);
      if (!item || item.status !== 'pending') return json(res, 409, { error: '此审批已处理或不存在。' });
      if (data.allow !== true) { item.status = 'denied'; item.result = { ...textResult('用户拒绝此操作。'), isError: true }; }
      else {
        item.status = 'running';
        execute(item.route, item.args).then(result => { item.result = result; item.status = 'complete'; })
          .catch(e => { item.result = { ...textResult(e.message), isError: true }; item.status = 'failed'; });
      }
      return json(res, 200, { status: item.status });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  return json(res, 404, {});
});

await new Promise(resolve => mcp.listen(cfg.port, '127.0.0.1', resolve));
await new Promise(resolve => approvals.listen(cfg.approvalPort, '127.0.0.1', resolve));
console.log(`Windows 连接就绪，工具数量 ${routes.size}。`);
// Release the test browser after five minutes without browser calls.
const recycle = setInterval(async () => {
  const browser = [...routes.values()].filter(r => r.kind === 'browser');
  if (browser.length && Date.now() - Math.max(...browser.map(r => r.lastUsed)) > 300000) {
    try { await browser[0].client.callTool({ name: 'browser_close', arguments: {} }); }
    catch {}
    for (const r of browser) r.lastUsed = Date.now();
  }
}, 60000);
async function shutdown() {
  clearInterval(recycle);
  mcp.close(); approvals.close();
  await Promise.allSettled(children.map(client => client.close()));
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
