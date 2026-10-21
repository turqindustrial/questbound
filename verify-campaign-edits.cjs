// The campaign edits a shared table needs for the waves' screens, each checked by the server's own rules: sending for a
// companion who waits elsewhere, taking along someone who offered (refused without an offer and in a fight),
// attuning to a magic item (refused for the wrong item, never more than three), ticking a lead (experience once, and
// reopening it pays nothing), and a level earned by experience taken where the hero stands (the party, the
// experience and the companions kept, a foe not yet met grown to match). Synthetic accounts in a temporary folder;
// no network, no AI, no email.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs');
const r=require('./rules-engine.cjs').rules(),{createCampaigns}=require('./campaigns.cjs');
// Helpers the server does not need (magic items for the fixtures), from the same rules files.
const extra=vm.runInNewContext(rulesSource()+'\n;({makeMagicItem})',{AsyncStorage:{},console});
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
 // 6. The one-hero kind of table is retired (the host's words, 2026-10-21: "nobody should be "playing" the multi
 // player function without a character to actually take control of"). A new table is always a party, whatever it asks
 // for, and nobody joins without a hero of their own. A table saved as the old kind is read as a party with the host's
 // hero in the lead: another member is sent no adventure (never the host's hero), may not play or edit, and brings a
 // hero of their own to their seat; then they play that hero.
 {const ready={...r.newAdventure(fighter),xp:r.xpForLevel(2)},made=c.create(A,{snapshot:snapshotOf(fighter,ready),party:false,name:'Al'});
  assert.ok(r.isPartyGame(made.snapshot.game),'a new table is always a party');
  assert.throws(()=>c.join(B,{invite:made.invite,name:'Bo'}),e=>e.status===400,'nobody joins without a hero');
  // An old one-hero table: Bo was seated and played Al's hero.
  rewrite(made.campaignId,camp=>{const v=r.partyView(camp.snapshot,camp.members[A.id].seat);const {party,...game}=v.game;camp.snapshot={...v,game};camp.members[B.id]={name:'Bo',role:'player',seat:'seat-'+'b'.repeat(16)};});
  const seen=c.poll(B,{campaignId:made.campaignId,knownVersion:-1});
  assert.equal(seen.needsHero,true,'the old table asks Bo to bring a hero');assert.equal(seen.snapshot,undefined,'and never sends him Al’s hero');
  const host=c.poll(A,{campaignId:made.campaignId,knownVersion:-1});assert.equal(host.needsHero,false);assert.ok(r.isPartyGame(host.snapshot.game),'read as a party, Al in the lead');
  assert.equal(JSON.parse(host.snapshot.character).name,fighter.name);
  assert.throws(()=>edit(B,{id:made.campaignId,version:seen.version},{kind:'note',text:'Ask the miller.'}),e=>e.status===409&&e.needsHero,'no edits without a hero');
  assert.throws(()=>c.join(B,{campaignId:made.campaignId,snapshot:snapshotOf(fighter,r.newAdventure(fighter))}),e=>e.status===409&&/already at this table/.test(e.message),'not a copy of Al’s hero');
  const brought=c.join(B,{campaignId:made.campaignId,snapshot:snapshotOf(wizard,r.newAdventure(wizard))});
  assert.equal(brought.needsHero,false);assert.equal(JSON.parse(brought.snapshot.character).name,wizard.name,'Bo plays his own hero');assert.equal(brought.you,'seat-'+'b'.repeat(16),'at his seat');
  assert.equal(Object.keys(brought.snapshot.game.party.members).length,2);
  const own=edit(A,{id:made.campaignId,version:brought.version},{kind:'advance',character:{...fighter,level:2}});assert.equal(JSON.parse(own.snapshot.character).level,2,'the host levels their own hero');}

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
 // 9. The shield on the back (both hands free) or taken up again: the hero's own choice, kept with their hero, free out
 // of a fight and refused in one (there it takes the hero's action, as a turn).
 {const cleric=r.readyHero('cleric'),ac=h=>r.combatBasics(h).ac;
  let at=solo(cleric,r.newAdventure(cleric),'Cy');
  refused(()=>edit(A,at,{kind:'shield',away:'yes'}),/back or on your arm/);refused(()=>edit(A,at,{kind:'shield',away:false}),/already on your arm/);
  const away=edit(A,at,{kind:'shield',away:true});assert.equal(away.snapshot.game.shieldAway,true,'the shield goes on the back');
  assert.ok(away.snapshot.game.log.some(t=>/sling your shield/.test(t)),'and the log says so');assert.equal(ac(r.gearedHero(cleric,away.snapshot.game)),ac(cleric)-2,'armor class drops by 2');
  const up=edit(A,{id:at.id,version:away.version},{kind:'shield',away:false});assert.equal(up.snapshot.game.shieldAway,undefined,'and comes back to the arm');
  const fighting=rewrite(at.id,camp=>{camp.snapshot.game={...camp.snapshot.game,npcCombat:{active:true,round:1}};});
  refused(()=>edit(A,{id:at.id,version:fighting},{kind:'shield',away:true}),/takes your action/);
  // At a party table each hero's shield is their own: the others' armor class shows the change, their own games do not.
  const table=c.create(A,{snapshot:snapshotOf(fighter,r.newAdventure(fighter)),party:true,name:'Al'});
  const bo=c.join(B,{invite:table.invite,snapshot:snapshotOf(cleric,r.newAdventure(cleric)),name:'Bo'});
  const stowed=edit(B,{id:table.campaignId,version:bo.version},{kind:'shield',away:true});assert.equal(stowed.snapshot.game.shieldAway,true);
  const seen=c.poll(A,{campaignId:table.campaignId,knownVersion:-1});assert.equal(seen.snapshot.game.shieldAway,undefined,'Al’s own hero is untouched');
  assert.equal(seen.snapshot.game.party.members[bo.you].stats.ac,ac(cleric)-2,'Al sees Bo’s armor class drop');assert.equal(seen.snapshot.game.party.members[bo.you].hero.shieldAway,true);
  refused(()=>edit(A,{id:table.campaignId,version:seen.version},{kind:'shield',away:true}),/no shield/);}
 // Moderation (2026-10-13): the host removes and bans a member (their seat and hero leave; every invite refuses them;
 // their poll says calmly they were removed), lets them back by ref; a member reports another with the lines they typed.
 {const reports=[],m=createCampaigns({dir:fs.mkdtempSync(path.join(os.tmpdir(),'qb-ban-')),ask,randomImpl:seq(5),onReport:x=>reports.push(x)}),C={id:'c'.repeat(64)};
  const made=m.create(A,{snapshot:snapshotOf(fighter,r.newAdventure(fighter)),party:true,name:'Al'}),bo=m.join(B,{invite:made.invite,snapshot:snapshotOf(wizard,r.newAdventure(wizard)),name:'Bo'});
  assert.equal(m.report(A,{campaignId:made.campaignId,seat:bo.you,reason:'spam'}).reported,true);assert.equal(reports[0].reported.name,'Bo');assert.match(reports[0].reported.label,/^mod-[a-f0-9]{20}$/);
  assert.ok(!JSON.stringify(reports).includes(A.id)&&!JSON.stringify(reports).includes(B.id),'a report names no account');
  assert.throws(()=>m.ban(B,{campaignId:made.campaignId,seat:made.you}),e=>e.status===403);
  const out=m.ban(A,{campaignId:made.campaignId,seat:bo.you});assert.deepEqual(out.members.map(x=>x.name),['Al']);assert.ok(!(bo.you in out.snapshot.game.party.members));
  assert.throws(()=>m.poll(B,{campaignId:made.campaignId}),e=>e.status===403&&e.removed===true&&/removed you/.test(e.message));
  const fresh=m.invite(A,{campaignId:made.campaignId}).invite;assert.throws(()=>m.join(B,{invite:fresh,snapshot:snapshotOf(wizard,r.newAdventure(wizard)),name:'Bo'}),e=>e.removed===true);
  assert.equal(m.join(C,{invite:fresh,snapshot:snapshotOf(r.readyHero('cleric'),r.newAdventure(r.readyHero('cleric'))),name:'Cy'}).members.length,2,'others still join');
  assert.throws(()=>m.unban(C,{campaignId:made.campaignId,ref:out.banned[0].ref}),e=>e.status===403);
  assert.deepEqual(m.unban(A,{campaignId:made.campaignId,ref:out.banned[0].ref}).banned,[]);assert.equal(m.join(B,{invite:fresh,snapshot:snapshotOf(wizard,r.newAdventure(wizard)),name:'Bo'}).members.length,3,'let back, he may rejoin');}
 console.log('Campaign edits: the host removes, bans and lets back a member; a member reports another; the shield on the back or on the arm (a hero field, never in a fight), send for a companion, take along an offer (not without one or in a fight), attune (three at most), a lead pays once, a level by experience keeps the party, the XP and the companions, every table a party (an old one-hero table asks its other members to bring their own heroes, never sending them the host’s), an older or missing subclass at level 3+ levels at a table, and players see seats, never account ids (older tables migrated).');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
