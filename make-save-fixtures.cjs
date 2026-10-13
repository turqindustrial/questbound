// Makes save-fixtures/*.json: saves written by the game as it was at each build that reached testers, from the
// first playtest (235726f, 30 September 2026) on. For every build it takes that commit's own files out of git, loads
// its rules the way its own checks did, and makes heroes, adventures, a set-aside roster entry, a save code and (once
// parties existed) a shared table, the way its App did: makeCharacter or a ready-made hero, newAdventure,
// freshStoryGame with that build's own test story, a few turns through adventureStep, adventureSnapshot. Each save is
// checked by that build's own validators before it is kept. verify-saves.cjs then proves that today's game loads,
// upgrades and plays every one of them (SAVES.md). Run by hand (node make-save-fixtures.cjs [commit ...]) only to add
// a build; the fixtures are committed, so the check never needs git.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),{execFileSync}=require('node:child_process');
const builds=[
 {commit:'235726f',note:'the first playtest build'},
 {commit:'831ade2',note:'ready-made heroes'},
 {commit:'ef72ef4',note:'gold and the pack, people anywhere, mixed fights, the roster'},
 {commit:'3748253',note:'bonus actions and rests'},
 {commit:'ae8f0c3',note:'lands, the story log, inventory'},
 {commit:'b1fcc0f',note:'tales in chapters'},
 {commit:'f179e3c',note:'deeds'},
 {commit:'ab03d04',note:'parties at the shared table, fights in turns'},
 {commit:'1417fa7',note:'weapon mastery, grapple and shove'},
 {commit:'94efc54',note:'experience points, subclasses, classed companions'},
 {commit:'708fb56',note:'the account and campaign security update'},
 {commit:'84d8dd1',note:'Sleep, undead immunities, Heat Metal, Divine Smite'},
 {commit:'66f4477',note:'final death, introductions, lands beyond the map'},
 {commit:'e13602b',note:'High and Wood Elves, the shield put away, lands never forgotten'},
 {commit:'5cb7363',note:'the Dungeon Master remembers every adventure'},
];
const git=(...args)=>execFileSync('git',args,{cwd:__dirname,encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','ignore']});
const show=(commit,file)=>{try{return git('show',commit+':'+file);}catch{return null;}};
// The rules files a build's own checks loaded: its rules engine's list, else the longest list in its checks.
function filesOf(commit){
 const engine=show(commit,'rules-engine.cjs'),from=text=>{const m=text&&text.match(/const files=(\[[^\]]*\])/);return m?JSON.parse(m[1].replace(/'/g,'"')):null;};
 if(from(engine))return from(engine);
 let best=[];for(const f of git('ls-tree','--name-only',commit).split('\n').filter(f=>/^verify-.*\.cjs$/.test(f))){
  for(const m of (show(commit,f)??'').matchAll(/\[('[A-Za-z]+\.js'(?:\s*,\s*'[A-Za-z]+\.(?:js|json)')+)\]/g)){const l=m[1].match(/'[^']+'/g).map(s=>s.slice(1,-1));if(l.includes('adventureStorage.js')&&l.length>best.length)best=l;}
 }
 return best;
}
function rulesAt(commit,extra){
 const files=[...filesOf(commit)];for(const f of extra)if(show(commit,f)!==null&&!files.includes(f))files.push(f);
 const strip=f=>show(commit,f).replace(/\r\n/g,'\n').replace(/^\s*import .*;\n/gm,'').replace(/export /g,'');
 const store=new Map(),AsyncStorage={getItem:async k=>store.get(k)??null,setItem:async(k,v)=>{store.set(k,v);},removeItem:async k=>{store.delete(k);}};
 const source='const catalog='+show(commit,'spellCatalog.json')+';const progression='+show(commit,'spellProgression.json')+';\n'+files.map(strip).join('\n');
 const names=['subclassOptions','readyHeroes','readyHero','blankBuild','makeCharacter','isValidCharacter','newAdventure','freshStoryGame','hostileEncounterGame','hostileFoes','adventureStep','quickActions','adventureSnapshot','validAdventure','startParty','joinParty','partyView','settleParty','setAside','validRoster','exportSave','readSave','carriedBase','settleTurn','withStoryLog','withDeeds'];
 return {r:vm.runInNewContext(source+'\n;({'+names.map(n=>n+':typeof '+n+'==="undefined"?undefined:'+n).join(',')+'})',{AsyncStorage,console,TextEncoder,TextDecoder,btoa,atob,Blob:globalThis.Blob,Response:globalThis.Response},{timeout:10000}),store,files};
}
// The build's own test story (verify-new-story.cjs), as its story writer would have returned one.
function storyAt(commit){
 const text=(show(commit,'verify-new-story.cjs')??'').replace(/\r\n/g,'\n'),m=text.match(/^const story=(\{.*\});$/m);
 return m?vm.runInNewContext('('+m[1]+')'):null;
}
// A small seeded generator, so a build's fixtures come out the same every time.
const seeded=seed=>()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const heroForms={fighter:{name:'Brenna Ash',species:'Human',class:'Fighter',background:'Soldier',plusTwo:'Strength',plusOne:'Constitution',fighterKit:'melee'}};
function heroesAt(r,commit){
 const list=[];
 const ready=key=>{try{return r.readyHero?.(key)??null;}catch{return null;}};
 for(const key of ['fighter','wizard']){const h=ready(key);if(h)list.push({label:'ready-'+key,hero:h});}
 const build=(label,form)=>{try{list.push({label,hero:r.makeCharacter({...r.blankBuild(),...form})});}catch(e){console.log('  ('+commit+' '+label+': '+e.message+')');}};
 if(!list.length)build('built-fighter',heroForms.fighter);
 // The species and paths that have since been renamed or split: a Dark Elf, a plain Elf, a Monk on the old path.
 const wizard=(r.readyHeroes??[]).find(h=>h.key==='wizard')?.form;
 build('dark-elf-fighter',{...heroForms.fighter,name:'Vey Nightmere',species:'Dark Elf'});
 build('elf-fighter',{...heroForms.fighter,name:'Lirien Vale',species:'Elf'});
 if(wizard)build('elf-wizard',{...wizard,name:'Aelith Morrow',species:'Elf',level:1,advancements:[],spellSelectionVersion:2});
 if(r.subclassOptions?.Monk?.['Warrior of the Hidden Step'])build('monk-hidden-step',{name:'Ren Quill',species:'Human',class:'Monk',background:'Hermit',plusTwo:'Wisdom',plusOne:'Constitution',plannedSubclass:'Warrior of the Hidden Step'});
 return list;
}
// A few turns the way a player taps chips: in a fight the first attack; elsewhere a journey somewhere not yet seen,
// then a rest or anything else on offer, and a journey back last.
function play(r,hero,game,health,turns,random){
 for(let i=0;i<turns;i++){
  let chips=[];try{chips=r.quickActions(hero,game,health)??[];}catch{try{chips=r.quickActions(hero,game)??[];}catch{}}
  const seen=new Set([...(game.map?.visited??[]),...(game.world?.visited??[])]),fresh=c=>c.destination&&!seen.has(c.destination);
  const order=[...chips.filter(c=>/^attack:/.test(c.key??'')),...chips.filter(fresh),...chips.filter(c=>/rest|explore|search|loot|discover/.test(c.key??'')),...chips.filter(c=>!c.destination),...chips];
  let moved=false;
  for(const chip of order){if(!chip?.action)continue;let s;try{s=r.adventureStep(game,health,hero,chip.action,random);}catch{continue;}
   if(s&&!s.error&&s.game){game=s.game;health=s.health===undefined?health:s.health;moved=true;break;}}
  if(!moved||['dead','dying'].includes(game.stage))break;
 }
 return {game,health};
}
function fixturesAt({commit,note}){
 const {r,store}=rulesAt(commit,['characterStorage.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','partyRules.js','sequelRules.js','rosterRules.js','saveCodes.js']),date=git('show','-s','--format=%ad','--date=short',commit).trim();
 const story=storyAt(commit),saves=[],random=seeded(parseInt(commit,16)%100000);
 const keep=(label,hero,game,health,chosen=true)=>{const adventure=r.adventureSnapshot(hero,game,health,chosen);
  if(!r.isValidCharacter(hero)||!r.validAdventure(adventure,hero)){console.log('  ('+commit+' '+label+': not a save that build would keep)');return null;}
  const save={label,character:JSON.stringify(hero),adventure};saves.push(save);return save;};
 const heroes=heroesAt(r,commit);heroesAt.first=heroes[0]?.label;
 for(const {label,hero} of heroes){
  if(label===heroesAt.first)keep(label+'-new',hero,r.newAdventure(hero),null,false);
  if(story){let g;try{g=r.freshStoryGame(hero,story,r.newAdventure(hero));}catch(e){console.log('  ('+commit+' story: '+e.message+')');}
   if(g){const p=play(r,hero,g,null,10,random);keep(label+'-story',hero,p.game,p.health);}}
  if(r.hostileEncounterGame){const g=r.hostileEncounterGame(hero,r.newAdventure(hero),random),p=play(r,hero,g,null,1,random);keep(label+'-fight',hero,p.game,p.health);}
 }
 const first=saves.find(s=>s.label.endsWith('-story'))??saves[0],other=saves.find(s=>s!==first&&s.label.endsWith('-story')&&s.character!==first.character);
 const out={commit,date,note,files:filesOf(commit).length,saves};
 // A hero set aside in the roster (rosterRules.js), as the Heroes screen kept it.
 if(r.setAside&&first){const hero=JSON.parse(first.character),a=first.adventure;try{const next=r.setAside([],[],hero,a.game,a.health,a.chosen);if(!next.error)out.roster=next.roster;}catch(e){console.log('  ('+commit+' roster: '+e.message+')');}}
 // A save code (saveCodes.js, Settings → Move your hero), made from that build's storage keys, uncompressed.
 if(r.exportSave&&first){const storage={getItem:k=>({'questbound.character.v1':first.character,'questbound.adventure.v1':JSON.stringify(first.adventure)})[k]??null};
  try{out.saveCode=r.exportSave(storage,false);}catch(e){console.log('  ('+commit+' code: '+e.message+')');}}
 // A shared table with a party (partyRules.js): the host's snapshot, then a second hero joining.
 if(r.startParty&&r.joinParty&&first&&other){try{let party=r.startParty(first.adventure,'A','Brenna');party=r.joinParty(party,'B',{character:other.character,game:other.adventure.game,health:other.adventure.health,name:'Vey'});out.party=party.snapshot??party;}catch(e){console.log('  ('+commit+' party: '+e.message+')');}}
 return out;
}
(async()=>{
 const only=process.argv.slice(2),dir=path.join(__dirname,'save-fixtures');fs.mkdirSync(dir,{recursive:true});
 for(const build of builds.filter(b=>!only.length||only.includes(b.commit))){
  const out=fixturesAt(build);if(out.saveCode&&typeof out.saveCode.then==='function')out.saveCode=await out.saveCode;
  const file=path.join(dir,out.date+'-'+build.commit+'.json');fs.writeFileSync(file,JSON.stringify(out)+'\n');
  console.log(build.commit+' '+out.date+': '+out.saves.length+' saves'+(out.roster?', a roster entry':'')+(out.saveCode?', a save code':'')+(out.party?', a party table':'')+' ('+(fs.statSync(file).size/1024).toFixed(0)+' kB)');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
