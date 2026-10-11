// Visit statistics kept on this server. Nothing stored can identify a
// visitor: addresses are only ever used inside a keyed hash that changes
// daily, and those hashes are thrown away when the day ends.
import { db, transaction } from './db.ts';
import { hmac } from './secrets.ts';

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar day a moment falls on, as the author's timezone sees it: 2026-10-11. */
export const dayOf = (date: Date) => DAY.format(date);

const BOT =
  /bot|crawl|spider|slurp|preview|fetch|monitor|headless|lighthouse|pagespeed|curl|wget|python|node|go-http|java\/|okhttp|axios|scrapy|feed|facebookexternalhit|whatsapp|telegram|discord|bytespider|gptbot|claude-|anthropic|perplexity/i;

/** True for crawlers, link previewers and scripts, going by what they call themselves. */
export const isBot = (userAgent: string) => !userAgent.trim() || BOT.test(userAgent);

export function browserOf(ua: string): string {
  if (/MicroMessenger/i.test(ua)) return '微信';
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return '其他';
}

export function deviceOf(ua: string): string {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return '平板';
  if (/Mobi|iPhone|Android/i.test(ua)) return '手机';
  return '桌面';
}

/** Distinct referring sites recorded per day; anything beyond that is lumped together. */
const MAX_REFERRERS_PER_DAY = 300;
const OTHER = '其他';

/** The site a visitor came from, as a bare host name, or undefined when it is this site or unusable. */
export function referrerHost(value: string | undefined, ownHost: string | undefined): string | undefined {
  if (!value) return undefined;
  let host: string;
  try {
    host = new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  host = host.replace(/^www\./, '');
  if (!/^[a-z0-9.-]{1,100}$/.test(host) || !host.includes('.')) return undefined;
  if (ownHost && host === ownHost.toLowerCase().replace(/^www\./, '')) return undefined;
  return host;
}

export interface Hit {
  /** A public page of this site. The caller has checked that it exists. */
  path: string;
  /** Where the visitor came from: a host name or a full address. */
  referrer?: string;
  userAgent: string;
  address: string;
  /** This site's own host, so visits from one page to another are not counted as referrals. */
  ownHost?: string;
  now?: Date;
}

/** Count one page view. Returns false when it was ignored. */
export function recordHit(hit: Hit): boolean {
  if (isBot(hit.userAgent)) return false;
  const conn = db();
  const day = dayOf(hit.now ?? new Date());
  // Changes every day and cannot be reversed, so visits on different days cannot be linked.
  const visitor = hmac(`visit:${day}:${hit.address}:${hit.userAgent}`).slice(0, 22);
  const referrer = referrerHost(hit.referrer, hit.ownHost);

  transaction(() => {
    conn.prepare('DELETE FROM stats_seen WHERE day < ?').run(day);
    const seen = conn.prepare('INSERT OR IGNORE INTO stats_seen (day, path, visitor_hash) VALUES (?, ?, ?)');
    const newHere = Number(seen.run(day, hit.path, visitor).changes);
    const newToday = Number(seen.run(day, '', visitor).changes);

    conn
      .prepare('INSERT INTO stats_daily (day, path, views, visitors) VALUES (?, ?, 1, ?) ON CONFLICT(day, path) DO UPDATE SET views = views + 1, visitors = visitors + excluded.visitors')
      .run(day, hit.path, newHere);
    conn
      .prepare('INSERT INTO stats_days (day, views, visitors) VALUES (?, 1, ?) ON CONFLICT(day) DO UPDATE SET views = views + 1, visitors = visitors + excluded.visitors')
      .run(day, newToday);

    if (referrer) {
      const known = conn.prepare('SELECT 1 FROM stats_referrers WHERE day = ? AND host = ?').get(day, referrer);
      const count: any = known ? undefined : conn.prepare('SELECT COUNT(*) AS n FROM stats_referrers WHERE day = ?').get(day);
      const host = !known && Number(count.n) >= MAX_REFERRERS_PER_DAY ? OTHER : referrer;
      conn.prepare('INSERT INTO stats_referrers (day, host, views) VALUES (?, ?, 1) ON CONFLICT(day, host) DO UPDATE SET views = views + 1').run(day, host);
    }

    const agent = conn.prepare("INSERT INTO stats_agents (day, kind, name, views) VALUES (?, ?, ?, 1) ON CONFLICT(day, kind, name) DO UPDATE SET views = views + 1");
    agent.run(day, 'browser', browserOf(hit.userAgent));
    agent.run(day, 'device', deviceOf(hit.userAgent));
  });
  return true;
}

/** How many times a post has been read, under its current address and every earlier one. */
export function postViews(postId: number): number {
  const row: any = db()
    .prepare(
      `SELECT COALESCE(SUM(views), 0) AS n FROM stats_daily WHERE path IN (
         SELECT '/posts/' || slug || '/' FROM posts WHERE id = ?
         UNION SELECT '/posts/' || old_slug || '/' FROM post_redirects WHERE post_id = ?)`,
    )
    .get(postId, postId);
  return Number(row.n);
}

/** Read counts of all posts by id, for the management listing. */
export function viewsByPost(): Map<number, number> {
  const rows = db()
    .prepare(
      `SELECT a.id AS id, COALESCE(SUM(d.views), 0) AS n FROM (
         SELECT id, '/posts/' || slug || '/' AS path FROM posts
         UNION SELECT post_id, '/posts/' || old_slug || '/' FROM post_redirects) a
       JOIN stats_daily d ON d.path = a.path GROUP BY a.id`,
    )
    .all();
  return new Map(rows.map((r: any) => [Number(r.id), Number(r.n)]));
}

export interface DayCount {
  day: string;
  views: number;
  visitors: number;
}

export interface Ranked {
  name: string;
  views: number;
  visitors?: number;
}

export interface StatsReport {
  /** One entry per day, oldest first, with zeroes for days nobody came. */
  series: DayCount[];
  views: number;
  /** Sum of each day's distinct visitors; someone who comes on two days counts twice. */
  visitors: number;
  pages: Ranked[];
  referrers: Ranked[];
  browsers: Ranked[];
  devices: Ranked[];
}

/** What happened over the last `days` days, today included. */
export function statsReport(days: number, now: Date = new Date()): StatsReport {
  const conn = db();
  const span = Array.from({ length: days }, (_, i) => dayOf(new Date(now.getTime() - (days - 1 - i) * 86_400_000)));
  const from = span[0];
  const to = span[span.length - 1];

  const byDay = new Map<string, DayCount>(
    conn
      .prepare('SELECT day, views, visitors FROM stats_days WHERE day BETWEEN ? AND ?')
      .all(from, to)
      .map((r: any) => [String(r.day), { day: String(r.day), views: Number(r.views), visitors: Number(r.visitors) }]),
  );
  const series = span.map((day) => byDay.get(day) ?? { day, views: 0, visitors: 0 });
  const ranked = (sql: string, ...args: any[]): Ranked[] =>
    conn
      .prepare(sql)
      .all(...args)
      .map((r: any) => ({ name: String(r.name), views: Number(r.views), ...(r.visitors === undefined ? {} : { visitors: Number(r.visitors) }) }));

  return {
    series,
    views: series.reduce((sum, d) => sum + d.views, 0),
    visitors: series.reduce((sum, d) => sum + d.visitors, 0),
    pages: ranked(
      'SELECT path AS name, SUM(views) AS views, SUM(visitors) AS visitors FROM stats_daily WHERE day BETWEEN ? AND ? GROUP BY path ORDER BY views DESC, path LIMIT 25',
      from,
      to,
    ),
    referrers: ranked('SELECT host AS name, SUM(views) AS views FROM stats_referrers WHERE day BETWEEN ? AND ? GROUP BY host ORDER BY views DESC, host LIMIT 15', from, to),
    browsers: ranked("SELECT name, SUM(views) AS views FROM stats_agents WHERE kind = 'browser' AND day BETWEEN ? AND ? GROUP BY name ORDER BY views DESC, name", from, to),
    devices: ranked("SELECT name, SUM(views) AS views FROM stats_agents WHERE kind = 'device' AND day BETWEEN ? AND ? GROUP BY name ORDER BY views DESC, name", from, to),
  };
}
