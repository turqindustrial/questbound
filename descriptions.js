import {weapons,attackOptions,attacksPerAction,canThrow} from './weaponRules';
import {masteryOf,masteryText,unarmedDC} from './masteryRules';
import {combatBasics} from './combatRules';
import {windLimit,shortRestLimit} from './classActions';
import {knownSpells} from './spellRules';
import {placeName,travelRoute,mapLocation,distanceText,durationText} from './mapRules';
// What things are, in a sentence or two: every item a hero can carry, every action the game offers and every spell
// they know. The inventory, the action guide and the spell picker all read from here, so nothing on screen is
// without an explanation.

// ---------- Items ----------
const weaponNotes={
 Dagger:'A short blade, quick in the hand and balanced for throwing.',Handaxe:'A one-handed axe that can be thrown.',Javelin:'A light throwing spear.',Mace:'A flanged iron head on a short haft: it crushes rather than cuts.',
 Quarterstaff:'A stout wooden staff, used in one hand or two.',Sickle:'A curved harvesting blade pressed into service.',Spear:'A long shaft with an iron point, for thrusting or throwing.',
 Greataxe:'A huge two-handed axe that cleaves through whatever it meets.',Greatsword:'A two-handed blade as long as its wielder is tall.',Flail:'A spiked weight on a chain.',Longsword:'A straight, double-edged blade, used in one hand or two.',
 Scimitar:'A light curved blade, made for quick cuts.',Shortsword:'A short stabbing blade for close work.',Shortbow:'A small bow, quick to draw.',Longbow:'A tall war bow with a long reach.',
};
// How a weapon reads on its own (no hero): what kind it is, its damage and its properties.
export function weaponSummary(name){
 const w=weapons[name];if(!w)return '';
 const traits=[w.finesse?'finesse (Strength or Dexterity)':null,w.light?'light (one in each hand)':null,w.versatile?'versatile':null,w.heavy?'heavy':null,w.twoHands?'two-handed':null,w.range?w.range.replace(/\.$/,'').toLowerCase():null].filter(Boolean);
 return (w.martial?'Martial ':'Simple ')+(w.ranged?'ranged':'melee')+' weapon: '+(w.count??1)+'d'+w.die+' '+w.type.toLowerCase()+' damage'+(traits.length?'; '+traits.join(', '):'')+'.';
}
const gearNotes={
 'Chain Mail':'Heavy armor of interlocking rings: armor class 16. It needs Strength 13, and its noise gives disadvantage on Stealth.',
 'Chain Shirt':'A shirt of mail worn between layers of cloth: armor class 13 + Dexterity (at most +2).',
 'Studded Leather Armor':'Tough leather set with close rivets: armor class 12 + Dexterity.',
 'Leather Armor':'Boiled leather shaped to the body: armor class 11 + Dexterity.',
 Shield:'Carried on one arm: +2 to armor class. It leaves one hand free for a weapon.',
 Robe:'Plain robes with deep pockets. No protection at all.',
 Arrow:'Ammunition for a bow. Each shot spends one.',
 Quiver:'Keeps your arrows at your hip, ready to draw.',
 'Holy Symbol':'The emblem of your faith. It stands in for the material components of your spells.',
 'Arcane Focus (Crystal)':'A crystal that channels arcane power. It stands in for the material components of your spells.',
 'Arcane Focus (Orb)':'A polished orb that channels arcane power. It stands in for the material components of your spells.',
 'Arcane Focus (Quarterstaff)':'A staff that channels arcane power in place of material components, and serves as a quarterstaff: 1d6 bludgeoning.',
 'Druidic Focus (Quarterstaff)':'A staff cut from living wood. It channels your magic in place of material components, and serves as a quarterstaff: 1d6 bludgeoning.',
 'Druidic Focus (Mistletoe)':'A sprig of mistletoe that channels your magic in place of material components.',
 Spellbook:'The book your spells are written in. After a long rest you prepare spells from it.',
 'Book (Occult Lore)':'A book of strange lore that touches on your patron.',
 Lute:'A stringed instrument. A bard casts spells through its music.',Flute:'A wooden flute. A bard casts spells through its music.',Drum:'A hand drum. A bard casts spells through its rhythm.',
 "Thieves’ Tools":'Picks, a file, a mirror on a handle and narrow pliers: for opening locks and disarming traps.',
 "Tinker’s Tools":'Hand tools, wire, thread and scraps of cloth and leather: for mending things and building small devices.',
 'Herbalism Kit':'Pouches, clippers and a mortar: for knowing plants and brewing simple remedies.',
 "Dungeoneer’s Pack":'A backpack with a crowbar, a hammer, pitons, torches, a tinderbox, rations, a waterskin and 50 feet of rope.',
 "Explorer’s Pack":'A backpack with a bedroll, a mess kit, a tinderbox, torches, rations, a waterskin and 50 feet of rope.',
 "Priest’s Pack":'A backpack with a blanket, candles, a tinderbox, an alms box, incense, vestments, rations and a waterskin.',
 "Entertainer’s Pack":'A backpack with a bedroll, costumes, candles, rations, a waterskin and a disguise kit.',
 "Burglar’s Pack":'A backpack with ball bearings, string, a bell, candles, a crowbar, a hammer, pitons, a hooded lantern, oil, rations, a tinderbox, a waterskin and rope.',
 "Scholar’s Pack":'A backpack with a book of lore, ink and a pen, parchment, a little bag of sand and a small knife.',
 'Potion of Healing':'A red draught. Drink it to regain 2d4 + 2 hit points (a bonus action in a fight), or give it to a companion.',
};
const kindNotes={weapon:'A weapon you can fight with.',ammunition:'Ammunition for a weapon that shoots or is thrown.',treasure:'Something of value: sell it for about half its worth, or trade it.',gear:'Useful gear. Tell the Dungeon Master how you use it.',quest:'It matters to your errand. Keep it safe.',potion:'A draught to drink. Ask the Dungeon Master what it does.'};
// What an item is. note is what the Dungeon Master said of it when it was found.
export function itemDescription(name,kind=null,note=null){
 const plain=String(name??'').trim(),weapon=plain.includes('(Quarterstaff)')?null:weapons[plain];
 // Its mastery property, which heroes trained in the weapon can use (Barbarians, Fighters, Paladins, Rangers, Rogues).
 if(weapon)return weaponNotes[plain]+' '+weaponSummary(plain)+(weapon.mastery?' Mastery for those trained in it: '+masteryText[weapon.mastery]:'');
 if(gearNotes[plain])return gearNotes[plain];
 if(typeof note==='string'&&note.trim())return note.trim();
 return kindNotes[kind]??'Part of your kit.';
}
export const goldDescription='Coin. Tell the Dungeon Master what you want to buy, bribe or pay for.';
export const draughtDescription=gearNotes['Potion of Healing'];

// ---------- Actions ----------
const damageText=w=>w.flat?(1+w.bonus)+' bludgeoning':(w.count>1?w.count:1)+'d'+w.die+(w.bonus?' '+(w.bonus>0?'+ ':'− ')+Math.abs(w.bonus):'')+' '+w.type.toLowerCase();
// A throw: the same roll and damage as a ranged attack, and the weapon lands where it falls until the fight is over.
function throwText(hero,name){
 const w=attackOptions(hero).find(o=>o.name===name&&canThrow(o));if(!w)return 'Throw it. Uses your action.';
 const swings=attacksPerAction(hero);
 return 'Throw it: roll a d20 '+(w.attackBonus>=0?'+ ':'− ')+Math.abs(w.attackBonus)+' against the target’s armor class; a hit deals '+damageText(w)+' damage. A ranged attack: with the foe right beside you it has disadvantage. The '+w.name.toLowerCase()+' stays where it lands until you gather it up after the fight. Uses your action'+(swings>1?' ('+swings+' throws)':'')+'.';
}
function attackText(hero,name){
 const w=attackOptions(hero).find(o=>o.name===name);if(!w)return 'Attack with it. Uses your action.';
 const swings=attacksPerAction(hero);
 const mastery=masteryOf(hero,w);
 return 'Roll a d20 '+(w.attackBonus>=0?'+ ':'− ')+Math.abs(w.attackBonus)+' against the target’s armor class; a hit deals '+damageText(w)+' damage'+(w.heavyDisadvantage?' (disadvantage: this weapon is too heavy for you)':'')+(w.ranged?', and each shot spends an arrow':'')+'. Uses your action'+(swings>1?' ('+swings+' attacks)':'')+'.'+(mastery?' Your mastery: '+masteryText[mastery]:'');
}
// Grapple or Shove: an Unarmed Strike that seizes or knocks down instead of striking.
function unarmedText(hero,kind){
 const dc=unarmedDC(hero),swings=attacksPerAction(hero);
 return (kind==='grapple'?'Grapple: seize it with a free hand. It resists with a Strength or Dexterity save against DC '+dc+'; if it fails, it cannot move, cannot get up if it lies prone, and has disadvantage on attacks at anyone but you. You let go to swing a two-handed weapon.':'Shove: knock it to the ground. It resists with a Strength or Dexterity save against DC '+dc+'; if it fails it falls prone: your blows at arm’s length have advantage against it, shots and throws disadvantage, and its own attacks have disadvantage until it gets up on its turn.')+' Works on a creature no more than one size larger than you. Takes one attack of your action'+(swings>1?' (your other attacks follow with your weapon)':'')+'.';
}
// What a one-tap action (a chip from quickActions) does, for the action guide and hover tips.
export function actionDescription(action,hero,game){
 const key=String(action?.key??''),level=hero.level??1;
 if(key==='level-up')return 'You have earned a new level. Choose what you gain.';
 if(key==='cast')return 'Choose one of your spells to cast.';
 if(key==='spells-back')return 'Back to your other actions.';
 if(key.startsWith('spell:'))return spellSummary(knownSpells(hero).find(s=>'spell:'+s.id===key));
 if(key==='end-turn')return game.actionUsed?'Finish your turn without a bonus action. The enemy acts next.':'Pass your turn without acting. The enemy acts next.';
 if(key==='attack-menu')return 'Choose a weapon to attack with: everything you carry for close fighting under Melee, bows and throwing weapons under Ranged, and who to attack when there is more than one.';
 if(key==='attack-back')return 'Back to your other actions.';
 if(key.startsWith('target:'))return 'Attack this one: the weapons below are aimed at them.';
 if(/^(grapple|shove)$/.test(key))return unarmedText(hero,key);
 if(/^ally-(grapple|shove):/.test(key))return 'The creature fighting beside your foe. '+unarmedText(hero,key.slice(5).split(':')[0]);
 if(/^npc-(grapple|shove):/.test(key))return 'Someone you lay hands on will remember it. '+unarmedText(hero,key.slice(4).split(':')[0]);
 if(key.startsWith('offhand:')){const w=attackOptions(hero).find(o=>o.name===key.slice(8)),nick=action.detail==='Nick',mastery=w?masteryOf(hero,w):null;return 'Two-weapon fighting: strike once with the '+key.slice(8).toLowerCase()+' in your other hand'+(w?' (d20 '+(w.attackBonus>=0?'+ ':'− ')+Math.abs(w.attackBonus)+'; '+(w.flat?'1':w.count+'d'+w.die)+(w.bonus<0?' − '+Math.abs(w.bonus):'')+' '+w.type.toLowerCase()+' damage, without your ability bonus)':'')+'. '+(nick?'With Nick it is part of your Attack action, so your bonus action stays free.':'It costs your bonus action.')+(mastery&&mastery!=='Nick'?' Your mastery: '+masteryText[mastery]:'');}
 if(/^(throw|encounter-throw):/.test(key))return throwText(hero,key.split(':').pop());
 if(key.startsWith('ally-throw:'))return 'Throw at the creature fighting beside your foe. '+throwText(hero,key.split(':').pop());
 if(key.startsWith('npc-throw:'))return 'Throw at them. Someone you hurt will remember it. '+throwText(hero,key.split(':').pop());
 if(key.startsWith('npc-attack:'))return 'Attack them. Someone you hurt will remember it, and a blow that drops them kills them unless you set out to knock them out. '+attackText(hero,key.split(':').pop());
 if(/^(attack|encounter-attack):/.test(key))return attackText(hero,key.split(':').pop());
 if(key.startsWith('ally-attack:'))return 'Strike the creature fighting beside your foe. '+attackText(hero,key.split(':').pop());
 if(key==='dodge'||key==='npc-dodge')return 'Give your whole turn to defence: until your next turn, attacks against you are rolled with disadvantage. Uses your action.';
 if(key==='flee')return 'Break away from the fight and fall back the way you came. The foe keeps its wounds and is still there when you return.';
 if(key==='npc-flee')return 'Run from this fight.';
 if(key==='npc-wait')return 'Hold your ground and let the others act.';
 if(key==='npc-surrender')return 'Lay down your weapon and give yourself up. The fight ends.';
 if(key==='potion')return 'Drink a healing draught: regain 2d4 + 2 hit points. In a fight it costs your bonus action, not your action.';
 if(key.startsWith('give-potion:'))return 'Give them one of your healing draughts: they regain 2d4 + 2 hit points and come round. Someone you bring back will not forget it.';
 if(key==='class:wind')return 'Second Wind: catch your breath and regain 1d10 + '+level+' hit points. A bonus action; '+windLimit(hero)+' uses, which return when you rest.';
 if(key==='class:hands')return 'Lay on Hands: heal your own wounds from a pool of '+5*level+' hit points that returns after a long rest. A bonus action.';
 if(key==='class:strike')return 'Martial Arts: follow up with one unarmed strike. A bonus action.';
 if(key==='short-rest')return 'Rest for an hour: you and each companion regain half your hit points, and a Fighter’s Second Wind and a Warlock’s spell slots return. '+shortRestLimit(hero)+' short rests between long rests.';
 if(key==='long-rest')return 'Sleep the night somewhere safe: all hit points, spell slots, abilities and short rests return.';
 if(key==='death-save')return 'Roll a d20. Ten or more is a success: three successes and you live, three failures and you die. A 20 puts you back on your feet with 1 hit point; a 1 counts as two failures.';
 if(key==='approach')return 'Go and face it. The fight begins.';
 if(key==='cancel-spell')return 'Give up the spell that is waiting for a ruling. Nothing is spent.';
 if(key==='end-concentration')return 'Let go of the spell you are concentrating on. Its effect ends.';
 if(key.startsWith('travel-')&&action.destination){const here=mapLocation(game),route=travelRoute(game,here,action.destination);return 'Walk to '+placeName(game,action.destination)+(route?': '+distanceText(route.feet)+', about '+durationText(route.minutes)+' on foot':'')+'.';}
 if(key.startsWith('dungeon:'))return {'dungeon:enter':'Go down into the vaults beyond the bridge.','dungeon:leave':'Climb back out of the vaults.','dungeon:disarm':'Try to make the trap safe.','dungeon:search':'Search this room carefully.','dungeon:dawn':'Speak the word of opening.','dungeon:basin':'Drink from the basin.','dungeon:claim':'Take what the vault holds.','dungeon:fight':'Face the guardian. The fight begins.'}[key]??'Move on through the vaults.';
 return action?.question?'“'+action.question+'”':'Do this.';
}
// What it costs in a fight: the action, the bonus action, or nothing.
export function actionCost(action,game){
 const key=String(action?.key??'');
 if(game.stage!=='combat'&&!game.npcCombat?.active)return null;
 if(['potion','class:wind','class:hands','class:strike'].includes(key))return 'Bonus action';
 if(key.startsWith('offhand:'))return action.detail==='Nick'?null:'Bonus action';
 if(key.startsWith('spell:'))return action.detail?.includes('Bonus')?'Bonus action':'Action';
 if(key==='end-turn'||key==='cast'||key==='spells-back'||key==='death-save')return null;
 return 'Action';
}

// ---------- Spells ----------
const firstSentences=(text,max)=>{const clean=String(text??'').replace(/[*_]/g,'').replace(/\s+/g,' ').trim();if(clean.length<=max)return clean;const cut=clean.slice(0,max),stop=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('! '));return (stop>=40?cut.slice(0,stop+1):cut.replace(/\s+\S*$/,'')+'…');};
// A spell in brief: what it does (the first sentence or two of its description).
export function spellSummary(spell,max=230){return spell?firstSentences(spell.description,max):'';}
// Its particulars on one line: level, casting time, range, duration.
export function spellFacts(spell){
 if(!spell)return '';
 return [(spell.level?'Level '+spell.level:'Cantrip'),spell.castingTime,spell.range,(spell.concentration?'Concentration, ':'')+String(spell.duration??'').replace(/^./,c=>c.toUpperCase())].filter(Boolean).join(' · ');
}
// The hero's own defence in words (for the equipment panel).
export function defenceText(hero){const c=combatBasics(hero);return c.available&&c.ac!==null?c.defense+': '+c.acFormula:'';}
