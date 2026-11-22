// IntelliSense for the practice editor: one Eclipse JDT Language Server shared by every reader.
//
// Each reader (a random session id kept in their tab) gets a folder of their own in the language
// server's workspace: a tiny Eclipse project holding Solution.java and the LessonIO helpers, so
// ListNode and TreeNode resolve. Requests carry the whole editor text; the document is updated
// when it changed. Sessions idle for 15 minutes, or beyond the cap, are closed and deleted.
//
// The reader's text is analysed as the judge compiles it: the judge's imports are put in front
// of the first line (so line numbers match) and top-level `public` is blanked out. Positions on
// the first line are shifted by the prefix length in both directions.

import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PRELUDE, readerSource } from './harness.mjs';
import { LIBRARY_SOURCES } from './java.mjs';

export const SESSION_ID = /^[a-f0-9]{24}$/;
const IDLE_MS = 15 * 60 * 1000;

/** The text JDT analyses, and the column shift on line 0. */
export function analysedText(code) {
  return PRELUDE + readerSource(code).replace(/^public(\s+(?:final\s+|abstract\s+)?(?:class|interface|enum|record)\s)/gm, '      $1');
}
const SHIFT = PRELUDE.length;
const toServer = (pos) => ({ line: pos.line, character: pos.line === 0 ? pos.character + SHIFT : pos.character });
/** A server position back in the reader's text; null when it falls inside the prefix. */
const fromServer = (pos) => (pos.line !== 0 ? { ...pos } : pos.character < SHIFT ? null : { line: 0, character: pos.character - SHIFT });
function rangeFromServer(range) {
  const start = fromServer(range.start) || (range.start.line === 0 ? { line: 0, character: 0 } : null), end = fromServer(range.end) || { line: 0, character: 0 };
  return start && { start, end };
}

const project = (name) => `<?xml version="1.0" encoding="UTF-8"?>
<projectDescription><name>${name}</name><comment></comment><projects></projects>
<buildSpec><buildCommand><name>org.eclipse.jdt.core.javabuilder</name><arguments></arguments></buildCommand></buildSpec>
<natures><nature>org.eclipse.jdt.core.javanature</nature></natures></projectDescription>
`;
const CLASSPATH = `<?xml version="1.0" encoding="UTF-8"?>
<classpath><classpathentry kind="src" path=""/><classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER"/><classpathentry kind="output" path=".bin"/></classpath>
`;
const SETTINGS = {
  java: {
    import: { maven: { enabled: false }, gradle: { enabled: false }, exclusions: [] },
    autobuild: { enabled: false },
    completion: { maxResults: 60, importOrder: ['java', 'javax'], postfix: { enabled: true } },
    maven: { downloadSources: false },
    references: { includeDecompiledSources: false },
    signatureHelp: { enabled: true, description: { enabled: true } },
    format: { enabled: true, insertSpaces: true, tabSize: 4 },
    project: { referencedLibraries: [] },
    configuration: { updateBuildConfiguration: 'disabled' },
  },
};

/** JSON-RPC over the server's stdio. */
class Connection {
  constructor(child, onNotification, onRequest) {
    this.child = child; this.next = 1; this.pending = new Map(); this.buffer = Buffer.alloc(0);
    child.stdout.on('data', (chunk) => this.read(chunk));
    this.onNotification = onNotification; this.onRequest = onRequest;
  }
  read(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const head = this.buffer.indexOf('\r\n\r\n');
      if (head < 0) return;
      const length = Number(/content-length:\s*(\d+)/i.exec(this.buffer.subarray(0, head).toString('ascii'))?.[1]);
      if (!Number.isFinite(length)) { this.buffer = this.buffer.subarray(head + 4); continue; } // stray output
      if (this.buffer.length < head + 4 + length) return;
      const body = this.buffer.subarray(head + 4, head + 4 + length).toString('utf8');
      this.buffer = this.buffer.subarray(head + 4 + length);
      let message; try { message = JSON.parse(body); } catch { continue; }
      if (message.method && message.id !== undefined) this.send({ jsonrpc: '2.0', id: message.id, result: this.onRequest(message) ?? null });
      else if (message.method) this.onNotification(message);
      else if (this.pending.has(message.id)) {
        const { resolve, reject, timer } = this.pending.get(message.id);
        clearTimeout(timer); this.pending.delete(message.id);
        if (message.error) reject(Object.assign(new Error(message.error.message), { data: message.error.data })); else resolve(message.result);
      }
    }
  }
  send(message) {
    const body = Buffer.from(JSON.stringify(message), 'utf8');
    this.child.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body]));
  }
  request(method, params, timeout = 8000) {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); this.notify('$/cancelRequest', { id }); reject(Object.assign(new Error('timeout'), { method })); }, timeout);
      this.pending.set(id, { resolve, reject: (e) => reject(Object.assign(e, { method })), timer });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }
  notify(method, params) { this.send({ jsonrpc: '2.0', method, params }); }
  failAll(error) { for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(error); } this.pending.clear(); }
}

export class LanguageService {
  /**
   * @param jdtls   folder of an extracted JDT LS release (plugins/, config_linux/ ...)
   * @param work    a writable folder for the workspace, its metadata and the OSGi configuration
   * @param slots   readers served at once; each is a project created at startup
   */
  constructor({ jdtls, work, java = 'java', slots = 24, perClient = 3, now = () => Date.now() }) {
    Object.assign(this, { jdtls, work, java, perClient, now });
    this.slots = Array.from({ length: slots }, (_, i) => ({ name: `slot${i}`, session: null }));
    this.sessions = new Map(); this.diagnosticWaiters = new Map(); this.state = 'stopped'; this.queue = Promise.resolve();
  }

  async start() {
    if (this.starting) return this.starting;
    this.state = 'starting';
    this.starting = (async () => {
      const ws = join(this.work, 'ws'), config = join(this.work, 'config'), data = join(this.work, 'data');
      await rm(this.work, { recursive: true, force: true });
      await mkdir(ws, { recursive: true });
      const os = process.platform === 'win32' ? 'config_win' : process.platform === 'darwin' ? 'config_mac' : 'config_linux';
      await cp(join(this.jdtls, os), config, { recursive: true });
      const launcher = (await readdir(join(this.jdtls, 'plugins'))).find((f) => /^org\.eclipse\.equinox\.launcher_.*\.jar$/.test(f));
      if (!launcher) throw new Error('JDT LS 不完整：找不到 equinox launcher。');
      const library = splitTypes(await readFile(LIBRARY_SOURCES.find((f) => f.endsWith('LessonIO.java')), 'utf8'));
      // Every slot, and a scratch project for formatting, exist before the server starts, so their
      // projects are imported once at startup instead of while a reader waits.
      const folders = [];
      for (const name of ['fmt', ...this.slots.map((s) => s.name)]) {
        const folder = join(ws, name);
        await mkdir(folder, { recursive: true });
        await writeFile(join(folder, '.project'), project(name));
        await writeFile(join(folder, '.classpath'), CLASSPATH);
        for (const [type, source] of library) await writeFile(join(folder, `${type}.java`), source);
        await writeFile(join(folder, name === 'fmt' ? 'Format.java' : 'Solution.java'), '');
        folders.push({ uri: pathToFileURL(folder).href, name });
      }
      for (const slot of this.slots) slot.uri = pathToFileURL(join(ws, slot.name, 'Solution.java')).href;
      const child = spawn(this.java, [
        '-Declipse.application=org.eclipse.jdt.ls.core.id1', '-Dosgi.bundles.defaultStartLevel=4',
        '-Declipse.product=org.eclipse.jdt.ls.core.product', '-Dlog.level=WARNING',
        '-Xms64m', '-Xmx320m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-XX:ReservedCodeCacheSize=48m', '-XX:MaxMetaspaceSize=192m', '-Xss512k', '-XX:-UsePerfData',
        '--add-modules=ALL-SYSTEM', '--add-opens', 'java.base/java.util=ALL-UNNAMED', '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
        '-jar', join(this.jdtls, 'plugins', launcher), '-configuration', config, '-data', data,
      ], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      this.child = child;
      let ready;
      const serviceReady = new Promise((resolve) => { ready = resolve; });
      this.rpc = new Connection(child, (m) => {
        if (m.method === 'language/status' && m.params?.type === 'ServiceReady') ready();
        this.notification(m);
      }, (m) => (m.method === 'workspace/configuration' ? m.params.items.map(() => SETTINGS.java) : null));
      const exited = new Promise((_, reject) => child.on('exit', (code) => {
        this.state = 'stopped'; this.starting = null; this.sessions.clear();
        for (const slot of this.slots) slot.session = null;
        const error = new Error(`JDT LS 退出（${code}）`); this.rpc.failAll(error); reject(error);
      }));
      exited.catch(() => {});
      await Promise.race([exited, this.rpc.request('initialize', {
        processId: process.pid, rootUri: null, workspaceFolders: folders,
        capabilities: {
          workspace: { workspaceFolders: true, configuration: true, didChangeConfiguration: { dynamicRegistration: false } },
          textDocument: {
            synchronization: { didSave: false },
            completion: { completionItem: { snippetSupport: true, documentationFormat: ['markdown', 'plaintext'], resolveSupport: { properties: ['documentation', 'detail', 'additionalTextEdits'] }, labelDetailsSupport: true }, contextSupport: true },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            signatureHelp: { signatureInformation: { documentationFormat: ['markdown', 'plaintext'], parameterInformation: { labelOffsetSupport: true }, activeParameterSupport: true } },
            publishDiagnostics: { relatedInformation: false, versionSupport: true },
            formatting: {},
          },
        },
        initializationOptions: { settings: SETTINGS, workspaceFolders: folders.map((f) => f.uri), extendedClientCapabilities: { progressReportProvider: false, classFileContentsSupport: false } },
      }, 180000)]);
      this.rpc.notify('initialized', {});
      this.rpc.notify('workspace/didChangeConfiguration', { settings: SETTINGS });
      await Promise.race([exited, serviceReady, new Promise((r) => setTimeout(r, 180000))]);
      this.state = 'ready';
      this.warm = this.warmUp();
      this.timer = setInterval(() => this.sweep(), 60000);
      this.timer.unref?.();
    })();
    this.starting.catch(() => { this.state = 'failed'; });
    return this.starting;
  }

  /**
   * The first hover over a JDK type reads the JDK's src.zip for its Javadoc (about 17 s on the
   * VPS); later ones take milliseconds. Pay that once in the background after startup.
   */
  warmUp() {
    const run = this.queue.then(async () => {
      const uri = pathToFileURL(join(this.work, 'ws', 'fmt', 'Format.java')).href;
      const text = 'import java.util.*;\nclass Warm { Map<Integer, List<String>> m = new HashMap<>(); }\n';
      this.rpc.notify('textDocument/didOpen', { textDocument: { uri, languageId: 'java', version: 1, text } });
      try {
        for (const character of [14, 25]) await this.rpc.request('textDocument/hover', { textDocument: { uri }, position: { line: 1, character } }, 90000).catch(() => {});
        await this.rpc.request('textDocument/completion', { textDocument: { uri }, position: { line: 1, character: 44 } }, 30000).catch(() => {});
      } finally {
        this.rpc.notify('textDocument/didClose', { textDocument: { uri } });
      }
    });
    this.queue = run.catch(() => {});
    return run;
  }

  notification(message) {
    if (message.method !== 'textDocument/publishDiagnostics') return;
    const { uri, diagnostics, version } = message.params;
    const session = this.slots.find((slot) => slot.uri === uri)?.session;
    if (!session) return;
    session.diagnostics = diagnostics; session.diagnosticsVersion = version ?? session.version;
    const waiters = this.diagnosticWaiters.get(uri) || [];
    this.diagnosticWaiters.set(uri, waiters.filter((w) => (version != null && version < w.version) || (w.resolve(), false)));
  }

  /** The reader's session; a new one takes a free slot, or the least recently used one. */
  session(id, client) {
    if (this.state !== 'ready') throw Object.assign(new Error('智能提示正在启动，请稍后。'), { status: 503 });
    let s = this.sessions.get(id);
    if (s) { s.seen = this.now(); return s; }
    const mine = [...this.sessions.values()].filter((x) => x.client === client).sort((a, b) => a.seen - b.seen);
    while (mine.length >= this.perClient) this.close(mine.shift().id);
    let slot = this.slots.find((x) => !x.session);
    if (!slot) { this.close([...this.sessions.values()].sort((a, b) => a.seen - b.seen)[0].id); slot = this.slots.find((x) => !x.session); }
    s = { id, client, slot, uri: slot.uri, version: slot.version || 0, text: null, seen: this.now(), diagnostics: [], diagnosticsVersion: -1 };
    slot.session = s;
    this.sessions.set(id, s);
    return s;
  }

  sync(s, code) {
    const text = analysedText(code);
    if (s.text === text) return false;
    s.version++; s.slot.version = s.version;
    if (s.text === null) this.rpc.notify('textDocument/didOpen', { textDocument: { uri: s.uri, languageId: 'java', version: s.version, text } });
    else this.rpc.notify('textDocument/didChange', { textDocument: { uri: s.uri, version: s.version }, contentChanges: [{ text }] });
    s.text = text;
    return true;
  }

  close(id) {
    const s = this.sessions.get(id);
    if (!s) return;
    this.sessions.delete(id);
    s.slot.session = null;
    if (s.text !== null) this.rpc.notify('textDocument/didClose', { textDocument: { uri: s.uri } });
  }

  sweep() {
    const t = this.now();
    for (const s of [...this.sessions.values()]) if (t - s.seen > IDLE_MS) this.close(s.id);
  }
  // ------------------------------------------------------------------ requests

  async diagnostics({ session, client, code }) {
    const s = await this.session(session, client);
    if (this.sync(s, code) || s.diagnosticsVersion < s.version) {
      await new Promise((resolve) => {
        const waiter = { version: s.version, resolve };
        this.diagnosticWaiters.set(s.uri, [...(this.diagnosticWaiters.get(s.uri) || []), waiter]);
        setTimeout(resolve, 4000);
      });
    }
    return s.diagnostics.map((d) => {
      const range = rangeFromServer(d.range);
      if (!range || (d.range.start.line === 0 && d.range.end.line === 0 && d.range.end.character <= SHIFT)) return null;
      // The judge imports these packages anyway, so the reader's own import of them is never "unused".
      if (/^The import java\.util(\.function|\.stream)? is never used$/.test(d.message)) return null;
      return { range, severity: d.severity || 1, message: d.message, code: d.code };
    }).filter(Boolean);
  }

  async complete({ session, client, code, position, context }) {
    const s = await this.session(session, client);
    this.sync(s, code);
    const result = await this.rpc.request('textDocument/completion', { textDocument: { uri: s.uri }, position: toServer(position), context });
    const items = Array.isArray(result) ? result : result?.items || [];
    return { incomplete: !Array.isArray(result) && !!result?.isIncomplete, items: items.slice(0, 80).map(completionItem).filter(Boolean) };
  }

  async resolve({ item }) {
    if (this.state !== 'ready') throw Object.assign(new Error('智能提示正在启动，请稍后。'), { status: 503 });
    if (!item || typeof item !== 'object') throw Object.assign(new Error('请求格式无效。'), { status: 400 });
    // Only what JDT needs to find the proposal again; the rest of the item stays in the editor.
    const { label, kind, data, sortText, filterText, detail } = item;
    if (!data || typeof data !== 'object') return null;
    // JDT keeps only the proposals of the latest completion request (anyone's), so an older item
    // cannot be resolved any more; that only means no documentation for it.
    const resolved = await this.rpc.request('completionItem/resolve', { label, kind, data, sortText, filterText, detail }).catch((e) => {
      if (e.message === 'timeout') throw e;
      return null;
    });
    if (!resolved) return null;
    return { detail: resolved?.detail, documentation: docText(resolved?.documentation), additionalTextEdits: completionItem(resolved)?.additionalTextEdits };
  }

  async hover({ session, client, code, position }) {
    const s = await this.session(session, client);
    this.sync(s, code);
    const result = await this.rpc.request('textDocument/hover', { textDocument: { uri: s.uri }, position: toServer(position) });
    if (!result) return null;
    const parts = (Array.isArray(result.contents) ? result.contents : [result.contents])
      .map((c) => (typeof c === 'string' ? c : c.language ? `\`\`\`${c.language}\n${c.value}\n\`\`\`` : c.value))
      // "Source: [slot3](file:///…)" names server folders, and the links lead nowhere for the reader.
      .filter((c) => c && !/^Source: /.test(c))
      .map((c) => c.replace(/\]\((?:file|jdt):[^)]*\)/g, ']'));
    return parts.length ? { contents: parts, range: result.range && rangeFromServer(result.range) } : null;
  }

  async signature({ session, client, code, position, context }) {
    const s = await this.session(session, client);
    this.sync(s, code);
    const result = await this.rpc.request('textDocument/signatureHelp', { textDocument: { uri: s.uri }, position: toServer(position), context });
    if (!result?.signatures?.length) return null;
    return {
      activeSignature: result.activeSignature ?? 0,
      activeParameter: result.activeParameter ?? 0,
      signatures: result.signatures.slice(0, 20).map((g) => ({ label: g.label, documentation: docText(g.documentation), parameters: (g.parameters || []).map((p) => ({ label: p.label, documentation: docText(p.documentation) })), activeParameter: g.activeParameter })),
    };
  }

  /** Format the reader's text as is, in the scratch project (one at a time). */
  async format({ code }) {
    if (this.state !== 'ready') throw Object.assign(new Error('智能提示正在启动，请稍后。'), { status: 503 });
    const run = this.queue.then(async () => {
      const uri = pathToFileURL(join(this.work, 'ws', 'fmt', 'Format.java')).href, text = String(code);
      this.rpc.notify('textDocument/didOpen', { textDocument: { uri, languageId: 'java', version: 1, text } });
      try {
        const edits = await this.rpc.request('textDocument/formatting', { textDocument: { uri }, options: { tabSize: 4, insertSpaces: true } });
        return applyEdits(text, edits || []);
      } finally {
        this.rpc.notify('textDocument/didClose', { textDocument: { uri } });
      }
    });
    this.queue = run.catch(() => {});
    return { text: await run };
  }

  stop() { clearInterval(this.timer); try { this.rpc?.notify('exit', null); } catch {} this.child?.kill(); }
}

const docText = (d) => (!d ? undefined : typeof d === 'string' ? d : d.value);

function completionItem(item) {
  if (!item) return null;
  let range, insertText = item.insertText ?? item.label;
  const edit = item.textEdit;
  if (edit) {
    const r = edit.range || edit.replace;
    range = r && rangeFromServer(r);
    if (!range) return null; // completion inside the hidden prefix
    insertText = edit.newText;
  }
  const additional = (item.additionalTextEdits || []).map((e) => {
    // Imports are inserted near the top; anything aimed inside the prefix goes to the start of the text.
    const r = rangeFromServer(e.range) || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
    return { range: r, text: e.newText };
  });
  return {
    label: item.label, labelDetails: item.labelDetails, kind: item.kind, detail: item.detail, documentation: docText(item.documentation),
    sortText: item.sortText, filterText: item.filterText, insertText, snippet: item.insertTextFormat === 2, range,
    additionalTextEdits: additional.length ? additional : undefined, preselect: item.preselect, data: item.data,
    commitCharacters: item.commitCharacters, deprecated: item.tags?.includes(1) || item.deprecated,
  };
}

/**
 * One file per top-level type ([[name, source]]). JDT finds a type in another file of the same
 * package by its file name; ListNode inside LessonIO.java would only be found once indexing ends.
 */
export function splitTypes(source) {
  const text = String(source).replace(/\r\n?/g, '\n');
  const starts = [...text.matchAll(/^(?:public\s+)?(?:final\s+|abstract\s+)?(?:class|interface|enum|record)\s+(\w+)/gm)];
  const imports = text.slice(0, starts[0]?.index ?? 0).trim();
  return starts.map((m, i) => [m[1], `${imports}\n\n${text.slice(m.index, starts[i + 1]?.index ?? text.length).trim()}\n`]);
}

/** Apply LSP text edits (non-overlapping) to a string. */
export function applyEdits(text, edits) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const offset = (p) => Math.min(text.length, (starts[p.line] ?? text.length) + p.character);
  return [...edits].sort((a, b) => offset(b.range.start) - offset(a.range.start))
    .reduce((t, e) => t.slice(0, offset(e.range.start)) + e.newText + t.slice(offset(e.range.end)), text);
}
