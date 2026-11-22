import assert from 'node:assert/strict';
import http from 'node:http';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
import {allCases,casesFor} from '../../tools/hot100-judge/cases.mjs';
import {buildProgram,readerSource,parseRun,parseDiagnostics,PRELUDE} from '../../tools/hot100-judge/harness.mjs';
import {createJudge,verdicts,RateLimit,Queue,customCase} from '../../tools/hot100-judge/server.mjs';

// Hidden cases: every lesson has them, deterministic, sample first, all distinct.
const all=allCases();
assert.equal(all.size,Object.keys(lessons).length);
let total=0;
for(const [id,list] of all){
 assert.ok(list.length>=4,`隐藏用例太少：${id} 只有 ${list.length} 组`);
 assert.deepEqual(list[0].input,lessons[id].sample);
 assert.equal(new Set(list.map(c=>JSON.stringify(c.input))).size,list.length,`隐藏用例重复：${id}`);
 assert.ok(list.every(c=>c.expected!==undefined));
 // The generated program must build for every case of every lesson.
 const source=buildProgram(lessons[id],lessons[id].code,list.map(c=>c.input));
 assert.match(source,/final class Hot100Judge/);
 assert.equal((source.match(/Hot100Run\.run\(/g)||[]).length,list.length);
 total+=list.length;
}
assert.deepEqual(casesFor(1),casesFor(1),'用例必须可重现');
// Unique-answer filters.
for(const c of all.get(1)){const n=c.input.nums;let k=0;for(let i=0;i<n.length;i++)for(let j=i+1;j<n.length;j++)k+=n[i]+n[j]===c.input.target;assert.equal(k,1);}

// The reader's code keeps its line numbers.
const code='import java.util.*;\npublic class Solution {\n  public int f() { return 1; }\n}\npublic class Main { }';
const src=readerSource(code);
assert.equal(src.split('\n').length,code.split('\n').length);
assert.match(src,/^\s+class Solution/m);
assert.match(src,/^public class Main/m,'旧草稿里的 Main 保持不变');
assert.equal(src.split('\n')[1].indexOf('class'),code.split('\n')[1].indexOf('class'));
assert.equal(readerSource('package a.b;\nclass X{}').split('\n')[0].trim(),'');
const program=buildProgram(lessons[1],code,[{nums:[1,2],target:3}]);
assert.ok(program.startsWith(PRELUDE+'import java.util.*;\n'));
assert.match(program,/Hot100Run\.run\(0, \(\) -> \{ return new Solution\(\)\.twoSum\(new int\[\]\{1,2\},3\); \}\)/);
const inPlace=buildProgram(lessons[283],'',[{nums:[0,1]}]);
assert.match(inPlace,/int\[\] nums = \{0,1\}; new Solution\(\)\.moveZeroes\(nums\); return nums;/);

// Harness output.
const b64=s=>Buffer.from(s).toString('base64');
const parsed=parseRun(`noise\n@@H100 0 ok 1500 ${b64('[0,1]')} ${b64('debug\n')}\n@@H100 1 error 20 ${b64('ArithmeticException: / by zero')} \n`);
assert.deepEqual(parsed.results.get(0),{status:'ok',micros:1500,value:'[0,1]',printed:'debug\n'});
assert.equal(parsed.results.get(1).status,'error');
assert.equal(parsed.extra,'noise');
const diags=parseDiagnostics(`1\t${PRELUDE.length+5}\t找不到符号\u0001  符号: x\n3\t7\t需要 ;\n99\t1\t不兼容的类型\n`,code);
assert.deepEqual(diags[0],{line:1,column:5,message:'找不到符号\n  符号: x'});
assert.deepEqual(diags[1],{line:3,column:7,message:'需要 ;'});
assert.ok(diags[2].harness&&diags[2].line===1);

// Verdicts.
const sample=[{input:{nums:[2,7,11,15],target:9},expected:[0,1]},{input:{nums:[3,3],target:6},expected:[0,1]},{input:{nums:[1,2],target:3},expected:[0,1]}];
const results=new Map([[0,{status:'ok',micros:900,value:'[1,0]',printed:''}],[1,{status:'ok',micros:900,value:'[0,0]',printed:'x'}]]);
const v=verdicts(1,{results,reason:'timeout',extra:'',stderr:''},sample);
assert.deepEqual(v.map(x=>x.status),['passed','wrong','timeout']);
assert.equal(v[1].printed,'x');
assert.equal(verdicts(1,{results:new Map(),reason:'',code:1,extra:'',stderr:''},sample).map(x=>x.status).join(),'error,skipped,skipped');
assert.deepEqual(customCase(lessons[1],{nums:[3,4],target:7}).expected,[0,1]);
assert.throws(()=>customCase(lessons[1],{nums:[3,4]}),/缺少 target/);
assert.throws(()=>customCase(lessons[70],{n:99}),/演示范围/);

// Rate limit and queue.
let clock=0;const rate=new RateLimit(()=>clock);
assert.equal(rate.allow('a',2),0);assert.equal(rate.allow('a',2),0);assert.ok(rate.allow('a',2)>0);
clock=61000;assert.equal(rate.allow('a',2),0);
const queue=new Queue(1);let release;const first=queue.push(()=>new Promise(r=>{release=r;}));
assert.equal(queue.push(()=>1),null,'队列满时拒绝');await new Promise(r=>setTimeout(r));release('done');assert.equal(await first,'done');

// HTTP, with a fake runner that echoes the expected answers.
let lastJob;
const runner=async job=>{lastJob=job;if(job.code.includes('BROKEN'))return {kind:'compile',diagnostics:[{line:2,column:1,message:'需要 ;'}]};const list=job.inputs.length===1&&job.inputs[0]===lessons[job.lesson.id].sample?[{expected:lessons[job.lesson.id].expected}]:null;return {kind:'run',reason:'',extra:'',stderr:'',results:new Map(job.inputs.map((input,i)=>[i,{status:'ok',micros:100,value:JSON.stringify(job.code.includes('WRONG')&&i===2?'nope':(list?list[0].expected:customOrHidden(job.lesson.id,input))),printed:''}]))};};
const customOrHidden=(id,input)=>{const hit=all.get(id).find(c=>JSON.stringify(c.input)===JSON.stringify(input));return hit?hit.expected:customCase(lessons[id],input).expected;};
const origin='https://hhikr.moe';
const server=http.createServer(createJudge({runner,origins:new Set([origin]),trustProxy:true,limits:{body:64*1024,code:32000,inputs:3,queue:8,runPerMinute:3,submitPerMinute:2}}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
const post=(path,data,headers={})=>fetch(url+path,{method:'POST',headers:{'content-type':'application/json',origin,'x-forwarded-for':'1.2.3.4',...headers},body:JSON.stringify(data)}).then(async r=>({status:r.status,body:await r.json()}));
try{
 assert.equal((await fetch(url+'/api/hot100/health').then(r=>r.json())).lessons,100);
 assert.equal((await post('/api/hot100/run',{id:1,code:'x'},{origin:'https://evil.example'})).status,403);
 assert.equal((await post('/api/hot100/run',{id:9999,code:'x'})).status,400);
 assert.equal((await post('/api/hot100/run',{id:1,code:''})).status,400);
 assert.equal((await post('/api/hot100/run',{id:1,code:'x'.repeat(40000)})).status,413);
 let r=await post('/api/hot100/run',{id:1,code:'class Solution{}'});
 assert.equal(r.status,200);assert.equal(r.body.kind,'run');assert.equal(r.body.cases.length,1);assert.equal(r.body.cases[0].status,'passed');
 r=await post('/api/hot100/run',{id:1,code:'class Solution{}',inputs:[{nums:[1,5],target:6}]});
 assert.deepEqual(r.body.cases[0].expected,[0,1]);assert.deepEqual(lastJob.inputs,[{nums:[1,5],target:6}]);
 r=await post('/api/hot100/run',{id:1,code:'x',inputs:[{nums:'bad',target:1}]});
 assert.equal(r.status,400);assert.match(r.body.error,/输入不符合本题要求/);
 r=await post('/api/hot100/run',{id:1,code:'BROKEN'});
 assert.equal(r.body.kind,'compile');assert.equal(r.body.diagnostics[0].line,2);
 r=await post('/api/hot100/run',{id:1,code:'BROKEN'});
 assert.equal(r.status,429,'同一 IP 每分钟最多 3 次运行');
 r=await post('/api/hot100/run',{id:1,code:'BROKEN'},{'x-forwarded-for':'5.6.7.8'});
 assert.equal(r.status,200,'其他 IP 不受影响');
 r=await post('/api/hot100/submit',{id:1,code:'class Solution{}'});
 assert.equal(r.body.kind,'submit');assert.equal(r.body.passed,r.body.total);assert.equal(r.body.failed,undefined);
 assert.equal(lastJob.inputs.length,all.get(1).length);assert.equal(lastJob.timeout,6000);
 r=await post('/api/hot100/submit',{id:1,code:'WRONG'});
 assert.equal(r.body.failed.index,2);assert.equal(r.body.statuses[2],'wrong');assert.ok(r.body.failed.input&&r.body.failed.expected);
 assert.equal((await post('/api/hot100/submit',{id:1,code:'x'})).status,429);
}finally{server.close();}

console.log(`通过：100 道题共 ${total} 组隐藏用例（样例在前、可重现、无重复），判题程序生成、行号保持、输出解析、编译错误定位、判定、限流、排队与 HTTP 接口。`);
