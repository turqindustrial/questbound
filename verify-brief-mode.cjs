// Not so wordy (2026-10-22, the host: "the narration should definitely be kept a bit more brief as well, but I'm
// thinking more in the aspect of adding a "not so wordy" mode for players to be able to make that choice on their own.
// it seemed a bit daunting the last time I played and I don't want my players to feel the same way."): the per-device
// choice (storyPreferences.js length), the turn's note that says how much to write (dm-instructions.cjs lengthNote,
// after the scene and before the narrator's voice, never in the standing prompt or the scene, so nothing cached
// changes), the tighter default, the acting player's choice at a table, and the game's own tellings of routine moves
// in their shorter lines. Stand-in provider and synthetic heroes only: no network, no AI.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs');
const {generate,requestParts,requestScene,standingPrompt}=require('./dm-server.cjs');
const {lengthNote,lengthNotes}=require('./dm-instructions.cjs');
const r=require('./rules-engine.cjs').rules(),{resolveTurn}=require('./server-turn.cjs'),{journeyStory}=require('./journey-fixtures.cjs');
const x=vm.runInNewContext(rulesSource({extra:['worldArtRules.js']})+'\n({readyHero,newAdventure,freshStoryGame,hostileEncounterGame,adventureStep,withAttackIntent,routineTelling,routineFightTurn,combatBasics})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const plain=v=>JSON.parse(JSON.stringify(v));const seq=(s=11)=>()=>(s=(s*16807)%2147483647)/2147483647;
const reply=o=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({narration:'It happens.',dialogue:[],effects:[],suggestions:[],...o})}]}]})});
async function requestOf(body){let q=null;await generate(plain(body),{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{q=q??JSON.parse(opt.body);return reply({});}});return q;}
const with_=(body,prefs)=>({...body,context:{...body.context,storyPreferences:prefs}});
(async()=>{
 // ---- 1. The choice: per device, full unless chosen, anything else ignored ----
 const prefsOf=saved=>{const store={v:saved===undefined?null:JSON.stringify(saved)};return {store,p:vm.runInNewContext(fs.readFileSync('storyPreferences.js','utf8').replace(/export /g,'')+'\n({storyPreferences,setStoryPreferences,tellingLengths,briefTelling})',{globalThis:{localStorage:{getItem:()=>store.v,setItem:(k,v)=>{store.v=v;}}}})};};
 {const {p,store}=prefsOf();assert.equal(p.storyPreferences().length,'full','the full telling unless chosen');assert.equal(p.briefTelling(p.storyPreferences()),false);
  assert.deepEqual(plain(p.tellingLengths.map(l=>l.id)),['full','brief']);assert.equal(p.tellingLengths[1].label,'Not so wordy');
  p.setStoryPreferences({length:'brief'});assert.equal(p.storyPreferences().length,'brief');assert.equal(JSON.parse(store.v).length,'brief','kept on this device');assert.equal(p.briefTelling(p.storyPreferences()),true);
  p.setStoryPreferences({length:'tiny'});assert.equal(p.storyPreferences().length,'brief','an unknown length is ignored');
  p.setStoryPreferences({narrator:'bard'});assert.equal(p.storyPreferences().length,'brief','other choices leave it alone');}
 assert.equal(prefsOf({length:'brief'}).p.storyPreferences().length,'brief','read back after a reload');assert.equal(prefsOf({length:'huge'}).p.storyPreferences().length,'full');

 // ---- 2. The screens: Settings → Story and the New Adventure screen, one tap ----
 {const story=fs.readFileSync('StoryControls.js','utf8'),intros=fs.readFileSync('AdventureIntros.js','utf8');
  assert.ok(/export function StorySettings\(\)[\s\S]*?<NarratorChoice\/>\s*<LengthChoice\/>/.test(story),'Settings → Story: under the narrator');
  {const fn=story.slice(story.indexOf('export function LengthChoice'));assert.ok(fn.includes('label="Not so wordy"')&&fn.includes("setStoryPreferences({length:on?'brief':'full'})"),'a switch that sets the length');}
  assert.equal((intros.match(/<NarratorChoice compact\/><LengthChoice style=\{s\.easy\}\/>/g)??[]).length,2,'beside Told by, on the New Adventure and next-tale screens');
  assert.equal((intros.match(/Switch on <Text style=\{s\.firstStrong\}>Not so wordy<\/Text> just below\./g)??[]).length,2,'a first-time player is told it is there');}

 // ---- 3. The Dungeon Master: this turn's note says how much to write ----
 const asked=[];const ask=async b=>{asked.push(plain(b));return {narration:'It happens.',dialogue:[],suggestions:[]};};
 const kara=r.readyHero('fighter'),g=plain(r.freshStoryGame(kara,journeyStory(0),r.newAdventure(kara))),snap=r.adventureSnapshot(kara,{...g,map:{...g.map,accepted:true}},null,true);
 await resolveTurn(snap,{question:'I look around the market.',storyPreferences:{length:'brief',narrator:'bard',secret:'x'}},{ask,randomImpl:seq(7)});
 const tableBody=asked.pop();assert.deepEqual(tableBody.context.storyPreferences,{narrator:'bard',length:'brief'},'at a table the acting player\'s choice reaches the Dungeon Master');
 await resolveTurn(snap,{question:'I look around the market.',storyPreferences:{length:'tiny'}},{ask,randomImpl:seq(7)});assert.deepEqual(asked.pop().context.storyPreferences,{},'an unknown length is dropped');
 const body=with_(tableBody,{});
 const qFull=await requestOf(with_(body,{length:'full'})),qBrief=await requestOf(with_(body,{length:'brief'})),qBard=await requestOf(with_(body,{length:'brief',narrator:'bard'}));
 assert.equal(requestParts(qFull).tail,'','the full telling needs no note (the Chronicler, full: an empty note as ever)');
 assert.equal(requestParts(qBrief).tail,lengthNotes.brief.trim(),'Not so wordy: the length note');
 assert.match(requestParts(qBard).tail,/^LENGTH THIS TURN: [^\n]*\nNARRATOR THIS TURN: Sable the Bard[^\n]*$/,'the length, then the narrator\'s voice last');
 for(const q of [qFull,qBrief,qBard])assert.equal(q.instructions,standingPrompt,'the standing prompt is the same either way');
 assert.deepEqual(requestScene(qBrief),requestScene(qFull),'and the scene: the choice is read only in the note');
 assert.ok(!standingPrompt.includes('LENGTH THIS TURN'),'never in the standing prompt');
 assert.equal(lengthNote({context:{storyPreferences:{length:'full'}}}),'');assert.equal(lengthNote({}),'');
 assert.match(lengthNotes.brief,/one to three short sentences/);assert.match(lengthNotes.brief,/each line one or two short sentences/);assert.match(lengthNotes.brief,/A death is still told precisely/);
 // Every phase: a telling, a scene cue, out of character, a retry.
 {const told=await requestOf(with_({...body,context:{...body.context,engineResolved:['You travel to The Old Mill. 1.2 miles; 21 minutes pass.']}},{length:'brief'}));assert.match(requestParts(told).tail,/^CURRENT PHASE: Narrate[\s\S]*\nLENGTH THIS TURN: /);
  const cue=await requestOf(with_({...body,context:{...body.context,sceneTrigger:{id:'wake',cue:'The player has just woken.'}}},{length:'brief'}));assert.match(requestParts(cue).tail,/^SCENE TRIGGER: [\s\S]*\nLENGTH THIS TURN: /);
  const ooc=await requestOf(with_({...body,context:{...body.context,outOfCharacter:{canRewind:false,lastTurn:null}}},{length:'brief'}));assert.match(requestParts(ooc).tail,/^OUT OF CHARACTER: [\s\S]*\nLENGTH THIS TURN: /);
  const notes=[];await generate(plain(with_(body,{length:'brief'})),{apiKey:'k',model:'m',fetchImpl:async(u,opt)=>{notes.push(JSON.parse(opt.body));return reply(notes.length===1?{narration:'You gain 900 gold.',effects:[{actionId:'invent-gold'}]}:{});}});
  assert.ok(notes.length>=2,'asked again');assert.match(requestParts(notes[1]).tail,/^LOOK AGAIN: [\s\S]*\nLENGTH THIS TURN: [^\n]*$/,'a retry keeps the length, last');}
 // The tighter default (the host: "the narration should definitely be kept a bit more brief"): 2–3 sentences, not 2–4.
 // The narration line of the written-tales spec's Phase A (2026-10-22): still 2–3 sentences, each doing something.
 assert.ok(standingPrompt.includes('Narration: lean, usually 2–3 sentences: one concrete thing seen, heard or smelled, what this moment changed, and an end the player can act on; dice and harm told as action, never as numbers or rule words; never retelling the player\'s words; a spoken line usually one or two sentences.'));assert.ok(!standingPrompt.includes('2–4 sentences'));
 // The device sends its whole choice with every request; a table turn sends the length with the narrator.
 {const t=fs.readFileSync('useDmTurn.js','utf8');assert.ok(t.includes('preferences:storyPreferences(),talkingTo'),'a device alone');assert.equal(t.split('storyPreferences:{brutality:prefs.brutality,narrator:prefs.narrator,length:prefs.length}').length-1,2,'both table turns');}

 // ---- 4. The game's own tellings: shorter lines, only what happened ----
 const hero=x.readyHero('fighter'),max=x.combatBasics(hero).hp,full={current:max,temp:0};
 const base=x.hostileEncounterGame(hero,x.newAdventure(hero),()=>0),fight={...base,openingAttackAvailable:false,enemyHP:400,story:{...base.story,foeStats:{...base.story.foeStats,maximum:400}}};
 const told=(g,action,words,length,i,narrator)=>{const before={...g,playback:[{id:i,events:[]}]};let s=i*7919%2147483646+1;const random=()=>(s=(s*16807)%2147483647)/2147483647;
  const preview=x.adventureStep(x.withAttackIntent(before,words),full,hero,action,random);assert.equal(preview.error,undefined,preview.error);
  return x.routineTelling({hero,before,preview,health:full,action,words,preferences:{length,narrator}});};
 for(const narrator of ['chronicler','lamplighter','bard']){
  let fullChars=0,briefChars=0,n=0,barks=0;
  for(let i=1;i<=60;i++){for(const [action,words] of [['attack:Greatsword','I attack with my Greatsword.'],['dodge','I take the Dodge action.'],['end-turn','I end my turn.']]){
   const a=told(fight,action,words,'full',i,narrator),b=told(fight,action,words,'brief',i,narrator);if(!a||!b){assert.equal(!!a,!!b,'the same moves are routine either way');continue;}
   assert.ok(b.narration.trim().length>0,'a brief telling still says what happened');assert.deepEqual(plain(told(fight,action,words,'brief',i,narrator)),plain(b),'seeded: the same turn, the same words');
   fullChars+=a.narration.length;briefChars+=b.narration.length;n++;barks+=b.dialogue.length;}}
  assert.ok(n>=60,'enough routine turns: '+n);assert.equal(barks,0,narrator+': no barks in a brief fight telling');
  assert.ok(briefChars<fullChars*0.85,narrator+': brief fight tellings are shorter ('+Math.round(briefChars/n)+' against '+Math.round(fullChars/n)+' characters)');
 }
 // Away from a fight: a journey back and a rest.
 {const start=plain(x.freshStoryGame(hero,journeyStory(0),x.newAdventure(hero))),went=x.adventureStep({...start,map:{...start.map,accepted:true}},null,hero,{type:'travel',destination:'tower'},()=>0.5).game;
  let fullChars=0,briefChars=0,n=0;
  for(let i=1;i<=40;i++)for(const [action,words] of [[{type:'travel',destination:'inn'},'I travel to Stillwater Market.'],['short-rest','I take a short rest.']]){
   const before={...went,playback:[{id:i,events:[]}]},preview=x.adventureStep(before,{current:Math.max(1,max-6),temp:0},hero,action,()=>0.5);if(preview.error)continue;
   const a=x.routineTelling({hero,before,preview,health:null,action,words,preferences:{}}),b=x.routineTelling({hero,before,preview,health:null,action,words,preferences:{length:'brief'}});if(!a||!b)continue;
   assert.equal(b.dialogue.length,0,'no companion\'s answer in a brief telling');fullChars+=a.narration.length;briefChars+=b.narration.length;n++;}
  assert.ok(n>=40,'enough calm turns: '+n);assert.ok(briefChars<fullChars,'brief calm tellings are shorter ('+Math.round(briefChars/n)+' against '+Math.round(fullChars/n)+')');}
 console.log('Not so wordy: a per-device choice (Settings → Story and the New Adventure screen, full unless chosen), told to the Dungeon Master in this turn\'s note (every phase and retry; the standing prompt and the scene unchanged, the narrator still last), the acting player\'s choice at a table, a tighter default (2–3 sentences), and the game\'s own fight and calm tellings in their shorter lines without barks.');
})().catch(e=>{console.error(e);process.exit(1);});
