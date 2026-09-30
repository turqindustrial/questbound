import catalog from './spellCatalog.json';
import progression from './spellProgression.json';
export const spellLibrary=catalog;
export function spellLimits(hero) {
  const level=hero.level ?? 1;
  if(!Number.isInteger(level) || level<1 || level>20) return null;
  const row=progression[hero.class]?.[level-1];
  return row ? {...row,book:hero.class==='Wizard'?6+2*(level-1):0} : null;
}
export const subclassSpells = {
  'Life Domain':{3:['aid','bless','cure','lesser-restoration'],5:['mass-healing-word','revivify'],7:['aura-of-life','death-ward'],9:['greater-restoration','mass-cure-wounds']},
  'Oath of Devotion':{3:['protection-from-evil-and-good','shield-of-faith'],5:['aid','zone-of-truth'],9:['beacon-of-hope','dispel-magic'],13:['freedom-of-movement','guardian-of-faith'],17:['commune','flame-strike']},
  'Draconic Sorcery':{3:['alter-self','chromatic-orb','command','dragons-breath'],5:['fear','fly'],7:['arcane-eye','charm-monster'],9:['legend-lore','summon-dragon']},
  'Fiend Patron':{3:['burning-hands','command','scorching-ray','suggestion'],5:['fireball','stinking-cloud'],7:['fire-shield','wall-of-fire'],9:['geas','insect-plague']},
};
export function automaticSpells(hero) {
  const base=hero.class==='Artificer'?['mending']:hero.class==='Druid'?['speak-with-animals']:hero.class==='Ranger'?["hunters-mark"]:[];
  if(hero.class==='Paladin' && hero.level>=2)base.push('divine-smite');
  if(hero.class==='Warlock' && hero.level>=9)base.push('contact-other-plane');
  const validClass={'Life Domain':'Cleric','Oath of Devotion':'Paladin','Draconic Sorcery':'Sorcerer','Fiend Patron':'Warlock'};
  if(hero.level>=3 && validClass[hero.plannedSubclass]===hero.class)for(const [level,ids] of Object.entries(subclassSpells[hero.plannedSubclass]??{}))if(hero.level>=Number(level))base.push(...ids);
  return [...new Set(base)].filter(id=>spellLibrary.some(s=>s.id===id));
}
export function spellSlots(hero) {return spellLimits(hero)?.slots??Array(9).fill(0);}
export function slotUsed(game,level) {return game.spellSlotsUsed?.[level-1] ?? (level===1 ? game.resources?.slots??0 : 0);}
export function slotChoices(hero,game,spell) {
  if(spell.level===0)return [0];
  return spellSlots(hero).flatMap((count,index)=>index+1>=spell.level && count>slotUsed(game,index+1)?[index+1]:[]);
}
export function spellsForClass(name,level=1) {
  const limits=spellLimits({class:name,level});
  if(!limits)return [];
  return spellLibrary.filter(spell=>(spell.classes.includes(name) || (name==='Bard' && level>=10 && spell.level>0 && spell.classes.some(c=>['Cleric','Druid','Wizard'].includes(c)))) && spell.level<=limits.maxSpellLevel && (spell.level>0 || limits.cantrips>0));
}
export function spellSelectionError(hero,required=true) {
  const limits=spellLimits(hero),options=[...spellsForClass(hero.class,hero.level??1),...spellLibrary.filter(s=>automaticSpells(hero).includes(s.id))];
  if(hero.spells===undefined && !required)return '';
  const selected=hero.spells??[];
  if(!Array.isArray(selected) || new Set(selected).size!==selected.length || !selected.every(id=>options.some(s=>s.id===id)))return 'Choose spells from your class and level list.';
  if(!required && hero.spellSelectionVersion!==2)return '';
  if(hero.arcanum!==undefined && (hero.arcanum===null || typeof hero.arcanum!=='object' || Array.isArray(hero.arcanum) || Object.entries(hero.arcanum).some(([level,id])=>hero.class!=='Warlock' || ![6,7,8,9].includes(Number(level)) || hero.level<2*Number(level)-1 || !spellLibrary.some(s=>s.id===id && s.level===Number(level) && s.classes.includes('Warlock')))))return 'Choose an eligible Mystic Arcanum spell for each unlocked level.';
  if(hero.advancementVersion===1 && hero.class==='Warlock' && [6,7,8,9].some(level=>hero.level>=2*level-1 && !hero.arcanum?.[level]))return 'Choose each unlocked Mystic Arcanum spell.';
  if(!limits)return selected.length?'This class has no base spellcasting at this level.':'';
  const auto=automaticSpells(hero);
  const cantrips=options.filter(s=>s.level===0 && selected.includes(s.id) && !auto.includes(s.id));
  const prepared=options.filter(s=>s.level>0 && selected.includes(s.id) && !auto.includes(s.id));
  if(cantrips.length!==limits.cantrips)return `Choose exactly ${limits.cantrips} cantrips (${cantrips.length} selected).`;
  if(prepared.length!==limits.prepared)return `Prepare exactly ${limits.prepared} spells (${prepared.length} selected).`;
  if(limits.book){
    const book=hero.spellbook??[];
    if(!Array.isArray(book) || new Set(book).size!==book.length || book.length!==limits.book || !book.every(id=>options.some(s=>s.id===id && s.level>0)))return `Choose ${limits.book} different spells for your spellbook.`;
    if(!prepared.every(s=>book.includes(s.id)))return 'Prepare spells from your spellbook.';
  }
  return '';
}
