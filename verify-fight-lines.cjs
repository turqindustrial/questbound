// Routine fight moves told by the game (fightLines.js): which moves need the Dungeon Master and which the game tells
// itself, the line book (every case, every narrator, at least twelve ways), spoken lines for those who fight, seeded and
// never repeated within a fight, no numbers or rule words in any line, and both paths (a device alone, the campaign
// server at a table) making no request for a routine move while still asking for the notable ones.
// Synthetic heroes and a stand-in Dungeon Master only: no network, no AI.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {rulesSource,readText}=require('./rules-files.cjs');
const x=vm.runInNewContext(rulesSource({extra:['worldArtRules.js']})+'\n({readyHero,readyHeroes,newAdventure,hostileEncounterGame,adventureStep,quickActions,attackActions,dmCommand,combatBasics,settleTurn,withAttackIntent,validAdventure,adventureSnapshot,npcScene,routineFightTurn,fightTelling,routineTelling,fightLineBook,fightBarks,fightLineCases,plainFightWords,fightRoundKey,fightCadence})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const seq=(...v)=>{let i=0;return ()=>v[i++]??0.5;};
const lcg=(s=7)=>{s=(s*2654435761)%2147483647||1;return ()=>(s=(s*16807)%2147483647)/2147483647;};
const kara=x.readyHero('fighter'),max=x.combatBasics(kara).hp,full={current:max,temp:0};
// A long fight against a sturdy bandit: no kill and no foe badly hurt from a single blow.
const sturdy=(hp=400,at=hp)=>{const g=x.hostileEncounterGame(kara,x.newAdventure(kara),()=>0);return {...g,openingAttackAvailable:false,enemyHP:at,story:{...g.story,foeStats:{...g.story.foeStats,maximum:hp}}};};
const step=(g,h,action,words,random=()=>0.5)=>{const rolled=[];const preview=x.adventureStep(x.withAttackIntent(g,words),h,kara,action,()=>{const v=random();rolled.push(v);return v;});assert.equal(preview.error,undefined,preview.error);return {preview,rolled,verdict:x.routineFightTurn(g,preview.game,action,words,{hero:kara,health:h,afterHealth:preview.health,events:preview.events,waiting:!!preview.waiting})};};
const routine=(why,...a)=>{const {verdict}=step(...a);assert.equal(verdict.routine,true,why+': '+verdict.why);};
const notable=(why,expect,...a)=>{const {verdict}=step(...a);assert.equal(verdict.routine,false,why+' should go to the Dungeon Master');if(expect)assert.match(verdict.why,expect,why);};
// Settle a turn as a device does: the game's telling for a routine move, a stand-in Dungeon Master's otherwise.
const settle=(g,h,action,words,random=()=>0.5,prefs={})=>{const {preview,rolled}=step(g,h,action,words,random);const told=x.routineTelling({hero:kara,before:g,preview,health:h,action,words,preferences:prefs});let i=0;
 const s=x.settleTurn({hero:kara,game:g,health:h,action,conversation:{question:words,narration:told?.narration??'The Dungeon Master tells it.',dialogue:told?.dialogue??[],...(told?{told:'game',fightRound:told.fightRound}:{})},random:()=>rolled[i++]??0.5});
 assert.equal(s.error,undefined,s.error);assert.ok(x.validAdventure(x.adventureSnapshot(kara,plain(s.result.game),s.result.health,true),kara),'the turn keeps the save valid');return {...s.result,told};};

// ---- 1. Routine moves: the game tells them ----
const big=sturdy();
routine('a plain attack that lands',big,full,'attack:Greatsword','I attack with my Greatsword.');
routine('a plain attack that misses',big,full,'attack:Greatsword','I attack with my Greatsword.',seq(0.06));
routine('the Dodge',big,full,'dodge','I take the Dodge action.');
routine('ending the turn',big,full,'end-turn','I end my turn.');
routine('a typed plain attack',big,full,'attack:Greatsword','I attack');
routine('a thrown javelin',big,full,'throw:Javelin','I throw my javelin at the Bandit Cutthroat.');
const hurt={current:5,temp:0};
routine('a healing draught',big,hurt,'potion','I drink a healing draught.');
routine('Second Wind',big,hurt,'class:wind','I use Second Wind.');
for(const c of x.quickActions(kara,big,hurt).filter(c=>['attack:Greatsword','dodge','end-turn','potion','class:wind'].includes(c.action)))assert.ok(x.plainFightWords(c.question),'the chip sentence is a plain move: '+c.question);
for(const c of x.attackActions(kara,big,full,null).filter(c=>typeof c.action==='string'&&/^(?:attack|throw):/.test(c.action)))assert.ok(x.plainFightWords(c.question),'the Attack… sentence is a plain move: '+c.question);
assert.ok(x.plainFightWords('I cast Fire Bolt at the enemy.')&&x.plainFightWords('I fight to hold on.')&&x.plainFightWords('I strike with the dagger in my other hand.'));
// A death save, failed or made, is routine; a natural 1 or 20 is not.
const fallen=step(big,{current:1,temp:0},'end-turn','I end my turn.',()=>0.95);assert.equal(fallen.preview.game.stage,'dying');assert.equal(fallen.verdict.routine,false,'the hero falling goes to the Dungeon Master');
const dying=fallen.preview.game,down={current:0,temp:0};
routine('a death save made',dying,down,'death-save','I fight to hold on.',()=>0.6);
routine('a death save failed',dying,down,'death-save','I fight to hold on.',()=>0.3);
notable('a natural 20 on a death save',null,dying,down,'death-save','I fight to hold on.',()=>0.99);
notable('a natural 1 on a death save',null,dying,down,'death-save','I fight to hold on.',()=>0.01);

// ---- 2. Notable moves: the Dungeon Master tells them ----
notable('the first move of a fight',/begins/,{...big,openingAttackAvailable:true},full,'attack:Greatsword','I attack with my Greatsword.');
notable('a critical hit',/critical/,big,full,'attack:Greatsword','I attack with my Greatsword.',seq(0.99));
notable('a natural 1',/natural 1/,big,full,'attack:Greatsword','I attack with my Greatsword.',seq(0.01));
notable('the blow that ends the fight',/fight turns/,sturdy(400,3),full,'attack:Greatsword','I attack with my Greatsword.');
notable('a foe dropping below half',/badly hurt/,sturdy(400,205),full,'attack:Greatsword','I attack with my Greatsword.');
const pack=(()=>{const g=x.hostileEncounterGame(kara,x.newAdventure(kara),()=>0.23);assert.equal(g.story.foeStats.group.size,3,'the goblin pack');return {...g,openingAttackAvailable:false};})();
notable('one of a pack cut down',/kill|falls/,pack,full,'attack:Greatsword','I attack with my Greatsword.',seq(0.5,0.9,0.9));
{const {preview}=step(big,full,'end-turn','I end my turn.');const joined={...preview.game,foeAllies:[{name:'Grey Wolf',template:'wolves',hp:9,maximum:9}]};
 assert.match(x.routineFightTurn(big,joined,'end-turn','I end my turn.',{hero:kara,health:full,afterHealth:preview.health,events:preview.events}).why,/joins/,'a second creature joining goes to the Dungeon Master');
 assert.match(x.routineFightTurn(big,preview.game,'end-turn','I end my turn.',{hero:kara,health:full,afterHealth:preview.health,events:preview.events,waiting:true}).why,/ruling/,'a spell needing a ruling goes to the Dungeon Master');}
for(const words of ['I attack while shouting a challenge.','I attack and then shove him.','Can I attack?','I go for the eyes with my sword.','"Yield!" I attack.','I grab the torch and swing it.'])notable('typed words that are more than a plain move: '+words,/words/,big,full,'attack:Greatsword',words);
notable('a trick (grapple)',/plain move/,big,full,'grapple','I grapple the Bandit Cutthroat.');
notable('fleeing',/plain move/,big,full,'flee','I retreat from the fight.');
notable('not in a fight',/not in a fight/,{...big,stage:'inn'},full,'attack:Greatsword','I attack with my Greatsword.');

// ---- 3. Every few rounds the Dungeon Master tells one, so the story keeps breathing ----
{let g=big,h=full;const told=[];
 for(let i=0;i<12;i++){const s=settle(g,h,'end-turn','I end my turn.',()=>0.06);told.push(!!s.told);g=s.game;h=s.health;}
 assert.deepEqual(told.slice(0,6),[true,true,false,true,true,false],'two rounds told by the game, then one by the Dungeon Master');
 assert.equal(g.playback.at(-1).told,undefined,'a Dungeon Master turn carries no mark');assert.equal(g.playback.at(-2).told,'game');assert.match(g.playback.at(-2).fightRound,/^r:\d+$/);
 assert.equal(x.fightCadence,3);}
// A round that pauses for a bonus action is one round, whatever number of turns it takes.
{let g=big,h=hurt;const a=settle(g,h,'attack:Greatsword','I attack with my Greatsword.',()=>0.06);assert.ok(a.told&&a.game.actionUsed,'the attack pauses for a bonus action');
 const b=settle(a.game,a.health,'class:wind','I use Second Wind.',()=>0.06);assert.ok(b.told);assert.equal(a.told.fightRound,b.told.fightRound,'the same round');}

// ---- 4. The line book: every case has plenty of ways, in every voice ----
const voices=Object.keys(x.fightLineBook);assert.deepEqual(voices,['chronicler','lamplighter','bard'],'one book per narrator (storyPreferences.js narrators)');
const shape=v=>JSON.stringify(v,(k,val)=>Array.isArray(val)?'list':val);for(const id of voices)assert.equal(shape(x.fightLineBook[id]),shape(x.fightLineBook.chronicler),id+' covers the same cases');
const cases=x.fightLineCases();assert.ok(cases.length>=3*60,'every case is counted');
for(const c of cases)assert.ok(c.count>=12,c.narrator+' has only '+c.count+' ways to tell "'+c.case+'"');
for(const kind of ['taunt','hurt','band','beast','undead','monster','cheer','wince','warn'])assert.ok(x.fightBarks[kind].length>=12,'spoken lines for '+kind);
const raw=[];const walk=(v,where)=>{if(Array.isArray(v))v.forEach((s,i)=>raw.push([where,s,i]));else if(v&&typeof v==='object')for(const [k,w] of Object.entries(v))walk(w,where+'.'+k);};walk(x.fightLineBook,'book');walk(x.fightBarks,'barks');
// A line and its twin told of the hero by name at a table of several heroes ('You cut.|{hero} cuts.'); '!' marks both.
const formsOf=s=>{const at=s.indexOf('|');return at<0?[s]:[s.slice(0,at),(s.startsWith('!')?'!':'')+s.slice(at+1)];};
const every=raw.flatMap(([where,s])=>formsOf(s).map((f,i)=>[i?where+' (told of the hero)':where,f]));
assert.ok(raw.length>900,'a large library ('+raw.length+' lines)');
const counted=/\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|hundred|dozen)\b/i,rulesWords=/\b(?:HP|hit points?|damage|dice|die|d20|rolls?|rolled|AC|armou?r class|bonus action|reaction|advantage|disadvantage|initiative|round|slot|saving throw|saves?|proficiency|modifier|critical|crit|luck|lucky|unlucky|fortune|fortunate|reroll|spared|mercy|turn order|second wind|action surge|slain|kills?|killed|lifeless)\b/i;
for(const [where,s] of every){assert.ok(!counted.test(s),where+' states a number: '+s);assert.ok(!rulesWords.test(s),where+' names a rule or a kill: '+s);assert.ok(s.length<=160,where+' is short: '+s);}
for(const twin of [false,true]){const all=raw.map(e=>formsOf(e[1])).filter(f=>!twin||f[1]).map(f=>twin?f[1]:f[0]).filter(s=>!/^!?\{Foe\} /.test(s));assert.equal(new Set(all).size,all.length,'no line is written twice'+(twin?' (told of the hero)':''));}
// ---- 4b. Told of the hero by name at a table of several heroes (the host, 2026-10-21: "make sure that when a player is
// being talked to or interacted with, that character is named instead of just saying "you"") ----
{const heroMoves=/^book\.\w+\.(?:swing|offhand|spell|dodge|end|draught|wind|surge|knack|saveUp|saveDown)\b/,you=/\b(?:you|your|yours|yourself|yourselves)\b/i,places=t=>[...t.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).filter(k=>k!=='hero').sort().join(',');
 let twins=0;
 for(const [where,s] of raw){const [line,twin]=formsOf(s),speech=/^barks\.(?:taunt|hurt|band|cheer|wince|warn)$/.test(where);
  const needs=heroMoves.test(where)||you.test(line)||(speech&&where!=='barks.band')||where==='barks.tags';
  assert.ok(!twin||!twin.includes('|'),where+': one twin a line');
  if(!needs){assert.equal(twin,undefined,where+' needs no twin: '+s);continue;}
  assert.ok(twin,where+' tells the hero\'s move or says "you", so it needs a twin told of the hero by name: '+line);twins++;
  assert.ok(twin.includes('{hero}'),where+': the twin names the hero: '+twin);
  if(!speech)assert.ok(!you.test(twin),where+': the twin never says "you": '+twin);
  assert.equal(places(twin),places(line),where+': the twin keeps the line\'s other names: '+twin);
  // Agreement: a name takes the singular verb, "they" the plural, and the twin reads as a sentence.
  assert.ok(!/(?<!\b(?:should|would|could|can|will|must|may|might|did|does|let|lets|make|makes|see|sees) )\{hero\} (?:are|have|were|do|don't|go|take|keep|hold|make|swing|strike|step|drink|wait|stand|cut|thrust|lunge|draw|throw|hurl|feel|find|give|let|put|turn|dance|weave)\b/.test(twin),where+': "{hero}" takes a singular verb: '+twin);
  assert.ok(!/\bthey (?:is|has|was|does|keeps|holds|swings|strikes|drinks|waits|stands|takes|makes|feels|finds|gives|lets|puts|turns)\b/i.test(twin),where+': "they" takes a plural verb: '+twin);
  assert.ok(/^(?:\{hero\}|\{Foe\}|\{Foes\}|\{name\}|\{spell\}|[A-Z])/.test(twin.replace(/^!/,'')),where+': the twin starts a sentence: '+twin);
  const filled=twin.replace(/\{hero\}/g,'Thalion Brightwater').replace(/\{\w+\}/g,'the bandit cutthroat');assert.ok(filled.length<=190,where+': the twin stays short: '+filled);
  assert.ok(Math.abs(twin.length-line.length)<=60,where+': the twin keeps the line\'s length: '+twin);}
 assert.ok(twins>=780,'every line about the hero has its twin ('+twins+')');}
assert.ok(!/survivalOdds|sparedBlow/.test(readText('fightLines.js')),'the hidden odds are never mentioned');

// ---- 5. Seeded: the same turn gives the same words; different turns differ ----
{const {preview}=step(big,full,'attack:Greatsword','I attack with my Greatsword.');const args={hero:kara,before:big,after:preview.game,health:full,afterHealth:preview.health,action:'attack:Greatsword',events:preview.events};
 assert.deepEqual(x.fightTelling(args),x.fightTelling(plain(args)),'the same turn, the same telling');
 const voicesSaid=voices.map(narrator=>x.fightTelling({...args,narrator}).narration);assert.equal(new Set(voicesSaid).size,3,'each narrator in their own voice');
 const later=new Set();for(let id=1;id<=30;id++)later.add(x.fightTelling({...args,before:{...big,playback:[{id,npcId:null,events:[{kind:'narration',text:'.'}]}]}}).narration);assert.ok(later.size>=20,'different turns are told differently ('+later.size+' of 30)');
 // Restrained leaves out the grittier lines.
 const fill=t=>t.slice(1).replace(/{foe}/g,'the bandit cutthroat').replace(/{Foe}/g,'The bandit cutthroat'),gritty=every.filter(e=>e[1].startsWith('!')&&!e[0].endsWith('(told of the hero)')).map(e=>fill(e[1]));assert.ok(gritty.length>=6);
 const heavy={...args,events:args.events.map(t=>t.replace(/^\d+ slashing/,'390 slashing'))};let grim=0;for(let id=1;id<=300;id++){const at={...heavy,before:{...big,playback:[{id,npcId:null,events:[{kind:'narration',text:'.'}]}]}};if(gritty.some(g=>x.fightTelling(at).narration.includes(g)))grim++;const said=x.fightTelling({...at,brutality:'restrained'}).narration;for(const g of gritty)assert.ok(!said.includes(g),'Restrained leaves out: '+g);}assert.ok(grim>0,'Gritty uses the grittier lines now and then');}

// ---- 6. No line repeats within a fight ----
{let g=big,h=full,seen=[],rand=lcg(3);
 for(let i=0;i<40;i++){const move=i%3===2||g.actionUsed?['end-turn','I end my turn.']:['attack:Greatsword','I attack with my Greatsword.'];const s=settle(g,h,move[0],move[1],rand);
  if(s.told){const sentences=s.told.narration.split(/(?<=[.!])\s+(?=[A-Z])/).filter(t=>!/“/.test(t));for(const t of sentences)assert.ok(!seen.slice(-4).some(prev=>prev.includes(t)),'"'+t+'" was told in the last turns');assert.ok(!seen.slice(-11).includes(s.told.narration),'the whole telling never repeats');seen.push(s.told.narration);}
  g=s.game.stage==='combat'?s.game:big;h=s.health.current>4?s.health:full;}
 assert.ok(seen.length>=15,'a long fight told mostly by the game');}

// ---- 7. People who fight speak: barks in a brawl (as the person) and from companions, always someone present ----
{let barks=0,friends=0;
 for(let k=0;k<30;k++){let g=x.newAdventure(kara),h=full;const open=x.dmCommand(kara,g,'I attack the keeper with my unarmed strike',h).action;
  let s=settle(g,h,open,'I attack the keeper with my bare hands.',lcg(k+1));assert.equal(s.told,null,'a brawl\'s first blow goes to the Dungeon Master');g=s.game;h=s.health;
  for(let i=0;i<8&&g.npcCombat?.active;i++){s=settle(g,h,i%2?'npc-dodge':'npc-wait',i%2?'I take the Dodge action.':'I wait.',lcg(k*13+i+2));
   if(s.told)for(const d of s.told.dialogue){barks++;assert.ok(x.npcScene(g).some(n=>n.id===d.speakerId),'a bark comes from someone here');assert.ok(s.turn.events.some(e=>e.kind==='dialogue'&&e.text===d.text),'and is shown as their line');}
   g=s.game;h=s.health.current>3?s.health:full;}}
 assert.ok(barks>=5,'people in a brawl speak ('+barks+')');
 // A companion at the hero's side calls out in a creature fight.
 for(let k=0;k<40;k++){const g={...big,followers:{mara:{status:'following',location:'bridge',reason:'She came along.',terms:'Share the road.'}},foeScale:{f:1.25,key:'story'},playback:[{id:k+1,npcId:null,events:[{kind:'narration',text:'.'}]}]};if(!x.npcScene(g).some(n=>n.id==='mara'&&n.present))continue;
  const s=settle(g,full,'attack:Greatsword','I attack with my Greatsword.',lcg(k+50));if(s.told?.dialogue.some(d=>d.speakerId==='mara'))friends++;}
 assert.ok(friends>=3,'a companion calls out now and then ('+friends+')');}

// ---- 8. The campaign server: no request for a routine move, a request for a notable one, the same words ----
(async()=>{
 const never=async()=>{throw Error('A routine move must not ask the Dungeon Master.');};
 const snap=r.adventureSnapshot(kara,big,full,true);
 const one=await resolveTurn(snap,{question:'I attack with my Greatsword.',action:'attack:Greatsword',storyPreferences:{narrator:'lamplighter'}},{ask:never,randomImpl:()=>0.5});
 assert.equal(one.turn.told,'game','the server marks the game-told turn');assert.ok(one.turn.events.some(e=>e.kind==='narration'&&e.text===one.narration),'and shows the telling in the feed');
 const device=step(big,full,'attack:Greatsword','I attack with my Greatsword.',()=>0.5);
 assert.equal(one.narration,x.routineTelling({hero:kara,before:big,preview:device.preview,health:full,action:'attack:Greatsword',words:'I attack with my Greatsword.',preferences:{narrator:'lamplighter'}}).narration,'the device and the server tell it in the same words');
 assert.deepEqual(one.suggestions,[],'no ideas are needed in a fight');
 let asked=0;const ask=async()=>{asked++;return {narration:'A mighty blow.',suggestions:[]};};
 await resolveTurn(snap,{question:'I attack with my Greatsword.',action:'attack:Greatsword'},{ask,randomImpl:seq(0.99)});assert.equal(asked,1,'a critical hit asks the Dungeon Master');
 await resolveTurn(snap,{question:'I attack with my Greatsword and roar at it.',action:'attack:Greatsword'},{ask,randomImpl:()=>0.5});assert.equal(asked,2,'the player\'s own words ask the Dungeon Master');
 await resolveTurn(r.adventureSnapshot(kara,{...big,openingAttackAvailable:true},full,true),{question:'I attack with my Greatsword.',action:'attack:Greatsword'},{ask,randomImpl:()=>0.5});assert.equal(asked,3,'the first move asks the Dungeon Master');
 // A whole long fight at the table: most moves are told by the game.
 let s=r.adventureSnapshot(kara,big,full,true),calls=0;const count=async()=>{calls++;return {narration:'The fight goes on.',suggestions:[]};};const rand=lcg(9);
 for(let i=0;i<24;i++){const move=i%3===2||s.game.actionUsed?{question:'I end my turn.',action:'end-turn'}:{question:'I attack with my Greatsword.',action:'attack:Greatsword'};const out=await resolveTurn(s,move,{ask:count,randomImpl:rand});s=out.snapshot;if(s.health&&s.health.current<5)s={...s,health:full};}
 assert.ok(calls<=12,'at the table the Dungeon Master tells at most half of a long fight ('+calls+' of 24)');assert.ok(calls>=4,'and still tells some of it ('+calls+')');

 // ---- 9. A device: the cast path asks for a telling before it would ask the Dungeon Master ----
 const dm=['DungeonMaster.js','useDmTurn.js','dmTurnRules.js'].map(readText).join(' '),branch=dm.slice(dm.indexOf("else {let body={narration:narration??command.narration"));
 assert.ok(/import \{routineTelling\} from '\.\/fightLines';/.test(dm),'DungeonMaster.js uses the shared rule');
 assert.ok(branch.indexOf('routineTelling(')>=0&&branch.indexOf('routineTelling(')<branch.indexOf('await request('),'a routine move is told before any request');
 assert.ok(/else if\(connected&&protocol>=3\)(?:\{[^\n]*?)?body=await request\(/.test(branch),'and only a move that is not routine asks the Dungeon Master');
 assert.ok(/told:'game',fightRound:body\.fightRound/.test(dm),'the device marks the game-told turn as the server does');
 assert.ok(/r\.routineTelling\(/.test(readText('server-turn.cjs')),'server-turn.cjs uses the same rule');

 // ---- 10. The saving: how many fight moves the game tells itself ----
 const share=(scale)=>{let all=0,told=0;
  for(const e of x.readyHeroes){const hero=x.readyHero(e.key),most=x.combatBasics(hero).hp;
   for(let k=0;k<10;k++){let g=x.hostileEncounterGame(hero,x.newAdventure(hero),()=>k/10);if(scale>1){const m=Math.round(g.enemyHP*scale);g={...g,enemyHP:m,story:{...g.story,foeStats:{...g.story.foeStats,maximum:m,...(g.story.foeStats.group?{group:{...g.story.foeStats.group,memberHP:Math.round(g.story.foeStats.group.memberHP*scale)}}:{})}}};}
    let h={current:most,temp:0};const rand=lcg(k*31+7);
    for(let i=0;i<40&&['combat','dying'].includes(g.stage);i++){const chips=x.quickActions(hero,g,h).filter(c=>c.action&&!['flee','grapple','shove'].includes(c.action)&&!/^(?:loot|travel)/.test(String(c.action)));const c=chips.find(c=>/^(?:attack|death-save)/.test(String(c.action)))??chips[0];if(!c)break;
     const rolled=[];const preview=x.adventureStep(x.withAttackIntent(g,c.question),h,hero,c.action,()=>{const v=rand();rolled.push(v);return v;});if(preview.error)break;
     const t=x.routineTelling({hero,before:g,preview,health:h,action:c.action,words:c.question});all++;if(t)told++;let j=0;
     const s=x.settleTurn({hero,game:g,health:h,action:c.action,conversation:{question:c.question,narration:t?.narration??'The Dungeon Master tells it.',dialogue:t?.dialogue??[],...(t?{told:'game',fightRound:t.fightRound}:{})},random:()=>rolled[j++]??0.5});assert.equal(s.error,undefined,s.error);g=s.result.game;h=s.result.health;}}}
  return {all,told,share:told/all};};
 const skirmish=share(1),long=share(3);
 assert.ok(skirmish.share>=0.3,'the game tells a fair share of a short skirmish ('+skirmish.share.toFixed(2)+')');assert.ok(long.share>=0.45,'and most of a long fight ('+long.share.toFixed(2)+')');
 console.log('Passed: routine fight moves (attacks, the Dodge, ending a turn, draughts, Second Wind, death saves, throws) told by the game with no request; first moves, kills, critical hits, natural 1s, a foe badly hurt, a creature joining, spell rulings, tricks, the player\'s own words and every '+x.fightCadence+'rd round go to the Dungeon Master; '+every.length+' lines in three voices, every case at least twelve ways, spoken lines in brawls and from companions, seeded and unrepeated, no numbers or rule words; the same words on a device and at the table. Share told by the game: skirmishes '+(100*skirmish.share).toFixed(0)+'% of '+skirmish.all+' moves, long fights '+(100*long.share).toFixed(0)+'% of '+long.all+'.');
})().catch(e=>{console.error(e);process.exit(1);});
