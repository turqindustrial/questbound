import {useEffect,useState} from 'react';
// The page is pinned to the part of the screen that is really visible. When a phone's keyboard opens, that part
// shrinks (and on iOS can slide under the page): the app follows it, so whatever sits at the bottom of a screen (the
// message box) rests right above the keyboard and nothing is pushed off the top.
let visual={height:0,keyboard:false};
const listeners=new Set(),editable=el=>!!el&&(/^(INPUT|TEXTAREA)$/.test(el.tagName??'')||el.isContentEditable===true);
export function initializeWebLayout(){
 if(typeof document==='undefined')return;
 document.querySelector('meta[name="viewport"]')?.setAttribute('content','width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content');
 const style=document.createElement('style');style.id='questbound-mobile-layout';
 style.textContent='html,body{margin:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;}'
  +'#root{position:fixed;left:0;top:var(--questbound-top,0px);width:100%;height:var(--questbound-height,100dvh);min-height:0;box-sizing:border-box;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);}'
  +'html.qb-keyboard #root{padding-bottom:0;}'
  // Dialogs sit inside the visible part too, so a field in one is never hidden behind the keyboard.
  +'[data-qb=scrim]{flex:none !important;height:var(--questbound-height,100dvh) !important;margin-top:var(--questbound-top,0px);box-sizing:border-box;}'
  +'input,textarea{font-size:16px;}';
 document.head.appendChild(style);
 let full=0,width=0;
 // A field in a scrolling page (a name, a note, a code) is brought into view above the keyboard. The message box at
 // the bottom of the play screen is already there.
 const reveal=()=>{
  const el=document.activeElement;if(!editable(el)||el.closest?.('[data-composer]'))return;
  const vv=window.visualViewport,top=vv?.offsetTop??0,bottom=top+(vv?.height??window.innerHeight),r=el.getBoundingClientRect();
  if(r.bottom>bottom-12||r.top<top+56)el.scrollIntoView({block:'center',behavior:'smooth'});
 };
 const resize=()=>{
  const vv=window.visualViewport;
  // A pinch-zoomed page is left alone: the player is looking closer, not typing.
  if(vv&&Math.abs(vv.scale-1)>0.02)return;
  const height=Math.round(vv?.height??window.innerHeight),top=Math.max(0,Math.round(vv?.offsetTop??0));
  // The tallest the page has been at this width is the screen without a keyboard.
  if(window.innerWidth!==width){width=window.innerWidth;full=height;}else if(!editable(document.activeElement))full=height;else full=Math.max(full,height);
  const keyboard=editable(document.activeElement)&&height<full-110;
  const root=document.documentElement;
  root.style.setProperty('--questbound-height',height+'px');root.style.setProperty('--questbound-top',top+'px');root.classList.toggle('qb-keyboard',keyboard);
  if(visual.height!==height||visual.keyboard!==keyboard){
   // Less of the page is visible than a moment ago (a keyboard opening): keep the field being typed in on screen.
   const shrunk=height<visual.height||keyboard;
   visual={height,keyboard};for(const listener of listeners)listener(visual);
   if(shrunk&&editable(document.activeElement))setTimeout(reveal,80);
  }
 };
 window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize);
 // The keyboard arrives a moment after focus: measure again once it has.
 const later=()=>{setTimeout(resize,60);setTimeout(resize,350);};
 document.addEventListener('focusin',later);document.addEventListener('focusout',later);
 // A tap on a control beside a text field (Send, a toggle) must not take focus from the field first: on phones that
 // closes the keyboard and moves the control out from under the finger, so the tap is lost.
 document.addEventListener('mousedown',event=>{if(event.target?.closest?.('[data-keepfocus]')&&editable(document.activeElement))event.preventDefault();},true);
 document.addEventListener('focusin',()=>{setTimeout(reveal,150);setTimeout(reveal,500);});
 // A row that scrolls sideways (the action chips, the row of lands on the map) turns under a mouse wheel, so every
 // chip can be reached without a touch screen. At either end the wheel is left to whatever lies behind.
 document.addEventListener('wheel',event=>{
  if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  let el=event.target instanceof Element?event.target:null;
  for(;el&&el!==document.body;el=el.parentElement){
   if(el.scrollWidth<=el.clientWidth+1)continue;
   const cs=getComputedStyle(el);
   if(!/(auto|scroll)/.test(cs.overflowX))continue;
   // A pane that also scrolls up and down keeps the wheel for that.
   if(/(auto|scroll)/.test(cs.overflowY)&&el.scrollHeight>el.clientHeight+1)return;
   const before=el.scrollLeft;el.scrollLeft+=event.deltaY;
   if(el.scrollLeft!==before){event.preventDefault();event.stopPropagation();}
   return;
  }
 },{passive:false,capture:true});
 resize();
}
// The visible height and whether a keyboard is covering part of the screen.
export function useVisualViewport(){
 const [state,setState]=useState(visual);
 useEffect(()=>{listeners.add(setState);setState(visual);return()=>{listeners.delete(setState);};},[]);
 return state;
}
// A device typed on with an on-screen keyboard: touch input and a phone- or tablet-sized window.
export function touchKeyboard(win=globalThis.window){
 try{return !!win&&((win.navigator?.maxTouchPoints??0)>0||!!win.matchMedia?.('(pointer: coarse)').matches)&&win.innerWidth<1000;}catch{return false;}
}
