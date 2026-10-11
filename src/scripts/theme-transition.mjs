import {createRevealMotion} from './reveal-motion.mjs';
let session=null;
function installStyle(){
 if(document.getElementById('day-night-transition'))return;
 const style=document.createElement('style');style.id='day-night-transition';
 style.textContent=`html.day-night-transition::view-transition{pointer-events:none}html.day-night-transition::view-transition-group(root){animation:none;pointer-events:none}html.day-night-transition::view-transition-image-pair(root){pointer-events:none}html.day-night-transition::view-transition-old(root),html.day-night-transition::view-transition-new(root){animation:none;mix-blend-mode:normal;pointer-events:none}html.day-night-transition::view-transition-old(root){z-index:1}html.day-night-transition::view-transition-new(root){z-index:2;will-change:clip-path}html.day-night-transition *{transition:none!important}`;
 document.head.append(style);
}
export async function switchTheme(apply,button){
 if(session){
  session.reversed=!session.reversed;session.latestApply=apply;session.interrupted=true;
  if(session.reveal)session.reveal.turn();
  return;
 }
 if(!document.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches){apply();return;}
 const current={reveal:null,reversed:false,latestApply:apply,interrupted:false};session=current;installStyle();
 const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
 const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
 document.documentElement.classList.add('day-night-transition');
 let transition,reveal;
 try{
  transition=document.startViewTransition(apply);
  await transition.ready;
  reveal=createRevealMotion(document.documentElement,{x,y,radius});
  current.reveal=reveal;
  if(current.reversed)reveal.turn();
  await reveal.finished;
  if(current.interrupted)current.latestApply();
  void document.documentElement.offsetWidth;
  transition.skipTransition();
  await transition.finished;
  await new Promise(resolve=>requestAnimationFrame(resolve));
 }catch{if(transition){transition.skipTransition();if(current.interrupted)current.latestApply();}else current.latestApply();}
 finally{reveal?.cancel();document.documentElement.classList.remove('day-night-transition');session=null;}
}
