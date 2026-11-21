// Demo input the way a person would type it: "2 7 11 15" rather than {"nums":[2,7,11,15]}.
// Every lesson's parameters are read from its sample, one field per parameter; the fields are
// turned back into the JSON object that lesson.trace() expects.

const NULLS = new Set(['null', 'none', 'nil', '#', '-', '空']);
const TRUE = new Set(['true', 't', 'yes', 'y', '1', '是', '对', '真']);
const FALSE = new Set(['false', 'f', 'no', 'n', '0', '否', '错', '假']);

const HINTS = {
  int: '一个整数',
  text: '直接输入，不用加引号',
  bool: 'true 或 false',
  ints: '整数，用空格或逗号隔开',
  'nullable-ints': '按层序列出节点，空位写 null',
  words: '用空格或逗号隔开',
  rows: '每行一组，数字用空格或逗号隔开',
  'nullable-rows': '每行一个节点：值 随机指针指向的下标，没有就写 null',
  grid: '每行一行字母，例如 ABCE',
  'word-rows': '每行一组，用空格或逗号隔开',
  ops: '每行一个操作，操作名后面跟参数，例如 put 1 1',
  values: '用空格或逗号隔开，没有返回值的位置写 null',
};
const MULTILINE = new Set(['rows', 'nullable-rows', 'grid', 'word-rows', 'ops']);

/** The kind of field that fits a sample value. */
export function kindOf(value, key = '') {
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'values';
  if (typeof value === 'string') return 'text';
  if (typeof value === 'boolean') return 'bool';
  if (!Array.isArray(value)) return 'json';
  const items = value.filter((x) => x !== null);
  if (items.some(Array.isArray)) {
    const inner = items.flat();
    if (inner.some((x) => typeof x === 'string')) return key !== 'expected' && items.every((row) => row.every((x) => typeof x === 'string' && x.length === 1)) ? 'grid' : 'word-rows';
    return inner.some((x) => x === null) ? 'nullable-rows' : 'rows';
  }
  if (items.some((x) => typeof x === 'boolean' || (typeof x === 'number' && !Number.isInteger(x)))) return 'values';
  if (items.some((x) => typeof x === 'string')) return items.every((x) => typeof x === 'string') && items.length === value.length ? 'words' : 'values';
  if (value.length !== items.length || key === 'root') return 'nullable-ints';
  return 'ints';
}

/** One field per parameter of the lesson's demo. Design problems (ops + args) become one field. */
export function fieldsFor(lesson) {
  const sample = lesson.sample || JSON.parse(lesson.raw);
  const keys = Object.keys(sample);
  if (keys.includes('ops') && keys.includes('args')) {
    const example = sample.ops.length > 1 ? formatOps(sample.ops.slice(1, 2), sample.args.slice(1, 2)) : 'put 1 1';
    return [{ key: 'ops', keys: ['ops', 'args'], label: '操作序列', kind: 'ops', hint: `每行一个操作，操作名后面跟参数，例如 ${example}`, multiline: true }];
  }
  return keys.map((key) => {
    const kind = kindOf(sample[key], key);
    return { key, keys: [key], label: key, kind, hint: HINTS[kind] || '', multiline: MULTILINE.has(kind) };
  });
}

/** The optional "what do you expect" field, shaped like the lesson's own answer. */
export function expectedField(lesson) {
  const kind = lesson.mode === 'cache' || /ops/.test(lesson.raw) ? 'values' : kindOf(lesson.expected, 'expected');
  const finalKind = kind === 'grid' ? 'word-rows' : kind;
  return { key: 'expected', label: '你认为结果是', kind: finalKind, hint: `可选 · ${HINTS[finalKind] || ''}`, multiline: MULTILINE.has(finalKind) };
}

// ---------------------------------------------------------------------------- formatting

// A string is written bare unless reading it back would give something else (a number, null, a split).
const looksSpecial = (v) => NULLS.has(v.toLowerCase()) || /^(true|false)$/i.test(v) || /^[-+]?\d+(\.\d+)?$/.test(v);
const scalar = (v) => (v === null ? 'null' : typeof v === 'string' ? (/^[^\s,，、;；|"'()\[\]]+$/.test(v) && !looksSpecial(v) ? v : JSON.stringify(v)) : String(v));
const list = (values) => values.map(scalar).join(', ');

/** Text a person would write for this value. */
export function formatValue(kind, value) {
  switch (kind) {
    case 'int': case 'bool': return String(value);
    case 'text': return value === '' || value !== value.trim() || /^["']|["']$/.test(value) ? JSON.stringify(value) : value;
    case 'ints': case 'nullable-ints': case 'words': case 'values': return list(value);
    // Rows are written like a matrix: "1 2 3" per line.
    case 'rows': case 'nullable-rows': case 'word-rows': return value.map((row) => (row.length ? row.map(scalar).join(' ') : '[]')).join('\n');
    case 'grid': return value.map((row) => row.join('')).join('\n');
    default: return JSON.stringify(value);
  }
}

/** Format all fields of a lesson from a JSON input object. */
export function formatFields(lesson, input) {
  return Object.fromEntries(fieldsFor(lesson).map((field) => [field.key, field.kind === 'ops' ? formatOps(input.ops, input.args) : formatValue(field.kind, input[field.key])]));
}

/** The example input shown with the problem. Design problems read better as one operation per line. */
export function exampleText(lesson) {
  const sample = lesson.sample || JSON.parse(lesson.raw);
  return sample.ops && sample.args ? formatOps(sample.ops, sample.args) : lesson.input;
}

function formatOps(ops, args) {
  return ops.map((op, i) => [op, ...(args[i] || []).map(scalar)].join(' ')).join('\n');
}

// ---------------------------------------------------------------------------- parsing

class InputError extends Error {}
const fail = (message) => { throw new InputError(message); };

/** Split "1, 2 3，4" or "[1,2,3]" into tokens; quoted strings stay whole. */
export function tokens(text) {
  let body = text.trim();
  if (/^\[[\s\S]*\]$/.test(body) && !/^\[\s*\[/.test(body)) body = body.slice(1, -1);
  const out = [];
  for (const m of body.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|[^\s,，、;；]+/g)) {
    out.push(m[1] !== undefined ? { quoted: true, text: JSON.parse(`"${m[1]}"`) } : m[2] !== undefined ? { quoted: true, text: m[2] } : { quoted: false, text: m[0] });
  }
  return out;
}

function toInt(token, where) {
  const t = token.text.replace(/^\+/, '');
  if (token.quoted || !/^-?\d+$/.test(t)) fail(`${where}“${token.text}”不是整数`);
  return Number(t);
}

function toValue(token) {
  if (token.quoted) return token.text;
  const t = token.text.toLowerCase();
  if (NULLS.has(t)) return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^[-+]?\d+(\.\d+)?$/.test(t)) return Number(t);
  return token.text;
}

const ordinal = (i) => `第 ${i + 1} 个值`;

function lines(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // A single line may use ";" or "|" between rows: "1 3; 2 6".
  const parts = trimmed.includes('\n') ? trimmed.split(/\r?\n/) : trimmed.split(/[;；|]/);
  return parts.map((line) => line.trim()).filter((line) => line !== '');
}

const isEmptyRow = (line) => /^(\[\s*\]|空|-)$/.test(line);

/** Parse what a person typed into a value of the given kind. Throws with a message naming the problem. */
export function parseValue(kind, text, name = '') {
  const label = name ? `${name}：` : '';
  const raw = String(text ?? '');
  // Pasted JSON is always welcome.
  const trimmed = raw.trim();
  if (/^[\[{"]/.test(trimmed) && kind !== 'text') {
    try { return checkShape(kind, JSON.parse(trimmed), label); } catch (e) { if (e instanceof InputError) throw e; }
  }
  switch (kind) {
    case 'int': {
      const t = tokens(raw);
      if (t.length !== 1) fail(`${label}需要一个整数`);
      return toInt(t[0], label);
    }
    case 'text': {
      const m = trimmed.match(/^"((?:[^"\\]|\\.)*)"$|^'([^']*)'$/);
      if (m) return m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2];
      return trimmed;
    }
    case 'bool': {
      const t = trimmed.toLowerCase();
      if (TRUE.has(t)) return true;
      if (FALSE.has(t)) return false;
      return fail(`${label}请写 true 或 false`);
    }
    case 'ints': return tokens(raw).map((t, i) => toInt(t, `${label}${ordinal(i)}`));
    case 'nullable-ints': return tokens(raw).map((t, i) => (!t.quoted && NULLS.has(t.text.toLowerCase()) ? null : toInt(t, `${label}${ordinal(i)}`)));
    case 'words': return tokens(raw).map((t) => t.text);
    case 'values': return tokens(raw).map(toValue);
    case 'rows': case 'nullable-rows': case 'word-rows': case 'grid':
      return lines(raw).map((line, r) => {
        if (isEmptyRow(line)) return [];
        const where = `${label}第 ${r + 1} 行`;
        if (kind === 'grid') {
          const parts = tokens(line);
          const cells = parts.length === 1 && !parts[0].quoted ? [...parts[0].text] : parts.map((t) => t.text);
          if (cells.some((c) => c.length !== 1)) fail(`${where}每格只能是一个字符`);
          return cells;
        }
        if (kind === 'word-rows') return tokens(line).map((t) => t.text);
        return tokens(line).map((t, i) => (kind === 'nullable-rows' && !t.quoted && NULLS.has(t.text.toLowerCase()) ? null : toInt(t, `${where}${ordinal(i)}`)));
      });
    case 'ops': {
      const ops = [], args = [];
      for (const [r, line] of lines(raw).entries()) {
        const parts = tokens(line.replace(/[()]/g, ' '));
        if (!parts.length) continue;
        if (parts[0].quoted || !/^[A-Za-z_]\w*$/.test(parts[0].text)) fail(`${label}第 ${r + 1} 行应以操作名开头，例如 put 1 1`);
        ops.push(parts[0].text);
        args.push(parts.slice(1).map(toValue));
      }
      return { ops, args };
    }
    default: {
      try { return JSON.parse(trimmed); } catch { return fail(`${label}无法识别这个值`); }
    }
  }
}

function checkShape(kind, value, label) {
  const ok = {
    int: Number.isInteger(value),
    bool: typeof value === 'boolean',
    ints: Array.isArray(value) && value.every(Number.isInteger),
    'nullable-ints': Array.isArray(value) && value.every((v) => v === null || Number.isInteger(v)),
    words: Array.isArray(value) && value.every((v) => typeof v === 'string'),
    values: Array.isArray(value),
    rows: Array.isArray(value) && value.every((r) => Array.isArray(r) && r.every(Number.isInteger)),
    'nullable-rows': Array.isArray(value) && value.every((r) => Array.isArray(r) && r.every((v) => v === null || Number.isInteger(v))),
    'word-rows': Array.isArray(value) && value.every((r) => Array.isArray(r) && r.every((v) => typeof v === 'string')),
    grid: Array.isArray(value) && value.every((r) => Array.isArray(r) && r.every((v) => typeof v === 'string' && v.length === 1)),
    ops: value && Array.isArray(value.ops) && Array.isArray(value.args),
  }[kind];
  if (ok === false) fail(`${label}格式不对，${HINTS[kind] || ''}`);
  return value;
}

/** Turn the field texts into the JSON string lesson.trace() reads. */
export function toRaw(lesson, texts) {
  const input = {};
  for (const field of fieldsFor(lesson)) {
    const value = parseValue(field.kind, texts[field.key] ?? '', field.label);
    if (field.kind === 'ops') Object.assign(input, value);
    else input[field.key] = value;
  }
  return JSON.stringify(input);
}

/** "nums = [2,7,11,15], target = 9" as copied from LeetCode: one text per parameter, or null. */
export function splitAssignments(text, keys) {
  const found = [...String(text).matchAll(/(?<![\w$])([A-Za-z_]\w*)\s*=(?!=)/g)].filter((m) => keys.includes(m[1]));
  if (!found.length) return null;
  const out = {};
  found.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < found.length ? found[i + 1].index : text.length;
    out[m[1]] = text.slice(start, end).trim().replace(/[,，;；]$/, '').trim();
  });
  return out;
}

export { InputError };
