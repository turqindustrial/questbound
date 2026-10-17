// Paints the host's library of ready creature pictures (creature-library.cjs; 2026-10-17, the host's words: "we should
// do the same thing for all creatures as well", as for places and people), one picture for every entry and variant of
// creature-catalogue.cjs, so meeting a creature costs nothing to paint. Run by hand on the host's PC, through the host's
// own running Dungeon Master (loopback, as the desktop game asks; the API key never leaves it):
//   node make-creature-library.cjs          paints every picture not yet in .questbound-creatures/, one at a time
//   node make-creature-library.cjs --list   says what is there, what would be copied free and what it would cost; paints nothing
// Options: --limit N (at most N paintings this run), --budget D (stop before this run spends D dollars),
// --no-desktop (no copy to the Desktop folder "Questbound creatures"). Resumable: what is in the library is skipped.
// Everything is under QUESTBOUND_DATA when that is set (a hosted game), else beside this file.
// A picture that IS one of the game's templates (the Skirmish's own creatures) is copied free from the painting the
// game already has of it (the shared template picture, or the Skirmish's own), and painted only when neither exists.
// The host funds this job: its usage is tagged (job 'creature-library', by its campaign) and never counts against the
// game's spending ceilings (spending.cjs). It stops cleanly, saying why, on an OpenAI billing, quota or access refusal,
// and after three failures in a row.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const catalogue=require('./creature-catalogue.cjs'),{libraryCampaign}=require('./creature-library.cjs');
const artKey=subject=>crypto.createHash('sha256').update(JSON.stringify(['questbound-art-v1',subject.campaignId,subject.kind,subject.id])).digest('hex');
// The two paintings the game may already have of a template's creature (world-art.cjs templateSubject, and the Skirmish).
const templateKeys=template=>[artKey({campaignId:'questbound-creatures-v1',kind:'creature',id:template}),artKey({campaignId:'hostile-encounter-'+template,kind:'creature',id:'main-foe'})];
// What the painter is asked for: the picture's own look, in the land it fits first.
const paintingSubject=p=>({campaignId:libraryCampaign,kind:'creature',id:p.id,name:p.name.replace(/ \(\d\)$/,''),description:((p.band?'A band, shown together: ':'A creature: ')+p.description).slice(0,1800),setting:('Questbound, an original fantasy world. '+(p.terrains[0]??'wild')+' country. A clear, readable view of the creature'+(p.band?'s':'')+'.').slice(0,800)});
const libraryEntry=p=>({id:p.id,entry:p.entry,kind:p.kind,family:p.family,band:p.band,terrains:p.terrains,...(p.template?{template:p.template}:{}),name:p.name,description:p.description,file:p.id+'.jpg'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]!==undefined?Number(process.argv[i+1]):fallback;};
const billing=message=>/insufficient_quota|billing|exceeded your current quota|HTTP 401|HTTP 403|rejected image-generation authorization|cannot generate images|usage limit|unavailable to this API project|not configured|Only the host/i.test(String(message));
const jpeg=bytes=>!!bytes&&bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
function writeAtomic(file,data){
 const temporary=file+'.'+crypto.randomBytes(4).toString('hex')+'.partial';fs.writeFileSync(temporary,data);
 for(let i=0;;i++){try{fs.renameSync(temporary,file);return;}catch(e){if(i>=5)throw e;const until=Date.now()+200;while(Date.now()<until);}}
}
async function main(argv=process.argv){
 const dataDir=process.env.QUESTBOUND_DATA||__dirname,dir=path.join(dataDir,'.questbound-creatures'),artDir=path.join(dataDir,'.questbound-art'),dm=process.env.QB_DM_URL||'http://127.0.0.1:8084/dm';
 const desktop=argv.includes('--no-desktop')?null:path.join(process.env.USERPROFILE||process.env.HOME||dataDir,'Desktop','Questbound creatures');
 const limit=arg('--limit',Infinity),budget=arg('--budget',Infinity),price=require('./spending.cjs').paintingPrice;
 fs.mkdirSync(dir,{recursive:true});if(desktop)fs.mkdirSync(desktop,{recursive:true});
 const has=p=>fs.existsSync(path.join(dir,p.id+'.jpg'));
 const copySource=p=>p.template?templateKeys(p.template).map(k=>path.join(artDir,k+'.jpg')).find(f=>{try{return jpeg(fs.readFileSync(f));}catch{return false;}})??null:null;
 const writeLibrary=()=>{writeAtomic(path.join(dir,'library.json'),JSON.stringify(catalogue.pictures.filter(has).map(libraryEntry),null,1));};
 const pictures=catalogue.pictures,there=pictures.filter(has),free=pictures.filter(p=>!has(p)&&copySource(p)),toPaint=pictures.filter(p=>!has(p)&&!copySource(p));
 console.log(pictures.length+' pictures in the catalogue ('+catalogue.entries.length+' kinds): '+there.length+' in the library, '+free.length+' to copy free from paintings the game has, '+toPaint.length+' to paint (about $'+(toPaint.length*price).toFixed(2)+' at $'+price.toFixed(2)+' a painting).');
 if(argv.includes('--list')){for(const p of toPaint)console.log('  to paint: '+p.id+'  '+p.name);return 0;}
 // Free first: the template pictures the game already painted.
 for(const p of free){const bytes=fs.readFileSync(copySource(p));writeAtomic(path.join(dir,p.id+'.jpg'),bytes);if(desktop)fs.writeFileSync(path.join(desktop,p.id+'.jpg'),bytes);console.log('copied '+p.id+' (free, from the game\'s own painting of the '+p.template+')');}
 writeLibrary();
 const ask=async(subject,retry)=>{
  const response=await fetch(dm,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:8081'},body:JSON.stringify({input:'Paint this creature.',context:{mode:'art',choices:[],subject,retry}}),signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(Error(data?.error||('HTTP '+response.status)),{status:response.status});
  return data;
 };
 // Then the paintings, one at a time, so players' own pictures never wait behind them.
 let painted=0,failures=0;
 for(const p of toPaint){
  if(has(p))continue;
  if(painted>=limit){console.log('Stopped at the limit of '+limit+' this run.');break;}
  if((painted+1)*price>budget){console.log('Stopped: this run has spent about $'+(painted*price).toFixed(2)+' (budget $'+budget.toFixed(2)+').');break;}
  const subject=paintingSubject(p);let done=false,lastError='';
  try{
   let reply=await ask(subject,true);const t0=Date.now();
   while(reply?.status==='pending'&&Date.now()-t0<240000){await sleep(Number(process.env.QB_POLL_MS)||4000);reply=await ask(subject,false);}
   const encoded=reply?.status==='ready'&&typeof reply.dataUrl==='string'?reply.dataUrl.replace(/^data:image\/jpeg;base64,/,''):null,bytes=encoded?Buffer.from(encoded,'base64'):null;
   if(jpeg(bytes)){
    writeAtomic(path.join(dir,p.id+'.jpg'),bytes);if(desktop)fs.writeFileSync(path.join(desktop,p.id+'.jpg'),bytes);
    writeLibrary();painted++;failures=0;done=true;
    console.log(new Date().toISOString().slice(11,19)+' painted '+p.id+' ('+pictures.filter(has).length+'/'+pictures.length+'); this run about $'+(painted*price).toFixed(2));
   }else lastError=reply?.error??('the picture was '+(reply?.status??'not answered'));
  }catch(e){lastError=e.message;}
  if(done)continue;
  if(billing(lastError)){console.log('Stopped: the painting was refused for billing, quota or access ('+String(lastError).slice(0,200)+'). Nothing is lost; run again when it is sorted.');writeLibrary();return 2;}
  failures++;console.log('Not painted: '+p.id+' ('+String(lastError).slice(0,160)+')');
  if(failures>=3){console.log('Stopped after three failures in a row. Nothing is lost; run again later.');writeLibrary();return 1;}
  await sleep(Number(process.env.QB_RETRY_MS)||10000);
 }
 writeLibrary();
 if(desktop)try{fs.copyFileSync(path.join(dir,'library.json'),path.join(desktop,'library.json'));}catch{}
 const left=pictures.filter(p=>!has(p)).length;
 console.log('Painted '+painted+' this run (about $'+(painted*price).toFixed(2)+'); '+pictures.filter(has).length+' in the library, '+left+' left to paint.');
 return 0;
}
if(require.main===module)main().then(code=>process.exit(code??0),e=>{console.error(e.message);process.exit(1);});
module.exports={main,paintingSubject,libraryEntry,templateKeys};
