import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dataDir, dataPath } from './config.ts';
import { MIGRATIONS } from './migrations.ts';

let handle: DatabaseSync | undefined;
let handlePath: string | undefined;

/** The shared connection. Opens the database and applies pending migrations on first use. */
export function db(): DatabaseSync {
  const file = dataPath('site.db');
  if (handle && handlePath === file) return handle;
  handle?.close();
  fs.mkdirSync(dataDir(), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(conn, file);
  handle = conn;
  handlePath = file;
  return conn;
}

export function closeDb(): void {
  handle?.close();
  handle = undefined;
  handlePath = undefined;
}

function migrate(conn: DatabaseSync, file: string): void {
  conn.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(conn.prepare('SELECT id FROM schema_migrations').all().map((r: any) => String(r.id)));
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));
  if (pending.length === 0) return;

  // Keep a copy of the database as it was before this batch of schema changes.
  if (applied.size > 0) {
    conn.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(file, `${file}.before-${pending[0].id}`);
  }
  for (const m of pending) {
    conn.exec('BEGIN');
    try {
      conn.exec(m.sql);
      conn.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(m.id, new Date().toISOString());
      conn.exec('COMMIT');
    } catch (err) {
      conn.exec('ROLLBACK');
      throw err;
    }
  }
}

/** Run `fn` inside a transaction, rolling back if it throws. */
export function transaction<T>(fn: () => T): T {
  const conn = db();
  conn.exec('BEGIN');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}
