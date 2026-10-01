import {combatBasics} from './combatRules';
import {npcScene,npcLore,mentionsName} from './npcRules';
import {storyText} from './storyRules';

const pretty=id=>id.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
export function conversationPeople(game){
 if(game.npcCombat?.active||game.stage==='combat')return [];
 return npcScene(game).filter(n=>n.present&&n.hp>0).map(n=>({...n,name:game.story?.npcs[n.id]?.name??n.name,role:npcLore(game,n.id)?.role??''}));
}
export function conversationTarget(game,input,current=null){
 const people=conversationPeople(game),q=input.toLowerCase();
 if(/^(?:I\s+)?(?:attack|stab|strike|slash|cast|go|move|travel|leave|goodbye|farewell|flee|surrender)\b/i.test(input.trim()))return null;
 const talking=/\b(?:talk|speak|ask|tell|say|greet|hello|hi|question|chat)\b/i.test(input);
 const named=people.find(n=>mentionsName(q,n.name)||(n.id==='keeper'&&!game.story&&/\b(?:bartender|innkeeper|keeper)\b/.test(q)));
 if(named&&(talking||mentionsName(q,named.name,true)))return named.id;
 return people.some(n=>n.id===current)?current:null;
}
export function activeEffectLines(game,health){
 const lines=[];
 if(game.concentration)lines.push(pretty(game.concentration.id)+' · Concentration · '+(game.concentration.remaining==null?game.concentration.duration:game.concentration.remaining+' rounds remaining'));
 if(health?.temp>0)lines.push(health.temp+' temporary HP'+(game.temporarySpell?' · '+pretty(game.temporarySpell.id)+' · '+game.temporarySpell.remaining+' rounds remaining':''));
 for(const [name,rounds] of Object.entries(game.enemyEffects??{}))lines.push('Target: '+name+' · '+rounds+' round'+(rounds===1?'':'s')+' remaining');
 for(const [key,label] of [['silenced','Silenced'],['handsBound','Hands bound'],['incapacitated','Incapacitated']])if(game.castingConditions?.[key])lines.push(label);
 return lines;
}
export function recordedTurn(hero,before,beforeHP,result,conversation,npcId=null){
 const after=result.game,events=[{kind:conversation.trigger?'action':'player',text:conversation.question,...(conversation.actorName&&!conversation.trigger?{speakerName:String(conversation.actorName).slice(0,100)}:{})}];
 const kind=text=>/initiative|turn order/i.test(text)?'initiative':/d20|\bd\d+\b|save |damage|\bHP\b/i.test(text)?'roll':'action';
 for(const text of result.events??[])if(text)events.push({kind:kind(text),text:storyText(after,text)});
 const hp=h=>h?.current??combatBasics(hero).hp;
 if(hp(beforeHP)!==hp(result.health))events.push({kind:'effect',text:hero.name+': '+hp(beforeHP)+' → '+hp(result.health)+' HP.'});
 for(const n of npcScene(after)){
  const old=npcScene(before).find(x=>x.id===n.id);
  if(old&&old.hp!==n.hp)events.push({kind:'effect',text:(after.story?.npcs[n.id]?.name??n.name)+': '+old.hp+' → '+n.hp+' HP.'});
 }
 // A creature met while exploring has its own HP line; the story's foe is untouched while it is fought.
 const foeName=g=>g.wildFight?.name??g.story?.foe??'Encounter opponent',wildStart=!before.wildFight&&!!after.wildFight,wildEnd=!!before.wildFight&&!after.wildFight;
 const foeNow=wildEnd?(after.world?.places?.find(p=>p.id===before.wildFight.place)?.threat?.hp??0):after.enemyHP;
 if(!wildStart&&before.enemyHP!==foeNow)events.push({kind:'effect',text:foeName(before.wildFight?before:after)+': '+before.enemyHP+' → '+foeNow+' HP.'});
 // The creature at the foe's side has its own HP line.
 for(const [i,a] of (after.foeAllies??before.foeAllies??[]).entries()){const was=before.foeAllies?.[i]?.hp,now=after.foeAllies?.[i]?.hp;if(was!==undefined&&now!==undefined&&was!==now)events.push({kind:'effect',text:a.name+': '+was+' → '+now+' HP.'});}
 for(let level=1;level<=9;level++){
  const used=(after.spellSlotsUsed?.[level-1]??0)-(before.spellSlotsUsed?.[level-1]??0);
  if(used>0)events.push({kind:'effect',text:'Spent '+used+' level '+level+' spell slot'+(used===1?'':'s')+'.'});
 }
 const previous=activeEffectLines(before,beforeHP),current=activeEffectLines(after,result.health);
 for(const text of current.filter(t=>!previous.includes(t)))events.push({kind:'effect',text:'Active: '+text});
 if(before.concentration?.id&&before.concentration.id!==after.concentration?.id)events.push({kind:'effect',text:pretty(before.concentration.id)+' concentration ended.'});
 for(const name of Object.keys(before.enemyEffects??{}))if(!after.enemyEffects?.[name])events.push({kind:'effect',text:'Target effect ended: '+name+'.'});
 if((beforeHP?.temp??0)>0&&!(result.health?.temp>0))events.push({kind:'effect',text:'Temporary HP depleted or expired.'});
 // Someone met in this very turn is named from the game after it.
 const speaker=id=>npcLore(after,id)?.name??npcLore(before,id)?.name??'Dungeon Master';
 if(conversation.dialogue?.length){
  // The narrator's framing stays visible alongside the spoken lines unless it merely repeats them.
  const spoken=conversation.dialogue.map(l=>l.text).join(' ');
  if(conversation.narration?.trim()&&!spoken.includes(conversation.narration.trim())&&!conversation.dialogue.some(l=>conversation.narration.includes(l.text)))events.push({kind:'narration',text:conversation.narration});
  for(const line of conversation.dialogue)events.push({kind:'dialogue',speakerId:line.speakerId,speakerName:speaker(line.speakerId),text:line.text});
 }
 // Replies with a dialogue list keep the narrator separate; only older replies without one speak as the addressed NPC.
 else if(npcId&&conversation.dialogue===undefined)events.push({kind:'dialogue',speakerId:npcId,speakerName:speaker(npcId),text:conversation.narration});
 else events.push({kind:'narration',text:conversation.narration});
 const turn={id:(before.playback?.at(-1)?.id??0)+1,npcId,participants:conversationPeople(after).map(n=>n.id),events:events.slice(0,100).map(e=>({...e,text:e.text.slice(0,2200)}))};
 return {...result,game:{...after,playback:[...(before.playback??[]),turn].slice(-12)},turn};
}

export function visibleTurn(turn,game){
 return {...turn,events:turn.events.filter(e=>e.kind!=='story').map(e=>{
  if(e.kind!=='dialogue')return e;
  const id=e.speakerId??turn.npcId,name=e.speakerName??game.story?.npcs?.[id]?.name??npcScene(game).find(n=>n.id===id)?.name??'Dungeon Master';
  const prefix=name+':';return {...e,speakerName:name,text:e.text.toLowerCase().startsWith(prefix.toLowerCase())?e.text.slice(prefix.length).trim():e.text};
 })};
}
