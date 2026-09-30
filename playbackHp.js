// HP to show part-way through a turn's playback: start from each "Name: before → after HP." summary line, then follow
// the dice lines as they are revealed (damage you take, damage you deal, healing). The result always stays between the
// turn's starting and final values, and the summary line itself snaps it to the exact number.
const summary=/^(.*): (\d+) → (\d+) HP\.?$/;
const between=(value,a,b)=>Math.max(Math.min(a,b),Math.min(Math.max(a,b),value));
export function shownHp(events=[],count=0,{hero,foe}={}){
 const find=name=>{if(!name)return null;for(const e of events){if(e.kind!=='effect')continue;const m=(e.text??'').match(summary);if(m&&m[1]===name)return [Number(m[2]),Number(m[3])];}return null;};
 const h=find(hero),f=find(foe);
 if(!h&&!f)return null;
 let heroHp=h?.[0]??null,foeHp=f?.[0]??null;
 for(const e of events.slice(0,count)){
  const t=e.text??'';
  if(e.kind==='effect'){const m=t.match(summary);if(m){if(h&&m[1]===hero)heroHp=Number(m[3]);if(f&&m[1]===foe)foeHp=Number(m[3]);}continue;}
  if(e.kind!=='roll')continue;
  const lost=t.match(/(\d+) HP lost/);
  if(lost){if(heroHp!=null)heroHp-=Number(lost[1]);continue;}
  const healed=t.match(/restored (\d+) HP/);
  if(healed){if(heroHp!=null)heroHp+=Number(healed[1]);continue;}
  const dealt=t.match(/^(\d+) [A-Za-z]+ damage/)??t.match(/(?:Hit|Critical hit!?|success|failure)[;:,.]? (\d+) [A-Za-z]+ damage/i);
  if(dealt&&foeHp!=null)foeHp-=Number(dealt[1]);
 }
 return {hero:h?between(heroHp,h[0],h[1]):null,foe:f?between(foeHp,f[0],f[1]):null};
}
