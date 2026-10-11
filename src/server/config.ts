// Runtime configuration. Everything under src/server/ stays free of `astro:`
// imports so it also runs in plain Node scripts and tests.
import path from 'node:path';

/** Where the database and uploaded files live. Read on every call so tests can point it elsewhere. */
export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR ?? '.data');
}

export function dataPath(...parts: string[]): string {
  return path.join(dataDir(), ...parts);
}
