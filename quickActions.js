import {dmChoices} from './dmContext';
import {knownSpells,automaticEffects} from './spellRules';
import {mapPlaces} from './mapRules';
// One-tap actions for this moment of the game, drawn from the engine's own list of valid choices. Each one sends a
// plain sentence to the Dungeon Master with the engine action attached, so the rules resolve it and the DM narrates.
// Spells need a target, so "Cast…" starts the sentence in the message box instead.
const verbs={
 dodge:['⛨','Dodge','I take the Dodge action.'],flee:['↩','Retreat','I retreat from the fight.'],potion:['✚','Potion','I drink a healing draught.'],
 'long-rest':['☾','Rest','I take a long rest.'],'npc-dodge':['⛨','Dodge','I dodge.'],'npc-flee':['↩','Flee','I flee.'],'npc-wait':['⧗','Wait','I wait.'],
 'npc-surrender':['⚐','Surrender','I surrender.'],'cancel-spell':['✕','Cancel spell','Cancel spell'],'end-concentration':['✕','End concentration','End concentration'],
};
export function quickActions(hero,game){
 // The main weapon leads (gold); backup weapons wait at the end so defence and the potion stay within thumb reach.
 const place=id=>game.story?.locations?.[id]?.name??mapPlaces[id]?.name??id,primary=[],rest=[],backup=[];
 for(const c of dmChoices(hero,game)){
  const id=c.id;
  // Attacking townsfolk and declaring the story finished stay deliberate, typed decisions.
  if(/^(npc-attack|story-complete|restart-adventure)/.test(id))continue;
  if(/^(attack|encounter-attack):/.test(id)){const weapon=id.split(':').pop(),first=!primary.some(a=>a.weapon);(first?primary:backup).push({key:id,glyph:'⚔',label:weapon,question:'I attack with my '+weapon+'.',action:c.action,primary:first,weapon});continue;}
  if(id==='approach'){primary.push({key:id,glyph:'⚔',label:c.label,question:'I '+c.label[0].toLowerCase()+c.label.slice(1)+'.',action:c.action,primary:true});continue;}
  // The Lantern Vaults belong to the crossroads; in a written story they are only reached by asking the DM.
  if(id.startsWith('dungeon:')){if(game.story&&id==='dungeon:enter')continue;const [glyph,label]=dungeonLabels(id,c.label);(id==='dungeon:fight'?primary:rest).push({key:id,glyph,label,question:'I '+c.label[0].toLowerCase()+c.label.slice(1)+'.',action:c.action,primary:id==='dungeon:fight'});continue;}
  if(id.startsWith('travel-')){const destination=c.action?.destination??id.slice(7);rest.push({key:id,glyph:'➜',label:place(destination),question:'I travel to '+place(destination)+'.',action:c.action,destination});continue;}
  const verb=verbs[id];
  if(verb){rest.push({key:id,glyph:verb[0],label:id==='potion'&&game.potions>1?verb[1]+' ×'+game.potions:verb[1],question:verb[2],action:c.action});continue;}
  rest.push({key:id,glyph:'✦',label:c.label.replace(/:.*$/,''),question:c.label.replace(/:.*$/,'')+'.',action:c.action});
 }
 if(!game.pendingSpell&&knownSpells(hero).length)primary.push({key:'cast',glyph:'✧',label:'Cast…',prefill:'I cast '});
 return [...primary,...rest,...backup];
}
// The Cast… picker: every spell the hero knows, cantrips first. Spells the rules resolve on their own cast in one tap:
// healing, protection and detection on yourself; attacks and blasts at the enemy during a fight. Anything else starts
// the sentence so the player says how and at whom. The words are parsed exactly like typed casting.
export function spellActions(hero,game){
 const fighting=game.stage==='combat',foe=game.story||game.dungeon?.active?'the enemy':'the wisp';
 return knownSpells(hero).filter(spell=>!fighting||['Action','Bonus Action'].includes(spell.castingTime)).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name)).map(spell=>{
  const effect=automaticEffects[spell.id],self=!!(effect&&(effect.heal||effect.temp||effect.protection||effect.detection));
  const base={key:'spell:'+spell.id,glyph:'✧',label:spell.name,detail:spell.level?'Level '+spell.level:'Cantrip'};
  if(self)return {...base,question:'I cast '+spell.name+' on me.'};
  if(effect&&fighting)return {...base,question:'I cast '+spell.name+' at '+foe+'.'};
  return {...base,prefill:'I cast '+spell.name+' '+(spell.range==='Self'?'':'on ')};
 });
}
function dungeonLabels(id,label){
 const short={'dungeon:enter':['◈','Enter the vaults'],'dungeon:leave':['↩','Leave the vaults'],'dungeon:disarm':['⚙','Disarm the trap'],'dungeon:search':['⌕','Search the archive'],'dungeon:dawn':['✦','Speak “Dawn”'],'dungeon:basin':['✚','Drink from the basin'],'dungeon:claim':['✦','Claim the treasure']};
 return short[id]??(id==='dungeon:fight'?['⚔',label]:['➜',label.replace(/^Explore /,'')]);
}
