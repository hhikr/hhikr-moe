// Visit statistics: what is counted, what is ignored, and that nothing
// identifying is kept. Runs against a throwaway database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hhikr-test-'));
process.env.DATA_DIR = dir;

const { closeDb, db } = await import('../../src/server/db.ts');
const { savePost, writePost, getEditablePost } = await import('../../src/server/posts.ts');
const { browserOf, dayOf, deviceOf, isBot, postViews, recordHit, referrerHost, statsReport, viewsByPost } = await import('../../src/server/stats.ts');

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ALICE = '203.0.113.7';
const BOB = '198.51.100.23';
// Noon in Shanghai on two consecutive days.
const DAY1 = new Date('2026-10-10T04:00:00Z');
const DAY2 = new Date('2026-10-11T04:00:00Z');
const hit = (over = {}) => recordHit({ path: '/posts/a/', userAgent: CHROME, address: ALICE, ownHost: 'hhikr.moe', now: DAY1, ...over });
const row = (sql, ...args) => db().prepare(sql).get(...args);

let postId;
before(async () => {
  postId = await savePost({ slug: 'a', title: 'A', status: 'published', sourceMd: 'text', publishedAt: DAY1, tags: [] });
});

after(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the day is taken in the author\'s timezone', () => {
  assert.equal(dayOf(new Date('2026-10-10T15:59:59Z')), '2026-10-10');
  assert.equal(dayOf(new Date('2026-10-10T16:00:00Z')), '2026-10-11');
});

test('every view is counted, a visitor only once per page and day', () => {
  assert.equal(hit(), true);
  hit();
  hit({ address: BOB });
  const page = row("SELECT views, visitors FROM stats_daily WHERE day = '2026-10-10' AND path = '/posts/a/'");
  assert.deepEqual({ ...page }, { views: 3, visitors: 2 });
});

test('site-wide visitors are distinct across pages', () => {
  hit({ path: '/' });
  hit({ path: '/about/' });
  const site = row("SELECT views, visitors FROM stats_days WHERE day = '2026-10-10'");
  assert.deepEqual({ ...site }, { views: 5, visitors: 2 });
  assert.equal(row("SELECT visitors FROM stats_daily WHERE day = '2026-10-10' AND path = '/'").visitors, 1);
});

test('the same person on another day is a new visitor, and yesterday\'s marks are gone', () => {
  hit({ now: DAY2 });
  assert.equal(row("SELECT visitors FROM stats_days WHERE day = '2026-10-11'").visitors, 1);
  assert.equal(row("SELECT COUNT(*) AS n FROM stats_seen WHERE day < '2026-10-11'").n, 0);
  const marks = db().prepare('SELECT visitor_hash FROM stats_seen').all().map((r) => r.visitor_hash);
  assert.ok(marks.length > 0);
});

test('crawlers and scripts are ignored', () => {
  const before = row('SELECT SUM(views) AS n FROM stats_days').n;
  for (const ua of ['', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'curl/8.5.0', 'python-requests/2.32', 'node', 'Mozilla/5.0 HeadlessChrome/140.0']) {
    assert.equal(isBot(ua), true, ua);
    assert.equal(hit({ userAgent: ua }), false);
  }
  assert.equal(isBot(CHROME), false);
  assert.equal(isBot(IPHONE), false);
  assert.equal(row('SELECT SUM(views) AS n FROM stats_days').n, before);
});

test('referrers are kept as host names only, and never this site', () => {
  assert.equal(referrerHost('https://www.google.com/search?q=secret+words', 'hhikr.moe'), 'google.com');
  assert.equal(referrerHost('t.co', 'hhikr.moe'), 't.co');
  assert.equal(referrerHost('https://hhikr.moe/posts/a/', 'hhikr.moe'), undefined);
  assert.equal(referrerHost('https://www.hhikr.moe/', 'hhikr.moe'), undefined);
  assert.equal(referrerHost('', 'hhikr.moe'), undefined);
  assert.equal(referrerHost('javascript:alert(1)', 'hhikr.moe'), undefined);
  assert.equal(referrerHost('<script>', 'hhikr.moe'), undefined);
  assert.equal(referrerHost('localhost', 'hhikr.moe'), undefined);

  hit({ referrer: 'https://www.google.com/search?q=secret+words', now: DAY2 });
  hit({ referrer: 'https://hhikr.moe/', now: DAY2 });
  const hosts = db().prepare('SELECT host, views FROM stats_referrers').all().map((r) => ({ ...r }));
  assert.deepEqual(hosts, [{ host: 'google.com', views: 1 }]);
});

test('browsers and devices are sorted into broad groups', () => {
  assert.equal(browserOf(CHROME), 'Chrome');
  assert.equal(browserOf(IPHONE), 'Safari');
  assert.equal(browserOf(`${CHROME} Edg/140.0.0.0`), 'Edge');
  assert.equal(browserOf('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'), 'Firefox');
  assert.equal(browserOf(`${IPHONE} MicroMessenger/8.0.50`), '微信');
  assert.equal(deviceOf(CHROME), '桌面');
  assert.equal(deviceOf(IPHONE), '手机');
  assert.equal(deviceOf('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'), '平板');
  assert.equal(deviceOf('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36'), '手机');

  hit({ userAgent: IPHONE, now: DAY2 });
  const names = db().prepare("SELECT kind, name FROM stats_agents WHERE day = '2026-10-11' ORDER BY kind, name").all().map((r) => `${r.kind}:${r.name}`);
  assert.deepEqual(names, ['browser:Chrome', 'browser:Safari', 'device:手机', 'device:桌面']);
});

test('no address or browser string is stored anywhere', () => {
  const tables = db().prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
  const everything = tables.map((t) => JSON.stringify(db().prepare(`SELECT * FROM ${t}`).all())).join('\n');
  for (const secret of [ALICE, BOB, 'Mozilla', 'secret+words', 'AppleWebKit']) {
    assert.ok(!everything.includes(secret), `${secret} was stored`);
  }
});

test('a post keeps its read count when its address changes', async () => {
  const before = postViews(postId);
  assert.equal(before, 7);
  const { fields, sourceMd } = getEditablePost(postId);
  await writePost(postId, { ...fields, slug: 'a-renamed' }, sourceMd, 'published');
  hit({ path: '/posts/a-renamed/', now: DAY2 });
  assert.equal(postViews(postId), before + 1);
  assert.equal(viewsByPost().get(postId), before + 1);
  assert.equal(postViews(9999), 0);
});

test('the report fills in empty days and adds up the range', () => {
  const report = statsReport(7, DAY2);
  assert.equal(report.series.length, 7);
  assert.deepEqual(report.series.map((d) => d.day).slice(-2), ['2026-10-10', '2026-10-11']);
  assert.deepEqual(report.series[0], { day: '2026-10-05', views: 0, visitors: 0 });
  assert.equal(report.series[5].views, 5);
  assert.equal(report.views, report.series.reduce((sum, d) => sum + d.views, 0));
  assert.equal(report.visitors, 2 + report.series[6].visitors);
  assert.equal(report.pages[0].name, '/posts/a/');
  assert.deepEqual(report.referrers, [{ name: 'google.com', views: 1 }]);
  assert.equal(report.devices.find((d) => d.name === '手机').views, 1);

  const justToday = statsReport(1, DAY2);
  assert.equal(justToday.series.length, 1);
  assert.equal(justToday.views, report.series[6].views);
});
