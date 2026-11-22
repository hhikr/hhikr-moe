// The Java side of the judge: one warm compiler process, and a sandboxed JVM per program run.
//
// Sandbox (HOT100_SANDBOX=bwrap, production): bubblewrap with every namespace unshared (no network,
// own PID/IPC/UTS), nobody's uid, a read-only view of /usr and the program's class files, an empty
// /tmp and no environment. Memory and process limits come from the service's systemd unit.
// Without bwrap (development) the JVM runs directly.

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProgram, parseDiagnostics, parseRun } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const LIBRARY_SOURCES = [join(here, '..', 'hot100-java', 'LessonIO.java'), join(here, 'java', 'Hot100Run.java')];

const decode = (s) => Buffer.from(s || '', 'base64').toString('utf8');

export function javaBinary(env = process.env, name = 'java') {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return env.JAVA_HOME ? join(env.JAVA_HOME, 'bin', name + ext) : name;
}

/** The warm javac. compile(folder) resolves to {ok, listing}. Requests are answered in order. */
export class Compiler {
  constructor({ java = javaBinary(), work, timeout = 15000 } = {}) {
    this.java = java; this.work = work; this.timeout = timeout; this.library = join(work, 'lib');
    this.pending = []; this.child = null; this.ready = null;
  }

  start() {
    if (this.ready) return this.ready;
    const child = spawn(this.java, [
      '-Xmx192m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-XX:-UsePerfData', '-Xshare:auto',
      '-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-Dstderr.encoding=UTF-8',
      join(here, 'java', 'Hot100Compiler.java'), this.library, ...LIBRARY_SOURCES,
    ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.child = child;
    let buffer = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c) => { stderr = (stderr + c).slice(-4000); });
    this.ready = new Promise((resolveReady, rejectReady) => {
      child.stdout.on('data', (chunk) => {
        buffer += chunk;
        for (let i; (i = buffer.indexOf('\n')) >= 0;) {
          const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
          if (line === 'READY') { resolveReady(); continue; }
          const job = this.pending.shift();
          if (!job) continue;
          clearTimeout(job.timer);
          const [kind, payload] = line.split(' ');
          job.resolve({ ok: kind === 'OK', listing: decode(payload) });
        }
      });
      const fail = (why) => {
        rejectReady(new Error(`Java 编译服务没有启动：${why}\n${stderr}`));
        for (const job of this.pending.splice(0)) { clearTimeout(job.timer); job.reject(new Error(`Java 编译服务退出：${why}`)); }
        if (this.child === child) { this.child = null; this.ready = null; }
      };
      child.on('error', (e) => fail(e.message));
      child.on('exit', (code, signal) => fail(signal || `退出码 ${code}`));
    });
    this.ready.catch(() => {});
    return this.ready;
  }

  async compile(folder) {
    await this.start();
    return new Promise((resolveJob, reject) => {
      const job = { resolve: resolveJob, reject };
      job.timer = setTimeout(() => { reject(new Error('编译超时。')); this.restart(); }, this.timeout);
      this.pending.push(job);
      this.child.stdin.write(`${folder}\n`);
    });
  }

  restart() { const c = this.child; this.child = null; this.ready = null; c?.kill('SIGKILL'); }
  close() { this.child?.kill(); }
}

/** Run a spawned process with a wall-clock limit and an output cap. */
export function execute(command, args, { cwd, timeout, limit = 256 * 1024 } = {}) {
  return new Promise((done) => {
    let stdout = '', stderr = '', bytes = 0, reason = '';
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: { PATH: process.env.PATH || '/usr/bin' } });
    const stop = (why) => { if (!reason) { reason = why; child.kill('SIGKILL'); } };
    const timer = setTimeout(() => stop('timeout'), timeout);
    const take = (chunk, err) => {
      bytes += chunk.length;
      if (bytes > limit) return stop('output');
      if (err) stderr += chunk; else stdout += chunk;
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => take(c, false));
    child.stderr.on('data', (c) => take(c, true));
    child.on('error', (e) => { stderr += e.message; });
    child.on('close', (code) => { clearTimeout(timer); done({ stdout, stderr, code, reason }); });
  });
}

const JVM = ['-Xmx192m', '-Xss64m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-XX:MaxMetaspaceSize=96m', '-XX:ReservedCodeCacheSize=32m', '-XX:-UsePerfData', '-XX:ActiveProcessorCount=1', '-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8'];

/** Command line that runs class Hot100Judge from `classes` (+ the library). */
export function runCommand({ sandbox, java, classes, library }) {
  if (sandbox === 'bwrap') {
    return ['bwrap', [
      '--ro-bind', '/usr', '/usr', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64', '--symlink', 'usr/bin', '/bin',
      '--ro-bind-try', '/etc/java-25-openjdk', '/etc/java-25-openjdk', '--ro-bind-try', '/etc/alternatives', '/etc/alternatives',
      '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
      '--ro-bind', classes, '/work', '--ro-bind', library, '/hot100',
      '--chdir', '/work', '--unshare-all', '--die-with-parent', '--new-session', '--uid', '65534', '--gid', '65534',
      '--clearenv', '--setenv', 'PATH', '/usr/bin', '--',
      java, ...JVM, '-cp', '/work:/hot100', 'Hot100Judge',
    ]];
  }
  return [java, [...JVM, '-cp', [classes, library].join(process.platform === 'win32' ? ';' : ':'), 'Hot100Judge']];
}

/**
 * Compile and run a reader's code on the inputs.
 * Resolves to {kind:'compile', diagnostics} or {kind:'run', results: Map, extra, reason, stderr}.
 */
export async function runProgram({ compiler, lesson, code, inputs, sandbox, java = javaBinary(), timeout = 4000 }) {
  const base = join(compiler.work, 'runs');
  await mkdir(base, { recursive: true });
  const folder = await mkdtemp(join(base, 'r-'));
  try {
    await writeFile(join(folder, 'Main.java'), buildProgram(lesson, code, inputs), 'utf8');
    const compiled = await compiler.compile(folder);
    if (!compiled.ok) return { kind: 'compile', diagnostics: parseDiagnostics(compiled.listing, code) };
    const [command, args] = runCommand({ sandbox, java: sandbox === 'bwrap' ? '/usr/bin/java' : java, classes: join(folder, 'out'), library: compiler.library });
    const run = await execute(command, args, { cwd: folder, timeout });
    const { results, extra } = parseRun(run.stdout);
    return { kind: 'run', results, extra, reason: run.reason, code: run.code, stderr: run.stderr.slice(-2000) };
  } finally {
    if (resolve(folder).startsWith(resolve(base) + sep)) await rm(folder, { recursive: true, force: true });
  }
}

export async function workFolder(env = process.env) {
  return env.HOT100_WORK || mkdtemp(join(tmpdir(), 'hot100-judge-'));
}
