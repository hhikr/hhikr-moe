// Comparing two versions of a text.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { diffLines, diffStats, withContext } = await import('../../src/lib/diff.ts');

const signs = (lines) => lines.map((l) => `${l.op === 'add' ? '+' : l.op === 'del' ? '-' : ' '}${l.text}`);
/** Rebuild both texts from a diff: the result must always be the two inputs. */
const rebuild = (lines) => [
  lines.filter((l) => l.op !== 'add').map((l) => l.text).join('\n'),
  lines.filter((l) => l.op !== 'del').map((l) => l.text).join('\n'),
];

test('identical texts have no changes', () => {
  const lines = diffLines('a\nb\nc', 'a\nb\nc');
  assert.deepEqual(signs(lines), [' a', ' b', ' c']);
  assert.deepEqual(diffStats(lines), { added: 0, removed: 0 });
  assert.deepEqual(diffLines('', ''), []);
});

test('added, removed and replaced lines', () => {
  assert.deepEqual(signs(diffLines('a\nc', 'a\nb\nc')), [' a', '+b', ' c']);
  assert.deepEqual(signs(diffLines('a\nb\nc', 'a\nc')), [' a', '-b', ' c']);
  assert.deepEqual(signs(diffLines('a\nb\nc', 'a\nX\nc')), [' a', '-b', '+X', ' c']);
  assert.deepEqual(signs(diffLines('', 'a\nb')), ['+a', '+b']);
  assert.deepEqual(signs(diffLines('a\nb', '')), ['-a', '-b']);
});

test('line numbers refer to each side', () => {
  const lines = diffLines('a\nb\nc', 'a\nX\nY\nc');
  assert.deepEqual(
    lines.map((l) => [l.before, l.after]),
    [[1, 1], [2, undefined], [undefined, 2], [undefined, 3], [3, 4]],
  );
});

test('line endings and a final newline make no difference', () => {
  assert.deepEqual(diffStats(diffLines('a\r\nb\r\n', 'a\nb')), { added: 0, removed: 0 });
});

test('an edited line marks the characters that changed', () => {
  const [removed, added] = diffLines('今天的天气很好，适合出门。', '今天的天气不太好，适合在家。');
  assert.equal(removed.op, 'del');
  assert.equal(added.op, 'add');
  assert.deepEqual(removed.parts.filter((p) => p.op === 'del').map((p) => p.text), ['很', '出门']);
  assert.deepEqual(added.parts.filter((p) => p.op === 'add').map((p) => p.text), ['不太', '在家']);
  assert.equal(removed.parts.map((p) => p.text).join(''), removed.text);
  assert.equal(added.parts.map((p) => p.text).join(''), added.text);
});

test('lines with little in common are shown as replaced, not marked up', () => {
  const [removed, added] = diffLines('完全不同的一句话', 'nothing alike here');
  assert.equal(removed.parts, undefined);
  assert.equal(added.parts, undefined);
});

test('characters outside the basic plane stay whole', () => {
  const [removed, added] = diffLines('看到 😀 就开心，真的很开心', '看到 😭 就开心，真的很开心');
  assert.deepEqual(removed.parts.find((p) => p.op === 'del').text, '😀');
  assert.deepEqual(added.parts.find((p) => p.op === 'add').text, '😭');
});

test('unchanged stretches are left out, with a count', () => {
  const before = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
  const after = [...before];
  after[14] = 'changed';
  const view = withContext(diffLines(before.join('\n'), after.join('\n')), 2);
  assert.equal(view[0], 12);
  assert.equal(view.at(-1), 13);
  assert.deepEqual(signs(view.slice(1, -1)), [' line 13', ' line 14', '-line 15', '+changed', ' line 16', ' line 17']);
});

test('any diff rebuilds both of its inputs', () => {
  // A small deterministic generator, so a failure can be reproduced.
  let seed = 20261012;
  const random = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  for (let round = 0; round < 200; round++) {
    const a = Array.from({ length: random(40) }, () => `l${random(8)}`);
    const b = a.filter(() => random(4) !== 0).flatMap((line) => (random(4) === 0 ? [line, `n${random(8)}`] : [line]));
    const lines = diffLines(a.join('\n'), b.join('\n'));
    assert.deepEqual(rebuild(lines), [a.join('\n'), b.join('\n')], `round ${round}`);
    const { added, removed } = diffStats(lines);
    assert.equal(a.length - removed, b.length - added);
  }
});

test('the shortest script is found', () => {
  // ABCABBA -> CBABAC needs exactly five edits.
  const { added, removed } = diffStats(diffLines('A\nB\nC\nA\nB\nB\nA', 'C\nB\nA\nB\nA\nC'));
  assert.equal(added + removed, 5);
});

test('very different large texts fall back to a whole replacement', () => {
  const a = Array.from({ length: 3000 }, (_, i) => `old ${i}`).join('\n');
  const b = Array.from({ length: 3000 }, (_, i) => `new ${i}`).join('\n');
  const started = Date.now();
  const lines = diffLines(a, b);
  assert.deepEqual(diffStats(lines), { added: 3000, removed: 3000 });
  assert.deepEqual(rebuild(lines), [a, b]);
  assert.ok(Date.now() - started < 5000);
});
