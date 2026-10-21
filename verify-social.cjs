const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs');
// Talking with people, through the Dungeon Master server: amends and forgiveness are held to the game's own count,
// anyone the player turns to answers (one on one when asked, and in a brawl too), and each reply carries two or three
// tidied suggestions of what the player might say next.
const source=rulesSource({extra:['worldArtRules.js']});
const r=vm.runInNewContext(source+'\n({readyHero,newAdventure,hostileEncounterGame,commitDmTurn,conversationPeople,speakingPeople,dmContext,adventureStep,appendStoryLog,validAdventure,adventureSnapshot,partyView,joinParty,startParty,validParty})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const {generate}=require('./dm-server.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
let sent;
const reply=body=>async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(body)}]}]})};};
const base={narration:'She looks at you.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:null};
const ask=(input,context,body)=>generate({input,context},{apiKey:'test',model:'test',fetchImpl:reply({...base,...body})});

const hero=r.readyHero('fighter'),health={current:10,temp:0};
const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),game={...fight,stage:'inn',enemyHP:0,foeFate:'slain'};delete game.openingAttackAvailable;
const people=r.conversationPeople(game);assert.ok(people.length>=2,'Two people are here');
const [first,second]=people;
const grudge={attitude:'hostile',response:'Holds a grudge.',memories:['You saw the player kill a friend of mine.'],grudge:'The player killed my friend.',grudgeWeight:'grave',grudgeSince:game.storyLog?.at(-1)?.id??0,amends:1};
const grudging={...game,npcMemory:{...game.npcMemory,[first.id]:grudge}};
// What the game sends: npcSocialState carries the forgiveness count straight from the rules.
const contextOf=(g,extra={})=>({...plain(r.dmContext(hero,g,health)),conversationParticipants:plain(r.speakingPeople(g)).map(n=>({id:n.id,name:n.name,role:n.role})),...extra});
const early=contextOf(grudging);
const social=early.npcSocialState.find(n=>n.id===first.id);
assert.deepEqual(social.forgiveness,{weight:'grave',amends:1,needed:2,amendsToGo:1,daysPassed:0,daysNeeded:1,daysToGo:1,canForgive:false});

(async()=>{
 // ---- Amends and forgiveness, held to the game's count ----
 let out=await ask('I am sorry. Forgive me.',early,{relationships:[{npcId:first.id,change:'forgave',memory:'Fine. I forgive you.'}]});
 assert.ok(require('./dm-schemas.cjs').asFields(sent.text.format.schema).properties.relationships.items.properties.change.enum.includes('amends'));
 assert.ok(require('./dm-schemas.cjs').asFields(sent.text.format.schema).properties.relationships.items.properties.change.enum.includes('forgave'));
 assert.deepEqual(plain(out.relationships),[],'Forgiveness before the time has passed is dropped');
 const instructions=JSON.stringify(sent);
 for(const words of ['FORGIVENESS: A grudge is not forever','ONE ON ONE','ANYONE ADDRESSED ANSWERS','SUGGESTIONS:'])assert.ok(instructions.includes(words),'The standing instructions say '+words);
 // A night later, with one act of amends still to go, this very deed may be the last.
 const rested={...grudging,storyLog:r.appendStoryLog(grudging.storyLog,'rest','Took a long rest at the inn.')};
 const ready=contextOf(rested);
 assert.equal(ready.npcSocialState.find(n=>n.id===first.id).forgiveness.daysToGo,0);
 out=await ask('I bring back what I took and kneel at the grave.',ready,{relationships:[{npcId:first.id,change:'forgave',memory:'You have made it right. I forgive you.'}]});
 assert.equal(out.relationships.length,1,'The last amends after a night may settle it');
 const done=r.commitDmTurn(hero,rested,health,null,{question:'I kneel at the grave.',...out});
 assert.equal(done.error,undefined,done.error);
 assert.equal(done.game.npcMemory[first.id].grudge,undefined);assert.equal(done.game.npcMemory[first.id].forgave.weight,'grave');assert.ok(r.validAdventure(r.adventureSnapshot(hero,plain(done.game),health,true),hero),'The forgiven save loads');
 // Amends only for someone wronged: a friendly person with no grudge cannot be given them.
 const friendly={...game,npcMemory:{...game.npcMemory,[second.id]:{attitude:'friendly',response:'Glad of you.',memories:[]}}};
 out=await ask('I apologise to her.',contextOf(friendly),{relationships:[{npcId:second.id,change:'amends',memory:'The player apologised.'}]});
 assert.deepEqual(plain(out.relationships),[]);
 out=await ask('I pay for the broken table.',early,{relationships:[{npcId:first.id,change:'amends',memory:'The player paid for the table.'}]});
 assert.equal(out.relationships.length,1,'Amends to someone holding a grudge are kept');

 // ---- One on one: only the person turned to may answer ----
 const alone=contextOf(grudging,{conversationWith:{id:first.id,name:first.name,role:first.role,oneOnOne:true}});
 out=await ask('Will you hear me?',alone,{dialogue:[{speakerId:first.id,text:'Say it, then go.'}]});
 assert.equal(out.dialogue.length,1);
 assert.equal(out.dialogue[0].text,'Say it, then go.');
 assert.ok((await ask('Will you hear me?',alone,{dialogue:[{speakerId:second.id,text:'She will not.'}]})).dialogue.every(l=>l.speakerId===first.id),'an unavailable speaker is never heard');
 // Everyone here: both may speak, as before.
 const group=contextOf(grudging,{conversationWith:{id:first.id,name:first.name,role:first.role,oneOnOne:false}});
 out=await ask('Will you hear me?',group,{dialogue:[{speakerId:second.id,text:'She will not.'}]});
 assert.equal(out.dialogue[0].speakerId,second.id);
 // A scene cue is never one on one.
 out=await ask('',{...alone,sceneTrigger:{kind:'greet',cue:'The player walks up.'}},{dialogue:[{speakerId:second.id,text:'Who is this?'}],suggestions:['I tell them my name.']});
 assert.equal(out.dialogue[0].speakerId,second.id);assert.deepEqual(plain(out.suggestions),['I tell them my name.'],'A scene cue keeps its suggestions');
 // Nobody to speak: still no dialogue at all.
 assert.deepEqual(plain((await ask('I look around.',{choices:[],conversationParticipants:[]},{dialogue:[{speakerId:first.id,text:'Who goes there?'}]})).dialogue),[]);

 // ---- In a brawl, the one you fight can shout back ----
 const brawl=r.adventureStep(game,health,hero,{type:'npc-attack',target:first.id,weapon:'Greatsword'},()=>0.02);
 assert.equal(brawl.error,undefined,brawl.error);assert.equal(brawl.game.npcCombat?.active,true);
 const brawlContext=contextOf(brawl.game);
 assert.ok(brawlContext.conversationParticipants.some(n=>n.id===first.id));
 out=await ask('Yield!',brawlContext,{dialogue:[{speakerId:first.id,text:'Enough! I yield!'}]});
 assert.ok(sent.text.format.schema.properties.dialogue.maxItems>0);assert.equal(out.dialogue[0].text,'Enough! I yield!');

 // ---- Suggestions, tidied ----
 out=await ask('Who are you?',early,{suggestions:['DM, undo that','x','I ask her name.','  "I ask her name."  ','(ooc) what now','I hit him for 5 HP.','Who are you?','I'.padEnd(200,'.')]});
 const schema=require('./dm-schemas.cjs').asFields(sent.text.format.schema);
 assert.equal(schema.properties.suggestions.maxItems,3);assert.ok(schema.required.includes('suggestions'));
 assert.equal(Object.keys(schema.properties).at(0),'narration','Narration still streams first');
 assert.deepEqual(plain(out.suggestions),['I ask her name.']);
 out=await ask('Who are you?',early,{suggestions:['Tell me about the bridge.','1. I ask for a room.','I leave.','One too many.']});
 assert.deepEqual(plain(out.suggestions),['Tell me about the bridge.','I ask for a room.','I leave.'],'At most three');
 out=await ask('Who are you?',early,{});
 assert.deepEqual(plain(out.suggestions),[],'A reply without suggestions still stands');
 out=await ask('Who are you?',early,{suggestions:'not a list'});
 assert.deepEqual(plain(out.suggestions),[]);
 // Out of character: none at all.
 out=await ask('DM, what was that roll?',{...early,outOfCharacter:{canRewind:false}},{rewind:false,suggestions:['I ask her name.']});
 assert.deepEqual(plain(out.suggestions),[],'any written out of character are left out');

 // ---- At a shared table: the count is the world's, the same from either hero, and amends by either one count ----
 const friend=r.readyHero('wizard');
 const started=r.startParty({version:1,chosen:'fighter',character:hero,health,game:grudging},'p1','Ana');
 const joined=r.joinParty(started,'p2',{character:friend,game:null,health:{current:8,temp:0},name:'Bo'});
 assert.equal(joined.error,undefined,joined.error);
 const theirs=joined.snapshot;assert.ok(r.validParty(theirs.game.party),'A valid party');
 assert.deepEqual(plain(contextOf(theirs.game).npcSocialState.find(n=>n.id===first.id).forgiveness),plain(social.forgiveness),'The second hero sees the same count');
 const byFriend=r.commitDmTurn(friend,theirs.game,theirs.health,null,{question:'I mend her roof.',narration:'She watches.',relationships:[{npcId:first.id,change:'amends',memory:'The other one mended my roof.'}]});
 assert.equal(byFriend.error,undefined,byFriend.error);
 const back=r.partyView({...theirs,game:byFriend.game},'p1');
 assert.equal(back.game.npcMemory[first.id].amends,2,'Amends made by another hero at the table count');
 assert.equal(back.game.npcMemory[first.id].grudgeWeight,'grave');
 console.log('Passed: amends and forgiveness from the Dungeon Master are held to the game\'s count (too soon dropped, the last amends after a night kept, none for someone not wronged), one on one keeps the answer to the person turned to (never on a scene cue), people in a brawl may shout back, and suggestions are tidied to at most three plain lines (none out of character).');
})().catch(error=>{console.error(error);process.exit(1);});
