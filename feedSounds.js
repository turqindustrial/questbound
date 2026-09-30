// Sounds for a story-feed entry as it plays. Attack rolls get dice and a swing; damage lines land an impact typed by
// damage (slashing, fire, cold…) on the right side of the stereo field: the opponent, or you.
// Returns a list of [soundName, delaySeconds, options].
export const damageType=t=>(t.match(/\b(slashing|piercing|bludgeoning|fire|cold|poison|necrotic|radiant|lightning|thunder|acid|psychic|force)\b/i)?.[1]??'bludgeoning').toLowerCase();
export function eventSounds(e){
 const t=e.text;
 if(['roll','initiative'].includes(e.kind)){
  if(/HP lost|damage recorded/i.test(t))return [['impact:'+damageType(t)+':me']];
  if(e.kind==='initiative')return [['dice']];
  if(/^Healing draught/.test(t))return [['heal']];
  const spell=/^[A-Z][A-Za-z' ]+: (?:d20|\w+ save)/.test(t)&&!/^You use /.test(t)&&/\bsave\b|\bHit;|\bMiss;/.test(t)&&/damage/i.test(t);
  if(spell)return [['spell'],[/Miss;|success; 0 /.test(t)?'miss':'impact:'+damageType(t)+':foe',.3]];
  if(/^\d+ \w+ damage/i.test(t))return [['impact:'+damageType(t)+':foe']];
  const foeAttack=!/^You /.test(t)&&/vs your AC/.test(t);
  if(/Critical hit/i.test(t))return foeAttack?[['dice'],['swing',.25]]:[['dice'],['crit',.3]];
  if(/\bHit\b/.test(t))return [['dice'],['swing',.25]];
  if(/\bMiss\b/.test(t))return [['dice'],['miss',.25]];
  if(/Failure\./.test(t))return [['dice'],['miss',.3]];
  if(/Success\./.test(t))return [['dice'],['chime',.3]];
  return /d20/.test(t)?[['dice']]:[];
 }
 if(e.kind==='effect'){const m=t.match(/: (\d+) → (\d+) HP/);return m&&Number(m[2])>Number(m[1])?[['heal']]:[];}
 if(e.kind==='action'){
  if(/threat is defeated|is defeated\.|restored the crossing|Adventure complete/i.test(t))return [['victory']];
  if(/still standing/.test(t))return [['fall']];
  if(/fall unconscious|You collapse|You wake at/i.test(t))return [['defeat']];
  if(/^You (?:arrive|return|fall back|travel)/.test(t))return [['whoosh']];
  return [];
 }
 if(e.kind==='dialogue')return [['voice',0,{speaker:e.speakerId}]];
 return [];
}
