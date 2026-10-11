// The content security policy: which sources a page may load scripts, styles,
// images and frames from. It is the second line of defence behind the HTML
// sanitising done for posts and comments — if markup that should have been
// removed ever gets through, the browser still refuses to run it.
import crypto from 'node:crypto';

/**
 * Runs before the first paint so the page never flashes the wrong theme. It is
 * the only inline script on the site; the policy names it by its hash.
 */
export const THEME_SCRIPT = `(() => {
  let pref = 'auto';
  try {
    pref = localStorage.getItem('theme') || 'auto';
  } catch {}
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.themePref = pref;
})();`;

const hashOf = (script: string) => `'sha256-${crypto.createHash('sha256').update(script).digest('base64')}'`;

const DIRECTIVES: [string, string[]][] = [
  ['default-src', ["'self'"]],
  // 'wasm-unsafe-eval' lets the search index (WebAssembly) run; it does not let scripts run code built from strings.
  ['script-src', ["'self'", "'wasm-unsafe-eval'", hashOf(THEME_SCRIPT)]],
  // Highlighted code, formulas and the editor all set styles inline.
  ['style-src', ["'self'", "'unsafe-inline'"]],
  ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
  ['font-src', ["'self'", 'data:']],
  // The Hot 100 pages can talk to the Java runner on the visitor's own machine.
  ['connect-src', ["'self'", 'http://127.0.0.1:*']],
  // Posts embed players from other sites.
  ['frame-src', ["'self'", 'https:']],
  ['media-src', ["'self'", 'blob:', 'https:']],
  ['worker-src', ["'self'", 'blob:']],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'self'"]],
];

const join = (directives: [string, string[]][]) => directives.map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');

/** For the `<meta http-equiv>` tag, which covers pages served as plain files. */
export const CSP_META = join(DIRECTIVES);

/** For the response header. Only a header can forbid other sites from framing ours. */
export const CSP_HEADER = join([...DIRECTIVES, ['frame-ancestors', ["'none'"]]]);
