// Ordered by the March 24, 2026 r/onednd preference poll; not global usage statistics.
export const subclassOptions = {
  "Artificer": {
    "Artillerist": "Command an eldritch cannon for blasts, flame, or temporary protection. Magical artillery and battlefield support.",
    "Armorer": "Turn worn armor into a magical suit with specialized weapons. Choose armored protection or stealthy ranged combat.",
    "Battle Smith": "Fight alongside a Steel Defender and use Intelligence with magic weapons. A martial inventor with a companion.",
    "Alchemist": "Support allies through experimental elixirs and restorative magic. A magical medic and potion maker."
  },
  "Barbarian": {
    "Path of the World Tree": "Protect allies with temporary HP and control positions. Later powers expand your reach and let you teleport companions.",
    "Path of the Berserker": "Frenzy adds damage while raging and attacking recklessly. Later features resist fear and punish attackers.",
    "Path of the Zealot": "Combine divine damage with exceptional staying power. Your rage helps keep you alive.",
    "Path of the Wild Heart": "Channel animal spirits while raging. Adapt your defenses, mobility, and support by changing animal benefits."
  },
  "Bard": {
    "College of Valor": "Combine Bard magic with armor, weapons, and combat inspiration. Support allies while fighting near the front.",
    "College of Glamour": "Use fey charm, fear, and inspiring performances to influence enemies and reposition allies.",
    "College of Lore": "Disrupt enemies with Cutting Words, learn extra skills, and expand your magical options. A flexible caster and problem solver.",
    "College of Dance": "Fight through agile, unarmored movement and dance. Turn inspiration into physical teamwork and unarmed combat."
  },
  "Cleric": {
    "Light Domain": "Use radiant and fire magic offensively, with Warding Flare to interfere with incoming attacks.",
    "War Domain": "Mix divine magic with weapon attacks. Limited bonus attacks and divine accuracy support a martial approach.",
    "Trickery Domain": "Support stealth and deceive enemies through magical duplicates and illusion. Focus on misdirection and infiltration.",
    "Life Domain": "Specialize in stronger healing and restoring injured allies. Focus on recovery and keeping the party standing."
  },
  "Druid": {
    "Circle of the Stars": "Take a starry form for ranged attacks, healing, or steadier concentration. Adaptable magical support.",
    "Circle of the Moon": "Make Wild Shape a central combat tool, with tougher beast transformations and moon-themed magic.",
    "Circle of the Land": "Adapt prepared magic to the environment and replenish spellcasting. Focus on varied nature spells.",
    "Circle of the Sea": "Surround yourself with a stormy aura that damages and pushes nearby enemies. Close-range control and ocean magic."
  },
  "Fighter": {
    "Battle Master": "Spend superiority dice on tactical maneuvers that improve attacks or control enemies. Active combat decisions.",
    "Eldritch Knight": "Add Wizard spells to weapon fighting. Use protective or offensive magic alongside martial training.",
    "Psi Warrior": "Use a pool of psionic dice for protective force, extra damage, and telekinetic movement.",
    "Champion": "Score critical hits more often and excel at physical contests. Dependable weapon combat and athletic ability."
  },
  "Monk": {
    "Warrior of the Elements": "Extend unarmed reach and choose elemental damage. Push or pull enemies and later unleash elemental bursts.",
    "Warrior of Mercy": "Use touch to heal allies or harm enemies, spending Focus for a mobile battlefield medic role.",
    "Warrior of Shadow": "Use darkness, illusion, and later shadow teleportation. Infiltration and fighting from concealment.",
    "Warrior of the Open Hand": "Control enemies through Flurry of Blows: knock them prone, push them, or stop opportunity attacks."
  },
  "Paladin": {
    "Oath of the Noble Genies": "Channel elemental genie power to enhance offense, protection, and movement. A versatile elemental knight.",
    "Oath of Vengeance": "Focus divine power on defeating a chosen foe. Relentless pursuit and offensive pressure.",
    "Oath of Devotion": "Empower a weapon with divine accuracy and protect against charm. A direct, protective holy-knight path.",
    "Oath of the Ancients": "Draw on nature and ancient light to restrain enemies and protect life. A durable guardian with nature magic."
  },
  "Ranger": {
    "Gloom Stalker": "Hunt in darkness and strike hard early in combat. Ambushes, darkvision, and sudden pressure.",
    "Fey Wanderer": "Add psychic damage and fey magic while improving social influence. Fighting, charm, and unusual movement.",
    "Beast Master": "Coordinate attacks and exploration with a primal animal companion. An active partnership in combat.",
    "Winter Walker": "Use supernatural winter to hinder enemies, withstand cold, and protect fellow travelers. Control through icy magic."
  },
  "Rogue": {
    "Arcane Trickster": "Add Wizard magic and a versatile Mage Hand to stealth and precision attacks. Magical misdirection.",
    "Soulknife": "Manifest psychic blades and use psionic energy for skills and communication. Subtle, equipment-light operations.",
    "Thief": "Use objects quickly and climb efficiently. Later features expand magic-item use and support attacking from hiding.",
    "Assassin": "Excel at the opening round, infiltration, and disguises. Planned ambushes and focused burst damage."
  },
  "Sorcerer": {
    "Draconic Sorcery": "Gain draconic toughness and later enhance a chosen damage type. A more durable elemental caster.",
    "Wild Magic Sorcery": "Embrace unpredictable magical surges and bend luck. Volatile outcomes and chance-driven play.",
    "Aberrant Sorcery": "Develop psychic magic and telepathic communication. Mental influence and unusual spellcasting.",
    "Spellfire Sorcery": "Channel raw magic into radiant spellfire, protection, and healing. A blend of magical offense and recovery."
  },
  "Warlock": {
    "Archfey Patron": "Specialize in short-range teleportation, charm, and evasive tricks. Mobility and fey mischief.",
    "Great Old One Patron": "Use telepathy, psychic magic, and curses to unsettle enemies. Mental manipulation and eldritch horror.",
    "Celestial Patron": "Add healing and radiant power to pact magic. Support the party while retaining Warlock attacks.",
    "Fiend Patron": "Gain temporary HP when nearby enemies fall and develop infernal resilience. Aggressive staying power."
  },
  "Wizard": {
    "Bladesinger": "Combine Wizard spellcasting with a magically enhanced fighting stance. Agile melee combat with defensive magic.",
    "Diviner": "Use Portent rolls to replace important d20 results. Foresight and influence over decisive moments.",
    "Abjurer": "Create an Arcane Ward that absorbs damage. Protective magic and countering hostile spells.",
    "Illusionist": "Improve illusions and use deceptive magic creatively. Misdirection and solutions shaped by imagination."
  }
};
export const subclassPoll = {date:"2026-03-24",url:"https://www.reddit.com/r/onednd/comments/1s241b3/all_subclass_preference_votes_have_concluded_here/",scope:"Community preference poll; not worldwide player usage"};
export const legacySubclassOptions = {Artificer:["Cartographer"],Ranger:["Hunter"],Wizard:["Evoker"]};
export function validPlannedSubclass(hero) { return hero.plannedSubclass===undefined || hero.plannedSubclass==="" || Object.hasOwn(subclassOptions[hero.class]??{},hero.plannedSubclass) || (legacySubclassOptions[hero.class]??[]).includes(hero.plannedSubclass); }
