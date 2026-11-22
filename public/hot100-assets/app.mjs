import {catalog,categories,categoryLabels} from './catalog.mjs';
import {lessons} from './lessons.mjs';
import {diagram} from './diagrams.mjs';
import {attachEditor} from './editor.mjs';
import {judgeOutput,referenceProgram} from './judge.mjs';
import {captureMotion,animateMotion} from './motion.mjs';
import {JavaClient} from './java-client.mjs';
import {prepareDemo} from './demo-input.mjs';
import {fieldsFor,expectedField,formatFields,formatValue,parseValue,toRaw,splitAssignments,exampleText} from './friendly-input.mjs';
const $ = id => document.getElementById(id);
const root=document.querySelector('.hot100');
const codeEditor=attachEditor($('editor'));
const javaClient=new JavaClient({sameOrigin:root.dataset.javaRuntime==='companion'});
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save = (key,value) => {try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const pad = n => String(n).padStart(2,'0');
const lessonPath = id => `/hot100/${id}/`;
let done=new Set(read('hot100-preview-done',[])),selected=1,filter='all',steps=[],index=0,timer=null,lesson=null,token='',suggestionIndex=0,suggestions=[];
let suggestionRequest=0,suggestionTimer=null;
let running=false,environmentAvailable=false;
let demoSession=null,demoDirty=false,expectedSpec=null;
// Monaco replaces the textarea once it has loaded; the textarea stays as the fallback and always holds the code.
let monacoEditor=null,editorLoading=null;
function setCode(code,{undoable=true}={}){
 $('editor').value=code;codeEditor.render();
 if(monacoEditor){if(undoable)monacoEditor.setValue(code);else monacoEditor.model.setValue(code);}
}
function ensureMonaco(){
 if(monacoEditor||editorLoading||typeof window.hot100LoadEditor!=='function')return editorLoading;
 $('editor-hint').textContent='正在加载编辑器…';
 editorLoading=window.hot100LoadEditor().then(mod=>{
  monacoEditor=mod.createEditor($('monaco'),{value:$('editor').value,uri:'inmemory://hot100/Main.java',
   onChange:value=>{$('editor').value=value;saveDraft();},onRun:()=>run(false),onSubmit:()=>run(true)});
  root.classList.add('has-monaco');$('editor-hint').textContent='Ctrl + Space 提示 · Ctrl + Enter 运行 · Ctrl + Z 撤销';
  return monacoEditor;
 }).catch(error=>{console.warn('Monaco 加载失败，改用简易编辑器',error);editorLoading=null;$('editor-hint').textContent='Ctrl + Space 提示 · Tab 插入';});
 return editorLoading;
}
function showCompileErrors(text){
 const markers=[...String(text).matchAll(/Main\.java:(\d+): (?:error|错误): ([^\n]+)/g)].map(m=>({line:Number(m[1]),message:m[2]}));
 monacoEditor?.setMarkers('javac',markers);return markers;
}

// ---------------------------------------------------------------- catalog
function matchesFilter(q){return filter==='all'||(filter==='done'?done.has(q.id):q.level===filter);}
function renderCatalog(){
 const query=$('search').value.trim().toLowerCase();
 $('catalog').innerHTML=categories.map(category=>{
   const entries=catalog.filter(q=>q.category===category&&`${q.id} ${q.title} ${category}`.toLowerCase().includes(query)&&matchesFilter(q));
   if(!entries.length)return '';
   const doneCount=entries.filter(q=>done.has(q.id)).length;
   return `<details class="group" ${query||entries.some(q=>q.id===selected)||filter!=='all'?'open':''}><summary><b>${category}</b><span>${doneCount?`${doneCount}/`:''}${entries.length}</span></summary>${entries.map(q=>`<a href="${lessonPath(q.id)}" data-id="${q.id}" class="${q.id===selected?'active':''}" ${q.id===selected?'aria-current="page"':''}><span class="qid">${String(q.id).padStart(3,'0')}</span><span class="qtitle">${q.title}</span><span class="level ${q.level}" title="${q.difficulty}">${q.difficulty}</span>${done.has(q.id)?'<span class="done-dot" aria-label="我会了">✓</span>':''}</a>`).join('')}</details>`;
 }).join('')||'<p class="empty">没有符合条件的题目。</p>';
 $('progress-count').textContent=`${done.size} / ${catalog.length}`;$('progress').value=done.size;
 for(const button of document.querySelectorAll('.filters [data-filter]')){const on=button.dataset.filter===filter;button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on));}
}
const narrow=()=>matchMedia('(max-width: 760px)').matches;
function setDrawer(open){
 $('sidebar').classList.toggle('open',open);$('catalog-backdrop').hidden=!open;$('open-catalog').setAttribute('aria-expanded',String(open));
 document.documentElement.classList.toggle('hot100-drawer-open',open);
 if(open){
  // Bring the current lesson into view inside the drawer only; scrollIntoView would move the page too.
  const sidebar=$('sidebar'),active=$('catalog').querySelector('.active');
  if(active)sidebar.scrollTop=active.getBoundingClientRect().top-sidebar.getBoundingClientRect().top+sidebar.scrollTop-sidebar.clientHeight/2;
  // Focus the current lesson rather than the search box, so phones do not pop up the keyboard.
  (active||$('close-catalog')).focus({preventScroll:true});
 }
 else if(document.activeElement&&$('sidebar').contains(document.activeElement))$('open-catalog').focus({preventScroll:true});
}

// ---------------------------------------------------------------- lesson
function pause(){clearTimeout(timer);timer=null;$('play').textContent='播放';}
function setTab(practice){$('learn-tab').setAttribute('aria-selected',String(!practice));$('practice-tab').setAttribute('aria-selected',String(practice));$('learn-view').hidden=practice;$('practice-view').hidden=!practice;if(practice){pause();codeEditor.render();ensureMonaco();monacoEditor?.layout();}}
function highlight(line){return escape(line).replace(/\b(class|public|static|int|void|for|if|else|return|throw|new|while|import)\b/g,'<span class="kw">$1</span>').replace(/\b(Solution|Main|Map|Integer|HashMap|IllegalArgumentException)\b/g,'<span class="type">$1</span>');}
function stepLink(id,target){const a=$(id);a.hidden=!target;if(target){a.href=lessonPath(target.id);a.title=target.title;}else a.removeAttribute('href');}
function select(id,{history:mode='replace',scroll=false}={}){
 pause();const position=catalog.findIndex(q=>q.id===id);const q=catalog[position];if(!q)return;
 selected=id;save('hot100-last',id);
 $('bars')?.replaceChildren();$('cells').replaceChildren();
 lesson=lessons[id];index=0;
 $('verdict').hidden=true;$('jump-error').hidden=true;$('undo-draft').hidden=read(`hot100-preview-backup-${id}`,null)===null;
 $('category').textContent=q.category;$('method').textContent=categoryLabels[q.category]||q.category;$('title').textContent=q.title;$('number').textContent=`#${q.id}`;$('position').textContent=`${pad(position+1)} / ${catalog.length}`;
 $('difficulty').textContent=q.difficulty;$('difficulty').className=`badge ${q.level}`;
 $('leetcode').href=`https://leetcode.cn/problemset/?search=${encodeURIComponent(q.title)}`;
 updateCompletion();
 const prev=catalog[position-1],next=catalog[position+1];
 stepLink('prev-lesson',prev);stepLink('next-lesson',next);
 $('next-card').hidden=!next;if(next){$('next-card').href=lessonPath(next.id);$('next-title').textContent=`${next.title} →`;}
 $('description').textContent=lesson.description;$('input').textContent=exampleText(lesson);$('output').textContent=lesson.output;$('time').textContent=`时间 ${lesson.time}`;$('space').textContent=`空间 ${lesson.space}`;
 $('idea').textContent=lesson.idea;$('invariant').textContent=lesson.invariant;
 $('code').innerHTML=lesson.code.split('\n').map((line,i)=>`<span class="code-line" data-line="${i+1}"><span class="ln">${i+1}</span>${highlight(line)}</span>`).join('');
 setCode(read(`hot100-preview-draft-${id}`,lesson.practice),{undoable:false});monacoEditor?.setMarkers('javac',[]);$('result').textContent='尚未运行。';$('stdin').value=read(`hot100-preview-stdin-${id}`,'');
 loadDemoInput();
 setTab(false);renderCatalog();
 const path=lessonPath(id);
 if(mode==='push'&&location.pathname!==path)history.pushState({id},'',path);else if(mode==='replace')history.replaceState({id},'',path);
 document.title=`${q.title} · Hot 100 · Hitchhiker`;document.querySelector('link[rel=canonical]')?.setAttribute('href',`https://hhikr.moe${path}`);
 $('practice-example').textContent=`比对目标为本题原始示例。输入：${lesson.input}；预期输出：${lesson.output}`;
 if(scroll)document.querySelector('.workspace').scrollIntoView({block:'start'});
}
function updateCompletion(){const on=done.has(selected);$('complete').textContent=on?'我会了 ✓':'我会了';$('complete').classList.toggle('completed',on);$('complete').setAttribute('aria-pressed',String(on));}
function go(id,options={}){if(id===selected)return;select(id,{history:'push',scroll:true,...options});}

// ---------------------------------------------------------------- demo input, the way a person writes it
function fieldMarkup(field,text){
 const id=`field-${field.key}`;
 const control=field.multiline
  ?`<textarea id="${id}" data-key="${field.key}" rows="${Math.min(8,Math.max(3,text.split('\n').length+1))}" spellcheck="false" aria-describedby="${id}-hint">${escape(text)}</textarea>`
  :`<input id="${id}" data-key="${field.key}" value="${escape(text)}" spellcheck="false" autocomplete="off" aria-describedby="${id}-hint">`;
 return `<div class="field${field.multiline?' multiline':''}"><label for="${id}"><b>${escape(field.label)}</b><span id="${id}-hint">${escape(field.hint)}</span></label>${control}</div>`;
}
function fieldTexts(container){return Object.fromEntries([...container.querySelectorAll('[data-key]')].map(el=>[el.dataset.key,el.value]));}
function loadDemoInput(){
 const fields=fieldsFor(lesson);expectedSpec=expectedField(lesson);
 let raw=read(`hot100-demo-input-${selected}`,lesson.raw),texts;
 try{texts=formatFields(lesson,JSON.parse(raw));toRaw(lesson,texts);}catch{raw=lesson.raw;texts=formatFields(lesson,JSON.parse(raw));}
 let expectedText='';
 const storedExpected=read(`hot100-demo-expected-${selected}`,'');
 if(storedExpected){try{expectedText=formatValue(expectedSpec.kind,JSON.parse(storedExpected));}catch{expectedText='';}}
 $('demo-fields').innerHTML=fields.map(f=>fieldMarkup(f,texts[f.key])).join('');
 $('expected-field').innerHTML=fieldMarkup(expectedSpec,expectedText);
 $('expected-box').open=!!expectedText;
 $('input-error').textContent='';
 try{demoSession=prepareDemo(lesson,raw,storedExpected||'');}catch{demoSession=prepareDemo(lesson,lesson.raw);}
 demoDirty=false;
 $('demo-status').textContent=demoSession.raw===lesson.raw?'用的是题目示例':'用的是你的输入';
 steps=demoSession.frames;renderFrame();
}
function clearInvalid(){for(const el of document.querySelectorAll('#custom [aria-invalid]'))el.removeAttribute('aria-invalid');}
function markInvalid(message){
 // Messages name the parameter first ("nums：…" from the parser, "nums 必须…" from the lesson).
 const fields=[...document.querySelectorAll('#custom [data-key]')];
 const hit=fields.find(el=>message.startsWith(`${el.dataset.key}：`)||message.startsWith(`${el.dataset.key} `))||(message.startsWith('你认为结果是')?$('field-expected'):null)||(fields.length===1?fields[0]:null);
 hit?.setAttribute('aria-invalid','true');return hit;
}
function applyDemo(start=true){
 pause();clearInvalid();
 try{
  const raw=toRaw(lesson,fieldTexts($('demo-fields')));
  const expectedText=$('field-expected').value.trim();
  const expectedRaw=expectedText?JSON.stringify(parseValue(expectedSpec.kind,expectedText,expectedSpec.label)):'';
  const generated=prepareDemo(lesson,raw,expectedRaw);
  demoSession=generated;steps=generated.frames;index=0;demoDirty=false;
  $('bars')?.replaceChildren();$('cells').replaceChildren();$('input-error').textContent='';
  save(`hot100-demo-input-${selected}`,generated.raw);save(`hot100-demo-expected-${selected}`,generated.expectedRaw);
  $('demo-status').textContent=generated.raw===lesson.raw?`用的是题目示例 · ${steps.length} 步`:`用的是你的输入 · ${steps.length} 步`;
  renderFrame();if(start)play();return true;
 }catch(e){
  const message=String(e.message||e).replace(/^演示输入必须是合法的 JSON$/,'输入的格式不对');
  $('input-error').textContent=`没法播放：${message}`;$('demo-status').textContent='请先改一下输入';
  setCustom(true);markInvalid(message)?.focus();return false;
 }
}
function ensureDemo(){return !demoDirty||applyDemo(false);}
function setCustom(open){$('custom').hidden=!open;$('toggle-custom').setAttribute('aria-expanded',String(open));$('toggle-custom').textContent=open?'收起输入':'换个输入试试';}
function onDemoEdit(){pause();demoDirty=true;$('demo-status').textContent='输入改了 · 按“用这组输入播放”';$('input-error').textContent='';$('demo-output').textContent='输入改了，重新播放后查看';$('demo-comparison').textContent='';clearInvalid();}

// ---------------------------------------------------------------- playback
function renderFrame(){
 const f=steps[index];if(!f)return;
 let bars=$('bars');if(!bars){bars=document.createElement('div');bars.id='bars';$('cells').before(bars);}const previous=captureMotion(bars,$('cells'));bars.innerHTML=diagram(selected,f);bars.hidden=!bars.innerHTML;bars.classList.toggle('structure',!!(f.visual?.nodes||f.visual?.heaps||f.visual?.network||f.visual?.searchPath));
 const structure=bars.querySelector('svg.structure-diagram');if(structure){const width=Number(structure.getAttribute('viewBox').split(' ')[2]);structure.style.minWidth=`${Math.min(1440,width)}px`;}
 $('timeline').max=String(steps.length-1);$('timeline').value=String(index);$('step-label').textContent=`第 ${index+1} / ${steps.length} 步`;$('visual-title').textContent=lesson.valueLabel||(lesson.mode==='dp'?'状态 / f(i)':'数组 / nums');
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
 const shown=value=>{try{return formatValue(expectedSpec.kind,value);}catch{return JSON.stringify(value);}};
 $('demo-output').textContent=finished?shown(demoSession.actual):'播放到最后查看';
 $('demo-comparison').textContent=finished?(demoSession.hasExpected?demoSession.matched?'和你预期的一致':`和你预期的不一样。你写的是：${shown(JSON.parse(demoSession.expectedRaw))}`:''):'';
 $('demo-comparison').className=finished&&demoSession.hasExpected?(demoSession.matched?'matched':'mismatched'):'';
 $('prev').disabled=index===0;$('next').disabled=index===steps.length-1;
}
function tick(){if(index>=steps.length-1){pause();return;}index++;renderFrame();timer=setTimeout(tick,Number($('speed').value));}
function play(){if(timer){pause();return;}if(demoDirty){applyDemo(true);return;}if(index===steps.length-1){index=0;renderFrame();}$('play').textContent='暂停';timer=setTimeout(tick,Number($('speed').value));}
function step(delta){pause();if(!ensureDemo())return;index=Math.min(steps.length-1,Math.max(0,index+delta));renderFrame();}

// ---------------------------------------------------------------- practice (unchanged until the editor moves to Monaco)
function updateRunButtons(){for(const id of ['run','check-sample'])$(id).disabled=running||!environmentAvailable;}
function updateLaunch(){const command=root.dataset.javaLaunch||'node .hot100-preview/server.mjs';const value=Number($('java-port').value),port=Number.isInteger(value)&&value>=1024&&value<=65535?value:4337;$('java-launch').textContent=`${command} --port ${port} --site ${location.origin}`;}
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
  const errorLine=data.error?.match(/Main\.java:(\d+):/);$('jump-error').hidden=!errorLine;showCompileErrors(data.error||'');
  if(errorLine)$('jump-error').onclick=()=>monacoEditor?monacoEditor.jump(Number(errorLine[1])):codeEditor.jump(Number(errorLine[1]));
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
function replaceDraft(code){save(`hot100-preview-backup-${selected}`,$('editor').value);setCode(code);saveDraft();$('undo-draft').hidden=false;}

// ---------------------------------------------------------------- wiring
const lessonLink=event=>{
 if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return null;
 const link=event.target.closest('a[href^="/hot100/"]');const id=link&&Number(link.getAttribute('href').split('/')[2]);
 return id&&lessons[id]?id:null;
};
root.addEventListener('click',e=>{const id=lessonLink(e);if(!id)return;e.preventDefault();const fromCatalog=!!e.target.closest('#catalog');go(id,{scroll:!fromCatalog||narrow()});});
$('catalog').addEventListener('click',e=>{if(e.target.closest('[data-id]')&&narrow())setDrawer(false);});
window.addEventListener('popstate',()=>{const id=Number(location.pathname.split('/')[2])||1;if(lessons[id]&&id!==selected)select(id,{history:'none'});});
$('search').addEventListener('input',renderCatalog);
for(const button of document.querySelectorAll('.filters [data-filter]'))button.onclick=()=>{filter=button.dataset.filter;renderCatalog();};
$('open-catalog').onclick=()=>setDrawer(true);$('close-catalog').onclick=()=>setDrawer(false);$('catalog-backdrop').onclick=()=>setDrawer(false);
$('complete').onclick=()=>{if(done.has(selected))done.delete(selected);else done.add(selected);save('hot100-preview-done',[...done]);updateCompletion();renderCatalog();};
$('play').onclick=play;$('reset').onclick=()=>{pause();if(!ensureDemo())return;index=0;renderFrame();};$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);
$('timeline').oninput=()=>{pause();const desired=Number($('timeline').value);if(!ensureDemo())return;index=Math.min(steps.length-1,desired);renderFrame();};$('speed').onchange=()=>{if(timer){pause();play();}};
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&$('sidebar').classList.contains('open')){setDrawer(false);return;}
 if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||$('learn-view').hidden)return;
 const target=event.target instanceof Element?event.target:null;
 if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog[open]'))return;
 if(document.querySelector('dialog[open]')||$('sidebar').classList.contains('open'))return;
 const key=event.key.toLowerCase();
 if(key==='a'||key==='arrowleft'){event.preventDefault();step(-1);}
 else if(key==='d'||key==='arrowright'){event.preventDefault();step(1);}
 // Space already presses whatever button or link has focus.
 else if(key===' '&&!target?.closest('button,a,summary')){event.preventDefault();play();}
});
$('toggle-custom').onclick=()=>{const open=$('custom').hidden;setCustom(open);if(open)$('demo-fields').querySelector('[data-key]')?.focus();};
$('apply').onclick=()=>applyDemo(true);
$('example-input').onclick=()=>{const texts=formatFields(lesson,JSON.parse(lesson.raw));for(const el of $('demo-fields').querySelectorAll('[data-key]'))el.value=texts[el.dataset.key];$('field-expected').value=formatValue(expectedSpec.kind,lesson.expected);applyDemo(false);};
$('custom').addEventListener('input',e=>{if(e.target.closest('[data-key]'))onDemoEdit();});
$('custom').addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing||!e.target.closest('[data-key]'))return;if(e.target.tagName==='INPUT'||e.ctrlKey||e.metaKey){e.preventDefault();applyDemo(true);}});
$('demo-fields').addEventListener('paste',e=>{
 // A whole LeetCode example line ("nums = [2,7,11,15], target = 9") fills every field it names.
 const text=e.clipboardData?.getData('text')||'';const keys=fieldsFor(lesson).map(f=>f.key);const parts=splitAssignments(text,keys);
 if(!parts)return;e.preventDefault();
 const kinds=Object.fromEntries(fieldsFor(lesson).map(f=>[f.key,f.kind]));
 for(const [key,value] of Object.entries(parts)){const el=$(`field-${key}`);if(!el)continue;try{el.value=formatValue(kinds[key],parseValue(kinds[key],value));}catch{el.value=value;}}
 onDemoEdit();$('demo-status').textContent=`已从示例填入 ${Object.keys(parts).join('、')} · 按“用这组输入播放”`;
});
$('learn-tab').onclick=()=>setTab(false);$('practice-tab').onclick=()=>setTab(true);$('go-practice').onclick=()=>{setTab(true);$('practice-tab').scrollIntoView({block:'start'});};

$('detect').onclick=environment;$('run').onclick=()=>run(false);$('check-sample').onclick=()=>run(true);$('restore').onclick=()=>replaceDraft(lesson.practice);
$('reference').onclick=()=>replaceDraft(referenceProgram(lesson));
$('undo-draft').onclick=()=>{const backup=read(`hot100-preview-backup-${selected}`,null);if(backup!==null)replaceDraft(backup);};
$('disconnect').onclick=()=>{javaClient.disconnect();token='';environmentAvailable=false;$('disconnect').hidden=true;$('environment').textContent='已断开本机 Java 服务。课程、动画和草稿仍可使用。';document.querySelector('.status-dot').classList.remove('ready');suggestionRequest++;suggestions=[];drawSuggestions();updateRunButtons();};
$('java-port').oninput=()=>{javaClient.disconnect();token='';environmentAvailable=false;$('disconnect').hidden=true;$('environment').textContent='服务端口已修改，请重新连接。';document.querySelector('.status-dot').classList.remove('ready');updateRunButtons();updateLaunch();};
$('editor').oninput=()=>{saveDraft();suggestionRequest++;clearTimeout(suggestionTimer);suggestionTimer=setTimeout(()=>suggest(),250);};$('stdin').oninput=()=>save(`hot100-preview-stdin-${selected}`,$('stdin').value);
$('editor').onkeydown=e=>{if(e.ctrlKey&&e.code==='Space'){e.preventDefault();clearTimeout(suggestionTimer);suggest(true);return;}if(e.key==='Escape'){suggestionRequest++;clearTimeout(suggestionTimer);suggestions=[];drawSuggestions();return;}if(suggestions.length){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();suggestionIndex=(suggestionIndex+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length;drawSuggestions();return;}if(e.key==='Tab'){e.preventDefault();insertSuggestion(suggestionIndex);return;}}if(e.key==='Tab'){e.preventDefault();const editor=$('editor');editor.setRangeText('    ',editor.selectionStart,editor.selectionEnd,'end');saveDraft();}};
$('suggestions').onmousedown=e=>{const button=e.target.closest('[data-suggestion]');if(button){e.preventDefault();insertSuggestion(Number(button.dataset.suggestion));}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
const routeId=Number(location.hash.slice(1))||Number(root.dataset.lesson);select(catalog.some(q=>q.id===routeId)?routeId:1,{history:location.pathname===lessonPath(routeId)?'none':'replace'});
$('java-port-field').hidden=javaClient.sameOrigin;$('connection-help').hidden=javaClient.sameOrigin;
$('java-port').value=read('hot100-java-port',4337);updateLaunch();
$('detect').textContent=javaClient.sameOrigin?'重新检测':'连接本机 Java';updateRunButtons();
if(javaClient.sameOrigin)environment();else $('environment').textContent='连接本机练习服务后，可使用 Java 类型提示和编译运行。';
