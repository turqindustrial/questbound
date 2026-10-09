const crypto=require('node:crypto');
const fail=message=>Object.assign(Error(message),{status:400});
const random=()=>crypto.randomInt(0,0x100000000)/0x100000000;
async function resolveTurn(snapshot,request,{ask,randomImpl=random,actorName='Adventurer'}={}){
 const r=require('./rules-engine.cjs').rules(),hero=JSON.parse(snapshot.character),game=snapshot.game,health=snapshot.health;
 const question=typeof request.question==='string'?request.question.trim():'';
 if(!question||question.length>1000)throw fail('Describe one action in 1–1,000 characters.');
 const people=r.conversationPeople(game),target=r.conversationTarget(game,question,people.some(p=>p.id===request.npcId)?request.npcId:null),talkingTo=people.find(p=>p.id===target);
 const toDm=request.direct===true||/^(?:dm[, :]|\(ooc\))/i.test(question);
 const post=async(scene=game,hp=health,extra={})=>{
  const body=await ask({input:question,context:{...r.dmContext(hero,scene,hp),turnStart:{hp:health?.current??r.combatBasics(hero).hp,max:r.combatBasics(hero).hp},conversationWith:talkingTo?{id:target,name:talkingTo.name,role:talkingTo.role}:null,conversationParticipants:r.conversationPeople(scene),recruitmentTargets:r.recruitmentTargets(scene,question,target),...extra}});
  if(!body||typeof body.narration!=='string'||!body.narration.trim()||body.narration.length>1800)throw fail('The Dungeon Master returned an incomplete reply. Nothing was applied.');return body;
 };
 function finish(action,body,normalizedCommand,dice=randomImpl){
  const conversation={question,narration:body.narration,dialogue:body.dialogue,worldEvent:body.worldEvent,relationships:body.relationships,loot:body.loot,introduce:body.introduce??null,normalizedCommand,npcId:target,actorName,...(toDm?{direct:true}:{} )};
  let result=r.commitDmTurn(hero,game,health,action,conversation,dice);if(result.error)throw fail(result.error);
  result=r.recordedTurn(hero,game,health,result,result.conversation??conversation,target);
  result.game={...result.game};delete result.game.sceneCue;
  result.game=r.partyVictory(game,r.withDeeds(r.withStoryLog(game,result.game,hero,{action}),hero).game);
  const next=r.adventureSnapshot(hero,result.game,result.health,true);if(!r.validAdventure(next,hero))throw fail('The resolved action did not pass the game rules. Nothing was applied.');
  return {snapshot:next,narration:body.narration,turn:result.turn??null,events:result.events??[]};
 }
 async function cast(command,narration){
  const dice=[],draw=()=>{const n=randomImpl();dice.push(n);return n;};
  const preview=r.adventureStep(r.withAttackIntent(game,question),health,hero,command.action,draw);if(preview.error)throw fail(preview.error);
  if(preview.waiting){
   const body=await post(preview.game,preview.health);if(!body.ruling)throw fail('The DM needs more detail to resolve this spell. Nothing was spent.');
   const action={type:'ai-spell',request:command.action.request,ruling:body.ruling},rolled=[];
   const resolved=r.commitDmTurn(hero,game,health,action,{question,narration:body.narration,worldEvent:body.worldEvent,normalizedCommand:command.normalizedCommand},()=>{const n=randomImpl();rolled.push(n);return n;});if(resolved.error)throw fail(resolved.error);
   if(body.ruling.decision==='cast'){const reply=await post(resolved.game,resolved.health,{engineResolved:resolved.events});for(const key of ['narration','dialogue','relationships','loot','introduce'])body[key]=reply[key];}
   let i=0;return finish(action,body,command.normalizedCommand,()=>rolled[i++]??randomImpl());
  }
  const body=await post(preview.game,preview.health,{engineResolved:(preview.events??[]).map(t=>r.storyText(preview.game,t)).slice(0,40)});let i=0;
  return finish(command.action,{narration:body.narration??narration,dialogue:body.dialogue,relationships:body.relationships,loot:body.loot,introduce:body.introduce},command.normalizedCommand,()=>dice[i++]??randomImpl());
 }
 if(toDm)return finish(null,await post(game,health,{outOfCharacter:{canRewind:false,lastTurn:null}}));
 let command=r.dmCommand(hero,game,question,health,target);
 if(request.action!==undefined){
  const offered=[...r.dmChoices(hero,game,health),...r.quickActions(hero,game,health),...r.attackActions(hero,game,health,null),...r.spellActions(hero,game)];
  const selected=offered.find(c=>JSON.stringify(c.action)===JSON.stringify(request.action));
  if(!selected?.action)throw fail('That action is not available to your character.');command={action:selected.action};
 }
 if(command?.action)return cast(command);
 const body=await post(game,health,command?.error?{castingIssue:command.error}:{});
 if(body.castCommand){const parsed=r.dmCommand(hero,game,body.castCommand,health);if(parsed?.error||parsed?.action?.type!=='spell')throw fail('That spell is not available.');return cast(parsed,body.narration);}
 if(body.recruitment?.length||body.check){
  const action=body.check?{type:'ai-check',check:body.check}:{type:'recruitment',plans:body.recruitment},dice=[];
  const preview=r.commitDmTurn(hero,game,health,action,{question,narration:body.narration,npcId:target},()=>{const n=randomImpl();dice.push(n);return n;});if(preview.error)throw fail(preview.error);
  const reply=await post(preview.game,preview.health,{engineResolved:preview.events});let i=0;return finish(action,{...reply,worldEvent:null},undefined,()=>dice[i++]??randomImpl());
 }
 if(body.ruling)return finish({type:'ai-ruling',ruling:body.ruling},body);
 if(body.discovery){const {travel,...place}=body.discovery;return finish({type:'discover',place,travel},body);}
 if(body.ambush)return finish({type:'ambush',foe:body.ambush},body);
 const choice=body.actionId==null?null:r.dmChoices(hero,game,health).find(c=>c.id===body.actionId);
 if(body.actionId!=null&&!choice)throw fail('That action is no longer available.');
 return choice?cast({action:choice.action},body.narration):finish(null,body);
}
module.exports={resolveTurn};
