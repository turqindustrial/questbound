const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// The presentation pieces the host asked for on 2026-10-04: loading tips and the first-time primer that keep rolling
// (loadingRules.js, StoryLoading.js); nothing in the game scrolls sideways at any width (WrapRow and chipLayout in
// ui.js and fitRules.js); the valley painting back on the title screen; and the host's emblem (2026-10-10: a serpent
// biting its tail round a Q whose tail is a dagger) as the logo, animated, in place of the drawn serpent and seal (the
// launch card, the title page, the story seal, the top bar, the boot card, the pairing page and the app icon).
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
assert.ok(dm.includes("resetKey={lastTurnId+':'+spellsOpen+':'+attackOpen+':'+castSpell+':'+shownTab}"),'More folds away on a new turn, picker, slot choice or sub-tab');
// Out of battle (2026-10-11) everything folds into Suggestions above the message box: one switch, then Say, Speak and
// Actions. On a short screen the switch and the sub-tabs sit in the cell before the one row of chips, so it stays one
// row; elsewhere a slim tab row over the chips. Every chip row is a WrapRow (the Say lines wrap in a plain row).
{const calm=dm.slice(dm.indexOf('const calmContent='),dm.indexOf('const actionBar='));
 assert.ok(calm.includes("short?<View style={s.switchRow}><View accessibilityRole=\"tablist\" style={[s.switchCell,s.subTabs]}>{suggestToggle}{panel.open&&!(picker&&shownTab==='actions')&&calmTabs.map(subTab)}</View>"),'on a short screen Suggestions is one row (the sub-tabs step aside for an open picker)');
 assert.ok(calm.includes("row([...peopleChips,...speakQuick.map(actionChip)],chipRows,'speak')")&&calm.includes("row([...actionChips,...effectChips],chipRows,'actions')")&&calm.includes("short?row(ideaChips,chipRows,'say'):ideaRow"),'Speak, Actions and (on a short screen) Say are WrapRows');}
// In battle, a phone on its side (one row of chips; checked headless at 812x375 and 667x375): the Say lines sit in the
// same height-limited row as the actions, so a conversation never pushes the message box off the screen, and the
// Actions/Say tabs become one small switch beside the row, so the first action is on it.
{const bar=dm.slice(dm.indexOf('const shortRow='),dm.indexOf('// One on one or everyone here'));
 assert.ok(/const shortRow=showIdeas\?row\(\[\.\.\.ideaChips,\.\.\.extraChips\],chipRows,'ideas'\):row\(\[\.\.\.actionChips,\.\.\.extraChips\],chipRows,'all'\)/.test(bar),'on a short screen the suggestions are in a WrapRow too');
 assert.ok(bar.includes('<View style={s.switchCell}>{tabSwitch}</View>')&&!/row\(\[\.\.\.tabButtons/.test(dm)&&!/\{tabButtons\}\{ideaChips\}/.test(dm),'the tabs do not take the one row of chips');
 assert.ok(/short&&\{minHeight:0,height:chipH/.test(dm)&&dm.includes('numberOfLines={short?1:2}'),'a suggestion is one chip high on a short screen');}
assert.ok(/actionTight:\{[^}]*maxWidth:'100%'/.test(dm),'a long story chip takes a row at most on a phone');
assert.ok(map.includes('<WrapRow rows={1} openRows={4} rowHeight={34}')&&/regionTab:\{[^}]*height:34/.test(map),'the row of lands is one line with More (opened, four lines that scroll)');
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
assert.ok(app.includes('unprotected={saved&&!account&&accountsOffered()}'),'the account prompt only while accounts are offered');

// 4. The emblem: the host's painting, made into layers by make-emblem.cjs.
const isWebp=file=>{const bytes=fs.readFileSync(file);return bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';};
const layers=['ring-v2','core-v2','ring-glow-v2','core-glow-v2','seal-v1','seal-ring-v1','seal-core-v1'].map(name=>'public/emblem/'+name+'.webp');
for(const file of [...layers,'assets/title/questbound-emblem.webp','assets/title/questbound-seal-source.webp'])assert.ok(fs.existsSync(file)&&isWebp(file)&&fs.statSync(file).size<400000,file+' is a WebP under 400 KB');
for(const name of ['seal-v1','seal-ring-v1','seal-core-v1'])assert.ok(fs.statSync('public/emblem/'+name+'.webp').size<60000,name+': the top bar, boot card and pairing page pictures stay light');
// Under the blade the turning ring holds scales lined up by measurement (mismatch), blended in past the blade's outline.
const maker=read('make-emblem.cjs');assert.ok(maker.includes('questbound-seal-source.webp')&&layers.every(file=>maker.includes(file))&&maker.includes('bladeShare')&&maker.includes('ringShare')&&maker.includes('function mismatch('),'make-emblem.cjs makes every layer from the painting');
assert.ok(!fs.existsSync('serpent.js'),'the drawn serpent is retired');
for(const file of sources)assert.ok(!/qb:'(serpent|launch-ring|bezel)'/.test(read(file))&&!read(file).includes("from './serpent'"),file+' no longer draws the old seal');
const emblem=read('TitleEmblem.js'),launch=read('LaunchScreen.js');
// The ring (with its stars and their twinkles) turns under the Q and its blade, which are drawn after it and stay still.
const order=['emblem-back','emblem-turn','emblem-ring','emblem-core','emblem-sheen'].map(name=>emblem.indexOf("qb:'"+name+"'"));
assert.ok(order.every((at,i)=>at>0&&(i===0||at>order[i-1])),'the layers are drawn back to front: '+order);
assert.ok(/\{ringStars\.map\(twinkle\)\}\r?\n  <\/View>/.test(emblem)&&emblem.includes('{twinkle(northStar)}'),'the ring stars twinkle as they turn, the Q\'s north star where it stands');
assert.ok(emblem.includes('const box=Math.round(size*1.42),'),'the same square as the old seal and its serpent');
assert.ok(launch.includes('<TitleEmblem size={ring} place="launch"/>')&&!/\bq=Math.round/.test(launch),'the launch card shows the emblem');
assert.ok(loading.includes('<TitleEmblem size={106} place="story"/>'),'the story seal is the emblem');
assert.equal((home.match(/<TitleEmblem size=/g)??[]).length,3,'the title page shows it on desktop, a phone held either way');
assert.ok(app.includes('<EmblemMark size={42}/>')&&!app.includes('emblemQ'),'the top bar\'s mark is the emblem');
// The ring goes all the way round, steadily (2026-10-10, the host: "make sure the ouroboros animation goes all the way
// around the circle"): once in 36 s, from exactly 0 to 360 degrees so the wrap cannot be seen, and on the page's one
// clock (a negative delay) so a change of screen never turns it back. The boot card and the pairing page turn it alike.
assert.ok(web.includes('[data-qb=emblem-turn]{animation:qb-emblem-turn 36s linear infinite;')&&web.includes('@keyframes qb-emblem-turn{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}')&&!/\[data-qb=emblem-core\]\{[^}]*animation/.test(web),'the ring turns once in 36 seconds the way the head faces; the Q stays still');
assert.ok(emblem.includes('export const emblemTurn=36;')&&emblem.includes("turn.current.style.animationDelay=Math.round(emblemPhase())+'ms'")&&emblem.includes("<View ref={turn} dataSet={{qb:'emblem-turn'}}"),'each emblem joins the page clock');
{const phase=eval('('+emblem.match(/export const emblemPhase=([^;]+);/)[1].replace('emblemTurn','36')+')');assert.equal(phase(0),-0);assert.equal(phase(40000),-4000);assert.equal(phase(36000*3+500),-500);}
assert.ok(web.includes('-webkit-mask:url(/emblem/core-v2.webp)')&&web.includes('[data-qb=emblem-shine]{')&&web.includes('@keyframes qb-emblem-twinkle')&&web.includes('@keyframes qb-emblem-glow'),'the sheen is cut to the Q, the stars twinkle, the glow breathes');
assert.ok(web.includes('html[data-effects=light] [data-qb=emblem] *{animation:none !important;}'),'still in the Light atmosphere');
assert.ok(web.includes('html[data-covered=on] [data-qb=emblem]:not([data-place=story]) *{animation-play-state:paused !important;}'),'still behind a full-screen cover');
assert.ok(web.includes('@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;'),'still with reduced motion');
assert.ok(web.includes('[data-qb=emblem]{position:relative;filter:var(--qb-emblem-filter);}')&&web.includes("'--qb-emblem-filter':emblemFilter(theme)"),'tinted for the theme');
// Every emblem picture a page asks for exists, and the servers name its type; the pairing page may show it before pairing.
const page=read('public/index.html'),gateway=read('phone-server.cjs');
for(const text of [web,page,gateway])for(const m of text.matchAll(/\/emblem\/([a-z0-9-]+\.webp)/g))assert.ok(fs.existsSync('public/emblem/'+m[1]),m[1]+' exists');
assert.ok(page.includes('<div class="seal"><div class="emblem"><i class="ring"></i><i class="core"></i></div></div>')&&page.includes('background-image: url(/emblem/seal-ring-v1.webp); animation: qb-turn 36s linear infinite;')&&page.includes('url(/emblem/seal-core-v1.webp)')&&page.includes('@keyframes qb-turn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }')&&!page.includes('qb-serpent')&&page.includes('#qb-boot .emblem, #qb-boot .emblem .ring, #qb-boot .bar i { animation: none; }'),'the boot card shows the emblem, its ring turning');
assert.ok(gateway.includes('<div class="seal" aria-hidden="true"><i class="ring"></i><i class="core"></i></div>')&&gateway.includes('.seal .ring{background-image:url(/emblem/seal-ring-v1.webp);animation:turn 36s linear infinite}')&&gateway.includes('@keyframes turn{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}')&&gateway.includes('/^\\/emblem\\/[a-z0-9-]+\\.webp$/.test(pathname)'),'the pairing page shows the emblem');
for(const file of ['phone-server.cjs','desktop-server.cjs'])assert.ok(read(file).includes("'.webp':'image/webp'"),file+' serves WebP as an image');
const icon=read('assets/title/icon.html');
assert.ok(icon.includes('url(questbound-emblem.webp)')&&!icon.includes('fonts.googleapis.com')&&!icon.includes('qb-serpent'),'the app icon is the emblem and needs no internet');
assert.ok(read('make-icons.cjs').includes("[48,'assets/questbound-favicon.png','inset=.01&simple=1']")&&read('make-icons.cjs').includes("[180,'public/icons/apple-touch-icon.png','inset=.06&simple=1']"),'small icons are cut close to the ring');
for(const file of ['public/manifest.json','public/index.html','fullscreen.js','phone-server.cjs'])assert.ok(!/\.png\?v=[123]\b/.test(read(file))&&/\.png\?v=4\b/.test(read(file)),file+' asks for the new icons');
// The gold icon for the next big update is stored, not deployed (2026-10-10): its whole set and how to switch it in.
{const dir='assets/branding/next-icon/',readme=read(dir+'README.md');
 for(const file of ['apple-touch-icon.png','icon-192.png','icon-512.png','maskable-512.png','questbound-favicon.png','favicon-32.png','questbound-icon.png','android-icon-background.png','android-icon-foreground.png','android-icon-monochrome.png'])assert.ok(fs.existsSync(dir+file)&&readme.includes('`'+file+'`'),dir+file+' is stored and described');
 assert.ok(readme.includes('?v=5')&&read('make-icons.cjs').includes("process.argv.includes('--next')")&&read(dir+'icon.html').includes('url(../../title/questbound-emblem.webp)'),'the stored icon says how to switch it in and is drawn by make-icons.cjs --next');
 for(const file of ['public/manifest.json','public/index.html','fullscreen.js','phone-server.cjs',...sources])assert.ok(!read(file).includes('next-icon'),file+' does not use the stored icon yet');}
// The desktop side column folds to a rail (remembered per device) so a conversation can take the whole width.
{const adv=read('Adventure.js');assert.ok(adv.includes("const sideKey='questbound.side.v1'")&&adv.includes('label="Hide the side panel"')&&adv.includes('label="Show the side panel"')&&adv.includes("qb:'side-rail'")&&/wide&&folded&&/.test(adv)&&/wide&&!folded&&/.test(adv),'the side column can be folded and unfolded on wide screens');}
console.log('Presentation: tips and primer roll, nothing scrolls sideways in '+sources.length+' files, the valley painting, and the emblem in seven places.');
