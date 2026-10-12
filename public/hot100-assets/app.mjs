import {catalog,categories} from './catalog.mjs';
import {lessons} from './lessons.mjs';
import {diagram} from './diagrams.mjs';
import {attachEditor} from './editor.mjs';
import {judgeOutput,referenceProgram} from './judge.mjs';
import {captureMotion,animateMotion} from './motion.mjs';
import {JavaClient} from './java-client.mjs';
import {prepareDemo} from './demo-input.mjs';
const $ = id => document.getElementById(id);
const codeEditor=attachEditor($('editor'));
const javaClient=new JavaClient({sameOrigin:document.querySelector('.hot100').dataset.javaRuntime==='companion'});
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save = (key,value) => {try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
let done=new Set(read('hot100-preview-done',[])),selected=1,filter='all',steps=[],index=0,timer=null,lesson=null,token='',suggestionIndex=0,suggestions=[];
let suggestionRequest=0,suggestionTimer=null;
let running=false,environmentAvailable=false;
let demoSession=null;

const methodNames={'哈希':'HASH MAP','双指针':'TWO POINTERS','二分查找':'BINARY SEARCH','动态规划':'DYNAMIC PROGRAMMING'};
function renderCatalog(){
 $('only-demo').textContent=`可播放演示 · ${Object.keys(lessons).length}`;
 const query=$('search').value.trim().toLowerCase();
 let count=0;
 $('catalog').innerHTML=categories.map(category=>{
   const entries=catalog.filter(q=>q.category===category&&`${q.id} ${q.title} ${category}`.toLowerCase().includes(query)&&(filter!=='demo'||lessons[q.id])&&(filter!=='done'||done.has(q.id)));
   count+=entries.length;if(!entries.length)return '';
   return `<details class="group" ${query||entries.some(q=>q.id===selected)||filter!=='all'?'open':''}><summary><b>${category}</b><span>${entries.length}</span></summary>${entries.map(q=>`<button data-id="${q.id}" class="${q.id===selected?'active':''}" ${q.id===selected?'aria-current="true"':''}><span class="qid">${String(q.id).padStart(3,'0')}</span><span class="qtitle">${q.title}</span>${done.has(q.id)?'<span class="done-dot" aria-label="已掌握">✓</span>':lessons[q.id]?'<span class="demo-dot" aria-label="可播放演示"></span>':''}</button>`).join('')}</details>`;
 }).join('')||'<p class="empty">没有符合条件的题目。</p>';
 $('progress-count').textContent=`${done.size} / 100`;$('progress').value=done.size;
 $('all').classList.toggle('selected',filter==='all');$('only-demo').classList.toggle('selected',filter==='demo');$('only-done').classList.toggle('selected',filter==='done');
}
function pause(){clearTimeout(timer);timer=null;$('play').textContent='播放演示';}
function setTab(practice){$('learn-tab').setAttribute('aria-selected',String(!practice));$('practice-tab').setAttribute('aria-selected',String(practice));$('learn-view').hidden=practice;$('practice-view').hidden=!practice;if(practice){pause();codeEditor.render();}}
function highlight(line){return escape(line).replace(/\b(class|public|static|int|void|for|if|else|return|throw|new|while|import)\b/g,'<span class="kw">$1</span>').replace(/\b(Solution|Main|Map|Integer|HashMap|IllegalArgumentException)\b/g,'<span class="type">$1</span>');}
function select(id){
 pause();selected=id;const q=catalog.find(q=>q.id===id);if(!q)return;
 $('bars')?.replaceChildren();$('cells').replaceChildren();
 lesson=lessons[id];index=0;
 $('verdict').hidden=true;$('jump-error').hidden=true;$('undo-draft').hidden=read(`hot100-preview-backup-${id}`,null)===null;
 $('category').textContent=q.category;$('method').textContent=methodNames[q.category]||q.category;$('title').textContent=q.title;$('number').textContent=`#${q.id}`;$('position').textContent=`${String(catalog.indexOf(q)+1).padStart(2,'0')} / 100`;
 $('difficulty').textContent=q.difficulty;$('difficulty').className=`badge ${q.level}`;
 $('complete').textContent=done.has(id)?'已掌握 ✓':'标记掌握';$('complete').classList.toggle('completed',done.has(id));
 $('pending').hidden=!!lesson;$('demo').hidden=!lesson;$('practice-tab').disabled=!lesson;$('description').textContent=lesson?.description||'目录已收录；完整课程内容将在正式实现中补齐。';
 $('input').textContent=lesson?.input||'待补齐';$('output').textContent=lesson?.output||'待补齐';$('time').textContent=lesson?`时间 ${lesson.time}`:'';$('space').textContent=lesson?`空间 ${lesson.space}`:'';
 $('official').href=`https://leetcode.cn/problemset/?search=${id}`;
 if(lesson){$('idea').textContent=lesson.idea;$('invariant').textContent=lesson.invariant;$('raw').value=read(`hot100-demo-input-${id}`,lesson.raw);$('expected-output').value=read(`hot100-demo-expected-${id}`,'');$('code').innerHTML=lesson.code.split('\n').map((line,i)=>`<span class="code-line" data-line="${i+1}"><span class="ln">${i+1}</span>${highlight(line)}</span>`).join('');$('editor').value=read(`hot100-preview-draft-${id}`,lesson.practice);$('result').textContent='尚未运行。';$('stdin').value=read(`hot100-preview-stdin-${id}`,'');$('input-error').textContent='';try{demoSession=prepareDemo(lesson,$('raw').value,$('expected-output').value);}catch{$('raw').value=lesson.raw;$('expected-output').value='';demoSession=prepareDemo(lesson,lesson.raw);}$('demo-status').textContent=demoSession.raw===lesson.raw?'当前使用题目示例':'已载入自定义输入';steps=demoSession.frames;renderFrame();}
 setTab(false);renderCatalog();history.replaceState(null,'',`/hot100/${id}/`);document.title=`${q.title} · Hot 100 · Hitchhiker`;document.querySelector('link[rel=canonical]')?.setAttribute('href',`https://hhikr.moe/hot100/${id}/`);
 $('practice-example').textContent=`比对目标为本题原始示例。输入：${lesson.input}；预期输出：${lesson.output}`;
}
function renderFrame(){
 const f=steps[index];if(!f)return;
 let bars=$('bars');if(!bars){bars=document.createElement('div');bars.id='bars';$('cells').before(bars);}const previous=captureMotion(bars,$('cells'));bars.innerHTML=diagram(selected,f);bars.hidden=!bars.innerHTML;bars.classList.toggle('structure',!!(f.visual?.nodes||f.visual?.heaps||f.visual?.network||f.visual?.searchPath));
 const structure=bars.querySelector('svg.structure-diagram');if(structure){const width=Number(structure.getAttribute('viewBox').split(' ')[2]);structure.style.minWidth=`${Math.min(1440,width)}px`;}
 $('timeline').max=String(steps.length-1);$('timeline').value=String(index);$('step-label').textContent=`${index+1} / ${steps.length}`;$('visual-title').textContent=lesson.valueLabel||(lesson.mode==='dp'?'状态 / f(i)':'数组 / nums');
 const pointerNames=['read','write','mid','left','right','i','destination'];
 $('cells').classList.toggle('matrix',!!f.columns);$('cells').style.gridTemplateColumns=f.columns?`repeat(${f.columns}, minmax(28px, 48px))`:'';
 $('cells').innerHTML=f.values.map((v,i)=>`<div data-index="${i}" class="cell ${f.active.includes(i)?'active':''}"><div class="pointer-label">${f.columns?'':pointerNames.filter(p=>(selected===70&&p==='i'?f.vars[p]-1:f.vars[p])===i).map(p=>`<span data-pointer="${p}">${p}</span>`).join(' / ')}</div><strong>${escape(v)}</strong><span>${f.columns?`(${Math.floor(i/f.columns)},${i%f.columns})`:lesson.mode==='dp'?`f(${i+1})`:i}</span></div>`).join('');
 $('variables').innerHTML=Object.entries(f.vars).map(([key,v])=>`<span data-variable="${escape(key)}">${escape(key)} = <b>${escape(v)}</b></span>`).join('');
 $('memory-title').textContent=lesson.stateLabel||(selected===1?'哈希表 / seen':'当前状态');
 $('stored').innerHTML=f.stored.length?f.stored.map(([key,v])=>`<span class="entry" data-entry="${escape(key)}">${escape(key)} → ${escape(v)}</span>`).join(''):selected===1?'∅ 空表':lesson.mode==='dp'?'高亮格子显示状态转移的来源和结果。':selected===35?`候选区间 [${f.vars.left}, ${f.vars.right})`:selected===283?`非零前缀长度：${f.vars.write??0}`:'尚无记录';
 $('note').textContent=f.note;
 document.querySelectorAll('.code-line').forEach(el=>{el.classList.toggle('current',Number(el.dataset.line)===f.line);if(Number(el.dataset.line)===f.line)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
 const current=document.querySelector('.code-line.current');if(current){const container=$('code');const y=current.offsetTop-container.offsetTop;if(y<container.scrollTop||y>container.scrollTop+container.clientHeight-30)container.scrollTop=Math.max(0,y-container.clientHeight/2);}
 if(f.columns&&f.active.length){const cell=$('cells').querySelector(`[data-index="${f.active.at(-1)}"]`);if(cell){const bounds=$('cells').getBoundingClientRect(),target=cell.getBoundingClientRect();if(target.right>bounds.right)$('cells').scrollLeft+=target.right-bounds.right+8;else if(target.left<bounds.left)$('cells').scrollLeft-=bounds.left-target.left+8;}}
 animateMotion(previous,bars,$('cells'),{duration:Math.min(680,Number($('speed').value)*.72),mode:lesson.mode});
 const finished=index===steps.length-1;
 $('demo-output').textContent=finished?JSON.stringify(demoSession.actual):'播放到最后查看';
 $('demo-comparison').textContent=finished?(demoSession.hasExpected?demoSession.matched?'与预期输出一致':`与预期输出不同。预期：${demoSession.expectedRaw}`:'可以填写预期输出，核对本次结果。'):'';
 $('demo-comparison').className=finished&&demoSession.hasExpected?(demoSession.matched?'matched':'mismatched'):'';
 $('prev').disabled=index===0;$('next').disabled=index===steps.length-1;
}
function tick(){if(index>=steps.length-1){pause();return;}index++;renderFrame();timer=setTimeout(tick,Number($('speed').value));}
function play(){if(timer){pause();return;}if($('raw').value!==demoSession.raw||$('expected-output').value!==demoSession.expectedRaw){applyDemo(true);return;}if(index===steps.length-1){index=0;renderFrame();}$('play').textContent='暂停';timer=setTimeout(tick,Number($('speed').value));}
function applyDemo(start=true){
 pause();
 try{const generated=prepareDemo(lesson,$('raw').value,$('expected-output').value);demoSession=generated;steps=generated.frames;index=0;$('bars')?.replaceChildren();$('cells').replaceChildren();$('input-error').textContent='';$('raw').removeAttribute('aria-invalid');$('expected-output').removeAttribute('aria-invalid');save(`hot100-demo-input-${selected}`,generated.raw);save(`hot100-demo-expected-${selected}`,generated.expectedRaw);$('demo-status').textContent=`已生成 ${steps.length} 步 · 使用当前输入`;renderFrame();if(start)play();return true;}
 catch(e){$('input-error').textContent=`无法生成演示：${e.message}`;$('demo-status').textContent='请修正输入或预期输出';(e.message.startsWith('预期输出')?$('expected-output'):$('raw')).setAttribute('aria-invalid','true');return false;}
}
function ensureDemo(){return $('raw').value===demoSession.raw&&$('expected-output').value===demoSession.expectedRaw||applyDemo(false);}
function updateRunButtons(){for(const id of ['run','check-sample'])$(id).disabled=running||!environmentAvailable;}
function updateLaunch(){const command=document.querySelector('.hot100')?.dataset.javaLaunch||'node .hot100-preview/server.mjs';const value=Number($('java-port').value),port=Number.isInteger(value)&&value>=1024&&value<=65535?value:4337;$('java-launch').textContent=`${command} --port ${port} --site ${location.origin}`;}
async function environment(){
 token='';environmentAvailable=false;updateRunButtons();$('environment').textContent='正在连接本机 Java 服务…';
 try{if(!javaClient.sameOrigin){javaClient.setPort($('java-port').value);save('hot100-java-port',Number($('java-port').value));}const data=await javaClient.environment();token=javaClient.token;environmentAvailable=data.available;$('environment').textContent=data.available?data.version:'未检测到 JDK。安装 JDK 17 或更高版本，并将 java、javac 加入 PATH 后重启本机服务。';}
 catch(e){javaClient.disconnect();$('environment').textContent=e.name==='AbortError'?'连接本机 Java 服务超时，请检查服务是否已启动。':/fetch/i.test(e.message)?'无法连接本机 Java 服务。请启动服务，并允许当前网站来源。':e.message;}
 finally{document.querySelector('.status-dot').classList.toggle('ready',environmentAvailable);$('disconnect').hidden=javaClient.sameOrigin||!javaClient.token;updateRunButtons();}
}
async function run(check=false){
 if(running||!environmentAvailable)return;
 const id=selected,currentLesson=lesson,code=$('editor').value,stdin=$('stdin').value;
 running=true;updateRunButtons();$('verdict').hidden=true;$('jump-error').hidden=true;$('result').textContent='正在编译并运行…';
 try{
  const data=await javaClient.run(code,stdin);
  if(selected!==id)return;
  $('result').textContent=data.error||`${data.stdout||'(无标准输出)'}${data.stderr?`\n标准错误：\n${data.stderr}`:''}\n退出码：${data.exitCode}`;
  const errorLine=data.error?.match(/Main\.java:(\d+):/);$('jump-error').hidden=!errorLine;if(errorLine)$('jump-error').onclick=()=>codeEditor.jump(Number(errorLine[1]));
  if(check){const verdict=data.error||data.exitCode!==0?{kind:'error',message:'程序未正常完成，请先修正编译错误或运行异常。'}:judgeOutput(id,data.stdout,currentLesson.expected,currentLesson.sample||JSON.parse(currentLesson.raw));$('verdict').hidden=false;$('verdict').className=`verdict ${verdict.kind}`;$('verdict').textContent=verdict.message;}
 }catch(e){if(selected===id)$('result').textContent=`无法运行：${e.message}`;}finally{running=false;updateRunButtons();}
}
const snippets=[
 ['sout','System.out.println();','标准输出'],['fori','for (int i = 0; i < n; i++) {\n    \n}','下标循环'],['foreach','for (int value : nums) {\n    \n}','遍历数组'],['map','Map<Integer, Integer> map = new HashMap<>();','哈希表'],['set','Set<Integer> set = new HashSet<>();','集合'],['list','List<Integer> list = new ArrayList<>();','动态数组'],['queue','Deque<Integer> queue = new ArrayDeque<>();','双端队列'],['scanner','Scanner sc = new Scanner(System.in);','读取标准输入'],['sort','Arrays.sort(nums);','数组排序'],['binarySearch','Arrays.binarySearch(nums, target)','二分查找'],['getOrDefault','getOrDefault(key, 0)','哈希表默认值'],['containsKey','containsKey(key)','键是否存在'],['put','put(key, value)','写入键值'],['get','get(key)','读取值'],['add','add(value)','添加元素'],['offer','offer(value)','入队'],['poll','poll()','出队'],['size','size()','元素数量'],['length','length','数组长度'],['length()','length()','字符串长度'],['charAt','charAt(index)','字符读取'],['substring','substring(start, end)','截取子串'],['int','int ','整型'],['return','return ','返回'],['while','while (condition) {\n    \n}','循环'],['if','if (condition) {\n    \n}','条件分支']
];
async function suggest(force=false){
 const editor=$('editor'),code=editor.value,cursor=editor.selectionStart,before=code.slice(0,cursor),prefix=before.match(/[A-Za-z][A-Za-z0-9]*$/)?.[0]||'',request=++suggestionRequest;
 suggestions=snippets.filter(([key])=>force||prefix.length>=2&&key.toLowerCase().startsWith(prefix.toLowerCase())).slice(0,10);suggestionIndex=0;drawSuggestions();
 if(token&&/\.[A-Za-z0-9_$]*$/.test(before)){
  try{
   const {items}=await javaClient.complete(code,cursor);
   if(request!==suggestionRequest||editor.value!==code||editor.selectionStart!==cursor)return;
   if(items.length){suggestions=items.map(item=>[item.label,item.insertText,item.detail,item.parameterCount]);suggestionIndex=0;drawSuggestions();}
  }catch{}
 }
}
function drawSuggestions(){const box=$('suggestions');box.hidden=!suggestions.length;box.innerHTML=suggestions.map(([key,,label],i)=>`<button role="option" aria-selected="${i===suggestionIndex}" data-suggestion="${i}" class="${i===suggestionIndex?'selected':''}">${escape(key)} <span> · ${escape(label)}</span></button>`).join('');}
function insertSuggestion(i){const editor=$('editor'),prefix=editor.value.slice(0,editor.selectionStart).match(/[A-Za-z][A-Za-z0-9]*$/)?.[0]||'';const end=editor.selectionStart,item=suggestions[i];editor.setRangeText(item[1],end-prefix.length,end,'end');if(item[3]>0)editor.setSelectionRange(editor.selectionStart-1,editor.selectionStart-1);suggestionRequest++;suggestions=[];drawSuggestions();saveDraft();editor.focus();}
function saveDraft(){save(`hot100-preview-draft-${selected}`,$('editor').value);codeEditor.render();}
function replaceDraft(code){save(`hot100-preview-backup-${selected}`,$('editor').value);$('editor').value=code;saveDraft();$('undo-draft').hidden=false;}
$('catalog').addEventListener('click',e=>{const button=e.target.closest('[data-id]');if(button)select(Number(button.dataset.id));});
$('search').addEventListener('input',renderCatalog);
for(const [id,value]of[['all','all'],['only-demo','demo'],['only-done','done']])$(id).onclick=()=>{filter=value;renderCatalog();};
$('complete').onclick=()=>{if(done.has(selected))done.delete(selected);else done.add(selected);save('hot100-preview-done',[...done]);$('complete').textContent=done.has(selected)?'已掌握 ✓':'标记掌握';$('complete').classList.toggle('completed',done.has(selected));renderCatalog();};
$('play').onclick=play;$('reset').onclick=()=>{pause();if(!ensureDemo())return;index=0;renderFrame();};$('prev').onclick=()=>{pause();if(!ensureDemo())return;index=Math.max(0,index-1);renderFrame();};$('next').onclick=()=>{pause();if(!ensureDemo())return;index=Math.min(steps.length-1,index+1);renderFrame();};$('timeline').oninput=()=>{pause();const desired=Number($('timeline').value);if(!ensureDemo())return;index=Math.min(steps.length-1,desired);renderFrame();};$('speed').onchange=()=>{if(timer){pause();play();}};
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||$('learn-view').hidden)return;
 if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog[open]'))return;
 if(document.querySelector('dialog[open]'))return;
 const key=event.key.toLowerCase();if(key!=='a'&&key!=='d')return;
 event.preventDefault();$(key==='a'?'prev':'next').click();
});
$('apply').onclick=()=>applyDemo(true);
$('example-input').onclick=()=>{$('raw').value=lesson.raw;$('expected-output').value=lesson.output;applyDemo(false);};
for(const id of ['raw','expected-output'])$(id).oninput=()=>{pause();$('demo-status').textContent='已修改 · 点击生成并播放';$('input-error').textContent='';$('demo-output').textContent='输入已修改，等待重新生成';$('demo-comparison').textContent='';$(id).removeAttribute('aria-invalid');};
$('learn-tab').onclick=()=>setTab(false);$('practice-tab').onclick=()=>setTab(true);$('go-practice').onclick=()=>setTab(true);

$('detect').onclick=environment;$('run').onclick=()=>run(false);$('check-sample').onclick=()=>run(true);$('restore').onclick=()=>replaceDraft(lesson.practice);
$('reference').onclick=()=>replaceDraft(referenceProgram(lesson));
$('undo-draft').onclick=()=>{const backup=read(`hot100-preview-backup-${selected}`,null);if(backup!==null)replaceDraft(backup);};
$('disconnect').onclick=()=>{javaClient.disconnect();token='';environmentAvailable=false;$('disconnect').hidden=true;$('environment').textContent='已断开本机 Java 服务。课程、动画和草稿仍可使用。';document.querySelector('.status-dot').classList.remove('ready');suggestionRequest++;suggestions=[];drawSuggestions();updateRunButtons();};
$('java-port').oninput=()=>{javaClient.disconnect();token='';environmentAvailable=false;$('disconnect').hidden=true;$('environment').textContent='服务端口已修改，请重新连接。';document.querySelector('.status-dot').classList.remove('ready');updateRunButtons();updateLaunch();};
$('editor').oninput=()=>{saveDraft();suggestionRequest++;clearTimeout(suggestionTimer);suggestionTimer=setTimeout(()=>suggest(),250);};$('stdin').oninput=()=>save(`hot100-preview-stdin-${selected}`,$('stdin').value);
$('editor').onkeydown=e=>{if(e.ctrlKey&&e.code==='Space'){e.preventDefault();clearTimeout(suggestionTimer);suggest(true);return;}if(e.key==='Escape'){suggestionRequest++;clearTimeout(suggestionTimer);suggestions=[];drawSuggestions();return;}if(suggestions.length){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();suggestionIndex=(suggestionIndex+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length;drawSuggestions();return;}if(e.key==='Tab'){e.preventDefault();insertSuggestion(suggestionIndex);return;}}if(e.key==='Tab'){e.preventDefault();const editor=$('editor');editor.setRangeText('    ',editor.selectionStart,editor.selectionEnd,'end');saveDraft();}};
$('suggestions').onmousedown=e=>{const button=e.target.closest('[data-suggestion]');if(button){e.preventDefault();insertSuggestion(Number(button.dataset.suggestion));}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
const routeId=Number(location.hash.slice(1))||Number(document.querySelector('.hot100').dataset.lesson);select(catalog.some(q=>q.id===routeId)?routeId:1);
$('java-port-field').hidden=javaClient.sameOrigin;$('connection-help').hidden=javaClient.sameOrigin;
$('java-port').value=read('hot100-java-port',4337);updateLaunch();
$('detect').textContent=javaClient.sameOrigin?'重新检测':'连接本机 Java';updateRunButtons();
if(javaClient.sameOrigin)environment();else $('environment').textContent='连接本机练习服务后，可使用 Java 类型提示和编译运行。';
