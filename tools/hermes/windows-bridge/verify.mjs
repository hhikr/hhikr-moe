import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const base = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(await fs.readFile(path.join(base, 'connection-private.json'), 'utf8'));
const origin = `http://127.0.0.1:${cfg.port}`;
const headers = { Authorization: `Bearer ${cfg.token}` };
assert.equal((await fetch(`${origin}/health`)).status, 401);
assert.equal((await fetch(`${origin}/health`, { headers: { Authorization: 'Bearer ' + 'é'.repeat(64) } })).status, 401);
assert.equal((await fetch(`${origin}/health`, { headers: { ...headers, Origin: 'https://example.com' } })).status, 403);
assert.equal((await fetch(`http://127.0.0.1:${cfg.approvalPort}/pending`, { headers: { 'X-Approval-Token': cfg.token } })).status, 401);
const client = new Client({ name: 'hermes-connection-check', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), { requestInit: { headers } }));
const tools = await client.listTools();
assert.ok(tools.tools.some(tool => tool.name === 'windows_read_file'));
assert.ok(tools.tools.some(tool => tool.name === 'web_browser_navigate'));
const denied = await client.callTool({ name: 'windows_read_file', arguments: { path: path.join(base, 'connection-private.json') } });
assert.equal(denied.isError, true);
const outside = await client.callTool({ name: 'windows_read_file', arguments: { path: 'C:\\Windows\\win.ini' } });
assert.equal(outside.isError, true);
const file = await client.callTool({ name: 'windows_read_file', arguments: { path: path.join(cfg.projectRoots[0], 'README.md'), length: 4 } });
assert.notEqual(file.isError, true);
const fixture = path.join(cfg.projectRoots[0], '.hermes-connection-check.txt');
await assert.rejects(fs.access(fixture));
try {
  const written = await client.callTool({ name: 'windows_write_file', arguments: { path: fixture, content: 'Hermes 中文文件验证', mode: 'rewrite' } });
  assert.notEqual(written.isError, true);
  assert.equal(await fs.readFile(fixture, 'utf8'), 'Hermes 中文文件验证');
} finally {
  assert.equal(path.dirname(fixture), cfg.projectRoots[0]);
  await fs.unlink(fixture).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
const probeDir = path.join(cfg.projectRoots[0], '.hermes-link-check');
await assert.rejects(fs.access(probeDir));
await fs.mkdir(probeDir);
const link = path.join(probeDir, 'connection');
try {
  await fs.symlink(base, link, 'junction');
  const linked = await client.callTool({ name: 'windows_read_file', arguments: { path: path.join(link, 'connection-private.json') } });
  assert.equal(linked.isError, true);
} finally {
  await fs.rmdir(link).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await fs.rmdir(probeDir);
}
const version = await client.callTool({ name: 'windows_start_process', arguments: { command: 'node --version', timeout_ms: 2000 } });
assert.notEqual(version.isError, true);
assert.match(JSON.stringify(version), /v[0-9]+\./);
const waiting = await client.callTool({ name: 'windows_start_process', arguments: { command: 'Write-Output HERMES_APPROVAL_CHECK', timeout_ms: 2000 } });
const record = JSON.parse(waiting.content.find(item => item.type === 'text').text);
assert.equal(record.status, 'pending');
const state = await client.callTool({ name: 'approval_status', arguments: { id: record.approval_id } });
assert.equal(JSON.parse(state.content[0].text).status, 'pending');
const deny = await fetch(`http://127.0.0.1:${cfg.approvalPort}/decision`, { method: 'POST',
  headers: { 'X-Approval-Token': cfg.approvalToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: record.approval_id, allow: false }) });
assert.equal(deny.status, 200);
assert.equal((await client.callTool({ name: 'approval_status', arguments: { id: record.approval_id } })).isError, true);
const browser = await client.callTool({ name: 'web_browser_navigate', arguments: { url: 'https://hhikr.moe/' } });
assert.notEqual(browser.isError, true);
assert.match(JSON.stringify(browser), /hhikr/);
await client.callTool({ name: 'web_browser_close', arguments: {} });
await client.close();
await fs.writeFile(path.join(base, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(),
  checks: ['authentication', 'origin-restriction', 'approval-key-separation', 'private-path-denied', 'outside-project-denied',
    'Windows-file-read', 'Windows-file-write', 'junction-escape-denied', 'Windows-command-execution',
    'unapproved-command-pending', 'denial', 'Windows-browser-navigation'],
  tools: tools.tools.length }, null, 2));
console.log(`Windows 连接验证通过，${tools.tools.length} 个工具可发现。`);
