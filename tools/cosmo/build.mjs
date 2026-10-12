// Build the web version of Cosmo: the Hermes Desktop renderer, unmodified,
// plus the bridge that stands in for Electron.
//
//   node tools/cosmo/build.mjs [--upstream <hermes-agent checkout>] [--out <dir>] [--skip-build]
//
// The checkout must be at the commit the Hermes backend runs, with
// `npm ci --workspace apps/desktop --include-workspace-root --ignore-scripts`
// already done at its root.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const { values } = parseArgs({
  options: { upstream: { type: 'string' }, out: { type: 'string' }, 'skip-build': { type: 'boolean' } },
});
const upstream = path.resolve(values.upstream ?? path.join(root, '.deployment/hermes/upstream'));
const out = path.resolve(values.out ?? path.join(root, '.deployment/hermes/cosmo-web/dist'));
const desktop = path.join(upstream, 'apps/desktop');

if (!fs.existsSync(path.join(desktop, 'vite.config.ts'))) throw new Error(`no Hermes Desktop source at ${desktop}`);

if (!values['skip-build']) {
  const vite = path.join(upstream, 'node_modules/vite/bin/vite.js');
  execFileSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir'], { cwd: desktop, stdio: 'inherit' });
}

// Our own files live under cosmo/, apart from the renderer's.
const own = path.join(out, 'cosmo');
fs.mkdirSync(own, { recursive: true });
fs.copyFileSync(path.join(here, 'shim/bridge.js'), path.join(own, 'bridge.js'));

// The bridge goes in ahead of the application bundle: it must exist before the
// first import runs.
const indexPath = path.join(out, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('cosmo/bridge.js')) {
  const entry = html.indexOf('<script type="module"');
  if (entry < 0) throw new Error('the renderer entry script was not found in index.html');
  html = `${html.slice(0, entry)}<script src="./cosmo/bridge.js"></script>\n    ${html.slice(entry)}`;
  html = html.replace(/<title>[^<]*<\/title>/, '<title>Cosmo</title>');
  fs.writeFileSync(indexPath, html);
}

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(own, 'build.json'), `${JSON.stringify({ hermesCommit: commit, builtAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Cosmo web build ready in ${out} (Hermes ${commit.slice(0, 12)})`);
