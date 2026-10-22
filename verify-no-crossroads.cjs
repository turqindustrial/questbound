// No crossroads, every table a tale, a hero for everyone at a table, and short invites (the host's words, 2026-10-21:
// "I've noticed that original story with 3 locations where the map is an overly basic triangle keeps appearing. get
// rid of that story and make sure it doesn't appear anymore", "any players joining a game should either pick a
// character from their pre made characters or make a new one for the adventure. nobody should be "playing" the multi
// player function without a character to actually take control of" and "make the invite codes for multiplayer much
// shorter and simpler ... 4 characters, a dash, and 4 more characters ... players can type lower case letters").
// Fails if any player path can produce or play a game with no story that is not the Skirmish.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {rulesSource}=require('./rules-files.cjs'),{journeyStory}=require('./journey-fixtures.cjs');
const r=vm.runInNewContext(rulesSource()+'\n({readyHero,newAdventure,freshStoryGame,hostileEncounterGame,hasTale,dmChoices,quickActions,adventureStep,adventureSnapshot,startParty,joinParty,partyView,settleParty,partyInTale,carriedBase,isPartyGame,validAdventure,isValidCharacter,canContinueRegion})',{AsyncStorage:{},console});
const read=f=>fs.readFileSync(f,'utf8');
const tale=(hero,n=0)=>r.freshStoryGame(hero,journeyStory(n),r.newAdventure(hero));
const kara=r.readyHero('fighter'),ilyra=r.readyHero('wizard'),bram=r.readyHero('cleric');

// ---- 1. The rules: a game with no story is "no tale yet", and nothing starts the crossroads tale again ----
assert.equal(r.hasTale(r.newAdventure(kara)),false,'an empty adventure has no tale');
assert.equal(r.hasTale(tale(kara)),true,'a written tale is one');
assert.equal(r.hasTale(r.hostileEncounterGame(kara,r.newAdventure(kara),()=>.5)),true,'and so is the Skirmish');
for(const stage of ['inn','tower','bridge','victory','defeat','escaped']){
 const g={...r.newAdventure(kara),stage,enemyHP:stage==='victory'?0:10};
 assert.ok(!r.dmChoices(kara,g,null).some(c=>c.id==='restart-adventure'),'no "begin another adventure" back into the crossroads at '+stage);
 const after=r.adventureStep(g,null,kara,'restart-adventure',()=>.5);
 assert.ok(after?.error||after?.game?.map?.visited?.length===g.map.visited.length,'the restart move is gone at '+stage);
}
for(const f of fs.readdirSync('.').filter(f=>/\.js$/.test(f)))assert.ok(!/restart-adventure|restartAdventure/.test(read(f)),f+' has no crossroads restart');

// ---- 2. The screens: Continue, Play and every game screen need a tale; nothing rebuilds the crossroads ----
{const strip=f=>read(f).replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'');
 const st=vm.runInNewContext(strip('startTale.js')+'\n({playScreenFor,tableSnapshot})',{hasTale:r.hasTale,isPartyGame:r.isPartyGame,newAdventure:r.newAdventure,carriedBase:r.carriedBase,adventureSnapshot:r.adventureSnapshot,taleStart:()=>({}),fateJourney:()=>null,regionSummary:()=>null,sequelBearings:[],storySoFarForWriter:()=>null,heroSpecies:()=>''});
 const old=r.newAdventure(kara),chosenOld={...old,map:{...old.map,visited:['inn','bridge']}};
 assert.equal(st.playScreenFor({hero:kara,game:chosenOld,characterChosen:true}),'Adventure Opening','an old crossroads save asks for a tale (it is not played)');
 assert.equal(st.playScreenFor({hero:kara,game:old,characterChosen:false}),'Adventure Opening','so does a new hero');
 assert.equal(st.playScreenFor({hero:null,game:old,characterChosen:false}),'Character Selection');
 assert.equal(st.playScreenFor({hero:kara,game:tale(kara),characterChosen:true}),'Adventure','a tale is played');
 assert.equal(st.playScreenFor({hero:kara,game:r.hostileEncounterGame(kara,old,()=>.5),characterChosen:true}),'Adventure','and the Skirmish');
 for(const table of [{joined:true,needsTale:true},{joined:true,needsHero:true},{joined:true}])assert.equal(st.playScreenFor({hero:kara,game:table.needsHero||table.needsTale?tale(kara):old,characterChosen:true,table}),'Multiplayer','at a table without a tale or a hero of one\'s own: the table screen');
 assert.equal(st.playScreenFor({hero:kara,game:tale(kara),characterChosen:true,table:{joined:true}}),'Adventure');
 // What a hero brings to a table: their written tale, else a fresh start (never the crossroads progress, never a fight).
 const written=tale(kara);assert.equal(st.tableSnapshot({hero:kara,game:written,health:null,chosen:true}).game,written);
 for(const game of [chosenOld,r.hostileEncounterGame(kara,old,()=>.5)]){const s=st.tableSnapshot({hero:kara,game,health:null,chosen:true});assert.ok(!r.hasTale(s.game)&&s.game.stage==='inn'&&(s.game.map.visited.length===1),'a fresh start with no tale');assert.ok(r.validAdventure(s,kara));}
 // The App's paths.
 const app=read('App.js'),menus=read('MenuScreens.js'),saves=read('useHeroSaves.js'),home=read('HomeScreen.js'),adventure=read('Adventure.js');
 assert.ok(!/onRestart/.test(app+menus+adventure),'no restart prop rebuilds the crossroads');
 assert.ok(!/newAdventure/.test(menus),'the menus never make an adventure');
 for(const m of app.matchAll(/setGame\(newAdventure\(/g))assert.ok(/setCharacterChosen\(false\)/.test(app.slice(m.index,m.index+260)),'an empty adventure is never the chosen one (App.js at '+m.index+')');
 assert.equal((saves.match(/newAdventure/g)??[]).length,2,'useHeroSaves only starts empty (the import and the first state)');
 assert.ok(/if\(!newStoryRequested&&hasTale\(game\)\)/.test(app),'Play goes to the adventure only with a tale');
 assert.ok(/onContinue=\{\(\)=>\{[^}]*playScreenFor\(/.test(app),'Continue asks for a tale first');
 assert.ok(/const playing=[^;]*playScreenFor\(/.test(app)&&/const gameScreen=[^;]*playScreenFor\(/.test(app),'no game screen shows without a tale');
 assert.ok(/const next=playScreenFor\(\{hero,game,characterChosen,table\}\);if\(next==='Adventure'\)return;/.test(app),'a game screen reached without a tale moves on');
 assert.ok(/saved=\{saved&&taleNow\}/.test(app)&&!/Lantern at the Crossroads/.test(home+app),'the title offers New Adventure, never Continue into the crossroads');
 assert.ok(/forTable\?allIntros\.filter\(i=>!i\.local\)/.test(read('AdventureIntros.js')),'a table is never offered the Skirmish');
}

// ---- 3. A table's tale: the host begins one for everyone, every member seated with their own hero ----
{const host=r.startParty(r.adventureSnapshot(kara,r.newAdventure(kara),null,true),'seat-'+'a'.repeat(16),'Al');
 let table=r.joinParty(host,'seat-'+'b'.repeat(16),{character:JSON.stringify(ilyra),game:{...r.newAdventure(ilyra),potions:3,xp:40},health:null,name:'Bo'}).snapshot;
 table=r.joinParty(table,'seat-'+'c'.repeat(16),{character:JSON.stringify(bram),game:r.newAdventure(bram),health:null,name:'Cy'}).snapshot;
 // Cy's hero has died: he is not seated in the new tale (he brings a new hero to his seat).
 {const v=r.partyView(table,'seat-'+'c'.repeat(16));table={...v,game:{...v.game,stage:'dead',death:{cause:'Fell',place:'The inn'}}};}
 const begun=r.partyInTale(table,'seat-'+'a'.repeat(16),journeyStory(2),'easy');assert.equal(begun.error,undefined,begun.error);
 const g=begun.snapshot.game;assert.ok(r.hasTale(g),'the table has a tale');assert.equal(g.party.lead,'seat-'+'a'.repeat(16));
 assert.deepEqual(Object.keys(g.party.members).sort(),['seat-'+'a'.repeat(16),'seat-'+'b'.repeat(16)],'living heroes seated, the dead one not');
 const bo=r.partyView(begun.snapshot,'seat-'+'b'.repeat(16));assert.equal(bo.game.potions,3,'Bo keeps what he carries');assert.equal(bo.game.xp,40);assert.ok(r.validAdventure(bo,ilyra));
 assert.equal(r.partyInTale(begun.snapshot,'seat-'+'a'.repeat(16),journeyStory(2),'easy').error,'This table has already lived that tale. Choose another.');
 assert.match(r.partyInTale(table,'seat-'+'c'.repeat(16),journeyStory(3),'easy').error,/living hero/);
}

// ---- 4. The campaign server: tales, heroes and invites ----
(async()=>{
 const {createCampaigns,newInvite,inviteForms}=require('./campaigns.cjs'),rules=require('./rules-engine.cjs').rules(),{createOperations}=require('./operations.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qb-no-crossroads-'));let asked=[];
 const operations=createOperations({dir,key:crypto.randomBytes(32)});
 const c=createCampaigns({dir:path.join(dir,'campaigns'),operations,ask:async(p)=>{asked.push(p);if(p.context?.mode==='adventure')return {story:{...journeyStory(4),libraryId:p.context.journey,artId:'journey-'+p.context.journey},journey:true};return {narration:'The road goes on.',actionId:null};},randomImpl:()=>.5});
 const A={id:'a'.repeat(64)},B={id:'b'.repeat(64)},C={id:'c'.repeat(64)};
 const solo=(hero,game)=>JSON.parse(JSON.stringify(rules.adventureSnapshot(hero,game,null,true)));
 // Invites: eight of A-Z and 0-9, shown XXXX-XXXX.
 const codes=Array.from({length:400},()=>newInvite());for(const code of codes)assert.match(code,/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
 const seen=new Set(codes.join('').replace(/-/g,''));assert.ok(seen.size>=34,'letters and numbers, none left out ('+seen.size+' of 36 seen)');
 assert.deepEqual(inviteForms('k7q2 9xmb'),[{code:'K7Q29XMB'}],'typed in any case, without the dash');assert.deepEqual(inviteForms('  K7Q2-9XMB '),[{code:'K7Q29XMB'}]);
 assert.equal(inviteForms('K7Q2-9XM').length,0);assert.equal(inviteForms('aBcD_efGh-ijklmn').length,1,'a long code from before is still read');
 // A table opened from the crossroads (or no tale): no tale until the host begins one; turns wait for it.
 const made=c.create(A,{snapshot:solo(kara,{...r.newAdventure(kara),map:{visited:['inn','bridge'],accepted:true,clue:false,peaceful:false,minutes:0}}),name:'Al'});
 assert.equal(made.needsTale,true);assert.ok(rules.isPartyGame(made.snapshot.game),'a party, always');assert.match(made.invite,/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
 const file=JSON.parse(read(path.join(dir,'campaigns',made.campaignId+'.json')));assert.ok(!JSON.stringify(file).includes(made.invite)&&!JSON.stringify(file).includes(made.invite.replace('-','')),'only a keyed hash of the code is kept');assert.match(file.inviteHash,/^v2:[a-f0-9]{64}$/);
 await assert.rejects(c.turn(A,{campaignId:made.campaignId,question:'I look around.',requestId:crypto.randomUUID(),baseVersion:made.version}),e=>e.status===409&&e.needsTale,'nothing is played without a tale');
 // Joining: by the code in lower case without its dash, always with a hero of one's own.
 const lower=made.invite.toLowerCase().replace('-',' ');
 assert.throws(()=>c.join(B,{invite:lower,name:'Bo'}),e=>e.status===400,'nobody joins without a hero');
 assert.throws(()=>c.join(B,{invite:'ZZZZ-ZZZZ'===made.invite?'YYYY-YYYY':'ZZZZ-ZZZZ',name:'Bo',snapshot:solo(ilyra,r.newAdventure(ilyra))}),e=>e.status===404&&e.inviteMiss,'a wrong code is a miss');
 assert.throws(()=>c.join(B,{invite:lower,name:'Bo',snapshot:solo(kara,r.newAdventure(kara))}),e=>e.status===409,'never a hero already at the table');
 const joined=c.join(B,{invite:lower,name:'Bo',snapshot:solo(ilyra,r.newAdventure(ilyra))});assert.equal(joined.needsTale,true);assert.equal(joined.needsHero,false);
 assert.equal(JSON.parse(joined.snapshot.character).name,ilyra.name,'Bo controls his own hero');
 // Only the host begins the table's tale; a ready journey is fetched from the Dungeon Master's library.
 await assert.rejects(c.tale(B,{campaignId:made.campaignId,baseVersion:joined.version,journey:'0f8fad5b-d9cb-469f-a165-70867728950e'}),e=>e.status===403);
 const begun=await c.tale(A,{campaignId:made.campaignId,baseVersion:joined.version,journey:'0f8fad5b-d9cb-469f-a165-70867728950e'});
 const story=asked.find(p=>p.context?.mode==='adventure');assert.ok(story&&story.context.journey==='0f8fad5b-d9cb-469f-a165-70867728950e'&&story.context.introId==='easy'&&story.context.easyStart===true,'asked of the library as a device asks');
 assert.equal(begun.needsTale,false);assert.equal(begun.snapshot.game.story.title,journeyStory(4).title);assert.equal(begun.tale.libraryId,'0f8fad5b-d9cb-469f-a165-70867728950e');
 assert.equal(Object.keys(begun.snapshot.game.party.members).length,2,'both heroes in the tale');
 const bo=c.poll(B,{campaignId:made.campaignId,knownVersion:-1});assert.equal(JSON.parse(bo.snapshot.character).name,ilyra.name);assert.equal(bo.snapshot.game.story.title,journeyStory(4).title);
 const played=await c.turn(B,{campaignId:made.campaignId,question:'I look around.',requestId:crypto.randomUUID(),baseVersion:begun.version});assert.ok(played.version>begun.version,'and now the table plays');
 // A tale under way is replaced only when the host confirms it; a story written on the host's device works too.
 await assert.rejects(c.tale(A,{campaignId:made.campaignId,baseVersion:played.version,story:journeyStory(5),introId:'idea'}),e=>e.status===409&&/Confirm/.test(e.message));
 // (A written tale comes only by its journey id: a story the host's device posts keeps no staging and no shelf tag.)
 const next=await c.tale(A,{campaignId:made.campaignId,baseVersion:played.version,story:{...journeyStory(5),staging:{v:1,crafted:true},written:{slug:'crafted',edition:1,length:'short'}},introId:'idea',replace:true});assert.equal(next.snapshot.game.story.title,journeyStory(5).title);
 assert.ok(next.snapshot.game.story.staging===undefined&&next.snapshot.game.story.written===undefined,'a posted story keeps no staging and no shelf tag');
 assert.ok(next.snapshot.game.storyHistory.includes(journeyStory(4).title),'the tale left behind is remembered');
 await assert.rejects(c.tale(A,{campaignId:made.campaignId,baseVersion:next.version,story:{title:'Broken'},introId:'idea',replace:true}),e=>e.status===409,'an unsound tale is refused');
 // A long code from before still works until it expires.
 {const f=path.join(dir,'campaigns',made.campaignId+'.json'),camp=JSON.parse(read(f));camp.inviteHash=crypto.createHash('sha256').update('aBcD_efGh-ijklmn').digest('hex');fs.writeFileSync(f,JSON.stringify(camp));
  const cy=c.join(C,{invite:'aBcD_efGh-ijklmn',name:'Cy',snapshot:solo(bram,tale(bram,6))});assert.equal(cy.needsHero,false);assert.equal(Object.keys(cy.snapshot.game.party.members).length,3);
  camp.inviteUntil=Date.now()-1;camp.version=cy.version;camp.members=JSON.parse(read(f)).members;camp.snapshot=JSON.parse(read(f)).snapshot;fs.writeFileSync(f,JSON.stringify(camp));
  assert.throws(()=>c.join({id:'d'.repeat(64)},{invite:'aBcD_efGh-ijklmn',name:'Di',snapshot:solo(r.readyHero('rogue'),r.newAdventure(r.readyHero('rogue')))}),e=>e.status===404,'until it expires');}
 // The account service: wrong codes per caller and overall are counted across restarts, and then joins wait.
 {const {createSyncServer}=require('./account-server.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'qb-invite-guard-'));let tick=Date.now();
  const options={dir:path.join(root,'table'),accountsDir:path.join(root,'accounts'),cloudDir:path.join(root,'cloud'),operations:createOperations({dir:root,key:crypto.randomBytes(32),now:()=>tick}),now:()=>tick,ask:async()=>({narration:'On.',actionId:null}),accountsRequired:false,inviteLimits:{callerHour:3,callerDay:5,allHour:6,allDay:9}};
  const serve=async()=>{const {server}=createSyncServer(options);await new Promise(res=>server.listen(0,'127.0.0.1',res));return server;};
  let server=await serve(),base='http://127.0.0.1:'+server.address().port;
  const post=async(route,body,cookie='',caller='visitor-1')=>{const res=await fetch(base+'/'+route,{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json',Cookie:cookie,'X-Questbound-Client':caller},body:JSON.stringify(body)});return {status:res.status,body:await res.json(),retry:res.headers.get('retry-after'),cookie:(res.headers.get('set-cookie')??'').split(';')[0]};};
  const host=await post('account-guest',{},'','host-pc'),guest=await post('account-guest',{},'','visitor-1');
  const table=await post('campaign-create',{snapshot:solo(kara,tale(kara)),name:'Al'},host.cookie,'host-pc');assert.equal(table.status,200,JSON.stringify(table.body));assert.equal(table.body.needsTale,false,'a host in a written tale opens the table in it');
  const wrong=table.body.invite==='AAAA-AAAA'?'BBBB-BBBB':'AAAA-AAAA',hero=solo(ilyra,r.newAdventure(ilyra));
  for(let i=0;i<3;i++)assert.equal((await post('campaign-join',{invite:wrong,name:'Bo',snapshot:hero},guest.cookie)).status,404);
  const held=await post('campaign-join',{invite:table.body.invite,name:'Bo',snapshot:hero},guest.cookie);assert.equal(held.status,429,'past the caller\'s wrong codes even the right code waits');assert.ok(Number(held.retry)>0);
  assert.match(held.body.error,/wrong invite codes/);assert.ok(!/Please wait before asking|busy with other players/.test(held.body.error),'never the busy words the game retries on');
  server.close();server=await serve();base='http://127.0.0.1:'+server.address().port;
  assert.equal((await post('campaign-join',{invite:table.body.invite,name:'Bo',snapshot:hero},guest.cookie)).status,429,'kept across a restart');
  // Others are not held by one caller's misses, until the game as a whole has had too many.
  const other=await post('account-guest',{},'','visitor-2');assert.equal((await post('campaign-join',{invite:table.body.invite.toLowerCase(),name:'Cy',snapshot:solo(bram,r.newAdventure(bram))},other.cookie,'visitor-2')).status,200,'another caller joins with the right code');
  for(const caller of ['visitor-3','visitor-4','visitor-5']){const g=await post('account-guest',{},'',caller);await post('campaign-join',{invite:wrong,name:'X',snapshot:hero},g.cookie,caller);}
  const late=await post('account-guest',{},'','visitor-6'),overall=await post('campaign-join',{invite:wrong,name:'X',snapshot:hero},late.cookie,'visitor-6');assert.equal(overall.status,429,'and the whole game waits after too many');assert.match(overall.body.error,/tried today/);
  tick+=25*3600000;assert.equal((await post('campaign-join',{invite:table.body.invite,name:'Bo',snapshot:hero},guest.cookie)).status,200,'a day later the right code works');
  server.close();fs.rmSync(root,{recursive:true,force:true});}
 fs.rmSync(dir,{recursive:true,force:true});
 console.log('No crossroads: a game with no story is never played (Continue, Play and every game screen ask for a tale; old crossroads saves load and wait for one; its restart is gone); every table plays a tale its host begins for everyone (a ready journey from the library or a tale written on the host\'s device), each member with a hero of their own (never another\'s, nobody joins without one); invites are XXXX-XXXX of A-Z and 0-9, typed in any case, kept only as a keyed hash, older codes honoured until they expire, and wrong codes held back per caller and overall across restarts.');
})().catch(e=>{console.error(e);process.exit(1);});
