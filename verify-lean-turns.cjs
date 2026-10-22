// Leaner turns, round 3 (2026-10-21, the host: "the lowest possible cost per turn"): suggestions only when they will
// be seen (suggestionPanel.js, suggestionNote), a telling that reads only what a telling can use (tellingOnly in
// dm-server.cjs), a scene cue read once (its words in the turn's note, no rules reference from the game's own words),
// and spells and features named by the player's words only as whole words. The standing prompt and the reply schema
// stay byte for byte the same; every check on the reply still reads the whole context. Stand-in provider only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {generate,requestParts,requestScene,standingPrompt,replySchemaFor}=require('./dm-server.cjs');
const {suggestionNote}=require('./dm-instructions.cjs'),{rulesFor}=require('./dm-rules.cjs');
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs'),{journeyStory}=require('./journey-fixtures.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));const seq=(s=11)=>()=>(s=(s*16807)%2147483647)/2147483647;
const reply=o=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({narration:'It happens.',dialogue:[],effects:[],suggestions:[],...o})}]}]})});
async function requestOf(body,o={}){let q=null;await generate(plain(body),{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{q=q??JSON.parse(opt.body);return reply(o);}});return q;}
const tailOf=q=>{const last=q.input.at(-1);return last.role==='developer'&&q.input.length>2?last.content:'';};
(async()=>{
 // Bodies as the campaign server sends them (the same context a device sends).
 const asked=[];let replies=[];const ask=async p=>{asked.push(plain(p));return replies.shift()??{narration:'It happens.',dialogue:[],suggestions:[]};};
 const kara=r.readyHero('fighter'),g=plain(r.freshStoryGame(kara,journeyStory(0),r.newAdventure(kara))),snap=r.adventureSnapshot(kara,{...g,map:{...g.map,accepted:true}},null,true);
 await resolveTurn(snap,{question:'I look around the market.',suggest:false},{ask,randomImpl:seq(7)});const closed=asked.pop();
 await resolveTurn(snap,{question:'I look around the market.'},{ask,randomImpl:seq(7)});const open=asked.pop();
 assert.equal(closed.context.suggest,false,'the campaign server passes on the acting player\'s closed panel');assert.equal('suggest' in open.context,false,'and nothing while it is open');

 // ---- 1. Suggestions only when they will be seen ----
 const qClosed=await requestOf(closed),qOpen=await requestOf(open);
 assert.match(tailOf(qClosed),/SUGGESTIONS THIS TURN: none \(the player keeps them closed\): suggestions \[\]\./,'a closed panel: the turn\'s note asks for none');
 assert.ok(!/SUGGESTIONS THIS TURN/.test(tailOf(qOpen)),'an open panel: suggestions as ever');
 assert.equal(qClosed.instructions,qOpen.instructions,'the standing prompt is the same either way');assert.deepEqual(qClosed.text.format.schema,qOpen.text.format.schema,'and the schema');
 assert.equal('suggest' in requestScene(qClosed).context,false,'the flag is not read with the scene');
 assert.ok(standingPrompt.includes('SUGGESTIONS: ')&&!standingPrompt.includes('SUGGESTIONS THIS TURN'),'the standing SUGGESTIONS rule is kept, the note is not in it');
 assert.equal(suggestionNote({context:{suggest:false,stage:'combat'}}),'','in a fight the Say tab shows them: asked for');
 assert.equal(suggestionNote({context:{suggest:false,stage:'inn',npcCombat:{active:true}}}),'','in a brawl too');
 assert.equal(suggestionNote({context:{suggest:false,stage:'inn',turnOrder:{order:[]}}}),'','and in a party\'s turn order');
 assert.equal(suggestionNote({context:{suggest:false,stage:'inn',outOfCharacter:{canRewind:false}}}),'','out of character none are asked for anyway');
 // The narrator's voice stays the very last thing the model reads.
 {const q=await requestOf({...closed,context:{...closed.context,storyPreferences:{narrator:'bard'}}});assert.ok(/SUGGESTIONS THIS TURN[\s\S]*NARRATOR THIS TURN/.test(tailOf(q)),'the narrator\'s voice comes last');}
 // A reply that offers lines anyway keeps them (nothing is refused over it).
 {const said=await generate(plain(closed),{apiKey:'k',model:'m',fetchImpl:async()=>reply({suggestions:['I ask about the mill.']})});assert.deepEqual(said.suggestions,['I ask about the mill.']);}
 // Device and table send it from the same place (suggestionPanel.js).
 assert.ok(fs.readFileSync('useDmTurn.js','utf8').includes('extra:{...suggestionsFlag(),...extra}'),'the device sends it with every request');
 {const t=fs.readFileSync('useDmTurn.js','utf8');assert.ok(t.includes('table.turn(opening.scene,{npcId:id,greet:true,...suggestionsFlag(),')&&t.includes('table.turn(question,{npcId:target,...suggestionsFlag(),'),'both table turns carry it');}assert.ok(fs.readFileSync('useSharedTable.js','utf8').includes('...(suggest===false?{suggest:false}:{}),baseVersion'),'and the table sends it on');
 assert.ok(fs.readFileSync('server-turn.cjs','utf8').includes("...(request.suggest===false?{suggest:false}:{})"),'the campaign server keeps only false');
 {const src=fs.readFileSync('suggestionPanel.js','utf8');assert.ok(src.includes("export const panelKey='questbound.suggestions.v1'")&&src.includes('export const suggestionsClosed=()=>!loadPanel().open'),'closed means the panel the player sees is closed');}

 // ---- 2. A telling reads only what a telling can use ----
 replies=[{narration:'You lean over the ledger.',check:{skill:'Investigation',ability:'Intelligence',dc:13,mode:'normal',reason:'Reading the ledger',success:'You spot the altered entries.',failure:'The numbers swim together.',damageCount:0,damageDie:6,damageOn:'none'}}];
 await resolveTurn(snap,{question:'I study the ledger for altered entries.'},{ask,randomImpl:seq(7)});const told=asked.pop(),turn=asked.pop();
 assert.ok(told.context.engineResolved?.length,'the check is told in a second request');
 const sTurn=requestScene(await requestOf(turn)).context,sTold=requestScene(await requestOf(told)).context;
 for(const k of ['attackOptions','choices'])assert.equal(k in sTold,false,'a telling out of a fight leaves out '+k);
 assert.ok(sTurn.world.knownPlaces?.length&&!sTold.world.knownPlaces?.length,'the map beyond where the hero stands is left out');
 assert.ok(sTold.world.current&&sTold.world.canIntroduce,'where the hero stands, and whether someone new may be met, stay');
 // What lasts the tale is read as on the turn before it (the scene's first part stays the same).
 {const first=requestParts(await requestOf(told)).scene,before=requestParts(await requestOf(turn)).scene;for(const k of ['story','player','skillChecks','equipment','loadout','spellReference','quest'])assert.deepEqual(first[k],before[k],'what lasts the tale is untouched: '+k);}
 assert.ok(!sTold.now.some(l=>/set out|travel choice/.test(l)),'no journeys on offer');
 assert.deepEqual(sTold.nearbyNPCs,sTurn.nearbyNPCs,'the people here stay as they were');
 assert.ok(sTold.engineResolved&&sTold.story&&sTold.player&&sTold.inventory,'what resolved, the story, the hero and the pack stay');
 // A place the engine's lines name is kept.
 {const named={...told,context:{...told.context,engineResolved:[...told.context.engineResolved,'You travel to The Old Mill. 1.2 miles; 21 minutes pass.']}};const s=requestScene(await requestOf(named)).context;assert.ok(s.world.knownPlaces.some(l=>/^The Old Mill \[/.test(l)),'a place the telling names stays');}
 // The checks on the reply still read everything: a telling may still bring in someone new or hand over loot.
 {const out=await generate(plain(told),{apiKey:'k',model:'m',fetchImpl:async()=>reply({narration:'The numbers swim.',effects:[{loot:{gold:2,items:[],reason:'A coin under the ledger.'}}]})});assert.equal(out.loot?.gold,2,'loot in a telling is read as before');}

 // ---- 2b. A join decided in the reply is told by that reply; a hesitant one (a check) is told once rolled ----
 {const joined={narration:'Wren shoulders her pole. "Then let us go."',dialogue:[],recruitment:[{npcId:'mara',decision:'join',reason:'She wants her brother found.',terms:'',dc:null,class:'Ranger'}],suggestions:['I thank her.']};
  replies=[joined];asked.length=0;const one=await resolveTurn(snap,{question:'Wren, will you come with me to the mill?',npcId:'mara'},{ask,randomImpl:seq(7)});
  assert.equal(asked.length,1,'a join the reply decided: one request');assert.equal(one.snapshot.game.followers?.mara?.status,'following','and she follows');assert.equal(one.narration,joined.narration,'told in the reply\'s own words');
  replies=[{...joined,recruitment:[{...joined.recruitment[0],decision:'check',dc:12}]}];asked.length=0;await resolveTurn(snap,{question:'Wren, will you come with me to the mill?',npcId:'mara'},{ask,randomImpl:seq(7)});
  assert.equal(asked.length,2,'a hesitant one: the roll is told in a second request');
  assert.ok(fs.readFileSync('useDmTurn.js','utf8').includes("body.retell||fresh||body.recruitment.some(p=>p?.decision==='check')?await request("),'the device does the same');}

 // ---- 3. A scene cue is read once ----
 // (A greeting asks the Dungeon Master nothing since 2026-10-22: the game writes it. A cue the Dungeon Master still
 // tells, as a device sends it: the people here, the one who speaks first spoken to.)
 const people=r.conversationPeople(snap.game),greeter=people.find(p=>r.shouldGreet(snap.game,p.id));assert.ok(greeter);const before=asked.length;assert.equal((await resolveTurn(snap,{greet:true,npcId:greeter.id},{ask,randomImpl:seq(7)}),asked.length),before,'a greeting asks nothing');
 const cue={...open,input:'You wake at the market.',context:{...open.context,conversationWith:{id:people[0].id,name:people[0].name,role:people[0].role,oneOnOne:false},sceneTrigger:{id:'wake',cue:'The player was found lying near death and carried back to the market. They have just woken with 1 HP, weak and battered. The residents react, tell how they found the player, and ask what happened.'},recruitmentTargets:[]}};
 const qCue=await requestOf(cue),sCue=requestScene(qCue).context;
 assert.equal('sceneTrigger' in sCue,false,'the cue\'s words are in the turn\'s note, not again in the scene');assert.ok(tailOf(qCue).includes(cue.context.sceneTrigger.cue.slice(0,60)),'the note says them');
 assert.equal('rulesReference' in sCue,false,'the game\'s own words name no spell (Wren Halloway is not Hallow)');
 assert.equal('inventory' in sCue,false,'a cue hands over nothing');

 // ---- 4. Spells and features named as whole words ----
 const wiz={context:{player:{class:'Wizard',level:1},spellReference:[{name:'Shield'},{name:'Light'}]}};
 assert.deepEqual(rulesFor({...wiz,input:'I said I would aid them.'}).spells.map(s=>s.name),[],'"said" names no Aid');
 assert.deepEqual(rulesFor({...wiz,input:'We knock at the door of the lighthouse.'}).spells.map(s=>s.name),[],'a door knocked and a lighthouse name no spell the hero lacks');
 assert.deepEqual(rulesFor({...wiz,input:'I raise a Light in my palm.'}).spells.map(s=>s.name),['Light'],'a spell of the hero\'s own, named');
 assert.deepEqual(rulesFor({...wiz,input:'Can I cast Knock?'}).spells.map(s=>s.name),['Knock'],'a spell the hero lacks, when the words are about casting');
 assert.deepEqual(rulesFor({...wiz,input:'Mara says: bless you.'}).spells.map(s=>s.name),[],'"bless you" is not a casting');
 assert.equal(rulesFor({input:'I rage',context:{player:{class:'Barbarian',level:1}}}).featureDetails[0]?.name,'Rage','a feature by its whole name');
 assert.equal(rulesFor({input:'Outrageous!',context:{player:{class:'Barbarian',level:1}}}).featureDetails.length,0,'not inside another word');

 // ---- 4b. Budgets (the same rough count as verify-dm-cache 5b; about 8% of room): a check's telling 1310 → 1115 and
 // a greeting 1993 → 989 on 2026-10-21. Raise one only on purpose, and say why in AGENTS.md.
 {const tokens=s=>{let n=0;for(const m of s.matchAll(/ ?[A-Za-z]+| ?\d{1,3}|\s+| ?[^\sA-Za-z\d]{1,3}/g))n+=m[0].length>10?Math.ceil(m[0].length/7):1;return n;};
  const sceneTokens=q=>q.input.slice(1).filter(m=>m.role==='user').reduce((n,m)=>n+tokens(m.content),0);
  const told1=sceneTokens(await requestOf(told)),cue1=sceneTokens(qCue);
  assert.ok(told1<=1200,'a check\'s telling within 1200 tokens: '+told1);assert.ok(cue1<=1070,'a scene cue within 1070 tokens: '+cue1);}

 // ---- 5. The standing prompt is the same for every phase ----
 for(const q of [qCue,await requestOf(told),qClosed])assert.equal(q.instructions,qOpen.instructions,'one standing prompt');
 assert.deepEqual(replySchemaFor(),qOpen.text.format.schema,'one reply schema');
 console.log('verify-lean-turns: ok (suggestions only when seen, a lean telling, a cue read once, whole-word rules)');
})().catch(e=>{console.error(e);process.exit(1);});
