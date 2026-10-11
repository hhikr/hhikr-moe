import assert from 'node:assert/strict';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
import {prepareDemo} from '../../public/hot100-assets/demo-input.mjs';
for(const lesson of Object.values(lessons)){
 const demo=prepareDemo(lesson,lesson.raw,lesson.output);
 assert.equal(demo.matched,true,`示例预期核对失败：${lesson.id}`);
 assert.ok(demo.frames.length);assert.equal(demo.frames.at(-1).answer,demo.actual);
 assert.equal(prepareDemo(lesson,lesson.raw).hasExpected,false);
}
const cases=[
 [1,{nums:[3,2,4],target:6},[1,2]],
 [283,{nums:[0,4,0,2,0]},[4,2,0,0,0]],
 [35,{nums:[1,3,5],target:4},2],
 [70,{n:7},21],
 [206,{head:[8,3,1]},[1,3,8]],
 [94,{root:[2,1,3]},[1,2,3]],
 [54,{matrix:[[1,2],[3,4]]},[1,2,4,3]],
 [5,{s:'babad'},'aba'],
 [49,{strs:['ab','ba','x']},[['x'],['ba','ab']]]
];
for(const [id,input,expected] of cases){const result=prepareDemo(lessons[id],JSON.stringify(input),JSON.stringify(expected));assert.equal(result.matched,true,`自定义输入核对失败：${id}`);}
assert.equal(prepareDemo(lessons[1],'{"nums":[3,2,4],"target":6}','[2,1]').matched,true);
assert.equal(prepareDemo(lessons[1],'{"nums":[3,2,4],"target":6}','[0,1]').matched,false);
assert.throws(()=>prepareDemo(lessons[1],'invalid'),/演示输入/);
assert.throws(()=>prepareDemo(lessons[1],lessons[1].raw,'wrong'),/预期输出/);
assert.throws(()=>prepareDemo(lessons[70],'{"n":21}'),/演示范围/);
assert.throws(()=>prepareDemo(lessons[54],'{"matrix":[[1],[2,3]]}'),/等长/);
console.log('通过：100 道题的自定义演示生成、预期输出核对、不同合法答案及输入错误；9 组替换输入改变执行结果。');
