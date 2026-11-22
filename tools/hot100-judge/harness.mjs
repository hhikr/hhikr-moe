// Builds the Java file that runs a reader's Solution on a list of test inputs, and reads back
// what that program printed.
//
// The reader's code goes first, unchanged line for line, so compiler and runtime line numbers are
// the editor's line numbers. Common imports are put in front of the first line rather than above
// it, and the harness class (Hot100Judge) is appended after the reader's code.

import { javaCase } from './javagen.mjs';

export const PRELUDE = 'import java.util.*;import java.util.function.*;import java.util.stream.*;';

/** Top-level `public class Solution` would have to live in Solution.java; drop that `public`. */
export function readerSource(code) {
  return String(code)
    .replace(/\r\n?/g, '\n')
    .replace(/^package\s+[\w.]+\s*;/m, (m) => ' '.repeat(m.length))
    .replace(/^public(\s+(?:final\s+|abstract\s+)?(?:class|interface|enum|record)\s+(?!Main\b)\w)/gm, '      $1');
}

/** Java source for one program that runs every given input in order. */
export function buildProgram(lesson, code, inputs) {
  const methods = inputs.map((input, i) => {
    const { setup, statement, expr } = javaCase(lesson, input);
    const body = [setup, statement && `${statement};`, `return ${expr};`].filter(Boolean).join(' ');
    return `    static void case${i}() { Hot100Run.run(${i}, () -> { ${body} }); }`;
  });
  return `${PRELUDE}${readerSource(code)}\n\nfinal class Hot100Judge {\n${methods.join('\n')}\n    public static void main(String[] args) {\n${inputs.map((_, i) => `        case${i}();`).join('\n')}\n    }\n}\n`;
}

const decode = (s) => Buffer.from(s || '', 'base64').toString('utf8');

/** Parse the harness lines; anything else the JVM printed (crash reports) is returned as `extra`. */
export function parseRun(stdout) {
  const results = new Map(), extra = [];
  for (const line of String(stdout).split('\n')) {
    const m = line.match(/^@@H100 (\d+) (ok|error) (\d+) (\S*) ?(\S*)$/);
    if (m) results.set(Number(m[1]), { status: m[2], micros: Number(m[3]), value: decode(m[4]), printed: decode(m[5]) });
    else if (line.trim()) extra.push(line);
  }
  return { results, extra: extra.join('\n') };
}

/** Compiler error listing (see Hot100Compiler) → [{line, column, message}] in editor coordinates. */
export function parseDiagnostics(listing, code) {
  const lines = String(code).replace(/\r\n?/g, '\n').split('\n').length;
  return String(listing).split('\n').filter(Boolean).map((row) => {
    const [line, column, ...rest] = row.split('\t');
    let l = Number(line), c = Number(column);
    if (l === 1) c = Math.max(1, c - PRELUDE.length);
    const message = rest.join('\t').replaceAll('\u0001', '\n');
    // Errors inside the harness mean the reader changed the method the judge calls.
    if (l > lines) return { line: 1, column: 1, message: `判题代码无法调用你的解法（方法名、参数或返回类型可能被改动）：\n${message}`, harness: true };
    return { line: l, column: c, message };
  });
}
