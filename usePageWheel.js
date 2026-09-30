import {useEffect} from 'react';
import {Platform} from 'react-native';
// Consume wheel movement in the nearest pane that can scroll; at its boundary,
// pass movement to its parent instead of trapping the pointer over a dead zone.
export function usePageWheel(scrollRef){
 useEffect(()=>{
  if(Platform.OS!=='web')return;
  const wheel=event=>{
   if(event.ctrlKey||event.metaKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
   const target=event.target instanceof Element?event.target:null;if(!target)return;
   const modal=target.closest('[aria-modal="true"]'),root=modal??scrollRef.current?.getScrollableNode?.();
   if(!root)return;
   let node=target,chosen=null;
   while(node){
    if(node.scrollHeight>node.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(node).overflowY)&&((event.deltaY>0&&node.scrollTop<node.scrollHeight-node.clientHeight-1)||(event.deltaY<0&&node.scrollTop>0))){chosen=node;break;}
    if(node===root)break;node=node.parentElement;
   }
   if(!chosen&&modal)chosen=Array.from(modal.querySelectorAll('*')).find(el=>el.scrollHeight>el.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(el).overflowY));
   if(!chosen&&!modal&&root.scrollHeight>root.clientHeight)chosen=root;
   if(chosen){event.preventDefault();const amount=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?chosen.clientHeight:1);chosen.scrollTop+=amount;}
  };
  document.addEventListener('wheel',wheel,{passive:false,capture:true});return()=>document.removeEventListener('wheel',wheel,{capture:true});
 },[scrollRef]);
}
