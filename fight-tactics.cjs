// A plain player's tactics in a fight with creatures (balance-check.cjs and tale-balance.cjs): heal or drink when low,
// spend spell slots on the strongest damaging spell while they last, then cantrips, then the main weapon. Plain Node,
// no AI calls. `r` is the rules, run in the caller's own context (rules-files.cjs); it must export the names in `needs`.
'use strict';
const needs=['dmCommand','knownSpells','automaticEffects','attackOptions','gearedHero','subclassAction','subclassUses','surgeReady'];
const casters=['Wizard','Sorcerer','Warlock','Druid','Bard','Cleric','Artificer'];
const cantripDice=level=>1+(level>=5)+(level>=11)+(level>=17);
function fightTactics(r){
 for(const n of needs)if(typeof r[n]!=='function'&&typeof r[n]!=='object')throw Error('fight-tactics.cjs needs '+n+' from the rules');
 // The foe's name as the player says it (the tale's foe, or the creature in the wilds).
 const foeName=g=>g.wildFight?.name??g.story?.foe??'foe';
 // The best damaging spell to cast now: a slot spell while the foe has enough left to be worth it, else the best
 // cantrip. Expected damage is reckoned roughly from the dice (an attack hits about two times in three; a save spell
 // does its half on a success).
 function bestCast(hero,g,h,foeLeft){
  const cast=words=>{const c=r.dmCommand(hero,g,words,h);return c?.action&&!c.error?c.action:null;};
  const options=r.knownSpells(hero).map(s=>({s,e:r.automaticEffects[s.id]})).filter(({s,e})=>e&&(e.attack||e.save)&&!e.heal&&!e.chooseType&&(s.castingTime==='Action'||e.asAction)).map(({s,e})=>{
   const dice=s.level===0?cantripDice(hero.level):(e.count??1),each=(e.die+1)/2*dice*(e.rays??1)+(e.then?(e.then.count??1)*(e.then.die+1)/2:0);
   return {s,expected:each*(e.attack?0.65:e.half?0.75:0.55)};
  });
  const cantrips=options.filter(o=>o.s.level===0).sort((a,b)=>b.expected-a.expected),best=cantrips[0]?.expected??0;
  const slots=options.filter(o=>o.s.level>0&&o.expected>best*1.3&&foeLeft>o.expected*0.6).sort((a,b)=>b.expected-a.expected);
  for(const o of [...slots,...cantrips]){const c=cast('I cast '+o.s.name+' at the '+foeName(g));if(c)return c;}
  return null;
 }
 // A plain player: heal or drink when low, spend spell slots on the strongest damaging spell while they last, then
 // cantrips, then the main weapon.
 function choose(hero,g,h,max){
  const cur=h?.current??max,low=cur<=max*0.35,cast=words=>{const c=r.dmCommand(hero,g,words,h);return c?.action&&!c.error?c.action:null;};
  const weapon=()=>{const weapons=r.attackOptions(r.gearedHero(hero,g)),w=weapons.find(x=>!x.unarmed&&!x.ranged)??weapons[0];return {type:'encounter-attack',weapon:w.name};};
  // A draught or Second Wind is a bonus action: taken when low, alongside the action. Once the action is spent
  // (the turn waits for a bonus action), anything not worth using is skipped with End turn.
  if(!g.bonusUsed&&low&&(g.potions??0)>0)return 'potion';
  // The subclass's own action while it has uses: a bonus action before the action (healing only when low, temporary
  // hit points only when there are none), an action in place of the attack.
  const feat=r.subclassAction(hero),featLeft=feat?r.subclassUses(hero,feat.uses)-(g.resources?.feat??0):0;
  if(feat&&featLeft>0&&!g.actionUsed&&(feat.bonus?!g.bonusUsed&&(feat.effect.heal?low&&cur<max:feat.effect.temp?!(h?.temp>0):true):true))return 'class:'+feat.id;
  if(!g.bonusUsed&&low&&hero.class==='Fighter'&&(g.resources?.wind??0)<(hero.level>=10?4:hero.level>=4?3:2))return 'class:wind';
  // A Fighter's Action Surge, while it is ready: one more action this turn.
  if(g.actionUsed&&r.surgeReady(hero,g))return 'class:surge';
  if(g.actionUsed)return 'end-turn';
  // Healing when low: a healing spell on yourself (a bonus-action one first).
  if(low&&cur<max){const heal=r.knownSpells(hero).filter(s=>r.automaticEffects[s.id]?.heal&&!s.id.startsWith('mass-')).sort((a,b)=>(b.castingTime==='Bonus Action')-(a.castingTime==='Bonus Action'));for(const s of heal){const c=cast('I cast '+s.name+' on myself');if(c)return c;}}
  if(casters.includes(hero.class)){const spell=bestCast(hero,g,h,g.enemyHP);if(spell)return spell;}
  return weapon();
 }
 return {choose,bestCast};
}
module.exports={fightTactics,needs,casters};
