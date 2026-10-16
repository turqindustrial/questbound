import {npcScene,npcIdsOf,npcLore,mentionsName,npcClassList,npcClassOf,classFromRole,classedStats,companionLevelFor,npcMaxHP,npcWhereabouts} from './npcRules';
import {mapLocation,travelRoute,placeName} from './mapRules';
import {skillCheckBonus} from './skillRules';
import {appendJournal,journalForGame} from './journalRules';
export const followerLocation=game=>game.dungeon?.active?'dungeon:'+game.dungeon.room:mapLocation(game);
// Words that ask someone present to come along: an invitation, a request to guide or fight beside the hero, "let's
// go". Questions about the game itself ("How do followers work?", "What is Mara's job?") are not invitations.
const invitationWords=/\b(?:join|accompany|recruit|hire|escort)\b|\b(?:come|travel|adventure|journey|follow|go|ride|walk) (?:along|with|together|beside)\b|\bfollow (?:me|us)\b|\b(?:let'?s|we could) (?:go|travel|set out)\b|\b(?:help|guide|lead) (?:me|us)\b(?! with\b)|\blead the way\b|\b(?:fight|stand) (?:with|beside|alongside) (?:me|us)\b|\bat (?:my|our) side\b|\b(?:my|our) (?:party|company)\b/i;
export function recruitmentTargets(game,question,primary=null){
 const text=String(question??'').trim();
 if(/^(?:how|what|who)\b(?! about\b| if\b)/i.test(text)&&!/\byou\b/i.test(text))return [];
 if(!invitationWords.test(text))return [];
 const people=npcScene(game).filter(n=>n.present&&n.hp>0&&game.followers?.[n.id]?.status!=='following'),named=people.filter(n=>mentionsName(text,npcLore(game,n.id)?.name??n.name)||!game.story&&n.id==='keeper'&&/\b(?:keeper|bartender|innkeeper)\b/i.test(text));
 if(/\b(?:both|everyone|all of you)\b/i.test(text))return people.map(n=>n.id);
 return named.length?named.map(n=>n.id):people.some(n=>n.id===primary)?[primary]:people.length===1?[people[0].id]:[];
}
// Up to three people travel with the player at once; everyone else they have met can be left waiting somewhere.
export const maxFollowing=3;
const following=game=>Object.values(game.followers??{}).filter(f=>f?.status==='following').length;
export function validFollowers(value,game){
 if(value===undefined)return true;
 const known=npcIdsOf(game);
 return value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).length<=known.length&&Object.values(value).filter(f=>f?.status==='following').length<=maxFollowing&&Object.entries(value).every(([id,f])=>known.includes(id)&&f&&['following','waiting','dismissed'].includes(f.status)&&/^(?:inn|bridge|tower|dungeon:[0-7]|p\d{1,3})$/.test(f.location)&&['reason','terms'].every(k=>typeof f[k]==='string'&&f[k].length<=(k==='reason'?400:300)));
}
// Someone who offered, unasked, to come along: the player takes them or not (game.joinOffers[id] = {reason, terms}).
export function validJoinOffers(value,game){
 if(value===undefined)return true;
 const known=npcIdsOf(game),entries=value&&typeof value==='object'&&!Array.isArray(value)?Object.entries(value):null;
 return !!entries&&entries.length<=3&&entries.every(([id,o])=>known.includes(id)&&game.followers?.[id]?.status!=='following'&&!!o&&typeof o==='object'&&typeof o.reason==='string'&&o.reason.trim().length>0&&o.reason.length<=400&&typeof o.terms==='string'&&o.terms.length<=300);
}
// Offers stand only while the person who made them is still here, conscious and not already along.
export function standingOffers(game){
 const offers=game.joinOffers??{},here=npcScene(game).filter(n=>n.present&&n.hp>0&&n.fate!=='dead'&&game.followers?.[n.id]?.status!=='following').map(n=>n.id);
 return Object.keys(offers).filter(id=>here.includes(id));
}
function withoutOffers(game,ids){
 if(!game.joinOffers)return game;
 const offers={...game.joinOffers};for(const id of ids)delete offers[id];
 const next={...game};if(Object.keys(offers).length)next.joinOffers=offers;else delete next.joinOffers;
 return next;
}
const classOk=c=>c===undefined||c===null||npcClassList.includes(c);
// Who someone is as a fighter when they join: their own trained class, else the class the Dungeon Master gave, else
// the one their life has made them; a level below the hero (never lowering a level they already have).
function trainedOnJoin(game,hero,id,given){
 const cur=npcClassOf(game,id),lore=npcLore(game,id),written=game.story?.npcs?.[id]?.class??game.people?.[id]?.class;
 const cls=cur?.class??(npcClassList.includes(given)?given:npcClassList.includes(written)?written:classFromRole(lore?.role));
 return {class:cls,level:Math.max(cur?.level??1,companionLevelFor(hero))};
}
// Gives someone a class (and keeps their hit points within the new maximum).
export function withNpcClass(game,id,trained){
 const next={...game,npcClasses:{...game.npcClasses,[id]:trained}},most=classedStats(trained.class,trained.level).maximumHP;
 if(Number.isInteger(game.npcHP?.[id])&&game.npcHP[id]>most)next.npcHP={...game.npcHP,[id]:most};
 return next;
}
// The one write that makes someone a companion: following the hero from here, on the hero's side, with a class.
function joinCompanion(game,hero,npc,{reason,terms,cls}){
 const id=npc.id,trained=trainedOnJoin(game,hero,id,cls);
 let next=withNpcClass({...game,followers:{...game.followers,[id]:{status:'following',location:followerLocation(game),reason:String(reason).slice(0,400),terms:String(terms??'').slice(0,300)}},npcMemory:{...game.npcMemory}},id,trained);
 next.npcMemory[id]={...next.npcMemory[id],attitude:npc.attitude,response:'Travels with the player by agreement.',allegiance:'player',memories:[...(npc.memories??[]),'Agreed to accompany the player.'].slice(-12)};
 next=withoutOffers(next,[id]);
 return {game:next,trained};
}
const joinLine=(name,t)=>name+' joins your adventure as a level '+t.level+' '+t.class+'.';
export function resolveRecruitment(hero,game,health,plans,question,primary,random=Math.random){
 const fail=error=>({game,health,error});
 if(game.npcCombat?.active||game.stage==='combat'||game.pendingSpell)return fail('Finish the encounter before asking someone to join.');
 if(health?.current===0||game.castingConditions?.incapacitated)return fail('You cannot make this request while incapacitated.');
 const allowed=recruitmentTargets(game,question,primary);
 const offerable=npcScene(game).filter(n=>n.present&&n.hp>0&&n.fate!=='dead'&&game.followers?.[n.id]?.status!=='following').map(n=>n.id);
 if(!Array.isArray(plans)||plans.length<1||plans.length>2||new Set(plans.map(p=>p?.npcId)).size!==plans.length)return fail('The recruitment decision was invalid.');
 if(!plans.every(p=>p&&(p.decision==='offer'?offerable.includes(p.npcId)&&p.dc===null:allowed.includes(p.npcId)&&['join','decline','check'].includes(p.decision)&&(p.decision==='check'?Number.isInteger(p.dc)&&p.dc>=10&&p.dc<=25:p.dc===null))&&classOk(p.class)&&typeof p.reason==='string'&&p.reason.trim().length>2&&p.reason.length<=400&&typeof p.terms==='string'&&p.terms.length<=300))return fail('Invite a nearby character to join you before recruiting them.');
 let next={...game,followers:{...game.followers},npcMemory:{...game.npcMemory}};const events=[];
 // Offers that no longer stand (the person has gone, or fell) are dropped with this decision.
 next=withoutOffers(next,[...Object.keys(game.joinOffers??{}).filter(id=>!offerable.includes(id)),...plans.filter(p=>p.decision!=='offer').map(p=>p.npcId)]);
 for(const plan of plans){
  const npc=npcScene(next).find(n=>n.id===plan.npcId),name=npcLore(game,npc.id)?.name??npc.name;
  if(npc.grudge&&plan.decision!=='decline')return fail(name+' will never travel with you. '+npc.grudge);
  if(npc.attitude==='hostile'&&plan.decision!=='decline')return fail(name+' is hostile and will not join while that conflict remains.');
  if(next.followers[npc.id]?.status==='following'){events.push(name+' is already traveling with you.');continue;}
  if(plan.decision==='offer'){
   next={...next,joinOffers:{...next.joinOffers,[npc.id]:{reason:plan.reason.trim(),terms:plan.terms}}};
   events.push(name+' offers to come with you. '+plan.reason.trim()+(plan.terms?' Terms: '+plan.terms:''));continue;
  }
  // Someone left waiting here who is asked again simply comes.
  const waiting=next.followers[npc.id]?.status==='waiting'&&plan.decision!=='decline';
  if(waiting&&following(next)<maxFollowing){next.followers[npc.id]={...next.followers[npc.id],status:'following',location:followerLocation(game)};events.push(name+' falls in beside you again.');continue;}
  let joined=plan.decision==='join'||waiting;
  if(plan.decision==='check'&&!waiting){
   // Wariness makes persuading harder; warmth (and a debt owed) makes it easier.
   const warm=['friendly','devoted'].includes(npc.attitude),modifiers=skillCheckBonus(hero,game,'Charisma','Persuasion'),rolls=Array.from({length:npc.attitude==='unfriendly'||warm?2:1},()=>1+Math.floor(random()*20)),die=warm?Math.max(...rolls):Math.min(...rolls),total=(modifiers.reliable?Math.max(10,die):die)+modifiers.total;
   joined=total>=plan.dc;events.push('Convince '+name+': Persuasion d20 ['+rolls.join(', ')+']'+(rolls.length>1?(warm?' (advantage)':' (disadvantage)'):'')+' + '+modifiers.total+' = '+total+' vs DC '+plan.dc+'. '+(joined?'Success.':'Failure.'));
  }
  if(joined&&following(next)>=maxFollowing){events.push(name+' would come, but you already travel with '+maxFollowing+' companions. Ask one to wait first.');continue;}
  if(joined){
   const done=joinCompanion(next,hero,npc,{reason:plan.reason,terms:plan.terms,cls:plan.class});next=done.game;
   events.push(joinLine(name,done.trained)+' '+plan.reason+(plan.terms?' Agreement: '+plan.terms:''));
  }else events.push(name+' declines to join for now. '+plan.reason);
 }
 next.worldFacts=[...(game.worldFacts??[]),...events].slice(-60);next.log=[...events,...game.log].slice(0,40);next.journal=appendJournal(journalForGame(next),'encounter','Companions',events.join('\n'));
 return {game:next,health,events};
}
// Taking up someone's offer to come along (the "Take … along" chip, or the player's own yes).
export function acceptOffer(hero,game,id){
 const offer=game.joinOffers?.[id],npc=npcScene(game).find(n=>n.id===id);
 if(!offer||!npc)return {error:'Nobody here has offered to come with you.'};
 if(game.npcCombat?.active||game.stage==='combat'||game.pendingSpell)return {error:'Finish the encounter first.'};
 const name=npcLore(game,id)?.name??npc.name;
 if(!npc.present||npc.hp<=0||npc.fate==='dead')return {error:name+' is not here to come with you.'};
 if(npc.grudge)return {error:name+' will never travel with you. '+npc.grudge};
 if(npc.attitude==='hostile')return {error:name+' is hostile and will not join while that conflict remains.'};
 if(game.followers?.[id]?.status==='following')return {error:name+' is already traveling with you.'};
 if(following(game)>=maxFollowing)return {error:'You already travel with '+maxFollowing+' companions. Ask one to wait first.'};
 const done=joinCompanion(game,hero,npc,{reason:offer.reason,terms:offer.terms}),line=joinLine(name,done.trained)+(offer.terms?' Agreement: '+offer.terms:'');
 const next={...done.game,worldFacts:[...(game.worldFacts??[]),line].slice(-60),log:[line,...game.log].slice(0,40)};
 next.journal=appendJournal(journalForGame(next),'encounter','Companions',line);
 return {game:next,events:[line]};
}
// Where a companion is, in words: a found place's own name, a starting place's, or a room of the vault.
export function followerPlace(game,location){
 if(/^dungeon:/.test(String(location)))return 'vault room '+(Number(String(location).slice(8))+1);
 return placeName(game,location)||'somewhere behind you';
}
// wait: stay here; resume: come along again (they must be here); call: send word to one waiting elsewhere, who
// catches up on the road; dismiss: part ways (a friend stays an ally where they are).
export function manageFollower(game,id,action){
 const follower=game.followers?.[id],npc=npcScene(game).find(n=>n.id===id);
 if(!follower||!npc||!['following','waiting'].includes(follower.status)||!['wait','resume','dismiss','call'].includes(action))return {error:'That companion option is not available.'};
 if(game.npcCombat?.active||game.stage==='combat'||game.pendingSpell)return {error:'Finish the encounter before changing your companions.'};
 const name=npcLore(game,id)?.name??npc.name,here=followerLocation(game);
 if(action==='call'){
  if(follower.status!=='waiting')return {error:name+' is already with you.'};
  if(npc.present)action='resume';
  else{
   if(npc.fate==='dead'||npc.hp<=0)return {error:name+' cannot come: they are '+(npc.fate==='dead'?'dead':'hurt too badly to travel')+'.'};
   if(npc.attitude==='hostile')return {error:name+' will not answer while hostile.'};
   if(following(game)>=maxFollowing)return {error:'You already travel with '+maxFollowing+' companions. Ask one to wait first.'};
   const from=follower.location,to=String(here).replace(/^dungeon:.*/,'dungeon');
   if(!/^dungeon/.test(from)&&!/^dungeon/.test(to)&&from!==to&&!travelRoute(game,from,to))return {error:'No road you know leads from '+followerPlace(game,from)+' to here.'};
   const message='Word reaches '+name+' at '+followerPlace(game,from)+'; they catch up with you on the road.';
   const next={...game,followers:{...game.followers,[id]:{...follower,status:'following',location:here}}};
   next.log=[message,...game.log].slice(0,40);next.journal=appendJournal(journalForGame(next),'encounter','Companions',message);
   return {game:next,events:[message]};
  }
 }
 if(action!=='dismiss'&&(!npc.present||npc.hp<=0))return {error:'Return to your conscious companion before giving that instruction.'};
 if(action==='resume'&&npc.attitude==='hostile')return {error:'This character will not follow while hostile.'};
 if(action==='resume'&&follower.status!=='following'&&following(game)>=maxFollowing)return {error:'You already travel with '+maxFollowing+' companions. Ask one to wait first.'};
 if(action==='wait'&&follower.status==='waiting')return {error:name+' is already waiting.'};
 if(action==='resume'&&follower.status==='following')return {error:name+' is already with you.'};
 const status={wait:'waiting',resume:'following',dismiss:'dismissed'}[action];
 const location=follower.status==='following'?here:follower.location;
 const next={...game,followers:{...game.followers,[id]:{...follower,status,location}},npcMemory:{...game.npcMemory}};
 // Parting ways: a friend remains an ally where they stay; anyone cooler simply goes their own way.
 const staysAlly=action==='dismiss'&&['friendly','devoted'].includes(npc.attitude)&&!npc.grudge;
 if(action==='dismiss'&&next.npcMemory[id]){next.npcMemory[id]={...next.npcMemory[id]};if(!staysAlly)delete next.npcMemory[id].allegiance;}
 const message=name+(status==='following'?' resumes traveling with you.':status==='waiting'?' waits at '+followerPlace(game,location)+' for your return.':staysAlly?' parts ways with you but remains your ally.':' leaves your party and stays at their current location.');
 next.log=[message,...game.log].slice(0,40);next.journal=appendJournal(journalForGame(next),'encounter','Companions',message);
 return {game:next,events:[message]};
}
// Orders to several companions at once ("Everyone wait here."): each one in turn; any that cannot is told.
export function orderFollowers(game,ids,order){
 let next=game;const events=[],errors=[];
 for(const id of ids){const r=manageFollower(next,id,order);if(r.error)errors.push(r.error);else{next=r.game;events.push(...r.events);}}
 if(!events.length)return {error:errors[0]??'That companion option is not available.'};
 return {game:next,events};
}
// When the hero gains a level, their companions (with them or waiting) come along a step behind: one level below.
export function levelCompanions(game,heroLevel){
 const level=Math.max(1,Math.min(20,(Number(heroLevel)||1)-1));let next=game;
 for(const [id,f] of Object.entries(game.followers??{})){
  const cur=npcClassOf(game,id);if(!cur||!['following','waiting'].includes(f?.status)||cur.level>=level)continue;
  const before=classedStats(cur.class,cur.level).maximumHP,after=classedStats(cur.class,level).maximumHP;
  next={...next,npcClasses:{...next.npcClasses,[id]:{...cur,level}}};
  if(Number.isInteger(next.npcHP?.[id])&&next.npcHP[id]>0)next.npcHP={...next.npcHP,[id]:Math.min(after,next.npcHP[id]+after-before)};
 }
 return next;
}
// Saves from before companions had classes: anyone travelling with the hero (or waiting) gains one from their role.
// Deterministic, and never run while turning a party's view.
export function withCompanionClasses(game,hero){
 if(!game?.followers)return game;
 let next=game;
 for(const [id,f] of Object.entries(game.followers)){
  if(!['following','waiting'].includes(f?.status)||npcClassOf(next,id)||!npcIdsOf(game).includes(id))continue;
  next=withNpcClass(next,id,trainedOnJoin(next,hero,id));
 }
 return next;
}
// Companions, waiting companions and allies, for the Companions screen.
export function companionGroups(game){
 const scene=npcScene(game),entry=n=>({id:n.id,name:npcLore(game,n.id)?.name??n.name,role:npcLore(game,n.id)?.role??null,trained:npcClassOf(game,n.id),hp:n.hp,maximumHP:npcMaxHP(n.id,game),present:n.present,fate:n.fate,attitude:n.attitude,follower:game.followers?.[n.id]??null});
 const ofStatus=s=>scene.filter(n=>game.followers?.[n.id]?.status===s).map(entry);
 const allies=scene.filter(n=>game.npcMemory?.[n.id]?.allegiance==='player'&&!['following','waiting'].includes(game.followers?.[n.id]?.status)&&n.fate!=='dead').map(n=>({...entry(n),home:npcWhereabouts(game,n.id)}));
 return {travelling:ofStatus('following'),waiting:ofStatus('waiting').map(e=>({...e,place:followerPlace(game,e.follower.location)})),allies:allies.map(a=>({...a,place:followerPlace(game,a.home)}))};
}
