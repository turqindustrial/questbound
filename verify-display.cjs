const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// A minimal browser: full-screen requests, events, head tags, storage and display modes.
function browser({supported=true,installed=false,ua='Mozilla/5.0 (Windows NT 10.0)',platform='Win32',touch=0}={}){
 const listeners={},head=[],store={},calls=[];let fullscreenElement=null;
 const fire=(type,event)=>(listeners[type]??[]).forEach(fn=>fn({type,...event}));
 const documentElement={requestFullscreen:supported?async options=>{calls.push(['enter',options]);fullscreenElement=documentElement;fire('fullscreenchange',{});}:undefined};
 const document={documentElement,get fullscreenElement(){return fullscreenElement;},fullscreenEnabled:supported,head:{appendChild:el=>head.push(el)},
  createElement:tag=>{const el={tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;}};return el;},querySelector:()=>null,
  exitFullscreen:async()=>{calls.push(['exit']);fullscreenElement=null;fire('fullscreenchange',{});},
  addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn)};
 const context={document,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},navigator:{userAgent:ua,platform,maxTouchPoints:touch},matchMedia:()=>({matches:installed}),screen:{orientation:{type:'landscape-primary',lock:async()=>{calls.push(['lock']);}}}};
 context.globalThis=context;
 const api=vm.runInNewContext(fs.readFileSync('fullscreen.js','utf8').replace(/export /g,'')+'\n({initializeFullscreen,displayState,toggleFullscreen,enterFullscreen,setDisplayPrefs,subscribeDisplay})',context);
 return {api,calls,head,fire,store,get full(){return !!fullscreenElement;}};
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 // Desktop/Android: the button toggles the Fullscreen API, hiding browser UI and keeping orientation.
 let b=browser();b.api.initializeFullscreen();
 assert.equal(b.head.find(e=>e.attrs.rel==='manifest').attrs.href,'/manifest.json');assert.ok(b.head.some(e=>e.attrs.name==='apple-mobile-web-app-capable'));assert.ok(b.head.some(e=>e.attrs.rel==='apple-touch-icon'));
 const seen=[];b.api.subscribeDisplay(s=>seen.push(s.fullscreen));
 assert.equal(b.api.displayState().supported,true);await b.api.toggleFullscreen();assert.equal(b.full,true);assert.equal(JSON.stringify(b.calls[0]),JSON.stringify(['enter',{navigationUI:'hide'}]));assert.ok(b.calls.some(c=>c[0]==='lock'));assert.equal(seen.at(-1),true);
 await b.api.toggleFullscreen();assert.equal(b.full,false);assert.equal(seen.at(-1),false);
 // F toggles, but never while typing or with shortcuts held.
 b.fire('keydown',{key:'f',target:{tagName:'DIV'},preventDefault(){}});await tick();assert.equal(b.full,true);
 b.fire('keydown',{key:'f',target:{tagName:'TEXTAREA'},preventDefault(){}});await tick();assert.equal(b.full,true);
 b.fire('keydown',{key:'f',ctrlKey:true,target:{tagName:'DIV'},preventDefault(){}});await tick();assert.equal(b.full,true);
 b.fire('keydown',{key:'F',target:{tagName:'DIV'},preventDefault(){}});await tick();assert.equal(b.full,false);
 // Optional auto full screen on the first tap, remembered per device, and it does not fight the F key.
 b=browser();b.api.initializeFullscreen();b.fire('pointerup',{});await tick();assert.equal(b.full,false,'Off by default');
 b.api.setDisplayPrefs({autoFullscreen:true});assert.equal(JSON.parse(b.store['questbound.display.v1']).autoFullscreen,true);
 b.fire('pointerup',{});await tick();assert.equal(b.full,true);
 b=browser();b.store['questbound.display.v1']=JSON.stringify({autoFullscreen:true});b.api.initializeFullscreen();b.fire('keydown',{key:'f',target:{tagName:'DIV'},preventDefault(){}});await tick();assert.equal(b.full,true,'F with auto enabled enters once, not twice');
 // Installed Home Screen apps are already full screen; iPhone falls back to Home Screen instructions.
 b=browser({installed:true});b.store['questbound.display.v1']=JSON.stringify({autoFullscreen:true});b.api.initializeFullscreen();b.fire('pointerup',{});await tick();assert.equal(b.full,false);assert.equal(b.api.displayState().installed,true);
 b=browser({supported:false,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',platform:'iPhone'});b.api.initializeFullscreen();
 const s=b.api.displayState();assert.equal(s.supported,false);assert.equal(s.ios,true);assert.equal(await b.api.enterFullscreen(),false);
 assert.equal(browser({supported:false,platform:'MacIntel',touch:5}).api.displayState().ios,true,'iPadOS reports as a Mac with touch');
 // The web manifest opens installs full screen with the gold icon.
 const manifest=JSON.parse(fs.readFileSync('public/manifest.json','utf8'));assert.equal(manifest.display,'fullscreen');assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
 for(const icon of manifest.icons)assert.ok(fs.existsSync('public'+icon.src),icon.src);assert.ok(fs.existsSync('public/icons/apple-touch-icon.png'));
 console.log('Passed: full-screen toggle, hidden browser UI and orientation, F shortcut guards, remembered auto full screen, installed and iPhone fallbacks, install tags, manifest and icons.');
})().catch(e=>{console.error(e);process.exitCode=1;});
