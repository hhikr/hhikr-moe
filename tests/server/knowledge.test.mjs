// The knowledge base page reads one file another service writes: it must cope
// with the file missing or half-understood, and notice a run that died.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const { knowledgeStatus } = await import('../../src/server/knowledge.ts');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-knowledge-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const file = path.join(root, 'status.json');
const now = new Date('2026-11-02T12:00:00Z');
const write = (value) => fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
const minutesAgo = (m) => new Date(now.getTime() - m * 60_000).toISOString();

test('no file or a broken file: not connected, no exception', () => {
  assert.equal(knowledgeStatus(now, path.join(root, 'absent.json')).configured, false);
  write('{ not json');
  const status = knowledgeStatus(now, file);
  assert.equal(status.configured, false);
  assert.equal(status.running, false);
});

test('a quiet, recent check needs no attention', () => {
  write({ running: false, last_check_at: minutesAgo(30), last_outcome: 'idle', upstream: 'aaa', published: { commit: 'aaa', commit_date: '2026-11-01T00:00:00Z', pack_commit: 'bbb' }, runs: [] });
  const status = knowledgeStatus(now, file);
  assert.deepEqual(status.warnings, []);
  assert.equal(status.published.packCommit, 'bbb');
});

test('a running update shows its stage and progress', () => {
  write({ running: true, stage: '下载', detail: 'x', progress: { done: 5, total: 10 }, updated_at: minutesAgo(1) });
  const status = knowledgeStatus(now, file);
  assert.equal(status.running, true);
  assert.equal(status.stage, '下载');
  assert.deepEqual(status.progress, { done: 5, total: 10 });
});

test('a run silent for too long has died', () => {
  write({ running: true, stage: '打包', updated_at: minutesAgo(90), last_check_at: minutesAgo(90) });
  const status = knowledgeStatus(now, file);
  assert.equal(status.running, false);
  assert.ok(status.warnings.some((w) => w.level === 'red' && w.message.includes('打包')));
});

test('a failure or a hold is flagged with what the bot said', () => {
  for (const outcome of ['failed', 'held']) {
    write({ running: false, last_check_at: minutesAgo(5), last_outcome: outcome, last_summary: '原因' });
    assert.deepEqual(knowledgeStatus(now, file).warnings, [{ level: 'red', message: '原因' }]);
  }
});

test('no check for hours is flagged', () => {
  write({ running: false, last_check_at: minutesAgo(200), last_outcome: 'idle' });
  assert.equal(knowledgeStatus(now, file).warnings.length, 1);
});

test('a run is read from the bot\'s field names', () => {
  write({ running: false, last_check_at: minutesAgo(1), runs: [{ started_at: minutesAgo(9), finished_at: minutesAgo(1), commit: 'abc', outcome: 'published', changes: { story_added: 3, story_changed: 1 }, vectors: { embedded_chunks: 7 }, tables: ['story_lines'], stages: [{ name: '检查', at: 'x' }] }] });
  const [run] = knowledgeStatus(now, file).runs;
  assert.equal(run.storyAdded, 3);
  assert.equal(run.embeddedChunks, 7);
  assert.deepEqual(run.tables, ['story_lines']);
});
