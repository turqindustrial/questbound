// Free hero portraits by default (2026-10-17, the host's words: "Free hero portraits by default: offer each new hero a
// matching library face right away, with an optional 'paint my own' for 3¢"). A hero's portrait subject
// (worldArtRules.js heroArtSubject) says which face it wants:
// - `face:'np123'`: that person's ready portrait from the host's people library (people-library.cjs), free; never
//   painted (a face missing from the library is refused, and the picker offers another);
// - `face:'own'`: the hero's own painting, made earlier through Paint my own; shown from disk, never painted again;
// - `face:'default'` (every hero without a choice, heroes from before included): the hero's own painting when one was
//   made at this identity (so nobody's painted portrait changes), else the library face that fits them best, kept for
//   that hero (.questbound-art/hero-faces/), so the face never changes. Fit: the same species (an old "Elf" may be a
//   High or Wood Elf) and gender (any gender when the hero's words do not say), the hero's own class first (unless the
//   face is far from the hero's age), then look words, then a hash of the hero (repeatable). Taken, and so offered only when nothing else fits: the
//   library people of the hero's game and the other heroes' faces at the table (`avoid`), and the faces already given
//   in the tale (`tales`: people-picks of its art campaigns). A hero's face is noted in its tale's picks, so nobody
//   met there is given it.
// The answer to 'default' also lists every fitting free face (`faces`, for Another face) and says whether the hero has
// a painting of their own (`own`). Nothing here paints or records usage. world-art.cjs loads this module afresh when
// it loads: a change here raises world-art's revision and dm-server.cjs's literals together.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const revision=1;
const facePattern=/^np\d{3}$/;
const isHeroCampaign=c=>/^hero-[0-9a-z]{1,13}$/.test(String(c));
// What world-art.cjs validateSubject keeps of a hero subject beside the usual fields: only known values.
function heroSubjectFields(value){
 if(value?.kind!=='portrait'||!isHeroCampaign(value.campaignId))return {};
 const out={};
 if(['default','own'].includes(value.face)||facePattern.test(String(value.face)))out.face=value.face;
 if(Array.isArray(value.tales)){const tales=[...new Set(value.tales.filter(c=>typeof c==='string'&&c.trim().length&&c.length<=120&&!isHeroCampaign(c)))].slice(0,2);if(tales.length)out.tales=tales;}
 return out;
}
const isHeroFaceSubject=subject=>subject?.kind==='portrait'&&isHeroCampaign(subject.campaignId)&&!!subject.face;
// The subject without its face, as world-art.cjs paints or reads it.
function plainHeroSubject(subject){const {face,tales,species,gender,trained,role,avoid,related,...plain}=subject;return plain;}
const ages=['young','adult','middle-aged','old'];
// How old the hero is, from their words or the age written on the sheet ("Age 27"; years only for the short-lived).
const shortLived=new Set(['Human','Orc','Goblin','Goliath','Dragonborn','Tiefling','Half-Elf']);
function heroAge(text,species){
 const t=String(text??'').toLowerCase();
 if(/\b(?:middle[- ]aged|forties|fifties|greying|graying|grizzled)\b/.test(t))return 'middle-aged';
 if(/\b(?:elderly|aged|ancient|venerable|wizened|white[- ]haired|silver[- ]haired|old)\b/.test(t))return 'old';
 if(/\b(?:young|youthful|teenage|twenties|barely grown|lad|lass)\b/.test(t))return 'young';
 const years=/\bage (\d{1,3})\b/.exec(t);
 if(years&&species.every(s=>shortLived.has(s))){const n=Number(years[1]);return n<26?'young':n<45?'adult':n<60?'middle-aged':'old';}
 return null;
}
const stop=new Set('the and with her his their its who has have from for into over under that this they them she him are was were one two some all any not but out off very more most little small large long short player character adventurer former age face eyes hair woman man person wears wearing carries'.split(' '));
const wordsOf=t=>new Set((String(t??'').toLowerCase().match(/[a-z]{3,}/g)??[]).filter(w=>!stop.has(w)));
const overlap=(a,b)=>{if(!a.size||!b.size)return 0;let n=0;for(const w of a)if(b.has(w))n++;return n/(a.size+b.size-n);};
const preference=(seed,id)=>parseInt(crypto.createHash('sha256').update('questbound-hero-face\n'+seed+'\n'+id).digest('hex').slice(0,12),16);
// What a hero is matched on, or null when the library cannot have them (a species it holds nobody of).
function heroFaceMatch(subject,speciesList){
 const named=subject.species==='Elf'?['High Elf','Wood Elf']:speciesList.includes(subject.species)?[subject.species]:null;
 if(!named)return null;
 return {species:named,gender:['woman','man','other'].includes(subject.gender)?subject.gender:null,trained:typeof subject.trained==='string'?subject.trained:null,age:heroAge(subject.description,named),look:wordsOf(subject.description)};
}
// Every library face that fits the hero, best first: their own class first (another trained face a little ahead of
// an ordinary one), unless the face is far older or younger than the hero (a 29-year-old is not given a retired
// soldier's face), then look words, then a hash of the hero.
function rankHeroFaces(entries,match,{seed='',usable=()=>true}={}){
 const kin=entries.filter(e=>match.species.includes(e.species)&&(!match.gender||e.gender===match.gender)&&usable(e));
 const score=e=>[(match.trained&&e.class===match.trained?1.5:e.class?0.5:0)+(match.age&&e.age?2-Math.min(2,Math.abs(ages.indexOf(e.age)-ages.indexOf(match.age))):0),overlap(match.look,wordsOf(e.role+' '+e.appearance)),preference(seed,e.id)];
 const better=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]>b[i];return false;};
 return kin.map(e=>({e,s:score(e)})).sort((a,b)=>better(a.s,b.s)?-1:better(b.s,a.s)?1:0).map(x=>x.e);
}
function createHeroFaces({directory=null,people,speciesList}){
 // The face kept for each hero without a choice: {campaignId, face}, one small file a hero, the latest few hundred in memory.
 const kept=new Map();
 const file=campaignId=>path.join(directory,crypto.createHash('sha256').update('questbound-hero-face\n'+campaignId).digest('hex').slice(0,40)+'.json');
 async function keptFace(campaignId){
  if(kept.has(campaignId))return kept.get(campaignId);
  let face=null;
  if(directory)try{const saved=JSON.parse(await fs.readFile(file(campaignId),'utf8'));if(saved?.campaignId===campaignId&&facePattern.test(String(saved.face)))face=saved.face;}catch{}
  kept.set(campaignId,face);while(kept.size>500)kept.delete(kept.keys().next().value);
  return face;
 }
 async function keepFace(campaignId,face){
  kept.set(campaignId,face);if(!directory)return;
  try{await fs.mkdir(directory,{recursive:true});const target=file(campaignId),temporary=target+'.'+crypto.randomBytes(4).toString('hex')+'.partial';await fs.writeFile(temporary,JSON.stringify({campaignId,face}));await fs.rename(temporary,target);}catch{}
 }
 // The hero's face is noted in its tale (only the copy's own campaign, never a ready journey's shared one), so the
 // people met there are never given it.
 const note=async(subject,face)=>{const tale=subject.tales?.find(c=>!/^journey-/.test(c));if(tale)try{await people.notePool?.(tale,'hero:'+subject.campaignId,face);}catch{}};
 const ready=async(subject,key,face,extra={})=>{const dataUrl=await people.portrait(face);if(!dataUrl)return null;await note(subject,face);return {status:'ready',key,dataUrl,library:face,...extra};};
 // `painted(key)`: whether the hero has a painting of their own at this key; `plain()`: that painting, read as
 // world-art.cjs reads any painting.
 async function answer(subject,key,{painted,plain}){
  if(!isHeroFaceSubject(subject))return null;
  if(subject.face==='own')return await painted(key)?{...await plain(),own:true}:{status:'failed',key,error:'Your own painting is not on this computer. Choose a ready-made face or paint your portrait again.'};
  if(facePattern.test(subject.face))return await ready(subject,key,subject.face)??{status:'failed',key,error:'That face is not in the library just now. Choose another.'};
  // The default: the hero's own painting if there is one, else the face kept for them, else the best that fits.
  await people.refresh?.();
  const match=heroFaceMatch(subject,speciesList),previous=await keptFace(subject.campaignId);
  const ranked=match?rankHeroFaces(people.entries?.()??[],match,{seed:subject.campaignId,usable:e=>people.hasPortrait?.(e.id)??true}):[];
  let taken=new Set(subject.avoid??[]);try{for(const id of await people.takenIn?.(subject.tales??[])??[])taken.add(id);}catch{}
  taken.delete(previous);
  const free=ranked.filter(e=>!taken.has(e.id)),faces=(free.length?free:ranked).map(e=>e.id).slice(0,24);
  if(await painted(key))return {...await plain(),own:true,faces};
  const face=previous&&(people.hasPortrait?.(previous)??true)?previous:faces[0];
  if(!face)return {status:'failed',key,error:'No ready-made face fits this hero yet. You can paint your own.',faces:[],own:false};
  if(face!==previous)await keepFace(subject.campaignId,face);
  return await ready(subject,key,face,{faces,own:false})??{status:'failed',key,error:'That face is not in the library just now. Choose another.',faces,own:false};
 }
 return {answer};
}
module.exports={revision,createHeroFaces,heroSubjectFields,isHeroFaceSubject,plainHeroSubject,heroFaceMatch,rankHeroFaces,heroAge};
