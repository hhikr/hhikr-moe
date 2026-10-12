export const revealSpeed=3000;

export function createRevealMotion(element,{x,y,radius}){
 const duration=radius/revealSpeed*1000;
 const animation=element.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},
  {duration,easing:'linear',fill:'both',pseudoElement:'::view-transition-new(root)'});
 let direction=1;
 return {
  get finished(){return animation.finished;},
  turn(){direction=-direction;animation.updatePlaybackRate(direction);},
  cancel(){animation.cancel();},
 };
}
