const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// The presentation pieces the host asked for on 2026-10-04: loading tips and the first-time primer that keep rolling
// (loadingRules.js, StoryLoading.js); nothing in the game scrolls sideways at any width (WrapRow and chipLayout in
// ui.js and fitRules.js); the valley painting back on the title screen; and the serpent biting its tail in place of
// the turning bezel (serpent.js, webTheme.js, the launch card, the story seal, the boot card and the app icon).
const load=(file,names)=>{const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8').replace(/^export (const|function)/gm,'$1')+'\n;this.out={'+names.join(',')+'};',ctx);return ctx.out;};
const read=file=>fs.readFileSync(file,'utf8');

// 1. Loading screens roll round and round.
const {tipMs,primerMs,primerResumeMs,cyclePage,autoTurnDue}=load('loadingRules.js',['tipMs','primerMs','primerResumeMs','cyclePage','autoTurnDue']);
assert.equal(cyclePage(5,1,6),0,'after the last page comes the first');
assert.equal(cyclePage(0,-1,6),5,'before the first page comes the last');
assert.equal(cyclePage(2,1,6),3);assert.equal(cyclePage(3,-3,6),0);assert.equal(cyclePage(1,13,6),2);assert.equal(cyclePage(0,1,0),0);
assert.equal(autoTurnDue(1000,2000),false,'a page turned by hand holds');assert.equal(autoTurnDue(2000,2000),true);assert.equal(autoTurnDue(5,0),true);
assert.ok(tipMs>=4000&&tipMs<=8000&&primerMs>=8000&&primerResumeMs>primerMs);
// A whole primer of auto-turns, a hand turn and the pause after it: the pages keep coming round for a three-minute tale.
{let page=0,pausedUntil=0;const seen=[];for(let now=primerMs;now<=180000;now+=primerMs){if(now===primerMs*3){pausedUntil=now+primerResumeMs;page=cyclePage(page,-1,6);}else if(autoTurnDue(now,pausedUntil))page=cyclePage(page,1,6);seen.push(page);}
 assert.ok(seen.filter(p=>p===0).length>=2,'the primer comes back to its first page during a long wait');assert.ok(seen.slice(-3).some((p,i,a)=>i>0&&p!==a[i-1]),'and is still turning at the end');}
const loading=read('StoryLoading.js');
assert.ok(!loading.includes('Math.min(primer.length-1')&&!loading.includes('disabled={page==='),'the primer neither stops on its last page nor disables Back and Next');
assert.ok(loading.includes('cyclePage(p,1,primer.length)')&&loading.includes('cyclePage(p,by,primer.length)')&&loading.includes('primerResumeMs')&&loading.includes('autoTurnDue(Date.now(),pausedUntil.current)'));
assert.ok(loading.includes('setTip(t=>(t+1)%tips.length),tipMs)'),'the tips still loop');
assert.ok(!/accessibilityViewIsModal accessibilityLiveRegion/.test(loading)&&loading.includes('<Text accessibilityLiveRegion="polite" dataSet={{qb:\'title\''),'only the title is announced, not every rolled tip');
assert.ok(loading.includes("dataSet={{qb:'enter'}} style={s.tip}")&&loading.includes('How to play, while you wait · {page+1} of {primer.length}'),'the same layout as before');

// 2. Nothing scrolls sideways.
const sources=fs.readdirSync('.').filter(f=>/\.js$/.test(f)&&!/^(verify|qa-)/.test(f));
const sideways=[];
for(const file of sources){const text=read(file);
 // Any `horizontal` prop at all (a ScrollView, FlatList or SectionList that scrolls sideways), wherever it sits.
 if(/(?<![A-Za-z])horizontal(?![A-Za-z])/.test(text.replace(/^\s*\/\/.*$/gm,'')))sideways.push(file+': a horizontal list');
 if(/overflowX\s*:\s*'(auto|scroll)'/.test(text))sideways.push(file+': overflowX');
 if(/overflow-x\s*:\s*(auto|scroll)/.test(text))sideways.push(file+': overflow-x');
 if(/\bscrollLeft\b/.test(text))sideways.push(file+': scrollLeft');}
for(const file of ['public/index.html','public/fonts/fonts-v2.css'].filter(f=>fs.existsSync(f)))if(/overflow-x\s*:\s*(auto|scroll)/.test(read(file)))sideways.push(file+': overflow-x');
assert.deepEqual(sideways,[],'something scrolls sideways');
const web=read('webTheme.js');assert.ok(!web.includes('actions-scroll'),'no swipe-for-more fade');
assert.ok(!read('webLayout.js').includes("addEventListener('wheel'"),'no wheel-to-sideways handler');
const ui=read('ui.js'),dm=read('DungeonMaster.js'),map=read('AdventureMap.js'),party=read('PartyPanel.js');
assert.ok(ui.includes('export function WrapRow(')&&ui.includes('wrapLimit(rows,rowHeight,gap)')&&ui.includes("accessibilityLabel={open?'Show fewer':'Show all'}")&&ui.includes('useEffect(()=>{setOpen(false);},[resetKey]);'));
assert.ok(/wrapCell:\{maxWidth:'100%'/.test(ui),'a chip wider than the row is cut to it');
assert.ok(dm.includes('<WrapRow key={key} rows={rows} openRows={openRows} rowHeight={chipH}')&&!dm.includes('ScrollView')&&!dm.includes('actionScroll'),'the action rows wrap');
assert.ok(dm.includes("resetKey={lastTurnId+':'+spellsOpen+':'+attackOpen}"),'More folds away on a new turn or picker');
assert.ok(/actionTight:\{[^}]*maxWidth:'100%'/.test(dm),'a long story chip takes a row at most on a phone');
assert.ok(map.includes('<WrapRow rows={1} rowHeight={34}')&&/regionTab:\{[^}]*height:34/.test(map),'the row of lands is one line with More');
assert.ok(party.includes('<WrapRow rows={2} rowHeight={48}')&&!party.includes('ScrollView'),'the party cards wrap');
const seg=ui.slice(ui.indexOf('export function Segmented'),ui.indexOf('export function',ui.indexOf('export function Segmented')+10));
assert.ok(!seg.includes("flexWrap:'nowrap'")&&seg.includes('numberOfLines={narrow?2:1}')&&seg.includes('pairs&&s.segPair'),'Segmented wraps instead of cutting labels');
// How many rows of chips each kind of screen has.
const {chipLayout,wrapLimit,wrapOverflows}=load('fitRules.js',['chipLayout','wrapLimit','wrapOverflows']);
const rows=(w,h,o)=>chipLayout(w,h,o).rows;
assert.equal(rows(1400,860),3);assert.equal(rows(1366,680),2);assert.equal(rows(375,812),2);assert.equal(rows(320,568),2);assert.equal(rows(812,375),1);
assert.equal(rows(1400,860,{picker:true}),3);assert.equal(rows(375,812,{picker:true}),3);assert.equal(rows(812,375,{picker:true}),2);
assert.equal(chipLayout(375,812).rowHeight,36);assert.equal(chipLayout(1400,860).rowHeight,40);assert.equal(chipLayout(812,375).rowHeight,36);
assert.equal(chipLayout(320,568).openRows,3);assert.equal(rows(320,568,{picker:true}),2);assert.equal(chipLayout(375,667).openRows,4);assert.equal(chipLayout(375,812).openRows,6);assert.equal(chipLayout(1400,960).openRows,8);assert.equal(chipLayout(812,375).openRows,3);
assert.ok(ui.includes("over&&open&&openLimit>0&&wrapOverflows(natural,openLimit)&&{maxHeight:openLimit,overflowY:'auto'}"),'an opened row grows only so far, then scrolls up and down');
assert.equal(wrapLimit(2,36,6),78);assert.equal(wrapLimit(1,34,6),34);assert.equal(wrapOverflows(78,78),false);assert.equal(wrapOverflows(120,78),true);

// 3. The title: the valley painting, simply framed.
const app=read('App.js'),home=read('HomeScreen.js');
assert.ok(app.includes("const titlePainting=require('./assets/title/questbound-title.jpg');")&&app.includes("dataSet={{qb:'backdrop',frame:homeShape.wide?'wide':'tall'}}"));
assert.ok(fs.existsSync('assets/title/questbound-title.jpg')&&fs.statSync('assets/title/questbound-title.jpg').size===190839,'the valley painting from b1fcc0f');
for(const gone of ['questbound-title-wide.jpg','questbound-title-tall.jpg'])assert.ok(!fs.existsSync(path.join('assets/title',gone)),gone+' is deleted');
const named=[];
const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','dist','dist-phone','dist-phone-next','project-memory','.expo'].includes(entry.name)||entry.name.startsWith('.questbound'))continue;const file=path.join(dir,entry.name);
 if(entry.isDirectory()){if(dir==='.'||dir.startsWith('assets')||dir.startsWith('public'))walk(file);}
 else if(/\.(js|cjs|html|md|json|css)$/.test(entry.name)&&entry.name!=='verify-presentation.cjs'&&entry.name!=='AGENTS.md'&&/questbound-title-(wide|tall)/.test(read(file)))named.push(file);}};
walk('.');
assert.deepEqual(named,[],'files still name the retired paintings');
assert.ok(!home.includes('titleArt')&&!home.includes('menuBase')&&!app.includes('titleArt')&&!app.includes('--qb-title-')&&!web.includes('qb-title-')&&!web.includes('data-frame=band'));
assert.ok(web.includes('[data-qb=backdrop]>div{background-position:50% 42% !important;}')&&web.includes('[data-qb=backdrop][data-frame=tall]>div{background-position:62% 50% !important;}'));
assert.ok(web.includes('@keyframes qb-drift{from{transform:scale(1) translate3d(0,0,0);}to{transform:scale(1.05)'),'the painting stays zoomed out');
assert.ok(home.includes('{!short&&slot}')&&home.includes('sub={!wide&&!short&&stats?.available?null:'),'an upright phone shows the hero strip above the menu');
assert.ok(home.includes("onLegal?.(tab)")&&home.includes('Keep your progress safe: create an account')&&home.includes('menuGrid')&&home.includes('landLeft'),'everything added to the title screen since is kept');
assert.ok(app.includes('unprotected={saved&&!account}'));

// 4. The serpent.
const {serpentMarkup}=load('serpent.js',['serpentMarkup']);
const full=serpentMarkup(),plain=serpentMarkup({detail:false});
assert.ok(full.startsWith('<svg')&&full.includes("fill='#be96ff'")&&(full.match(/<path/g)??[]).length>=4&&full.length<14000,'scales, a head and a violet eye, small enough to inline');
assert.ok(plain.startsWith('<svg')&&plain.length<4000&&!plain.includes("stroke='#5e0d1e' stroke-width='.65'"),'a plain silhouette for masks');
assert.equal(serpentMarkup(),full,'the same drawing every time');
for(const n of [...full.matchAll(/ (?:d|cx|cy)='([^']*)'/g)].flatMap(m=>m[1].match(/-?\d+(\.\d+)?/g)).map(Number))assert.ok(Number.isFinite(n)&&n>-1&&n<=200,'every point inside the picture');
assert.ok(web.includes("import {serpentMarkup} from './serpent';")&&web.includes('[data-qb=serpent]{background:var(--qb-serpent)')&&/\[data-qb=serpent\]\{[^}]*infinite reverse/.test(web),'it turns the way its head faces');
assert.ok(web.includes('html[data-effects=light] [data-qb=serpent]{animation:none !important;}'),'still in the Light atmosphere');
assert.ok(web.includes('@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;'),'still with reduced motion');
assert.ok(!web.includes('bezel'),'the bezel is gone');
for(const file of ['LaunchScreen.js','StoryLoading.js'])assert.ok(read(file).includes("qb:'serpent'")&&!read(file).includes("qb:'bezel'"),file);
const page=read('public/index.html'),mask='url("data:image/svg+xml,'+encodeURIComponent(plain).replace(/'/g,'%27')+'")';
const block=page.match(/\/\* qb-serpent:start \*\/([\s\S]*?)\/\* qb-serpent:end \*\//);
assert.ok(block&&block[1]==='-webkit-mask: '+mask+' center/contain no-repeat; mask: '+mask+' center/contain no-repeat;','the boot card shows the same serpent (node verify-theme.cjs --write)');
assert.ok(page.includes('<div class="serpent"></div>')&&!page.includes('bezel')&&/#qb-boot \.serpent \{[^}]*qb-turn 120s linear infinite reverse/.test(page)&&page.includes('#qb-boot .serpent, #qb-boot .bar i { animation: none; }'));
const icon=read('assets/title/icon.html'),iconBlock=icon.match(/\/\* qb-serpent:start \*\/([\s\S]*?)\/\* qb-serpent:end \*\//);
assert.ok(iconBlock&&iconBlock[1]==='background-image:url("data:image/svg+xml,'+encodeURIComponent(full).replace(/'/g,'%27')+'");','the app icon carries the same serpent (node make-icons.cjs)');
assert.ok(icon.includes('url(questbound-title.jpg)')&&!icon.includes('fonts.googleapis.com')&&icon.includes('../../public/fonts/cinzel-decorative-900-latin.woff2'),'the icon needs neither the retired painting nor Google');
for(const file of ['public/manifest.json','public/index.html','fullscreen.js','phone-server.cjs'])assert.ok(!/\.png\?v=[12]\b/.test(read(file))&&/\.png\?v=3\b/.test(read(file)),file+' asks for the new icons');
console.log('Presentation: tips and primer roll, nothing scrolls sideways in '+sources.length+' files, the valley painting, and the serpent in five places.');
