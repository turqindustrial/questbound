// Drawing and loading the game: the page's endless animations move only what a browser can move cheaply (transform
// and opacity), nothing blends or blurs the whole screen over moving scenery, the Atmosphere setting's Light mode
// and the full-screen covers still the scenery, each typeface is downloaded once, the desktop server caches only
// files that can never change, and the automatic Light mode turns on for a computer that cannot keep up.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');

// 1. The style sheet (webTheme.js) as written.
const web=fs.readFileSync('webTheme.js','utf8');
const start=web.indexOf('const css=tint(`');assert.ok(start>=0,'webTheme.js keeps its style sheet in const css');
const css=web.slice(start,web.indexOf('`)',start));
const keyframes={};
for(const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g))keyframes[m[1]]=m[2];
assert.ok(Object.keys(keyframes).length>20,'keyframes were read from the style sheet');
const endless=new Set();
for(const m of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)){
 if(!/infinite/.test(m[1]))continue;
 for(const part of m[1].split(','))if(/infinite/.test(part))for(const word of part.trim().split(/\s+/))if(keyframes[word])endless.add(word);
}
assert.ok(endless.size>=6,'the endless animations were found ('+[...endless].join(', ')+')');
const cheap=new Set(['transform','opacity']);
for(const name of endless){
 const props=[...keyframes[name].matchAll(/([a-z-]+)\s*:/g)].map(m=>m[1]).filter(p=>p!=='animation-timing-function');
 const costly=props.filter(p=>!cheap.has(p));
 assert.deepEqual(costly,[],'@keyframes '+name+' runs forever and must move only transform or opacity, not '+costly.join(', '));
}
// No endless animation anywhere moves layout or paint-heavy properties.
for(const [name,body] of Object.entries(keyframes))assert.ok(!/(^|[;{\s])(left|top|width|height|letter-spacing)\s*:/.test(body)||!endless.has(name),name+' animates layout');
assert.ok(!keyframes['qb-breathe'],'the title glow no longer shares a name with the loading card\'s qb-breathe');
// Grain and light shafts never blend with the whole screen.
for(const m of css.matchAll(/([^{}]*\[data-qb=(?:grain|rays)\][^{}]*)\{([^{}]*)\}/g))assert.ok(!/mix-blend-mode/.test(m[2]),'no blend mode on '+m[1].trim());
// Light mode stills the scenery and drops the blur behind panels; covers pause the stage.
const light=[...css.matchAll(/([^{}]*data-effects=light[^{}]*)\{([^{}]*)\}/g)];
assert.ok(light.some(([,sel,body])=>/data-qb=grain/.test(sel)&&/display\s*:\s*none|opacity\s*:\s*0/.test(body)),'Light hides the grain');
assert.ok(light.some(([,sel,body])=>/data-qb=glass/.test(sel)&&/backdrop-filter\s*:\s*none/.test(body)),'Light drops the blur behind glass panels');
assert.ok(light.some(([,sel,body])=>/data-qb=fog/.test(sel)&&/animation\s*:\s*none/.test(body)),'Light stills the fog');
assert.ok(/html\[data-covered=on\] \[data-qb=stage\] \*[^{]*\{animation-play-state:paused/.test(css),'a full-screen cover pauses the stage');
assert.ok(/prefers-reduced-motion/.test(css),'reduced motion is still honoured');
// The Light appearance's own style sheet (webTheme.js lightCss) animates nothing and blends nothing.
{const at=web.indexOf('const lightCss=`'),lightCss=web.slice(at,web.indexOf('`;',at));assert.ok(at>0&&!/@keyframes|animation\s*:|mix-blend-mode/.test(lightCss),'the light style sheet adds no animation or blend');}

// 2. Typefaces: one file per family, style and writing system, all present, and the pages point at the new sheet.
const fontsCss=fs.readFileSync('public/fonts/fonts-v2.css','utf8');
const files=[...fontsCss.matchAll(/url\(\/fonts\/([^)]+)\)/g)].map(m=>m[1]);
assert.ok(files.length>=10);
const hashes=new Map();
for(const f of files){const p=path.join('public/fonts',f);assert.ok(fs.existsSync(p),f+' exists');const h=crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');assert.ok(!hashes.has(h),f+' has the same bytes as '+hashes.get(h));hashes.set(h,f);}
assert.equal(new Set(files).size,files.length,'each file is named once');
const page=fs.readFileSync('public/index.html','utf8');
assert.ok(page.includes('href="/fonts/fonts-v2.css"')&&!page.includes('/fonts/fonts.css'),'the page template uses fonts-v2.css');
const preloads=[...page.matchAll(/rel="preload"[^>]*href="\/fonts\/([^"]+)"/g)].map(m=>m[1]);
assert.ok(preloads.length>=2&&preloads.includes('inter-400-latin.woff2'),'the interface face is preloaded');
for(const f of preloads)assert.ok(files.includes(f),'preloaded '+f+' is one the sheet uses');
assert.ok(web.includes("'/fonts/fonts-v2.css'"),'webTheme.js falls back to fonts-v2.css');
assert.ok(fs.readFileSync('phone-server.cjs','utf8').includes('/fonts/fonts-v2.css'),'the pairing page uses fonts-v2.css');
// The old per-weight files stay one release, for stylesheets browsers still hold.
assert.ok(fs.existsSync('public/fonts/fonts.css')&&fs.existsSync('public/fonts/inter-700-latin.woff2'),'the old files are kept one release');

// 3. Atmosphere: Auto, Full or Light, saved per device; old saved display settings load with the defaults.
function display(saved){
 const store={},dataset={};if(saved)store['questbound.display.v1']=JSON.stringify(saved);
 const context={document:{documentElement:{dataset},head:{appendChild(){}},createElement:()=>({setAttribute(){}}),querySelector:()=>null,addEventListener(){}},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},navigator:{userAgent:'Windows',maxTouchPoints:0},matchMedia:()=>({matches:false}),screen:{}};
 context.globalThis=context;
 const api=vm.runInNewContext(fs.readFileSync('fullscreen.js','utf8').replace(/export /g,'')+'\n({initializeFullscreen,displayState,setDisplayPrefs,effectsMode})',context);
 api.initializeFullscreen();return {api,dataset,store};
}
let d=display({autoFullscreen:true});
assert.equal(d.api.displayState().effects,'auto');assert.equal(d.dataset.effects,'full','an old save starts on Auto, which is Full');assert.equal(d.api.displayState().autoFullscreen,true);
d.api.setDisplayPrefs({autoLight:true});assert.equal(d.dataset.effects,'light','Auto turns Light on a slow computer');
d.api.setDisplayPrefs({effects:'full'});assert.equal(d.dataset.effects,'full','Full overrides the automatic choice');
d.api.setDisplayPrefs({effects:'light',autoLight:false});assert.equal(d.dataset.effects,'light');
assert.equal(display({effects:'nonsense'}).api.displayState().effects,'auto','an unknown mode falls back to Auto');

// 4. perfWatch.js: frames sampled after the launch tap decide Auto's choice; covers pause the stage by name.
function watch(effects,gap){
 const prefs={effects,autoLight:false},changes=[];
 const context={performance:{now:()=>clock,getEntriesByType:()=>[{domContentLoadedEventEnd:812.4,loadEventEnd:1490.2}]},PerformanceObserver:undefined};
 context.globalThis=context;let clock=0;
 const src=fs.readFileSync('perfWatch.js','utf8').replace(/^import .*$/m,'').replace(/^export /gm,'');
 const api=vm.runInNewContext(src+'\n({judgeFrames,startPerfWatch,perfHealth,setCovered})',Object.assign(context,{displayState:()=>({...prefs,effectsActive:prefs.effects==='light'||prefs.autoLight?'light':'full'}),setDisplayPrefs:c=>{changes.push(c);Object.assign(prefs,c);},setTimeout}));
 const frames=[];const raf=fn=>frames.push(fn);
 api.startPerfWatch({raf,now:()=>clock,later:fn=>fn(),doc:{hidden:false}});
 for(let i=0;i<1000&&frames.length;i++){const fn=frames.shift();clock+=gap(i);fn(clock);}
 return {api,changes,prefs};
}
let w=watch('auto',i=>i%2?16:50);
assert.equal(JSON.stringify(w.changes),'[{"autoLight":true}]','half the frames slow: Auto turns to Light');
const health=w.api.perfHealth();assert.equal(health.domReadyMs,812);assert.equal(health.loadMs,1490);assert.ok(health.slowFramePct>40&&health.frames>100);assert.equal(health.autoLight,true);
assert.deepEqual(watch('auto',()=>16.7).changes,[],'a smooth computer stays on Full');
assert.deepEqual(watch('full',i=>i%2?16:50).changes,[],'a player who chose Full keeps it');
assert.equal(w.api.judgeFrames([16,16]).light,false,'too few frames decide nothing');
assert.equal(w.api.judgeFrames(Array(60).fill(5000)).frames,0,'gaps of a hidden window are not counted');
const root={dataset:{}};const doc={documentElement:root};
w.api.setCovered('story',true,doc);w.api.setCovered('scene',true,doc);assert.equal(root.dataset.covered,'on');
w.api.setCovered('story',false,doc);assert.equal(root.dataset.covered,'on','another cover is still open');
w.api.setCovered('scene',false,doc);assert.equal(root.dataset.covered,undefined);

// 5. The desktop server: the page and the font sheet are checked again, content-hashed files are kept for good.
const {createDesktopServer}=require('./desktop-server.cjs');
const root2=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-perf-'));
fs.mkdirSync(path.join(root2,'fonts'));fs.mkdirSync(path.join(root2,'_expo','static','js','web'),{recursive:true});
fs.writeFileSync(path.join(root2,'index.html'),'<h1>game</h1>');fs.writeFileSync(path.join(root2,'fonts','fonts-v2.css'),'/* faces */');fs.writeFileSync(path.join(root2,'fonts','inter-400-latin.woff2'),'font');
fs.writeFileSync(path.join(root2,'_expo','static','js','web','index-0123456789abcdef0123456789abcdef.js'),'bundle');fs.writeFileSync(path.join(root2,'favicon.ico'),'icon');
const get=(port,route)=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port,path:route,headers:{Host:'localhost:'+port}},res=>{res.resume();res.on('end',()=>resolve(res.headers['cache-control']));}).on('error',reject));
(async()=>{
 const probe=createDesktopServer({root:root2,port:0});await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;probe.close();
 const server=createDesktopServer({root:root2,port,feedbackFile:null});await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try{
  assert.equal(await get(port,'/'),'no-store');
  assert.equal(await get(port,'/fonts/fonts-v2.css'),'no-cache','the font sheet is checked again');
  assert.equal(await get(port,'/favicon.ico'),'no-cache');
  assert.match(await get(port,'/fonts/inter-400-latin.woff2'),/immutable/);
  assert.match(await get(port,'/_expo/static/js/web/index-0123456789abcdef0123456789abcdef.js'),/immutable/);
 }finally{server.close();fs.rmSync(root2,{recursive:true,force:true});}
 console.log('Performance: endless animations move only transform and opacity ('+endless.size+' of them), no full-screen blending, Light and covers still the scenery, one font file per face ('+files.length+' files, preloads in step), Auto turns Light on a slow computer and Full overrides it, and the desktop server caches only hashed files.');
})().catch(e=>{console.error(e);process.exit(1);});
