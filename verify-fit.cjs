const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// The game fills the whole phone screen and keeps its controls clear of the notch, the rounded corners and the home
// indicator (2026-10-11, the host: "double check that the game fits properly on all phones and is able to fill the full
// screen"). What can be read from the files: the page's viewport and Home Screen tags, the safe-area insets in
// webLayout.js (given to the screens' frames as transparent borders, so backgrounds still reach the edges), the bars
// that reach into the insets, the web manifest, the browser bars' colour per theme, the share gateway's invite page and
// the iPhone full-screen help. Measured in a browser at twelve phone sizes by C:/Users/itsbr/qb-work/tools/t-fit-check.cjs.
const read=file=>fs.readFileSync(file,'utf8');
const html=read('public/index.html'),layout=read('webLayout.js'),app=read('App.js');
// ---- The page ----
const viewport=html.match(/<meta name="viewport" content="([^"]+)"/)?.[1]??'';
for(const part of ['width=device-width','initial-scale=1','viewport-fit=cover'])assert.ok(viewport.includes(part),'the viewport says '+part);
assert.ok(!/user-scalable\s*=\s*no|maximum-scale/.test(viewport+layout),'players may still zoom');
assert.ok(layout.includes("'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content'"),'the game keeps viewport-fit=cover when it sets the keyboard behaviour');
for(const [name,content] of [['theme-color','#08060a'],['mobile-web-app-capable','yes'],['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','black-translucent'],['apple-mobile-web-app-title','Questbound']])
 assert.ok(html.includes(`<meta name="${name}" content="${content}" />`),'index.html carries '+name);
assert.ok(/html, body \{ height: 100%; margin: 0; background: var\(--b0, #08060a\); \}/.test(html),'the page under the game is the game\'s own ink, never white');
// ---- Safe areas ----
for(const side of ['top','right','bottom','left'])assert.ok(layout.includes('--sa-'+side[0]+':env(safe-area-inset-'+side+',0px)'),'webLayout reads the '+side+' inset');
assert.ok(layout.includes("html.qb-keyboard{--sa-b:0px;}"),'with a keyboard up the bottom inset is dropped');
const rootRule=layout.match(/'#root\{([^}]*)\}'/)?.[1]??'';
assert.ok(rootRule&&!/padding/.test(rootRule)&&rootRule.includes('height:var(--questbound-height,100dvh)'),'#root fills the visible screen with no padding, so the painting reaches every edge');
assert.ok(layout.includes("'[data-safe=pad],[data-qb=scrim]{box-sizing:border-box;border-style:solid !important;border-color:transparent !important;border-width:var(--sa-t) var(--sa-r) var(--sa-b) var(--sa-l) !important;}'"),'frames and dialog shades keep their content inside the insets');
assert.ok(layout.includes("'[data-qb=scrim]>[data-qb=sheet]{max-height:100% !important;}'"),'a dialog is never taller than its shade leaves room for');
for(const bar of ['hud','tabbar'])assert.ok(new RegExp("html \\[data-qb="+bar+"\\]\\{margin-[a-z]+:calc\\(-1 \\* var\\(--sa-").test(layout)&&layout.includes('background-origin:border-box !important;}'),'the '+bar+' reaches into the inset beside it');
assert.ok(layout.includes("'[data-safe=top]{margin-top:var(--sa-t);}'"),'floating cards start below the notch');
assert.equal((app.match(/<View dataSet=\{\{safe:'pad'\}\} style=\{s\.shell\}>/g)??[]).length,2,'the play screen and the menus are framed inside the insets');
assert.ok(read('LaunchScreen.js').includes("dataSet={{safe:'pad'}}"),'the launch card keeps its words inside the insets');
assert.equal((read('CinematicLayer.js').match(/safe:'top'/g)??[]).length,2,'deed and experience cards start below the notch');
assert.ok(read('StoryLoading.js').includes("dataSet={{qb:'scrim'}}"),'the story cover is a shade, so it is framed too');
// ---- Home Screen install ----
const manifest=JSON.parse(read('public/manifest.json'));
assert.equal(manifest.display,'fullscreen');assert.deepEqual(manifest.display_override,['fullscreen','standalone']);
assert.equal(manifest.orientation,'any','phones may be held either way');
assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');
assert.equal(manifest.background_color,'#08060a');assert.equal(manifest.theme_color,'#08060a');
const fullscreen=read('fullscreen.js');
assert.ok(fullscreen.includes("if(!d.querySelector('meta[name=\"'+name+'\"]'))add('meta',{name,content});"),'fullscreen.js adds the Home Screen tags only when the page lacks them');
// ---- The browser's bars take the page's colour in every theme ----
const ctx={};vm.createContext(ctx);
vm.runInContext(read('themeRules.js').replace(/^export (const|function)/gm,'$1')+'\n;this.out={pageBackground,themeIds};',ctx);
const {pageBackground,themeIds}=ctx.out;
assert.equal(pageBackground('red','dark'),'#08060a');
for(const id of themeIds){for(const mode of ['dark','light']){const c=pageBackground(id,mode);assert.match(c,/^#[0-9a-f]{6}$/i);const v=parseInt(c.slice(1,3),16)+parseInt(c.slice(3,5),16)+parseInt(c.slice(5,7),16);assert.ok(mode==='dark'?v<90:v>600,id+' '+mode+' bar '+c);}}
assert.ok(read('theme.js').includes("bar.setAttribute('content',pageBackground(current,mode));"),'theme.js sets theme-color when the theme or mode changes');
// ---- The share gateway's invite page ----
const phone=read('phone-server.cjs'),pairing=phone.split('\n').find(line=>line.startsWith('const pairingPage='))??'';
assert.ok(pairing.includes('viewport-fit=cover')&&pairing.includes('<meta name="theme-color" content="#08060a">'),'the invite page fills the screen');
assert.ok(pairing.includes('padding:max(16px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))'),'the invite page keeps clear of the insets');
assert.ok(pairing.includes("font:900 clamp(24px,8.6vw,34px)/1.2 'Cinzel Decorative'")&&pairing.includes('overflow-x:hidden'),'the invite page\'s name fits a 320-pixel phone');
assert.ok(pairing.includes('@media (max-height:500px){.seal{width:96px;height:96px'),'a phone held sideways gets a smaller seal');
// ---- iPhone: the Home Screen is the way to full screen ----
const display=read('DisplayControls.js');
assert.ok(display.includes('export function HomeScreenHelp')&&display.includes('Add to Home Screen')&&display.includes('It keeps its own saves, apart from Safari’s')&&display.includes('Move your hero'),'the iPhone help says how, and that saves do not carry over by themselves');
assert.ok(/<ScrollView style=\{\{flexShrink:1\}\} contentContainerStyle=\{s\.sheetBody\}>/.test(display),'the iPhone help scrolls on a phone held sideways');
assert.ok(read('GameHud.js').includes("{!display.supported&&display.ios&&!display.installed&&cell('expand','Full screen',()=>setIphoneHelp(true))}"),'the pause menu offers it on an iPhone');
// ---- Nothing in the builder or hero cards is wider than a 320-pixel phone ----
assert.ok(read('CharacterBuilder.js').includes('option:{flexGrow:1,flexShrink:1,minWidth:0,flexBasis:300,'),'builder choices shrink to a narrow phone');
assert.ok(read('QuickHeroes.js').includes('card:{flexGrow:1,flexShrink:1,minWidth:0,flexBasis:260,'),'hero cards shrink to a narrow phone');
assert.ok(read('Inventory.js').includes('slot:{flexGrow:1,flexShrink:1,flexBasis:260,minWidth:0,'),'equipment slots shrink to the side column of a phone held sideways');
assert.ok(read('CharacterBuilder.js').includes('progressHit:{flex:1,paddingVertical:12}'),'the builder\'s step track is tall enough to tap');
// ---- The map: city, whole land and all lands (2026-10-23) ----
// Measured in headless Chrome at 320x568, 375x812, 812x375, 768x1024 and 1400x860 by C:/Users/itsbr/qb-work/notes/map/map-ui.cjs.
{const map=read('AdventureMap.js');
 assert.ok(/viewRow:{flexDirection:'row',flexWrap:'wrap'/.test(map)&&/viewTab:{[^}]*minHeight:36/.test(map),'the map views wrap on a narrow phone and are 36 pixels tall to tap');
 assert.ok(/roseCell:{width:38,height:36/.test(map)&&/tool:{width:38,height:38/.test(map),'the compass of ways out and the zoom buttons are big enough to tap');
 assert.ok(map.includes("dataSet={{qb:'map-tool',tip:label}}"),'the zoom buttons say what they do on hover');
 assert.ok(map.includes('zoomed=W>w+1||H>h+1,vw=zoomed?w-48:w')&&map.includes('{zoomed&&<View style={s.gutter}/>}')&&map.includes('keepOut:zoom===0?[cornerOf(W,H)]:[]'),'zoomed, the zoom buttons sit in a strip of their own; at full view no place sits under them');
 assert.ok(map.includes('for(const k of [1,1.2,1.4,1.6,1.8,2]){const H=Math.round(base*k);if(named(w,H,true))return {h:H,start:0};}'),'a city sheet grows taller (the page scrolls) until every district is named, before it opens zoomed');
 assert.ok(map.includes('const base=landsSheetScale(count,w,h)'),'with many lands the all-lands sheet is larger than its frame and scrolls inside it');
 assert.ok(map.includes('const rows=(views.length>1&&!shortWin?44:0)')&&map.includes('-rows,Math.round(bigW*.8))'),'the full map leaves room for the views and the row of lands');
 assert.ok(map.includes('{shortWin&&viewTabs(true)}'),'on a short screen the views sit beside the full map’s heading');
 assert.ok(!/position:'fixed'/.test(map),'nothing on the map is fixed to the window');}
console.log('Fit: the page fills the screen (viewport-fit=cover, Home Screen tags, manifest), insets kept clear by every frame and dialog, bars reach the edges, theme-coloured browser bars, the invite page fits 320 px, iPhone help, and the map’s views fit a phone.');
