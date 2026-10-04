// How well this device draws the game: page load times, long stalls of the page (long tasks) and, for eight seconds
// after the launch tap, how many frames take too long. The Atmosphere setting's Auto mode (fullscreen.js) turns to
// Light on a computer that drops more than a quarter of its frames then. perfHealth() goes into feedback notes.
import {displayState,setDisplayPrefs} from './fullscreen';

const SAMPLE_MS=8000,SETTLE_MS=1200,SLOW_FRAME_MS=34,SLOW_SHARE=.25,MIN_FRAMES=40;
const perf={domReadyMs:null,loadMs:null,longTasks:0,worstLongTaskMs:0,slowFramePct:null,frames:0,autoLight:false,sampled:false};
let observing=false,sampling=false;

// The share of frame gaps over SLOW_FRAME_MS (about two frames at 60 Hz), and whether that calls for Light.
// Gaps longer than a second are a hidden window or a debugger, not drawing, and are left out.
export function judgeFrames(gaps){
 const counted=(gaps??[]).filter(g=>Number.isFinite(g)&&g>0&&g<1000);
 if(counted.length<MIN_FRAMES)return {frames:counted.length,slowPct:null,light:false};
 const slow=counted.filter(g=>g>SLOW_FRAME_MS).length,share=slow/counted.length;
 return {frames:counted.length,slowPct:Math.round(share*1000)/10,light:share>SLOW_SHARE};
}

function readTimings(){
 try{
  const nav=globalThis.performance?.getEntriesByType?.('navigation')?.[0];
  if(nav){if(nav.domContentLoadedEventEnd>0)perf.domReadyMs=Math.round(nav.domContentLoadedEventEnd);if(nav.loadEventEnd>0)perf.loadMs=Math.round(nav.loadEventEnd);}
 }catch{}
}

function observeLongTasks(){
 if(observing||typeof globalThis.PerformanceObserver!=='function')return;
 try{
  const observer=new globalThis.PerformanceObserver(list=>list.getEntries().forEach(entry=>{perf.longTasks++;perf.worstLongTaskMs=Math.max(perf.worstLongTaskMs,Math.round(entry.duration));}));
  observer.observe({type:'longtask',buffered:true});observing=true;
 }catch{}
}

// Called once after the launch tap. Samples requestAnimationFrame for eight seconds (after a moment for the first
// screen to settle) while the page is visible; an Auto device that struggles is switched to Light and remembers it.
export function startPerfWatch({raf=globalThis.requestAnimationFrame,now=()=>globalThis.performance?.now?.()??Date.now(),later=setTimeout,doc=globalThis.document}={}){
 readTimings();observeLongTasks();
 if(sampling||perf.sampled||typeof raf!=='function')return;
 sampling=true;
 later(()=>{
  const gaps=[];let last=null;const until=now()+SAMPLE_MS;
  const frame=t=>{
   const at=Number.isFinite(t)?t:now();
   if(doc?.hidden){last=null;}else{if(last!==null)gaps.push(at-last);last=at;}
   if(at<until)return raf(frame);
   sampling=false;perf.sampled=true;
   const verdict=judgeFrames(gaps);perf.frames=verdict.frames;perf.slowFramePct=verdict.slowPct;
   const display=displayState();
   if(verdict.light&&display.effects==='auto'&&!display.autoLight){perf.autoLight=true;setDisplayPrefs({autoLight:true});}
   readTimings();
  };
  raf(frame);
 },SETTLE_MS);
}

export function perfHealth(){
 readTimings();
 const display=displayState();
 return {domReadyMs:perf.domReadyMs,loadMs:perf.loadMs,longTasks:perf.longTasks,worstLongTaskMs:perf.worstLongTaskMs,slowFramePct:perf.slowFramePct,frames:perf.frames,autoLight:!!display.autoLight,effects:display.effectsActive};
}

// While something covers the whole screen (a tale being written, a scene change, the agreement, the finale), the
// scenery underneath stops moving: <html data-covered="on"> pauses the stage's animations (webTheme.js). Each cover
// registers under its own name, so one closing does not uncover another.
const covers=new Set();
export function setCovered(name,on,doc=globalThis.document){
 if(on)covers.add(name);else covers.delete(name);
 const root=doc?.documentElement;if(!root?.dataset)return covers.size>0;
 if(covers.size)root.dataset.covered='on';else delete root.dataset.covered;
 return covers.size>0;
}
