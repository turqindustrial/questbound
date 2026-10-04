import {useEffect} from 'react';
import {Platform} from 'react-native';
// A mouse wheel over a part of the page that cannot scroll (a header, a margin, a dialog's backdrop) would do nothing;
// this sends that movement to the pane that can scroll instead (the page's own scroll view, or the open dialog's).
// Wherever the browser can scroll something under the pointer itself, it is left alone, so its own smooth scrolling
// works. The listener is passive: it never cancels the browser's scrolling, it only adds to it where there is none.
const canScroll=(node,dy)=>node.scrollHeight>node.clientHeight+1&&(dy>0?node.scrollTop<node.scrollHeight-node.clientHeight-1:node.scrollTop>0)&&/(auto|scroll)/.test(getComputedStyle(node).overflowY);
const scrollable=node=>node.scrollHeight>node.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(node).overflowY);
// A dialog's scroll pane, found once (breadth first, stopping at the first that scrolls) and remembered per dialog.
const modalPanes=new WeakMap();
function modalPane(modal){
 const known=modalPanes.get(modal);if(known&&known.isConnected&&modal.contains(known)&&scrollable(known))return known;
 const queue=[modal];let found=null;
 for(let i=0;i<queue.length&&i<400&&!found;i++){const el=queue[i];if(el!==modal&&scrollable(el))found=el;else queue.push(...el.children);}
 if(found)modalPanes.set(modal,found);
 return found;
}
export function usePageWheel(scrollRef){
 useEffect(()=>{
  if(Platform.OS!=='web'||typeof document==='undefined')return;
  const wheel=event=>{
   if(event.defaultPrevented||event.ctrlKey||event.metaKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
   const target=event.target instanceof Element?event.target:null;if(!target)return;
   // Anything under the pointer that can move this way scrolls by itself.
   for(let node=target;node&&node!==document.documentElement;node=node.parentElement)if(canScroll(node,event.deltaY))return;
   const modal=target.closest('[aria-modal="true"]');
   const pane=modal?modalPane(modal):scrollRef.current?.getScrollableNode?.();
   if(!pane||!canScroll(pane,event.deltaY))return;
   pane.scrollTop+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?pane.clientHeight:1);
  };
  const options={passive:true,capture:true};
  document.addEventListener('wheel',wheel,options);return()=>document.removeEventListener('wheel',wheel,options);
 },[scrollRef]);
}
