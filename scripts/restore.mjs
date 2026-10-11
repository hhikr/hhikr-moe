// Turn a fresh clone of the backup repository into a data directory:
// rebuild site.db from export/db.sql and download the release attachments.
// Usage: node scripts/restore.mjs <clone directory> [--no-attachments]
// Needs BACKUP_REPO and BACKUP_GITHUB_TOKEN unless --no-attachments is given.
import path from 'node:path';
import { restoreInto } from '../src/server/backup.ts';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/restore.mjs <clone directory> [--no-attachments]');
  process.exit(2);
}
try {
  const result = await restoreInto(path.resolve(dir), { attachments: !process.argv.includes('--no-attachments') });
  console.log(`restored ${result.posts} posts and ${result.attachments} attachment(s) into ${path.resolve(dir)}`);
} catch (err) {
  console.error(`restore failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
