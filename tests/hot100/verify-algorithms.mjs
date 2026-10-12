import assert from 'node:assert/strict';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
let seed=73019,count=0;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const choose=a=>a[random(a.length)];
const normalize=(v,id)=>id===15||id===49?v.map(g=>[...g].sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):v;
function check(id,input,expected){
 const l=lessons[id],frames=l.trace(JSON.stringify(input));
 assert.deepEqual(normalize(frames.at(-1).answer,id),normalize(expected,id),`${id} ${JSON.stringify(input)}`);
 for(const f of frames){assert.ok(f.line>=1&&f.line<=l.code.split('\n').length);assert.ok(f.active.every(i=>Number.isInteger(i)&&i>=0&&i<f.values.length),`${id}: invalid highlighted cell`);}
 count++;
}
const substrings=s=>Array.from({length:s.length},(_,i)=>Array.from({length:s.length-i},(_,j)=>s.slice(i,i+j+1))).flat();
const valid=s=>{let prev;do{prev=s;s=s.replaceAll('()','').replaceAll('[]','').replaceAll('{}','');}while(s!==prev);return !s.length;};
for(let trial=0;trial<80;trial++){
 const nums=Array.from({length:1+random(7)},()=>random(9)-4),positive=nums.map(v=>Math.abs(v));
 let sum=-Infinity,product=-Infinity;
 for(let i=0;i<nums.length;i++){let s=0,p=1;for(let j=i;j<nums.length;j++){s+=nums[j];p*=nums[j];sum=Math.max(sum,s);product=Math.max(product,p);}}
 check(53,{nums},sum);check(152,{nums},product);
 const k=random(9)-4;let matches=0;
 for(let i=0;i<nums.length;i++){let s=0;for(let j=i;j<nums.length;j++){s+=nums[j];if(s===k)matches++;}}
 check(560,{nums,k},matches);
 let area=0;for(let i=0;i<positive.length;i++)for(let j=i+1;j<positive.length;j++)area=Math.max(area,Math.min(positive[i],positive[j])*(j-i));
 if(positive.length>=2)check(11,{height:positive},area);
 const trapped=positive.reduce((sum,h,i)=>sum+Math.max(0,Math.min(Math.max(...positive.slice(0,i+1)),Math.max(...positive.slice(i)))-h),0);
 check(42,{height:positive},trapped);
 let rectangle=0;for(let i=0;i<positive.length;i++){let h=Infinity;for(let j=i;j<positive.length;j++){h=Math.min(h,positive[j]);rectangle=Math.max(rectangle,h*(j-i+1));}}
 check(84,{heights:positive},rectangle);
 const wait=nums.map((v,i)=>{const offset=nums.slice(i+1).findIndex(x=>x>v);return offset<0?0:offset+1;});check(739,{temperatures:nums},wait);
 const width=1+random(nums.length),maxima=Array.from({length:nums.length-width+1},(_,i)=>Math.max(...nums.slice(i,i+width)));check(239,{nums,k:width},maxima);
 let profit=0;for(let i=0;i<positive.length;i++)for(let j=i+1;j<positive.length;j++)profit=Math.max(profit,positive[j]-positive[i]);check(121,{prices:positive},profit);
 const reachable=Array(nums.length).fill(Infinity);reachable[0]=0;for(let i=0;i<nums.length;i++)for(let d=1;d<=positive[i]&&i+d<nums.length;d++)reachable[i+d]=Math.min(reachable[i+d],reachable[i]+1);
 check(55,{nums:positive},Number.isFinite(reachable.at(-1)));if(Number.isFinite(reachable.at(-1)))check(45,{nums:positive},reachable.at(-1));
 let lis=0,rob=0;const totals=[];
 for(let mask=0;mask<1<<nums.length;mask++){
  const chosen=nums.filter((_,i)=>mask>>i&1);if(chosen.every((v,i)=>!i||v>chosen[i-1]))lis=Math.max(lis,chosen.length);
  if(!(mask&(mask<<1)))rob=Math.max(rob,positive.reduce((sum,v,i)=>sum+(mask>>i&1?v:0),0));
  totals.push(positive.reduce((sum,v,i)=>sum+(mask>>i&1?v+1:0),0));
 }
 check(300,{nums},lis);check(198,{nums:positive},rob);
 const partition=positive.map(v=>v+1),total=partition.reduce((a,b)=>a+b,0);check(416,{nums:partition},total%2===0&&totals.includes(total/2));
 const missing=new Set(nums);let answer=1;while(missing.has(answer))answer++;check(41,{nums},answer);
 if(nums.length>=2)check(238,{nums},nums.map((_,i)=>nums.reduce((p,v,j)=>p*(i===j?1:v),1)));
 const steps=random(20),rotated=nums.map((_,i)=>nums[(i-steps%nums.length+nums.length)%nums.length]);check(189,{nums,k:steps},rotated);
 const colors=Array.from({length:random(10)},()=>random(3));check(75,{nums:colors},[...colors].sort());
 const s=Array.from({length:random(9)},()=>choose(['a','b','c'])).join('');
 const unique=Math.max(0,...substrings(s).filter(v=>new Set(v).size===v.length).map(v=>v.length));check(3,{s},unique);
 const p=Array.from({length:1+random(4)},()=>choose(['a','b','c'])).join(''),key=[...p].sort().join('');check(438,{s,p},Array.from({length:Math.max(0,s.length-p.length+1)},(_,i)=>i).filter(i=>[...s.slice(i,i+p.length)].sort().join('')===key));
 let minimum='';for(const sub of substrings(s)){const counts=[...new Set(p)].every(c=>[...sub].filter(v=>v===c).length>=[...p].filter(v=>v===c).length);if(counts&&(!minimum||sub.length<minimum.length))minimum=sub;}check(76,{s,t:p},minimum);
 const wordDict=['a','bb','ab'];const split=word=>!word.length||wordDict.some(v=>word.startsWith(v)&&split(word.slice(v.length)));check(139,{s,wordDict},split(s));
 const parentheses=Array.from({length:random(9)},()=>choose(['(',')'])).join('');check(20,{s:parentheses},valid(parentheses));check(32,{s:parentheses},Math.max(0,...substrings(parentheses).filter(valid).map(v=>v.length)));
 const n=1+random(24);let queue=[0],dist=Array(n+1).fill(-1);dist[0]=0;while(queue.length){const x=queue.shift();for(let j=1;j*j+x<=n;j++)if(dist[x+j*j]<0){dist[x+j*j]=dist[x]+1;queue.push(x+j*j);}}check(279,{n},dist[n]);
 const amount=random(20),coins=[2,3,5];queue=[0];dist=Array(amount+1).fill(-1);dist[0]=0;while(queue.length){const x=queue.shift();for(const coin of coins)if(x+coin<=amount&&dist[x+coin]<0){dist[x+coin]=dist[x]+1;queue.push(x+coin);}}check(322,{coins,amount},dist[amount]);
 const uniqueNumber=20+random(10),paired=[1,2,3].flatMap(v=>[v,v]);paired.push(uniqueNumber);paired.sort(()=>random(3)-1);check(136,{nums:paired},uniqueNumber);
 const majority=random(5),voters=[majority,majority,majority,majority,8,9,10];voters.sort(()=>random(3)-1);check(169,{nums:voters},majority);
 const duplicate=1+random(5),duplicates=[1,2,3,4,5,duplicate];duplicates.sort(()=>random(3)-1);check(287,{nums:duplicates},duplicate);
 const repeat=1+random(5);check(394,{s:`${repeat}[a2[b]]`},'abb'.repeat(repeat));
 const sorted=[...nums].sort((a,b)=>a-b),target=random(11)-5;check(34,{nums:sorted,target},[sorted.indexOf(target),sorted.lastIndexOf(target)]);
 const distinct=[...new Set(sorted)],pivot=random(distinct.length),rotation=[...distinct.slice(pivot),...distinct.slice(0,pivot)];check(33,{nums:rotation,target},rotation.indexOf(target));check(153,{nums:rotation},Math.min(...rotation));
 const middle=random(sorted.length+1),nums1=sorted.slice(0,middle),nums2=sorted.slice(middle),length=sorted.length;check(4,{nums1,nums2},length%2?sorted[Math.floor(length/2)]:(sorted[length/2-1]+sorted[length/2])/2);
 const rows=1+random(4),columns=1+random(4),grid=Array.from({length:rows},()=>Array.from({length:columns},()=>random(5)));
 const zeroed=grid.map((row,r)=>row.map((v,c)=>row.includes(0)||grid.some(line=>line[c]===0)?0:v));check(73,{matrix:grid},zeroed);
 const side=1+random(4),square=Array.from({length:side},()=>Array.from({length:side},()=>random(10)));check(48,{matrix:square},square[0].map((_,c)=>square.map(row=>row[c]).reverse()));
 const ordered=Array.from({length:rows},(_,r)=>Array.from({length:columns},(_,c)=>r*columns+c));const needle=random(rows*columns+3)-1;check(74,{matrix:ordered,target:needle},ordered.flat().includes(needle));check(240,{matrix:ordered,target:needle},ordered.flat().includes(needle));
 const visited=new Set(),spiral=[],directions=[[0,1],[1,0],[0,-1],[-1,0]];let r=0,c=0,d=0;
 for(let i=0;i<rows*columns;i++){spiral.push(grid[r][c]);visited.add(`${r},${c}`);let nr=r+directions[d][0],nc=c+directions[d][1];if(nr<0||nr>=rows||nc<0||nc>=columns||visited.has(`${nr},${nc}`)){d=(d+1)%4;nr=r+directions[d][0];nc=c+directions[d][1];}r=nr;c=nc;}
 check(54,{matrix:grid},spiral);
}
for(const [id,l] of Object.entries(lessons))check(Number(id),JSON.parse(l.raw),l.expected);
console.log(`通过：${count} 组独立穷举、搜索及边界用例；全部动画步骤的代码行和高亮位置有效。`);
