// Turns one test input (the JSON object a lesson's demo reads) into Java that calls the reader's
// Solution. Output is {setup, statement, expr}: statements to run first, an optional call made for
// its side effects (in-place problems), and the expression whose value is printed with LessonIO.
//
// The hand-written calls in the lessons (lesson.call, javaSetup, javaScenario) were checked against
// real Java; tests/hot100/verify-judge-codegen.mjs requires this generator to reproduce them exactly
// for every lesson's sample, so any input shape the samples cover is generated the same way.

const int = (v) => {
  if (!Number.isInteger(v)) throw new Error(`需要整数，得到 ${JSON.stringify(v)}`);
  return String(v);
};
const str = (s) => JSON.stringify(String(s)); // JSON string escapes are valid Java for printable ASCII
const chr = (c) => {
  const s = String(c);
  if (s.length !== 1) throw new Error(`需要单个字符，得到 ${JSON.stringify(c)}`);
  return s === "'" ? "'\\''" : s === '\\' ? "'\\\\'" : `'${s}'`;
};
const nullable = (v) => (v === null ? 'null' : int(v));
const commas = (values, f) => values.map(f).join(',');

/** Literal for one parameter of the given Java type. */
export function literal(type, value) {
  switch (type) {
    case 'int': case 'long': return int(value);
    case 'boolean': return value ? 'true' : 'false';
    case 'double': return String(Number(value));
    case 'String': return str(value);
    case 'int[]': return `new int[]{${commas(value, int)}}`;
    case 'int[][]': return `new int[][]{${commas(value, (row) => `{${commas(row, int)}}`)}}`;
    case 'char[][]': return `new char[][]{${commas(value, (row) => `{${commas(row, (c) => chr(String(c)))}}`)}}`;
    case 'String[]': return `new String[]{${commas(value, str)}}`;
    case 'List<String>': return `Arrays.asList(${commas(value, str)})`;
    case 'ListNode': return `LessonIO.list(${commas(value, int)})`;
    case 'ListNode[]': return `new ListNode[]{${commas(value, (list) => `LessonIO.list(${commas(list, int)})`)}}`;
    case 'TreeNode': return `LessonIO.tree(${commas(value, nullable)})`;
    case 'Node': return `LessonIO.randomList(new int[][]{${commas(value, ([v, r]) => `{${int(v)},${r === null ? '-1' : int(r)}}`)}})`;
    default: throw new Error(`不支持的参数类型 ${type}`);
  }
}

/** Array initialiser form used when the value goes into a local variable: {1,2,3}. */
function initializer(type, value) {
  if (type === 'int[]') return `{${commas(value, int)}}`;
  if (type === 'int[][]') return `{${commas(value, (row) => `{${commas(row, int)}}`)}}`;
  return literal(type, value);
}

export function parseSignature(signature) {
  const m = String(signature).match(/^public\s+(.+?)\s+(\w+)\((.*)\)$/);
  if (!m) throw new Error(`无法解析方法签名：${signature}`);
  const params = m[3].trim() ? m[3].split(/,(?![^<]*>)/).map((p) => {
    const x = p.trim().match(/^(.+)\s+(\w+)$/);
    return { type: x[1].trim(), name: x[2] };
  }) : [];
  return { returns: m[1], method: m[2], params };
}

/** Parameters whose input key differs from the Java name. */
const KEY_ALIASES = { grid: 'matrix' };
const valueFor = (input, p) => (p.name in input ? input[p.name] : input[KEY_ALIASES[p.name]]);

// Lessons that need more than "call the method with these literals".
const SPECIAL = {
  // A cycle is built by linking the tail back to node `pos`.
  141: (l, input) => ({ setup: '', statement: '', expr: `new Solution().hasCycle(LessonIO.cycle(${literal('ListNode', input.head)},${int(input.pos)}))` }),
  142: (l, input) => ({ setup: '', statement: '', expr: transform(l, `new Solution().detectCycle(LessonIO.cycle(${literal('ListNode', input.head)},${int(input.pos)}))`) }),
  // Two lists that share their tail after skipA / skipB nodes.
  160: (l, input) => {
    const common = input.listA.slice(input.skipA);
    return {
      setup: `ListNode common = ${literal('ListNode', common)}; ListNode headA = LessonIO.prepend(new int[]{${commas(input.listA.slice(0, input.skipA), int)}},common); ListNode headB = LessonIO.prepend(new int[]{${commas(input.listB.slice(0, input.skipB), int)}},common);`,
      statement: '',
      expr: transform(l, 'new Solution().getIntersectionNode(headA,headB)'),
    };
  },
  // p and q are the tree's own nodes, found by value.
  236: (l, input) => ({
    setup: `TreeNode root = ${literal('TreeNode', input.root)}; TreeNode p = LessonIO.find(root,${int(input.p)}), q = LessonIO.find(root,${int(input.q)});`,
    statement: '',
    expr: transform(l, 'new Solution().lowestCommonAncestor(root,p,q)'),
  }),
};

function transform(l, call) {
  return l.javaTransform ? l.javaTransform.replace('__RESULT__', call) : call;
}

/** Design problems: replay the operations on one object and collect every return value. */
function scenario(l, input) {
  const className = l.className || input.ops[0];
  const variable = l.javaScenario?.match(new RegExp(`^${className}\\s+(\\w+)\\s*=`))?.[1] || 'obj';
  // A method is void when every call to it in the sample returned null.
  const sample = l.sample, voids = new Set(sample.ops.filter((op, i) => i > 0 && sample.ops.every((o, j) => o !== op || l.expected[j] === null)));
  const arg = (v) => (typeof v === 'string' ? str(v) : Number.isInteger(v) ? int(v) : String(v));
  if (input.ops[0] !== className) throw new Error(`第一个操作必须是 ${className}`);
  const parts = [`${className} ${variable} = new ${className}(${(input.args[0] || []).map(arg).join(',')});`, 'List<Object> result = new ArrayList<>();', 'result.add(null);'];
  for (let i = 1; i < input.ops.length; i++) {
    const op = input.ops[i];
    if (!/^[A-Za-z_]\w*$/.test(op)) throw new Error(`操作名无效：${op}`);
    const call = `${variable}.${op}(${(input.args[i] || []).map(arg).join(',')})`;
    parts.push(voids.has(op) ? `${call}; result.add(null);` : `result.add(${call});`);
  }
  return { setup: parts.join(' '), statement: '', expr: 'result' };
}

/** Java for one test input of one lesson. */
export function javaCase(lesson, input) {
  if (lesson.javaScenario) return scenario(lesson, input);
  if (SPECIAL[lesson.id]) return SPECIAL[lesson.id](lesson, input);
  const { method, params } = parseSignature(lesson.signature);
  // In-place problems: the arrays (or tree) live in locals, the method is called for its effect,
  // and the result is read back from them.
  if (lesson.javaResult) {
    const locals = params.filter((p) => /\[\]|TreeNode/.test(p.type));
    const setup = locals.map((p) => `${p.type} ${p.name} = ${initializer(p.type, valueFor(input, p))};`).join(' ');
    const args = params.map((p) => (locals.includes(p) ? p.name : literal(p.type, valueFor(input, p)))).join(',');
    return { setup, statement: `new Solution().${method}(${args})`, expr: lesson.javaResult };
  }
  const args = params.map((p) => {
    const value = valueFor(input, p);
    if (value === undefined) throw new Error(`输入缺少参数 ${p.name}`);
    return literal(p.type, value);
  }).join(',');
  return { setup: '', statement: '', expr: transform(lesson, `new Solution().${method}(${args})`) };
}
