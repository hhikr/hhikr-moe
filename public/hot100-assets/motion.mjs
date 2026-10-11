const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
export function captureMotion(bars,cells){
 const nodes=new Map(),edges=new Map(),values=new Map(),pointers=new Map(),geometry=new Map(),structurePointers=new Map();
 for(const element of bars.querySelectorAll('[data-node]')){const shape=element.querySelector('circle,rect');if(shape)nodes.set(element.dataset.node,rect(shape));}
 for(const element of bars.querySelectorAll('[data-edge]'))edges.set(element.dataset.edge,{element:element.cloneNode(true),svg:element.ownerSVGElement.cloneNode(false),defs:element.ownerSVGElement.querySelector('defs')?.cloneNode(true),rect:rect(element.ownerSVGElement)});
 for(const element of cells.querySelectorAll('.cell strong'))values.set(element.parentElement.dataset.index,{value:element.textContent,rect:rect(element),active:element.parentElement.classList.contains('active')});
 for(const element of cells.querySelectorAll('[data-pointer]'))pointers.set(element.dataset.pointer,rect(element));
 for(const element of bars.querySelectorAll('[data-structure-pointer]'))structurePointers.set(element.dataset.structurePointer,rect(element));
 for(const element of bars.querySelectorAll('[data-geometry]'))geometry.set(element.dataset.geometry,Object.fromEntries(['x','y','width','height'].map(key=>[key,`${element.getAttribute(key)}px`])));
 const visual=cells.closest('.visual'),variables=new Map(),entries=new Map(),temporaries=new Map();
 for(const element of visual?.querySelectorAll('[data-variable]')||[]){variables.set(element.dataset.variable,element.textContent);const value=element.querySelector('b');if(value&&['temp','next','sum','carry'].includes(element.dataset.variable))temporaries.set(element.dataset.variable,{value:value.textContent,rect:rect(element)});}
 for(const element of visual?.querySelectorAll('[data-entry]')||[])entries.set(element.dataset.entry,element.textContent);
 const code=visual?.closest('.lab')?.querySelector('.code-line.current');
 return {nodes,edges,values,pointers,geometry,structurePointers,variables,temporaries,entries,code:code?rect(code):null};
}
function travel(layer,start,end,text,duration,className='motion-value'){
 const a=center(start),b=center(end),origin=rect(layer),dx=b.x-a.x,dy=b.y-a.y;
 const ghost=document.createElement('span');ghost.className=className;ghost.textContent=text;
 ghost.style.left=`${a.x-origin.x}px`;ghost.style.top=`${a.y-origin.y}px`;layer.append(ghost);
 ghost.animate([{transform:'translate(-50%, -50%) scale(.9)',opacity:.25},{transform:`translate(calc(-50% + ${dx*.5}px), calc(-50% + ${dy*.5-28}px)) scale(1.12)`,opacity:1,offset:.5},{transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`,opacity:0}],{duration,easing:'cubic-bezier(.22,.7,.2,1)',fill:'forwards'});
}
function flip(element,before,duration){const after=rect(element);element.animate([{transform:`translate(${before.x-after.x}px, ${before.y-after.y}px)`,opacity:.65},{transform:'translate(0,0)',opacity:1}],{duration,easing:'cubic-bezier(.22,.7,.2,1)'});}
function stateFlow(layer,sources,target,duration){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),origin=rect(layer),end=center(rect(target));
 svg.classList.add('state-flow');svg.setAttribute('viewBox',`0 0 ${origin.width} ${origin.height}`);svg.setAttribute('aria-hidden','true');layer.append(svg);
 for(const source of sources){const start=center(rect(source)),path=document.createElementNS(ns,'path'),x=start.x-origin.x,y=start.y-origin.y,dx=end.x-origin.x,dy=end.y-origin.y;path.setAttribute('d',`M ${x} ${y} Q ${(x+dx)/2} ${Math.min(y,dy)-24} ${dx} ${dy}`);svg.append(path);const length=path.getTotalLength();path.animate([{strokeDasharray:`${length}`,strokeDashoffset:length,opacity:0},{strokeDasharray:`${length}`,strokeDashoffset:0,opacity:.7}],{duration,fill:'forwards',easing:'ease-out'});travel(layer,rect(source),rect(target),source.textContent,duration);}
}
export function animateMotion(previous,bars,cells,{duration=560,mode='array'}={}){
 const visual=cells.closest('.visual'),lab=visual?.closest('.lab');
 lab?.querySelectorAll('.motion-layer,.code-tracker').forEach(element=>element.remove());
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||!visual)return;
 const layer=document.createElement('div');layer.className='motion-layer';visual.append(layer);
 let transferred=false;
 for(const element of bars.querySelectorAll('[data-geometry]')){const before=previous.geometry.get(element.dataset.geometry);if(before){const after=Object.fromEntries(['x','y','width','height'].map(key=>[key,`${element.getAttribute(key)}px`]));element.animate([before,after],{duration,easing:'ease-in-out'});}}
 for(const element of bars.querySelectorAll('[data-structure-pointer]')){const before=previous.structurePointers.get(element.dataset.structurePointer);if(before){const r=rect(element),m=element.getScreenCTM();element.animate([{transform:`translate(${(before.x-r.x)/(Math.abs(m?.a)||1)}px,${(before.y-r.y)/(Math.abs(m?.d)||1)}px)`},{transform:'translate(0,0)'}],{duration,easing:'cubic-bezier(.22,.7,.2,1)'});}}
 for(const element of bars.querySelectorAll('[data-node]')){
  const shape=element.querySelector('circle,rect'),before=previous.nodes.get(element.dataset.node);if(!shape)continue;
  if(before){const r=rect(shape),matrix=shape.getScreenCTM(),sx=Math.abs(matrix?.a)||1,sy=Math.abs(matrix?.d)||1;const dx=(before.x-r.x)/sx,dy=(before.y-r.y)/sy;if(Math.abs(dx)+Math.abs(dy)>1)element.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration,easing:'cubic-bezier(.22,.7,.2,1)'});}
  else element.animate([{opacity:0},{opacity:1}],{duration});
  if(shape.classList.contains('node-active'))shape.animate([{strokeWidth:2,filter:'brightness(1)'},{strokeWidth:5,filter:'brightness(1.25)',offset:.35},{strokeWidth:2,filter:'brightness(1)'}],{duration});
 }
 const edges=new Set();
 for(const edge of bars.querySelectorAll('[data-edge]')){edges.add(edge.dataset.edge);if(!previous.edges.has(edge.dataset.edge)){const length=edge.getTotalLength();edge.animate([{strokeDasharray:`${length}`,strokeDashoffset:length,opacity:.3},{strokeDasharray:`${length}`,strokeDashoffset:0,opacity:1}],{duration,easing:'ease-out'});}}
 for(const [key,before] of previous.edges)if(!edges.has(key)){
  const svg=before.svg;if(before.defs)svg.append(before.defs);svg.append(before.element);const origin=rect(layer);
  svg.classList.add('motion-old-edge');svg.style.left=`${before.rect.x-origin.x}px`;svg.style.top=`${before.rect.y-origin.y}px`;svg.style.width=`${before.rect.width}px`;svg.style.height=`${before.rect.height}px`;layer.append(svg);
  svg.animate([{opacity:.8},{opacity:0}],{duration:duration*.8,fill:'forwards'});
 }
 const all=[...cells.querySelectorAll('.cell strong')];
 for(const element of all){
  const index=element.parentElement.dataset.index,before=previous.values.get(index),current=element.textContent;
  if(before?.value!==current){
   const source=[...previous.values].find(([key,value])=>key!==index&&value.active&&value.value===current)?.[1]||[...previous.temporaries.values()].find(value=>value.value===current);
   if(source&&mode!=='dp'){travel(layer,source.rect,rect(element),current,duration);transferred=true;}
   if(mode==='dp'&&before){const dependencies=all.filter(e=>e!==element&&e.parentElement.classList.contains('active')&&previous.values.get(e.parentElement.dataset.index)?.value===e.textContent);if(element.parentElement.classList.contains('active')&&dependencies.length){stateFlow(layer,dependencies,element,duration);transferred=true;}}
   element.animate([{backgroundColor:'var(--soft)',boxShadow:'0 0 0 4px var(--blue)',opacity:.4},{backgroundColor:'var(--paper)',boxShadow:'0 0 0 0 transparent',opacity:1}],{duration,easing:'ease-out'});
  }else if(element.parentElement.classList.contains('active')&&!before?.active)element.animate([{transform:'translateY(0) scale(1)'},{transform:'translateY(-7px) scale(1.09)',offset:.45},{transform:'translateY(-5px) scale(1)'}],{duration});
 }
 for(const element of cells.querySelectorAll('[data-pointer]')){const before=previous.pointers.get(element.dataset.pointer);if(before)flip(element,before,duration);else element.animate([{opacity:0,transform:'translateY(-10px)'},{opacity:1,transform:'translateY(0)'}],{duration});}
 const activeBefore=[...previous.values.values()].filter(v=>v.active),activeNow=all.filter(e=>e.parentElement.classList.contains('active'));
 if(!transferred&&activeBefore.length&&activeNow.length&&activeNow.some(e=>!previous.values.get(e.parentElement.dataset.index)?.active))travel(layer,activeBefore.at(-1).rect,rect(activeNow.at(-1)),'',duration,'motion-focus');
 for(const element of visual.querySelectorAll('[data-variable]'))if(previous.variables.get(element.dataset.variable)!==element.textContent)element.animate([{backgroundColor:'var(--soft)',transform:'translateY(-4px)'},{backgroundColor:'var(--paper)',transform:'translateY(0)'}],{duration});
 for(const element of visual.querySelectorAll('[data-entry]'))if(previous.entries.get(element.dataset.entry)!==element.textContent)element.animate([{opacity:0,transform:'translateY(-12px) scale(.9)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration});
 const current=lab.querySelector('.code-line.current');
 if(current&&previous.code){const panel=lab.querySelector('.code-panel'),origin=rect(panel),r=rect(current),tracker=document.createElement('div');tracker.className='code-tracker';tracker.style.top=`${r.y-origin.y}px`;tracker.style.height=`${r.height}px`;panel.append(tracker);tracker.animate([{transform:`translateY(${previous.code.y-r.y}px)`,opacity:.8},{transform:'translateY(0)',opacity:.45}],{duration,easing:'cubic-bezier(.22,.7,.2,1)',fill:'forwards'});}
 visual.querySelector('#note')?.animate([{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:duration*.75});
}
