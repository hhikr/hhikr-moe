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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const { values } = parseArgs({
  options: { upstream: { type: 'string' }, out: { type: 'string' }, 'skip-build': { type: 'boolean' } },
});
const upstream = path.resolve(values.upstream ?? path.join(root, 'tools/hermes/source'));
const out = path.resolve(values.out ?? path.join(root, '.deployment/hermes/cosmo-web/dist'));
const desktop = path.join(upstream, 'apps/desktop');

if (!fs.existsSync(path.join(desktop, 'vite.config.ts'))) throw new Error(`no Hermes Desktop source at ${desktop}`);

if (!values['skip-build']) {
  const vite = path.join(upstream, 'node_modules/vite/bin/vite.js');
  // Upstream's own configuration plus our patches (patches.mjs). The file has
  // to sit beside upstream's for its imports to resolve; it is removed again,
  // so the checkout stays as it was cloned.
  const config = path.join(desktop, 'vite.config.cosmo.ts');
  fs.writeFileSync(config, [
    "import upstream from './vite.config.ts'",
    `import { cosmoPatches } from ${JSON.stringify(pathToFileURL(path.join(here, 'patches.mjs')).href)}`,
    // Ahead of upstream's plugins: the patches are written against the source
    // as it is on disk, not as the React compiler leaves it.
    'export default async (env: any) => {',
    '  const config = await (upstream as any)(env)',
    '  return { ...config, plugins: [cosmoPatches(), ...config.plugins] }',
    '}',
    '',
  ].join('\n'));
  try {
    execFileSync(process.execPath, [vite, 'build', '--config', config, '--outDir', out, '--emptyOutDir'], { cwd: desktop, stdio: 'inherit' });
  } finally {
    fs.rmSync(config, { force: true });
  }
}

// Our own files live under cosmo/, apart from the renderer's.
const own = path.join(out, 'cosmo');
fs.mkdirSync(own, { recursive: true });
for (const name of ['bridge.js', 'touch.js', 'cosmo.css']) fs.copyFileSync(path.join(here, 'shim', name), path.join(own, name));

// Each step leaves an index.html it has already been through alone, so
// --skip-build can be run over an earlier build.
const indexPath = path.join(out, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/, '<title>Cosmo</title>');

// The bridge goes in ahead of the application bundle: it must exist before the
// first import runs.
if (!html.includes('cosmo/bridge.js')) {
  const entry = html.indexOf('<script type="module"');
  if (entry < 0) throw new Error('the renderer entry script was not found in index.html');
  html = `${html.slice(0, entry)}<script src="./cosmo/bridge.js"></script>\n    ${html.slice(entry)}`;
}

// Our stylesheet goes last in the head, after the renderer's, so that at equal
// specificity ours is the one that holds.
if (!html.includes('cosmo/cosmo.css')) {
  if (!html.includes('</head>')) throw new Error('index.html has no </head>');
  html = html.replace('</head>', '  <link rel="stylesheet" href="./cosmo/cosmo.css">\n  </head>');
}
if (!html.includes('cosmo/touch.js')) {
  html = html.replace('</head>', '  <script src="./cosmo/touch.js" defer></script>\n  </head>');
}

// The renderer was written for a window: tell a phone to lay the page out to
// the edges of the screen and to shrink it, not cover it, when the keyboard opens.
const viewport = 'width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content';
if (!/<meta name="viewport"[^>]*>/.test(html)) throw new Error('index.html has no viewport meta');
html = html.replace(/<meta name="viewport"[^>]*>/, `<meta name="viewport" content="${viewport}">`);

fs.writeFileSync(indexPath, html);

const sourceRecord = path.join(upstream, 'HHIKR_SOURCE.json');
const commit = fs.existsSync(sourceRecord)
  ? JSON.parse(fs.readFileSync(sourceRecord, 'utf8')).upstreamCommit
  : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(own, 'build.json'), `${JSON.stringify({ hermesCommit: commit, builtAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Cosmo web build ready in ${out} (Hermes ${commit.slice(0, 12)})`);
