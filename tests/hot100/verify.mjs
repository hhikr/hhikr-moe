import assert from 'node:assert/strict';
import {catalog,categories} from '../../public/hot100-assets/catalog.mjs';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
assert.equal(catalog.length,100);
assert.equal(new Set(catalog.map(q=>q.id)).size,100);
assert.equal(categories.length,17);
let seed=12345;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(let trial=0;trial<100;trial++){
 const nums=Array.from({length:random(24)},()=>random(7)-3);
 const frames=lessons[283].trace(JSON.stringify({nums}));
 const expected=[...nums.filter(v=>v!==0),...nums.filter(v=>v===0)];
 assert.deepEqual(frames.at(-1).values,expected);
 const sorted=[...new Set(nums)].sort((a,b)=>a-b),target=random(15)-7;
 const binary=lessons[35].trace(JSON.stringify({nums:sorted,target}));
 const found=sorted.findIndex(v=>v>=target);
 assert.equal(binary.at(-1).vars.left,found<0?sorted.length:found);
 const a=random(20)-10,b=random(20)-10;
 const sum=lessons[1].trace(JSON.stringify({nums:[a,b],target:a+b}));
 assert.equal(sum.at(-1).line,7);
 assert.deepEqual(sum.at(-1).active,[0,1]);
}
const ways=[1,1];
for(let n=1;n<=20;n++){
 const f=lessons[70].trace(JSON.stringify({n})).at(-1);
 if(n>1)ways[n]=ways[n-1]+ways[n-2];
 const answer=n<=2?n:f.vars.b;
 assert.equal(answer,ways[n]);
}
for(const lesson of Object.values(lessons)){
 for(const f of lesson.trace(lesson.raw))assert.ok(f.line>=1&&f.line<=lesson.code.split('\n').length);
}
assert.throws(()=>lessons[35].trace('{"nums":[3,1],"target":2}'));
assert.throws(()=>lessons[70].trace('{"n":21}'));
assert.throws(()=>lessons[283].trace('{"nums":[null]}'));
console.log('通过：100 道题唯一编号、17 个分类、300 组数组用例、20 组 DP 用例及输入边界验证。');
