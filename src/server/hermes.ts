// What the site knows about Hermes, the agent running beside it on the same
// machine: whether it answers, and when each of its scheduled jobs has run.
//
// Hermes keeps the last hundred runs of a job. The site copies them into its
// own database each time it looks, so the calendar on the overview goes back
// further than that.
import { db, transaction } from './db.ts';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
/** The calendar's day boundaries, as hours ahead of UTC (the site keeps Beijing time throughout). */
const DAY_OFFSET_HOURS = 8;

/** Where Hermes listens (http://127.0.0.1:9119). Unset means the site does not ask. */
export function hermesInternal(): URL | undefined {
  const value = process.env.HERMES_INTERNAL?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && LOOPBACK.has(url.hostname) ? url : undefined;
  } catch {
    return undefined;
  }
}

// Hermes writes its session token into the page it serves on the loopback
// interface, for whatever runs on this machine to use.
let token: string | undefined;

async function readToken(base: URL): Promise<string> {
  const page = await fetch(new URL('/', base), { signal: AbortSignal.timeout(4000) });
  const found = /__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/.exec(await page.text());
  if (!found) throw new Error('Hermes did not present a session token');
  return found[1];
}

async function ask(base: URL, path: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    token ??= await readToken(base);
    const res = await fetch(new URL(path, base), { headers: { 'X-Hermes-Session-Token': token }, signal: AbortSignal.timeout(8000) });
    // Hermes restarted and has a new token.
    if (res.status === 401 && attempt === 0) {
      token = undefined;
      continue;
    }
    if (!res.ok) throw new Error(`Hermes answered ${res.status} for ${path}`);
    return res.json();
  }
}

export interface HermesStatus {
  /** When the site last asked, as milliseconds since the epoch; null before the first time. */
  checkedAt: number | null;
  online: boolean;
  version: string | null;
  activeSessions: number | null;
}

let status: HermesStatus = { checkedAt: null, online: false, version: null, activeSessions: null };

export const hermesStatus = (): HermesStatus => status;

export interface CronJobSeen {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
}

export interface CronRunSeen {
  /** Seconds since the epoch. */
  startedAt: number;
  endedAt: number | null;
  failed: boolean;
}

/** One run as Hermes lists it. It has no single "failed" field: a script run says so in its status, an agent run in why it ended. */
export function runFrom(row: any): CronRunSeen | undefined {
  const startedAt = Math.round(Number(row?.started_at));
  if (!Number.isFinite(startedAt) || startedAt <= 0) return undefined;
  const endedAt = Number(row.ended_at);
  const failed = row.status === 'failed' || /fail|error/i.test(String(row.end_reason ?? '')) || /^(failed|error)\b/i.test(String(row.title ?? ''));
  return { startedAt, endedAt: Number.isFinite(endedAt) && endedAt > 0 ? Math.round(endedAt) : null, failed };
}

/** Record the jobs Hermes has now, and the runs it listed for them. Jobs it no longer has are kept, marked as removed. */
export function saveCronSnapshot(jobs: CronJobSeen[], runs: Map<string, CronRunSeen[]>): void {
  transaction(() => {
    db().exec('UPDATE hermes_cron_jobs SET removed = 1');
    const job = db().prepare(
      `INSERT INTO hermes_cron_jobs (id, name, schedule, enabled, removed) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, schedule = excluded.schedule, enabled = excluded.enabled, removed = 0`,
    );
    const run = db().prepare(
      `INSERT INTO hermes_cron_runs (job_id, started_at, ended_at, failed) VALUES (?, ?, ?, ?)
       ON CONFLICT(job_id, started_at) DO UPDATE SET ended_at = excluded.ended_at, failed = excluded.failed`,
    );
    for (const j of jobs) {
      job.run(j.id, j.name, j.schedule, j.enabled ? 1 : 0);
      for (const r of runs.get(j.id) ?? []) run.run(j.id, r.startedAt, r.endedAt, r.failed ? 1 : 0);
    }
  });
}

/** Ask Hermes how it is and what its scheduled jobs have done. Never throws: an unreachable Hermes is a state, not an error. */
export async function syncHermes(now = Date.now()): Promise<void> {
  const base = hermesInternal();
  if (!base) return;
  try {
    const answer = await ask(base, '/api/status');
    status = {
      checkedAt: now,
      online: true,
      version: typeof answer.version === 'string' ? answer.version : null,
      activeSessions: Number.isFinite(Number(answer.active_sessions)) ? Number(answer.active_sessions) : null,
    };

    const listed = await ask(base, '/api/cron/jobs');
    const jobs: CronJobSeen[] = (Array.isArray(listed) ? listed : (listed?.jobs ?? []))
      .filter((j: any) => j && typeof j.id === 'string')
      .map((j: any) => ({
        id: j.id,
        name: String(j.name || j.id),
        schedule: String(j.schedule_display ?? j.schedule?.display ?? ''),
        enabled: j.enabled !== false && j.state !== 'paused',
      }));
    const runs = new Map<string, CronRunSeen[]>();
    for (const job of jobs) {
      const history = await ask(base, `/api/cron/jobs/${encodeURIComponent(job.id)}/runs?limit=100`);
      runs.set(job.id, (history?.runs ?? []).flatMap((row: any) => runFrom(row) ?? []));
    }
    saveCronSnapshot(jobs, runs);
  } catch {
    status = { ...status, checkedAt: now, online: false };
  }
}

export interface CronDay {
  /** YYYY-MM-DD. */
  day: string;
  runs: number;
  failed: number;
}

export interface CronCalendar {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  removed: boolean;
  /** Whole weeks, oldest first, Monday first; null for days that have not come yet. */
  weeks: (CronDay | null)[][];
  runs: number;
  failed: number;
  /** Days in the period on which the job ran at least once. */
  activeDays: number;
  /** The most runs on any one day, for scaling the shading. */
  busiest: number;
  lastRunAt: number | null;
}

const dayOf = (seconds: number) => new Date((seconds + DAY_OFFSET_HOURS * 3600) * 1000).toISOString().slice(0, 10);

/** For each job, a calendar of the last `weeks` weeks ending with the current one. Removed jobs appear while they still have runs in it. */
export function cronCalendars(weeks = 26, now = Date.now()): CronCalendar[] {
  const today = dayOf(now / 1000);
  const todayMidnight = Date.parse(`${today}T00:00:00Z`) / 1000;
  const weekday = (new Date(todayMidnight * 1000).getUTCDay() + 6) % 7; // Monday is 0
  const firstDay = todayMidnight - (weekday + (weeks - 1) * 7) * 86400;
  const since = firstDay - DAY_OFFSET_HOURS * 3600;

  const jobs = db().prepare('SELECT id, name, schedule, enabled, removed FROM hermes_cron_jobs ORDER BY removed, name').all() as any[];
  const byDay = db().prepare('SELECT started_at, failed FROM hermes_cron_runs WHERE job_id = ? AND started_at >= ? ORDER BY started_at');

  const calendars: CronCalendar[] = [];
  for (const job of jobs) {
    const days = new Map<string, CronDay>();
    let lastRunAt: number | null = null;
    for (const run of byDay.all(String(job.id), since) as any[]) {
      const day = dayOf(Number(run.started_at));
      const entry = days.get(day) ?? { day, runs: 0, failed: 0 };
      entry.runs++;
      entry.failed += Number(run.failed) ? 1 : 0;
      days.set(day, entry);
      lastRunAt = Number(run.started_at);
    }
    if (Number(job.removed) && days.size === 0) continue;

    const grid: (CronDay | null)[][] = [];
    for (let w = 0; w < weeks; w++) {
      const column: (CronDay | null)[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date((firstDay + (w * 7 + d) * 86400) * 1000).toISOString().slice(0, 10);
        column.push(day > today ? null : (days.get(day) ?? { day, runs: 0, failed: 0 }));
      }
      grid.push(column);
    }
    const all = [...days.values()];
    calendars.push({
      id: String(job.id),
      name: String(job.name),
      schedule: String(job.schedule),
      enabled: !!Number(job.enabled),
      removed: !!Number(job.removed),
      weeks: grid,
      runs: all.reduce((n, d) => n + d.runs, 0),
      failed: all.reduce((n, d) => n + d.failed, 0),
      activeDays: all.length,
      busiest: Math.max(0, ...all.map((d) => d.runs)),
      lastRunAt,
    });
  }
  return calendars;
}
