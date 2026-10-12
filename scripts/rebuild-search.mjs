// Rebuild the search index against a running site.
//   node scripts/rebuild-search.mjs [origin] [clientDir]
// Defaults: http://127.0.0.1:$PORT (4400) and ./dist/client. Uses DATA_DIR.
import path from 'node:path';
import { closeDb } from '../src/server/db.ts';
import { rebuildSearchIndex } from '../src/server/search.ts';

const origin = process.argv[2] ?? `http://127.0.0.1:${process.env.PORT ?? 4400}`;
const clientDir = path.resolve(process.argv[3] ?? 'dist/client');

const result = await rebuildSearchIndex(origin, clientDir);
console.log(`search index rebuilt: ${result.pages} prerendered pages, ${result.posts} posts`);
closeDb();
