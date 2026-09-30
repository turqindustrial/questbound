import {mapState} from './mapRules';
import {modifier} from './characterRules';
import {combatBasics} from './combatRules';
import {updateHealth} from './healthRules';
export const dungeonRooms=[
 {name:'Broken Gate',text:'Beyond the bridge, a half-mile trail ends at buried stone doors. The ruined vaults protected the heart of the lantern network.',exits:[1]},
 {name:'Forked Passage',text:'A guard chamber lies to the left; the right passage smells of damp copper. Both lead deeper.',exits:[0,2,3]},
 {name:'Sentinel Hall',text:'A cracked stone sentinel bars the northern archway.',exits:[1,4],foe:'Stone Sentinel'},
 {name:'Pressure Gallery',text:'Alternating floor tiles hide a dart trap. You can examine the mechanism before crossing.',exits:[1,4],trap:true},
 {name:'Archive of Dawn',text:'Broken tablets describe the wardens’ final vow. Search the archive for a way to open the inner seal.',exits:[2,3,5]},
 {name:'Silent Sanctuary',text:'A sealed door bears the inscription: Name the hour that defeats the night. An intact basin holds one restorative blessing.',exits:[4,6]},
 {name:'Warden’s Crypt',text:'The Lantern Warden rises before the final vault. Its fractured heart burns with cold light.',exits:[5,7],foe:'Lantern Warden'},
 {name:'Lantern Heart Vault',text:'An amber crystal rests in a bronze cradle. Returning it to the surface will restore the old network. A chest holds the wardens’ remaining coin.',exits:[6]},
];
export function dungeonState(game){return game.dungeon??{active:false,room:0,visited:[],cleared:[],trapResolved:false,wordFound:false,sealOpen:false,restUsed:false,complete:false,gold:0};}
export function validDungeon(d){return d===undefined||!!d&&typeof d==='object'&&Number.isInteger(d.room)&&d.room>=0&&d.room<8&&['active','trapResolved','wordFound','sealOpen','restUsed','complete'].every(k=>typeof d[k]==='boolean')&&['visited','cleared'].every(k=>Array.isArray(d[k])&&new Set(d[k]).size===d[k].length&&d[k].every(n=>Number.isInteger(n)&&n>=0&&n<8))&&d.gold===(d.complete?75:0)&&(!d.complete||(d.gold===75&&d.cleared.includes(6)))&&(!d.active||d.visited.includes(d.room));}
export function dungeonChoices(game){
 const d=dungeonState(game);if(game.pendingSpell)return [];
 if(['bridge','victory'].includes(game.stage)&&game.enemyHP===0)return [{id:'dungeon:enter',label:'Travel beyond the bridge and enter the dungeon'}];
 if(game.stage!=='dungeon')return [];
 const room=dungeonRooms[d.room],choices=[];const add=(id,label)=>choices.push({id:'dungeon:'+id,label});
 add('leave','Leave the dungeon and return to the bridge');
 if(room.foe&&!d.cleared.includes(d.room)){add('fight','Confront '+room.foe);return choices;}
 if(d.room===3&&!d.trapResolved)add('disarm','Examine and disarm the pressure-plate trap');
 if(d.room===4&&!d.wordFound)add('search','Search the archive for the seal word');
 if(d.room===5){if(!d.sealOpen&&d.wordFound)add('dawn','Speak Dawn to unlock the inner seal');if(!d.restUsed)add('basin','Drink from the restorative basin');}
 if(d.room===7&&!d.complete)add('claim','Recover the Lantern Heart and claim the vault treasure');
 for(const n of room.exits)if(!(d.room===5&&n===6&&!d.sealOpen))add('move:'+n,'Explore '+dungeonRooms[n].name);
 return choices;
}
export function dungeonAction(game,health,hero,action,random=Math.random){
 if(typeof action!=='string'||!action.startsWith('dungeon:'))return null;
 const d=dungeonState(game),stats=combatBasics(hero);if((health?.current??stats.hp)<=0)return {game,health,error:'Recover before exploring the dungeon.'};
 if(!dungeonChoices(game).some(c=>c.id===action))return {game,health,error:'That dungeon action is unavailable here.'};
 let next={...game,dungeon:{...d}},hp=health??{current:stats.hp,temp:0},text='',minutes=0;const a=action.slice(8);
 if(a==='enter'){next.stage='dungeon';next.dungeon={...d,active:true,room:0,visited:[...new Set([...d.visited,0])]};next.map={...mapState(game),peaceful:false,visited:[...new Set([...mapState(game).visited,'dungeon'])]};minutes=6;text='You follow the 1,800-ft trail beyond the bridge to the Broken Gate. Six minutes pass.';}
 else if(a==='leave'){next.stage='bridge';next.enemyHP=0;next.dungeon.active=false;minutes=6;text='You retrace the explored passages and follow the 1,800-ft trail back to the bridge. The outdoor walk takes six minutes; retreat through the dungeon is abstracted.';}
 else if(a==='fight'){next.stage='combat';next.enemyHP=(d.room===6?14:8)+4*(hero.level-1);text=dungeonRooms[d.room].foe+' challenges you. Your turn.';}
 else if(a==='search'){next.dungeon.wordFound=true;text='The tablets reveal the seal word: DAWN. The heart lies beyond the Warden’s Crypt.';}
 else if(a==='dawn'){if(!d.wordFound)return {game,health,error:'You have not discovered the seal word. Search the archive first.'};next.dungeon.sealOpen=true;text='You speak Dawn. The sanctuary seal opens.';}
 else if(a==='basin'){next.dungeon.restUsed=true;hp={...hp,current:stats.hp};text='The basin restores your HP, then dries. Spell slots are unchanged. This blessing can be used once.';}
 else if(a==='claim'){next.dungeon.complete=true;next.dungeon.gold=75;text='You recover the Lantern Heart and 75 GP. The dungeon is complete. Return through the Broken Gate to the bridge.';}
 else if(a==='disarm'){const die=1+Math.floor(random()*20),total=die+modifier(hero.scores.Dexterity);next.dungeon.trapResolved=true;text=`Trap check: d20 ${die} + Dexterity ${modifier(hero.scores.Dexterity)} = ${total} vs DC 12. `;if(total>=12)text+='You disable the darts.';else{const damage=1+Math.floor(random()*4);hp=updateHealth(hp,stats.hp,'damage',damage);text+=`The darts fire for ${damage} damage; the mechanism is spent.`;}}
 else if(a.startsWith('move:')){const n=Number(a.slice(5));if(d.room===3&&!d.trapResolved){next.dungeon.trapResolved=true;const damage=1+Math.floor(random()*4);hp=updateHealth(hp,stats.hp,'damage',damage);text=`You cross the active tiles and take ${damage} dart damage. `;}next.dungeon.room=n;next.dungeon.visited=[...new Set([...d.visited,n])];minutes=1;text+=`You explore the passage to ${dungeonRooms[n].name}. One exploration minute passes.`;}
 if(minutes){next.map={...mapState(next),minutes:mapState(next).minutes+minutes};for(const key of ['concentration','temporarySpell'])if(next[key]?.remaining!=null){next[key]={...next[key],remaining:next[key].remaining-minutes*10};if(next[key].remaining<=0){delete next[key];if(key==='temporarySpell')hp={...hp,temp:0};}}}
 if(hp.current===0){next.stage='defeat';next.dungeon.active=false;next.map={...mapState(next),peaceful:false};delete next.concentration;text+=' You collapse and are rescued to the inn. Dungeon discoveries remain saved.';}
 next.log=[text,...game.log].slice(0,40);return {game:next,health:hp,campaignEvent:{title:'Beyond the bridge',text}};
}
