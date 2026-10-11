import type { APIRoute } from 'astro';
import { fail, json } from '@/lib/http';
import { backupStatus, runBackup } from '@/server/backup.ts';

export const prerender = false;

/** Start a backup now. It carries on in the background; the page shows its progress. */
export const POST: APIRoute = () => {
  const status = backupStatus();
  if (!status.configured) return fail('not_configured', '备份还没有配置');
  if (status.running) return fail('running', '已经有一次备份正在进行', 409);
  void runBackup().catch((err) => console.error('backup failed:', err));
  return json({ started: true }, 202);
};
