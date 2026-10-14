import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { Script } from 'node:vm';
import { test } from 'node:test';
const source = (await readFile(new URL('../../scripts/namesilo-dns.mjs', import.meta.url), 'utf8'))
  .replace("import {readFile, mkdir, writeFile} from 'node:fs/promises';", '')
  .replace("import {isIP} from 'node:net';", '');
async function run(options, records = []) {
  const calls = [], backups = [], messages = [];
  const process = { argv: ['node', 'namesilo-dns.mjs', 'point', '--key-file', 'synthetic-key', '--ip', '203.0.113.7', ...options], exitCode: 0 };
  await new Script(source).runInNewContext({ process, isIP, URL, URLSearchParams, AbortSignal,
    console: { log: (...args) => messages.push(args.join(' ')), error: (...args) => messages.push(args.join(' ')) },
    readFile: async filename => { assert.equal(filename, 'synthetic-key'); return 'synthetic-test-key'; },
    mkdir: async () => {}, writeFile: async (filename, body) => backups.push({filename, body}),
    fetch: async url => {
      assert.equal(url.hostname, 'www.namesilo.com');
      const operation = url.pathname.split('/').at(-1);
      calls.push({operation, host: url.searchParams.get('rrhost')});
      return {ok: true, json: async () => ({reply: {code: 300, resource_record: records}})};
    }
  });
  assert.equal(messages.join('\n').includes('synthetic-test-key'), false);
  return {process, calls, backups, messages};
}
const changes = result => result.calls.filter(call => call.operation !== 'dnsListRecords');
test('point de-duplicates requested subdomains including the default www', async () => {
  const result = await run(['--also', 'cosmo,cosmo,www']);
  assert.equal(result.process.exitCode, 0);
  assert.deepEqual(changes(result).map(call => call.host), ['', 'www', 'cosmo']);
});
test('point without also retains root and www defaults', async () => {
  const result = await run([]);
  assert.deepEqual(changes(result).map(call => call.host), ['', 'www']);
  assert.equal(result.backups.length, 1);
});
test('point adds distinct requested subdomains', async () => {
  const result = await run(['--also', 'cosmo,api']);
  assert.deepEqual(changes(result).map(call => call.host), ['', 'www', 'cosmo', 'api']);
});
test('invalid extra host is rejected before any DNS write', async () => {
  const result = await run(['--also', 'cosmo.bad']);
  assert.equal(result.process.exitCode, 1);
  assert.equal(changes(result).length, 0);
  assert.equal(result.backups.length, 0);
});
for (const type of ['AAAA', 'CNAME']) test(`conflicting ${type} on an extra host blocks all writes`, async () => {
  const result = await run(['--also', 'cosmo'], [{host:'cosmo.hhikr.moe', type, value:'synthetic-existing'}]);
  assert.equal(result.process.exitCode, 1);
  assert.equal(changes(result).length, 0);
});
test('an existing A record is updated rather than duplicated', async () => {
  const result = await run(['--also', 'cosmo'], [{host:'cosmo.hhikr.moe', type:'A', value:'203.0.113.1', record_id:'synthetic-id'}]);
  assert.deepEqual(changes(result).filter(call => call.host === 'cosmo').map(call => call.operation), ['dnsUpdateRecord']);
});
