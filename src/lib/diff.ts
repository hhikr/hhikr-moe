// Line-by-line comparison of two texts, with the changed characters marked
// inside lines that were edited rather than replaced. Used by the editor to
// show what differs between two versions of a post.

export type Op = 'same' | 'del' | 'add';

export interface Part {
  op: Op;
  text: string;
}

export interface DiffLine {
  op: Op;
  text: string;
  /** Line number in the old text (absent for added lines). */
  before?: number;
  /** Line number in the new text (absent for removed lines). */
  after?: number;
  /** For an edited line: its pieces, so the changed characters can be marked. */
  parts?: Part[];
}

/** Beyond this many differences the middle is reported as replaced wholesale. */
const MAX_DISTANCE = 2000;

/**
 * Shortest edit script between two sequences (Myers' algorithm). Returns one
 * op per step: 'same' consumes an item of both, 'del' one of `a`, 'add' one of `b`.
 */
function editScript<T>(a: T[], b: T[], maxDistance = MAX_DISTANCE): Op[] | undefined {
  const n = a.length;
  const m = b.length;
  const limit = Math.min(n + m, maxDistance);
  // furthest[k + offset] is the furthest x reached on diagonal k (= x - y).
  const offset = limit + 1;
  const furthest = new Int32Array(2 * limit + 3);
  const history: Int32Array[] = [];

  for (let d = 0; d <= limit; d++) {
    history.push(furthest.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && furthest[offset + k - 1] < furthest[offset + k + 1]);
      let x = down ? furthest[offset + k + 1] : furthest[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      furthest[offset + k] = x;
      if (x >= n && y >= m) return backtrack(history, d, n, m);
    }
  }
  return undefined;
}

function backtrack(history: Int32Array[], distance: number, n: number, m: number): Op[] {
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = distance; d > 0; d--) {
    // history[d] holds diagonals -d-1 … d+1 as they were before step d.
    const row = history[d];
    const at = (k: number) => row[k + d + 1];
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const prevK = down ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push('same');
      x--;
      y--;
    }
    ops.push(down ? 'add' : 'del');
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    ops.push('same');
    x--;
    y--;
  }
  return ops.reverse();
}

/** Compare two sequences, skipping what they share at both ends first. */
function compare<T>(a: T[], b: T[], maxDistance?: number): Op[] {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const middle: Op[] = editScript(midA, midB, maxDistance) ?? [...midA.map((): Op => 'del'), ...midB.map((): Op => 'add')];
  return [...Array<Op>(head).fill('same'), ...middle, ...Array<Op>(tail).fill('same')];
}

/** The pieces of an edited line, or undefined when the two lines have too little in common to be worth marking. */
function partsOf(before: string, after: string): [Part[], Part[]] | undefined {
  const a = [...before];
  const b = [...after];
  if (a.length + b.length > 4000) return undefined;
  const ops = compare(a, b, 600);
  const shared = ops.filter((op) => op === 'same').length;
  if (shared < Math.max(a.length, b.length) * 0.4) return undefined;

  const left: Part[] = [];
  const right: Part[] = [];
  const push = (list: Part[], op: Op, ch: string) => {
    const last = list.at(-1);
    if (last?.op === op) last.text += ch;
    else list.push({ op, text: ch });
  };
  let i = 0;
  let j = 0;
  for (const op of ops) {
    if (op === 'same') {
      push(left, 'same', a[i++]);
      push(right, 'same', b[j++]);
    } else if (op === 'del') push(left, 'del', a[i++]);
    else push(right, 'add', b[j++]);
  }
  return [left, right];
}

const linesOf = (text: string) => (text === '' ? [] : text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n'));

export function diffLines(before: string, after: string): DiffLine[] {
  const a = linesOf(before);
  const b = linesOf(after);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  for (const op of compare(a, b)) {
    if (op === 'same') out.push({ op, text: a[i], before: ++i, after: ++j });
    else if (op === 'del') out.push({ op, text: a[i], before: ++i });
    else out.push({ op, text: b[j], after: ++j });
  }

  // Put each run of changes in order (removed lines, then added ones) and
  // pair them up to mark the characters that changed within a line.
  for (let start = 0; start < out.length; ) {
    if (out[start].op === 'same') {
      start++;
      continue;
    }
    let end = start;
    while (end < out.length && out[end].op !== 'same') end++;
    const run = out.slice(start, end);
    const removed = run.filter((l) => l.op === 'del');
    const added = run.filter((l) => l.op === 'add');
    for (let p = 0; p < Math.min(removed.length, added.length); p++) {
      const parts = partsOf(removed[p].text, added[p].text);
      if (parts) [removed[p].parts, added[p].parts] = parts;
    }
    out.splice(start, run.length, ...removed, ...added);
    start = end;
  }
  return out;
}

export const diffStats = (lines: DiffLine[]) => ({
  added: lines.filter((l) => l.op === 'add').length,
  removed: lines.filter((l) => l.op === 'del').length,
});

/**
 * The changed lines with a few unchanged ones around them. A number in the
 * result stands for that many unchanged lines left out.
 */
export function withContext(lines: DiffLine[], context = 3): (DiffLine | number)[] {
  const keep = new Uint8Array(lines.length);
  lines.forEach((line, at) => {
    if (line.op === 'same') return;
    for (let k = Math.max(0, at - context); k <= Math.min(lines.length - 1, at + context); k++) keep[k] = 1;
  });
  const out: (DiffLine | number)[] = [];
  let skipped = 0;
  lines.forEach((line, at) => {
    if (!keep[at]) return void skipped++;
    if (skipped) out.push(skipped);
    skipped = 0;
    out.push(line);
  });
  if (skipped) out.push(skipped);
  return out;
}
