// Selection summaries are original, brief guidance; full features are a later milestone.
// The lineages a species chooses between (characterRules.js speciesLineages) and the spells each grants
// (spellOptions.js lineageSpells), in Questbound's own words. Spells of level 1 or more can each be cast once a long
// rest without a slot, and with slots by a hero who has them.
export const lineageDetails = {
  'High Elf': {description: 'Elves of old courts and libraries, with magic close at hand. You know Prestidigitation; at level 3 Detect Magic and at level 5 Misty Step. These come with your lineage, whatever your class.'},
  'Wood Elf': {description: 'Elves of the deep forests, quick and quiet. You know Druidcraft; at level 3 Longstrider and at level 5 Pass without Trace. These come with your lineage, whatever your class.'},
  'Forest Gnome': {description: 'Gnomes of the woods, friends to small beasts. You know Minor Illusion, and can cast Speak with Animals without a slot a few times each long rest. These come with your lineage, whatever your class.'},
  'Rock Gnome': {description: 'Gnomes of workshops and clever devices. You know Mending and Prestidigitation. These come with your lineage, whatever your class.'},
  Abyssal: {description: 'A legacy of the churning depths below the worlds. You know Poison Spray; at level 3 Ray of Sickness and at level 5 Hold Person. These come with your lineage, whatever your class.'},
  Chthonic: {description: 'A legacy of the grey realms of the dead. You know Chill Touch; at level 3 False Life and at level 5 Ray of Enfeeblement. These come with your lineage, whatever your class.'},
  Infernal: {description: 'A legacy of the ordered realms of fire and law. You know Fire Bolt; at level 3 Hellish Rebuke and at level 5 Darkness. These come with your lineage, whatever your class.'},
};
export const speciesDetails = {
  Dragonborn: {description: 'A draconic hero with scales and a powerful ancestral connection. Imagine the color and presence you bring to the party.'},
  Dwarf: {description: 'A sturdy, long-lived adventurer. Your story might begin among mountain halls, busy cities, or somewhere entirely unexpected.'},
  // The elves are three species here (characterRules.js), listed together: High Elf, Wood Elf and Drow. 'Elf' and
  // 'Dark Elf' describe heroes made before.
  'High Elf': {description: 'An elf of old courts and libraries, with magic close at hand. Keen senses, a trance in place of sleep, and a little wizardry from the start.', baseSpecies: 'Elf'},
  'Wood Elf': {description: 'An elf of the deep forests, quick and quiet on the trail. Keen senses, a trance in place of sleep, and a longer stride than most.', baseSpecies: 'Elf'},
  Elf: {description: 'A long-lived person with fey ancestry. Keen senses and a trance in place of sleep; the forests, courts or wandering roads you came from are yours to decide.'},
  Drow: {description: 'An elf of the Drow, a lineage at home in the deep places under the earth, with eyes that pierce the dark. Your upbringing, loyalties, and personality are yours to define.', baseSpecies: 'Elf', lineage: 'Drow'},
  'Dark Elf': {description: 'A Drow: an elf of a lineage at home in the deep places under the earth. Your upbringing, loyalties, and personality are yours to define.', baseSpecies: 'Elf', lineage: 'Drow'},
  Gnome: {description: 'A small adventurer with a spark of magic. Picture a curious explorer, thoughtful scholar, or a hero who surprises everyone.'},
  // Beyond the System Reference Document, in Questbound's own words (no text from any other book).
  Goblin: {description: 'A small goblinoid with a talent for slipping out of danger. A goblin can pursue any calling, including a healer or inventor.', note: 'A Questbound option beyond the System Reference Document. Ability bonuses come only from your background.'},
  Goliath: {description: 'A towering adventurer with giant ancestry. Decide how that larger-than-life heritage fits a very personal story.'},
  'Half-Elf': {description: 'A person with human and elven ancestry. Explore the connections, communities, and traditions that shaped your own identity.', note: 'From the System Reference Document 5.1. Ability bonuses come only from your background.', source: 'SRD 5.1'},
  Halfling: {description: 'A small hero with room for great courage. You might leave a familiar home behind or already know every road on the map.'},
  Human: {description: 'An adaptable adventurer from any walk of life. Decide what ambition, curiosity, or connection draws you into this story.'},
  Orc: {description: 'A resilient adventurer with a powerful presence. Your community and personal choices define the kind of hero you become.'},
  Tiefling: {description: 'A person with a supernatural fiendish legacy. Choose how your appearance expresses that heritage and how you make it your own.'},
};
export const classDetails = {
  // Beyond the System Reference Document, in Questbound's own words (no text from any other book).
  Artificer: {description: 'Blend magical study with invention. Imagine solving problems with enchanted tools, crafted objects, and practical ingenuity.', ability: 'Intelligence'},
  Barbarian: {description: 'Meet danger head-on with fierce strength and endurance. A good fit if you imagine a physical protector or relentless warrior.', ability: 'Strength'},
  Bard: {description: 'Use performance and magic to inspire companions and influence a scene. Your instrument might be music, storytelling, or a commanding voice.', ability: 'Charisma'},
  Cleric: {description: 'Channel divine magic to help allies and confront threats. Decide what faith or sacred purpose guides your character.', ability: 'Wisdom'},
  Druid: {description: 'Draw magic from the natural world. Explore a connection to animals, landscapes, seasons, or the balance between them.', ability: 'Wisdom'},
  Fighter: {description: 'Rely on weapon training and adaptable combat skills. Picture your preferred weapons and how you learned to use them.', ability: 'Strength or Dexterity'},
  Monk: {description: 'Turn disciplined movement into a fighting style. Imagine a mobile adventurer who develops body and mind together.', ability: 'Dexterity and Wisdom'},
  Paladin: {description: 'Combine martial training with a sacred commitment. Decide which ideals you would defend when keeping them becomes difficult.', ability: 'Strength and Charisma'},
  Ranger: {description: 'Mix tracking, weapons, and nature magic. You might guide a group through dangerous country or pursue a threat across it.', ability: 'Dexterity and Wisdom'},
  Rogue: {description: 'Use precision, clever timing, and practiced skills. Consider whether you are an investigator, scout, thief, or something else entirely.', ability: 'Dexterity'},
  Sorcerer: {description: 'Wield magic that comes from within. Imagine how that power first appeared and how your character feels about it.', ability: 'Charisma'},
  Warlock: {description: 'Explore magic connected to a powerful patron. Think about what drew you toward that relationship and what you hope to gain.', ability: 'Charisma'},
  Wizard: {description: 'Learn magic through careful study and experimentation. Decide what questions or discoveries keep you searching for more knowledge.', ability: 'Intelligence'},
};
export const backgroundDescriptions = {
  Acolyte: 'Temple service shaped your early life.',
  Artisan: 'You learned a craft through practical work.',
  Charlatan: 'You made a living selling convincing illusions.',
  Criminal: 'You learned to operate outside the law.',
  Entertainer: 'You practiced winning an audience’s attention.',
  Farmer: 'Land and livestock taught you daily resilience.',
  Guard: 'You learned to notice trouble while standing watch.',
  Guide: 'You helped others find their way through wilderness.',
  Hermit: 'Time apart gave you space for reflection.',
  Merchant: 'Trade taught you to recognize opportunity.',
  Noble: 'Status brought privilege, responsibility, and expectations.',
  Sage: 'You pursued answers among books and scholars.',
  Sailor: 'Life aboard ships taught you adaptability.',
  Scribe: 'You worked carefully with records and written words.',
  Soldier: 'Military service taught you discipline under pressure.',
  Wayfarer: 'You learned to survive with few reliable resources.',
};
export const abilityDescriptions = {
  Strength: 'Physical force: lifting, climbing, and powerful blows.',
  Dexterity: 'Agility, balance, stealth, and precise movement.',
  Constitution: 'Endurance and resistance to physical strain.',
  Intelligence: 'Reasoning, recall, and learned knowledge.',
  Wisdom: 'Awareness, intuition, and reading your surroundings.',
  Charisma: 'Presence, expression, and influencing others.',
};
