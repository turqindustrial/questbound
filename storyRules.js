import {validTies,validRegard,firstImpressions,seatResidents} from './relationshipRules';
import {validGeography,makeGeography,landmarkPlaces,farLandPlaces,terrains,placeKinds} from './mapRules';
import {genders} from './npcRules';
const damageTypes=['Slashing','Piercing','Bludgeoning','Cold','Fire','Poison','Necrotic'];
function validFoeStats(f){
 const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 return !!f&&int(f.maximum,1,500)&&int(f.ac,5,30)&&int(f.attackBonus,-5,20)&&[4,6,8,10,12].includes(f.die)&&int(f.count,1,6)&&int(f.bonus,-5,20)&&damageTypes.includes(f.type)
  &&!!f.saves&&Object.entries(f.saves).every(([k,v])=>['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'].includes(k)&&int(v,-10,20))
  &&(f.group===undefined||(int(f.group.size,2,6)&&int(f.group.memberHP,1,200)&&f.maximum===f.group.size*f.group.memberHP&&typeof f.group.plural==='string'&&f.group.plural.length>0&&f.group.plural.length<=80));
}
export function validStory(s){
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 return !!s&&text(s.id,100)&&text(s.title,100)&&text(s.premise,800)&&text(s.opening,1000)&&text(s.objective,400)&&text(s.resolution,600)&&text(s.secret,800)&&text(s.foe,80)&&(s.foeSpecies===undefined||text(s.foeSpecies,80))&&(s.foeAppearance===undefined||text(s.foeAppearance,600))&&(s.foeStats===undefined||validFoeStats(s.foeStats))&&(s.foeDamageType===undefined||damageTypes.includes(s.foeDamageType))&&(s.openingDialogue===undefined||(Array.isArray(s.openingDialogue)&&s.openingDialogue.length>=1&&s.openingDialogue.length<=4&&s.openingDialogue.every(l=>l&&/^(?:keeper|mara|n(?:[1-9]|1\d|2[0-4]))$/.test(String(l.speakerId))&&text(l.text,300))))&&['active','complete'].includes(s.status)&&['inn','bridge','tower'].every(id=>s.locations?.[id]&&text(s.locations[id].name,80)&&text(s.locations[id].description,500)&&(s.locations[id].kind===undefined||placeKinds.includes(s.locations[id].kind)))&&['keeper','mara'].every(id=>s.npcs?.[id]&&text(s.npcs[id].name,60)&&text(s.npcs[id].role,300)&&text(s.npcs[id].motive,400)&&(s.npcs[id].species===undefined||text(s.npcs[id].species,80))&&(s.npcs[id].appearance===undefined||text(s.npcs[id].appearance,600))&&(s.npcs[id].personality===undefined||text(s.npcs[id].personality,300))&&validTies(s.npcs[id].ties)&&(s.npcs[id].gender===undefined||genders.includes(s.npcs[id].gender))&&validRegard(s.npcs[id].regard))
  // The story's own land: where its places lie, what the country is called and what kind of country it is.
  &&(s.geography===undefined||validGeography(s.geography))&&(s.region===undefined||text(s.region,60))&&(s.terrain===undefined||terrains.includes(s.terrain))
  // A long tale: its chapters, the one under way, and its leads.
  &&validChapters(s)&&validLeads(s)
  // An Easy to get into tale: the errand the hero accepted before it began.
  &&(s.errand===undefined||validErrand(s.errand));
}
// ---------- The errand (Easy to get into) ----------
// The hero starts with orders in hand: someone with authority (keeper) has sent them to deal with one plain trouble
// close by. The errand's place is a landmark held by a creature (a lair on the map), and chapter 1 is the errand.
export function validErrand(e){
 const text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
 return !!e&&typeof e==='object'&&!Array.isArray(e)&&text(e.title,1,80)&&text(e.task,1,240)&&text(e.reward,0,160)&&/^p\d{1,2}$/.test(String(e.place));
}
// Creatures an errand may send a hero against. Below third level one of them, never a pack or the orc (the errand is
// often a new hero's first fight): a pack or orc the writer chose anyway becomes a lighter creature of its kind.
const errandSingles={zombies:'skeleton',wolves:'wolf',orc:'goblin'},errandKinds=['bandit','wolf','goblin','skeleton','boar','spider'],errandStrong=[...errandKinds,'orc','zombies','wolves'];
// The errand's place: the landmark it names, else the first risky one, else the first. Returns the places with that one
// held by the errand's creature, and the errand as the story keeps it (null when there is no errand to be had).
export function errandPlaces(written,places,hero){
 const e=written&&typeof written==='object'?written:null,line=(v,max)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max).trim():'';
 const threat=e?.threat&&typeof e.threat==='object'?e.threat:null,strong=(hero?.level??1)>=3,template=strong&&errandStrong.includes(threat?.template)?threat.template:errandSingles[threat?.template]??threat?.template;
 if(!e||!places.length||!line(e.title,80)||!line(e.task,240)||!errandStrong.includes(template)||!line(threat.name,60)||!line(threat.appearance,400))return {places,errand:null};
 const named=line(e.place,60).toLowerCase(),at=places.find(p=>p.name.trim().toLowerCase()===named)??places.find(p=>p.danger==='risky')??places[0];
 // A second creature at its side only for a hero past their first level, and never one of the same kind or a pack.
 const a=threat.ally&&typeof threat.ally==='object'?threat.ally:null,ally=a&&(hero?.level??1)>=2&&[...errandKinds,...(strong?['orc']:[])].includes(a.template)&&a.template!==template&&line(a.name,60)&&line(a.appearance,400)?{template:a.template,name:line(a.name,60),appearance:line(a.appearance,400)}:null;
 const held={...at,danger:'lair',threat:{template,name:line(threat.name,60),appearance:line(threat.appearance,400),...(ally?{ally}:{})}};
 return {places:places.map(p=>p.id===at.id?held:p),errand:{title:line(e.title,80),task:line(e.task,240),place:at.id,reward:line(e.reward,160)}};
}
// ---------- The long tale: chapters and leads ----------
// A written story may be told in chapters (the spine of the main errand, taken one at a time; `story.chapter` is the
// one under way) and carry a few leads (side errands heard of from the start, each open or seen through). Stories
// from before have neither and play exactly as they did.
export const maxChapters=6,maxLeads=4;
const sagaText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function validChapters(s){
 if(s.chapters===undefined)return s.chapter===undefined;
 return Array.isArray(s.chapters)&&s.chapters.length>=2&&s.chapters.length<=maxChapters&&s.chapters.every(c=>c&&sagaText(c.title,80)&&sagaText(c.goal,300)&&sagaText(c.turn,400))&&Number.isInteger(s.chapter)&&s.chapter>=0&&s.chapter<s.chapters.length;
}
export function validLeads(s){
 return s.leads===undefined||(Array.isArray(s.leads)&&s.leads.length>=1&&s.leads.length<=maxLeads&&new Set(s.leads.map(l=>l?.id)).size===s.leads.length&&s.leads.every(l=>l&&/^l[1-4]$/.test(l.id)&&sagaText(l.title,80)&&sagaText(l.hook,300)&&(l.done===undefined||l.done===true)));
}
// Where the tale stands: the chapter under way, the one after it, whether this is the last, and the leads.
export function questState(game){
 const s=game?.story;if(!s)return null;
 const chapters=s.chapters??[],index=s.chapter??0,leads=s.leads??[];
 return {chapters:chapters.length,number:chapters.length?index+1:0,current:chapters[index]??null,next:chapters[index+1]??null,last:!chapters.length||index>=chapters.length-1,leads,openLeads:leads.filter(l=>!l.done)};
}
// What the player is working toward right now: the chapter's goal in a long tale, else the story's objective.
export function currentGoal(game){const q=questState(game);return q?.current?.goal??game?.story?.objective??'';}
// A level can be taken after the main foe falls (as ever), or when the tale has earned one (every second chapter
// finished) and the hero is somewhere they can stop: not in a fight, not dying.
export function levelUpReady(game,hero){
 if(!game||!hero||(hero.level??1)>=20)return false;
 if(game.stage==='victory')return true;
 return (game.levelsOwed??0)>0&&['inn','bridge','tower','wild'].includes(game.stage)&&!game.npcCombat?.active&&!game.dungeon?.active&&!game.wildFight&&!game.pendingSpell;
}
// The story's foe grows with a hero who levels before meeting it; once the fight has been joined it stays as it is.
export function foeForLevel(game,level){
 const stats=game?.story?.foeStats;
 if(!stats||stats.group||game.foeFate||game.wildFight||game.enemyHP!==stats.maximum)return game;
 const grown=storyFoeStats(level,stats.type);
 return grown.maximum<=stats.maximum?game:{...game,story:{...game.story,foeStats:grown},enemyHP:grown.maximum};
}
// A written story's main foe: the climax of the tale, so sturdier than a creature met by the road, and scaled to
// the hero's level when the story begins. (Stories from before this have no stat block and keep the old, lighter one.)
export function storyFoeStats(level=1,type='Slashing'){
 const up=Math.max(0,Math.min(19,(level??1)-1));
 return {maximum:18+10*up,ac:12+Math.floor(up/4),attackBonus:3+Math.floor(up/2),die:6,count:1+Math.floor(up/5),bonus:1+Math.floor(up/3),type:damageTypes.includes(type)?type:'Slashing',saves:{Strength:1,Dexterity:2+Math.floor(up/4),Constitution:1,Intelligence:0,Wisdom:Math.floor(up/4),Charisma:0}};
}
// What the story writer may add that the game checks piece by piece: anything malformed is dropped, not refused.
function tidyStory(written){
 const {layout,landmarks,lands,chapters,leads,chapter,...s}=written,story={...s,locations:{...s.locations},npcs:{...s.npcs}};
 // Chapters and leads are kept when they are whole; a tale with fewer than two good chapters is told as one.
 const line=(v,max)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
 const told=(Array.isArray(chapters)?chapters:[]).map(c=>c&&typeof c==='object'?{title:line(c.title,80),goal:line(c.goal,300),turn:line(c.turn,400)}:null).filter(c=>c&&c.title&&c.goal&&c.turn).slice(0,maxChapters);
 if(told.length>=2){story.chapters=told;story.chapter=0;}
 const errands=(Array.isArray(leads)?leads:[]).map(l=>l&&typeof l==='object'?{title:line(l.title,80),hook:line(l.hook,300)}:null).filter(l=>l&&l.title&&l.hook).slice(0,maxLeads).map((l,i)=>({id:'l'+(i+1),...l}));
 if(errands.length)story.leads=errands;
 if(typeof story.region!=='string'||!story.region.trim()||story.region.length>60)delete story.region;else story.region=story.region.trim();
 if(!terrains.includes(story.terrain))delete story.terrain;
 if(story.foeDamageType!==undefined&&!damageTypes.includes(story.foeDamageType))delete story.foeDamageType;
 for(const id of ['inn','bridge','tower'])if(story.locations[id]){story.locations[id]={...story.locations[id]};if(!placeKinds.includes(story.locations[id].kind))delete story.locations[id].kind;}
 for(const id of ['keeper','mara'])if(story.npcs[id]){const n=story.npcs[id]={...story.npcs[id]};if(!genders.includes(n.gender))delete n.gender;if(n.regard===undefined||n.regard===null||!validRegard(n.regard)||n.regard.stance==='indifferent')delete n.regard;else n.regard={stance:n.regard.stance,reason:n.regard.reason.trim()};}
 if(!validGeography(story.geography))story.geography=makeGeography(story.id,layout);
 return {story,landmarks,lands};
}
export function storyText(game,text){
 if(!game.story)return text;
 const s=game.story;
 // The foe's end: slain, or (when the player set out to knock it out) beaten but alive.
 if(/restored the crossing|wisp settles/.test(text)){const group=s.foeStats?.group?.plural;return game.foeFate==='subdued'?(group?'The last of the '+group+' drops senseless.':'The '+s.foe+' collapses, beaten but alive.'):(group?'The last of the '+group+' falls dead.':'The '+s.foe+' is slain.');}
 if(/blue lantern/.test(text))return 'Resolve magical details from the current story and recorded discoveries.';
 // Names written for this story (and places found while exploring) are kept exactly as written: only the
 // engine's own legacy words around them are retold.
 const keep=[...Object.values(s.locations).map(l=>l.name),...Object.values(s.npcs).map(n=>n.name),...Object.values(game.people??{}).map(p=>p.name),s.foe,game.wildFight?.name,...(game.world?.places??[]).flatMap(p=>[p.name,p.threat?.name])].filter(Boolean).sort((a,b)=>b.length-a.length),held=[];
 for(const name of keep)text=text.split(name).join('\u0001'+(held.push(name)-1)+'\u0002');
 return retell(s,text).replace(/\u0001(\d+)\u0002/g,(m,i)=>held[Number(i)]);
}
function retell(s,text){
 return text.replace(/You retreat to the inn\. The bridge remains dark, but you live to try again\./g,`You retreat to ${s.locations.inn.name}. The ${s.foe} is still out there, but you live to try again.`).replace(/\bThe keeper\b|\bthe keeper\b|\bkeeper\b/g,s.npcs.keeper.name).replace(/\bMara\b/g,s.npcs.mara.name).replace(/\bLantern Wisp\b|\bthe wisp\b|\bwisp\b/gi,s.foe).replace(/Crossroads Inn|crossroads inn/gi,s.locations.inn.name).replace(/\bOld Stone Bridge\b|\bthe bridge\b|\bbridge\b/gi,s.locations.bridge.name).replace(/\bAbandoned Watchtower\b|\bthe watchtower\b|\bwatchtower\b/gi,s.locations.tower.name)
 .replace(/You collapse\. .*?This demo ends here\./g,'You fall unconscious. This encounter ends.').replace(/.*(?:restored the crossing|wisp settles|missing bridge light).*\n?/gi,'');
}
export function freshStoryGame(hero,written,base){
 if(!written||typeof written!=='object'||!written.locations||!written.npcs)throw Error('The new story was incomplete. Your current adventure is unchanged.');
 // Every story gets its own geography (from the writer's layout, or drawn from the story itself) and may mark a
 // few places on the map from the start. The people who live in its country, the errand (Easy to get into) and the
 // opening's lines are seated below, once the places are known; none of them is kept in the story as written.
 const {residents,errand:orders,openingDialogue:said,...told}=written;
 const {story,landmarks,lands}=tidyStory(told);
 if(!story.foeStats)story.foeStats=storyFoeStats(hero?.level??1,story.foeDamageType);
 if(!validStory(story))throw Error('The new story was incomplete. Your current adventure is unchanged.');
 const first=story.chapters?.[0];
 let game={...base,story,map:{visited:['inn'],accepted:true,clue:false,peaceful:false,minutes:0},enemyHP:story.foeStats.maximum,journal:{version:1,chapter:1,nextId:2,entries:[{id:1,chapter:1,kind:'quest',title:story.title,text:(story.opening+'\nGoal: '+story.objective+(first?'\nChapter 1: '+first.title+'. '+first.goal:'')).slice(0,3000)}]},log:[story.opening],worldFacts:[story.premise],
  // The story so far starts here (a hero's earlier chapters are joined on by joinRegion).
  storyLog:[{id:1,kind:'story',text:(story.title+': the tale began at '+story.locations.inn.name+'.').slice(0,160)}]};
 // Places heard of from the start, then the lands beyond this country that the tale speaks of (each its own map).
 // An errand's place is one of the landmarks, held by the creature the hero was sent to deal with.
 const marked=landmarkPlaces(story,landmarks),{places,errand}=errandPlaces(orders,marked,hero),far=farLandPlaces(story,lands,places);
 if(places.length||far.places.length)game.world={places:[...places,...far.places],at:null,...(far.regions.length?{regions:far.regions}:{})};
 if(errand){story.errand=errand;game.journal.entries[0].text=(game.journal.entries[0].text+'\nYour orders: '+errand.task+(errand.reward?' Reward: '+errand.reward:'')).slice(0,3000);}
 // The people who live here: two at the starting place, others where the tale puts them.
 const seated=seatResidents(game,residents,places);game=seated.game;
 // Opening dialogue plays as the first turn, so the people here are already talking when the player arrives: the two
 // residents and anyone seated at the starting place (`residentN` is the Nth written resident).
 const voice=id=>id==='keeper'||id==='mara'?id:Object.hasOwn(seated.ids,id)&&game.people[seated.ids[id]].home==='inn'?seated.ids[id]:null;
 const lines=(Array.isArray(said)?said:[]).map(l=>l&&typeof l==='object'&&typeof l.text==='string'&&l.text.trim()?{speakerId:voice(String(l.speakerId)),text:l.text.trim().slice(0,300)}:null).filter(l=>l?.speakerId).slice(0,4);
 if(lines.length){
  story.openingDialogue=lines;
  const nameOf=id=>story.npcs[id]?.name??game.people[id].name,here=Object.keys(game.people??{}).filter(id=>game.people[id].home==='inn');
  game.playback=[{id:1,npcId:null,participants:['keeper','mara',...here],events:[{kind:'narration',text:story.opening},...lines.map(l=>({kind:'dialogue',speakerId:l.speakerId,speakerName:nameOf(l.speakerId),text:l.text}))]}];
 }
 if(!validStory(story))throw Error('The new story was incomplete. Your current adventure is unchanged.');
 // Everyone has already formed a view of the hero's kind.
 return firstImpressions(game,hero);
}
