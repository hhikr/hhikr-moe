// Hidden test cases. Each lesson has a generator of random inputs; the lesson's own trace (the
// step-by-step demo, which validates its input and was checked against real Java on the sample)
// rejects invalid inputs and supplies the expected answer. Inputs whose correct answer is not
// unique (and that judge.mjs cannot compare loosely) are filtered out here.
//
// The seed is fixed, so every server start and every test sees the same cases.

import { lessons } from '../../public/hot100-assets/lessons.mjs';
import { judgeOutput } from '../../public/hot100-assets/judge.mjs';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = (xs) => xs[int(0, xs.length - 1)];
  const ints = (n, lo, hi) => Array.from({ length: n }, () => int(lo, hi));
  const shuffle = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const distinct = (n, lo, hi) => shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, n);
  const sorted = (n, lo, hi) => ints(n, lo, hi).sort((a, b) => a - b);
  const word = (n, alphabet = 'abc') => Array.from({ length: n }, () => pick([...alphabet])).join('');
  const grid = (r, c, values) => Array.from({ length: r }, () => Array.from({ length: c }, () => pick(values)));
  return { next, int, pick, ints, shuffle, distinct, sorted, word, grid };
}

/** Level-order array (LeetCode style, trailing nulls trimmed) of a random binary tree. */
function treeArray(r, n, values) {
  if (!n) return [];
  const nodes = [{ v: values(0) }];
  const slots = [[nodes[0], 'l'], [nodes[0], 'r']];
  for (let i = 1; i < n; i++) {
    const [parent, side] = slots.splice(r.int(0, slots.length - 1), 1)[0];
    const node = { v: values(i) };
    parent[side] = node; nodes.push(node); slots.push([node, 'l'], [node, 'r']);
  }
  return levelOrder(nodes[0]);
}
function levelOrder(root) {
  const out = [], queue = [root];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (!node) { out.push(null); continue; }
    out.push(node.v); queue.push(node.l || null, node.r || null);
  }
  while (out.length && out.at(-1) === null) out.pop();
  return out;
}
function buildTree(values) {
  if (!values.length || values[0] === null) return null;
  const root = { v: values[0] }, queue = [root];
  let i = 1;
  for (let q = 0; q < queue.length && i < values.length; q++) {
    const node = queue[q];
    if (values[i] != null) { node.l = { v: values[i] }; queue.push(node.l); } i++;
    if (i < values.length && values[i] != null) { node.r = { v: values[i] }; queue.push(node.r); } i++;
  }
  return root;
}
function bst(r, n, lo, hi) {
  const keys = r.distinct(n, lo, hi);
  let root = null;
  const insert = (node, v) => { if (!node) return { v }; if (v < node.v) node.l = insert(node.l, v); else node.r = insert(node.r, v); return node; };
  for (const k of keys) root = insert(root, k);
  return root ? levelOrder(root) : [];
}
const count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());

// One generator per lesson: (r, i) => input. `i` (0-based case number) lets early cases be edge cases.
const G = {
  1: (r) => { const n = r.int(2, 8), nums = r.ints(n, -9, 9); const [a, b] = r.distinct(2, 0, n - 1); return { nums, target: nums[a] + nums[b] }; },
  2: (r) => { const num = () => { const n = r.int(1, 6), d = r.ints(n, 0, 9); if (n > 1 && d[n - 1] === 0) d[n - 1] = r.int(1, 9); return d; }; return { l1: num(), l2: num() }; },
  3: (r, i) => ({ s: i === 0 ? '' : r.word(r.int(1, 12), r.pick(['ab', 'abc', 'abcde', 'ab ', 'pwke'])) }),
  4: (r) => { const a = r.sorted(r.int(0, 5), -9, 9), b = r.sorted(a.length ? r.int(0, 5) : r.int(1, 5), -9, 9); return { nums1: a, nums2: b }; },
  5: (r) => ({ s: r.word(r.int(1, 10), r.pick(['ab', 'abc', 'a'])) }),
  11: (r) => ({ height: r.ints(r.int(2, 12), 0, 10) }),
  15: (r) => ({ nums: r.ints(r.int(0, 10), -4, 4) }),
  17: (r, i) => ({ digits: i === 0 ? '' : Array.from({ length: r.int(1, 3) }, () => r.int(2, 9)).join('') }),
  19: (r) => { const n = r.int(1, 8); return { head: r.ints(n, 1, 9), n: r.int(1, n) }; },
  20: (r) => ({ s: r.word(r.int(1, 10), '()[]{}') }),
  21: (r) => ({ list1: r.sorted(r.int(0, 6), -5, 9), list2: r.sorted(r.int(0, 6), -5, 9) }),
  22: (r) => ({ n: r.int(1, 4) }),
  23: (r, i) => ({ lists: i === 0 ? [] : Array.from({ length: r.int(1, 4) }, () => r.sorted(r.int(0, 4), -5, 9)) }),
  24: (r) => ({ head: r.ints(r.int(0, 8), 1, 9) }),
  25: (r) => { const n = r.int(1, 9); return { head: r.ints(n, 1, 9), k: r.int(1, n) }; },
  31: (r) => ({ nums: r.ints(r.int(1, 6), 0, 4) }),
  32: (r, i) => ({ s: i === 0 ? '' : r.word(r.int(1, 14), '()') }),
  33: (r) => { const n = r.int(1, 9), a = r.distinct(n, -9, 20).sort((x, y) => x - y), k = r.int(0, n - 1); return { nums: [...a.slice(k), ...a.slice(0, k)], target: r.next() < 0.7 ? r.pick(a) : r.int(-10, 21) }; },
  34: (r) => { const a = r.sorted(r.int(0, 10), 0, 6); return { nums: a, target: r.int(-1, 7) }; },
  35: (r) => { const a = r.distinct(r.int(1, 8), -9, 12).sort((x, y) => x - y); return { nums: a, target: r.int(-10, 13) }; },
  39: (r) => ({ candidates: r.distinct(r.int(1, 4), 2, 9), target: r.int(1, 12) }),
  41: (r) => ({ nums: r.ints(r.int(1, 10), -3, 10) }),
  42: (r) => ({ height: r.ints(r.int(1, 14), 0, 5) }),
  45: (r) => { const n = r.int(1, 10); return { nums: r.ints(n, 1, 4) }; },
  46: (r) => ({ nums: r.distinct(r.int(1, 4), -5, 9) }),
  48: (r) => { const n = r.int(1, 5); return { matrix: r.grid(n, n, Array.from({ length: 30 }, (_, i) => i - 9)) }; },
  49: (r) => { const base = Array.from({ length: r.int(1, 4) }, () => r.word(r.int(0, 4), 'abcde')); return { strs: Array.from({ length: r.int(1, 7) }, () => r.shuffle([...r.pick(base)]).join('')) }; },
  51: (r) => ({ n: r.int(1, 6) }),
  53: (r) => ({ nums: r.ints(r.int(1, 12), -9, 9) }),
  54: (r) => ({ matrix: r.grid(r.int(1, 5), r.int(1, 5), Array.from({ length: 20 }, (_, i) => i)) }),
  55: (r) => ({ nums: r.ints(r.int(1, 10), 0, 3) }),
  56: (r) => ({ intervals: Array.from({ length: r.int(1, 6) }, () => { const a = r.int(0, 12); return [a, a + r.int(0, 4)]; }) }),
  62: (r) => ({ m: r.int(1, 7), n: r.int(1, 7) }),
  64: (r) => ({ matrix: r.grid(r.int(1, 5), r.int(1, 5), [0, 1, 2, 3, 4, 5, 9]) }),
  70: (r) => ({ n: r.int(1, 20) }),
  72: (r) => ({ word1: r.word(r.int(0, 7), 'abcd'), word2: r.word(r.int(0, 7), 'abcd') }),
  73: (r) => ({ matrix: r.grid(r.int(1, 5), r.int(1, 5), [0, 1, 1, 2, 3, 4, 5, 6]) }),
  74: (r) => { const m = r.int(1, 4), n = r.int(1, 4), a = r.distinct(m * n, 0, 40).sort((x, y) => x - y); return { matrix: Array.from({ length: m }, (_, i) => a.slice(i * n, i * n + n)), target: r.next() < 0.6 ? r.pick(a) : r.int(-1, 41) }; },
  75: (r) => ({ nums: r.ints(r.int(1, 12), 0, 2) }),
  76: (r) => ({ s: r.word(r.int(1, 14), 'ABCD'), t: r.word(r.int(1, 3), 'ABC') }),
  78: (r) => ({ nums: r.distinct(r.int(1, 4), -5, 9) }),
  79: (r) => { const board = r.grid(r.int(1, 3), r.int(1, 4), ['A', 'B', 'C', 'D']); return { board, word: r.word(r.int(1, 5), 'ABCD') }; },
  84: (r) => ({ heights: r.ints(r.int(1, 10), 0, 8) }),
  94: (r) => ({ root: treeArray(r, r.int(0, 8), () => r.int(-9, 9)) }),
  98: (r) => ({ root: r.next() < 0.5 ? bst(r, r.int(1, 8), -9, 9) : treeArray(r, r.int(1, 7), () => r.int(-9, 9)) }),
  101: (r, i) => {
    if (i % 2) return { root: treeArray(r, r.int(1, 7), () => r.int(1, 3)) };
    const half = treeArray(r, r.int(0, 3), () => r.int(1, 4)), t = buildTree(half);
    const mirror = (n) => n && { v: n.v, l: mirror(n.r), r: mirror(n.l) };
    return { root: levelOrder({ v: r.int(1, 4), l: t, r: mirror(t) }) };
  },
  102: (r) => ({ root: treeArray(r, r.int(0, 9), () => r.int(-9, 9)) }),
  104: (r) => ({ root: treeArray(r, r.int(0, 9), () => r.int(-9, 9)) }),
  105: (r) => {
    const t = buildTree(treeArray(r, r.int(1, 8), () => 0));
    const vals = r.distinct(20, -9, 20); let k = 0;
    const label = (n) => { if (n) { n.v = vals[k++]; label(n.l); label(n.r); } }; label(t);
    const pre = [], ino = [];
    const walk = (n) => { if (n) { pre.push(n.v); walk(n.l); walk(n.r); } }; walk(t);
    const inw = (n) => { if (n) { inw(n.l); ino.push(n.v); inw(n.r); } }; inw(t);
    return { preorder: pre, inorder: ino };
  },
  108: (r) => ({ nums: r.distinct(r.int(1, 9), -9, 9).sort((a, b) => a - b) }),
  114: (r) => ({ root: treeArray(r, r.int(0, 8), () => r.int(1, 9)) }),
  118: (r) => ({ numRows: r.int(1, 10) }),
  121: (r) => ({ prices: r.ints(r.int(1, 10), 0, 9) }),
  124: (r) => ({ root: treeArray(r, r.int(1, 8), () => r.int(-9, 9)) }),
  128: (r, i) => ({ nums: i === 0 ? [] : r.ints(r.int(1, 12), -5, 10) }),
  131: (r) => ({ s: r.word(r.int(1, 6), 'ab') }),
  136: (r) => { const pairs = r.distinct(r.int(0, 4), -9, 9), single = r.pick([...Array(30)].map((_, i) => i - 10).filter((x) => !pairs.includes(x))); return { nums: r.shuffle([...pairs, ...pairs, single]) }; },
  138: (r) => { const n = r.int(0, 6); return { head: Array.from({ length: n }, () => [r.int(-9, 9), r.next() < 0.3 ? null : r.int(0, n - 1)]) }; },
  139: (r) => { const dict = [...new Set(Array.from({ length: r.int(1, 4) }, () => r.word(r.int(1, 3), 'ab')))]; const s = r.next() < 0.6 ? Array.from({ length: r.int(1, 4) }, () => r.pick(dict)).join('') : r.word(r.int(1, 8), 'ab'); return { s, wordDict: dict }; },
  141: (r) => { const n = r.int(0, 6); return { head: r.ints(n, -9, 9), pos: n ? r.int(-1, n - 1) : -1 }; },
  142: (r) => { const n = r.int(0, 6); return { head: r.ints(n, -9, 9), pos: n ? r.int(-1, n - 1) : -1 }; },
  146: (r) => {
    const ops = ['LRUCache'], args = [[r.int(1, 3)]];
    for (let i = 0, n = r.int(1, 10); i < n; i++) if (r.next() < 0.5) { ops.push('put'); args.push([r.int(1, 5), r.int(1, 20)]); } else { ops.push('get'); args.push([r.int(1, 5)]); }
    return { ops, args };
  },
  148: (r) => ({ head: r.ints(r.int(0, 10), -9, 9) }),
  152: (r) => ({ nums: r.ints(r.int(1, 10), -4, 4) }),
  153: (r) => { const n = r.int(1, 9), a = r.distinct(n, -9, 20).sort((x, y) => x - y), k = r.int(0, n - 1); return { nums: [...a.slice(k), ...a.slice(0, k)] }; },
  155: (r) => {
    const ops = ['MinStack'], args = [[]]; let size = 0;
    for (let i = 0, n = r.int(1, 10); i < n; i++) {
      const op = size ? r.pick(['push', 'push', 'pop', 'top', 'getMin']) : 'push';
      ops.push(op); args.push(op === 'push' ? [r.int(-5, 5)] : []);
      size += op === 'push' ? 1 : op === 'pop' ? -1 : 0;
    }
    return { ops, args };
  },
  160: (r) => { const common = r.ints(r.int(0, 3), 1, 9), a = r.ints(r.int(0, 3), 1, 9), b = r.ints(r.int(0, 3), 1, 9); return { listA: [...a, ...common], listB: [...b, ...common], skipA: a.length, skipB: b.length }; },
  169: (r) => { const n = r.int(1, 9), m = r.int(-5, 5), k = Math.floor(n / 2) + 1; return { nums: r.shuffle([...Array(k).fill(m), ...r.ints(n - k, -5, 5)]) }; },
  189: (r) => ({ nums: r.ints(r.int(1, 8), -9, 9), k: r.int(0, 10) }),
  198: (r) => ({ nums: r.ints(r.int(1, 10), 0, 9) }),
  199: (r) => ({ root: treeArray(r, r.int(0, 9), () => r.int(1, 9)) }),
  200: (r) => ({ matrix: r.grid(r.int(1, 5), r.int(1, 5), [0, 1]) }),
  206: (r) => ({ head: r.ints(r.int(0, 8), -9, 9) }),
  207: (r) => { const n = r.int(1, 5); return { numCourses: n, prerequisites: Array.from({ length: r.int(0, 6) }, () => r.distinct(2, 0, n - 1)).filter((e) => e.length === 2) }; },
  208: (r) => {
    const ops = ['Trie'], args = [[]], words = [];
    for (let i = 0, n = r.int(1, 10); i < n; i++) {
      const op = words.length ? r.pick(['insert', 'search', 'startsWith']) : 'insert';
      const w = op === 'insert' || r.next() < 0.4 ? r.word(r.int(1, 4), 'ab') : r.pick(words).slice(0, r.int(1, 4));
      if (op === 'insert') words.push(w);
      ops.push(op); args.push([w]);
    }
    return { ops, args };
  },
  215: (r) => { const nums = r.ints(r.int(1, 10), -9, 9); return { nums, k: r.int(1, nums.length) }; },
  226: (r) => ({ root: treeArray(r, r.int(0, 9), () => r.int(1, 9)) }),
  230: (r) => { const root = bst(r, r.int(1, 9), 0, 20); return { root, k: r.int(1, root.filter((v) => v !== null).length) }; },
  234: (r) => { const half = r.ints(r.int(0, 4), 1, 3); return { head: r.next() < 0.5 ? [...half, ...(r.next() < 0.5 ? [r.int(1, 3)] : []), ...[...half].reverse()] : r.ints(r.int(1, 7), 1, 3) }; },
  236: (r) => { const n = r.int(2, 9), vals = r.distinct(n, 0, 20), root = treeArray(r, n, (i) => vals[i]); const [p, q] = r.distinct(2, 0, n - 1).map((i) => vals[i]); return { root, p, q }; },
  238: (r) => ({ nums: r.ints(r.int(2, 8), -4, 5) }),
  239: (r) => { const nums = r.ints(r.int(1, 10), -9, 9); return { nums, k: r.int(1, nums.length) }; },
  240: (r) => {
    const m = r.int(1, 4), n = r.int(1, 4), a = Array.from({ length: m }, () => Array(n).fill(0));
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) a[i][j] = Math.max(i ? a[i - 1][j] : 0, j ? a[i][j - 1] : 0) + r.int(1, 4);
    return { matrix: a, target: r.next() < 0.6 ? r.pick(a.flat()) : r.int(0, 30) };
  },
  279: (r) => ({ n: r.int(1, 60) }),
  283: (r) => ({ nums: r.ints(r.int(1, 10), 0, 3) }),
  287: (r) => { const n = r.int(1, 7), d = r.int(1, n); return { nums: r.shuffle([...Array.from({ length: n }, (_, i) => i + 1), d]) }; },
  295: (r) => {
    const ops = ['MedianFinder'], args = [[]]; let size = 0;
    for (let i = 0, n = r.int(1, 10); i < n; i++) { const op = size && r.next() < 0.4 ? 'findMedian' : 'addNum'; ops.push(op); args.push(op === 'addNum' ? [r.int(-9, 9)] : []); if (op === 'addNum') size++; }
    return { ops, args };
  },
  300: (r) => ({ nums: r.ints(r.int(1, 10), -5, 9) }),
  322: (r) => ({ coins: r.distinct(r.int(1, 3), 1, 9), amount: r.int(0, 25) }),
  347: (r) => { const nums = r.ints(r.int(1, 12), 1, 5); return { nums, k: r.int(1, new Set(nums).size) }; },
  394: (r) => {
    const gen = (d) => Array.from({ length: r.int(1, 2) }, () => (d < 2 && r.next() < 0.5 ? `${r.int(1, 3)}[${gen(d + 1)}]` : r.word(r.int(1, 2), 'abc'))).join('');
    return { s: gen(0) };
  },
  416: (r) => ({ nums: r.ints(r.int(1, 8), 1, 9) }),
  437: (r) => ({ root: treeArray(r, r.int(0, 9), () => r.int(-3, 5)), targetSum: r.int(-3, 8) }),
  438: (r) => ({ s: r.word(r.int(1, 14), 'abc'), p: r.word(r.int(1, 3), 'abc') }),
  543: (r) => ({ root: treeArray(r, r.int(1, 9), () => r.int(1, 9)) }),
  560: (r) => ({ nums: r.ints(r.int(1, 10), -3, 3), k: r.int(-3, 4) }),
  739: (r) => ({ temperatures: r.ints(r.int(1, 10), 30, 40) }),
  763: (r) => ({ s: r.word(r.int(1, 16), r.pick(['abc', 'abcdef', 'abcdefgh'])) }),
  994: (r) => ({ matrix: r.grid(r.int(1, 4), r.int(1, 4), [0, 1, 1, 2]) }),
  1143: (r) => ({ text1: r.word(r.int(1, 8), 'abcd'), text2: r.word(r.int(1, 8), 'abcd') }),
};

// The trace accepts these inputs, but the problem promises more (a unique answer, reachability).
const UNIQUE = {
  // Exactly one pair of positions sums to target.
  1: ({ nums, target }) => { let n = 0; for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) n += nums[i] + nums[j] === target; return n === 1; },
  // The last index is reachable.
  45: ({ nums }) => { let far = 0; for (let i = 0; i < nums.length && i <= far; i++) far = Math.max(far, i + nums[i]); return far >= nums.length - 1; },
  // Only one shortest window (or none).
  76: ({ s, t }) => {
    const need = count([...t]), ok = (w) => [...need].every(([c, n]) => (count([...w]).get(c) || 0) >= n);
    for (let len = t.length; len <= s.length; len++) { let hits = 0; for (let i = 0; i + len <= s.length; i++) hits += ok(s.slice(i, i + len)); if (hits) return hits === 1; }
    return true;
  },
  // The k-th and (k+1)-th frequencies differ, so the top k are well defined.
  347: ({ nums, k }) => { const f = [...count(nums).values()].sort((a, b) => b - a); return k >= f.length || f[k - 1] > f[k]; },
};

const PER_LESSON = 10, ATTEMPTS = 400;

/** Hidden cases for one lesson: [{input, expected}], the sample first. */
export function casesFor(id) {
  const lesson = lessons[id], gen = G[id];
  const out = [{ input: lesson.sample, expected: lesson.expected }], seen = new Set([JSON.stringify(lesson.sample)]);
  if (!gen) return out;
  const r = rng(0x9e3779b1 ^ (Number(id) * 2654435761));
  for (let attempt = 0; attempt < ATTEMPTS && out.length < PER_LESSON; attempt++) {
    const input = gen(r, out.length - 1), key = JSON.stringify(input);
    if (seen.has(key)) continue;
    seen.add(key);
    if (UNIQUE[id] && !UNIQUE[id](input)) continue;
    let answer;
    try { answer = lesson.trace(key).at(-1).answer; } catch { continue; }
    if (answer === undefined) continue;
    out.push({ input, expected: answer });
  }
  return out;
}

let all;
/** Every lesson's cases, computed once. */
export function allCases() {
  if (!all) all = new Map(Object.keys(lessons).map((id) => [Number(id), casesFor(id)]));
  return all;
}

/** Compare one program output with one case; same rules as the lesson page. */
export function check(id, stdout, testCase) {
  return judgeOutput(Number(id), stdout, testCase.expected, testCase.input);
}
