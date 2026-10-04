// The subclasses a hero may plan. For each class of the System Reference Document 5.2 the one it licenses (Wizards of
// the Coast, CC BY 4.0) comes first, then three of Questbound's own, written in the game's own words; the Artificer, a
// Questbound option beyond the SRD, has five specialities. Nothing is taken from other books (see Licences in
// legalText.js). Every feature is in classFeatureCatalog.json (source 'SRD 5.2' or 'Questbound'); what the game plays
// out itself is in subclassRules.js (and the Champion's crits, the Draconic and Life features and the Fiend's gift).
export const subclassOptions={
 Artificer: {
  Alchemist: 'Experiment with magical mixtures and restorative elixirs.',
  Armorer: 'Make enchanted armor the center of your adventuring craft.',
  Artillerist: 'Build magical artillery to support your allies.',
  'Battle Smith': 'Pair your magic with a mechanical companion and a steady blade.',
  "Snarewright": "Rig traps, tangle-bolts and tripwires that stop a charging foe in its tracks."
 },
 Barbarian: {
  "Path of the Berserker": "Channel your fury into relentless close combat.",
  "Path of the Bulwark": "Rage on behalf of others: a wall of muscle between your friends and harm.",
  "Path of the Ember Heart": "Your fury burns hot enough to scorch the air and set your blows alight.",
  "Path of the Stoneborn": "Draw on the patience of mountains: hard to move and harder still to break."
 },
 Bard: {
  "College of Lore": "Gather knowledge and use wit and magic to influence a scene.",
  "College of Steel Verses": "Sing with a blade in hand and lead the charge from the front rank.",
  "College of Borrowed Faces": "Trade in faces, rumours and lies, and rattle your foes with a cruel jest.",
  "College of the Long Road": "Songs of travel and hearth that mend the body and steady weary hearts."
 },
 Cleric: {
  "Life Domain": "Devote your divine magic to healing and protecting life.",
  "Hearth Domain": "Tend the sacred fire of home: warmth for your friends, flame for what threatens them.",
  "Vigil Domain": "Stand watch for your god: an armoured guardian who shields the faithful.",
  "Threshold Domain": "Keep the door between life and death, and stand against all who would cheat it."
 },
 Druid: {
  "Circle of the Land": "Draw deeper magic from the landscapes around you.",
  "Circle of the Thornwall": "Raise living briar and bark to guard your friends and snare your foes.",
  "Circle of the Fallow Field": "Walk the turning of rot into root, where decay feeds the next season's growth.",
  "Circle of the Hollow Hill": "Hear the old songs under the hills: fey hospitality, hidden paths and gentle healing."
 },
 Fighter: {
  Champion: "Refine athletic prowess and reliable weapon skills.",
  "Marshal": "Command the fight: your orders sharpen every blade that follows you.",
  "Wardblade": "Weave a little arcane craft into your swordwork: sparks, wards and sudden steps.",
  "Ironclad": "Trust in heavy steel and a stubborn stance, and let the blows ring off you."
 },
 Monk: {
  "Warrior of the Open Hand": "Master precise unarmed techniques and control the flow of a fight.",
  "Warrior of the Crane": "Stand poised as a crane over water: patient, balanced and hard to touch.",
  "Warrior of the Coiled Serpent": "Strike the hidden points of the body and leave venom in every blow.",
  "Warrior of the Hidden Step": "Vanish between heartbeats and strike from the corner of the eye."
 },
 Paladin: {
  "Oath of Devotion": "Commit yourself to honesty, courage, and protecting others.",
  "Oath of the Open Road": "Guard all who travel: mercy for the lost, steel for the brigand.",
  "Oath of Ashes": "Swear to burn away a wrong, and follow those who did it to the end of the world.",
  "Oath of the Living Wood": "Swear to the green that outlasts kingdoms, and grow as stubborn as the oldest tree."
 },
 Ranger: {
  Hunter: "Study dangerous prey and adapt your combat techniques to the hunt.",
  "Trailbreaker": "Scout ahead, read the land and strike before the enemy knows you are there.",
  "Barrow Warden": "Stand guard at the old tombs, where the restless dead and things that feed on them walk.",
  "Packbound": "Run with the pack: you fight best with friends at your side."
 },
 Rogue: {
  Thief: "Develop agility and a talent for making use of objects and opportunities.",
  "Quiet Knife": "Strike once, from the dark, before anyone knows a fight has begun.",
  "Silvertongue": "Talk your way in, talk your way out, and turn a feint into an opening.",
  "Trickwright": "Mix a pickpocket's craft with small magics: sparks, false faces and unseen hands."
 },
 Sorcerer: {
  "Draconic Sorcery": "Develop the draconic power behind your innate magic.",
  "Frostblood Sorcery": "Winter runs in your veins: cold that bites, ice that shields.",
  "Veilborn Sorcery": "A thin place in your bloodline lets you slip half out of the world.",
  "Saintblood Sorcery": "A saint's blessing came down your family line, and now it pours out of you."
 },
 Warlock: {
  "Fiend Patron": "Explore a pact with a powerful being from the Lower Planes.",
  "Lantern-Keeper Patron": "Your patron keeps the lights that guide lost travellers home, and lends you a flame.",
  "Elder Grove Patron": "A green power older than any road has bargained with you, wrapping you in bark and thorn.",
  "Whispering Void Patron": "Something in the silence between stars speaks to you, and you have learned to answer."
 },
 Wizard: {
  Evoker: "Specialize in shaping magical energy into potent spell effects.",
  "Wardwright": "Craft layered wards and stand untouched while the spells fly.",
  "Bonewright": "Study what death leaves behind, and bend cold bone and fading breath to your will.",
  "Fateweaver": "Read the threads of what is about to happen, and tug the right one at the right time."
 }
};
// Subclasses offered before 2026-10-02, when the game was limited to licensed content. A hero who planned one keeps
// it (the name stays on their sheet and goes to the Dungeon Master as flavour), but it is not offered to anyone new.
// The game plays out only what it did before for such heroes (College of Valor's and Battle Smith's martial weapons,
// Gloom Stalker's initiative, College of Dance's armour class); nothing new is added for them.
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
