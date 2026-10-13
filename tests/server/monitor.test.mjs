// The two watches behind the management overview: readings of the machine,
// and the calendar of Hermes's scheduled jobs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-monitor-'));
process.env.DATA_DIR = dir;

const { closeDb, db } = await import('../../src/server/db.ts');
const { cronCalendars, hermesInternal, hermesStatus, runFrom, saveCronSnapshot, syncHermes } = await import('../../src/server/hermes.ts');
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

test('a run is failed when Hermes says so in any of the places it says it', () => {
  assert.deepEqual(runFrom({ started_at: 1791700000.4, ended_at: 1791700060 }), { startedAt: 1791700000, endedAt: 1791700060, failed: false });
  assert.equal(runFrom({ started_at: 1791700000, ended_at: null }).endedAt, null);
  assert.equal(runFrom({ started_at: 1791700000, status: 'failed' }).failed, true);
  assert.equal(runFrom({ started_at: 1791700000, end_reason: 'agent_error' }).failed, true);
  assert.equal(runFrom({ started_at: 1791700000, title: 'Failed: script exited 1' }).failed, true);
  assert.equal(runFrom({ started_at: 1791700000, title: 'Daily error report' }).failed, false);
  assert.equal(runFrom({ started_at: 'soon' }), undefined);
});

test('the calendar counts runs by Beijing day, in whole weeks ending with this one', () => {
  // Wednesday 14 October 2026, 10:00 in Beijing.
  const now = Date.UTC(2026, 9, 14, 2, 0, 0);
  const beijing = (day, hour) => Date.UTC(2026, 9, day, hour - 8, 0, 0) / 1000;
  saveCronSnapshot(
    [
      { id: 'a', name: 'Morning brief', schedule: 'every day at 08:00', enabled: true },
      { id: 'b', name: 'Idle', schedule: '', enabled: false },
    ],
    new Map([['a', [
      { startedAt: beijing(14, 8), endedAt: beijing(14, 8) + 30, failed: false },
      { startedAt: beijing(13, 8), endedAt: null, failed: true },
      { startedAt: beijing(13, 23), endedAt: null, failed: false },
      { startedAt: beijing(13, 0), endedAt: null, failed: false },
    ]]]),
  );

  const [b, a] = cronCalendars(4, now); // by name
  assert.equal(a.name, 'Morning brief');
  assert.equal(a.weeks.length, 4);
  assert.deepEqual(a.weeks[3].map((d) => d?.day ?? null), ['2026-10-12', '2026-10-13', '2026-10-14', null, null, null, null]);
  assert.equal(a.weeks[0][0].day, '2026-09-21');
  assert.deepEqual(a.weeks[3][1], { day: '2026-10-13', runs: 3, failed: 1 });
  assert.deepEqual(a.weeks[3][2], { day: '2026-10-14', runs: 1, failed: 0 });
  assert.deepEqual([a.runs, a.failed, a.activeDays, a.busiest, a.lastRunAt], [4, 1, 2, 3, beijing(14, 8)]);
  assert.deepEqual([b.name, b.enabled, b.runs], ['Idle', false, 0]);

  // Seeing the same run again changes nothing; a job Hermes no longer has stays while it has runs to show.
  saveCronSnapshot([{ id: 'b', name: 'Idle', schedule: '', enabled: true }], new Map());
  const after = cronCalendars(4, now);
  assert.deepEqual(after.map((c) => [c.id, c.removed, c.runs]), [['b', false, 0], ['a', true, 4]]);
  saveCronSnapshot([], new Map());
  assert.deepEqual(cronCalendars(4, now).map((c) => c.id), ['a'], 'a removed job with nothing to show is left out');
});

test('Hermes is asked on the loopback interface only, with the token from its own page', async () => {
  process.env.HERMES_INTERNAL = 'https://hermes.example';
  assert.equal(hermesInternal(), undefined);
  process.env.HERMES_INTERNAL = 'http://203.0.113.9:9119';
  assert.equal(hermesInternal(), undefined);

  let token = 'first-token';
  const seen = [];
  const hermes = http.createServer((req, res) => {
    seen.push(req.url);
    if (req.url === '/') return res.end(`<script>window.__HERMES_SESSION_TOKEN__="${token}";</script>`);
    if (req.headers['x-hermes-session-token'] !== token) return res.writeHead(401).end('{}');
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/status') return res.end(JSON.stringify({ version: '0.21.7', active_sessions: 2 }));
    if (req.url === '/api/cron/jobs') return res.end(JSON.stringify([{ id: 'j1', name: 'Digest', schedule_display: 'every 6h', enabled: true, state: 'scheduled' }]));
    if (req.url === '/api/cron/jobs/j1/runs?limit=100') return res.end(JSON.stringify({ runs: [{ id: 'cron_j1_1', started_at: 1791700000, ended_at: 1791700100 }, { id: 'x', started_at: null }] }));
    res.writeHead(404).end('{}');
  });
  await new Promise((resolve) => hermes.listen(0, '127.0.0.1', resolve));
  process.env.HERMES_INTERNAL = `http://127.0.0.1:${hermes.address().port}`;

  await syncHermes(1000);
  assert.deepEqual(hermesStatus(), { checkedAt: 1000, online: true, version: '0.21.7', activeSessions: 2 });
  assert.deepEqual(db().prepare("SELECT job_id, started_at, ended_at, failed FROM hermes_cron_runs WHERE job_id = 'j1'").all().map((r) => ({ ...r })), [
    { job_id: 'j1', started_at: 1791700000, ended_at: 1791700100, failed: 0 },
  ]);

  // Hermes restarted: the old token is refused, the new one is read and the request repeated.
  token = 'second-token';
  seen.length = 0;
  await syncHermes(2000);
  assert.equal(hermesStatus().online, true);
  assert.deepEqual(seen.slice(0, 3), ['/api/status', '/', '/api/status']);

  await new Promise((resolve) => hermes.close(resolve));
  await syncHermes(3000);
  assert.deepEqual(hermesStatus(), { checkedAt: 3000, online: false, version: '0.21.7', activeSessions: 2 });
  delete process.env.HERMES_INTERNAL;
});
