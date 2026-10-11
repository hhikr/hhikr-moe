const barLessons=new Set([11,42,84,739]);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function nodesDiagram(frame){
 const graph=frame.visual,nodes=graph.nodes;if(!nodes.length)return '<svg viewBox="0 0 360 70" role="img" aria-label="空数据结构"><text x="180" y="35" text-anchor="middle">空结构 / null</text></svg>';
 const positions=new Map(),byId=new Map(nodes.map(n=>[n.id,n]));let width=440,height=120;
 if(graph.kind==='tree'){
  let leaf=0,maximumDepth=0;const visited=new Set();
  function place(id,depth){if(id===null||visited.has(id)||!byId.has(id))return null;visited.add(id);const n=byId.get(id),left=place(n.left,depth+1),right=place(n.right,depth+1);const x=left!==null&&right!==null?(left+right)/2:left??right??++leaf;positions.set(id,{x,y:50+depth*75});maximumDepth=Math.max(maximumDepth,depth);return x;}
  place(graph.root,0);const detached=nodes.filter(n=>!positions.has(n.id));detached.forEach((n,i)=>positions.set(n.id,{x:++leaf,y:50+(maximumDepth+1)*75}));if(detached.length)maximumDepth++;
  width=Math.max(360,(leaf+1)*65);height=maximumDepth*75+105;for(const p of positions.values())p.x=p.x/(leaf+1)*width;
 }else{nodes.forEach((n,i)=>positions.set(n.id,{x:40+i%6*70,y:50+Math.floor(i/6)*100}));height=Math.ceil(nodes.length/6)*100+20;}
 function edge(from,to,random=false){if(to===null||!positions.has(to))return '';const a=positions.get(from),b=positions.get(to);let path;
  if(graph.kind==='tree')path=`M ${a.x} ${a.y+19} L ${b.x} ${b.y-23}`;
  else if(from===to)path=`M ${a.x+16} ${a.y-10} C ${a.x+58} ${a.y-58},${a.x-40} ${a.y-60},${a.x-16} ${a.y-15}`;
  else{const direction=b.x>=a.x?1:-1,raise=random?-40:-17;path=`M ${a.x+direction*20} ${a.y} C ${(a.x+b.x)/2} ${a.y+raise},${(a.x+b.x)/2} ${b.y+raise},${b.x-direction*25} ${b.y}`;}
  return `<path data-edge="${from}-${to}-${random}" class="node-edge ${random?'random-edge':''}" d="${path}" marker-end="url(#node-arrow)"/>`;
 }
 const edges=nodes.map(n=>graph.kind==='tree'?edge(n.id,n.left)+edge(n.id,n.right):edge(n.id,graph.kind==='right-linked'?n.right:n.next)+edge(n.id,n.random,true)).join('');
 const circles=nodes.map(n=>{const p=positions.get(n.id),active=frame.active.includes(nodes.findIndex(x=>x.id===n.id)),labels=Object.entries(graph.pointers).filter(([,id])=>id===n.id).map(([key])=>key).join(' / ');return `<g data-node="${n.id}"><circle class="node-circle ${active?'node-active':''}" cx="${p.x}" cy="${p.y}" r="20"/><text class="node-value" x="${p.x}" y="${p.y+4}" text-anchor="middle">${esc(n.val)}</text><text x="${p.x}" y="${p.y+36}" text-anchor="middle">#${n.id}</text>${Object.entries(graph.pointers).filter(([,id])=>id===n.id).map(([key],i)=>`<text data-structure-pointer="${esc(key)}" class="node-pointer" x="${p.x}" y="${p.y-30-i*12}" text-anchor="middle">${esc(key)}</text>`).join('')}</g>`;}).join('');
 return `<svg class="structure-diagram" role="img" aria-label="实际节点连接；箭头表示指针，编号表示节点身份，虚线表示 random 指针" viewBox="0 0 ${width} ${height}"><defs><marker id="node-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="arrow-tip"/></marker></defs>${edges}${circles}</svg>`;
}
function heapDiagram(frame){
 const heaps=frame.visual.heaps,width=Math.max(360,heaps.length*360),height=Math.max(120,...heaps.map(h=>85+Math.floor(Math.log2(h.values.length||1))*70));
 const groups=heaps.map((h,group)=>{const positions=h.values.map((_,i)=>{const depth=Math.floor(Math.log2(i+1)),first=2**depth-1,slot=i-first;return {x:group*360+(slot+.5)*360/2**depth,y:65+depth*70};});const edges=positions.map((p,i)=>i?`<line data-edge="heap-${group}-${(i-1)>>1}-${i}" class="node-edge" x1="${positions[(i-1)>>1].x}" y1="${positions[(i-1)>>1].y+20}" x2="${p.x}" y2="${p.y-20}"/>`:'').join('');const nodes=positions.map((p,i)=>`<g data-node="heap-${group}-${esc(h.values[i])}-${h.values.slice(0,i).filter(v=>v===h.values[i]).length}"><circle class="node-circle ${i===0?'node-active':''}" cx="${p.x}" cy="${p.y}" r="21"/><text class="node-value" x="${p.x}" y="${p.y+4}" text-anchor="middle">${esc(h.values[i])}</text>${h.labels?`<text x="${p.x}" y="${p.y+38}" text-anchor="middle">${esc(h.labels[i])}</text>`:''}</g>`).join('');return `<text x="${group*360+180}" y="20" text-anchor="middle">${esc(h.name)}</text>${edges}${nodes}${h.values.length?'':`<text x="${group*360+180}" y="65" text-anchor="middle">空堆</text>`}`;}).join('');
 return `<svg class="structure-diagram" role="img" aria-label="完全二叉树堆；根节点高亮，连线表示父子关系" viewBox="0 0 ${width} ${height+30}">${groups}</svg>`;
}
function networkDiagram(frame){
 const graph=frame.visual.network,count=graph.labels.length,positions=[];let width=440,height=360;
 if(graph.kind==='trie'){const maximum=Math.max(0,...graph.depths),rows=Array.from({length:maximum+1},()=>[]);graph.depths.forEach((depth,i)=>rows[depth].push(i));width=Math.max(360,...rows.map(row=>row.length*65+40));height=maximum*75+95;rows.forEach((row,d)=>row.forEach((id,i)=>positions[id]={x:(i+1)*width/(row.length+1),y:45+d*75}));}
 else{graph.labels.forEach((_,i)=>positions[i]={x:220+150*Math.cos(2*Math.PI*i/count-Math.PI/2),y:175+130*Math.sin(2*Math.PI*i/count-Math.PI/2)});}
 const edges=graph.edges.map(edge=>{const a=positions[edge.from],b=positions[edge.to];if(!a||!b)return '';let path,lx,ly;if(edge.from===edge.to){path=`M ${a.x+16} ${a.y-10} C ${a.x+62} ${a.y-65},${a.x-44} ${a.y-65},${a.x-16} ${a.y-14}`;lx=a.x;ly=a.y-42;}else{const distance=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/distance,dy=(b.y-a.y)/distance;path=`M ${a.x+dx*21} ${a.y+dy*21} L ${b.x-dx*26} ${b.y-dy*26}`;lx=(a.x+b.x)/2+8;ly=(a.y+b.y)/2-8;}return `<path data-edge="${edge.from}-${edge.to}" class="node-edge ${(graph.completed||[]).includes(edge.from)?'edge-completed':''}" d="${path}" marker-end="url(#network-arrow)"/><text x="${lx}" y="${ly}">${esc(edge.label||'')}</text>`;}).join('');
 const nodes=graph.labels.map((label,i)=>{const p=positions[i];return `<g data-node="${i}"><circle class="node-circle ${frame.active.includes(i)?'node-active':''}" cx="${p.x}" cy="${p.y}" r="21"/><text class="node-value" x="${p.x}" y="${p.y+4}" text-anchor="middle">${esc(label)}</text></g>`;}).join('');
 return `<svg class="structure-diagram" role="img" aria-label="有向连接图；高亮节点对应当前访问位置，★ 表示完整单词终点" viewBox="0 0 ${width} ${height}"><defs><marker id="network-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" class="arrow-tip"/></marker></defs>${edges}${nodes}</svg>`;
}
function searchDiagram(frame){
 const path=frame.visual.searchPath,width=Math.max(360,path.length*72+40);return `<svg class="structure-diagram" role="img" aria-label="当前回溯路径；追加表示选择，缩短表示撤销" viewBox="0 0 ${width} 100"><text x="20" y="18">当前选择路径 / 深度 ${path.length}</text>${path.length?path.map((value,i)=>`<g data-node="path-${i}-${esc(value)}"><rect class="node-circle ${i===path.length-1?'node-active':''}" x="${20+i*72}" y="38" width="58" height="36" rx="5"/><text class="node-value" x="${49+i*72}" y="60" text-anchor="middle">${esc(value)}</text></g>${i<path.length-1?`<text x="${85+i*72}" y="60">→</text>`:''}`).join(''):'<text x="20" y="60">空路径：开始搜索或已撤销全部选择</text>'}</svg>`;
}
export function diagram(id,frame){
 if(frame.visual?.heaps)return heapDiagram(frame);
 if(frame.visual?.network)return networkDiagram(frame);
 if(frame.visual?.searchPath)return searchDiagram(frame);
 if(frame.visual?.nodes)return nodesDiagram(frame);
 if(!barLessons.has(id)||!frame.values.length||!frame.values.every(v=>typeof v==='number'&&v>=0))return '';
 const values=frame.values,maximum=Math.max(1,...values),scale=130/maximum,unit=320/values.length,base=148;
 let region='';
 if(id===11&&frame.vars.left<frame.vars.right){
  const {left,right}=frame.vars,height=Math.min(values[left],values[right]);
  region=`<rect data-geometry="region" class="diagram-region" x="${20+(left+.5)*unit}" y="${base-height*scale}" width="${(right-left)*unit}" height="${height*scale}"/><text x="180" y="175" text-anchor="middle">容器面积 = 短板 × 宽度</text>`;
 }
 if(id===84&&frame.vars.width){
  const {width,index,i}=frame.vars,height=values[index];
  region=`<rect data-geometry="region" class="diagram-region" x="${20+(i-width)*unit}" y="${base-height*scale}" width="${width*unit}" height="${height*scale}"/><text x="180" y="175" text-anchor="middle">候选矩形：高度 ${height} × 宽度 ${width}</text>`;
 }
 const bars=values.map((height,i)=>`<rect data-geometry="bar-${i}" class="diagram-bar ${frame.active.includes(i)?'diagram-active':''}" x="${20+i*unit+2}" y="${base-height*scale}" width="${Math.max(2,unit-4)}" height="${height*scale}"/><text x="${20+(i+.5)*unit}" y="${Math.max(12,base-height*scale-5)}" text-anchor="middle">${height}</text>`).join('');
 return `<svg role="img" aria-label="柱状图；高亮柱子对应当前代码访问的位置" viewBox="0 0 360 180"><line class="diagram-axis" x1="18" y1="${base}" x2="342" y2="${base}"/>${region}${bars}</svg>`;
}

