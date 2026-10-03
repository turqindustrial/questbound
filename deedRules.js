import {packOf} from './inventoryRules';
// Deeds: lasting marks of what a hero has done, worked out from the story so far (game.storyLog) and the state of the
// game, never from how the Dungeon Master told it. A deed is earned once, kept in game.deeds with the log line it was
// earned at and the tale's title, carried into the next tale (newAdventure, carriedBase), shown in the Quest tab and on
// the shareable tale card, and announced with the `deed` cue.
const countLines=(log,test)=>log.filter(test).length;
export const deedList=[
 {id:'first-blood',title:'First Blood',icon:'swords',line:'Won your first fight.',earned:({log})=>countLines(log,e=>e.kind==='victory')>=1},
 {id:'slayer',title:'Slayer',icon:'skull',line:'Won five fights.',earned:({log})=>countLines(log,e=>e.kind==='victory')>=5},
 {id:'merciful',title:'Merciful',icon:'hand',line:'Beat a foe and spared it.',earned:({log})=>log.some(e=>e.kind==='victory'&&/spared/.test(e.text))},
 {id:'survivor',title:'Survivor',icon:'heart',line:'Clung to life at death\'s door.',earned:({log})=>log.some(e=>e.kind==='fall'&&/^Clung to life/.test(e.text))},
 {id:'quick-feet',title:'Quick Feet',icon:'retreat',line:'Lived to fight another day, twice.',earned:({log})=>countLines(log,e=>e.kind==='flight')>=2},
 {id:'wanderer',title:'Wanderer',icon:'travel',line:'Set foot in five places.',earned:({game})=>new Set(game.map?.visited??[]).size>=5},
 {id:'pathfinder',title:'Pathfinder',icon:'compass',line:'Found three places no map showed.',earned:({log})=>countLines(log,e=>e.kind==='place'&&/^Found /.test(e.text))>=3},
 {id:'far-traveller',title:'Far Traveller',icon:'map',line:'Set out for another land.',earned:({log})=>log.some(e=>e.kind==='place'&&/^Set out for a new land/.test(e.text))},
 {id:'silver-tongue',title:'Silver Tongue',icon:'speak',line:'Won three people over.',earned:({log})=>countLines(log,e=>e.kind==='deed'&&/^You won .* over\.$/.test(e.text))>=3},
 {id:'sworn-friend',title:'Sworn Friend',icon:'people',line:'Someone owes you their life.',earned:({log})=>log.some(e=>e.kind==='deed'&&/owes you a debt for life/.test(e.text))},
 {id:'marked',title:'Marked',icon:'eye',line:'Someone swore never to forgive you.',earned:({log})=>log.some(e=>e.kind==='deed'&&/never to forgive/.test(e.text))},
 {id:'good-company',title:'Good Company',icon:'party',line:'Someone joined you on the road.',earned:({log})=>log.some(e=>e.kind==='person'&&/ joined you\.$/.test(e.text))},
 {id:'full-purse',title:'Full Purse',icon:'coin',line:'Carried a hundred gold.',earned:({game,hero})=>packOf(game,hero).gold>=100},
 {id:'pack-rat',title:'Pack Rat',icon:'bag',line:'Carried eight different things.',earned:({game})=>(game.pack?.items??[]).filter(i=>i.name!=='Arrow'&&(i.qty??1)>0).length>=8},
 {id:'well-rested',title:'Well Rested',icon:'rest',line:'Took three long rests.',earned:({log})=>countLines(log,e=>e.kind==='rest'&&/long rest/.test(e.text))>=3},
 {id:'page-turner',title:'Page Turner',icon:'scroll',line:'Finished a chapter of a long tale.',earned:({log})=>log.some(e=>e.kind==='quest'&&/^Finished chapter/.test(e.text))},
 {id:'storyteller',title:'Storyteller',icon:'book',line:'Saw a tale through to its end.',earned:({log})=>log.some(e=>e.kind==='quest'&&/^Adventure complete/.test(e.text))},
 {id:'veteran',title:'Veteran',icon:'star',line:'Reached level 3.',earned:({hero})=>(hero?.level??1)>=3},
 {id:'champion',title:'Champion',icon:'crown',line:'Reached level 5.',earned:({hero})=>(hero?.level??1)>=5},
 {id:'legend',title:'Legend',icon:'starFill',line:'Reached level 10.',earned:({hero})=>(hero?.level??1)>=10},
];
export const deedById=id=>deedList.find(d=>d.id===id)??null;
// Every deed the hero has earned by now, whether or not it is written down yet.
export function earnedDeeds(game,hero){
 if(!game)return [];
 const facts={game,hero,log:Array.isArray(game.storyLog)?game.storyLog:[]};
 return deedList.filter(d=>{try{return !!d.earned(facts);}catch{return false;}}).map(d=>d.id);
}
// The game with any newly earned deeds written down, and their ids (`fresh`) so the screen can announce them.
export function withDeeds(game,hero){
 if(!game)return {game,fresh:[]};
 const have=Array.isArray(game.deeds)?game.deeds:[],known=new Set(have.map(d=>d.id)),fresh=earnedDeeds(game,hero).filter(id=>!known.has(id));
 if(!fresh.length)return {game,fresh};
 const at=game.storyLog?.at(-1)?.id??0,tale=typeof game.story?.title==='string'?game.story.title.slice(0,120):null;
 return {game:{...game,deeds:[...have,...fresh.map(id=>({id,at,tale}))]},fresh};
}
export function validEarnedDeeds(deeds){
 if(deeds===undefined)return true;
 return Array.isArray(deeds)&&deeds.length<=deedList.length&&new Set(deeds.map(d=>d?.id)).size===deeds.length
  &&deeds.every(d=>d&&typeof d==='object'&&!!deedById(d.id)&&Number.isSafeInteger(d.at)&&d.at>=0&&(d.tale===null||d.tale===undefined||(typeof d.tale==='string'&&d.tale.length<=120)));
}
