const crypto=require('node:crypto');
const fail=message=>Object.assign(Error(message),{status:400});
const random=()=>crypto.randomInt(0,0x100000000)/0x100000000;
// What a client may say about the player's own device settings; anything else is ignored.
function preferences(p){const out={};if(['restrained','gritty','brutal'].includes(p?.brutality))out.brutality=p.brutality;if(['chronicler','lamplighter','bard'].includes(p?.narrator))out.narrator=p.narrator;return out;}
async function resolveTurn(snapshot,request,{ask,randomImpl=random,actorName='Adventurer'}={}){
 const r=require('./rules-engine.cjs').rules(),hero=JSON.parse(snapshot.character),health=snapshot.health;
 // Companions met before they had classes gain one out of a fight (Adventure.js does this on the device when solo).
 let game=snapshot.game;if(game.stage!=='combat'&&!game.npcCombat?.active&&!game.pendingSpell)game=r.withCompanionClasses(game,hero);
 // The device's "Use Shield when it saves you" setting reaches the rules only, never the saved character.
 const ruled=request.autoShield===false?{...hero,autoShield:false}:hero;
 // People speak first (greetings.js): the Speak chip at a table sends {greet:true, npcId}. The opening is worked out
 // here, never taken from the device; the person greets only when they may (not in a fight, not twice running).
 const greet=request.greet===true,people=r.conversationPeople(game);
 if(greet&&(!people.some(p=>p.id===request.npcId)||!r.shouldGreet(game,request.npcId)))throw fail('Nobody here is waiting to speak first.');
 const opening=greet?r.greeting(game,request.npcId,hero):null;
 const question=greet?opening.scene:typeof request.question==='string'?request.question.trim():'';
 if(!question||question.length>1000)throw fail('Describe one action in 1–1,000 characters.');
 const target=greet?request.npcId:r.conversationTarget(game,question,people.some(p=>p.id===request.npcId)?request.npcId:null),talkingTo=people.find(p=>p.id===target);
 const toDm=!greet&&(request.direct===true||/^(?:dm[, :]|\(ooc\))/i.test(question));
 const post=async(scene=game,hp=health,extra={})=>{
  const body=await ask({input:question,context:{...r.dmContext(ruled,scene,hp),turnStart:{hp:health?.current??r.combatBasics(hero).hp,max:r.combatBasics(hero).hp},storyPreferences:preferences(request.storyPreferences),conversationWith:talkingTo?{id:target,name:talkingTo.name,role:talkingTo.role,oneOnOne:request.oneOnOne===true&&r.conversationPeople(scene).length>1}:null,conversationParticipants:r.speakingPeople(scene).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude})),recruitmentTargets:r.recruitmentTargets(scene,question,target),...extra}});
  if(!body||typeof body.narration!=='string'||!body.narration.trim()||body.narration.length>1800)throw fail('The Dungeon Master returned an incomplete reply. Nothing was applied.');return body;
 };
 function finish(action,body,normalizedCommand,dice=randomImpl,extra={}){
  const conversation={question,narration:body.narration,dialogue:body.dialogue,worldEvent:body.worldEvent,relationships:body.relationships,loot:body.loot,introduce:body.introduce??null,normalizedCommand,npcId:target,actorName,...(toDm?{direct:true}:{}),...extra};
  // The same pipeline as Adventure.act on a device (turnRules.js): the rules, experience for every living hero, the
  // turn recorded, the story log and deeds. Scene cues are not played at a shared table.
  const settled=r.settleTurn({hero,ruled,game,health,action,conversation,random:dice,sceneTrigger:false});if(settled.error)throw fail(settled.error);
  const {result,xp}=settled,marked={fresh:settled.fresh};
  const next=r.adventureSnapshot(hero,result.game,result.health,true);if(!r.validAdventure(next,hero))throw fail('The resolved action did not pass the game rules. Nothing was applied.');
  const suggestions=Array.isArray(body.suggestions)?body.suggestions.filter(t=>typeof t==='string'&&t.trim()).slice(0,3):[];
  return {snapshot:next,narration:body.narration,turn:result.turn??null,events:result.events??[],suggestions,fault:toDm&&body.fault===true,deeds:marked.fresh??[],xp:xp.gained>0?{amount:xp.gained,label:xp.labels.join(' · ')}:null};
 }
 async function cast(command,narration){
  const dice=[],draw=()=>{const n=randomImpl();dice.push(n);return n;};
  const preview=r.adventureStep(r.withAttackIntent(game,question),health,ruled,command.action,draw);if(preview.error)throw fail(preview.error);
  if(preview.waiting){
   const body=await post(preview.game,preview.health);if(!body.ruling)throw fail('The DM needs more detail to resolve this spell. Nothing was spent.');
   const action={type:'ai-spell',request:command.action.request,ruling:body.ruling},rolled=[];
   const resolved=r.commitDmTurn(ruled,game,health,action,{question,narration:body.narration,worldEvent:body.worldEvent,normalizedCommand:command.normalizedCommand},()=>{const n=randomImpl();rolled.push(n);return n;});if(resolved.error)throw fail(resolved.error);
   if(body.ruling.decision==='cast'){const reply=await post(resolved.game,resolved.health,{engineResolved:resolved.events});for(const key of ['narration','dialogue','relationships','loot','introduce','suggestions'])body[key]=reply[key];}
   let i=0;return finish(action,body,command.normalizedCommand,()=>rolled[i++]??randomImpl());
  }
  const body=await post(preview.game,preview.health,{engineResolved:(preview.events??[]).map(t=>r.storyText(preview.game,t)).slice(0,40)});let i=0;
  return finish(command.action,{narration:body.narration??narration,dialogue:body.dialogue,relationships:body.relationships,loot:body.loot,introduce:body.introduce,suggestions:body.suggestions},command.normalizedCommand,()=>dice[i++]??randomImpl());
 }
 if(toDm)return finish(null,await post(game,health,{outOfCharacter:{canRewind:false,lastTurn:null}}));
 // A greeting is a trigger turn (no player line): the Dungeon Master writes it as a scene moment in which only that
 // person speaks, and the stand-in line is used when it cannot be reached or answers with someone else.
 if(greet){
  let narration=opening.aside,dialogue=[{speakerId:target,text:opening.fallback}],said=null;
  try{const reply=await post(game,health,{sceneTrigger:{id:'greet:'+target,cue:opening.cue},recruitmentTargets:[]});const lines=(Array.isArray(reply.dialogue)?reply.dialogue:[]).filter(l=>l?.speakerId===target).slice(0,2);if(lines.length){narration=reply.narration;dialogue=lines;said=reply;}}catch{}
  return finish(null,{narration,dialogue,suggestions:said?.suggestions},undefined,randomImpl,{trigger:true});
 }
 let command=r.dmCommand(ruled,game,question,health,target);
 if(request.action!==undefined){
  const offered=[...r.dmChoices(ruled,game,health),...r.quickActions(ruled,game,health),...r.attackTargets(ruled,game,health).flatMap(t=>r.attackActions(ruled,game,health,t.key)),...r.attackActions(ruled,game,health,null),...r.spellActions(ruled,game).flatMap(c=>[c,...(c.casts??[])]),...r.mapMoves(game)];
  const selected=offered.find(c=>JSON.stringify(c.action)===JSON.stringify(request.action));
  if(!selected?.action)throw fail('That action is not available to your character.');command={action:selected.action};
 }
 if(command?.action)return cast(command);
 // A rule's refusal of a plain "I cast ..." is shown as it is; only a cast the game could not read goes to the DM.
 if(command?.error&&/^(?:I )?cast\s/i.test(question)&&!command.soft)throw fail(command.error);
 const body=await post(game,health,command?.error?{castingIssue:command.error}:{});
 if(body.castCommand){const parsed=r.dmCommand(ruled,game,body.castCommand,health);if(parsed?.error||parsed?.action?.type!=='spell')throw fail('That spell is not available.');return cast(parsed,body.narration);}
 if(body.recruitment?.length||body.check){
  const action=body.check?{type:'ai-check',check:body.check}:{type:'recruitment',plans:body.recruitment},dice=[];
  const preview=r.commitDmTurn(ruled,game,health,action,{question,narration:body.narration,npcId:target},()=>{const n=randomImpl();dice.push(n);return n;});if(preview.error)throw fail(preview.error);
  const reply=await post(preview.game,preview.health,{engineResolved:preview.events});let i=0;return finish(action,{...reply,worldEvent:null},undefined,()=>dice[i++]??randomImpl());
 }
 if(body.ruling)return finish({type:'ai-ruling',ruling:body.ruling},body);
 if(body.discovery){const {travel,...place}=body.discovery;return finish({type:'discover',place,travel},body);}
 if(body.ambush)return finish({type:'ambush',foe:body.ambush},body);
 const choice=body.actionId==null?null:r.dmChoices(ruled,game,health).find(c=>c.id===body.actionId);
 if(body.actionId!=null&&!choice)throw fail('That action is no longer available.');
 return choice?cast({action:choice.action},body.narration):finish(null,body);
}
module.exports={resolveTurn};
