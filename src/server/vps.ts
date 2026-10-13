// How busy the machine is: a reading a minute, kept for a week, for the
// charts on the management overview.
//
// Processor use and network traffic are counters that only mean something as
// the difference between two readings, so the first reading after a start has
// neither.
import fs from 'node:fs';
import os from 'node:os';
import { db } from './db.ts';

const KEEP_SECONDS = 8 * 86400;

interface Counters {
  at: number;
  busy: number;
  total: number;
  rx: number | null;
  tx: number | null;
}

export interface VpsSample {
  /** Seconds since the epoch. */
  at: number;
  /** Share of processor time in use since the previous reading, 0 to 1. */
  cpu: number | null;
  load1: number;
  memUsed: number;
  memTotal: number;
  /** Bytes per second since the previous reading, all interfaces but loopback. */
  rxRate: number | null;
  txRate: number | null;
}

function processorTimes(): { busy: number; total: number } {
  let busy = 0;
  let total = 0;
  for (const core of os.cpus()) {
    const t = core.times;
    const all = t.user + t.nice + t.sys + t.idle + t.irq;
    total += all;
    busy += all - t.idle;
  }
  return { busy, total };
}

/** Memory in use, not counting what the kernel holds as cache and would give back. */
export function memoryFrom(meminfo: string | undefined): { used: number; total: number } {
  const kb = (name: string) => Number(new RegExp(`^${name}:\\s+(\\d+) kB`, 'm').exec(meminfo ?? '')?.[1]);
  const total = kb('MemTotal');
  const available = kb('MemAvailable');
  if (total > 0 && available >= 0) return { used: (total - available) * 1024, total: total * 1024 };
  return { used: os.totalmem() - os.freemem(), total: os.totalmem() };
}

/** Bytes received and sent since boot, summed over every interface but loopback. */
export function trafficFrom(netdev: string | undefined): { rx: number; tx: number } | null {
  if (!netdev) return null;
  let rx = 0;
  let tx = 0;
  let found = false;
  for (const line of netdev.split('\n')) {
    const match = /^\s*([^:\s]+):\s*(.+)$/.exec(line);
    if (!match || match[1] === 'lo') continue;
    const fields = match[2].trim().split(/\s+/).map(Number);
    if (fields.length < 9 || fields.some(Number.isNaN)) continue;
    rx += fields[0];
    tx += fields[8];
    found = true;
  }
  return found ? { rx, tx } : null;
}

const read = (file: string) => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
};

let previous: Counters | undefined;

/** Take a reading now and store it. */
export function recordVpsSample(now = Date.now()): VpsSample {
  const at = Math.round(now / 1000);
  const traffic = trafficFrom(read('/proc/net/dev'));
  const counters: Counters = { at, ...processorTimes(), rx: traffic?.rx ?? null, tx: traffic?.tx ?? null };
  const memory = memoryFrom(read('/proc/meminfo'));

  const before = previous && counters.at > previous.at ? previous : undefined;
  const seconds = before ? counters.at - before.at : 0;
  // A counter that went backwards was reset (an interface came back up): no rate for this reading.
  const rate = (to: number | null, from: number | null | undefined) =>
    before && to !== null && from !== null && from !== undefined && to >= from ? (to - from) / seconds : null;
  const sample: VpsSample = {
    at,
    cpu: before && counters.total > before.total ? Math.min(1, Math.max(0, (counters.busy - before.busy) / (counters.total - before.total))) : null,
    load1: os.loadavg()[0],
    memUsed: memory.used,
    memTotal: memory.total,
    rxRate: rate(counters.rx, before?.rx),
    txRate: rate(counters.tx, before?.tx),
  };
  previous = counters;

  db()
    .prepare('INSERT OR REPLACE INTO vps_samples (at, cpu, load1, mem_used, mem_total, rx_rate, tx_rate) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(sample.at, sample.cpu, sample.load1, sample.memUsed, sample.memTotal, sample.rxRate, sample.txRate);
  db().prepare('DELETE FROM vps_samples WHERE at < ?').run(at - KEEP_SECONDS);
  return sample;
}

export interface VpsPoint {
  /** Start of the interval, seconds since the epoch. */
  at: number;
  /** Averages over the interval, 0 to 1; null when there was no reading in it. */
  cpu: number | null;
  memory: number | null;
}

export interface VpsReport {
  latest: VpsSample | null;
  cores: number;
  /** System uptime in seconds. */
  uptimeSeconds: number;
  /** Oldest first, one point per interval, covering `hours` up to now. */
  series: VpsPoint[];
  /** The busiest the processor has been over an interval in this period, 0 to 1. */
  cpuPeak: number | null;
}

/** The last `hours`, averaged into `points` intervals. */
export function vpsReport(hours = 24, points = 96, now = Date.now()): VpsReport {
  const end = Math.round(now / 1000);
  const span = (hours * 3600) / points;
  const start = end - hours * 3600;
  const rows = db().prepare('SELECT at, cpu, load1, mem_used, mem_total, rx_rate, tx_rate FROM vps_samples WHERE at > ? ORDER BY at').all(start) as any[];

  const sums = Array.from({ length: points }, () => ({ cpu: 0, cpuN: 0, memory: 0, memoryN: 0 }));
  for (const row of rows) {
    const slot = sums[Math.min(points - 1, Math.floor((Number(row.at) - start - 1) / span))];
    if (!slot) continue;
    if (row.cpu !== null) {
      slot.cpu += Number(row.cpu);
      slot.cpuN++;
    }
    if (Number(row.mem_total) > 0) {
      slot.memory += Number(row.mem_used) / Number(row.mem_total);
      slot.memoryN++;
    }
  }
  const series = sums.map((s, i) => ({
    at: Math.round(start + i * span),
    cpu: s.cpuN ? s.cpu / s.cpuN : null,
    memory: s.memoryN ? s.memory / s.memoryN : null,
  }));
  const measured = series.flatMap((p) => (p.cpu === null ? [] : [p.cpu]));

  const last = rows[rows.length - 1];
  return {
    latest: last
      ? {
          at: Number(last.at),
          cpu: last.cpu === null ? null : Number(last.cpu),
          load1: Number(last.load1),
          memUsed: Number(last.mem_used),
          memTotal: Number(last.mem_total),
          rxRate: last.rx_rate === null ? null : Number(last.rx_rate),
          txRate: last.tx_rate === null ? null : Number(last.tx_rate),
        }
      : null,
    cores: os.cpus().length,
    uptimeSeconds: Math.round(os.uptime()),
    series,
    cpuPeak: measured.length ? Math.max(...measured) : null,
  };
}
