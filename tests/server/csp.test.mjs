// The content security policy, and the rules the pages must keep for it to hold.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const { CSP_HEADER, CSP_META, THEME_SCRIPT } = await import('../../src/lib/csp.ts');

const directive = (policy, name) => policy.split('; ').find((d) => d.startsWith(`${name} `))?.split(' ').slice(1);

function sources(dir, extensions) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'content' ? [] : sources(full, extensions);
    return extensions.includes(path.extname(entry.name)) ? [full] : [];
  });
}

test('scripts run only from our own files, plus the one inline script named by its hash', () => {
  const scripts = directive(CSP_HEADER, 'script-src');
  const hash = `'sha256-${crypto.createHash('sha256').update(THEME_SCRIPT).digest('base64')}'`;
  assert.deepEqual(scripts, ["'self'", "'wasm-unsafe-eval'", hash]);
  for (const loose of ["'unsafe-inline'", "'unsafe-eval'", 'https:', 'http:', 'data:', '*']) assert.ok(!scripts.includes(loose), loose);
});

test('the fallbacks are closed', () => {
  assert.deepEqual(directive(CSP_HEADER, 'default-src'), ["'self'"]);
  assert.deepEqual(directive(CSP_HEADER, 'object-src'), ["'none'"]);
  assert.deepEqual(directive(CSP_HEADER, 'base-uri'), ["'self'"]);
  assert.deepEqual(directive(CSP_HEADER, 'form-action'), ["'self'"]);
  assert.deepEqual(directive(CSP_HEADER, 'frame-ancestors'), ["'none'"]);
});

test('the meta tag carries the same policy, minus what only a header can say', () => {
  assert.equal(directive(CSP_META, 'frame-ancestors'), undefined);
  assert.equal(CSP_HEADER, `${CSP_META}; frame-ancestors 'none'`);
});

test('no page brings an inline script or event handler of its own', () => {
  const offenders = [];
  for (const file of sources('src', ['.astro'])) {
    const text = fs.readFileSync(file, 'utf8');
    const template = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').replace(/<style[\s\S]*?<\/style>/g, '');
    // `is:inline` scripts are written into the page as they are; only ones that load a file are fine.
    for (const tag of template.match(/<script\b[^>]*\bis:inline\b[^>]*>/g) ?? []) {
      if (!/\bsrc=/.test(tag) && !tag.includes('set:html={THEME_SCRIPT}')) offenders.push(`${file}: ${tag}`);
    }
    for (const attr of template.match(/\son(?:click|submit|load|error|change|input|key\w+|mouse\w+|focus|blur)=/g) ?? []) offenders.push(`${file}:${attr}`);
    if (/href=["']javascript:/.test(template)) offenders.push(`${file}: javascript: link`);
  }
  assert.deepEqual(offenders, []);
});

test('our own scripts never build code from strings', () => {
  const offenders = sources('src', ['.ts', '.mjs', '.astro']).filter((file) => /\beval\(|new Function\(/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});
