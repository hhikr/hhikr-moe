// IntelliSense end to end with a real JDT LS (HOT100_JDTLS = extracted release, Java 21+ on PATH
// or HOT100_JDTLS_JAVA). Skipped when HOT100_JDTLS is not set.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LanguageService, analysedText, applyEdits, splitTypes } from '../../tools/hot100-judge/lsp.mjs';
import { PRELUDE } from '../../tools/hot100-judge/harness.mjs';

// Pure parts first.
assert.ok(analysedText('public class Solution {}\npublic class Main {}').startsWith(PRELUDE + '       class Solution'));
assert.equal(analysedText('x').length, PRELUDE.length + 1);
const types = splitTypes(await readFile(new URL('../../tools/hot100-java/LessonIO.java', import.meta.url), 'utf8'));
assert.deepEqual(types.map(([name]) => name), ['ListNode', 'TreeNode', 'Node', 'LessonIO']);
assert.ok(types.every(([name, source]) => source.startsWith('import java.util.*;') && new RegExp(`class ${name}\\b`).test(source)));
assert.equal(applyEdits('ab\ncd', [{ range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } }, newText: 'X' }, { range: { start: { line: 0, character: 2 }, end: { line: 0, character: 2 } }, newText: '!' }]), 'ab!\nXd');

if (!process.env.HOT100_JDTLS) { console.log('跳过：没有设置 HOT100_JDTLS（JDT LS 目录）。纯函数部分已通过。'); process.exit(0); }
const service = new LanguageService({ jdtls: process.env.HOT100_JDTLS, work: await mkdtemp(join(tmpdir(), 'hot100-lsp-')), java: process.env.HOT100_JDTLS_JAVA || 'java', perClient: 2, slots: 4 });
const t0 = Date.now();
await service.start();
const startup = Date.now() - t0;
await service.warm;
const warmup = Date.now() - t0 - startup;
const session = 'a'.repeat(24), client = '1.2.3.4';
const code = `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        String bad = 1;
        List<Integer> xs = Arrays.stream(nums).boxed().collect(Collectors.toList());
        ListNode node = new ListNode(1);
        map.
        return new int[0];
    }
}
`;
const timed = async (f) => { const t = Date.now(); const r = await f(); return [r, Date.now() - t]; };
try {
  const [diags, firstDiag] = await timed(() => service.diagnostics({ session, client, code }));
  const messages = diags.map((d) => `${d.range.start.line}:${d.message}`);
  assert.ok(diags.some((d) => d.range.start.line === 5 && /String/.test(d.message)), `第 6 行的类型错误：${messages}`);
  assert.ok(!diags.some((d) => /Collectors|ListNode/.test(d.message)), `判题机默认导入与 ListNode 不应报错：${messages}`);
  assert.ok(!diags.some((d) => d.range.start.line === 0), `前缀不应产生诊断：${messages}`);

  const memberAt = { line: 8, character: 12 };
  const [members, firstComplete] = await timed(() => service.complete({ session, client, code, position: memberAt }));
  const labels = members.items.map((i) => i.label);
  assert.ok(labels.some((l) => /^put\b/.test(l)) && labels.some((l) => /^getOrDefault\b/.test(l)), `map. 补全：${labels.slice(0, 10)}`);
  assert.ok(members.items.every((i) => !i.range || i.range.start.line === 8));
  // Resolve works for the latest completion; an outdated item quietly gives nothing.
  const resolved = await service.resolve({ item: members.items.find((i) => /^put\b/.test(i.label)) });
  assert.ok(resolved && (resolved.documentation || resolved.detail), `resolve：${JSON.stringify(resolved)}`);

  const typed = code.replace('        map.\n', '        Arr\n');
  const typeItems = await service.complete({ session, client, code: typed, position: { line: 8, character: 11 } });
  assert.ok(typeItems.items.some((i) => /^ArrayList/.test(i.label)) && typeItems.items.some((i) => /^Arrays/.test(i.label)), `类型补全：${typeItems.items.slice(0, 8).map((i) => i.label)}`);

  assert.equal(await service.resolve({ item: members.items.find((i) => /^put\b/.test(i.label)) }), null);

  // Line 0: positions are shifted past the hidden prefix.
  const top = await service.complete({ session, client, code: 'import java.util.Arr', position: { line: 0, character: 20 } });
  assert.ok(top.items.some((i) => /ArrayList/.test(i.label)), '第一行的补全');
  assert.ok(top.items.every((i) => !i.range || i.range.start.character <= 20));


  const hover = await service.hover({ session, client, code, position: { line: 4, character: 9 } });
  assert.ok(hover && hover.contents.join('\n').includes('Map'), `悬停：${JSON.stringify(hover)}`);
  assert.ok(!hover.contents.join('\n').includes('file:'), '悬停不暴露服务器路径');

  const callCode = code.replace('        map.\n', '        map.put(1, \n');
  const sig = await service.signature({ session, client, code: callCode, position: { line: 8, character: 19 } });
  assert.ok(sig && sig.signatures.some((s) => /put\(/.test(s.label)) && sig.activeParameter === 1, `签名：${JSON.stringify(sig)}`);

  const formatted = await service.format({ code: 'class Solution{int f(){return 1;}}' });
  assert.match(formatted.text, /class Solution \{\n\s+int f\(\) \{\n\s+return 1;/);

  // Warm latency.
  const lat = [];
  for (let i = 0; i < 10; i++) lat.push((await timed(() => service.complete({ session, client, code: code.replace('map.', `map.${i % 2 ? '' : ''}`), position: memberAt })))[1]);
  lat.sort((a, b) => a - b);

  // A client keeps at most two sessions here; the oldest is closed.
  await service.diagnostics({ session: 'b'.repeat(24), client, code });
  await service.diagnostics({ session: 'c'.repeat(24), client, code });
  assert.ok(!service.sessions.has(session) && service.sessions.size === 2);
  console.log(`通过：JDT LS 启动 ${startup} ms、预热 ${warmup} ms；首次诊断 ${firstDiag} ms，首次补全 ${firstComplete} ms，热补全中位 ${lat[5]} ms；诊断、成员与类型补全、第一行偏移、resolve、悬停、签名、格式化与会话上限均正确。`);
} finally {
  service.stop();
}
