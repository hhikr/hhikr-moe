import assert from 'node:assert/strict';
const active=new Set(),classes=new Set(),styles=[];
let reduced=false,rejectReady=false,failStart=false,finish,finishedPromise,applied=0,autoFinish=true,reversals=0,readyGate=null;
globalThis.innerWidth=1280;globalThis.innerHeight=720;
globalThis.matchMedia=()=>({matches:reduced});
globalThis.requestAnimationFrame=callback=>{assert.ok(classes.has('day-night-transition'),'最后一帧前不得恢复按钮颜色过渡');queueMicrotask(callback);};
const root={get offsetWidth(){assert.ok(classes.has('day-night-transition'),'提交主题后的样式刷新必须禁用颜色过渡');return 1280;},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},animate:(frames,options)=>{
 assert.equal(options.pseudoElement,'::view-transition-new(root)');
 assert.match(frames.clipPath[0],/circle\(0px at 1200px 30px\)/);
 const radius=Number(frames.clipPath[1].match(/circle\(([\d.]+)px/)[1]);
 assert.ok(radius>=Math.hypot(1200,690));
 assert.equal(options.easing,'linear');assert.equal(options.duration,radius/3000*1000);
 const animation={finished:finishedPromise,cancel:()=>active.delete(animation),updatePlaybackRate:rate=>{assert.ok(rate===1||rate===-1);reversals++;}};active.add(animation);if(autoFinish)queueMicrotask(finish);return animation;
}};
globalThis.document={documentElement:root,getElementById:()=>styles[0],createElement:()=>({}),head:{append:s=>styles.push(s)},startViewTransition:apply=>{
 if(failStart)throw Error('start failed');apply();
 const finished=new Promise(resolve=>{finish=resolve;});
 finishedPromise=finished;
 return {ready:rejectReady?Promise.reject(Error('snapshot failed')):readyGate||Promise.resolve(),finished,skipTransition:()=>finish()};
}};
const {switchTheme}=await import('../../src/scripts/theme-transition.mjs');
const button={getBoundingClientRect:()=>({left:1180,top:10,width:40,height:40})};
for(let i=0;i<12;i++){
 await switchTheme(()=>applied++,button);
 assert.equal(active.size,0,`切换 ${i+1} 后不得保留动画`);assert.equal(classes.size,0);
}
assert.equal(applied,12);assert.equal(styles.length,1);
rejectReady=true;await switchTheme(()=>applied++,button);assert.equal(classes.size,0);
rejectReady=false;await switchTheme(()=>applied++,button);assert.equal(active.size,0);
failStart=true;await switchTheme(()=>applied++,button);assert.equal(classes.size,0);failStart=false;
reduced=true;await switchTheme(()=>applied++,button);reduced=false;
const start=document.startViewTransition;document.startViewTransition=undefined;await switchTheme(()=>applied++,button);document.startViewTransition=start;
assert.equal(applied,17);
autoFinish=false;let theme='dark';
const first=switchTheme(()=>theme='light',button);await Promise.resolve();
assert.equal(active.size,1);await switchTheme(()=>theme='dark',button);assert.equal(theme,'light','动画期间不能改变参与扩散的主题颜色');assert.equal(reversals,1);
await switchTheme(()=>theme='light',button);assert.equal(theme,'light');assert.equal(reversals,2);assert.equal(active.size,1);
finish();await first;assert.equal(active.size,0);assert.equal(theme,'light');
const single=switchTheme(()=>theme='dark',button);await Promise.resolve();await switchTheme(()=>theme='light',button);
assert.equal(theme,'dark','退回过程中黑色覆盖层必须保留');finish();await single;assert.equal(theme,'light');assert.equal(active.size,0);
let ready;readyGate=new Promise(resolve=>ready=resolve);
const early=switchTheme(()=>theme='dark',button);await switchTheme(()=>theme='light',button);ready();await Promise.resolve();await Promise.resolve();
assert.equal(theme,'dark','准备期间反向也不得提前替换主题');assert.equal(reversals,4);finish();await early;assert.equal(theme,'light');assert.equal(active.size,0);
console.log('通过：连续 12 次切换清理、扩散半径、失败恢复、兼容回退、播放中两次反向及快照准备期间再次点击。');
