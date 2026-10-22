// The Written tales shelf on the New Adventure screen (the stories spec, sections 1.2 to 1.7; written-shelf.cjs serves
// it): pure helpers for the cards a device is sent, the tabs, the device's record of each tale (how far it got, with
// whom, which endings it found), the default choice, Let fate decide among written tales, and the completion card.
// Nothing here asks, saves or shows anything: journeyLibrary.js keeps the records, AdventureIntros.js draws the shelf
// and App.js joins them.
export const shelfTiers=['short','medium','long'];
export const shelfTierWords={
 short:{tab:'Short',badge:'SHORT',sub:'One sitting · 30 to 60 minutes · two chapters'},
 medium:{tab:'Medium',badge:'MEDIUM',sub:'An evening or two · 2 to 4 hours · three or four chapters'},
 long:{tab:'Long',badge:'LONG',sub:'A campaign · 6 hours or more · five or six chapters'}};
export const shelfDifficulties={gentle:{pips:1,word:'Gentle'},steady:{pips:2,word:'Steady'},hard:{pips:3,word:'Hard'}};
export const writtenChoice=id=>'written:'+id;
export const writtenIdOf=choice=>{const m=String(choice??'').match(/^written:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);return m?m[1]:null;};
const shelfUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const shelfText=(v,max)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
const shelfLands=['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'];
const shelfWhole=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
// What the Dungeon Master sent, kept to what a card shows; anything malformed is left out, and nothing a card does not
// show (a secret, a staging) is kept even if it were sent.
export function cleanWritten(list){
 if(!Array.isArray(list))return [];
 const seen=new Set();
 return list.slice(0,60).map(t=>{
  if(!t||typeof t!=='object'||!shelfUuid.test(String(t.id))||seen.has(t.id)||!shelfTiers.includes(t.length))return null;seen.add(t.id);
  const minutes=Array.isArray(t.minutes)&&t.minutes.length===2&&t.minutes.every(m=>shelfWhole(m,1,2000))&&t.minutes[0]<t.minutes[1]?[t.minutes[0],t.minutes[1]]:null;
  const levels=Array.isArray(t.levels)&&t.levels.length===2&&t.levels.every(l=>shelfWhole(l,1,20))&&t.levels[0]<=t.levels[1]?[t.levels[0],t.levels[1]]:[1,20];
  const out={id:t.id,slug:/^[a-z0-9-]{3,28}$/.test(String(t.slug))?t.slug:'tale',order:shelfWhole(t.order,0,9999)?t.order:9999,addedAt:/^\d{4}-\d{2}-\d{2}$/.test(String(t.addedAt))?t.addedAt:null,
   length:t.length,minutes,difficulty:shelfDifficulties[t.difficulty]?t.difficulty:'steady',party:t.party==='together'?'together':'any',levels,firstTale:t.firstTale===true,
   notes:Array.isArray(t.notes)?t.notes.map(n=>shelfText(n,20)).filter(Boolean).slice(0,3):[],
   title:shelfText(t.title,100),hook:shelfText(t.hook,140),blurb:shelfText(t.blurb,300),mood:shelfText(t.mood,40),special:shelfText(t.special,160),
   chapters:shelfWhole(t.chapters,1,6)?t.chapters:2,endings:shelfWhole(t.endings,1,4)?t.endings:1,region:shelfText(t.region,60)||null,terrain:shelfLands.includes(t.terrain)?t.terrain:null};
  const c=t.cover;if(c&&typeof c==='object'&&c.kind==='landscape'&&c.campaignId==='journey-'+t.id&&typeof c.id==='string'&&typeof c.name==='string'&&typeof c.description==='string'&&typeof c.setting==='string')out.cover={campaignId:c.campaignId,kind:'landscape',id:c.id.slice(0,100),name:c.name.slice(0,100),description:c.description.slice(0,1800),setting:c.setting.slice(0,800),...(shelfLands.includes(c.terrain)?{terrain:c.terrain}:{}),...(typeof c.placeKind==='string'?{placeKind:c.placeKind.slice(0,20)}:{})};
  return out.title&&out.hook?out:null;
 }).filter(Boolean).sort((a,b)=>(a.order-b.order)||(a.slug<b.slug?-1:1));
}
// The device's record of one tale (journeyLibrary.js keeps them, the last 200): the copy under way (its story id),
// the chapter it reached of how many, with which hero, whether that copy is finished, every ending found on this device,
// when it began (the device's play seconds, playMetrics.js) and how long the last finish took.
export function cleanTaleRecord(r){
 if(!r||typeof r!=='object')return null;
 const endings=Array.isArray(r.endings)?[...new Set(r.endings.filter(e=>typeof e==='string'&&/^[a-z][a-z0-9-]{0,23}$/.test(e)))].slice(0,4):[];
 return {slug:/^[a-z0-9-]{3,28}$/.test(String(r.slug))?r.slug:'tale',copy:typeof r.copy==='string'?r.copy.slice(0,64):null,chapter:shelfWhole(r.chapter,1,6)?r.chapter:1,of:shelfWhole(r.of,1,6)?r.of:1,
  hero:shelfText(r.hero,40)||null,done:r.done===true,finished:r.finished===true||endings.length>0,endings,at:Number.isFinite(r.at)?r.at:0,
  began:Number.isFinite(r.began)&&r.began>=0?r.began:null,took:shelfWhole(r.took,0,100000)?r.took:null};
}
export function cleanTaleRecords(v){
 const out={};if(!v||typeof v!=='object'||Array.isArray(v))return out;
 const kept=Object.entries(v).filter(([id])=>shelfUuid.test(id)).map(([id,r])=>[id,cleanTaleRecord(r)]).filter(([,r])=>r).sort((a,b)=>b[1].at-a[1].at).slice(0,200);
 for(const [id,r] of kept)out[id]=r;return out;
}
// The record after a turn of a written tale (its copy's story: story.written, libraryId), or null when nothing changed.
// A new copy of the tale begins a new run (the endings found stay); `seconds` is the device's play time now.
export function nextTaleRecord(prev,game,hero,{now=Date.now(),seconds=null}={}){
 const s=game?.story;if(!s?.written||!shelfUuid.test(String(s.libraryId)))return null;
 const was=cleanTaleRecord(prev),fresh=!was||was.copy!==s.id;
 const of=Array.isArray(s.chapters)?Math.max(1,Math.min(6,s.chapters.length)):1,chapter=Math.max(1,Math.min(of,(Number.isInteger(s.chapter)?s.chapter:0)+1));
 const done=s.status==='complete',ending=typeof game.pace?.ending==='string'?game.pace.ending:null;
 const endings=[...new Set([...(was?.endings??[]),...(done&&ending?[ending]:[])])].slice(0,4);
 const began=fresh?(Number.isFinite(seconds)?seconds:null):was.began;
 const took=done&&(fresh||!was.done)&&Number.isFinite(seconds)&&Number.isFinite(began)?Math.max(1,Math.round((seconds-began)/60)):was?.took??null;
 const next={slug:s.written.slug,copy:s.id,chapter:fresh?chapter:Math.max(chapter,was.chapter),of,hero:shelfText(hero?.name,40)||null,done,finished:(was?.finished??false)||done,endings,at:now,began,took};
 const same=was&&['slug','copy','chapter','of','hero','done','finished'].every(k=>was[k]===next[k])&&was.endings.join()===next.endings.join();
 return same?null:next;
}
// What a card says of the device's history with the tale: New, Chapter n of m with Kara (the copy under way), Left at
// chapter n of m (a copy left part-way: another tale has been begun since), Finished (k of n endings). `current` is the
// story the device holds now.
export function shelfStatus(card,record,current=null){
 const r=cleanTaleRecord(record);
 if(r&&!r.done&&r.copy){if(current&&current.id!==r.copy)return {kind:'left',text:'Left at chapter '+r.chapter+' of '+r.of};return {kind:'playing',text:'Chapter '+r.chapter+' of '+r.of+(r.hero?', with '+r.hero:'')};}
 if(r?.finished)return {kind:'finished',text:'Finished · '+Math.min(r.endings.length||1,card?.endings??4)+' of '+(card?.endings??r.endings.length)+(card?.endings===1?' ending':' endings')};
 return {kind:'new',text:'New'};
}
// "New" for fourteen days after the tale went on the shelf.
export const shelfFresh=(card,now=Date.now())=>!!card?.addedAt&&now-Date.parse(card.addedAt+'T00:00:00Z')<14*86400000&&now>=Date.parse(card.addedAt+'T00:00:00Z');
// A tab's tales in the shelf's own order, finished ones at the bottom.
export function shelfTab(cards,tier,records={}){
 const list=(Array.isArray(cards)?cards:[]).filter(c=>c.length===tier);
 const done=c=>{const r=records?.[c.id];return !!r&&r.finished&&(r.done||!r.copy);};
 return [...list.filter(c=>!done(c)),...list.filter(done)];
}
export const shelfTiersShown=cards=>shelfTiers.filter(t=>(Array.isArray(cards)?cards:[]).some(c=>c.length===t));
// The tab a device opens on: the one it used last (when it still has tales), else Short (or the first with tales).
export function shelfTabFor(cards,saved){
 const shown=shelfTiersShown(cards);return shown.includes(saved)?saved:shown[0]??'short';
}
// Which written tale is chosen when the screen opens: on a device with no tale record, the Start here tale (else the
// first Short); otherwise the first unfinished tale of the tab used last. Never an AI journey, never the newest card,
// and never one the hero cannot begin (`hero`: {titles, current}, as shelfLived reads them) while another can be.
export function shelfDefault(cards,records={},tab=null,hero=null){
 const all=Array.isArray(cards)?cards:[];if(!all.length)return null;
 const open=hero?all.filter(c=>!shelfLived(c,{...hero,records})):all,list=open.length?open:all;
 if(!records||!Object.keys(records).length){const first=list.find(c=>c.firstTale)??shelfTab(list,shelfTabFor(list,'short'))[0]??list[0];return first.id;}
 const t=shelfTabFor(list,tab),tabbed=shelfTab(list,t,records);
 return (tabbed.find(c=>!records[c.id]?.finished||records[c.id]?.copy&&!records[c.id]?.done)??tabbed[0]??list[0]).id;
}
// The hero has lived this tale (they finished it: its title among their tales and this device's record of it
// finished; or the copy under way): they cannot begin it again. A tale only tried and left part-way can be begun again.
export function shelfLived(card,{titles=[],current=null,records=null}={}){
 const t=String(card?.title??'').trim().toLowerCase();
 if(current?.libraryId===card?.id)return current?.status==='complete'?'lived':'playing';
 return titles.some(x=>typeof x==='string'&&x.trim().toLowerCase()===t)&&cleanTaleRecord(records?.[card?.id])?.finished?'lived':null;
}
// Let fate decide, with written tales: one the device has not played, from the open tab (else any tab), by chance;
// a tale the hero has lived is never chosen. Null when none fits (the screen then falls back to the journeys).
export function fateWritten(cards,{records={},tab='short',titles=[],current=null,random=Math.random}={}){
 const list=(Array.isArray(cards)?cards:[]).filter(c=>!shelfLived(c,{titles,current,records}));
 const fresh=list.filter(c=>!records?.[c.id]),pools=[fresh.filter(c=>c.length===tab),fresh,list.filter(c=>c.length===tab),list];
 const pool=pools.find(p=>p.length)??[];
 return pool.length?pool[Math.floor(random()*pool.length)%pool.length]:null;
}
// The card shown when a written tale is finished: how long it took, the ending found and how many of how many, and the
// next length to try (`nextTier`, only one the shelf has: `tiers`, when given).
export function shelfFinishCard(card,record,game,{tiers=null}={}){
 const r=cleanTaleRecord(record),tier=shelfTierWords[card?.length??game?.story?.written?.length]??shelfTierWords.short;
 const endings=card?.endings??(Array.isArray(game?.story?.staging?.endings)?game.story.staging.endings.length:null);
 const ending=game?.story?.staging?.endings?.find?.(e=>e?.id===game?.pace?.ending)?.title??null;
 const nextTier={short:'medium',medium:'long',long:null}[card?.length??game?.story?.written?.length]??null,shown=nextTier&&(!Array.isArray(tiers)||tiers.includes(nextTier))?nextTier:null,next=shown?shelfTierWords[shown].tab:null;
 const article=/^[AEIOU]/.test(tier.tab)?'an ':'a ';
 return {title:'Tale complete',line:'You finished '+article+tier.tab+' tale'+(r?.took?' in '+(r.took<120?r.took+(r.took===1?' minute':' minutes'):Math.round(r.took/6)/10+' hours'):'')+'.',
  ending:ending?'Ending found: '+String(ending).replace(/[.\s]+$/,'')+(endings&&r?.endings.length?' ('+r.endings.length+' of '+endings+')':'')+'.':null,
  next:next?'Try a '+next+' tale next?':'Try another written tale?',nextTier:shown};
}
