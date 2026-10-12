// Run one backup now: export the database, commit and push to the private
// backup repository, upload large files as release attachments.
// Needs DATA_DIR, BACKUP_REPO and BACKUP_GITHUB_TOKEN in the environment.
import { closeDb } from '../src/server/db.ts';
import { runBackup } from '../src/server/backup.ts';
import { formatBytes } from '../src/server/system.ts';

const run = await runBackup();
closeDb();
if (!run) {
  console.log('another backup is still running');
  process.exit(0);
}
console.log(
  `${run.ok ? 'backup ok' : 'backup FAILED'}: ${run.committed ? 'new commit pushed' : 'nothing new to commit'}, ${run.uploaded} attachment(s) uploaded` +
    (run.repoBytes === undefined ? '' : `, repository ${formatBytes(run.repoBytes)}`),
);
for (const w of run.warnings) console.log(`[${w.level}] ${w.message}`);
process.exit(run.ok ? 0 : 1);
