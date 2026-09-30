import {blankBuild,makeCharacter} from './characterRules';
// Ready-made heroes for a quick start: complete, rules-valid level 1 characters a new player can take straight into
// an adventure. Scores follow the standard array (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma).
export const readyHeroes=[
 {key:'fighter',glyph:'⚔',role:'Easiest to play',tagline:'Heavy armor and a greatsword. Shrugs off blows and hits hard.',form:{
  name:'Kara Vell',species:'Human',class:'Fighter',background:'Soldier',fighterKit:'melee',baseScores:[15,13,14,8,12,10],plusTwo:'Strength',plusOne:'Constitution',age:'29',
  description:'A broad-shouldered veteran with a scarred jaw, cropped copper hair and a grin she saves for bad odds.',
  backstory:'Kara held a border fort through a hard winter, then walked away when the war turned ugly. She sells her sword to caravans now, and keeps the promises the army never did.'}},
 {key:'rogue',glyph:'✦',role:'Quick and cunning',tagline:'Light on their feet, sharp with a blade, hard to pin down.',form:{
  name:'Pip Thistledown',species:'Halfling',class:'Rogue',background:'Criminal',baseScores:[8,15,14,12,10,13],plusTwo:'Dexterity',plusOne:'Constitution',age:'34',
  description:'A small, quick halfling with bright eyes, a patched green coat and more pockets than seem reasonable.',
  backstory:'Pip grew up running messages, and later locks, for a thieves’ guild. When the guild sold out a friend, Pip left with the ledger and a price on their head.'}},
 {key:'wizard',glyph:'✧',role:'Powerful magic',tagline:'Fragile but fierce: fire bolts, magic missiles and a spellbook of tricks.',form:{
  name:'Ilyra Dawnmere',species:'Elf',class:'Wizard',background:'Sage',baseScores:[8,14,13,15,12,10],plusTwo:'Intelligence',plusOne:'Constitution',age:'112',
  spells:['fire-bolt','ray-of-frost','shock','missile','burning-hands','false-life','detect-magic'],spellbook:['missile','burning-hands','false-life','detect-magic','shield','sleep'],
  description:'A slender elf with ink-stained fingers, silver-streaked black hair and a spellbook bound in blue leather.',
  backstory:'Ilyra spent a century copying other wizards’ spells in a quiet library. One of those spells opened a door that should have stayed shut, and she has been chasing what came through ever since.'}},
 {key:'cleric',glyph:'✚',role:'Heals and protects',tagline:'Heals wounds, shields allies and smites foes with radiant light.',form:{
  name:'Borin Emberhand',species:'Dwarf',class:'Cleric',background:'Acolyte',baseScores:[14,8,13,10,15,12],plusTwo:'Wisdom',plusOne:'Charisma',age:'86',
  spells:['sacred-flame','guidance','thaumaturgy','cure','healing-word','shield-of-faith','inflict-wounds'],
  description:'A stout dwarf priest with a braided grey beard, a hammer-shaped holy symbol and a laugh that fills a room.',
  backstory:'Borin tended the forge-shrine of a mountain town until a sickness no prayer could stop emptied it. He travels to learn why, healing whoever he meets on the road.'}},
];
export function readyHero(key){const entry=readyHeroes.find(h=>h.key===key);return entry?makeCharacter({...blankBuild(),...entry.form,level:1,advancements:[],spellSelectionVersion:2}):null;}
