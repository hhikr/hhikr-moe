import {array,integer} from './lesson-kit.mjs';
export function node(value,nodes,depth=0){const n={id:nodes.length,val:value,next:null,left:null,right:null,random:null,depth};nodes.push(n);return n;}
export function list(values,nodes,tail=null){const a=array(values,'链表',{max:16}),created=a.map(value=>node(value,nodes));for(let i=0;i<created.length;i++)created[i].next=created[i+1]||tail;return created[0]||tail;}
export function values(head,property='next'){const out=[],seen=new Set();while(head){if(seen.has(head))throw Error('结果存在环');seen.add(head);out.push(head.val);head=head[property];}return out;}
export function tree(input,nodes){
 if(!Array.isArray(input)||input.length>31||!input.every(v=>v===null||Number.isInteger(v)&&Math.abs(v)<=100000))throw Error('root 须为最多 31 项的层序数组，空位置用 null');
 if(!input.length)return null;if(input[0]===null){if(input.some(v=>v!==null))throw Error('空根节点不能带子节点');return null;}
 const root=node(input[0],nodes),queue=[root];let index=1;
 for(let i=0;i<queue.length&&index<input.length;i++)for(const key of ['left','right']){
  if(index>=input.length)break;const value=input[index++];if(value!==null){const child=node(value,nodes,queue[i].depth+1);queue[i][key]=child;queue.push(child);}
 }
 if(input.slice(index).some(v=>v!==null))throw Error('层序输入含无法连接到根节点的元素');return root;
}
export function treeValues(root){if(!root)return [];const queue=[root],out=[];for(let i=0;i<queue.length;i++){const n=queue[i];out.push(n?.val??null);if(n)queue.push(n.left,n.right);}while(out.at(-1)===null)out.pop();return out;}
export function structureSteps(emit,nodes,kind='linked',root=null){return (key,note,vars={},active=[],pointers={},stored=[])=>{
 const visual={kind,root:root?.id??null,nodes:nodes.map(n=>({id:n.id,val:n.val,depth:n.depth,next:n.next?.id??null,left:n.left?.id??null,right:n.right?.id??null,random:n.random?.id??null})),pointers:Object.fromEntries(Object.entries(pointers).map(([name,n])=>[name,n?.id??null]))};
 emit(key,nodes.map(n=>n.val),active.filter(Boolean).map(n=>nodes.indexOf(n)),note,vars,stored,visual);
};}
export function cyclic(input,nodes){const head=list(input.head,nodes);const pos=integer(input.pos,'pos',-1,(input.head?.length||0)-1);if(pos>=0){let tail=head,target=head;for(let i=0;i<pos;i++)target=target.next;while(tail.next)tail=tail.next;tail.next=target;}return head;}
