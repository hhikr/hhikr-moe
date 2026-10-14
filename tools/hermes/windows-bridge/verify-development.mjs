import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const base = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(await fs.readFile(path.join(base, 'connection-private.json'), 'utf8'));
const client = new Client({ name: 'windows-development-check', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${cfg.port}/mcp`),
  { requestInit: { headers: { Authorization: `Bearer ${cfg.token}` } } }));
const call = (name, args) => client.callTool({ name, arguments: args });
const text = result => result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
const remote = '/opt/hermes-hhikr/workspace/phone-control';
const local = path.join(cfg.pathMappings[0].local, 'workspace/phone-control');
const tools = await client.listTools();
assert.ok(tools.tools.find(t => t.name === 'windows_start_process').inputSchema.properties.cwd);
assert.notEqual((await call('windows_read_file', { path: remote + '/android/AndroidManifest.xml' })).isError, true);
assert.equal((await call('windows_read_file', { path: '/opt/hermes-hhikr/../../Windows/win.ini' })).isError, true);
const fixture = remote + '/.windows-mapping-check.txt';
const fixtureLocal = path.join(local, '.windows-mapping-check.txt');
await assert.rejects(fs.access(fixtureLocal));
try {
  assert.notEqual((await call('windows_write_file', { path: fixture, content: 'mapped Windows development', mode: 'rewrite' })).isError, true);
  assert.equal(await fs.readFile(fixtureLocal, 'utf8'), 'mapped Windows development');
} finally { await fs.unlink(fixtureLocal).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
assert.notEqual((await call('windows_start_process', { command: 'node --version', cwd: remote, timeout_ms: 2000 })).isError, true);
assert.equal((await call('windows_start_process', { command: 'node --version', cwd: 'C:\\Windows', timeout_ms: 2000 })).isError, true);
await client.close();
console.log('原 VPS 路径读写、本机项目命令、目录越界拒绝均验证通过。签名目录写入已按设置默认允许，未在此脚本中实际写入。');
