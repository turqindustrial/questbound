import catalog from './spellCatalog.json';
import progression from './spellProgression.json';
import {speciesLineages,fixedLineage,heroSpecies,currentSubclass} from './characterRules';
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
  // Questbound's own subclasses (subclassOptions.js): always prepared from the levels shown. A Wardblade Fighter and a
  // Trickwright Rogue learn cantrips only (Intelligence, spellRules.js castingAbility).
  'Hearth Domain':{3:['burning-hands','heroism','heat-metal','flaming-sphere'],5:['daylight','protection-from-energy'],7:['fire-shield','stone-shape'],9:['flame-strike','creation']},
  'Vigil Domain':{3:['shield-of-faith','command','spiritual-weapon','warding-bond'],5:['spirit-guardians','magic-circle'],7:['guardian-of-faith','freedom-of-movement'],9:['hallow','hold-monster']},
  'Threshold Domain':{3:['false-life','bane','gentle-repose','ray-of-enfeeblement'],5:['speak-with-dead','revivify'],7:['death-ward','blight'],9:['raise-dead','antilife-shell']},
  'Circle of the Thornwall':{3:['entangle','ensnaring-strike','barkskin','spike-growth'],5:['plant-growth','wind-wall'],7:['stoneskin','conjure-woodland-beings'],9:['wall-of-stone','tree-stride']},
  'Circle of the Fallow Field':{3:['ray-of-sickness','false-life','blindnessdeafness','gentle-repose'],5:['stinking-cloud','plant-growth'],7:['blight','giant-insect'],9:['contagion','insect-plague']},
  'Circle of the Hollow Hill':{3:['sleep','faerie-fire','invisibility','pass-without-trace'],5:['plant-growth','meld-into-stone'],7:['hallucinatory-terrain','dimension-door'],9:['dream','tree-stride']},
  'Wardblade':{3:['shock','fire-bolt']},
  'Oath of the Open Road':{3:['sanctuary','longstrider'],5:['warding-bond','find-steed'],9:['create-food-and-water','water-walk'],13:['freedom-of-movement','locate-creature'],17:['tree-stride','commune-with-nature']},
  'Oath of Ashes':{3:['searing-smite','hellish-rebuke'],5:['heat-metal','misty-step'],9:['fireball','fear'],13:['fire-shield','locate-creature'],17:['flame-strike','geas']},
  'Oath of the Living Wood':{3:['goodberry','entangle'],5:['barkskin','lesser-restoration'],9:['plant-growth','water-walk'],13:['giant-insect','freedom-of-movement'],17:['tree-stride','wall-of-stone']},
  'Trailbreaker':{3:['longstrider'],5:['pass-without-trace'],9:['water-walk'],13:['freedom-of-movement'],17:['tree-stride']},
  'Barrow Warden':{3:['protection-from-evil-and-good'],5:['see-invisibility'],9:['speak-with-dead'],13:['death-ward'],17:['dispel-evil-and-good']},
  'Packbound':{3:['animal-friendship'],5:['animal-messenger'],9:['conjure-animals'],13:['dominate-beast'],17:['commune-with-nature']},
  'Trickwright':{3:['mage-hand','minor-illusion','shock']},
  'Frostblood Sorcery':{3:['ice-knife','fog-cloud','gust-of-wind','hold-person'],5:['sleet-storm','protection-from-energy'],7:['ice-storm','stoneskin'],9:['cone-of-cold','wall-of-stone']},
  'Veilborn Sorcery':{3:['disguise-self','silent-image','invisibility','darkness'],5:['blink','major-image'],7:['greater-invisibility','hallucinatory-terrain'],9:['mislead','seeming']},
  'Saintblood Sorcery':{3:['cure','bless'],5:['aid','lesser-restoration','revivify','daylight'],7:['death-ward','guardian-of-faith'],9:['greater-restoration','mass-cure-wounds']},
  'Lantern-Keeper Patron':{3:['healing-word','faerie-fire','continual-flame','see-invisibility'],5:['daylight','sending'],7:['locate-creature','guardian-of-faith'],9:['commune','greater-restoration']},
  'Elder Grove Patron':{3:['entangle','goodberry','barkskin','spike-growth'],5:['plant-growth','speak-with-plants'],7:['conjure-woodland-beings','giant-insect'],9:['tree-stride','awaken']},
  'Whispering Void Patron':{3:['silent-image','command','mind-spike','blindnessdeafness'],5:['fear','tongues'],7:['arcane-eye','resilient-sphere'],9:['scrying','dream']},
  'Snarewright':{3:['grease','alarm'],5:['web','spike-growth'],9:['glyph-of-warding','sleet-storm'],13:['black-tentacles','stone-shape'],17:['wall-of-stone','hold-monster']},
};
// The class each subclass that grants spells belongs to; a hero of another class who planned it gets none.
export const subclassSpellClass={'Life Domain':'Cleric','Oath of Devotion':'Paladin','Draconic Sorcery':'Sorcerer','Fiend Patron':'Warlock','Hearth Domain':'Cleric','Vigil Domain':'Cleric','Threshold Domain':'Cleric','Circle of the Thornwall':'Druid','Circle of the Fallow Field':'Druid','Circle of the Hollow Hill':'Druid',Wardblade:'Fighter','Oath of the Open Road':'Paladin','Oath of Ashes':'Paladin','Oath of the Living Wood':'Paladin',Trailbreaker:'Ranger','Barrow Warden':'Ranger',Packbound:'Ranger',Trickwright:'Rogue','Frostblood Sorcery':'Sorcerer','Veilborn Sorcery':'Sorcerer','Saintblood Sorcery':'Sorcerer','Lantern-Keeper Patron':'Warlock','Elder Grove Patron':'Warlock','Whispering Void Patron':'Warlock',Snarewright:'Artificer'};
export function automaticSpells(hero) {
  const base=hero.class==='Artificer'?['mending']:hero.class==='Druid'?['speak-with-animals']:hero.class==='Ranger'?["hunters-mark"]:[];
  if(hero.class==='Paladin' && hero.level>=2)base.push('divine-smite');
  if(hero.class==='Warlock' && hero.level>=9)base.push('contact-other-plane');
  if(hero.level>=3 && subclassSpellClass[currentSubclass(hero.plannedSubclass)]===hero.class)for(const [level,ids] of Object.entries(subclassSpells[currentSubclass(hero.plannedSubclass)]??{}))if(hero.level>=Number(level))base.push(...ids);
  return [...new Set(base)].filter(id=>spellLibrary.some(s=>s.id===id));
}
// Spells a hero's species or lineage grants (SRD 5.2): a cantrip at once, and spells at character levels 3 and 5. Each
// spell of level 1 or more can be cast without a slot once per long rest (a Forest Gnome's Speak with Animals as many
// times as their proficiency bonus), and with spell slots by a hero who has them. These never count against the
// spells a class chooses. A Dark, High or Wood Elf is its own lineage; a Gnome or a Tiefling chooses a lineage when made
// (hero.lineage), and a hero made before that has none. Every Tiefling knows Thaumaturgy.
export const lineageSpells={
  Drow:[[1,'dancing-lights'],[3,'faerie-fire'],[5,'darkness']],
  'High Elf':[[1,'prestidigitation'],[3,'detect-magic'],[5,'misty-step']],
  'Wood Elf':[[1,'druidcraft'],[3,'longstrider'],[5,'pass-without-trace']],
  'Forest Gnome':[[1,'minor-illusion'],[1,'speak-with-animals']],
  'Rock Gnome':[[1,'mending'],[1,'prestidigitation']],
  Abyssal:[[1,'poison-spray'],[3,'ray-of-sickness'],[5,'hold-person']],
  Chthonic:[[1,'chill-touch'],[3,'false-life'],[5,'ray-of-enfeeblement']],
  Infernal:[[1,'fire-bolt'],[3,'hellish-rebuke'],[5,'darkness']],
};
// A Dark, High or Wood Elf has its own lineage; an old 'Elf' the one it chose, or a High Elf's when it chose none
// (characterRules.js heroSpecies).
export const heroLineage=hero=>{const species=hero?.species??hero?.race;if(fixedLineage[species])return fixedLineage[species];if(species==='Elf')return fixedLineage[heroSpecies(hero)];return speciesLineages[species]?.includes(hero?.lineage)?hero.lineage:null;};
export function speciesSpells(hero) {
  const level=hero?.level??1,species=hero?.species??hero?.race,lineage=heroLineage(hero);
  const ids=[...(species==='Tiefling'?['thaumaturgy']:[]),...(lineageSpells[lineage]??[]).filter(([from])=>level>=from).map(([,id])=>id)];
  return [...new Set(ids)].filter(id=>spellLibrary.some(s=>s.id===id));
}
// Where a species spell comes from, said wherever spells are listed (the host, 2026-10-21, of a Wood Elf Monk who knew
// Druidcraft "without any multiclasses": it is the Wood Elf lineage's cantrip). The lineage or species that grants it
// ('Wood Elf', 'Forest Gnome', 'Infernal Tiefling', 'Tiefling' for every Tiefling's Thaumaturgy), or null for a spell
// the hero's class gives them too.
export function speciesSpellSource(hero,id){
  if(!speciesSpells(hero).includes(id)||(hero?.spells??[]).includes(id)||automaticSpells(hero).includes(id))return null;
  const lineage=heroLineage(hero),species=heroSpecies(hero);
  if(!(lineageSpells[lineage]??[]).some(([,spell])=>spell===id))return species;
  return species==='Tiefling'?lineage+' Tiefling':lineage;
}
export const spellSourceLine=(hero,id)=>{const source=speciesSpellSource(hero,id);return source?'A gift of your '+source+' '+(/Tiefling$/.test(source)?'heritage':'lineage')+', not of your class.':null;};
// How many times a species spell can be cast without a slot between long rests.
export function speciesUseLimit(hero,id) {
  const spell=spellLibrary.find(s=>s.id===id);if(!spell||spell.level===0||!speciesSpells(hero).includes(id))return 0;
  return heroLineage(hero)==='Forest Gnome'&&id==='speak-with-animals'?2+Math.floor(((hero.level??1)-1)/4):1;
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
