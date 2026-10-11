const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keywords=new Set('abstract assert boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public record return short static strictfp super switch synchronized this throw throws transient try var void volatile while yield true false null'.split(' '));
export function javaMarkup(source){
 const tokens=/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?[lLfFdD]?\b/g;let out='',last=0;
 for(const match of source.matchAll(tokens)){out+=escape(source.slice(last,match.index));const value=match[0],type=value.startsWith('//')||value.startsWith('/*')?'comment':value[0]==='"'||value[0]==="'"?'string':keywords.has(value)?'keyword':/^\d/.test(value)?'number':/^[A-Z]/.test(value)?'type':'';out+=type?`<span class="syntax-${type}">${escape(value)}</span>`:escape(value);last=match.index+value.length;}
 return out+escape(source.slice(last));
}
export function attachEditor(editor){
 const wrap=editor.parentElement,highlight=document.createElement('pre'),gutter=document.createElement('div'),status=document.createElement('div');
 highlight.id='editor-highlight';highlight.setAttribute('aria-hidden','true');gutter.id='editor-gutter';gutter.setAttribute('aria-hidden','true');status.id='editor-status';status.setAttribute('aria-live','polite');wrap.prepend(gutter,highlight);wrap.after(status);
 const synchronize=()=>{highlight.scrollTop=editor.scrollTop;highlight.scrollLeft=editor.scrollLeft;gutter.scrollTop=editor.scrollTop;};
 function render(){highlight.innerHTML=javaMarkup(editor.value)+'\n';gutter.textContent=Array.from({length:editor.value.split('\n').length},(_,i)=>i+1).join('\n')+'\n';synchronize();cursor();}
 function cursor(){const before=editor.value.slice(0,editor.selectionStart),line=before.split('\n').length,col=before.length-(before.lastIndexOf('\n')+1)+1;status.textContent=`第 ${line} 行，第 ${col} 列 · Java · UTF-8`;}
 editor.addEventListener('scroll',synchronize);editor.addEventListener('click',cursor);editor.addEventListener('keyup',cursor);editor.addEventListener('input',render);
 function insert(text,start=editor.selectionStart,end=editor.selectionEnd,selection='end'){editor.setRangeText(text,start,end,selection);editor.dispatchEvent(new Event('input',{bubbles:true}));}
 editor.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.defaultPrevented)return;
  const start=editor.selectionStart,end=editor.selectionEnd,code=editor.value,key=event.key,pairs={'(':')','[':']','{':'}','"':'"',"'":"'"};
  if(key==='Enter'){
   event.preventDefault();const indent=code.slice(0,start).split('\n').at(-1).match(/^\s*/)[0],extra=code[start-1]==='{'?'    ':'';
   const close=extra&&code[end]==='}'?`\n${indent}`:'';insert(`\n${indent}${extra}${close}`,start,end);editor.setSelectionRange(start+1+indent.length+extra.length,start+1+indent.length+extra.length);cursor();return;
  }
  if(key==='Backspace'&&start===end&&pairs[code[start-1]]===code[start]){event.preventDefault();insert('',start-1,start+1);return;}
  if(start===end&&[')',']','}','"',"'"].includes(key)&&code[start]===key){event.preventDefault();editor.setSelectionRange(start+1,start+1);cursor();return;}
  if(pairs[key]&&code[start-1]!=='\\'){
   event.preventDefault();const selected=code.slice(start,end);insert(key+selected+pairs[key],start,end);editor.setSelectionRange(start+1,start+1+selected.length);cursor();
  }
 });
 return {render,jump(line){const lines=editor.value.split('\n'),index=lines.slice(0,Math.max(0,line-1)).reduce((sum,line)=>sum+line.length+1,0);editor.focus();editor.setSelectionRange(index,index);editor.scrollTop=Math.max(0,(line-4)*24);synchronize();cursor();}};
}
