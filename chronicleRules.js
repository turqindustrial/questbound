// Reads the rules engine's result lines so the story feed can show them as game moments: a die face with the natural
// roll, a stamped verdict, damage numbers by type, HP changes, initiative and round markers. Anything it does not
// recognise is shown as plain text, so an unusual line is never lost.
export const damageKind=t=>(String(t).match(/\b(slashing|piercing|bludgeoning|fire|cold|poison|necrotic|radiant|lightning|thunder|acid|psychic|force)\b/i)?.[1]??'').toLowerCase();
const damageIcons={fire:'flame',cold:'frost',lightning:'bolt',thunder:'bolt',radiant:'sun',necrotic:'skull',poison:'potion',acid:'potion',psychic:'eye',force:'spell',piercing:'spear',bludgeoning:'hammer',slashing:'sword'};
export const damageIcon=type=>damageIcons[type]??'sword';
function dice(text){
 const m=text.match(/d20 (?:\[([\d, ]+)\]|(\d+))/);if(!m)return null;
 const rolls=(m[1]??m[2]).split(/,\s*/).map(Number).filter(Number.isFinite);if(!rolls.length)return null;
 const mode=(text.match(/\((advantage|disadvantage)\b/)?.[1])??(rolls.length>1&&/disadvantage/.test(text)?'disadvantage':null);
 const natural=rolls.length>1?(mode==='disadvantage'?Math.min(...rolls):Math.max(...rolls)):rolls[0];
 return {rolls,mode,natural};
}
function verdictOf(text,save){
 if(/Critical hit/i.test(text))return 'crit';
 if(save){const m=text.match(/vs DC \d+: (success|failure)/i);if(m)return m[1].toLowerCase()==='success'?'saved':'failed';}
 if(/\bHit\b/.test(text))return 'hit';
 if(/\bMiss\b/.test(text))return 'miss';
 if(/\bSuccess\b/.test(text))return 'success';
 if(/\bFailure\b/.test(text))return 'failure';
 return null;
}
// The arithmetic between the die and "vs", tidied: "15 + 3 Strength + 2 proficiency = 20".
function mathOf(text,natural){
 const start=text.search(/d20 /);if(start<0)return '';
 const end=text.indexOf(' vs ',start);
 return text.slice(start,end<0?undefined:end).replace(/d20 (?:\[[\d, ]+\]|\d+)/,String(natural)).replace(/\s*\((?:normal|advantage|disadvantage)[^)]*\)/,'').replace(/\+(\d)/g,'+ $1').replace(/\s+/g,' ').replace(/\.$/,'').trim();
}
export function describeEvent(event){
 const text=String(event?.text??'').trim(),kind=event?.kind;
 if(kind==='effect'){
  const hp=text.match(/^(.*): (\d+) → (\d+) HP\.?$/);
  if(hp)return {type:'hp',name:hp[1],from:Number(hp[2]),to:Number(hp[3])};
  return {type:'note',text};
 }
 if(kind==='action'||kind==='initiative'&&/^Round \d+ begins/.test(text)){
  const round=text.match(/^Round (\d+) begins\.?$/);if(round)return {type:'round',round:Number(round[1])};
  if(/^Your turn\.?$/.test(text))return {type:'turn'};
  if(/^Opening attack\.?$/.test(text))return {type:'opening'};
 }
 if(kind==='initiative'||kind==='roll'){
  const order=text.match(/^Turn order: (.+?)\.?$/);if(order)return {type:'order',names:order[1].split(/\s*→\s*/)};
  const lost=text.match(/(\d+) HP lost/);
  if(lost){const absorbed=Number(text.match(/(\d+) absorbed/)?.[1]??0),roll=text.match(/^(.+?) = (\d+) (\w+) damage/);return {type:'hurt',amount:Number(lost[1]),absorbed,damageType:damageKind(text),math:roll?roll[1].replace(/\s+/g,' ')+' = '+roll[2]:''};}
  const healed=text.match(/^(.*?):.*?restored (\d+) HP/);
  if(healed)return {type:'heal',title:healed[1],amount:Number(healed[2])};
  const dealt=text.match(/^(\d+) (\w+) damage(?: \((.*)\))?\.?$/i);
  if(dealt)return {type:'damage',amount:Number(dealt[1]),damageType:damageKind(dealt[2]),math:dealt[3]??''};
  const d=dice(text);
  if(d){
   const head=text.match(/^(.+?):\s/)?.[1]??'',save=/ save d20/.test(text),initiative=/initiative$/i.test(head)||/initiative:/.test(text);
   const target=text.match(/vs (your )?(AC|DC) (\d+)/),total=Number(text.match(/= (\d+)(?: vs|\.)/)?.[1]??NaN);
   const foe=!!target?.[1]||/ attacks you:/.test(text);
   let title=head.replace(/^You use /,'').replace(/ against /,' → ');
   const extra=text.match(/[;:] (\d+) (\w+) damage/);
   // Whatever follows the verdict ("You find the latch.") is the outcome in words.
   const after=text.replace(/^.*?(?:Critical hit!?|\bHit\b\.?|\bMiss\b\.?|\bSuccess\b\.?|\bFailure\b\.?|: (?:success|failure))[;.]?\s*/,'');
   const outcome=after!==text?after.replace(/^\d+ \w+ damage(?: \([^)]*\))?[.;]?\s*/,'').replace(/^Damage \d+d\d+ \[[\d, ]+\] = \d+[^.]*\.\s*/,'').trim():'';
   return {type:initiative?'initiative':save?'save':'roll',title,actor:foe?'foe':'you',natural:d.natural,rolls:d.rolls,mode:d.mode,total:Number.isFinite(total)?total:null,
    target:target?target[2]+' '+target[3]:null,verdict:verdictOf(text,save),math:mathOf(text,d.natural),damage:extra?{amount:Number(extra[1]),damageType:damageKind(extra[2])}:null,outcome};
  }
 }
 return {type:'text',text};
}
export const verdictLabels={crit:'Critical',hit:'Hit',miss:'Miss',success:'Success',failure:'Failed',saved:'Saved',failed:'Failed save'};
