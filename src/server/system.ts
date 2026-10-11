// Facts about the server's own state, for the management overview.
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, dataPath } from './config.ts';

export interface SystemStatus {
  databaseBytes: number;
  mediaFiles: number;
  mediaBytes: number;
  diskFreeBytes: number | null;
  diskTotalBytes: number | null;
  searchIndexedAt: Date | null;
  uptimeSeconds: number;
  node: string;
}

function measure(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  if (!fs.existsSync(dir)) return { files, bytes };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    files++;
    bytes += fs.statSync(path.join(entry.parentPath, entry.name)).size;
  }
  return { files, bytes };
}

const sizeOf = (file: string) => (fs.existsSync(file) ? fs.statSync(file).size : 0);

export function systemStatus(): SystemStatus {
  const media = measure(dataPath('media'));
  const avatars = measure(dataPath('avatars'));
  let disk: fs.StatsFs | undefined;
  try {
    disk = fs.statfsSync(dataDir());
  } catch {
    // Not every platform reports this.
  }
  const index = dataPath('pagefind', 'pagefind-entry.json');
  return {
    databaseBytes: sizeOf(dataPath('site.db')) + sizeOf(dataPath('site.db-wal')),
    mediaFiles: media.files + avatars.files,
    mediaBytes: media.bytes + avatars.bytes,
    diskFreeBytes: disk ? Number(disk.bavail) * Number(disk.bsize) : null,
    diskTotalBytes: disk ? Number(disk.blocks) * Number(disk.bsize) : null,
    searchIndexedAt: fs.existsSync(index) ? fs.statSync(index).mtime : null,
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
