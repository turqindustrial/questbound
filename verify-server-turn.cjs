// A shared-table turn resolved by the campaign server (server-turn.cjs) is the same turn a device settles alone
// (Adventure.act): both go through turnRules.settleTurn, so experience, spoils, the story log and deeds come out the
// same for the same dice. The server also passes back the Dungeon Master's ideas, honours the device's own settings
// (one on one, narrator, brutality, autoShield) without saving them, refuses a hard casting error before asking the
// Dungeon Master, accepts an Attack… pick at any target, and gives companions their classes out of a fight.
// Synthetic heroes and a stand-in Dungeon Master only: no network, no AI, no email.
const assert=require('node:assert/strict');
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
const seq=(s=11)=>()=>(s=(s*16807)%2147483647)/2147483647;
const plain=v=>JSON.parse(JSON.stringify(v));
const reply={narration:'The fight turns.',actionId:null,suggestions:['I check the body.','I catch my breath.','I look around.','A fourth idea.']};
const asked=[],ask=async p=>{asked.push(p);return {...reply};};
const chip=(hero,game,health,pattern)=>r.quickActions(hero,game,health).find(c=>pattern.test(c.key??c.id??'')&&c.action);
// The device's pipeline written out step by step, as Adventure.act ran it before the shared helper existed.
function byHand(hero,snapshot,action,question,dice,actorName){
 const game=snapshot.game,health=snapshot.health;
 const conversation={question,narration:reply.narration,dialogue:undefined,worldEvent:undefined,relationships:undefined,loot:undefined,introduce:null,normalizedCommand:undefined,npcId:null,actorName};
 let result=r.commitDmTurn(hero,game,health,action,conversation,dice);assert.equal(result.error,undefined,result.error);
 const xp=r.withExperience(game,result.game,hero,{action});result={...result,game:xp.game,events:[...(result.events??[]),...xp.lines]};
 result=r.recordedTurn(hero,game,health,result,result.conversation??conversation,null);result.game={...result.game};delete result.game.sceneCue;
 const marked=r.withDeeds(r.withStoryLog(game,result.game,hero,{action}),hero);
 // Then the story log folded into the lasting memory (memoryRules.js), as settleTurn does.
 return {snapshot:r.adventureSnapshot(hero,r.withMemory(marked.game),result.health,true),fresh:marked.fresh};
}
(async()=>{
 // 1. A skirmish fought to victory at the server earns experience and leaves spoils; ideas come back (three at most).
 const fighter=r.readyHero('fighter');
 let snap=r.adventureSnapshot(fighter,r.hostileEncounterGame(fighter,r.newAdventure(fighter),seq()),null,true),xpLine=null,last=null;
 const rand=seq(5);
 for(let i=0;i<40&&snap.game.stage==='combat';i++){const c=chip(fighter,snap.game,snap.health,/^attack:/);last=await resolveTurn(snap,{question:'I attack.',action:c.action},{ask,randomImpl:rand});snap=last.snapshot;xpLine??=last.events.find(e=>/^Experience: \+\d+/.test(e));}
 assert.equal(snap.game.stage,'victory','the skirmish is won');
 assert.ok(xpLine&&snap.game.xp>0,'a won fight pays experience at the table');assert.ok(snap.game.spoils,'and leaves spoils to take');
 assert.deepEqual(last.suggestions,reply.suggestions.slice(0,3),'the Dungeon Master\'s ideas pass back to the caller');
 assert.ok(last.xp&&last.xp.amount>0&&/defeated/.test(last.xp.label),'the experience cue goes back to the acting device');
 assert.equal(JSON.parse(snap.character).xp,undefined,'experience lives in the game, not the character');
 const loot=chip(fighter,snap.game,snap.health,/^loot/);
 assert.ok(loot,'a Loot chip after the win');{const taken=await resolveTurn(snap,{question:'I search the body.',action:loot.action},{ask,randomImpl:seq(3)});assert.equal(taken.snapshot.game.spoils,undefined,'the Loot chip takes the spoils at the table too');}

 // 2. The device's settings: autoShield reaches the rules, never the saved hero; preferences are whitelisted; one on
 // one and the people speaking reach the Dungeon Master as on a device.
 const wizard=r.readyHero('wizard'),inn=r.adventureSnapshot(wizard,r.newAdventure(wizard),null,true);
 const settle=r.settleTurn,seen=[];r.settleTurn=args=>{seen.push(args.ruled.autoShield);return settle(args);};
 try{
  const out=await resolveTurn(inn,{question:'Mara, what brings you here?',npcId:'mara',oneOnOne:true,autoShield:false,storyPreferences:{narrator:'bard',brutality:'brutal',secret:'x'}},{ask,randomImpl:seq(7)});
  assert.deepEqual(seen,[false],'the rules see the device\'s Shield setting');
  assert.equal(JSON.parse(out.snapshot.character).autoShield,undefined,'the setting is never saved with the hero');
  const context=asked.at(-1).context;
  assert.deepEqual(context.storyPreferences,{brutality:'brutal',narrator:'bard'},'only known preferences reach the Dungeon Master');
  assert.equal(context.conversationWith?.id,'mara');assert.equal(context.conversationWith.oneOnOne,true,'just the two of them');
  assert.deepEqual(context.conversationParticipants.map(p=>p.id),r.speakingPeople(inn.game).map(n=>n.id),'the people who may speak');
  await resolveTurn(inn,{question:'Mara, what brings you here?',npcId:'mara',storyPreferences:'bard'},{ask,randomImpl:seq(7)});
  assert.equal(asked.at(-1).context.conversationWith.oneOnOne,false);assert.deepEqual(asked.at(-1).context.storyPreferences,{});
  await resolveTurn(inn,{question:'I look around.'},{ask,randomImpl:seq(7)});assert.deepEqual(seen.slice(-1),[undefined],'Shield stays on by default');
 }finally{r.settleTurn=settle;}

 // 3. A plain "I cast" that the rules refuse outright is shown as it is; a cast the game could not read goes to the
 // Dungeon Master as a casting issue.
 const spent={...inn,game:{...inn.game,spellSlotsUsed:[9,0,0,0,0,0,0,0,0]}},hard=r.dmCommand(wizard,spent.game,'I cast Magic Missile at the keeper.',null);
 assert.ok(hard?.error&&!hard.soft,'no slots left is a hard refusal');
 const before=asked.length;
 await assert.rejects(resolveTurn(spent,{question:'I cast Magic Missile at the keeper.'},{ask,randomImpl:seq()}),e=>e.message===hard.error);
 assert.equal(asked.length,before,'the Dungeon Master is not asked');
 await resolveTurn(inn,{question:'I cast Wish.'},{ask,randomImpl:seq()});assert.ok(asked.at(-1).context.castingIssue,'a soft wording problem goes to the Dungeon Master');

 // 4. An Attack… pick aimed at someone who is not the default target is accepted.
 const targets=r.attackTargets(fighter,r.newAdventure(fighter),null);assert.ok(targets.length>=2);
 const aim=r.attackActions(fighter,r.newAdventure(fighter),null,targets[1].key).find(a=>a.action?.type==='npc-attack');
 const brawl=await resolveTurn(r.adventureSnapshot(fighter,r.newAdventure(fighter),null,true),{question:aim.question,action:aim.action},{ask,randomImpl:seq(9)});
 assert.ok(brawl.snapshot.game.npcCombat?.active||brawl.events.length,'the pick is a move the rules accept');
 await assert.rejects(resolveTurn(inn,{question:'I attack.',action:{type:'npc-attack',target:'nobody',weapon:'Greatsword'}},{ask,randomImpl:seq()}),/not available/);

 // 5. Companions gain a class out of a fight (Adventure.js does this on a device when alone).
 const classed=r.withCompanionClasses,calls=[];r.withCompanionClasses=(g,h)=>{calls.push(g.stage);return classed(g,h);};
 try{await resolveTurn(inn,{question:'I look around.'},{ask,randomImpl:seq()});await resolveTurn(r.adventureSnapshot(fighter,r.hostileEncounterGame(fighter,r.newAdventure(fighter),seq()),null,true),{question:'I look around.'},{ask,randomImpl:seq()});}
 finally{r.withCompanionClasses=classed;}
 assert.deepEqual(calls,['inn'],'only out of a fight');

 // 6. A party: the same action and dice settle to the same table through the server and through the device's steps,
 // every living hero is paid from their own level, and nothing calls partyVictory any more.
 let won=null;
 for(let seed=1;seed<400&&!won;seed++){
  const fight={...r.hostileEncounterGame(fighter,r.newAdventure(fighter),seq(seed)),enemyHP:1};
  let party=r.startParty(r.adventureSnapshot(fighter,fight,null,true),'A','Al');
  party=r.joinParty(party,'B',{character:JSON.stringify(wizard),game:r.newAdventure(wizard),health:null,name:'Bo'}).snapshot;
  const view=r.partyView(party,'A'),c=chip(fighter,view.game,view.health,/^attack:/);
  const server=await resolveTurn(view,{question:'I attack.',action:c.action},{ask,randomImpl:seq(seed+1000),actorName:'Al'});
  const hand=byHand(fighter,view,c.action,'I attack.',seq(seed+1000),'Al');
  assert.deepEqual(plain(r.canonicalParty(server.snapshot)),plain(r.canonicalParty(hand.snapshot)),'seed '+seed+': server and device agree');
  assert.deepEqual(plain(server.deeds),plain(hand.fresh));
  if(server.snapshot.game.stage==='victory')won=server;
 }
 assert.ok(won,'a one-hit win was found');
 const members=won.snapshot.game.party.members;
 assert.ok(won.snapshot.game.xp>0,'the hero who acted gains');assert.ok(members.B.hero?.xp>0,'the other living hero gains too');
 assert.ok(won.events.some(e=>/^Experience: \+\d+ .*Every hero in the party gains experience too\.$/.test(e)));
 assert.ok(won.snapshot.game.storyLog?.length>0,'the story log records the fight');
 assert.equal(r.partyVictory,undefined);
 // People speak first at a table too: the Speak chip sends {greet:true, npcId}; the server works out the opening and
 // writes it (greetings.js) with no request to the Dungeon Master, and plays it as a trigger turn (no player line).
 {const bard=r.readyHero('wizard'),tavern=r.adventureSnapshot(bard,r.newAdventure(bard),null,true),greetAsked=[];
  const who=r.conversationPeople(tavern.game)[0].id;assert.ok(r.shouldGreet(tavern.game,who));
  const said=await resolveTurn(tavern,{question:'ignored',npcId:who,greet:true},{ask:async p=>{greetAsked.push(p);return {narration:'She sets down a cup.',dialogue:[{speakerId:who,text:'Well met, traveller.'}],suggestions:['Hello.']};},randomImpl:seq(5)});
  assert.equal(greetAsked.length,0,'the Dungeon Master is not asked for a greeting');const opening=r.greeting(tavern.game,who,bard);
  const events=said.turn.events;assert.ok(!events.some(e=>e.kind==='player'),'no player line: a trigger turn');assert.equal(events[0].text,opening.scene,'the opening is the server\'s, not the device\'s words');
  assert.deepEqual(plain(events.filter(e=>e.kind==='dialogue').map(e=>e.text)),[opening.line],'only that person speaks, in the written line');assert.ok(events.some(e=>e.kind==='narration'&&e.text===opening.aside),'with what they are doing');assert.deepEqual(plain(said.suggestions),[]);
  await assert.rejects(resolveTurn(said.snapshot,{question:'x',npcId:who,greet:true},{ask,randomImpl:seq()}),/waiting to speak first/,'someone who has just spoken does not greet again');
  await assert.rejects(resolveTurn(tavern,{question:'x',npcId:'nobody',greet:true},{ask,randomImpl:seq()}),/waiting to speak first/);}

 // 6. The campaign's own gates (campaigns.cjs). AGENTS: in a party fight anyone may pass a hero's turn after 90 s, or at
 // once when that hero's player is not at the table (the host always may); only direct===true is talk to the Dungeon
 // Master out of turn; the day's turn allowance is spent only on a kept turn, and never by the host's own desktop.
 {const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{createCampaigns}=require('./campaigns.cjs');
  let t=1e12;const spent=[],peeked=[],dir=fs.mkdtempSync(path.join(os.tmpdir(),'qb-turns-'));
  const operations={backup:{put(){},remove(){}},audit(){},consume(id,type,max,o={}){if(type!=='turns')return;(o.peek?peeked:o.spend?spent:[]).push(id);if(!o.peek&&!o.spend)throw Error('a turn spent before it was kept');}};
  const c=createCampaigns({dir,ask:async()=>({narration:'Steel rings.',actionId:null}),randomImpl:seq(3),now:()=>t,operations});
  const A={id:'a'.repeat(64)},B={id:'b'.repeat(64)},hero=r.readyHero('fighter'),bandit=()=>(r.hostileFoes.findIndex(f=>f.key==='bandit')+.5)/r.hostileFoes.length;
  try{
   const made=c.create(A,{snapshot:r.adventureSnapshot(hero,r.hostileEncounterGame(hero,r.newAdventure(hero),bandit),null,true),name:'Al',party:true});
   const second={...r.readyHero('fighter'),name:'Brannoc Second'},bo=c.join(B,{invite:made.invite,snapshot:r.adventureSnapshot(second,r.newAdventure(second),null,true),name:'Bo'}),id=made.campaignId;
   const turn=(user,body)=>c.turn(user,{campaignId:id,requestId:crypto.randomUUID(),baseVersion:c.poll(user,{campaignId:id}).version,...body});
   const opening=chip(second,bo.snapshot.game,bo.snapshot.health,/^attack:/);await turn(B,{question:'I attack.',action:opening.action});
   assert.ok(c.poll(B,{campaignId:id,knownVersion:-1}).snapshot.game.turnOrder,'the fight goes in turns');
   const holdFor=(seat,round)=>{const file=path.join(dir,id+'.json'),camp=JSON.parse(fs.readFileSync(file,'utf8')),o=camp.snapshot.game.turnOrder;o.at=o.order.findIndex(e=>e.id===seat);o.round=round;camp.version++;fs.writeFileSync(file,JSON.stringify(camp));};
   const pass={question:'I pass the turn.',action:{type:'party-pass'}},refusedWith=async(p,status)=>assert.equal(await p.then(()=>0,e=>e.status),status);
   // Al's player has left the table: Bo may pass at once.
   t+=20000;holdFor(made.you,5);await turn(B,pass);
   // Al is here: not yet; Bo's out-of-turn words are not talk to the Dungeon Master unless direct is exactly true.
   holdFor(made.you,6);c.poll(A,{campaignId:id});await refusedWith(turn(B,pass),403);
   await refusedWith(turn(B,{question:'I shout to flank the bandit.',direct:1}),409);
   const spentBefore=spent.length;await turn(B,{question:'DM, how far is the river?',direct:true});assert.equal(spent.length,spentBefore+1,'talk to the Dungeon Master is a kept turn');
   // A minute and a half later Bo may pass even though Al is still here.
   t+=80000;c.poll(A,{campaignId:id});t+=11000;holdFor(made.you,6);await turn(B,pass);
   // A turn the rules refuse spends nothing; the host's desktop is never counted.
   const before=[spent.length,peeked.length];await refusedWith(turn(B,{question:'I swing.',action:{type:'no-such-chip'}}),400);
   assert.deepEqual([spent.length,peeked.length],[before[0],before[1]+1],'checked, not spent');
   const counted=spent.length,local={...A,local:true};holdFor(made.you,9);await turn(local,{question:'I look around.'});await refusedWith(turn(local,{question:'I swing.',action:{type:'no-such-chip'}}),400);
   assert.equal(spent.length,counted,'the host’s own desktop is not capped');assert.ok(spent.every(x=>x===B.id));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}}
 // The shield said in the player's own words at the table: in a fight it is the hero's action (the foe answers at the
 // new armor class); out of one it is free. Both go through the same engine move as on a device.
 {const cleric=r.readyHero('cleric'),fight={...r.hostileEncounterGame(cleric,r.newAdventure(cleric),seq(4)),openingAttackAvailable:false};
  const slung=await resolveTurn(r.adventureSnapshot(cleric,fight,null,true),{question:'I put my shield on my back.'},{ask,randomImpl:seq(8)});
  assert.equal(slung.snapshot.game.shieldAway,true,'the shield is on the back');assert.ok(slung.events.some(t=>/sling your shield.*takes your action/.test(t)),slung.events.join(' | '));
  const ac=r.combatBasics(r.gearedHero(cleric,slung.snapshot.game)).ac;assert.equal(ac,r.combatBasics(cleric).ac-2);
  if(slung.snapshot.game.stage==='combat')assert.ok(slung.events.some(t=>new RegExp('vs your AC '+ac).test(t))||slung.snapshot.game.actionUsed,'the foe answers at the new armor class');
  const inn=r.adventureSnapshot(cleric,{...r.newAdventure(cleric),shieldAway:true},null,true),raised=await resolveTurn(inn,{question:'I take up my shield.'},{ask,randomImpl:seq(8)});
  assert.equal(raised.snapshot.game.shieldAway,undefined,'taken up again, out of a fight');assert.ok(!raised.events.some(t=>/takes your action/.test(t)),'and free there');}
 console.log('Server turns: the shield said in words (the action in a fight, free out of one); a skirmish won at the table pays '+snap.game.xp+' XP and leaves spoils, ideas and cues come back, device settings reach the rules unsaved, hard cast refusals stop before the Dungeon Master, any Attack… target works, companions are classed out of a fight, a party turn settles the same on the server and the device, people speak first at a table too (the server works out the greeting, a trigger turn with no player line), and the campaign lets anyone pass an absent or slow player’s turn, keeps out-of-turn talk to direct:true, and spends the day’s allowance only on kept turns (never the host’s desktop).');
})().catch(e=>{console.error(e);process.exitCode=1;});
