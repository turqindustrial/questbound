const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs');
// Turning to someone: they speak first, in a line the game writes (greetings.js) that fits how they feel about the
// hero, what they do and where they live (no request to the Dungeon Master), and someone who has only just spoken is
// not made to greet again.
const source=rulesSource({extra:['worldArtRules.js']});
const r=vm.runInNewContext(source+'\n({readyHero,greetingAgenda,newAdventure,hostileEncounterGame,greeting,standInGreetings,npcScene,shouldGreet,greetingPools,greetingRoles,greetingRoleAsides,greetingHomes,greetingAsides,cueGreeting,writtenCues,startParty,joinParty,partyView,commitDmTurn,recordedTurn,conversationPeople,validAdventure,adventureSnapshot,replyIdeas,speakingPeople,adventureStep})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const hero=r.readyHero('fighter');
const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),game={...fight,stage:'inn',enemyHP:0,foeFate:'slain'};delete game.openingAttackAvailable;
const people=r.conversationPeople(game);assert.ok(people.length>=2,'Two people are here to talk to');
const [first,second]=people,name=first.name;
// ---- When someone speaks first ----
assert.equal(r.shouldGreet(game,first.id),true);
assert.equal(r.shouldGreet({...game,stage:'combat',enemyHP:5},first.id),false,'Nobody chats in a fight');assert.equal(r.shouldGreet({...game,npcCombat:{active:true}},first.id),false);assert.equal(r.shouldGreet({...game,stage:'dying'},first.id),false);
const spoke={...game,playback:[{id:1,npcId:null,events:[{kind:'narration',text:'They look up.'},{kind:'dialogue',speakerId:first.id,text:'You made it.'}]}]};
assert.equal(r.shouldGreet(spoke,first.id),false,'Someone who has only just spoken does not greet again');assert.equal(r.shouldGreet(spoke,second.id),true);
// ---- What they say ----
const said=(g,id=first.id)=>r.greeting(g,id,hero);
const plain=said(game);assert.equal(plain.scene,'You turn to '+name+'.');assert.ok(plain.line.length>5);
const mood=memory=>said({...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'indifferent',memories:[],...memory}}}).mood;
assert.equal(mood({grudge:'They killed my brother.'}),'grudge');assert.equal(mood({attitude:'hostile'}),'hostile');assert.equal(mood({attitude:'unfriendly'}),'unfriendly');assert.equal(mood({attitude:'friendly'}),'friendly');assert.equal(mood({attitude:'devoted'}),'bond');assert.equal(mood({bond:'They saved my life.'}),'bond');
assert.equal(mood({grudge:'x',bond:'y',attitude:'friendly'}),'grudge','A grudge outweighs everything');
assert.equal(said({...game,followers:{[first.id]:{status:'following',location:'inn'}}}).mood,'following');
// Someone who forgave the hero a grudge is civil but has not forgotten; once warm again they greet as a friend.
const pardon={grudge:'The player killed my friend.',weight:'grave',memory:'You made it right. I forgive you.'};
assert.equal(mood({forgave:pardon,attitude:'indifferent'}),'forgiven');assert.equal(mood({forgave:pardon,attitude:'unfriendly'}),'forgiven');assert.equal(mood({forgave:pardon,attitude:'friendly'}),'friendly');
assert.ok(said({...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'hostile',memories:[]}}}).line.length>=8,'A hostile person still answers, in words');
// Someone with no feeling either way greets by how they take to the hero's kind.
const regarded=stance=>said({...game,story:{...game.story,npcs:{...game.story.npcs,[first.id]:{...game.story.npcs[first.id],regard:{stance,reason:'A reason of my own.'}}}}}).mood;
for(const stance of ['kin','warm','curious','wary','scornful'])assert.equal(regarded(stance),stance);
assert.ok(Object.keys(r.greetingPools).length>=12);
for(const [key,lines] of Object.entries(r.greetingPools)){assert.ok(lines.length>=2,key+' has a choice of lines');for(const line of lines){assert.ok(line.length>=8&&line.length<=120,line);assert.ok(!/[‘’“”]/.test(line),'Plain quotes only');}}
// The stand-in line changes from one turn to the next more often than not.
const seen=new Set(Array.from({length:12},(_,i)=>said({...game,playback:[{id:i+1,npcId:null,events:[{kind:'narration',text:'x'}]}]}).line));assert.ok(seen.size>=2);
// ---- The greeting is a turn of its own: no words put in the player's mouth ----
const opening=said(game),talk={question:opening.scene,narration:opening.aside,dialogue:[{speakerId:first.id,text:opening.line}],trigger:true,npcId:first.id};
const turn=r.commitDmTurn(hero,game,null,null,talk,()=>.5);assert.ok(!turn.error,turn.error);
const recorded=r.recordedTurn(hero,game,null,turn,turn.conversation??talk,first.id);
assert.deepEqual(JSON.parse(JSON.stringify(recorded.turn.events.map(e=>e.kind))),['action','narration','dialogue']);assert.equal(recorded.turn.events[0].text,opening.scene);assert.equal(recorded.turn.events[2].speakerId,first.id);assert.equal(recorded.turn.events[2].text,opening.line);
assert.ok(!recorded.turn.events.some(e=>e.kind==='player'));assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(recorded.game)),null,true),hero));
assert.equal(r.shouldGreet(recorded.game,first.id),false,'Having greeted, they wait for an answer');
// ---- Written by the game, never asked of the Dungeon Master (the host, 2026-10-22) ----
// Every line and aside is short, plain and in our own words; asides name the person and, at a table, never say "you".
for(const [,lines] of [...r.greetingRoles,...r.greetingRoleAsides])for(const line of lines){assert.ok(line.length>=8&&line.length<=120,line);assert.ok(!/[‘’“”]/.test(line),line);}
for(const line of r.greetingHomes)assert.ok(line.includes('{place}')&&line.length<=120,line);
for(const [mood,asides] of Object.entries(r.greetingAsides)){assert.ok(r.greetingPools[mood],'an aside for every mood: '+mood);for(const a of asides){const [solo,table=solo]=a.split('|');assert.ok(solo.includes('{name}')&&!/[‘’“”]/.test(a),a);assert.ok(!/\byou\b|\byour\b/i.test(table),'a table aside names the hero: '+a);}}
for(const mood of Object.keys(r.greetingPools))assert.ok(r.greetingAsides[mood],'every mood has asides: '+mood);
assert.ok(Object.values(r.greetingPools).reduce((n,l)=>n+l.length,0)>=80,'enough lines that greetings do not feel canned');
// The aside names who is speaking; a greeting carries no request for the Dungeon Master.
assert.ok(plain.aside.includes(name),plain.aside);assert.equal('cue' in plain,false,'no cue: nothing is asked of the Dungeon Master');
// Someone who has talked with the hero before greets them as someone known.
const talked={...game,playback:[{id:3,npcId:first.id,events:[{kind:'dialogue',speakerId:first.id,text:'We have met.'}]},{id:4,npcId:null,events:[{kind:'narration',text:'Time passes.'}]},{id:5,npcId:null,events:[{kind:'narration',text:'More time.'}]}]};
assert.equal(said(talked).mood,'again');
// What they do and where they live colour it: a smith speaks of mending, someone at home names the place.
const smithy={...game,story:{...game.story,npcs:{...game.story.npcs,[first.id]:{...game.story.npcs[first.id],role:'The village blacksmith'}}}};
const smithLines=new Set(Array.from({length:30},(_,i)=>said({...smithy,playback:[{id:i+10,npcId:null,events:[{kind:'narration',text:'x'}]}]}).line));
assert.ok([...smithLines].some(l=>r.greetingRoles.find(([re])=>re.test('blacksmith'))[1].includes(l)),'a smith now and then greets as a smith: '+JSON.stringify([...smithLines]));
assert.ok(smithLines.size>=5,'and the lines vary from turn to turn: '+smithLines.size);
const smithAsides=new Set(Array.from({length:30},(_,i)=>said({...smithy,playback:[{id:i+10,npcId:null,events:[{kind:'narration',text:'x'}]}]}).aside));assert.ok([...smithAsides].some(a=>/hammer|soot/.test(a)),JSON.stringify([...smithAsides]));
// A friend may use the hero's name; the placeholder is never shown.
const friend={...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'friendly',memories:[]}}};
const friendLines=Array.from({length:40},(_,i)=>said({...friend,playback:[{id:i+1,npcId:null,events:[{kind:'narration',text:'x'}]}]}).line);
assert.ok(friendLines.every(l=>!l.includes('{hero}')),'the placeholder is always filled');assert.ok(friendLines.some(l=>l.includes(hero.name.split(' ')[0])),'a friend now and then says the hero\'s name');
// Nobody greets with a line of their own from earlier in the tale while they have others left.
{let g=game;const own=[];for(let i=0;i<6;i++){const o=said(g);own.push(o.line);g={...g,playback:[...(g.playback??[]),{id:100+i,npcId:first.id,events:[{kind:'action',text:o.scene},{kind:'narration',text:o.aside},{kind:'dialogue',speakerId:first.id,text:o.line}]},{id:200+i,npcId:null,events:[{kind:'narration',text:'a'}]},{id:300+i,npcId:null,events:[{kind:'narration',text:'b'}]}]};}
 assert.equal(new Set(own).size,own.length,'six greetings, six different lines: '+JSON.stringify(own));}
// At a table of several heroes the aside names the hero instead of saying "you".
{const kara=r.readyHero('wizard');let party=r.startParty(r.adventureSnapshot(hero,game,null,true),'A','Al');party=r.joinParty(party,'B',{character:JSON.stringify(kara),game:r.newAdventure(kara),health:null,name:'Bo'}).snapshot;
 const view=r.partyView(party,'A').game,asides=Array.from({length:30},(_,i)=>r.greeting({...view,playback:[{id:i+1,npcId:null,events:[{kind:'narration',text:'x'}]}]},first.id,hero).aside);
 assert.ok(asides.every(a=>!/\byou\b|\byour\b/i.test(a)),JSON.stringify(asides));assert.ok(asides.some(a=>a.includes(hero.name.split(' ')[0])),'and now and then names them: '+JSON.stringify(asides));}
// Coming back to the starting place and the morning after a rest are written greetings too; the other cues are not.
assert.deepEqual([...r.writtenCues],['return-inn','rest']);
for(const kind of ['return-inn','rest']){const c=r.cueGreeting(game,first.id,kind);assert.ok(c.line.length>=8&&c.aside.includes(name),JSON.stringify(c));}
assert.equal(r.cueGreeting(game,first.id,'victory'),null);assert.equal(r.cueGreeting(game,first.id,'wake'),null);
{const cold={...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'hostile',memories:[],grudge:'You killed my brother.'}}};assert.ok(!/worry|Sit down|fire is still/.test(r.cueGreeting(cold,first.id,'return-inn').line),'someone set against the hero is not glad to see them back');}
// Device and campaign server: no request for a greeting.
{const t=fs.readFileSync('useDmTurn.js','utf8'),engage=t.slice(t.indexOf('const engage='),t.indexOf('// Turns that arrive from other players'));assert.ok(!/post\(/.test(engage),'the Speak chip asks the Dungeon Master nothing');assert.ok(engage.includes('text:opening.line'));
 assert.ok(/const written=!!cue\.written&&speaker\?\.id===cue\.speakerId;/.test(t)&&t.includes('if(connected&&speaker&&!written)'),'a written cue asks nothing either');
 const s=fs.readFileSync('server-turn.cjs','utf8');assert.ok(/if\(greet\)return finish\(null,\{narration:opening\.aside,dialogue:\[\{speakerId:target,text:opening\.line\}\]/.test(s),'nor does the campaign server');}
// ---- Things the player might say next (the Suggestions tab's stand-in) ----
const ideas=(g,id=null)=>JSON.parse(JSON.stringify(r.replyIdeas(g,hero,id)));
const goodLine=t=>typeof t==='string'&&t.length>=8&&t.length<=110&&!/[‘’“”]/.test(t)&&!/^(?:DM\b|\(?ooc)/i.test(t)&&!/^["']/.test(t);
const grudging={...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'hostile',response:'Holds a grudge.',memories:[],grudge:'The player killed my friend.'}}};
for(const g of [grudging,game,{...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'hostile',response:'Cold.',memories:[]}}},{...game,followers:{[first.id]:{status:'following',location:'inn'}}},{...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'indifferent',response:'Civil.',memories:[],forgave:pardon}}}]){
 const lines=ideas(g,first.id);assert.ok(lines.length>=2&&lines.length<=3,JSON.stringify(lines));assert.equal(new Set(lines).size,lines.length);for(const t of lines)assert.ok(goodLine(t),t);
}
assert.ok(ideas(grudging,first.id).some(t=>/set this right|what I did|leave you be|excuses/.test(t)),'A grudge-holder is offered amends, not small talk');
const neutral=ideas(game,first.id);assert.ok(neutral.includes('What do you know about '+game.story.foe+'?'),JSON.stringify(neutral));assert.equal(neutral.length,3);
// Different people are offered different things to say to them (their role, whether they live here), and with several
// people here the ideas speak to two of them, by name.
assert.notDeepEqual(ideas(game,first.id),ideas(game,second.id),'Two people are not offered the same three lines');
const around=ideas(game),firstName=n=>n.split(' ').filter(w=>!/^(?:captain|lady|lord|sir|dame|master|mistress|old|elder|brother|sister|father|mother|doctor|healer|aunt|uncle|young)$/i.test(w))[0];
assert.ok(/^I ask \S+ what is going on here\.$/.test(around[0]),JSON.stringify(around));assert.ok(/^I ask \S+ (?:what they know about|who else)/.test(around[1]),JSON.stringify(around));
assert.notEqual(around[0].split(' ')[2],around[1].split(' ')[2],'The two ideas speak to two different people');assert.ok(around.includes('I look around.'));
const lonely={...game,people:{},npcMemory:{}};const one=ideas({...lonely,stage:'inn',story:{...game.story}},null);assert.ok(one.length>=2);
// ---- Two people greeting in one scene never say the same words ----
const present=r.npcScene(game).filter(n=>n.present).map(n=>n.id);assert.ok(present.length>=2);
for(const attitude of ['friendly','indifferent','unfriendly']){
 const alike={...game,npcMemory:Object.fromEntries(present.map(id=>[id,{attitude,response:'Same mood.',memories:[]}]))};
 const lines=present.map(id=>r.greeting(alike,id,hero).line);assert.equal(new Set(lines).size,lines.length,attitude+': '+JSON.stringify(lines));
 const table=r.standInGreetings(alike,hero);assert.deepEqual(present.map(id=>table[id].line),lines);
}
// Nor repeat a line said in the last turn.
const heard=r.greeting(game,first.id,hero).line,after={...game,playback:[{id:7,npcId:null,events:[{kind:'dialogue',speakerId:second.id,text:heard}]}]};
assert.notEqual(r.greeting(after,first.id,hero).line,heard,'A line just said by someone else is not said again');
const alone=ideas({...game,stage:'bridge'});assert.ok(alone.includes('I look around.'));assert.ok(alone.some(t=>/^I head toward .+\.$/.test(t)),JSON.stringify(alone));for(const t of alone)assert.ok(goodLine(t),t);
for(const g of [{...game,stage:'combat',enemyHP:5},{...game,npcCombat:{active:true}},{...game,stage:'dying'},{...game,stage:'dead'},{...game,pendingSpell:{id:'x'}}])assert.deepEqual(ideas(g,first.id),[]);
const varied=new Set(Array.from({length:12},(_,i)=>ideas({...grudging,playback:[{id:i+1,npcId:null,events:[{kind:'narration',text:'x'}]}]},first.id).join('|')));assert.ok(varied.size>=2,'The picks change from turn to turn');
// ---- In a brawl the people fighting may still speak (no conversation screen, but words) ----
const brawl=r.adventureStep(game,{current:40,temp:0},hero,{type:'npc-attack',target:first.id,weapon:'Greatsword'},()=>0.02);
assert.equal(brawl.error,undefined,brawl.error);assert.equal(brawl.game.npcCombat?.active,true);
assert.deepEqual(JSON.parse(JSON.stringify(r.conversationPeople(brawl.game))),[]);assert.ok(r.speakingPeople(brawl.game).some(n=>n.id===first.id&&n.name===name),'The one you are fighting can shout back');
assert.deepEqual(JSON.parse(JSON.stringify(r.speakingPeople({...game,stage:'combat',enemyHP:5}))),[]);assert.deepEqual(r.speakingPeople(game).map(n=>n.id),people.map(n=>n.id));
console.log('Passed: things to say next stand in for the Dungeon Master (fitting a grudge, coldness, a companion, forgiveness or a plain talk; never in a fight), people in a brawl may speak, and someone who forgave you greets you civilly.');
// ---- Someone met for the first time shows what they are after (the stories spec, Phase A8, 2026-10-22) ----
// The game's written greeting took the place of the Dungeon Master's, which was where a person's agenda surfaced: the
// aside now carries their hook (its first clause) or their motive, with no request; never once they have talked with the
// hero, never from someone set against them, never "you".
{const agenda=r.greeting(game,first.id,hero).aside;assert.ok(/ is plainly hoping to /.test(agenda),'a first meeting carries the motive: '+agenda);
 const talked={...game,playback:[{id:7,npcId:first.id,events:[{kind:'dialogue',speakerId:first.id,text:'We have met.'}]},{id:8,npcId:null,events:[{kind:'narration',text:'Time passes.'}]}]};
 assert.ok(!/plainly/.test(r.greeting(talked,first.id,hero).aside),'not once they have talked');
 assert.ok(!/plainly/.test(r.greeting({...game,npcMemory:{...game.npcMemory,[first.id]:{attitude:'hostile',memories:[]}}},first.id,hero).aside),'not from the hostile');
 const lib={...game,people:{...(game.people??{}),n1:{name:'Elaris Venn',role:'Shrine grave-keeper',motive:'They want to learn why one grave is tended.',hook:'A missing villager\'s grave is being tended in secret, and Elaris cannot report it without exposing their own part.',home:game.world?.at??'inn',appearance:'A thin figure in a grey shawl.',species:'Human',gender:'other',personality:'Quiet.'}}};
 assert.equal(r.greetingAgenda(lib,'n1'),'Something is plainly on Elaris\'s mind: a missing villager\'s grave is being tended in secret.','a library person\'s hook, its first clause');
 const motive=m=>r.greetingAgenda({...game,story:{...game.story,npcs:{...game.story.npcs,[first.id]:{...game.story.npcs[first.id],motive:m}}}},first.id);
 assert.match(motive('Find her brother before the frost.'),/ is plainly hoping to find her brother before the frost\.$/);assert.match(motive('He wants to sell enough maps to go home.'),/hoping to sell enough maps to go home\.$/);
 for(const m of ['Mend.','Wants the road safe.','Why should I help you?','Keep you safe.'])assert.equal(motive(m),'','no agenda from '+m);
 for(const [id,p] of Object.entries(lib.people))assert.ok(!/\byou\b/i.test(r.greetingAgenda(lib,id)));}
console.log('Passed: people speak first when turned to (never in a fight, never twice running), the line is written by the game (no request) and fits a grudge, hostility, friendship, a companion or their view of the hero\'s kind, and the greeting is saved as a turn without putting words in the player\'s mouth.');
