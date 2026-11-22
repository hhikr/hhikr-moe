import assert from 'node:assert/strict';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
import {javaCase,literal} from '../../tools/hot100-judge/javagen.mjs';

// The hand-written Java in every lesson was run against real Java. For each lesson's own sample the
// generator must produce exactly that Java, so it builds any other input of the same shape the same way.
const squash=s=>String(s||'').replace(/\s+/g,' ').trim();
let checked=0;
for(const lesson of Object.values(lessons)){
 const got=javaCase(lesson,lesson.sample);
 if(lesson.javaScenario){
  assert.equal(squash(got.setup),squash(lesson.javaScenario),`设计题场景不一致：${lesson.id}`);
  assert.equal(got.expr,'result');
 }else{
  assert.equal(squash(got.setup),squash(lesson.javaSetup),`准备代码不一致：${lesson.id}`);
  assert.equal(squash(got.statement),squash(lesson.javaResult?lesson.call:''),`调用语句不一致：${lesson.id}`);
  const expr=lesson.javaResult||lesson.javaTransform?.replace('__RESULT__',lesson.call)||lesson.call;
  assert.equal(squash(got.expr),squash(expr),`结果表达式不一致：${lesson.id}`);
 }
 checked++;
}

// Literals for inputs the samples do not show.
assert.equal(literal('int[]',[]),'new int[]{}');
assert.equal(literal('TreeNode',[]),'LessonIO.tree()');
assert.equal(literal('ListNode',[]),'LessonIO.list()');
assert.equal(literal('String','a"b\\c'),'"a\\"b\\\\c"');
assert.equal(literal('char[][]',[["'",'\\']]),"new char[][]{{'\\'','\\\\'}}");
assert.equal(literal('Node',[[1,null],[2,0]]),'LessonIO.randomList(new int[][]{{1,-1},{2,0}})');
assert.throws(()=>literal('int[]',[1.5]),/需要整数/);
const lru=javaCase(lessons[146],{ops:['LRUCache','get','put'],args:[[1],[7],[3,4]]});
assert.equal(lru.setup,'LRUCache cache = new LRUCache(1); List<Object> result = new ArrayList<>(); result.add(null); result.add(cache.get(7)); cache.put(3,4); result.add(null);');
assert.throws(()=>javaCase(lessons[146],{ops:['Foo'],args:[[]]}),/第一个操作必须是 LRUCache/);
assert.throws(()=>javaCase(lessons[146],{ops:['LRUCache','x(); System.exit(0'],args:[[1],[]]}),/操作名无效/);
const inter=javaCase(lessons[160],{listA:[1,9,1,2,4],listB:[3,2,4],skipA:3,skipB:1});
assert.match(inter.setup,/common = LessonIO\.list\(2,4\).*prepend\(new int\[\]\{1,9,1\},common\).*prepend\(new int\[\]\{3\},common\)/);

console.log(`通过：${checked} 道题的样例 Java 生成与手写代码逐字一致；另验证空输入、转义、随机链表、设计题与相交链表的生成。`);
