// Hover tooltips (desktop): every element with dataSet={{tip:'…'}} (data-tip) shows its words in one tooltip that
// lives on <body> above every layer, so no panel, scroll area, transform or later sibling can clip or cover it
// (the host, 2026-10-12: "make sure the pop up appears above all other layers. make sure all pop ups work the same
// way when hovered over"). It sits below the element, or above when there is no room below, and is kept inside the
// window, so a button at the screen's edge (the folded side rail) still shows all of it. Touch never shows it.
import {tint} from './theme';
const gap=8,edge=8;
export function placeTip(anchor,tip,view,side){
 // anchor: the hovered element's rect; tip: {width,height}; view: {width,height}; side 'right' (data-tip-side) puts
 // it beside the element, for a column of buttons such as the folded side rail. Returns {left,top,below}.
 if(side==='right'&&anchor.right+gap+tip.width<=view.width-edge)return {left:Math.round(anchor.right+gap),top:Math.round(Math.max(edge,Math.min(view.height-edge-tip.height,anchor.top+anchor.height/2-tip.height/2))),below:false};
 const below=anchor.bottom+gap+tip.height<=view.height-edge||anchor.top-gap-tip.height<edge;
 const top=below?anchor.bottom+gap:anchor.top-gap-tip.height;
 const centre=anchor.left+anchor.width/2,left=Math.max(edge,Math.min(view.width-edge-tip.width,centre-tip.width/2));
 return {left:Math.round(left),top:Math.round(Math.max(edge,top)),below};
}
export function initializeTooltips(){
 if(typeof document==='undefined'||document.getElementById('qb-tooltip'))return;
 const style=document.createElement('style');style.id='qb-tooltip-style';
 style.textContent=`[data-tip]:hover::after{content:none!important;display:none!important;}
#qb-tooltip{position:fixed;left:0;top:0;z-index:2147483647;max-width:min(320px,calc(100vw - 16px));white-space:normal;padding:5px 9px;border-radius:4px;border:1px solid ${tint('rgba(178,34,58,.45)')};background:${tint('rgba(14,10,14,.96)')};color:${tint('#e8dbd5')};font:600 11px/1.3 Inter,system-ui,sans-serif;letter-spacing:.4px;box-shadow:0 8px 20px ${tint('rgba(0,0,0,.5)')};pointer-events:none;opacity:0;transition:opacity .15s ease;}
#qb-tooltip[data-on=on]{opacity:1;}`;
 document.head.appendChild(style);
 const tip=document.createElement('div');tip.id='qb-tooltip';tip.setAttribute('role','tooltip');tip.setAttribute('aria-hidden','true');document.body.appendChild(tip);
 let current=null,touch=false;
 const hide=()=>{current=null;tip.removeAttribute('data-on');};
 const show=el=>{const words=el.getAttribute('data-tip');if(!words){hide();return;}current=el;tip.textContent=words;
  const r=el.getBoundingClientRect();if(!r.width&&!r.height){hide();return;}
  const at=placeTip(r,{width:tip.offsetWidth,height:tip.offsetHeight},{width:window.innerWidth,height:window.innerHeight},el.getAttribute('data-tip-side'));
  tip.style.left=at.left+'px';tip.style.top=at.top+'px';tip.setAttribute('data-on','on');};
 document.addEventListener('pointerdown',e=>{touch=e.pointerType==='touch';hide();},true);
 document.addEventListener('pointerover',e=>{if(e.pointerType==='touch'||touch&&e.pointerType!=='mouse')return;touch=false;const el=e.target instanceof Element?e.target.closest('[data-tip]'):null;if(el!==current){if(el)show(el);else hide();}},true);
 document.addEventListener('pointerout',e=>{if(!current)return;const to=e.relatedTarget instanceof Element?e.relatedTarget.closest('[data-tip]'):null;if(to!==current)hide();},true);
 // Keyboard users see the same words on focus.
 document.addEventListener('focusin',e=>{const el=e.target instanceof Element?e.target.closest('[data-tip]'):null;if(el&&el.matches(':focus-visible'))show(el);},true);
 document.addEventListener('focusout',()=>hide(),true);
 for(const kind of ['scroll','wheel','keydown','blur'])window.addEventListener(kind,hide,true);
 // A tooltip never outlives its element (a screen change removes the button under the pointer).
 setInterval(()=>{if(current&&!current.isConnected)hide();},400);
}
