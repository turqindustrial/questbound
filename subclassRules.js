import {modifier,proficiencyBonus,currentSubclass} from './characterRules';
// What the game itself plays of a hero's subclass (subclassOptions.js names them; classFeatureCatalog.json holds every
// feature's full text for the sheet and the Dungeon Master). Each subclass of Questbound's own, and each Artificer
// speciality, lists its features with a one-line rule for the Dungeon Master (`features`, the same names and levels as
// the catalog), and the effects the engine applies (`effects`), each from the level it starts:
//  passive  - steady numbers: hit points per level, an armour class base or bonus, an initiative ability or advantage,
//             a critical range, martial weapons, a second attack, a harder grapple, companions' attack bonus, skills;
//  rider    - once on each of the hero's turns, extra damage (or Vex) on a weapon or Unarmed Strike hit;
//  ward     - a Reaction that blunts a blow that hits the hero, with limited uses;
//  action   - one class action with limited uses (an action or a bonus action): healing, temporary hit points, a foe
//             thrown off its next attack, an opening for the hero's next attack, or a strike the creature saves against;
//  spell    - the casting ability's modifier added once to a casting's damage of some types, or to slot-cast healing;
//  victory  - temporary hit points when a fight is won.
// At most one effect of a subclass spends uses (game.resources.feat counts what is spent). Everything else a feature
// does is the Dungeon Master's to play from its rule. Two SRD subclasses get engine parity here too: the Hunter's
// prey (the extra-die option) and the College of Lore's Cutting Words. Names here are all prefixed 'subclass' because
// the checks run every rules file in one scope.
export const subclassLevels={Artificer:[3,5,9,15],Barbarian:[3,6,10,14],Bard:[3,6,14],Cleric:[3,6,17],Druid:[3,6,10,14],Fighter:[3,7,10,15,18],Monk:[3,6,11,17],Paladin:[3,7,15,20],Ranger:[3,7,11,15],Rogue:[3,9,13,17],Sorcerer:[3,6,14,18],Warlock:[3,6,10,14],Wizard:[3,6,10,14]};
export const subclassEngine={
 // ---- Artificer ----
 Alchemist:{class:'Artificer',effects:[{level:3,kind:'action',id:'tonic',name:'Field Tonic',bonus:true,uses:'Intelligence',recharge:'long',effect:{heal:{count:1,die:8,plus:'Intelligence'}},say:/\bfield tonics?\b|\b(drink|down|swig) (a |my |one of my )?tonics?\b/i,chip:['⚗','Field Tonic','I drink one of my field tonics.','potion'],description:'Field Tonic: drink a tonic you mixed yourself and regain 1d8 + your Intelligence modifier hit points. A bonus action.'}]},
 Armorer:{class:'Artificer',effects:[{level:3,kind:'passive',name:'Plated Craft',acBonus:{n:1,when:'armor'}},{level:5,kind:'passive',name:'Second Swing',extraAttack:true}]},
 Artillerist:{class:'Artificer',effects:[{level:3,kind:'action',id:'engine',name:'Field Engine',bonus:false,uses:'Intelligence',recharge:'long',effect:{strike:{count:2,die:8,type:'Force',save:'Dexterity',half:true}},scale:{9:3,15:4},say:/\bfield engine\b|\bfire (my |the )?(engine|cannon)\b/i,chip:['✹','Field Engine','I fire my field engine at the foe.','cog'],description:'Field Engine: fire your arcane engine at the foe. It makes a Dexterity save against your spell save DC and takes Force damage, half as much on a success. Uses your action.'}]},
 'Battle Smith':{class:'Artificer',effects:[{level:3,kind:'passive',name:"Smith's Drill",martial:true},{level:5,kind:'passive',name:'Drilled Strikes',extraAttack:true}]},
 Snarewright:{class:'Artificer',effects:[{level:3,kind:'action',id:'tangle',name:'Tangle-Bolt',bonus:false,uses:'Intelligence',recharge:'long',effect:{strike:{count:2,die:6,type:'Piercing',save:'Dexterity',half:true,mark:'prone'}},scale:{5:3,15:5},say:/\btangle-?bolt\b|\bweighted line\b/i,chip:['➶','Tangle-Bolt','I fire a weighted line at the foe.','cog'],description:'Tangle-Bolt: fire a weighted line at the foe. It makes a Dexterity save against your spell save DC: on a failure it takes Piercing damage and is knocked prone; on a success, half the damage. Uses your action.'}]},
 // ---- Barbarian ----
 'Path of the Bulwark':{class:'Barbarian',effects:[{level:3,kind:'ward',name:'Iron Brace',count:1,die:8,plus:'Constitution',uses:'proficiency',recharge:'long'}]},
 'Path of the Ember Heart':{class:'Barbarian',effects:[{level:3,kind:'rider',name:'Kindled Blows',count:1,die:6,type:'Fire',when:'melee',scale:{10:2}}]},
 'Path of the Stoneborn':{class:'Barbarian',effects:[{level:3,kind:'passive',name:'Bedrock',hp:1,grappleDC:2}]},
 // ---- Bard ----
 'College of Lore':{class:'Bard',srd:true,features:[{level:3,name:'Cutting Words',brief:'Reaction when a foe hits you: subtract a Bardic Inspiration die (d6; d8 at 5, d10 at 10, d12 at 15) from the damage. Cha mod uses.',engine:true}],
  effects:[{level:3,kind:'ward',name:'Cutting Words',count:1,die:{3:6,5:8,10:10,15:12},uses:'Charisma',recharge:{3:'long',5:'short'}}]},
 'College of Steel Verses':{class:'Bard',effects:[{level:3,kind:'passive',name:'Battle Cadence',martial:true},{level:3,kind:'rider',name:'Battle Cadence',count:1,die:6,type:'Thunder',when:'weapon'},{level:6,kind:'passive',name:'Second Measure',extraAttack:true}]},
 'College of Borrowed Faces':{class:'Bard',effects:[{level:3,kind:'passive',name:'Practised Liar',skills:['Deception','Insight']},{level:3,kind:'action',id:'jest',name:'Rattling Jest',bonus:true,uses:'Charisma',recharge:'long',effect:{mark:'sapped',save:'Wisdom'},say:/\b(rattling jest|cruel jest)\b|\bi (mock|taunt|jeer at)\b/i,chip:['✶','Rattling Jest','I rattle the foe with a cruel jest.','speak'],description:'Rattling Jest: a cruel jest at the foe. It makes a Wisdom save against your spell save DC or has disadvantage on its next attack. A bonus action.'}]},
 'College of the Long Road':{class:'Bard',effects:[{level:3,kind:'passive',name:'Road-Wise',skills:['Survival']},{level:3,kind:'action',id:'hearthsong',name:'Hearthsong',bonus:true,uses:'proficiency',recharge:'long',effect:{temp:{count:1,die:8,plus:'level'}},say:/\bhearthsong\b|\bwalking song\b/i,chip:['♪','Hearthsong','I hum an old walking song.','lute'],description:'Hearthsong: hum an old walking song and gain 1d8 + your Bard level temporary hit points (they do not add to any you have). A bonus action.'}]},
 // ---- Cleric ----
 'Hearth Domain':{class:'Cleric',effects:[{level:3,kind:'spell',name:'Banked Fire',damage:{types:['Fire','Radiant'],ability:'Wisdom'}}]},
 'Vigil Domain':{class:'Cleric',effects:[{level:3,kind:'passive',name:'Steadfast Guard',acBonus:{n:1,when:'armor'}}]},
 'Threshold Domain':{class:'Cleric',effects:[{level:3,kind:'victory',name:"Ferryman's Due",plus:['level','Wisdom']}]},
 // ---- Druid ----
 'Circle of the Thornwall':{class:'Druid',effects:[{level:3,kind:'action',id:'briar',name:'Briar Mantle',bonus:true,uses:{3:2,6:3,17:4},recharge:'short',effect:{temp:{count:0,die:0,plus:'level'}},say:/\bbriar mantle\b|\bwrap myself in (living )?thorns?\b/i,chip:['❦','Briar Mantle','I wrap myself in living thorn.','leaf'],description:'Briar Mantle: wrap yourself in living thorn for temporary hit points equal to your Druid level (they do not add to any you have). A bonus action; the uses return on a short or long rest.'}]},
 'Circle of the Fallow Field':{class:'Druid',effects:[{level:3,kind:'spell',name:'Rot and Root',damage:{types:['Poison','Necrotic'],ability:'Wisdom',cantrip:0}}]},
 'Circle of the Hollow Hill':{class:'Druid',effects:[{level:3,kind:'spell',name:"Host's Gift",heal:'Wisdom'}]},
 // ---- Fighter ----
 Marshal:{class:'Fighter',effects:[{level:3,kind:'passive',name:"Captain's Call",companionBonus:'proficiency'},{level:7,kind:'passive',name:'Read the Field',initiative:'Intelligence'}]},
 Wardblade:{class:'Fighter',effects:[{level:3,kind:'ward',name:'Crackling Guard',count:1,die:8,plus:'Intelligence',uses:'proficiency',recharge:'long'}]},
 Ironclad:{class:'Fighter',effects:[{level:3,kind:'passive',name:'Plate and Grit',hp:1}]},
 // ---- Monk ----
 'Warrior of the Crane':{class:'Monk',effects:[{level:3,kind:'passive',name:"Crane's Poise",acBonus:{n:1,when:'unarmored'}}]},
 'Warrior of the Coiled Serpent':{class:'Monk',effects:[{level:3,kind:'rider',name:"Serpent's Fang",count:1,die:4,wounded:true,type:'Poison',when:'martialArts',scale:{11:2}}]},
 'Warrior of the Quiet Step':{class:'Monk',effects:[{level:3,kind:'rider',name:'Slip Behind',count:0,die:0,mark:'vex',when:'martialArts'}]},
 // ---- Paladin ----
 'Oath of the Open Road':{class:'Paladin',effects:[{level:3,kind:'passive',name:'Watchful Wayfarer',initiative:'Wisdom',skills:['Survival']}]},
 'Oath of Ashes':{class:'Paladin',effects:[{level:3,kind:'rider',name:'Cinder Oath',count:1,die:6,type:'Fire',when:'melee'}]},
 'Oath of the Living Wood':{class:'Paladin',effects:[{level:3,kind:'passive',name:'Heartwood',hp:1}]},
 // ---- Ranger ----
 Hunter:{class:'Ranger',srd:true,features:[{level:3,name:"Hunter's Prey",brief:'Played as its extra-die option: once a turn, a weapon hit on a creature missing any hit points deals an extra 1d8.',engine:true}],
  effects:[{level:3,kind:'rider',name:"Hunter's Prey",count:1,die:8,when:'wounded'}]},
 Trailbreaker:{class:'Ranger',effects:[{level:3,kind:'passive',name:"Trailbreaker's Lead",initiativeAdvantage:true,skills:['Survival']}]},
 'Barrow Warden':{class:'Ranger',effects:[{level:3,kind:'rider',name:'Hallowed Shot',count:1,die:6,type:'Radiant',when:'weapon'}]},
 Packbound:{class:'Ranger',effects:[{level:3,kind:'rider',name:'Running with the Pack',count:1,die:6,when:'companion'}]},
 // ---- Rogue ----
 'Quiet Knife':{class:'Rogue',effects:[{level:3,kind:'rider',name:'First Cut',count:1,die:6,when:'firstRound'}]},
 Silvertongue:{class:'Rogue',effects:[{level:3,kind:'passive',name:'Smooth Talker',skills:['Persuasion','Deception']},{level:3,kind:'action',id:'feint',name:'Feint',bonus:true,uses:'proficiency',recharge:'short',effect:{vex:true},say:/\bfeint\b/i,chip:['↯','Feint','I feint to draw out an opening.','dagger'],description:'Feint: draw the foe out of its guard. Your next attack against it before the end of your next turn has advantage. A bonus action; the uses return on a short or long rest.'}]},
 Trickwright:{class:'Rogue',effects:[]},
 // ---- Sorcerer ----
 'Frostblood Sorcery':{class:'Sorcerer',effects:[{level:3,kind:'spell',name:'Rime-Touched',damage:{types:['Cold'],ability:'Charisma',cantrip:0}}]},
 'Veilborn Sorcery':{class:'Sorcerer',effects:[{level:3,kind:'action',id:'veil',name:'Step Behind the Veil',bonus:true,uses:'proficiency',recharge:'long',effect:{mark:'sapped'},say:/\bstep behind the veil\b|\bfade (half )?(out )?of sight\b/i,chip:['◌','Behind the Veil','I fade half out of sight.','eye'],description:'Step Behind the Veil: fade half out of the world. The next attack the foe makes before your next turn has disadvantage. A bonus action.'}]},
 'Saintblood Sorcery':{class:'Sorcerer',effects:[{level:3,kind:'spell',name:'Grace in the Blood',heal:'Charisma'}]},
 // ---- Warlock ----
 'Lantern-Keeper Patron':{class:'Warlock',effects:[{level:3,kind:'action',id:'kindly',name:'Kindly Light',bonus:true,uses:'Charisma',recharge:'long',effect:{heal:{count:1,die:8,plus:'level'}},say:/\bkindly light\b|\bpatron'?s lamp\b/i,chip:['✚','Kindly Light',"I draw on my patron's lamp.",'sun'],description:"Kindly Light: draw on your patron's lamp and regain 1d8 + your Warlock level hit points. A bonus action."}]},
 'Elder Grove Patron':{class:'Warlock',effects:[{level:3,kind:'ward',name:'Bark and Bramble',count:1,die:8,plus:'Charisma',uses:'Charisma',recharge:'short'}]},
 'Whispering Void Patron':{class:'Warlock',effects:[{level:3,kind:'spell',name:'Echo of the Void',damage:{types:['Force','Psychic'],ability:'Charisma',cantrip:0.5}}]},
 // ---- Wizard ----
 Wardwright:{class:'Wizard',effects:[{level:3,kind:'passive',name:'Woven Ward',acBase:'Intelligence',hp:1}]},
 Bonewright:{class:'Wizard',effects:[{level:3,kind:'spell',name:'Marrow-Cold',damage:{types:['Necrotic'],ability:'Intelligence'}}]},
 Fateweaver:{class:'Wizard',effects:[{level:3,kind:'passive',name:'Foreseen Step',initiative:'Intelligence',acBonus:{n:1,when:'any'}},{level:3,kind:'action',id:'thread',name:'Thread Pull',bonus:true,uses:{3:2,5:3,14:4},recharge:'short',effect:{mark:'sapped',line:'you tug at the thread of the moment.'},say:/\bthread pull\b|\b(tug|pull) (at )?(its|the|their|a) thread\b/i,chip:['⟆','Thread Pull','I tug at the thread of the moment.','eye'],description:'Thread Pull: tug at the thread of the moment. The next attack the foe makes before your next turn has disadvantage. A bonus action; twice per short or long rest (three times from level 5, four from level 14).'}]},
};
// ---- features (generated from the catalog's Questbound entries: level, name, one-line rule, engine-played) ----
export const subclassFeatures={
 "Path of the Bulwark":[
  [3,"Iron Brace","Reaction when hit: reduce the damage by 1d8 + Constitution modifier. Proficiency Bonus uses per Long Rest.",1],
  [6,"Stand Between","While raging, Reaction: take an attack's damage instead of an ally within 5 ft, with Resistance to it.",0],
  [10,"Rallying Roar","Bonus Action, once per Long Rest (or spend a Rage use): you and allies within 30 ft gain Temporary HP equal to your Barbarian level.",0],
  [14,"Last Wall Standing","While raging, chosen creatures within 10 ft have Disadvantage on attacks against anyone but you.",0]
 ],
 "Path of the Ember Heart":[
  [3,"Kindled Blows","Once a turn, a melee weapon or Unarmed Strike hit deals an extra 1d6 Fire (2d6 from level 10).",1],
  [6,"Heat-Forged","Resistance to Fire; extreme heat does not harm you; while raging, loose flammable things you strike catch fire.",0],
  [10,"Flashpoint","Starting a Rage: chosen creatures within 10 ft make a Dexterity save (DC 8 + Con + PB), 2d8 Fire, half on a success.",0],
  [14,"Smouldering Retort","While raging, a creature within 5 ft that hits you takes Fire damage equal to your Con modifier + Rage Damage bonus.",0]
 ],
 "Path of the Stoneborn":[
  [3,"Bedrock","+1 HP maximum per Barbarian level; your Grapple and Shove DC rises by 2.",1],
  [6,"Rooted","While raging you cannot be pushed, pulled or knocked Prone against your will.",0],
  [10,"Rockslide Charge","Move 20+ ft straight, then hit in melee: Strength save (DC 8 + Str + PB) or pushed 10 ft and knocked Prone.",0],
  [14,"Granite Skin","While raging, the first damage you take each turn is reduced by your Con modifier + Rage Damage bonus.",0]
 ],
 "College of Steel Verses":[
  [3,"Battle Cadence","Martial weapon proficiency; once a turn a weapon hit deals an extra 1d6 Thunder.",1],
  [6,"Second Measure","Attack twice with the Attack action; one attack can be swapped for a Bard cantrip (the swap is the DM's).",1],
  [14,"Crescendo","After casting a Bard spell with your action, make one weapon attack as a Bonus Action.",0]
 ],
 "College of Borrowed Faces":[
  [3,"Rattling Jest","Bonus Action: a foe makes a Wisdom save vs your spell DC or has Disadvantage on its next attack. Cha mod uses per Long Rest.",1],
  [3,"Practised Liar","You gain proficiency in the Deception and Insight skills.",1],
  [6,"A Second Face","Disguise Self without a slot (PB times per Long Rest); Advantage on Deception to pass as someone you studied for an hour.",0],
  [14,"The Last Mask","Once per Long Rest, Reaction when attacked: the attack misses and the attacker is Frightened until the end of its next turn.",0]
 ],
 "College of the Long Road":[
  [3,"Hearthsong","Bonus Action: Temporary HP equal to 1d8 + your Bard level. Proficiency Bonus uses per Long Rest.",1],
  [3,"Road-Wise","You gain proficiency in the Survival skill.",1],
  [6,"Well-Travelled","You and companions cannot become lost except by magic; companions sharing your Short Rest regain extra HP equal to your Cha modifier.",0],
  [14,"Song of Homecoming","Once per Long Rest, a one-minute song: allies who hear it regain HP equal to your Bard level and end Charmed or Frightened.",0]
 ],
 "Hearth Domain":[
  [3,"Hearth Domain Spells","Always prepared from level 3: Burning Hands, Heroism, Heat Metal and Flaming Sphere; more at higher levels.",1],
  [3,"Banked Fire","Cleric spells dealing Fire or Radiant damage add your Wisdom modifier, once per casting.",1],
  [3,"Hearthkeeper's Welcome","Channel Divinity, Magic action: you and allies within 30 ft gain Temporary HP equal to your Cleric level.",0],
  [6,"Warmth Shared","Allies sharing your Short Rest regain extra HP equal to your Wisdom modifier.",0],
  [17,"Hearth Never Cold","Fire Resistance; your Fire ignores Resistance; once per Long Rest drop to 1 HP instead of 0 and burst 4d8 Fire (Dex save, half).",0]
 ],
 "Vigil Domain":[
  [3,"Vigil Domain Spells","Always prepared from level 3: Shield of Faith, Command, Spiritual Weapon and Warding Bond; more at higher levels.",1],
  [3,"Steadfast Guard","+1 AC while you wear armor.",1],
  [3,"Sentinel's Rebuke","Channel Divinity, Reaction: an attack against an ally within 5 ft has Disadvantage.",0],
  [6,"Interpose","Reaction when a creature within 5 ft is targeted: trade places and become the target.",0],
  [17,"Bastion","Channel Divinity, Magic action, 1 minute: you and allies within 10 ft get +2 AC and cannot be Frightened.",0]
 ],
 "Threshold Domain":[
  [3,"Threshold Domain Spells","Always prepared from level 3: False Life, Bane, Gentle Repose and Ray of Enfeeblement; more at higher levels.",1],
  [3,"Ferryman's Due","When a fight you took part in is won, gain Temporary HP equal to your Cleric level + Wisdom modifier.",1],
  [3,"Hand at the Gate","Cast Spare the Dying as a Bonus Action at a range of 60 ft.",0],
  [6,"Turn Back the Tide","Healing a creature at 0 HP with a spell gives it extra HP equal to your Cleric level.",0],
  [17,"Close the Door","Undead have Disadvantage on saves against your spells; once per Long Rest cast Revivify without a slot or material.",0]
 ],
 "Circle of the Thornwall":[
  [3,"Thornwall Spells","Always prepared from level 3: Entangle, Ensnaring Strike, Barkskin and Spike Growth; more at higher levels.",1],
  [3,"Briar Mantle","Bonus Action: Temporary HP equal to your Druid level. 2 uses (3 at level 6, 4 at 17), back on a Short or Long Rest.",1],
  [6,"Hedge of Thorns","While Briar Mantle's Temporary HP last, melee attackers that hit you take 1d6 Piercing.",0],
  [10,"Rooted Ground","Chosen creatures pass through your Entangle and Spike Growth unhindered and unharmed.",0],
  [14,"Heartwood Guardian","Once per Long Rest, Magic action, 1 minute: Resistance to Bludgeoning, Piercing and Slashing; allies within 10 ft get +1 AC.",0]
 ],
 "Circle of the Fallow Field":[
  [3,"Fallow Field Spells","Always prepared from level 3: Ray of Sickness, False Life, Blindness/Deafness and Gentle Repose; more at higher levels.",1],
  [3,"Rot and Root","Druid spells of level 1 or higher dealing Poison or Necrotic damage add your Wisdom modifier, once per casting.",1],
  [6,"Green from Grey","When your spell deals Poison or Necrotic damage, an ally within 30 ft regains HP equal to your Wisdom modifier (minimum 1).",0],
  [10,"Spore-Hardened","Resistance to Poison and Necrotic; you cannot be Poisoned.",0],
  [14,"Fallow Season","Once per Long Rest, 1 minute, 20-ft radius: chosen creatures starting a turn there make a Con save, 2d8 Necrotic, half on a success.",0]
 ],
 "Circle of the Hollow Hill":[
  [3,"Hollow Hill Spells","Always prepared from level 3: Sleep, Faerie Fire, Invisibility and Pass without Trace; more at higher levels.",1],
  [3,"Host's Gift","Healing spells cast with a slot restore extra HP equal to your Wisdom modifier.",1],
  [6,"Under-Hill Paths","Once per Short or Long Rest, Bonus Action: step into earth or a plant you touch and out of another within 30 ft.",0],
  [10,"Glamoured Welcome","You cannot be Charmed; fey start at least indifferent toward you unless wronged.",0],
  [14,"The Hall Beneath","Once per Long Rest you and up to six allies take a Short Rest in a hidden hall while one minute passes outside.",0]
 ],
 "Marshal":[
  [3,"Captain's Call","Companions fighting beside you add your Proficiency Bonus to their attack rolls.",1],
  [3,"Rallying Word","When you use Second Wind, an ally within 30 ft gains Temporary HP equal to your Fighter level.",0],
  [7,"Read the Field","Add your Intelligence modifier to Initiative; you cannot be Surprised while not Incapacitated.",1],
  [10,"Strike on My Word","Give up one attack of your Attack action so an ally or companion makes one weapon attack with its Reaction.",0],
  [15,"Hold the Ranks","Allies within 10 ft get +1 AC while you are not Incapacitated.",0],
  [18,"Last Command","Once per Long Rest, an ally within 60 ft dropping to 0 HP drops to 1 instead and may attack with its Reaction.",0]
 ],
 "Wardblade":[
  [3,"Spark of the Art","You learn Shocking Grasp and Fire Bolt (Intelligence).",1],
  [3,"Crackling Guard","Reaction when hit: reduce the damage by 1d8 + Intelligence modifier. Proficiency Bonus uses per Long Rest.",1],
  [7,"Spell and Steel","After casting a cantrip with your action, make one weapon attack as a Bonus Action.",0],
  [10,"Unsettling Strike","A creature you hit has Disadvantage on its next save against your spell before the end of your next turn.",0],
  [15,"Fold the Distance","Bonus Action: teleport up to 30 ft. Proficiency Bonus uses per Long Rest.",0],
  [18,"Spellbreaker's Will","Advantage on saves against spells; on a success gain Temporary HP equal to your Fighter level.",0]
 ],
 "Ironclad":[
  [3,"Plate and Grit","+1 HP maximum per Fighter level.",1],
  [3,"Shield Bash","While holding a Shield, replace one attack of your Attack action with a Shove made with it.",0],
  [7,"Shoulder Into Them","A Shove can both push a creature 5 ft and knock it Prone.",0],
  [10,"Shrug It Off","Succeeding on a Constitution save restores HP equal to your Con modifier + Proficiency Bonus.",0],
  [15,"Unmoved","In Medium or Heavy armor, damage from weapon attacks is reduced by 3.",0],
  [18,"Iron Will","Once per Long Rest, dropping to 0 HP (not killed outright) you drop to HP equal to your Fighter level instead.",0]
 ],
 "Warrior of the Crane":[
  [3,"Crane's Poise","+1 AC while you wear no armor and hold no Shield.",1],
  [3,"Wingbeat","Step of the Wind can carry one willing ally within 5 ft along with you.",0],
  [6,"Settle the Storm","Reaction when an ally within 5 ft is hit: reduce the damage by a Martial Arts die + Wisdom modifier.",0],
  [11,"Still as Water","Bonus Action, 1 Focus: attacks against you have Disadvantage until your next turn.",0],
  [17,"Crane Ascending","Reaction when a melee attack misses you: one Unarmed Strike; on a hit the attacker is knocked Prone.",0]
 ],
 "Warrior of the Coiled Serpent":[
  [3,"Serpent's Fang","Once a turn, an Unarmed Strike or Monk weapon hit on a wounded creature deals an extra 1d4 Poison (2d4 at 11), bonus strike included.",1],
  [6,"Shed Skin","Resistance to Poison; 1 Focus as a Bonus Action ends Poisoned on you.",0],
  [11,"Tightening Coil","A creature failing its save against your Stunning Strike also takes 2d6 Poison.",0],
  [17,"Patience of the Serpent","On rolling Initiative choose a creature: your first hit on it before the end of your next turn is a Critical Hit.",0]
 ],
 "Warrior of the Quiet Step":[
  [3,"Slip Behind","Once a turn, after an Unarmed Strike or Monk weapon hit, your next attack on that creature before your next turn ends has Advantage.",1],
  [6,"Quiet Feet","Advantage on Stealth; 2 Focus as a Bonus Action: Invisible until the end of your next turn or until you attack.",0],
  [11,"Fold of the Moment","Once per Short or Long Rest, Reaction when you take damage: halve it and reappear within 30 ft.",0],
  [17,"The Unseen Hand","Once per Long Rest, Bonus Action: Invisible for 1 minute; attacking does not end it, but you regain no Focus meanwhile.",0]
 ],
 "Oath of the Open Road":[
  [3,"Open Road Spells","Always prepared from level 3: Sanctuary and Longstrider; more at higher levels.",1],
  [3,"Watchful Wayfarer","Add your Wisdom modifier to Initiative; proficiency in Survival.",1],
  [3,"Shelter the Wayfarer","Channel Divinity, Bonus Action: an ally within 30 ft gets +2 AC for 1 minute while within 30 ft of you.",0],
  [7,"Aura of the Road","You and allies within 10 ft ignore rubble, mud, snow and undergrowth, and have Advantage on saves against Prone.",0],
  [15,"Brigand's Bane","Reaction when a creature within 30 ft hits an ally: move toward it freely; your next melee hit on it deals an extra 2d8 Radiant.",0],
  [20,"Lantern of the Long Road","Once per Long Rest, Bonus Action, 10 min: allies within 30 ft regain 10 HP each turn (above 0); Advantage on Wisdom saves.",0]
 ],
 "Oath of Ashes":[
  [3,"Ashes Spells","Always prepared from level 3: Searing Smite and Hellish Rebuke; more at higher levels.",1],
  [3,"Cinder Oath","Once a turn, a melee hit deals an extra 1d6 Fire.",1],
  [3,"Mark for Burning","Channel Divinity, Bonus Action: for 1 minute your first hit on a named creature each turn adds your Cha modifier as Fire.",0],
  [7,"Aura of Embers","Hostile creatures within 10 ft lose any Resistance to Fire.",0],
  [15,"Unquenched","Once per Long Rest, dropping to 0 HP (not killed outright) you drop to 1 HP instead.",0],
  [20,"Pyre-Bearer","Once per Long Rest, Bonus Action, 1 minute: weapon hits deal +2d8 Fire, melee attackers that hit you take 2d8 Fire.",0]
 ],
 "Oath of the Living Wood":[
  [3,"Living Wood Spells","Always prepared from level 3: Goodberry and Entangle; more at higher levels.",1],
  [3,"Heartwood","+1 HP maximum per Paladin level.",1],
  [3,"Bough and Root","Channel Divinity, Magic action: chosen creatures within 15 ft make a Strength save or are Restrained until your next turn ends.",0],
  [7,"Aura of Green Shelter","You and allies within 10 ft have Resistance to Poison and Advantage on saves against Poisoned.",0],
  [15,"Deep Roots","On earth or living wood you cannot be moved or knocked Prone; at half HP or lower (above 0) regain 5 HP each turn.",0],
  [20,"Elder of the Grove","Once per Long Rest, Bonus Action, 1 minute: Resistance to B/P/S, +5 ft reach, allies within 30 ft regain 5 HP each turn.",0]
 ],
 "Trailbreaker":[
  [3,"Trailbreaker Spells","Always prepared from level 3: Longstrider; more at higher levels.",1],
  [3,"Trailbreaker's Lead","Advantage on Initiative; proficiency in Survival.",1],
  [7,"Sure-Footed","Difficult terrain does not slow you or travelling companions; Advantage on saves against being knocked Prone.",0],
  [11,"Ambush Lines","In a fight's first round, your first weapon hit on a creature that has not acted deals an extra 2d8.",0],
  [15,"Vanish into the Land","Hide as a Bonus Action when Lightly Obscured by foliage, mist or rubble.",0]
 ],
 "Barrow Warden":[
  [3,"Barrow Warden Spells","Always prepared from level 3: Protection from Evil and Good; more at higher levels.",1],
  [3,"Hallowed Shot","Once a turn, a weapon hit deals an extra 1d6 Radiant.",1],
  [7,"Tomb-Sense","You know when Undead are within 60 ft; Advantage on saves against Frightened.",0],
  [11,"Lay to Rest","Undead you drop cannot rise again short of a Wish; chosen creatures within 10 ft regain HP equal to your Wisdom modifier.",0],
  [15,"Warden's Resolve","Resistance to Necrotic; your HP maximum cannot be reduced.",0]
 ],
 "Packbound":[
  [3,"Packbound Spells","Always prepared from level 3: Animal Friendship; more at higher levels.",1],
  [3,"Running with the Pack","Once a turn, a hit while a companion fights beside you deals an extra 1d6 of the weapon's type.",1],
  [7,"Shared Senses","Travelling companions add your Wisdom modifier to their Perception checks.",0],
  [11,"Harrying Pack","When a companion beside you hits a creature, your next attack on it before your next turn ends has Advantage.",0],
  [15,"Pack Endures","Once per Short or Long Rest, Reaction: a companion within 30 ft dropping to 0 HP drops to 1 instead.",0]
 ],
 "Quiet Knife":[
  [3,"First Cut","In a fight's first round, your first weapon hit on a creature deals an extra 1d6 of the weapon's type.",1],
  [3,"Tools of the Trade","Proficiency with the Disguise Kit and the Poisoner's Kit.",0],
  [9,"Borrowed Dark","Hide as a Bonus Action when Lightly Obscured; Advantage on Stealth while moving at half Speed.",0],
  [13,"Quiet Hands","A creature you hit before it has acted makes a Con save (DC 8 + Dex + PB) or cannot speak or cry out until its next turn ends.",0],
  [17,"The Last Cut","Once per Long Rest, make a weapon hit a Critical Hit.",0]
 ],
 "Silvertongue":[
  [3,"Feint","Bonus Action: your next attack on a creature within 5 ft has Advantage. Proficiency Bonus uses per Short or Long Rest.",1],
  [3,"Smooth Talker","You gain proficiency in the Persuasion and Deception skills.",1],
  [9,"Read the Room","Bonus Action: learn a creature's attitude toward you and whether its next words are a lie.",0],
  [13,"Silver Promise","Once per Long Rest, turn a failed Persuasion or Deception check into a success.",0],
  [17,"Unshakeable Story","You cannot be Charmed; magic cannot read your thoughts or detect your lies unless you allow it.",0]
 ],
 "Trickwright":[
  [3,"Trickwright Cantrips","You learn Mage Hand, Minor Illusion and Shocking Grasp (Intelligence).",1],
  [3,"Unseen Fingers","Your Mage Hand is invisible and can pick locks, lift purses or plant objects (you make the check).",0],
  [9,"False Doubles","While a creature can see your Minor Illusion double, its attacks on you have Disadvantage.",0],
  [13,"Spark Trap","Bonus Action: charge an object; the next creature to touch it within a minute takes 3d8 Lightning (Dex save for half).",0],
  [17,"Grand Misdirection","Once per Long Rest, Reaction: an attack or spell aimed at you targets another creature within 30 ft.",0]
 ],
 "Frostblood Sorcery":[
  [3,"Frostblood Spells","Always prepared from level 3: Ice Knife, Fog Cloud, Gust of Wind and Hold Person; more at higher levels.",1],
  [3,"Rime-Touched","Sorcerer spells of level 1 or higher dealing Cold damage add your Charisma modifier, once per casting; cold does not harm you.",1],
  [6,"Hoarfrost Shell","Reaction and 1 Sorcery Point when hit: Resistance to that damage; the attacker loses 10 ft of Speed.",0],
  [14,"Glacial Stride","Resistance to Cold; ignore icy or snowy difficult terrain; walk on water by freezing it.",0],
  [18,"Heart of Winter","Once per Long Rest, Bonus Action, 1 minute: your Cold ignores Resistance; creatures starting a turn within 10 ft take 2d8 Cold.",0]
 ],
 "Veilborn Sorcery":[
  [3,"Veilborn Spells","Always prepared from level 3: Disguise Self, Silent Image, Invisibility and Darkness; more at higher levels.",1],
  [3,"Step Behind the Veil","Bonus Action: the next attack a creature makes against you before your next turn has Disadvantage. PB uses per Long Rest.",1],
  [6,"Through the Veil","Casting an Illusion spell of level 1+ lets you teleport up to 15 ft.",0],
  [14,"Half-There","Resistance to Psychic; move through creatures and objects as difficult terrain (1d10 Force if you end a turn inside one).",0],
  [18,"Veilwalker","Once per Long Rest, Magic action, 1 minute: Invisible, see invisible things, pass through objects; attacking does not end it.",0]
 ],
 "Saintblood Sorcery":[
  [3,"Saintblood Spells","Always prepared from level 3: Cure Wounds, Bless, Aid and Lesser Restoration; more at higher levels.",1],
  [3,"Grace in the Blood","Healing spells cast with a slot restore extra HP equal to your Charisma modifier.",1],
  [6,"Haloed","Bonus Action, 1 Sorcery Point, 1 minute: bright light 20 ft; Undead and Fiends in it have Disadvantage on attacks against you.",0],
  [14,"Martyr's Grace","Reaction: take the damage meant for an ally within 30 ft, with Resistance to it.",0],
  [18,"Miracle","Once per Long Rest, Magic action: restore 70 HP shared among creatures within 30 ft, ending Blinded, Deafened and Poisoned.",0]
 ],
 "Lantern-Keeper Patron":[
  [3,"Lantern-Keeper Spells","Always prepared from level 3: Healing Word, Faerie Fire, Continual Flame and See Invisibility; more at higher levels.",1],
  [3,"Kindly Light","Bonus Action: regain 1d8 + your Warlock level HP. Charisma modifier uses (minimum 1) per Long Rest.",1],
  [6,"Lamp in the Dark","You and chosen creatures within 10 ft see normally in magical darkness out to 30 ft.",0],
  [10,"Guiding Flame","Once per Short or Long Rest, Reaction: an ally within 60 ft rerolls a failed save.",0],
  [14,"Bring Them Home","Once per Long Rest, Magic action: you and up to five allies travel by lantern-light to a place you have rested before.",0]
 ],
 "Elder Grove Patron":[
  [3,"Elder Grove Spells","Always prepared from level 3: Entangle, Goodberry, Barkskin and Spike Growth; more at higher levels.",1],
  [3,"Bark and Bramble","Reaction when hit: reduce the damage by 1d8 + Charisma modifier. Cha mod uses (minimum 1) per Short or Long Rest.",1],
  [6,"Thorned Bargain","A creature within 5 ft that hits you takes Piercing damage equal to your Charisma modifier.",0],
  [10,"Green Passage","Once per Short or Long Rest, Bonus Action: step into a tree or large plant and out of another within 60 ft.",0],
  [14,"Grove's Embrace","Once per Long Rest, Magic action: a creature makes a Strength save or is Restrained, taking 4d10 Bludgeoning each turn.",0]
 ],
 "Whispering Void Patron":[
  [3,"Whispering Void Spells","Always prepared from level 3: Silent Image, Command, Mind Spike and Blindness/Deafness; more at higher levels.",1],
  [3,"Echo of the Void","Warlock spells dealing Force or Psychic damage add your Charisma modifier (half with a cantrip), once per casting.",1],
  [3,"Void-Sight","Once per Short Rest, 1 minute: see through magical darkness and recognise illusions within 30 ft.",0],
  [6,"Unravelling Gaze","Reaction when a creature within 30 ft saves against your spell: it takes Psychic damage equal to Cha modifier + Warlock level.",0],
  [10,"Hollow Mind","Resistance to Psychic; you cannot be Charmed or Frightened by a creature you can see.",0],
  [14,"Call of the Deep Silence","Once per Long Rest, Magic action: Wisdom save, 8d10 Psychic and Incapacitated until its next turn ends, or half on a success.",0]
 ],
 "Wardwright":[
  [3,"Woven Ward","With no armor, your AC is 10 + Dexterity + Intelligence; your hit point maximum rises by 1 per Wizard level.",1],
  [3,"Ward-Scribe","Copying protective spells into your spellbook takes half the time and gold.",0],
  [6,"Spread the Ward","Reaction and a spell slot when an ally within 30 ft is hit: it gains Temporary HP of twice the slot level + Int.",0],
  [10,"Sealed Mind","Advantage on saves against charm and mind-reading spells.",0],
  [14,"Woven Fortress","Once per Long Rest, Bonus Action, 1 minute: you and allies within 10 ft resist damage from spells.",0]
 ],
 "Bonewright":[
  [3,"Marrow-Cold","Wizard spells dealing Necrotic damage add your Intelligence modifier, once per casting.",1],
  [3,"Bone Servant","Once per Long Rest raise a small skeletal servant for 1 hour that follows simple commands and cannot attack.",0],
  [6,"Death's Chill","Resistance to Necrotic; your HP maximum cannot be reduced.",0],
  [10,"Command the Restless","Undead you create gain extra HP equal to your Wizard level; your area spells can spare them.",0],
  [14,"Unmaking Touch","Once per Long Rest, Magic action: touch a creature, Constitution save, 10d10 Necrotic or half on a success.",0]
 ],
 "Fateweaver":[
  [3,"Foreseen Step","Add your Intelligence modifier to Initiative and +1 to your AC; you cannot be Surprised while not Incapacitated.",1],
  [3,"Thread Pull","Bonus Action, twice per Short or Long Rest (3 at level 5): tug a creature's thread; its next attack has disadvantage.",1],
  [6,"Glimpse Ahead","Once per Short or Long Rest cast Augury or Detect Thoughts without a slot.",0],
  [10,"Cut the Thread","Reaction and a spell slot: an attack that hits an ally within 60 ft misses instead.",0],
  [14,"Weaver's Sight","Truesight 30 ft; Thread Pull four times per Short or Long Rest.",0]
 ],
 "Snarewright":[
  [3,"Snarewright Spells","Always prepared from level 3: Grease and Alarm; more at higher levels.",1],
  [3,"Tangle-Bolt","Action: Dexterity save vs your spell DC; 2d6 Piercing and knocked Prone, or half on a success. Int mod uses per Long Rest.",1],
  [3,"Trap-Maker's Kit","Proficiency with Tinker's Tools; during a Short Rest set a snare on a 10-ft square.",0],
  [5,"Barbed Lines","Tangle-Bolt deals 3d6.",1],
  [9,"Chain Reaction","When a snare or Tangle-Bolt catches a creature, a second creature within 10 ft makes the same save.",0],
  [15,"Master of Snares","Tangle-Bolt deals 5d6; creatures have Disadvantage on saves against your snares.",1]
 ],
 "Alchemist":[
  [3,"Field Tonic","Bonus Action: regain 1d8 + Intelligence modifier HP. Int mod uses (minimum 1) per Long Rest.",1],
  [5,"Reagent Boost","Add your Intelligence modifier to one healing roll, or one Acid, Fire or Poison damage roll, of your spells.",0],
  [9,"Restoring Draughts","Lesser Restoration without a slot (Int mod times per Long Rest); draughts you give restore extra HP equal to your Int modifier.",0],
  [15,"Proof Against Poison","Resistance to Acid and Poison; you cannot be Poisoned.",0]
 ],
 "Armorer":[
  [3,"Plated Craft","+1 AC while you wear armor.",1],
  [5,"Second Swing","Attack twice when you take the Attack action.",1],
  [9,"Tuned Plating","Your armor counts as magic; once per Short or Long Rest, Reaction when hit: Temporary HP equal to your Artificer level.",0],
  [15,"Masterwork Suit","Advantage on saves against Grappled, Restrained and Prone; +10 ft Speed while armored.",0]
 ],
 "Artillerist":[
  [3,"Field Engine","Action: Dexterity save vs your spell DC, 2d8 Force (3d8 at 9, 4d8 at 15), half on a success. Int mod uses per Long Rest.",1],
  [5,"Steadied Barrel","Add your Intelligence modifier to one damage roll of an Artificer spell.",0],
  [9,"Burst the Engine","Magic action: creatures within 10 ft of a point make a Dex save, 3d8 Force, half on a success.",0],
  [15,"Entrenched Battery","You and allies within 10 ft of your field engine have Half Cover while you stand still.",0]
 ],
 "Battle Smith":[
  [3,"Smith's Drill","Martial weapon proficiency.",1],
  [3,"Forged Companion","A small mechanical companion that can Help or make one attack on your turn (played by the Dungeon Master).",0],
  [5,"Drilled Strikes","Attack twice when you take the Attack action.",1],
  [9,"Spark Strike","Once a turn, a hit by you or your companion deals +2d6 Force or heals 2d6 nearby. Int mod uses per Long Rest.",0],
  [15,"Reforged Companion","Your companion gets +2 AC and deals 1d4 + Int Force back to creatures that hit it.",0]
 ]
};
// ---- end of features ----
for(const [subclassName,subclassList] of Object.entries(subclassFeatures))if(subclassEngine[subclassName])subclassEngine[subclassName].features=subclassList.map(([level,name,brief,engine])=>({level,name,brief,engine:!!engine}));

const subclassAbilityList=['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'];
const subclassMod=(hero,ability)=>modifier(hero?.scores?.[ability]??10);
// A number that grows with the hero's level: {3:2,6:3} is 2 from level 3 and 3 from level 6.
export function subclassScaled(spec,level,base=null){
 if(spec===undefined||spec===null)return base;
 if(typeof spec!=='object')return spec;
 let value=base;for(const [at,v] of Object.entries(spec).sort((a,b)=>Number(a[0])-Number(b[0])))if(level>=Number(at))value=v;
 return value;
}
// The effects in force for this hero: their own class's subclass, from level 3, each from its own level.
export function subclassEffects(hero){
 const spec=subclassEngine[currentSubclass(hero?.plannedSubclass)];
 if(!spec||spec.class!==hero.class||!(hero.level>=3))return [];
 return spec.effects.filter(e=>e.level<=hero.level);
}
export function subclassPassive(hero){
 const p={hp:0,hpName:'',acBase:null,acBaseName:'',acBonus:[],initiative:[],initiativeAdvantage:false,crit:20,martial:false,extraAttack:false,grappleDC:0,companionBonus:null,skills:[]};
 for(const e of subclassEffects(hero)){
  if(e.kind!=='passive')continue;
  if(e.hp){p.hp+=e.hp;p.hpName=e.name;}
  if(e.acBase){p.acBase=e.acBase;p.acBaseName=e.name;}
  if(e.acBonus)p.acBonus.push({...e.acBonus,name:e.name});
  if(e.initiative)p.initiative.push({ability:e.initiative,name:e.name});
  if(e.initiativeAdvantage)p.initiativeAdvantage=true;
  if(e.crit)p.crit=Math.min(p.crit,e.crit);
  if(e.martial)p.martial=true;
  if(e.extraAttack)p.extraAttack=true;
  if(e.grappleDC)p.grappleDC+=e.grappleDC;
  if(e.companionBonus)p.companionBonus=e.companionBonus;
  if(e.skills)p.skills.push(...e.skills);
 }
 return p;
}
// How many uses: the proficiency bonus, an ability's modifier (at least 1), a number, or a number by level.
export function subclassUses(hero,spec){
 if(spec==='proficiency')return proficiencyBonus(hero.level);
 if(subclassAbilityList.includes(spec))return Math.max(1,subclassMod(hero,spec));
 if(Number.isInteger(spec))return spec;
 return subclassScaled(spec,hero.level,1)??1;
}
export const subclassAction=hero=>subclassEffects(hero).find(e=>e.kind==='action')??null;
export const subclassWard=hero=>subclassEffects(hero).find(e=>e.kind==='ward')??null;
// The one effect that spends uses (an action or a ward), how many it has, and whether a short rest brings them back.
export const subclassSpender=hero=>subclassAction(hero)??subclassWard(hero);
export function subclassUsesLeft(hero,game){const s=subclassSpender(hero);return s?Math.max(0,subclassUses(hero,s.uses)-(game?.resources?.feat??0)):0;}
export function subclassShortRecharge(hero,game){const s=subclassSpender(hero);return !!s&&subclassScaled(s.recharge,hero.level,'long')==='short'&&(game?.resources?.feat??0)>0;}
// A target's resistance, immunity or vulnerability to a damage type.
export function subclassDefended(target,type,amount){
 if(!type||!amount)return amount;
 const has=list=>(list??[]).some(t=>String(t).toLowerCase()===String(type).toLowerCase());
 if(has(target?.immunities))return 0;
 let n=amount;if(has(target?.resistances))n=Math.floor(n/2);if(has(target?.vulnerabilities))n*=2;
 return n;
}
const subclassRiderFits=(e,weapon,ctx)=>{
 const unarmed=!!weapon?.unarmed,melee=!weapon?.ranged&&!weapon?.thrown;
 // `wounded`: only against a creature already missing hit points.
 if(e.wounded&&!ctx.wounded)return false;
 if(e.when==='melee')return melee;
 if(e.when==='weapon')return !unarmed;
 if(e.when==='martialArts')return unarmed||!!weapon?.monk;
 if(e.when==='wounded')return !unarmed&&!!ctx.wounded;
 if(e.when==='firstRound')return !unarmed&&!!ctx.firstRound;
 if(e.when==='companion')return !!ctx.companion;
 return true;
};
// Once on each of the hero's turns (game.featTurn), a hit's extra: damage of a type (doubled dice on a critical hit,
// the target's resistances counted) or an opening for the next attack (Vex). `ctx`: key (who was hit: 'foe', 'ally:N'
// or a person's id), called ('the bandit'), critical, target (its defences), wounded (below its maximum before the
// blow), firstRound, companion (a companion fights beside the hero). The damage line begins with the number, as the
// feed and its hit-point playback read it.
export function subclassRiderRoll(hero,game,weapon,ctx={},random=Math.random){
 if(game?.featTurn)return null;
 const e=subclassEffects(hero).find(x=>x.kind==='rider'&&subclassRiderFits(x,weapon,ctx));
 if(!e)return null;
 const next={...game,featTurn:true},lines=[];let damage=0,dice=[];
 if(e.die>0){
  const count=subclassScaled(e.scale,hero.level,e.count)*(ctx.critical?2:1),type=e.type??weapon?.type??'Bludgeoning';
  dice=Array.from({length:count},()=>1+Math.floor(random()*e.die));
  const raw=dice.reduce((a,b)=>a+b,0)+(e.flat??0);damage=subclassDefended(ctx.target,type,raw);
  lines.push(`${damage} ${type} damage (${e.name}: ${count}d${e.die} [${dice.join(', ')}]${damage!==raw?'; '+raw+' before its defences':''}).`);
 }
 if(e.mark==='vex'){next.vex={target:ctx.key,fresh:true};lines.push(`${e.name}: your next attack against ${ctx.called??'it'} has advantage.`);}
 return {damage,dice,lines,line:lines.join(' '),mark:e.mark??null,game:next};
}
// The Reaction that blunts a blow: once a round (game.reactionUsed), while uses remain. Returns the damage that gets
// through (possibly 0: then the caller records no damage at all).
export function subclassWardRoll(hero,game,total,random=Math.random){
 const w=subclassWard(hero);
 if(!w||game?.reactionUsed||!(total>0))return null;
 const used=game.resources?.feat??0;if(used>=subclassUses(hero,w.uses))return null;
 const die=subclassScaled(w.die,hero.level,8),count=w.count??1,dice=Array.from({length:count},()=>1+Math.floor(random()*die));
 const plus=w.plus==='level'?hero.level:w.plus==='proficiency'?proficiencyBonus(hero.level):subclassAbilityList.includes(w.plus)?subclassMod(hero,w.plus):0;
 const reduce=Math.max(1,dice.reduce((a,b)=>a+b,0)+plus),cut=Math.min(total,reduce);
 return {total:total-cut,reduced:cut,name:w.name,line:`${w.name}: the blow is reduced by ${cut} (${count}d${die} [${dice.join(', ')}]${plus?(plus>0?' + ':' − ')+Math.abs(plus):''}).`,game:{...game,reactionUsed:true,resources:{...(game.resources??{}),feat:used+1}}};
}
// A casting's extra: the modifier once to damage of a listed type (when it dealt any), or to healing from a slot. A
// cantrip may carry only a share of it (`cantrip`: 0.5 is half the modifier, rounded down; 0 nothing).
export function subclassSpellBonus(hero,kind,{type=null,slot=0,cantrip=false}={}){
 for(const e of subclassEffects(hero)){
  if(e.kind!=='spell')continue;
  if(kind==='heal'&&e.heal&&slot>=1){const amount=Math.max(0,subclassMod(hero,e.heal));if(amount)return {amount,label:e.name};}
  if(kind==='damage'&&e.damage&&type&&e.damage.types.includes(type)){const mod=Math.max(0,subclassMod(hero,e.damage.ability)),amount=cantrip&&e.damage.cantrip!==undefined?Math.floor(mod*e.damage.cantrip):mod;if(amount)return {amount,label:e.name};}
 }
 return {amount:0,label:''};
}
// Temporary hit points on a won fight.
export function subclassVictoryTemp(hero){
 const e=subclassEffects(hero).find(x=>x.kind==='victory');if(!e)return null;
 return {amount:Math.max(1,e.plus.reduce((n,p)=>n+(p==='level'?hero.level:subclassMod(hero,p)),0)),name:e.name};
}
// The features in force for the Dungeon Master and the sheet: name, level, one-line rule, and whether the game plays it.
export function subclassBriefs(hero){
 const spec=subclassEngine[currentSubclass(hero?.plannedSubclass)];
 if(!spec||spec.class!==hero.class||!(hero.level>=3))return [];
 return (spec.features??[]).filter(f=>f.level<=hero.level).map(f=>({name:f.name,level:f.level,rule:f.brief,engine:!!f.engine}));
}
// The level-3 features of a subclass, for the choice screens.
export const subclassFirstFeatures=name=>(subclassEngine[name]?.srd?[]:(subclassEngine[name]?.features??[]).filter(f=>f.level===3));
