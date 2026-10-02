import { equipmentFor, equipmentError } from './equipmentRules';
export const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
export const standardArray = [15, 14, 13, 12, 10, 8];
// What a hero may be: the classes and species of the System Reference Document 5.2 and the Half-Elf of the SRD 5.1
// (both licensed by Wizards of the Coast under CC BY 4.0), plus two options the host chose to keep that are written
// in Questbound's own words and take no text from any other book: the Artificer class and the Goblin species. Names
// and game mechanics are not copyrightable; only another book's wording would be, and none is used.
// `legacyClasses` and `legacySpecies` hold options once offered and since withdrawn, so saved heroes still pass the checks.
export const classes = ['Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
export const legacyClasses = [];
export const species = ['Dragonborn', 'Dwarf', 'Elf', 'Dark Elf', 'Gnome', 'Goblin', 'Goliath', 'Half-Elf', 'Halfling', 'Human', 'Orc', 'Tiefling'];
export const legacySpecies = [];
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
export const subclassActive = (hero,name) => hero.level >= 3 && hero.plannedSubclass === name;
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
  const bg = backgrounds[form.background];
  if (!bg) return 'Choose a background.';
  if (!Array.isArray(form.baseScores) || JSON.stringify([...form.baseScores].sort((a,b)=>b-a)) !== JSON.stringify(standardArray)) return 'Assign each standard-array score exactly once.';
  if (!['split', 'three'].includes(form.bonusMode)) return 'Choose a background bonus option.';
  if (form.bonusMode === 'split' && (!bg.abilities.includes(form.plusTwo) || !bg.abilities.includes(form.plusOne) || form.plusTwo === form.plusOne)) return 'Choose different eligible abilities for +2 and +1.';
  if(form.advancements !== undefined && (!Array.isArray(form.advancements) || form.advancements.some((a,i,all)=>!advancementLevels(form.class).includes(a.level) || a.level>(form.level??1) || all.findIndex(b=>b.level===a.level)!==i || !Array.isArray(a.abilities) || a.abilities.length!==2 || a.abilities.some(v=>!abilities.includes(v))))) return 'Check your level-up ability choices.';
  if(form.devScores !== undefined && !validDevScores(form.devScores)) return 'Developer ability scores must be whole numbers from 1 to 20.';
  if(form.devLevel !== undefined && !validLevel(form.devLevel)) return 'The developer level must be between 1 and 20.';
  if(Object.values(finalScores(form)).some(score=>score>20)) return 'Ability improvements cannot raise a score above 20.';
  return '';
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
  return {...form, spellSelectionVersion: 2, equipment: equipmentFor(form), baseSpecies: form.species === 'Dark Elf' ? 'Elf' : form.species, lineage: form.species === 'Dark Elf' ? 'Drow' : null, name: form.name.trim(), race: form.species, level: validLevel(form.level) ? form.level : 1, rulesVersion: '2024', schemaVersion: 2, scores: finalScores(form), originFeat: backgrounds[form.background].feat};
}



