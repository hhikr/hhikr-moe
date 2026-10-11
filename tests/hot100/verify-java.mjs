import {lessons} from '../../public/hot100-assets/lessons.mjs';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {referenceProgram,judgeOutput} from '../../public/hot100-assets/judge.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const home=process.env.JAVA_HOME;
const work=join(root,'.runtime','verify');await mkdir(work,{recursive:true});
const classes=Object.entries(lessons).map(([id,l])=>l.code.replace(new RegExp(`\\b${l.className||'Solution'}\\b`,'g'),`P${id}`).replace(`class P${id}`,`static class P${id}`)).join('\n');
const calls=Object.entries(lessons).map(([id,l])=>{
 const call=(l.call||'').replace('new Solution()',`new P${id}()`);
 if(l.javaScenario)return `{ ${l.javaScenario.replaceAll(l.className||'Solution',`P${id}`)} System.out.println("${id}\\t" + encode(result)); }`;
 return `{ ${l.javaSetup||''} ${l.javaResult?`${call};`:''} System.out.println("${id}\\t" + encode(${l.javaResult||l.javaTransform?.replace('__RESULT__',call)||call})); }`;
}).join('\n');
const java=`import java.util.*;\npublic class Verify {\n${classes}\nstatic String encode(Object x) {return LessonIO.format(x);}\npublic static void main(String[] args) { ${calls} }\n}`;
await writeFile(join(work,'Verify.java'),java,'utf8');
await writeFile(join(work,'LessonIO.java'),await readFile(join(root,'../../tools/hot100-java/LessonIO.java')));
const bin=name=>join(home,'bin',`${name}${process.platform==='win32'?'.exe':''}`);
const compiled=spawnSync(bin('javac'),['-encoding','UTF-8','Verify.java','LessonIO.java'],{cwd:work,encoding:'utf8',timeout:30000,windowsHide:true});
assert.equal(compiled.status,0,compiled.stderr||compiled.error?.message);
const run=spawnSync(bin('java'),['-Dfile.encoding=UTF-8','-cp',work,'Verify'],{encoding:'utf8',timeout:15000,windowsHide:true});
assert.equal(run.status,0,run.stderr||run.error?.message);
function canonical(value,id){return id===49||id===15?value.map(group=>[...group].sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):value;}
let count=0;
for(const row of run.stdout.trim().split(/\r?\n/)){
 const [idText,encoded]=row.split('\t'),id=Number(idText),l=lessons[id];
 const actual=JSON.parse(encoded);assert.deepEqual(canonical(actual,id),canonical(l.expected,id),`Java sample ${id}`);
 const trace=l.trace(l.raw);if('answer' in trace.at(-1))assert.deepEqual(canonical(trace.at(-1).answer,id),canonical(actual,id),`Trace vs Java ${id}`);
 count++;
}
assert.equal(count,Object.keys(lessons).length);
console.log(`通过：${count} 道 Java 参考解法实际编译运行，示例结果与课程答案及动画一致。`);
const programs=Object.entries(lessons).map(([id,l])=>referenceProgram(l).replace(/^import java\.util\.\*;\s*/,'').replace(new RegExp(`\\b${l.className||'Solution'}\\b`,'g'),`P${id}`).replace(`class P${id}`,`static class P${id}`).replace('public class Main',`static class Runner${id}`)).join('\n');
const runners=Object.keys(lessons).map(id=>`System.out.print("${id}\\t"); Runner${id}.main(new String[0]);`).join('\n');
await writeFile(join(work,'VerifyEditor.java'),`import java.util.*; public class VerifyEditor { ${programs} public static void main(String[] args) { ${runners} } }`,'utf8');
const editorCompile=spawnSync(bin('javac'),['-encoding','UTF-8','VerifyEditor.java','LessonIO.java'],{cwd:work,encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(editorCompile.status,0,editorCompile.stderr);
const editorRun=spawnSync(bin('java'),['-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','-cp',work,'VerifyEditor'],{encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(editorRun.status,0,editorRun.stderr);let editorCount=0;
for(const row of editorRun.stdout.trim().split(/\r?\n/)){const [idText,encoded]=row.split('\t'),id=Number(idText),l=lessons[id];assert.equal(judgeOutput(id,encoded,l.expected,l.sample||JSON.parse(l.raw)).kind,'passed',`Editor runner ${id}`);editorCount++;}
assert.equal(editorCount,Object.keys(lessons).length);console.log(`通过：${editorCount} 道题编辑器生成的完整 Main 程序编译运行并通过示例比对。`);
