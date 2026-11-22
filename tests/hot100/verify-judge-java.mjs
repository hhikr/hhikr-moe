// End-to-end judge check with a real JDK (JAVA_HOME or java on PATH; set HOT100_SANDBOX=bwrap on
// Linux to go through the sandbox too). Every lesson's reference solution must pass every hidden
// case, and broken programs must be reported the way the page expects.
import assert from 'node:assert/strict';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
import {allCases} from '../../tools/hot100-judge/cases.mjs';
import {Compiler,javaBinary,runProgram,workFolder} from '../../tools/hot100-judge/java.mjs';
import {verdicts} from '../../tools/hot100-judge/server.mjs';

const sandbox=process.env.HOT100_SANDBOX||'none',java=sandbox==='bwrap'?(process.env.HOT100_SANDBOX_JAVA||'/usr/bin/java'):javaBinary();
const compiler=new Compiler({java:javaBinary(),work:await workFolder()});
try{await compiler.start();}catch(e){console.log(`跳过：没有可用的 JDK（${e.message.split('\n')[0]}）`);process.exit(0);}
const run=(lesson,code,inputs,timeout=8000)=>runProgram({compiler,lesson,code,inputs,sandbox,java,timeout});
const failures=[],times=[];let cases=0;
try{
 for(const [id,list] of allCases()){
  const lesson=lessons[id],started=Date.now();
  const result=await run(lesson,lesson.code,list.map(c=>c.input));
  times.push(Date.now()-started);
  if(result.kind==='compile'){failures.push(`${id} 参考解法编译失败：${JSON.stringify(result.diagnostics)}`);continue;}
  verdicts(id,result,list).forEach((v,i)=>{cases++;if(v.status!=='passed')failures.push(`${id}#${i} ${v.status} 输入 ${JSON.stringify(v.input)} 预期 ${JSON.stringify(v.expected)} 实际 ${JSON.stringify(v.actual)} ${v.message||''}`);});
 }
 assert.deepEqual(failures,[],failures.slice(0,20).join('\n'));

 const one=lessons[1],sample=[one.sample];
 // The starter throws UnsupportedOperationException: reported as an error, not a crash.
 let r=await run(one,one.practice,sample);
 assert.equal(r.kind,'run');assert.equal(r.results.get(0).status,'error');assert.match(r.results.get(0).value,/UnsupportedOperationException: 请在这里实现解法/);
 assert.match(r.results.get(0).value,/第 \d+ 行/);
 // Compile errors carry the editor's line numbers and Chinese messages.
 r=await run(one,'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        int x = "a";\n        return null;\n    }\n}',sample);
 assert.equal(r.kind,'compile');assert.equal(r.diagnostics[0].line,3);assert.match(r.diagnostics[0].message,/不兼容的类型/);
 // Renaming the method breaks the harness call: reported as such.
 r=await run(one,'class Solution { public int[] two(int[] a, int t) { return a; } }',sample);
 assert.equal(r.kind,'compile');assert.ok(r.diagnostics.some(d=>d.harness));
 // Debug prints are captured apart from the result; public class Solution is accepted.
 r=await run(one,'public class Solution { public int[] twoSum(int[] nums, int target) { System.out.println("debug"); return new int[]{0,1}; } }',sample);
 assert.equal(r.results.get(0).value,'[0,1]');assert.equal(r.results.get(0).printed.trim(),'debug');
 // Infinite loop: killed at the time limit.
 r=await run(one,'class Solution { public int[] twoSum(int[] nums, int target) { while (true) {} } }',sample,2500);
 assert.equal(r.reason,'timeout');assert.equal(verdicts(1,r,[{input:one.sample,expected:one.expected}])[0].status,'timeout');
 // System.exit ends the program early.
 r=await run(one,'class Solution { public int[] twoSum(int[] nums, int target) { System.exit(3); return null; } }',sample);
 assert.equal(r.results.size,0);assert.equal(verdicts(1,r,[{input:one.sample,expected:one.expected}])[0].status,'error');
 // Deep recursion is fine with the large stack; runaway recursion is a StackOverflowError.
 r=await run(lessons[70],'class Solution { int f(int n){ return n==0?0:1+f(n-1);} public int climbStairs(int n) { return f(200000)>0?f(-1):0; } }',[lessons[70].sample]);
 assert.match(r.results.get(0).value,/StackOverflowError/);
 if(sandbox==='bwrap'){
  // No network and no readable home inside the sandbox.
  r=await run(one,'class Solution { public int[] twoSum(int[] nums, int target) { try { new java.net.Socket("1.1.1.1", 80); return new int[]{9}; } catch (Exception e) { return new int[]{0,1}; } } }',sample);
  assert.equal(r.results.get(0).value,'[0,1]','沙箱内不能联网');
  r=await run(one,'class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{new java.io.File("/etc/passwd").exists()?9:0, new java.io.File("/opt").exists()?9:1}; } }',sample);
  assert.equal(r.results.get(0).value,'[0,1]','沙箱内看不到宿主文件');
 }
}finally{compiler.close();}
times.sort((a,b)=>a-b);
console.log(`通过：${cases} 组隐藏用例全部被参考解法通过（沙箱：${sandbox}；每题一次编译+运行，中位 ${times[times.length>>1]} ms，最慢 ${times.at(-1)} ms）；起始代码、编译错误、改名、调试输出、死循环、System.exit、栈溢出${sandbox==='bwrap'?'、断网、文件隔离':''}均按预期处理。`);
