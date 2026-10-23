// Ready journeys on the New Adventure screen (tale-library.cjs on the Dungeon Master): the journeys on offer, with
// their pitches, and which of them this device has already played. A device never offers a journey it has played
// (remembered per account profile, and any tale whose title is among the hero's earlier tales), so a player who
// comes back always finds journeys new to them. Pure helpers first; the storage and the request below.
import {findDmEndpoint,askDm} from './dmConnection';
import storage from './playerStorage';
import {cleanWritten,cleanTaleRecords,nextTaleRecord} from './shelfRules';
export const journeyKey='questbound.journeys.v1';
const journeyId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const journeyText=(v,max)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
const journeyLands=['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'];
// What the Dungeon Master sent, kept to what the cards can show; anything malformed is left out.
export function cleanJourneys(list){
 if(!Array.isArray(list))return [];
 const seen=new Set();
 return list.slice(0,24).map(j=>{
  if(!j||typeof j!=='object'||!journeyId.test(String(j.id))||seen.has(j.id))return null;seen.add(j.id);
  const out={id:j.id,title:journeyText(j.title,100),hook:journeyText(j.hook,140),blurb:journeyText(j.blurb,420),mood:journeyText(j.mood,40),special:journeyText(j.special,160),chapters:Number.isInteger(j.chapters)&&j.chapters>=1&&j.chapters<=6?j.chapters:1,region:journeyText(j.region,60)||null,terrain:journeyLands.includes(j.terrain)?j.terrain:null};
  const c=j.cover;if(c&&typeof c==='object'&&c.kind==='landscape'&&typeof c.campaignId==='string'&&c.campaignId==='journey-'+j.id&&typeof c.id==='string'&&typeof c.name==='string'&&typeof c.description==='string'&&typeof c.setting==='string')out.cover={campaignId:c.campaignId,kind:'landscape',id:c.id.slice(0,100),name:c.name.slice(0,100),description:c.description.slice(0,1800),setting:c.setting.slice(0,800)};
  return out.title&&out.hook?out:null;
 }).filter(Boolean);
}
// The journeys this device may be offered: none it has played, and none whose title the hero has already lived.
export function journeysToOffer(list,{played=[],titles=[]}={}){
 const done=new Set(played),lived=new Set(titles.filter(t=>typeof t==='string').map(t=>t.trim().toLowerCase()));
 return (Array.isArray(list)?list:[]).filter(j=>!done.has(j.id)&&!lived.has(j.title.trim().toLowerCase()));
}
// Let fate decide, with journeys on offer: one of them, by chance.
export const fateJourney=(list,random=Math.random)=>Array.isArray(list)&&list.length?list[Math.floor(random()*list.length)%list.length]:null;
// The journeys this device has played (the last 200), per account profile (playerStorage.js, asynchronous).
// The same key keeps the device's record of each written tale (shelfRules.js cleanTaleRecord) as `tales`, beside
// `played`; an older build wrote only `played` and keeps reading it.
async function journeyStore(store){try{const v=JSON.parse(await store.getItem(journeyKey)??'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}}
export async function playedJourneys(store=storage){
 try{const v=JSON.parse(await store.getItem(journeyKey)??'{}');return Array.isArray(v?.played)?v.played.filter(id=>journeyId.test(String(id))).slice(-200):[];}catch{return [];}
}
export async function rememberJourney(id,store=storage){
 if(!journeyId.test(String(id)))return;
 try{const v=await journeyStore(store),played=(await playedJourneys(store)).filter(x=>x!==id),tales=cleanTaleRecords(v.tales);await store.setItem(journeyKey,JSON.stringify({played:[...played,id].slice(-200),...(Object.keys(tales).length?{tales}:{})}));}catch{}
}
// Every tale this device has begun, for a tale asked for beside a land (the compendium and the shelf match one it has not
// played): the journeys played and the written tales it has a record of, the most recent 200.
export async function playedTales(store=storage){
 const [played,tales]=await Promise.all([playedJourneys(store),taleRecords(store)]);
 return [...new Set([...Object.entries(tales).sort((a,b)=>a[1].at-b[1].at).map(([id])=>id),...played])].slice(-200);
}
// The device's records of written tales (the last 200), by tale id.
export async function taleRecords(store=storage){return cleanTaleRecords((await journeyStore(store)).tales);}
// Keeps the record after a turn of a written tale; returns the records when one changed, else null.
export async function noteTaleRecord(game,hero,{seconds=null,store=storage}={}){
 try{
  const id=game?.story?.libraryId,v=await journeyStore(store),tales=cleanTaleRecords(v.tales),next=nextTaleRecord(tales[id],game,hero,{seconds});
  if(!next)return null;
  const all=cleanTaleRecords({...tales,[id]:next}),played=Array.isArray(v.played)?v.played.filter(x=>journeyId.test(String(x))).slice(-200):[];
  await store.setItem(journeyKey,JSON.stringify({played,tales:all}));return all;
 }catch{return null;}
}
// The tab of the shelf this device used last (per device, guarded: storage that refuses just means the first tab).
export const shelfKey='questbound.shelf.v1';
export function savedShelfTab(){try{const v=JSON.parse(globalThis.localStorage?.getItem(shelfKey)??'{}');return typeof v?.tab==='string'?v.tab:null;}catch{return null;}}
export function saveShelfTab(tab){try{globalThis.localStorage?.setItem(shelfKey,JSON.stringify({tab}));}catch{}}
// "A tale waits in <Land>" answered Not now (sequelRules.js taleWaitsKey: the tale and the land), per device, the last
// 100, guarded: storage that refuses just means the card may show again.
export const landTalesKey='questbound.landtales.v1';
export function dismissedLandTales(){try{const v=JSON.parse(globalThis.localStorage?.getItem(landTalesKey)??'{}');return Array.isArray(v?.not)?v.not.filter(k=>typeof k==='string').slice(-100):[];}catch{return [];}}
export function dismissLandTale(key){const not=[...dismissedLandTales().filter(k=>k!==key),String(key).slice(0,200)].slice(-100);try{globalThis.localStorage?.setItem(landTalesKey,JSON.stringify({not}));}catch{}return not;}
// Asks the Dungeon Master what is on the shelf (a quick look, like an illustration): the written tales and the ready
// journeys. Null when it cannot say (none reachable): the screen then offers the written openings as before. An older
// Dungeon Master sends only journeys, and `written` is then empty.
export async function loadShelf(){
 try{
  const endpoint=await findDmEndpoint();
  const {ok,body}=await askDm(endpoint,{input:'Which journeys are ready?',context:{mode:'art',choices:[],journeys:'list'}},{timeout:15000,wait:0});
  return ok&&Array.isArray(body?.journeys)?{journeys:cleanJourneys(body.journeys),written:cleanWritten(body.written)}:null;
 }catch{return null;}
}
export async function loadJourneys(){const shelf=await loadShelf();return shelf?shelf.journeys:null;}
