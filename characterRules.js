import { equipmentFor, equipmentError } from './equipmentRules';
import { currentSaveVersion } from './saveVersion';
export const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
export const standardArray = [15, 14, 13, 12, 10, 8];
// What a hero may be: the classes and species of the System Reference Document 5.2 and the Half-Elf of the SRD 5.1
// (both licensed by Wizards of the Coast under CC BY 4.0), plus two options the host chose to keep that are written
// in Questbound's own words and take no text from any other book: the Artificer class and the Goblin species. Names
// and game mechanics are not copyrightable; only another book's wording would be, and none is used.
// `legacyClasses` and `legacySpecies` hold options once offered and since withdrawn, so saved heroes still pass the checks.
export const classes = ['Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
export const legacyClasses = [];
// The elves are offered as three species of their own (the host, 2026-10-11: "make sure wood elf and high elf are two
// different classes with their respective values"): High Elf, Wood Elf and Drow, each the SRD 5.2 Elf with its
// lineage, listed together as the Elves (`speciesGroups`; the host, 2026-10-12: "maybe drow should be listed under
// the elves with the others."). A plain 'Elf' (offered until then, its lineage chosen in the builder) stays valid for
// saved heroes and reads as the species its lineage names (`heroSpecies`); one made before lineages reads as a High
// Elf. A 'Dark Elf' (the Drow's name until 2026-10-12) stays valid too and reads as a Drow; neither is rewritten.
export const species = ['Dragonborn', 'Dwarf', 'High Elf', 'Wood Elf', 'Drow', 'Gnome', 'Goblin', 'Goliath', 'Half-Elf', 'Halfling', 'Human', 'Orc', 'Tiefling'];
export const legacySpecies = ['Elf', 'Dark Elf'];
// Species shown together in the builder under one heading, at the place of the first.
export const speciesGroups = [{name: 'Elves', members: ['High Elf', 'Wood Elf', 'Drow'], note: 'One long-lived people of three lineages: keen senses, fey ancestry and a trance in place of sleep.'}];
// Lineages a species can choose (SRD 5.2); each grants its own spells (spellOptions.js lineageSpells). A Drow (or an
// old Dark Elf) is always of the Drow lineage, a High Elf and a Wood Elf of their own (`fixedLineage`); a Gnome or
// Tiefling chooses, and one made before lineages were offered has none.
export const speciesLineages = {Drow:['Drow'], 'Dark Elf':['Drow'], 'High Elf':['High Elf'], 'Wood Elf':['Wood Elf'], Elf:['High Elf','Wood Elf'], Gnome:['Forest Gnome','Rock Gnome'], Tiefling:['Abyssal','Chthonic','Infernal']};
export const fixedLineage = {Drow:'Drow', 'Dark Elf':'Drow', 'High Elf':'High Elf', 'Wood Elf':'Wood Elf'};
// The kind a species belongs to, for whatever is keyed on it (elves do not sleep, portraits, how strangers see them).
export const baseSpeciesOf = name => ['Drow','Dark Elf','High Elf','Wood Elf'].includes(name) ? 'Elf' : name;
// A species as players see it: an old 'Dark Elf' is called a Drow (a name alone, as in a roster's summary).
export const speciesName = name => name === 'Dark Elf' ? 'Drow' : name;
// The species a hero is, as the game shows and plays it: an old 'Elf' is the species its lineage names, and one
// without a lineage (made before lineages) a High Elf, the elf who keeps a speed of 30 feet as before; an old
// 'Dark Elf' is a Drow.
export function heroSpecies(hero) {
  const name = hero?.species ?? hero?.race ?? '';
  if (name !== 'Elf') return speciesName(name);
  return hero?.lineage === 'Wood Elf' ? 'Wood Elf' : 'High Elf';
}
// What each species is, as the game plays it (SRD 5.2, the Half-Elf of SRD 5.1; the Goblin is Questbound's own), in
// Questbound's own words: size, speed and darkvision in feet, and its traits. A trait marked true is applied by the
// rules themselves (hit points, spells, a skill); the Dungeon Master weighs the others from context.player.
const elfTraits = [
  ['Fey Ancestry','Advantage on saving throws to avoid or end being charmed.'],
  ['Keen Senses','Trained in Insight, Perception or Survival (chosen when made; Perception for elves made before).',true],
  ['Trance','Four hours of quiet trance give a long rest, and magic cannot put you to sleep.'],
];
export const speciesTraits = {
  Dragonborn: {speed:30,darkvision:60,traits:[['Draconic Ancestry','Your dragon forebear sets the kind of energy you breathe and resist.'],['Breath Weapon','In place of one attack, breathe your energy in a cone or a line; as many uses as your proficiency bonus each long rest.'],['Damage Resistance','Resistance to the damage of your ancestry.'],['Draconic Flight','From level 5, spectral wings let you fly for 10 minutes once a long rest.']]},
  Dwarf: {speed:30,darkvision:120,traits:[['Dwarven Resilience','Resistance to poison damage, and advantage on saving throws against being poisoned.'],['Dwarven Toughness','One more hit point at every level.',true],['Stonecunning','As a bonus action, sense through stone within 60 feet; as many uses as your proficiency bonus each long rest.']]},
  'High Elf': {speed:30,darkvision:60,traits:[...elfTraits,['High Elf lineage','You know Prestidigitation; at level 3 Detect Magic and at level 5 Misty Step, each once a long rest without a slot. These come with your lineage, whatever your class.',true]]},
  'Wood Elf': {speed:35,darkvision:60,traits:[...elfTraits,['Wood Elf lineage','Your speed is 35 feet. You know Druidcraft; at level 3 Longstrider and at level 5 Pass without Trace, each once a long rest without a slot. These come with your lineage, whatever your class.',true]]},
  Drow: {speed:30,darkvision:120,traits:[...elfTraits,['Drow lineage','Darkvision out to 120 feet. You know Dancing Lights; at level 3 Faerie Fire and at level 5 Darkness, each once a long rest without a slot. These come with your lineage, whatever your class.',true]]},
  Gnome: {size:'Small',speed:30,darkvision:60,traits:[['Gnomish Cunning','Advantage on Intelligence, Wisdom and Charisma saving throws.'],['Gnomish Lineage','Forest or Rock Gnome: the spells your lineage gives.',true]]},
  Goblin: {size:'Small',speed:30,darkvision:60,traits:[['Slippery','A knack for slipping out of danger, which the Dungeon Master weighs in your favour.']]},
  Goliath: {speed:35,darkvision:0,traits:[['Giant Ancestry','A boon from your giant forebears, usable a few times each long rest.'],['Large Form','From level 5, grow to Large for 10 minutes once a long rest.'],['Powerful Build','Advantage on escaping a grapple, and you carry as one size larger.']]},
  'Half-Elf': {speed:30,darkvision:60,traits:[['Fey Ancestry','Advantage on saving throws against being charmed, and magic cannot put you to sleep.'],['Skill Versatility','Trained in two skills of your choice.']]},
  Halfling: {size:'Small',speed:30,darkvision:0,traits:[['Brave','Advantage on saving throws against being frightened.'],['Halfling Nimbleness','You can move through the space of anyone larger than you.'],['Luck','When you roll a 1 on a d20 test, you may roll again.'],['Naturally Stealthy','You can hide behind someone larger than you.']]},
  Human: {speed:30,darkvision:0,traits:[['Resourceful','Heroic Inspiration after every long rest.'],['Skillful','Trained in one more skill.'],['Versatile','A second origin talent.']]},
  Orc: {speed:30,darkvision:120,traits:[['Adrenaline Rush','Dash as a bonus action and gain temporary hit points; as many uses as your proficiency bonus each rest.'],['Relentless Endurance','Once a long rest, drop to 1 hit point instead of 0.']]},
  Tiefling: {speed:30,darkvision:60,traits:[['Fiendish Legacy','Abyssal, Chthonic or Infernal: a resistance and the spells your legacy gives.',true],['Otherworldly Presence','You know Thaumaturgy, whatever your class.',true]]},
};
// The species a hero is (an old Elf as its lineage) with its size, speed and darkvision and its traits; a name works too.
export function speciesProfile(hero) {
  const name = heroSpecies(typeof hero === 'string' ? {species:hero} : hero), known = speciesTraits[name] ?? {speed:30,darkvision:0,traits:[]};
  return {species:name, size:known.size ?? 'Medium', speed:known.speed, darkvision:known.darkvision, traits:known.traits.map(([trait,brief,game])=>({name:trait,brief,played:game?'game':'story'}))};
}
// Keen Senses (every elf): one of three skills, chosen in the builder (form.keenSense); Perception when not chosen.
export const keenSenseSkills = ['Insight','Perception','Survival'];
export function speciesSkills(hero) {
  if (baseSpeciesOf(heroSpecies(hero)) !== 'Elf') return [];
  return [keenSenseSkills.includes(hero?.keenSense) ? hero.keenSense : 'Perception'];
}
export const backgrounds = {
  Artisan: {abilities: ['Strength', 'Dexterity', 'Intelligence'], feat: 'Crafter'},
  Charlatan: {abilities: ['Dexterity', 'Constitution', 'Charisma'], feat: 'Skilled'},
  Entertainer: {abilities: ['Strength', 'Dexterity', 'Charisma'], feat: 'Musician'},
  Farmer: {abilities: ['Strength', 'Constitution', 'Wisdom'], feat: 'Tough'},
  Guard: {abilities: ['Strength', 'Intelligence', 'Wisdom'], feat: 'Alert'},
  Guide: {abilities: ['Dexterity', 'Constitution', 'Wisdom'], feat: 'Magic Initiate (Druid)'},
  Hermit: {abilities: ['Constitution', 'Wisdom', 'Charisma'], feat: 'Healer'},
  Merchant: {abilities: ['Constitution', 'Intelligence', 'Charisma'], feat: 'Lucky'},
  Noble: {abilities: ['Strength', 'Intelligence', 'Charisma'], feat: 'Skilled'},
  Sailor: {abilities: ['Strength', 'Dexterity', 'Wisdom'], feat: 'Tavern Brawler'},
  Scribe: {abilities: ['Dexterity', 'Intelligence', 'Wisdom'], feat: 'Skilled'},
  Wayfarer: {abilities: ['Dexterity', 'Wisdom', 'Charisma'], feat: 'Lucky'},
  Acolyte: {abilities: ['Intelligence', 'Wisdom', 'Charisma'], feat: 'Magic Initiate (Cleric)'},
  Criminal: {abilities: ['Dexterity', 'Constitution', 'Intelligence'], feat: 'Alert'},
  Sage: {abilities: ['Constitution', 'Intelligence', 'Wisdom'], feat: 'Magic Initiate (Wizard)'},
  Soldier: {abilities: ['Strength', 'Dexterity', 'Constitution'], feat: 'Savage Attacker'},
};
export const validLevel = level => Number.isInteger(level) && level >= 1 && level <= 20;
export const proficiencyBonus = level => validLevel(level) ? 2 + Math.floor((level-1)/4) : 0;
export const martialDie = level => level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6;
// Subclasses renamed since heroes could plan them: a hero who planned the old name keeps the subclass and all it does.
// Subclasses renamed because the old name was a published book's (every old name stays a valid plan and plays as the
// new one; saves keep the name they were written with: currentSubclass reads it). The Artificer's four on 2026-10-22.
export const renamedSubclasses = {'Warrior of the Hidden Step': 'Warrior of the Quiet Step', Alchemist: 'Draughtwright', Armorer: 'Platewright', Artillerist: 'Siegewright', 'Battle Smith': 'Steelwright'};
export function currentSubclass(name) { return Object.hasOwn(renamedSubclasses, name ?? '') ? renamedSubclasses[name] : name; }
export const subclassActive = (hero,name) => hero.level >= 3 && currentSubclass(hero.plannedSubclass) === name;
export const advancementLevels = name => [4,8,12,16,...(name === 'Fighter' ? [6,14] : name === 'Rogue' ? [10] : [])].sort((a,b)=>a-b);
export const modifier = score => Math.floor((score - 10) / 2);
// Developer heroes (the builder's developer options) carry a level and ability scores set freely for testing, in
// place of the standard array and background increases. Improvements earned by levelling up after that still count.
export const validDevScores = value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === abilities.length && abilities.every(name => Number.isInteger(value[name]) && value[name] >= 1 && value[name] <= 20);
export function blankBuild() {
  return {plannedSubclass: '', spells: [], spellbook: [], name: '', description: '', species: '', class: '', background: '', fighterKit: 'melee', instrument: 'Flute', baseScores: [...standardArray], bonusMode: 'split', plusTwo: '', plusOne: ''};
}
export function buildError(form) {
  for(const key of ['age','backstory','connections','ideals','bonds','flaws'])if(form[key]!==undefined&&(typeof form[key]!=='string'||form[key].length>(key==='age'?60:2000)))return 'Keep '+key+' within its character limit.';
  if (form.description !== undefined && (typeof form.description !== 'string' || form.description.length > 1500)) return 'Keep appearance and personality within 1,500 characters.';
  if (!form.name?.trim() || form.name.length > 60) return 'Enter a character name (up to 60 characters).';
  if (!(species.includes(form.species) || legacySpecies.includes(form.species)) || !(classes.includes(form.class) || legacyClasses.includes(form.class))) return 'Choose a species and class from the available options.';
  if (form.lineage !== undefined && form.lineage !== null && !speciesLineages[form.species]?.includes(form.lineage)) return 'Choose a lineage your species has.';
  if (form.keenSense !== undefined && form.keenSense !== null && (!keenSenseSkills.includes(form.keenSense) || baseSpeciesOf(heroSpecies(form)) !== 'Elf')) return 'Choose Insight, Perception or Survival for Keen Senses.';
  const bg = backgrounds[form.background];
  if (!bg) return 'Choose a background.';
  if (!Array.isArray(form.baseScores) || JSON.stringify([...form.baseScores].sort((a,b)=>b-a)) !== JSON.stringify(standardArray)) return 'Assign each standard-array score exactly once.';
  if (!['split', 'three'].includes(form.bonusMode)) return 'Choose a background bonus option.';
  if (form.bonusMode === 'split' && (!bg.abilities.includes(form.plusTwo) || !bg.abilities.includes(form.plusOne) || form.plusTwo === form.plusOne)) return 'Choose different eligible abilities for +2 and +1.';
  if(form.advancements !== undefined && (!Array.isArray(form.advancements) || form.advancements.some((a,i,all)=>!advancementLevels(form.class).includes(a.level) || a.level>(form.level??1) || all.findIndex(b=>b.level===a.level)!==i || !Array.isArray(a.abilities) || a.abilities.length!==2 || a.abilities.some(v=>!abilities.includes(v))))) return 'Check your level-up ability choices.';
  if(form.devScores !== undefined && !validDevScores(form.devScores)) return 'Developer ability scores must be whole numbers from 1 to 20.';
  if(form.devLevel !== undefined && !validLevel(form.devLevel)) return 'The developer level must be between 1 and 20.';
  if(!validPortraitChoice(form.portrait)) return 'Choose a ready-made face or your own painting for your portrait.';
  if(Object.values(finalScores(form)).some(score=>score>20)) return 'Ability improvements cannot raise a score above 20.';
  return '';
}
// The hero's portrait (2026-10-17, the host: "Free hero portraits by default: offer each new hero a matching library
// face right away, with an optional 'paint my own'"): none (a hero from before, or one whose face the server keeps:
// the hero's own painting if one was made, else a ready-made face chosen to fit them), a face from the host's people
// library ({library:'np123'}, or a face only painted in play, {library:'nf012'}), or the hero's own painting
// ({painted:<the look it was painted for>}: worldArtRules.js heroPaintingChoice, so a later change of words never paints
// again by itself).
export function validPortraitChoice(value) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1) return false;
  if (keys[0] === 'library') return typeof value.library === 'string' && /^(?:np\d{3}|nf\d{3,4})$/.test(value.library);
  if (keys[0] === 'painted') return typeof value.painted === 'string' && /^[0-9a-z]{1,13}(?:-w)?$/.test(value.painted);
  return false;
}
export function finalScores(form) {
  const later = name => (form.advancements??[]).filter(a=>a.level>(form.devLevel??20)).reduce((sum,a)=>sum+a.abilities.filter(v=>v===name).length,0);
  if (validDevScores(form.devScores)) return Object.fromEntries(abilities.map(name => [name, form.devScores[name] + later(name)]));
  const eligible = backgrounds[form.background]?.abilities ?? [];
  return Object.fromEntries(abilities.map((name, i) => [name, form.baseScores[i] + (form.advancements??[]).reduce((sum,a)=>sum+a.abilities.filter(v=>v===name).length,0) + (form.bonusMode === 'three' ? (eligible.includes(name) ? 1 : 0) : (form.plusTwo === name ? 2 : form.plusOne === name ? 1 : 0))]));
}
export function makeCharacter(form) {
  const error = buildError(form);
  if (error) throw new Error(error);
  return {...form, spellSelectionVersion: 2, equipment: equipmentFor(form), baseSpecies: baseSpeciesOf(form.species), lineage: fixedLineage[form.species] ?? (speciesLineages[form.species]?.includes(form.lineage) ? form.lineage : null), name: form.name.trim(), race: form.species, level: validLevel(form.level) ? form.level : 1, rulesVersion: '2024', schemaVersion: 2, scores: finalScores(form), originFeat: backgrounds[form.background].feat, saveVersion: currentSaveVersion};
}



