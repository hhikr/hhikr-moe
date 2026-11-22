import {catalog,categories,categoryLabels} from './catalog.mjs';
import {lessons} from './lessons.mjs';
import {diagram} from './diagrams.mjs';
import {attachEditor} from './editor.mjs';
import {starterCode,referenceSolution,callJudge} from './judge.mjs';
import {captureMotion,animateMotion} from './motion.mjs';
import {prepareDemo} from './demo-input.mjs';
import {fieldsFor,expectedField,formatFields,formatValue,parseValue,toRaw,splitAssignments,exampleText} from './friendly-input.mjs';
const $ = id => document.getElementById(id);
const root=document.querySelector('.hot100');
const codeEditor=attachEditor($('editor'));
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save = (key,value) => {try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const pad = n => String(n).padStart(2,'0');
const lessonPath = id => `/hot100/${id}/`;
let done=new Set(read('hot100-preview-done',[])),selected=1,filter='all',steps=[],index=0,timer=null,lesson=null;
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
  monacoEditor=mod.createEditor($('monaco'),{value:$('editor').value,uri:'inmemory://hot100/Solution.java',
   onChange:value=>{$('editor').value=value;saveDraft();},onRun:()=>run(false),onSubmit:()=>run(true)});
  root.classList.add('has-monaco');$('editor-hint').textContent='Ctrl + Space 提示 · Ctrl + Enter 运行 · Ctrl + \' 提交';
  return monacoEditor;
 }).catch(error=>{console.warn('Monaco 加载失败，改用简易编辑器',error);editorLoading=null;$('editor-hint').textContent='Tab 缩进';});
 return editorLoading;
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
 $('undo-draft').hidden=read(`hot100-preview-backup-${id}`,null)===null;
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
 setCode(draftFor(id,lesson),{undoable:false});monacoEditor?.setMarkers('javac',[]);
 loadDemoInput();loadRunCases();setJudgeTab(false);$('judge-result').innerHTML='<p class="judge-empty">还没有运行。写好代码后点“运行”。</p>';if(!running)$('judge-status').textContent='在服务器上编译运行 · Java 25';
 setTab(false);renderCatalog();
 const path=lessonPath(id);
 if(mode==='push'&&location.pathname!==path)history.pushState({id},'',path);else if(mode==='replace')history.replaceState({id},'',path);
 document.title=`${q.title} · Hot 100 · Hitchhiker`;document.querySelector('link[rel=canonical]')?.setAttribute('href',`https://hhikr.moe${path}`);
 if(scroll)document.querySelector('.workspace').scrollIntoView({block:'start'});
}
function updateCompletion(){const on=done.has(selected);$('complete').textContent=on?'我会了 ✓':'我会了';$('complete').classList.toggle('completed',on);$('complete').setAttribute('aria-pressed',String(on));}
function go(id,options={}){if(id===selected)return;select(id,{history:'push',scroll:true,...options});}

// ---------------------------------------------------------------- demo input, the way a person writes it
function fieldMarkup(field,text,prefix='field'){
 const id=`${prefix}-${field.key}`;
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

// ---------------------------------------------------------------- practice: write Solution, run on the judge
const judgeBase=root.dataset.judge||'/api/hot100';
const statusText={passed:'通过',wrong:'答案错误',error:'运行出错',timeout:'超时',skipped:'未运行'};
let running=false,runCases=[],caseIndex=0;
const shown=value=>{try{return formatValue(expectedSpec.kind,value);}catch{return JSON.stringify(value);}};
function inputLines(input){
 try{const texts=formatFields(lesson,input);return fieldsFor(lesson).map(f=>`${f.label} = ${texts[f.key]}`).join('\n');}
 catch{return JSON.stringify(input);}
}
function loadRunCases(){
 const sample=formatFields(lesson,lesson.sample);
 const stored=read(`hot100-run-cases-${selected}`,null);
 runCases=Array.isArray(stored)&&stored.length&&stored.length<=3?stored.map(t=>({...sample,...t})):[sample];
 caseIndex=0;renderCases();
}
function saveRunCases(){save(`hot100-run-cases-${selected}`,runCases);}
function renderCases(){
 $('case-chips').innerHTML=runCases.map((_,i)=>`<span class="case-chip${i===caseIndex?' selected':''}"><button data-case="${i}" aria-pressed="${i===caseIndex}">用例 ${i+1}</button>${runCases.length>1?`<button data-remove="${i}" aria-label="删除用例 ${i+1}" title="删除">×</button>`:''}</span>`).join('')+(runCases.length<3?'<button id="add-case" class="case-add">+ 添加用例</button>':'')+(JSON.stringify(runCases[caseIndex])!==JSON.stringify(formatFields(lesson,lesson.sample))?'<button id="sample-case" class="case-add">填入题目示例</button>':'');
 $('case-fields').innerHTML=fieldsFor(lesson).map(f=>fieldMarkup(f,runCases[caseIndex][f.key]??'','case')).join('');
 $('case-error').textContent='';
}
function setJudgeTab(result){$('cases-tab').setAttribute('aria-selected',String(!result));$('result-tab').setAttribute('aria-selected',String(result));$('cases-view').hidden=result;$('result-view').hidden=!result;}
function setRunning(on,text){running=on;$('run').disabled=on;$('submit').disabled=on;$('judge-status').textContent=text;}
function runInputs(){
 const inputs=[];
 for(const [i,texts] of runCases.entries()){
  try{inputs.push(JSON.parse(toRaw(lesson,texts)));}
  catch(e){
   caseIndex=i;renderCases();setJudgeTab(false);
   const message=String(e.message||e);$('case-error').textContent=`用例 ${i+1} 有问题：${message}`;
   const field=[...$('case-fields').querySelectorAll('[data-key]')].find(el=>message.startsWith(`${el.dataset.key}：`)||message.startsWith(`${el.dataset.key} `));
   field?.setAttribute('aria-invalid','true');field?.focus();
   return null;
  }
 }
 return inputs;
}
async function run(submit=false){
 if(running)return;
 const id=selected,inputs=submit?undefined:runInputs();
 if(!submit&&!inputs)return;
 const code=monacoEditor?monacoEditor.getValue():$('editor').value;
 setRunning(true,submit?'正在提交，用隐藏用例检验…':'正在编译运行…');monacoEditor?.setMarkers('javac',[]);
 try{
  const data=await callJudge(judgeBase,submit?'submit':'run',{id,code,inputs});
  if(selected!==id)return;
  renderResult(data,0);setJudgeTab(true);
  setRunning(false,data.kind==='compile'?'编译没有通过':data.passed===data.total?(submit?`全部 ${data.total} 组通过 · 最慢 ${data.slowest} ms`:'运行完成'):`${data.passed} / ${data.total} 组通过`);
 }catch(e){
  if(selected!==id)return;
  setRunning(false,e.message);
  $('judge-result').innerHTML=`<p class="judge-headline error">没有运行</p><p>${escape(e.message)}</p>`;setJudgeTab(true);
 }finally{if(selected===id&&running)setRunning(false,'');}
}
function caseDetail(c){
 const rows=[['输入',inputLines(c.input)]];
 if(c.actual!==undefined)rows.push(['输出',shown(c.actual)]);
 if(c.expected!==undefined&&c.status!=='skipped')rows.push(['预期',shown(c.expected)]);
 if(c.message)rows.push([c.status==='timeout'?'说明':'异常',c.message]);
 if(c.printed)rows.push(['打印内容',c.printed]);
 return `<dl class="case-detail">${rows.map(([k,v])=>`<dt>${k}</dt><dd><pre>${escape(v)}</pre></dd>`).join('')}${c.ms!==undefined?`<dt>耗时</dt><dd>${c.ms} ms</dd>`:''}</dl>`;
}
function renderResult(data,selectedCase){
 const box=$('judge-result');
 if(data.kind==='compile'){
  const list=data.diagnostics||[];
  monacoEditor?.setMarkers('javac',list.map(d=>({line:d.line,column:d.column,message:d.message})));
  box.innerHTML=`<p class="judge-headline error">编译出错</p><ul class="diagnostics">${list.map((d,i)=>`<li><button data-jump="${i}">第 ${d.line} 行</button><pre>${escape(d.message)}</pre></li>`).join('')}</ul>`;
  box.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{const d=list[Number(b.dataset.jump)];monacoEditor?monacoEditor.jump(d.line,d.column):codeEditor.jump(d.line);});
  return;
 }
 if(data.kind==='submit'){
  const all=data.passed===data.total;
  box.innerHTML=`<p class="judge-headline ${all?'passed':'wrong'}">${all?`通过 · ${data.total} / ${data.total}`:`${statusText[data.failed?.status]||'未通过'} · 通过 ${data.passed} / ${data.total}`}</p><div class="case-strip" aria-label="每组用例的结果">${data.statuses.map((s,i)=>`<span class="${s}" title="第 ${i+1} 组：${statusText[s]}"></span>`).join('')}</div>${all?`<p>所有隐藏用例都通过了。最慢一组 ${data.slowest} ms。${done.has(selected)?'':'<button id="mark-done" class="btn go">标记为“我会了”</button>'}</p>`:`<p>第 ${data.failed.index+1} 组没有通过${data.failed.index===0?'（就是题目示例）':''}：</p>${caseDetail(data.failed)}`}`;
  $('mark-done')?.addEventListener('click',()=>{done.add(selected);save('hot100-preview-done',[...done]);updateCompletion();renderCatalog();$('mark-done').remove();});
  return;
 }
 const cases=data.cases||[];const current=cases[selectedCase]||cases[0];
 const all=cases.length&&cases.every(c=>c.status==='passed');
 box.innerHTML=`<p class="judge-headline ${all?'passed':current?.status==='passed'?'wrong':current?.status||'error'}">${all?'通过':cases.filter(c=>c.status==='passed').length?`通过 ${cases.filter(c=>c.status==='passed').length} / ${cases.length}`:statusText[cases[0]?.status]||'未通过'}</p>${cases.length>1?`<div class="case-chips">${cases.map((c,i)=>`<span class="case-chip ${c.status}${i===selectedCase?' selected':''}"><button data-show="${i}" aria-pressed="${i===selectedCase}">${c.status==='passed'?'✓':'✗'} 用例 ${i+1}</button></span>`).join('')}</div>`:''}${current?caseDetail(current):''}${all?'<p class="judge-next">试过了？点“提交”用隐藏用例检验。</p>':''}`;
 box.querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>renderResult(data,Number(b.dataset.show)));
}
function saveDraft(){save(`hot100-preview-draft-${selected}`,$('editor').value);codeEditor.render();}
function replaceDraft(code){save(`hot100-preview-backup-${selected}`,monacoEditor?monacoEditor.getValue():$('editor').value);setCode(code);saveDraft();$('undo-draft').hidden=false;}
/** The saved draft, or the starter; drafts of the old local-JDK page that were never edited become the starter. */
function draftFor(id,l){const draft=read(`hot100-preview-draft-${id}`,null);return draft===null||draft===l.practice?starterCode(l):draft;}

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
// A whole LeetCode example line ("nums = [2,7,11,15], target = 9") fills every field it names.
function pasteAssignments(e,prefix){
 const text=e.clipboardData?.getData('text')||'';const keys=fieldsFor(lesson).map(f=>f.key);const parts=splitAssignments(text,keys);
 if(!parts)return null;e.preventDefault();
 const kinds=Object.fromEntries(fieldsFor(lesson).map(f=>[f.key,f.kind]));
 for(const [key,value] of Object.entries(parts)){const el=$(`${prefix}-${key}`);if(!el)continue;try{el.value=formatValue(kinds[key],parseValue(kinds[key],value));}catch{el.value=value;}}
 return Object.keys(parts);
}
$('demo-fields').addEventListener('paste',e=>{const keys=pasteAssignments(e,'field');if(keys){onDemoEdit();$('demo-status').textContent=`已从示例填入 ${keys.join('、')} · 按“用这组输入播放”`;}});
$('learn-tab').onclick=()=>setTab(false);$('practice-tab').onclick=()=>setTab(true);$('go-practice').onclick=()=>{setTab(true);$('practice-tab').scrollIntoView({block:'start'});};

// Practice: run cases, run and submit.
function onCaseEdit(){runCases[caseIndex]=fieldTexts($('case-fields'));saveRunCases();$('case-error').textContent='';for(const el of $('case-fields').querySelectorAll('[aria-invalid]'))el.removeAttribute('aria-invalid');}
$('case-fields').addEventListener('input',onCaseEdit);
$('case-fields').addEventListener('paste',e=>{if(pasteAssignments(e,'case'))onCaseEdit();});
$('case-fields').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&(e.target.tagName==='INPUT'||e.ctrlKey||e.metaKey)){e.preventDefault();run(false);}});
$('case-chips').addEventListener('click',e=>{
 const pick=e.target.closest('[data-case]'),remove=e.target.closest('[data-remove]');
 if(pick){caseIndex=Number(pick.dataset.case);renderCases();}
 else if(remove){runCases.splice(Number(remove.dataset.remove),1);caseIndex=Math.min(caseIndex,runCases.length-1);saveRunCases();renderCases();}
 else if(e.target.closest('#add-case')){runCases.push({...runCases[caseIndex]});caseIndex=runCases.length-1;saveRunCases();renderCases();$('case-fields').querySelector('[data-key]')?.focus();}
 else if(e.target.closest('#sample-case')){runCases[caseIndex]=formatFields(lesson,lesson.sample);saveRunCases();renderCases();}
});
$('cases-tab').onclick=()=>setJudgeTab(false);$('result-tab').onclick=()=>setJudgeTab(true);
$('run').onclick=()=>run(false);$('submit').onclick=()=>run(true);
$('restore').onclick=()=>replaceDraft(starterCode(lesson));
$('reference').onclick=()=>replaceDraft(referenceSolution(lesson));
$('undo-draft').onclick=()=>{const backup=read(`hot100-preview-backup-${selected}`,null);if(backup!==null)replaceDraft(backup);};
$('editor').oninput=saveDraft;
$('editor').onkeydown=e=>{
 if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run(false);return;}
 if((e.ctrlKey||e.metaKey)&&e.key==="'"){e.preventDefault();run(true);return;}
 if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();const editor=$('editor');editor.setRangeText('    ',editor.selectionStart,editor.selectionEnd,'end');saveDraft();}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
const routeId=Number(location.hash.slice(1))||Number(root.dataset.lesson);select(catalog.some(q=>q.id===routeId)?routeId:1,{history:location.pathname===lessonPath(routeId)?'none':'replace'});
