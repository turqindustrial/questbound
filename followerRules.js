import {npcScene,npcIdsOf,npcLore,mentionsName} from './npcRules';
import {mapLocation} from './mapRules';
import {skillCheckBonus} from './skillRules';
import {appendJournal,journalForGame} from './journalRules';
export const followerLocation=game=>game.dungeon?.active?'dungeon:'+game.dungeon.room:mapLocation(game);
export function recruitmentTargets(game,question,primary=null){
 const text=question.trim();
 if(/^(?:why|how|what|who|if)\b/i.test(text)||!(/\b(?:join|accompany|recruit)\b/i.test(text)||/\b(?:come|travel|adventure|journey|follow) (?:along|with|me|us)\b/i.test(text)))return [];
 const people=npcScene(game).filter(n=>n.present&&n.hp>0),named=people.filter(n=>mentionsName(text,npcLore(game,n.id)?.name??n.name)||!game.story&&n.id==='keeper'&&/\b(?:keeper|bartender|innkeeper)\b/i.test(text));
 if(/\b(?:both|everyone|all of you)\b/i.test(text))return people.map(n=>n.id);
 return named.length?named.map(n=>n.id):people.some(n=>n.id===primary)?[primary]:people.length===1?[people[0].id]:[];
}
// Up to three people travel with the player at once; everyone else they have met can be left waiting somewhere.
export const maxFollowing=3;
export function validFollowers(value,game){
 if(value===undefined)return true;
 const known=npcIdsOf(game);
 return value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).length<=known.length&&Object.values(value).filter(f=>f?.status==='following').length<=maxFollowing&&Object.entries(value).every(([id,f])=>known.includes(id)&&f&&['following','waiting','dismissed'].includes(f.status)&&/^(?:inn|bridge|tower|dungeon:[0-7]|p\d{1,2})$/.test(f.location)&&['reason','terms'].every(k=>typeof f[k]==='string'&&f[k].length<=(k==='reason'?400:300)));
}
export function resolveRecruitment(hero,game,health,plans,question,primary,random=Math.random){
 const fail=error=>({game,health,error});
 if(game.npcCombat?.active||game.stage==='combat'||game.pendingSpell)return fail('Finish the encounter before asking someone to join.');
 if(health?.current===0||game.castingConditions?.incapacitated)return fail('You cannot make this request while incapacitated.');
 const allowed=recruitmentTargets(game,question,primary);
 if(!Array.isArray(plans)||plans.length<1||plans.length>2||new Set(plans.map(p=>p?.npcId)).size!==plans.length)return fail('The recruitment decision was invalid.');
 if(!plans.every(p=>p&&allowed.includes(p.npcId)&&['join','decline','check'].includes(p.decision)&&typeof p.reason==='string'&&p.reason.trim().length>2&&p.reason.length<=400&&typeof p.terms==='string'&&p.terms.length<=300&&(p.decision==='check'?Number.isInteger(p.dc)&&p.dc>=10&&p.dc<=25:p.dc===null)))return fail('Invite a nearby character to join you before recruiting them.');
 let next={...game,followers:{...game.followers},npcMemory:{...game.npcMemory}};const events=[];
 for(const plan of plans){
  const npc=npcScene(next).find(n=>n.id===plan.npcId),name=npcLore(game,npc.id)?.name??npc.name;
  if(npc.grudge&&plan.decision!=='decline')return fail(name+' will never travel with you. '+npc.grudge);
  if(npc.attitude==='hostile'&&plan.decision!=='decline')return fail(name+' is hostile and will not join while that conflict remains.');
  if(next.followers[npc.id]?.status==='following'){events.push(name+' is already traveling with you.');continue;}
  let joined=plan.decision==='join';
  if(plan.decision==='check'){
   // Wariness makes persuading harder; warmth (and a debt owed) makes it easier.
   const warm=['friendly','devoted'].includes(npc.attitude),modifiers=skillCheckBonus(hero,game,'Charisma','Persuasion'),rolls=Array.from({length:npc.attitude==='unfriendly'||warm?2:1},()=>1+Math.floor(random()*20)),die=warm?Math.max(...rolls):Math.min(...rolls),total=(modifiers.reliable?Math.max(10,die):die)+modifiers.total;
   joined=total>=plan.dc;events.push('Convince '+name+': Persuasion d20 ['+rolls.join(', ')+']'+(rolls.length>1?(warm?' (advantage)':' (disadvantage)'):'')+' + '+modifiers.total+' = '+total+' vs DC '+plan.dc+'. '+(joined?'Success.':'Failure.'));
  }
  if(joined&&Object.values(next.followers).filter(f=>f.status==='following').length>=maxFollowing){events.push(name+' would come, but you already travel with '+maxFollowing+' companions. Ask one to wait first.');continue;}
  if(joined){
   next.followers[npc.id]={status:'following',location:followerLocation(game),reason:plan.reason,terms:plan.terms};
   next.npcMemory[npc.id]={...next.npcMemory[npc.id],attitude:npc.attitude,response:'Travels with the player by agreement.',allegiance:'player',memories:[...npc.memories,'Agreed to accompany the player.'].slice(-12)};
   events.push(name+' joins your adventure. '+plan.reason+(plan.terms?' Agreement: '+plan.terms:''));
  }else events.push(name+' declines to join for now. '+plan.reason);
 }
 next.worldFacts=[...(game.worldFacts??[]),...events].slice(-60);next.log=[...events,...game.log].slice(0,40);next.journal=appendJournal(journalForGame(next),'encounter','Companions',events.join('\n'));
 return {game:next,health,events};
}
export function manageFollower(game,id,action){
 const follower=game.followers?.[id],npc=npcScene(game).find(n=>n.id===id);
 if(!follower||!['following','waiting'].includes(follower.status)||!['wait','resume','dismiss'].includes(action))return {error:'That companion option is not available.'};
 if(game.npcCombat?.active||game.stage==='combat'||game.pendingSpell)return {error:'Finish the encounter before changing your companions.'};
 if(action!=='dismiss'&&(!npc.present||npc.hp<=0))return {error:'Return to your conscious companion before giving that instruction.'};
 if(action==='resume'&&npc.attitude==='hostile')return {error:'This character will not follow while hostile.'};
 if(action==='resume'&&follower.status!=='following'&&Object.values(game.followers).filter(f=>f.status==='following').length>=maxFollowing)return {error:'You already travel with '+maxFollowing+' companions. Ask one to wait first.'};
 const status={wait:'waiting',resume:'following',dismiss:'dismissed'}[action],name=npcLore(game,id)?.name??npc.name;
 const location=follower.status==='following'?followerLocation(game):follower.location;
 const next={...game,followers:{...game.followers,[id]:{...follower,status,location}},npcMemory:{...game.npcMemory}};
 if(action==='dismiss'&&next.npcMemory[id]){next.npcMemory[id]={...next.npcMemory[id]};delete next.npcMemory[id].allegiance;}
 const message=name+(status==='following'?' resumes traveling with you.':status==='waiting'?' waits here for your return.':' leaves your party and stays at their current location.');
 next.log=[message,...game.log].slice(0,40);next.journal=appendJournal(journalForGame(next),'encounter','Companions',message);
 return {game:next};
}
