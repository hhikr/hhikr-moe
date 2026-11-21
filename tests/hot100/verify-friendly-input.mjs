import assert from 'node:assert/strict';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
import {prepareDemo} from '../../public/hot100-assets/demo-input.mjs';
import {fieldsFor,expectedField,formatFields,formatValue,parseValue,toRaw,splitAssignments} from '../../public/hot100-assets/friendly-input.mjs';

// Every lesson: the sample written as a person would, read back, gives the same input and the same answer.
let fields=0;
for(const lesson of Object.values(lessons)){
 const sample=JSON.parse(lesson.raw);
 const texts=formatFields(lesson,sample);
 for(const [key,text] of Object.entries(texts))assert.ok(!/^\s*\{/.test(text),`${lesson.id}.${key} 不应要求输入 JSON 对象`);
 assert.deepEqual(JSON.parse(toRaw(lesson,texts)),sample,`样例往返失败：${lesson.id} ${JSON.stringify(texts)}`);
 const exp=expectedField(lesson);
 const expText=formatValue(exp.kind,lesson.expected);
 assert.deepEqual(parseValue(exp.kind,expText),lesson.expected,`预期输出往返失败：${lesson.id} ${exp.kind} ${expText}`);
 const demo=prepareDemo(lesson,toRaw(lesson,texts),JSON.stringify(parseValue(exp.kind,expText)));
 assert.equal(demo.matched,true,`友好输入演示核对失败：${lesson.id}`);
 fields+=fieldsFor(lesson).length;
}

// What people actually type.
let typed=0;
const raw=(id,texts)=>{typed++;return JSON.parse(toRaw(lessons[id],texts));};
assert.deepEqual(raw(1,{nums:'2 7 11 15',target:'9'}),{nums:[2,7,11,15],target:9});
assert.deepEqual(raw(1,{nums:'2, 7, 11, 15',target:' 9 '}),{nums:[2,7,11,15],target:9});
assert.deepEqual(raw(1,{nums:'[2,7,11,15]',target:'9'}),{nums:[2,7,11,15],target:9});
assert.deepEqual(raw(1,{nums:'2，7，11，15',target:'+9'}),{nums:[2,7,11,15],target:9});
assert.deepEqual(raw(283,{nums:''}),{nums:[]});
assert.deepEqual(raw(3,{s:'abcabcbb'}),{s:'abcabcbb'});
assert.deepEqual(raw(3,{s:'"abcabcbb"'}),{s:'abcabcbb'});
assert.deepEqual(raw(3,{s:'" a b "'}),{s:' a b '});
assert.deepEqual(raw(102,{root:'3 9 20 null null 15 7'}),{root:[3,9,20,null,null,15,7]});
assert.deepEqual(raw(102,{root:'3, 9, 20, #, #, 15, 7'}),{root:[3,9,20,null,null,15,7]});
assert.deepEqual(raw(102,{root:'[3,9,20,null,null,15,7]'}),{root:[3,9,20,null,null,15,7]});
assert.deepEqual(raw(48,{matrix:'1 2 3\n4 5 6\n7 8 9'}),{matrix:[[1,2,3],[4,5,6],[7,8,9]]});
assert.deepEqual(raw(48,{matrix:'1,2,3\n\n4,5,6\n7,8,9\n'}),{matrix:[[1,2,3],[4,5,6],[7,8,9]]});
assert.deepEqual(raw(56,{intervals:'1 3; 2 6; 8 10'}),{intervals:[[1,3],[2,6],[8,10]]});
assert.deepEqual(raw(56,{intervals:'[[1,3],[2,6]]'}),{intervals:[[1,3],[2,6]]});
assert.deepEqual(raw(23,{lists:'1 4 5\n[]\n2 6'}),{lists:[[1,4,5],[],[2,6]]});
assert.deepEqual(raw(79,{board:'ABCE\nSFCS\nADEE',word:'ABCCED'}),{board:[['A','B','C','E'],['S','F','C','S'],['A','D','E','E']],word:'ABCCED'});
assert.deepEqual(raw(79,{board:'A B C E\nS F C S',word:'SEE'}).board,[['A','B','C','E'],['S','F','C','S']]);
assert.deepEqual(raw(49,{strs:'eat tea tan, ate nat bat'}),{strs:['eat','tea','tan','ate','nat','bat']});
assert.deepEqual(raw(138,{head:'7 null\n13 0\n11 4'}),{head:[[7,null],[13,0],[11,4]]});
assert.deepEqual(raw(146,{ops:'LRUCache 2\nput 1 1\nput(2, 2)\nget 1'}),{ops:['LRUCache','put','put','get'],args:[[2],[1,1],[2,2],[1]]});
assert.deepEqual(raw(208,{ops:'Trie\ninsert apple\nsearch "app"'}),{ops:['Trie','insert','search'],args:[[],['apple'],['app']]});

// LeetCode's own example line, pasted into one field.
assert.deepEqual(splitAssignments('nums = [2,7,11,15], target = 9',['nums','target']),{nums:'[2,7,11,15]',target:'9'});
assert.deepEqual(splitAssignments('输入：nums = [3,2,4], target = 6',['nums','target']),{nums:'[3,2,4]',target:'6'});
assert.equal(splitAssignments('2 7 11 15',['nums','target']),null);
assert.deepEqual(raw(1,splitAssignments('nums = [3,2,4], target = 6',['nums','target'])),{nums:[3,2,4],target:6});

// Expected output, also typed loosely.
assert.equal(parseValue('bool','是'),true);assert.equal(parseValue('bool','False'),false);
assert.deepEqual(parseValue('ints','0 1'),[0,1]);
assert.deepEqual(parseValue('word-rows','eat tea ate\ntan nat\nbat'),[['eat','tea','ate'],['tan','nat'],['bat']]);
assert.deepEqual(parseValue('rows','[]\n1\n1 2'),[[],[1],[1,2]]);
assert.deepEqual(parseValue('values','null, null, 1.5, true, -1'),[null,null,1.5,true,-1]);
assert.equal(prepareDemo(lessons[1],toRaw(lessons[1],{nums:'3 2 4',target:'6'}),JSON.stringify(parseValue('ints','1 2'))).matched,true);

// Mistakes are named precisely.
assert.throws(()=>toRaw(lessons[1],{nums:'2 7 x 15',target:'9'}),/nums：第 3 个值“x”不是整数/);
assert.throws(()=>toRaw(lessons[1],{nums:'2 7',target:'9 10'}),/target：需要一个整数/);
assert.throws(()=>toRaw(lessons[48],{matrix:'1 2\n3 y'}),/matrix：第 2 行第 2 个值“y”不是整数/);
assert.throws(()=>toRaw(lessons[79],{board:'AB\nC DD',word:'A'}),/第 2 行每格只能是一个字符/);
assert.throws(()=>toRaw(lessons[146],{ops:'LRUCache 2\n1 1'}),/第 2 行应以操作名开头/);
assert.throws(()=>parseValue('bool','maybe','预期'),/true 或 false/);
assert.throws(()=>toRaw(lessons[1],{nums:'["a"]',target:'9'}),/nums：格式不对/);

console.log(`通过：100 道题 ${fields} 个输入框的样例与预期输出往返、${typed} 组手写输入、力扣示例粘贴及 7 类错误提示。`);
