// The campaign edits a shared table needs for the waves' screens, each checked by the server's own rules: sending for a
// companion who waits elsewhere, taking along someone who offered (refused without an offer and in a fight),
// attuning to a magic item (refused for the wrong item, never more than three), ticking a lead (experience once, and
// reopening it pays nothing), and a level earned by experience taken where the hero stands (the party, the
// experience and the companions kept, a foe not yet met grown to match). Synthetic accounts in a temporary folder;
// no network, no AI, no email.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const r=require('./rules-engine.cjs').rules(),{createCampaigns}=require('./campaigns.cjs');
// Helpers the server does not need (magic items for the fixtures), from the same rules files.
const engine=fs.readFileSync('rules-engine.cjs','utf8'),files=JSON.parse(engine.match(/const files=(\[[^\]]*\]);/)[1].replace(/'/g,'"'));
const extra=vm.runInNewContext('const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n')+'\n;({makeMagicItem})',{AsyncStorage:{},console});
const seq=(s=11)=>()=>(s=(s*16807)%2147483647)/2147483647;
const ask=async()=>({narration:'The road goes on.',actionId:null});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qb-edits-')),c=createCampaigns({dir,ask,randomImpl:seq()});
const A={id:'a'.repeat(64)},B={id:'b'.repeat(64)},hp={current:12,temp:0};
const fighter=r.readyHero('fighter'),wizard=r.readyHero('wizard');
const snapshotOf=(hero,game,health=null)=>r.adventureSnapshot(hero,game,health,true);
const refused=(fn,pattern)=>assert.throws(fn,e=>e.status===400&&pattern.test(e.message));
const solo=(hero,game,name='Cy',user=A)=>{const made=c.create(user,{snapshot:snapshotOf(hero,game),party:false,name});return {id:made.campaignId,version:made.version};};
const edit=(user,at,change)=>c.edit(user,{campaignId:at.id,baseVersion:at.version,...change});
const rewrite=(id,fn)=>{const file=path.join(dir,id+'.json'),camp=JSON.parse(fs.readFileSync(file,'utf8'));fn(camp);camp.version++;fs.writeFileSync(file,JSON.stringify(camp));return camp.version;};
try{
 // 1. Companions: wait, travel on, then send for her from the table.
 const base=r.newAdventure(fighter);
 const plan={npcId:'mara',decision:'join',reason:'She wants to find her brother.',terms:'Help her search.',dc:null,class:null};
 const joined=r.commitDmTurn(fighter,base,hp,{type:'recruitment',plans:[plan]},{question:'Mara, will you come with me?',narration:'She nods.',npcId:'mara'});assert.equal(joined.error,undefined,joined.error);
 const waits=r.manageFollower(joined.game,'mara','wait');assert.equal(waits.error,undefined,waits.error);
 const gone=r.adventureStep(waits.game,hp,fighter,{type:'travel',destination:'tower'},()=>.5);assert.equal(gone.error,undefined,gone.error);
 let at=solo(fighter,gone.game);
 refused(()=>edit(A,at,{kind:'follower',id:'mara',action:'beckon'}),/Unknown companion action/);
 const called=edit(A,at,{kind:'follower',id:'mara',action:'call'});
 assert.equal(called.snapshot.game.followers.mara.status,'following','she is sent for and catches up');

 // 2. An offer to come along: refused without one and in a fight, taken when it stands.
 at=solo(fighter,base);refused(()=>edit(A,at,{kind:'accept-offer',id:'mara'}),/offered/);
 const offered=r.commitDmTurn(fighter,base,hp,{type:'recruitment',plans:[{...plan,decision:'offer'}]},{question:'Anyone for the road?',narration:'Mara stands.',npcId:null});
 assert.equal(offered.error,undefined,offered.error);assert.ok(offered.game.joinOffers?.mara,'an offer is recorded');
 at=solo(fighter,offered.game);
 const fighting=rewrite(at.id,camp=>{camp.snapshot.game={...camp.snapshot.game,npcCombat:{active:true,round:1}};});
 refused(()=>edit(A,{id:at.id,version:fighting},{kind:'accept-offer',id:'mara'}),/Finish the encounter/);
 const calm=rewrite(at.id,camp=>{delete camp.snapshot.game.npcCombat;});
 const along=edit(A,{id:at.id,version:calm},{kind:'accept-offer',id:'mara'});
 assert.equal(along.snapshot.game.followers.mara.status,'following');assert.equal(along.snapshot.game.joinOffers,undefined,'the offer is used up');

 // 3. Attunement: only an item that needs it, three at most.
 const items=['cloak-of-protection','ring-of-protection','stone-of-good-luck','periapt-of-wound-closure'].map(id=>extra.makeMagicItem(id,fighter));
 at=solo(fighter,{...base,pack:{gold:10,items:[...items,{name:'Rope',kind:'gear',qty:1}],spent:{}}});
 refused(()=>edit(A,at,{kind:'attune',name:'Rope'}),/needs no attunement/);refused(()=>edit(A,at,{kind:'attune'}),/Choose an item/);
 let version=at.version,out;
 for(const item of items){out=edit(A,{id:at.id,version},{kind:'attune',name:item.name});version=out.version;}
 const attuned=out.snapshot.game.pack.items.filter(i=>i.attuned).map(i=>i.name);
 assert.equal(attuned.length,3,'three at most');assert.ok(attuned.includes(items[3].name)&&!attuned.includes(items[0].name),'the oldest bond gives way');
 assert.ok(/attune/i.test(out.snapshot.game.log[0]),'the log says so');

 // 4. A lead ticked at the table pays experience once; reopening and ticking again pays nothing more.
 const leads=[{id:'l1',title:'The ferryman',hook:'He saw the lights.'},{id:'l2',title:'The mill',hook:'Flour on the bridge.'}];
 const written={id:'test-road',status:'active',title:'The Test Road',premise:'A quiet inn.',opening:'You arrive.',objective:'Find the thief.',resolution:'Catch them.',secret:'The keeper knows.',foe:'Bog hag',foeSpecies:'Hag',foeAppearance:'A bent green crone with river weed for hair.',locations:{inn:{name:'The Lamp',description:'An inn.'},bridge:{name:'The Ford',description:'A ford.'},tower:{name:'The Mill',description:'A mill.'}},npcs:{keeper:{name:'Ivo Brask',species:'Human',role:'Innkeeper',motive:'Keep the peace.',appearance:'A tall man with a grey beard and a limp.',personality:'Gruff, slow to trust, quick to laugh.',ties:{other:'friend',foe:'enemy',note:'n'}},mara:{name:'Sera Vane',species:'Elf',role:'Scribe',motive:'Learn the truth.',appearance:'A slight elf with ink on her hands and a red scarf.',personality:'Curious and precise, always counting.',ties:{other:'friend',foe:'neutral',note:'n'}}},chapters:[{title:'The Lamp',goal:'Find who saw the thief.',turn:'The ferryman names the mill.'},{title:'The Mill',goal:'Catch the thief.',turn:'The hag is unmasked.'}],chapter:0,leads};
 const tale=r.freshStoryGame?r.freshStoryGame(fighter,written,base):null;
 at=solo(fighter,tale??{...base,story:written});
 refused(()=>edit(A,at,{kind:'lead',id:'l9'}),/Unknown quest lead/);
 const ticked=edit(A,at,{kind:'lead',id:'l1'});
 const paid=ticked.snapshot.game.xp??0;assert.ok(ticked.xp?.amount>0&&paid>0,'a closed lead pays experience');assert.ok(ticked.snapshot.game.story.leads[0].done);
 const reopened=edit(A,{id:at.id,version:ticked.version},{kind:'lead',id:'l1'});assert.ok(!reopened.snapshot.game.story.leads[0].done,'reopened');
 const again=edit(A,{id:at.id,version:reopened.version},{kind:'lead',id:'l1'});
 assert.equal(again.snapshot.game.xp,paid,'no second payment');assert.equal(again.xp,undefined);

 // 5. A level earned by experience at a two-hero table: taken where the hero stands.
 const host=c.create(A,{snapshot:snapshotOf(fighter,joined.game),party:true,name:'Al'});
 const rogue=r.readyHero('rogue'),inv=c.join(B,{invite:host.invite,snapshot:snapshotOf(rogue,r.newAdventure(rogue)),name:'Bo'});
 const view=r.partyView(inv.snapshot,inv.you),heroB=JSON.parse(view.character);
 refused(()=>c.edit(B,{campaignId:host.campaignId,baseVersion:inv.version,kind:'advance',character:{...heroB,level:2}}),/experience/);
 const ready=rewrite(host.campaignId,camp=>{const v=r.partyView(camp.snapshot,inv.you);camp.snapshot={...v,game:{...v.game,xp:r.xpForLevel(2)}};});
 const beforeFoe=view.game.enemyHP,companion=JSON.parse(JSON.stringify(view.game.npcClasses??{}));
 const levelled=c.edit(B,{campaignId:host.campaignId,baseVersion:ready,kind:'advance',character:{...heroB,level:2}});
 const g=levelled.snapshot.game;
 assert.equal(JSON.parse(levelled.snapshot.character).level,2,'the level is taken');
 assert.ok(r.isPartyGame(g)&&Object.keys(g.party.members).length===2,'the party stays at the table');
 assert.equal(g.xp,r.xpForLevel(2),'the experience is kept');assert.equal(g.levelsOwed,undefined,'no owed levels');
 assert.ok(g.enemyHP>=beforeFoe,'a foe not yet met grows to match');
 for(const [id,trained] of Object.entries(g.npcClasses??{}))assert.ok(trained.level>=(companion[id]?.level??1),'companions keep pace');
 assert.ok(g.storyLog.some(l=>/reached level 2/.test(l.text??l)),'the story log records it');
 // 6. A one-hero campaign (party:false): every member plays the host's hero, but its lasting choices are the host's.
 {const ready={...r.newAdventure(fighter),xp:r.xpForLevel(2)},made=c.create(A,{snapshot:snapshotOf(fighter,ready),party:false,name:'Al'});
  const guest=c.join(B,{invite:made.invite,name:'Bo'}),at2={id:made.campaignId,version:guest.version};
  for(const change of [{kind:'advance',character:{...fighter,level:2}},{kind:'wield',name:'Greatsword'},{kind:'attune',name:'Rope'},{kind:'training',training:{}}])
   assert.throws(()=>edit(B,at2,change),e=>e.status===403,'a guest cannot make '+change.kind+' choices for the host');
  const noted=edit(B,at2,{kind:'note',text:'Ask the miller.'});assert.equal(noted.version,at2.version+1,'a guest may still write in the journal');
  const own=edit(A,{id:at2.id,version:noted.version},{kind:'advance',character:{...fighter,level:2}});assert.equal(JSON.parse(own.snapshot.character).level,2,'the host levels their own hero');}

 // 7. Level 3 and above at a table: an older subclass is kept; a hero with none yet chooses one now (as Advancement.js).
 {const adv=r.advancementLevels('Fighter').includes(4)?[{level:4,abilities:['Strength','Strength']}]:[];
  const take=(hero,plannedSubclass)=>{const made=solo(hero,{...r.newAdventure(hero),xp:r.xpForLevel(4)});return edit(A,made,{kind:'advance',character:{level:4,class:'Fighter',plannedSubclass,advancements:adv,spells:hero.spells,spellbook:hero.spellbook,arcanum:hero.arcanum}});};
  const legacy=r.makeCharacter({...fighter,level:3,devLevel:3,plannedSubclass:'Battle Master',advancements:[]});assert.ok(r.isValidCharacter(legacy),'fixture: an older subclass');
  assert.equal(JSON.parse(take(legacy,'Battle Master').snapshot.character).plannedSubclass,'Battle Master','an older subclass is kept');
  const none=r.makeCharacter({...fighter,level:3,devLevel:3,plannedSubclass:'',advancements:[]}),choice=Object.keys(r.subclassOptions.Fighter)[0];
  assert.equal(JSON.parse(take(none,choice).snapshot.character).plannedSubclass,choice,'a subclass is chosen at the table');
  refused(()=>take(none,''),/Choose your subclass/);refused(()=>take(none,'Battle Master'),/Choose a subclass/);}

 // 8. Players never see each other's account ids: seats in the party, the turn order and the players list, and a
 // table saved before seats is given them when it is first read.
 {const fresh=c.create(A,{snapshot:snapshotOf(fighter,r.newAdventure(fighter)),party:true,name:'Al'});
  const bo=c.join(B,{invite:fresh.invite,snapshot:snapshotOf(wizard,r.newAdventure(wizard)),name:'Bo'}),seen=JSON.stringify([fresh,bo,c.poll(B,{campaignId:fresh.campaignId,knownVersion:-1})]);
  assert.ok(!seen.includes(A.id)&&!seen.includes(B.id),'no account id reaches a player');assert.match(bo.you,/^seat-[a-f0-9]{16}$/);assert.equal(bo.snapshot.game.party.lead,bo.you);
  assert.deepEqual(bo.players.map(p=>p.id).sort(),[fresh.you,bo.you].sort(),'the players list names seats');
  const file=path.join(dir,fresh.campaignId+'.json'),camp=JSON.parse(fs.readFileSync(file,'utf8')),back={[fresh.you]:A.id,[bo.you]:B.id};
  const old=JSON.parse(JSON.stringify(camp.snapshot).replace(/seat-[a-f0-9]{16}/g,s=>back[s]));old.game.turnOrder={order:[{id:B.id,init:15},{id:A.id,init:9},{id:'foe',init:4}],at:0,round:1};
  for(const m of Object.values(camp.members))delete m.seat;camp.snapshot=old;camp.receipts=[{id:'r'.repeat(16),by:B.id}];fs.writeFileSync(file,JSON.stringify(camp));
  const migrated=c.poll(B,{campaignId:fresh.campaignId,knownVersion:-1}),stored=fs.readFileSync(file,'utf8');
  assert.ok(!JSON.stringify(migrated).includes(A.id)&&!JSON.stringify(migrated).includes(B.id),'an older table is given seats');
  assert.equal(migrated.snapshot.game.turnOrder.order[0].id,migrated.you,'the turn order follows the seats');
  assert.ok(!JSON.parse(stored).snapshot.game.party.members[A.id]&&JSON.parse(stored).receipts[0].by===migrated.you,'the stored table and its receipts are rewritten once');}
 console.log('Campaign edits: send for a companion, take along an offer (not without one or in a fight), attune (three at most), a lead pays once, a level by experience keeps the party, the XP and the companions, a one-hero campaign’s lasting choices are the host’s, an older or missing subclass at level 3+ levels at a table, and players see seats, never account ids (older tables migrated).');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
