// Tales written ahead, so a new adventure starts at once. A full tale takes the story writer minutes at the effort the
// host chose (and the host wants it written with that care), so the Dungeon Master keeps a few finished ones in stock:
// two for Let fate decide and one for each written opening, written in the background one at a time, before anyone
// has chosen them and so without knowing the hero (adventure-generator.cjs `ahead`). Asking for a tale with one of
// those openings takes the oldest stocked tale and starts writing its replacement; the next tale in a region and the
// player's own idea are always written fresh. Stocked tales are kept on disk (.questbound-tales/, under QUESTBOUND_DATA
// when hosted), so a restart keeps them.
// The running Dungeon Master keeps this module loaded between requests (it is not reloaded with dm-server.cjs);
// bump `revision` when it changes and the server loads it afresh.
// Each stocked tale's file name carries the generation of the story writer that wrote it (`<opening>-g3-<uuid>.json`):
// tales from an earlier generation (written before tales had residents, errands and varied openings) are never served
// and are cleared away once when the pantry is made.
const revision=3,generation=3;
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const stockFor=id=>id==='surprise'||id==='easy'?2:1,failurePause=10*60*1000;
function createPantry({dir=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-tales'),now=Date.now}={}){
 let filling=null,lastFailure=-Infinity;
 const current=new RegExp('^[a-z]+-g'+generation+'-[0-9a-f-]{36}\\.json$');
 try{for(const f of fs.readdirSync(dir))if(/^[a-z]+-(?:g\d+-)?[0-9a-f-]{36}\.json$/.test(f)&&!current.test(f))fs.rmSync(path.join(dir,f),{force:true});}catch{}
 const files=()=>{try{return fs.readdirSync(dir).filter(f=>current.test(f));}catch{return [];}};
 const count=id=>files().filter(f=>f.startsWith(id+'-')).length;
 // The oldest stocked tale for this opening, removed from the stock; null when there is none.
 function take(id){
  if(!/^[a-z]+$/.test(String(id)))return null;
  const mine=files().filter(f=>f.startsWith(id+'-')).map(f=>{let t=0;try{t=fs.statSync(path.join(dir,f)).mtimeMs;}catch{}return {f,t};}).sort((a,b)=>a.t-b.t);
  for(const {f} of mine){
   const file=path.join(dir,f);let tale=null;
   try{tale=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
   try{fs.rmSync(file,{force:true});}catch{}
   if(tale?.story&&typeof tale.story==='object')return tale.story;
  }
  return null;
 }
 const wanted=openings=>openings.filter(id=>/^[a-z]+$/.test(id)&&count(id)<stockFor(id));
 // Starts writing one missing tale (the first opening short of stock), unless one is being written already or a
 // write failed in the last ten minutes. `write(id)` resolves to {story}. When it is done, `then` (the host's own
 // writer) goes on to the next missing tale, until the stock is full.
 function topUp(openings,write,then=null){
  if(filling||now()-lastFailure<failurePause)return false;
  const next=wanted(openings)[0];if(!next)return false;
  filling=Promise.resolve().then(()=>write(next)).then(result=>{
   if(!result?.story||typeof result.story!=='object')throw Error('no story');
   fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,next+'-g'+generation+'-'+crypto.randomUUID()+'.json');
   fs.writeFileSync(file+'.tmp',JSON.stringify({at:new Date(now()).toISOString(),introId:next,story:result.story}));fs.renameSync(file+'.tmp',file);
  }).then(()=>true,()=>{lastFailure=now();return false;}).then(ok=>{filling=null;if(ok&&then)topUp(openings,then,then);});
  return true;
 }
 // Resolves once nothing is being written (a chain of tales included).
 const settled=async()=>{while(filling)await filling;};
 return {take,topUp,count,wanted,busy:()=>!!filling,settled};
}
const pantry=createPantry();
module.exports={revision,generation,createPantry,pantry,stockFor};
