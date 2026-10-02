// The subclasses a hero may plan: for each class of the System Reference Document 5.2 exactly the one it licenses
// (Wizards of the Coast, CC BY 4.0), and for the Artificer, a Questbound option beyond the SRD, four specialities
// described in the game's own words. Nothing is taken from other books (see Licences in legalText.js).
// Features that the game plays out (the Fiend Patron's gift, the Champion's crits) are in classFeatureCatalog.json.
export const subclassOptions={
 Artificer: {
  Alchemist: 'Experiment with magical mixtures and restorative elixirs.',
  Armorer: 'Make enchanted armor the center of your adventuring craft.',
  Artillerist: 'Build magical artillery to support your allies.',
  'Battle Smith': 'Pair your magic with a mechanical companion and a steady blade.'
 },
 Barbarian: {
  "Path of the Berserker": "Channel your fury into relentless close combat."
 },
 Bard: {
  "College of Lore": "Gather knowledge and use wit and magic to influence a scene."
 },
 Cleric: {
  "Life Domain": "Devote your divine magic to healing and protecting life."
 },
 Druid: {
  "Circle of the Land": "Draw deeper magic from the landscapes around you."
 },
 Fighter: {
  Champion: "Refine athletic prowess and reliable weapon skills."
 },
 Monk: {
  "Warrior of the Open Hand": "Master precise unarmed techniques and control the flow of a fight."
 },
 Paladin: {
  "Oath of Devotion": "Commit yourself to honesty, courage, and protecting others."
 },
 Ranger: {
  Hunter: "Study dangerous prey and adapt your combat techniques to the hunt."
 },
 Rogue: {
  Thief: "Develop agility and a talent for making use of objects and opportunities."
 },
 Sorcerer: {
  "Draconic Sorcery": "Develop the draconic power behind your innate magic."
 },
 Warlock: {
  "Fiend Patron": "Explore a pact with a powerful being from the Lower Planes."
 },
 Wizard: {
  Evoker: "Specialize in shaping magical energy into potent spell effects."
 }
};
// Subclasses offered before 2026-10-02, when the game was limited to licensed content. A hero who planned one keeps
// it (the name stays on their sheet and goes to the Dungeon Master as flavour), but it is not offered to anyone new,
// and the game plays out none of its features.
export const legacySubclassOptions={
 Artificer: [
  "Artillerist",
  "Armorer",
  "Battle Smith",
  "Alchemist",
  "Cartographer"
 ],
 Barbarian: [
  "Path of the World Tree",
  "Path of the Berserker",
  "Path of the Zealot",
  "Path of the Wild Heart"
 ],
 Bard: [
  "College of Valor",
  "College of Glamour",
  "College of Lore",
  "College of Dance"
 ],
 Cleric: [
  "Light Domain",
  "War Domain",
  "Trickery Domain",
  "Life Domain"
 ],
 Druid: [
  "Circle of the Stars",
  "Circle of the Moon",
  "Circle of the Land",
  "Circle of the Sea"
 ],
 Fighter: [
  "Battle Master",
  "Eldritch Knight",
  "Psi Warrior",
  "Champion"
 ],
 Monk: [
  "Warrior of the Elements",
  "Warrior of Mercy",
  "Warrior of Shadow",
  "Warrior of the Open Hand"
 ],
 Paladin: [
  "Oath of the Noble Genies",
  "Oath of Vengeance",
  "Oath of Devotion",
  "Oath of the Ancients"
 ],
 Ranger: [
  "Gloom Stalker",
  "Fey Wanderer",
  "Beast Master",
  "Winter Walker"
 ],
 Rogue: [
  "Arcane Trickster",
  "Soulknife",
  "Thief",
  "Assassin"
 ],
 Sorcerer: [
  "Draconic Sorcery",
  "Wild Magic Sorcery",
  "Aberrant Sorcery",
  "Spellfire Sorcery"
 ],
 Warlock: [
  "Archfey Patron",
  "Great Old One Patron",
  "Celestial Patron",
  "Fiend Patron"
 ],
 Wizard: [
  "Bladesinger",
  "Diviner",
  "Abjurer",
  "Illusionist"
 ]
};
export function validPlannedSubclass(hero){return hero.plannedSubclass===undefined||hero.plannedSubclass===''||Object.hasOwn(subclassOptions[hero.class]??{},hero.plannedSubclass)||(legacySubclassOptions[hero.class]??[]).includes(hero.plannedSubclass);}
