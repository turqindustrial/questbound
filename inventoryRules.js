import {weapons} from './weaponRules';
// What the hero carries beyond their starting kit: gold, things found, bought or given, and arrows used up. The
// starting kit stays on the character; the adventure keeps the pack, so a found sword or a bought quiver of arrows
// can be fought with at once.
export const itemKinds=['weapon','potion','ammunition','treasure','gear','quest'];
// Prices in gold (SRD), for the Dungeon Master's trades and for selling treasure at half value.
export const priceList={'Potion of Healing':50,Arrow:0.05,Dagger:2,Handaxe:5,Javelin:0.5,Mace:5,Quarterstaff:0.2,Sickle:1,Spear:1,Greataxe:30,Greatsword:50,Flail:10,Longsword:15,Scimitar:25,Shortsword:10,Shortbow:25,Longbow:50};
const startingGold=hero=>Math.max(0,Math.floor(hero?.equipment?.totalGold??0));
export function packOf(game,hero){return game.pack??{gold:startingGold(hero),items:[],spent:{}};}
// A geared hero remembers its starting kit, so arrows are never counted twice.
const startingArrows=hero=>(hero?.equipment?.startingItems??hero?.equipment?.items??[]).filter(i=>i.name==='Arrow').reduce((a,i)=>a+i.quantity,0);
export function arrowsLeft(game,hero){const p=packOf(game,hero),bought=p.items.filter(i=>i.name==='Arrow').reduce((a,i)=>a+i.qty,0);return Math.max(0,startingArrows(hero)+bought-(p.spent?.Arrow??0));}
// The hero as the rules see them right now: starting kit plus weapons and arrows from the pack, minus arrows spent.
// The weapon the player chose to fight with (game.wield, set from the inventory) leads when they carry it.
export function gearedHero(hero,game){
 if((!game?.pack&&!game?.wield)||!hero?.equipment||hero.equipment.startingItems)return hero;
 const items=(hero.equipment.items??[]).filter(i=>i.name!=='Arrow').map(i=>({...i}));
 for(const it of game.pack?.items??[])if(it.kind==='weapon'&&weapons[it.name]){const have=items.find(i=>i.name===it.name);if(have)have.quantity+=it.qty;else items.push({name:it.name,quantity:it.qty});}
 // Weapons thrown in a fight and not yet gathered up are not in hand.
 for(const [name,n] of Object.entries(game.pack?.spent??{}))if(name!=='Arrow'){const have=items.find(i=>i.name===name);if(have)have.quantity=Math.max(0,have.quantity-n);}
 const arrows=arrowsLeft(game,hero);if(arrows>0)items.push({name:'Arrow',quantity:arrows});
 return {...hero,equipment:{...hero.equipment,items,startingItems:hero.equipment.items,...(game.wield?{wield:game.wield}:{})}};
}
// A bow shot uses an arrow.
export function spendArrow(game,hero){const p=packOf(game,hero);return {...game,pack:{...p,spent:{...p.spent,Arrow:(p.spent?.Arrow??0)+1}}};}
// A throw leaves the weapon where it landed until the fight is over.
export function spendThrown(game,hero,name){const p=packOf(game,hero);return {...game,pack:{...p,spent:{...p.spent,[name]:(p.spent?.[name]??0)+1}}};}
// After the fight: every thrown weapon is gathered up again (arrows stay spent). Null when nothing was thrown.
export function gatherThrown(game){
 const spent=game.pack?.spent??{},names=Object.keys(spent).filter(k=>k!=='Arrow'&&spent[k]>0);if(!names.length)return null;
 const kept=spent.Arrow!==undefined?{Arrow:spent.Arrow}:{};
 return {game:{...game,pack:{...game.pack,spent:kept}},line:'You gather up your thrown '+names.map(n=>n.toLowerCase()+(spent[n]>1?'s':'')).join(' and ')+'.'};
}
const lootText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
// Normalise what the Dungeon Master hands over: known weapon names, "healing potion" → Potion of Healing, arrows.
function normalise(it){
 let name=String(it.name??'').trim(),kind=it.kind;
 if(/potion/i.test(name)&&/heal/i.test(name)){name='Potion of Healing';kind='potion';}
 if(/^arrows?$/i.test(name)){name='Arrow';kind='ammunition';}
 const weapon=Object.keys(weapons).find(w=>w.toLowerCase()===name.toLowerCase());if(weapon){name=weapon;kind='weapon';}
 return {...it,name,kind};
}
// Gold found, earned or paid, and items gained or given up, in one bounded change. Returns {game, lines} or {error}.
export function applyLoot(game,hero,loot){
 if(!loot||typeof loot!=='object')return {error:'Nothing changed hands.'};
 const gold=loot.gold??0,items=(loot.items??[]).map(normalise),level=hero?.level??1;
 if(!Number.isInteger(gold)||gold>40*level+60||gold<-5000)return {error:'That amount of gold is not plausible here.'};
 if(!Array.isArray(items)||items.length>4||!items.every(it=>lootText(it.name,60)&&itemKinds.includes(it.kind)&&Number.isInteger(it.qty)&&it.qty!==0&&Math.abs(it.qty)<=40&&(it.value===undefined||(Number.isFinite(it.value)&&it.value>=0&&it.value<=5000))))return {error:'Those items were not described clearly enough.'};
 if(items.some(it=>it.kind==='weapon'&&!weapons[it.name]))return {error:'Only weapons the game knows can be carried as weapons.'};
 let pack=packOf(game,hero),potions=game.potions??0;const lines=[];
 if(pack.gold+gold<0)return {error:'You do not have enough gold.'};
 pack={...pack,gold:pack.gold+gold,items:pack.items.map(i=>({...i}))};
 if(gold>0)lines.push(`You gain ${gold} gold (now ${pack.gold}).`);if(gold<0)lines.push(`You pay ${-gold} gold (${pack.gold} left).`);
 for(const it of items){
  if(it.kind==='potion'){if(potions+it.qty<0)return {error:'You do not have that many potions.'};potions=Math.min(20,potions+it.qty);lines.push(it.qty>0?`You gain ${it.qty} ${it.name}${it.qty>1?'s':''} (${potions} carried).`:`You give up ${-it.qty} ${it.name}${it.qty<-1?'s':''}.`);continue;}
  const have=pack.items.find(i=>i.name.toLowerCase()===it.name.toLowerCase());
  if(it.qty<0){if(!have||have.qty+it.qty<0)return {error:'You do not have '+it.name+' to give up.'};have.qty+=it.qty;lines.push(`You give up ${-it.qty} × ${have.name}.`);continue;}
  // What the Dungeon Master said the thing is travels with it (the first telling is kept).
  const note=typeof it.note==='string'&&it.note.trim()?it.note.trim().slice(0,160):null;
  if(have){have.qty+=it.qty;if(note&&!have.note)have.note=note;}else{if(pack.items.length>=40)return {error:'Your pack is full.'};pack.items.push({name:it.name.trim(),kind:it.kind,qty:it.qty,...(it.value!==undefined?{value:Math.round(it.value*100)/100}:{}),...(note?{note}:{})});}
  lines.push(`You gain ${it.qty>1?it.qty+' × ':''}${it.name}${it.kind==='treasure'&&it.value?' (worth '+it.value+' gold)':''}.`);
 }
 pack.items=pack.items.filter(i=>i.qty>0);
 return {game:{...game,pack,potions},lines};
}
export function validPack(p){
 if(p===undefined)return true;
 return !!p&&Number.isInteger(p.gold)&&p.gold>=0&&p.gold<=1e6&&Array.isArray(p.items)&&p.items.length<=40&&new Set(p.items.map(i=>i?.name?.toLowerCase())).size===p.items.length&&p.items.every(i=>i&&lootText(i.name,60)&&itemKinds.includes(i.kind)&&i.kind!=='potion'&&Number.isInteger(i.qty)&&i.qty>=1&&i.qty<=999&&(i.value===undefined||(Number.isFinite(i.value)&&i.value>=0&&i.value<=5000))&&(i.note===undefined||lootText(i.note,160))&&(i.kind!=='weapon'||!!weapons[i.name]))&&!!p.spent&&typeof p.spent==='object'&&Object.entries(p.spent).every(([k,v])=>(k==='Arrow'||/^Thrown\b/.test(weapons[k]?.range??''))&&Number.isInteger(v)&&v>=0&&v<=10000);
}
// A healing draught for someone else: it brings round a companion lying senseless.
export function potionHealing(random){const a=1+Math.floor(random()*4),b=1+Math.floor(random()*4);return {a,b,total:a+b+2};}
