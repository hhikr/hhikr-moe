// Package the Hot 100 judge for the VPS: .deployment/hot100-judge.tar.gz with the judge, its Java
// sources, LessonIO and the lesson modules it imports (it has no npm dependencies). Install it
// there with tools/hot100-judge/deploy/install-hot100.sh.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const walk = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = join(dir, name);
  return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
});
const files = [
  ...walk('tools/hot100-judge').filter((f) => /\.(mjs|java|sh|service)$/.test(f)),
  'tools/hot100-java/LessonIO.java',
  ...walk('public/hot100-assets').filter((f) => f.endsWith('.mjs')),
].map((f) => relative(root, join(root, f)).replaceAll('\\', '/')).sort();

mkdirSync(join(root, '.deployment'), { recursive: true });
const out = '.deployment/hot100-judge.tar.gz';
const tar = spawnSync('tar', ['-czf', out, ...files], { cwd: root, stdio: 'inherit' });
if (tar.status !== 0) process.exit(tar.status || 1);
console.log(`${out}: ${files.length} files, ${(statSync(join(root, out)).size / 1024).toFixed(0)} KB`);
