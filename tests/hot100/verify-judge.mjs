import assert from 'node:assert/strict';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
import {judgeOutput} from '../../public/hot100-assets/judge.mjs';
for(const [id,l] of Object.entries(lessons)){
 const sample=l.sample||JSON.parse(l.raw);
 assert.equal(judgeOutput(Number(id),JSON.stringify(l.expected),l.expected,sample).kind,'passed',id);
 assert.equal(judgeOutput(Number(id),'调试信息\n'+JSON.stringify(l.expected),l.expected,sample).kind,'format',id);
 assert.notEqual(judgeOutput(Number(id),JSON.stringify({wrong:true}),l.expected,sample).kind,'passed',id);
}
function result(id,value){const l=lessons[id];return judgeOutput(id,JSON.stringify(value),l.expected,l.sample||JSON.parse(l.raw)).kind;}
assert.equal(result(1,[1,0]),'passed');assert.equal(result(1,[0,0]),'wrong');
assert.equal(result(5,'aba'),'passed');assert.equal(result(5,'bad'),'wrong');assert.equal(result(5,'ba'),'wrong');
assert.equal(result(49,[['bat'],['nat','tan'],['ate','tea','eat']]),'passed');
assert.equal(result(46,[...lessons[46].expected].reverse()),'passed');
assert.equal(result(46,lessons[46].expected.map(row=>row.toSorted())),'wrong');
assert.equal(result(78,[...lessons[78].expected].reverse().map(row=>row.toReversed())),'passed');
assert.equal(result(108,[-3,-10,5,null,null,0,9]),'passed');
assert.equal(result(108,[-10,null,-3,null,0,null,5,null,9]),'wrong');
assert.equal(result(108,[0,-10,5,null,-3,null,9,null,null,null,null,42]),'wrong');
assert.equal(result(347,[2,1]),'passed');assert.equal(result(347,[1,1]),'wrong');
console.log('通过：100 道题示例比对、格式错误与错误答案；另验证结果顺序、合法替代回文及平衡搜索树。');
