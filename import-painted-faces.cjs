// Adds every unique face painted in play to the host's people library as a face only (2026-10-22, the host's words:
// "make sure all unique faces painted are added to the library of potential faces in the game"). Run by hand:
//   node import-painted-faces.cjs [--dir D]           what would be added (and what is left out, and why); writes nothing
//   node import-painted-faces.cjs [--dir D] --write   adds them
// D is the data folder that holds .questbound-art/ and .questbound-people/ (default: QUESTBOUND_DATA, else beside
// this file). Options: --no-desktop (no copy to the Desktop folder "Questbound people"), --desktop <folder> (another
// copy folder), --list (one line per portrait), --json (the result as JSON).
// Each painted portrait (.questbound-art/<key>.json and <key>.jpg) becomes a face only in .questbound-people/faces.json
// with its picture copied as nf001.jpg, nf002.jpg… (people-library.cjs validFace): the species (one of the common
// peoples, or for an invented people the nearest common one, the invented people's name kept as `kin`; a people whose
// features none of the common peoples has, such as fur, a beak or antennae, keeps no species and is shown only to
// invented peoples with the same features), gender, age, training and class when the words say, the role and look, and
// the tale it was painted for (`from`, so nobody else in that tale is given it). The paintings themselves are never
// moved or changed, and nothing is ever deleted (here or in the Desktop copy). Left out: players' own heroes (a
// player's face should not turn up on strangers), the library's own portraits (already in it), children, ghosts, the
// dead and creatures, a woman painted before the rule that a woman's portrait has no facial hair (some of those were
// painted with beards), someone whose gender the words do not give, a picture already in the library (the same file),
// the same person painted twice (the newer painting is kept) and anything that is not a readable picture. Running it
// again adds only what is new. Nothing here calls any service.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const lib=require('./people-library.cjs');
const {famous}=require('./people-writer.cjs');
const arg=name=>{const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:null;};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const isJpeg=b=>b&&b.length>3&&b[0]===255&&b[1]===216&&b[2]===255;
const cut=(v,max)=>{const s=String(v??'').replace(/\s+/g,' ').trim();if(s.length<=max)return s;const head=s.slice(0,max),end=Math.max(head.lastIndexOf('. '),head.lastIndexOf('! '),head.lastIndexOf('? '));return end>max/2?head.slice(0,end+1):head.slice(0,max-1).replace(/\s+\S*$/,'')+'…';};
const classWord=/\b(artificer|barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|sorceress|warlock|wizard)\b/;
const reasons={library:'the library\'s own portrait (already in it)',hero:'a player\'s own hero',picture:'no readable picture',imported:'imported before',same:'the same picture as one in the library',child:'a child, a ghost, the dead or a creature',beard:'a woman painted before the no-beard rule',gender:'gender not given',twice:'the same person painted twice (the newer kept)'};
function writeAtomic(file,data){
 const temporary=file+'.'+crypto.randomBytes(4).toString('hex')+'.partial';fs.writeFileSync(temporary,data);
 for(let i=0;;i++){try{fs.renameSync(temporary,file);return;}catch(e){if(i>=5)throw e;const until=Date.now()+200;while(Date.now()<until);}}
}
// What one painted portrait would be as a face only, or {reason} when it is left out.
function faceFromRecord(record){
 const s=record?.subject??{},description=String(s.description??''),campaign=String(s.campaignId??'');
 if(campaign.startsWith(lib.peopleCampaign))return {reason:'library'};
 if(/^hero-/.test(campaign)||s.face||/^\s*The player character\b/i.test(description))return {reason:'hero'};
 if(lib.notALibraryFace(s))return {reason:'child'};
 const look=lib.lookText(description,s.role),lookLow=look.toLowerCase();
 const gender=lib.genderList.includes(s.gender)?s.gender:lib.genderOfWords(description);
 if(!gender)return {reason:'gender'};
 if(gender==='woman'&&!lib.paintedAsWoman(description))return {reason:'beard'};
 const given=lib.speciesList.includes(s.species)?s.species:s.species==='Elf'?'High Elf':null;
 let named=given??(s.species==='unknown'?null:lib.speciesOf(lookLow)??lib.speciesOf(lib.appendedSpecies(description)));
 if(named==='Elf')named=/\bwood[- ]?el/.test(lookLow)?'Wood Elf':'High Elf';
 const traits=lib.traitsOf(lookLow),kin=named?null:(typeof s.kin==='string'?lib.tidyKin(s.kin):null)??lib.kinOf(description,look);
 const species=named??lib.nearestSpecies(lookLow,traits,kin);
 const roleText=String(s.role??'').trim()||String(description.split(/\.\.\s+/).slice(1).join('. ')).split(/(?<=[.!?])\s+/).filter(x=>x.split(/\s+/).length>2).join(' ');
 const trained=lib.classList.includes(s.trained)?s.trained:(()=>{const m=classWord.exec(roleText.toLowerCase());return m?lib.classList.find(c=>c.toLowerCase()===m[1].replace('sorceress','sorcerer'))??null:null;})();
 let appearance=cut(gender==='woman'?lib.withoutFacialHair(look):look,lib.limits.appearance);
 if(appearance.length<20)appearance=cut(description.replace(/^\s*(?:A woman, with a woman's face:[^.]*\.\s*|A man\.\s*)/i,''),lib.limits.appearance);
 const name=typeof s.name==='string'&&s.name.trim()&&!famous(s.name)?s.name.trim().slice(0,100):null;
 return {face:{faceOnly:true,species,gender,age:lib.ageOf(lookLow,species?[species]:[])??'adult',class:trained,role:cut(roleText,lib.limits.role),appearance,kin:named?null:kin,traits,from:campaign.slice(0,120)||null,name,painted:typeof record.createdAt==='string'?record.createdAt.slice(0,40):null}};
}
// The whole run: what would be added and what is left out. `write` adds it.
function importFaces({dataDir,write=false,desktop=null,log=()=>{}}={}){
 const art=path.join(dataDir,'.questbound-art'),dir=path.join(dataDir,'.questbound-people'),facesFile=path.join(dir,'faces.json');
 let existing=[];try{const raw=JSON.parse(fs.readFileSync(facesFile,'utf8'));existing=Array.isArray(raw)?raw.filter(lib.validFace):[];}catch{}
 const sources=new Set(existing.map(e=>e.source)),pictures=new Set(existing.map(e=>e.sha256));
 // The library's own pictures (people and faces), by their bytes.
 try{for(const f of fs.readdirSync(dir))if(/^n[pf]\d{3,4}\.jpg$/.test(f))try{pictures.add(sha(fs.readFileSync(path.join(dir,f))));}catch{}}catch{}
 let next=existing.reduce((n,e)=>Math.max(n,Number(e.id.slice(2))),0)+1;
 const records=[];
 let files=[];try{files=fs.readdirSync(art).filter(f=>/^[0-9a-f]{64}\.json$/.test(f));}catch{}
 for(const f of files){let record;try{record=JSON.parse(fs.readFileSync(path.join(art,f),'utf8'));}catch{continue;}if(record?.subject?.kind!=='portrait')continue;records.push({key:f.slice(0,64),record});}
 // Newest first, so a person painted twice keeps the newer painting.
 records.sort((a,b)=>String(b.record.createdAt??'').localeCompare(String(a.record.createdAt??''))||a.key.localeCompare(b.key));
 // The same person: the same name, people and gender (painted again in another copy of a tale, or before and after
 // the no-beard rule); the faces imported before count.
 const personOf=(name,face)=>String(name??'').trim().toLowerCase()+'|'+(face.species??face.kin??'')+'|'+face.gender;
 const added=[],left=[],people=new Set(existing.filter(e=>e.name).map(e=>personOf(e.name,e)));
 for(const {key,record} of records){
  const s=record.subject,line={key,name:String(s.name??'').slice(0,60),campaign:String(s.campaignId??'').slice(0,40)};
  const out=faceFromRecord(record);
  if(out.reason){left.push({...line,reason:out.reason});continue;}
  if(sources.has(key)){left.push({...line,reason:'imported'});continue;}
  let bytes=null;try{bytes=fs.readFileSync(path.join(art,key+'.jpg'));}catch{}
  if(!isJpeg(bytes)||bytes.length>12_000_000){left.push({...line,reason:'picture'});continue;}
  const hash=sha(bytes);
  if(pictures.has(hash)){left.push({...line,reason:'same'});continue;}
  const who=personOf(s.name,out.face);
  if(people.has(who)){left.push({...line,reason:'twice'});continue;}
  const face={id:'nf'+String(next).padStart(3,'0'),...out.face,source:key,sha256:hash};
  if(!lib.validFace(face)){left.push({...line,reason:'picture'});continue;}
  next++;pictures.add(hash);people.add(who);added.push({face,bytes});
 }
 if(write&&added.length){
  fs.mkdirSync(dir,{recursive:true});
  for(const {face,bytes} of added){const target=path.join(dir,face.id+'.jpg');if(fs.existsSync(target))throw Error(face.id+'.jpg is already there; nothing more was written.');writeAtomic(target,bytes);}
  const all=[...existing,...added.map(a=>a.face)].sort((a,b)=>Number(a.id.slice(2))-Number(b.id.slice(2)));
  writeAtomic(facesFile,JSON.stringify(all,null,1));
  if(desktop)try{fs.mkdirSync(desktop,{recursive:true});for(const {face,bytes} of added){const target=path.join(desktop,face.id+'.jpg');if(!fs.existsSync(target))fs.writeFileSync(target,bytes);}fs.copyFileSync(facesFile,path.join(desktop,'faces.json'));log('Copied to '+desktop+'.');}catch(e){log('The Desktop copy could not be made ('+e.message+'); the library itself is written.');}
 }
 return {added:added.map(a=>a.face),left};
}
function summary({added,left},write){
 const lines=[],count=(list,key)=>list.reduce((m,x)=>{const k=key(x);m[k]=(m[k]??0)+1;return m;},{});
 lines.push((write?'Added ':'Would add ')+added.length+' face'+(added.length===1?'':'s')+' to the library'+(write?'':' (nothing written; add --write to add them)')+'.');
 if(added.length){
  const bySpecies=count(added,f=>f.species??'(no common people: '+lib.unlikeOf(f.traits).join('+')+')');
  lines.push('By people: '+Object.entries(bySpecies).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(', '));
  lines.push('By gender: '+Object.entries(count(added,f=>f.gender)).map(([k,v])=>k+' '+v).join(', ')+'. By age: '+lib.ages.map(a=>a+' '+(count(added,f=>f.age)[a]??0)).join(', ')+'.');
  lines.push('Trained: '+added.filter(f=>f.class).length+' ('+[...new Set(added.filter(f=>f.class).map(f=>f.class))].join(', ')+'); invented peoples: '+added.filter(f=>f.kin||!f.species).length+(added.some(f=>f.kin)?' ('+[...new Set(added.map(f=>f.kin).filter(Boolean))].join(', ')+')':'')+'.');
  const grid={};for(const f of added){const r=grid[f.species??'(none)']??={woman:0,man:0,other:0};r[f.gender]++;}
  lines.push('People by gender: '+Object.entries(grid).map(([k,v])=>k+' '+v.woman+'/'+v.man+'/'+v.other).join(', ')+' (women/men/other).');
 }
 const why=count(left,x=>x.reason);
 lines.push('Left out '+left.length+': '+Object.entries(why).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+' '+(reasons[k]??k)).join('; ')+'.');
 return lines.join('\n');
}
if(require.main===module){
 const positional=process.argv.slice(2).find((a,i,all)=>!a.startsWith('--')&&!['--dir','--desktop'].includes(all[i-1]));
 const dataDir=path.resolve(arg('--dir')??positional??process.env.QUESTBOUND_DATA??__dirname),write=process.argv.includes('--write');
 const desktop=process.argv.includes('--no-desktop')?null:arg('--desktop')??path.join(process.env.USERPROFILE||process.env.HOME||dataDir,'Desktop','Questbound people');
 try{
  const result=importFaces({dataDir,write,desktop:write?desktop:null,log:m=>console.log(m)});
  if(process.argv.includes('--json'))console.log(JSON.stringify({dataDir,write,...result},null,1));
  else{
   console.log('Data folder: '+dataDir);
   if(process.argv.includes('--list')){for(const f of result.added)console.log('+ '+f.id+' '+(f.species??'-')+' '+f.gender+' '+f.age+(f.class?' '+f.class:'')+(f.kin?' ('+f.kin+')':'')+(f.traits.length?' ['+f.traits.join('+')+']':'')+'  '+(f.name??'')+': '+f.appearance.slice(0,90));for(const x of result.left)console.log('- '+x.name+' ('+(reasons[x.reason]??x.reason)+')');}
   console.log(summary(result,write));
  }
 }catch(e){console.error(e.message);process.exit(1);}
}
module.exports={importFaces,faceFromRecord,summary,reasons};
