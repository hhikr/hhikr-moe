// The watch behind the management overview: readings of the machine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-monitor-'));
process.env.DATA_DIR = dir;

const { closeDb, db } = await import('../../src/server/db.ts');
const { memoryFrom, recordVpsSample, trafficFrom, vpsReport } = await import('../../src/server/vps.ts');

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('memory in use leaves out what the kernel would give back', () => {
  const meminfo = 'MemTotal:        4016000 kB\nMemFree:          200000 kB\nMemAvailable:    3012000 kB\n';
  assert.deepEqual(memoryFrom(meminfo), { used: 1004000 * 1024, total: 4016000 * 1024 });
  const fallback = memoryFrom(undefined);
  assert.equal(fallback.total, os.totalmem());
});

test('traffic is summed over every interface but loopback', () => {
  const netdev = [
    'Inter-|   Receive                                                |  Transmit',
    ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
    '    lo: 5000 10 0 0 0 0 0 0 5000 10 0 0 0 0 0 0',
    '  eth0: 1000 10 0 0 0 0 0 0 300 10 0 0 0 0 0 0',
    '  eth1: 24 1 0 0 0 0 0 0 6 1 0 0 0 0 0 0',
  ].join('\n');
  assert.deepEqual(trafficFrom(netdev), { rx: 1024, tx: 306 });
  assert.equal(trafficFrom(undefined), null);
  assert.equal(trafficFrom('nothing here'), null);
});

test('readings are stored, averaged into intervals, and dropped after a week', () => {
  const now = Date.UTC(2026, 9, 12, 12, 0, 0);
  const first = recordVpsSample(now - 60_000);
  assert.equal(first.cpu, null, 'the first reading has nothing to be compared with');
  const second = recordVpsSample(now);
  assert.ok(second.cpu === null || (second.cpu >= 0 && second.cpu <= 1));
  assert.ok(second.memTotal > 0 && second.memUsed > 0);

  const at = Math.round(now / 1000);
  const insert = db().prepare('INSERT OR REPLACE INTO vps_samples (at, cpu, load1, mem_used, mem_total) VALUES (?, ?, 0, ?, 100)');
  insert.run(at - 3 * 3600 + 60, 0.2, 40);
  insert.run(at - 3 * 3600 + 120, 0.6, 60);
  insert.run(at - 9 * 86400, 0.9, 90);

  const report = vpsReport(24, 24, now);
  assert.equal(report.series.length, 24);
  assert.equal(report.series[0].at, at - 24 * 3600);
  const threeHoursAgo = report.series[21];
  assert.ok(Math.abs(threeHoursAgo.cpu - 0.4) < 1e-9);
  assert.ok(Math.abs(threeHoursAgo.memory - 0.5) < 1e-9);
  assert.equal(report.series[5].cpu, null, 'an interval without readings is a gap');
  assert.equal(report.latest.at, at);
  assert.ok(report.cpuPeak >= 0.4);

  recordVpsSample(now + 60_000);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM vps_samples WHERE at < ?').get(at - 8 * 86400).n, 0);
});

test('the retired assistant leaves no tables behind', () => {
  const names = db().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE 'cosmo_%' OR name LIKE 'hermes_%')").all();
  assert.deepEqual(names, []);
});
