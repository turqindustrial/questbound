// Shared table: one adventure that several browsers on this PC's network can play together.
// Loopback only. Desktop browsers call it directly; phones reach it through the paired phone gateway.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createAccounts}=require('./accounts.cjs');
const allowedOrigins=new Set(['http://localhost:8081','http://localhost:8082']);
const PRESENCE_MS=15000,ACTING_MS=60000,MAX_BODY=2500000;
const clean=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,max):'';
// Cloud saves: a hero and adventure kept on this PC under a recovery code, so a player can carry on in another
// browser or device. Only a hash of the code is stored (it names the file); last write wins; at most 200 saves.
const cloudKey=code=>{const c=String(code??'').toUpperCase().replace(/[^A-Z0-9]/g,'');return /^[A-Z0-9]{12}$/.test(c)?require('node:crypto').createHash('sha256').update('questbound-cloud-v1:'+c).digest('hex'):null;};
function createSyncServer({dir=path.join(__dirname,'.questbound-table'),cloudDir=path.join(__dirname,'.questbound-cloud'),accountsDir=path.join(__dirname,'.questbound-accounts'),cloudLimit=200,now=Date.now}={}){
 const file=path.join(dir,'table.json');
 let table={version:0,snapshot:null,updatedAt:null,updatedBy:null};
 try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(Number.isInteger(saved.version)&&saved.version>=0)table={...table,...saved};}catch{}
 const players=new Map();
 const persist=()=>{fs.mkdirSync(dir,{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(table));fs.renameSync(tmp,file);};
 const present=()=>{const t=now();for(const [id,p] of players)if(t-p.seen>PRESENCE_MS)players.delete(id);return [...players.entries()].map(([id,p])=>({id,name:p.name,acting:!!p.actingSince&&t-p.actingSince<ACTING_MS}));};
 const state=(known=-1)=>({version:table.version,updatedAt:table.updatedAt,updatedBy:table.updatedBy,players:present(),...(table.version!==known?{snapshot:table.snapshot}:{})});
 const touch=b=>{const id=clean(b.playerId,64);if(!/^[a-z0-9-]{8,64}$/i.test(id))throw Object.assign(Error('Missing player id.'),{status:400});if(!players.has(id)&&players.size>=12)throw Object.assign(Error('The table is full.'),{status:429});const prev=players.get(id);players.set(id,{name:clean(b.name,40)||'Adventurer',seen:now(),actingSince:b.acting===true?(prev?.actingSince??now()):b.acting===false?null:prev?.actingSince??null});return id;};
 const validSnapshot=s=>!!s&&typeof s==='object'&&s.version===1&&typeof s.character==='string'&&s.character.length<200000&&!!s.game&&typeof s.game==='object'&&typeof s.chosen==='boolean';
 // Player accounts (accounts.cjs): an email and password that keep a hero and adventure here for any device.
 const accounts=createAccounts({dir:accountsDir,now,validSnapshot});
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin,send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(data));};
  if(origin&&!allowedOrigins.has(origin))return send(403,{error:'Origin not allowed.'});
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'http://localhost:8081','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});return res.end();}
  try{
   if(req.url==='/health'&&req.method==='GET')return send(200,{ready:true,table:true});
   if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))return send(404,{error:'Not found.'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>MAX_BODY)return send(413,{error:'This adventure is too large to share.'});}
   let b;try{b=JSON.parse(raw);}catch{return send(400,{error:'Invalid request.'});}
   if(req.url==='/poll'){const id=touch(b);return send(200,{...state(Number.isInteger(b.knownVersion)?b.knownVersion:-1),you:id});}
   if(req.url==='/save'){
    const id=touch(b);if(!validSnapshot(b.snapshot))return send(400,{error:'That adventure could not be shared.'});
    if(b.force!==true&&b.baseVersion!==table.version)return send(409,{conflict:true,...state(-1)});
    table={version:table.version+1,snapshot:b.snapshot,updatedAt:new Date(now()).toISOString(),updatedBy:players.get(id).name};persist();
    return send(200,state(table.version));
   }
   if(req.url==='/leave'){players.delete(clean(b.playerId,64));return send(200,{left:true});}
    if(req.url==='/cloud-save'){
     const key=cloudKey(b.code);if(!key)return send(400,{error:'That recovery code is not valid.'});if(!validSnapshot(b.snapshot))return send(400,{error:'That adventure could not be saved.'});
     fs.mkdirSync(cloudDir,{recursive:true});const savedAt=new Date(now()).toISOString(),file=path.join(cloudDir,key+'.json'),tmp=file+'.tmp';
     fs.writeFileSync(tmp,JSON.stringify({savedAt,snapshot:b.snapshot}));fs.renameSync(tmp,file);
     const all=fs.readdirSync(cloudDir).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).map(f=>({f,t:fs.statSync(path.join(cloudDir,f)).mtimeMs})).sort((a,b)=>b.t-a.t);
     for(const old of all.slice(cloudLimit))fs.rmSync(path.join(cloudDir,old.f),{force:true});
     return send(200,{saved:true,savedAt});
    }
    if(req.url==='/cloud-load'){
     const key=cloudKey(b.code);if(!key)return send(400,{error:'That recovery code is not valid.'});
     let saved;try{saved=JSON.parse(fs.readFileSync(path.join(cloudDir,key+'.json'),'utf8'));}catch{return send(404,{error:'No saved adventure was found for that code on this PC.'});}
     return send(200,saved);
    }
   if(req.url.startsWith('/account-')){
    // Who is asking, for counting wrong passwords: the phone gateway names the visitor; this PC's own browser is itself.
    const client=clean(req.headers['x-questbound-client'],80)||'this-pc',route=req.url.slice(9);
    if(route==='register')return send(200,await accounts.register(b.email,b.password,client));
    if(route==='login')return send(200,await accounts.login(b.email,b.password,client));
    if(route==='save')return send(200,await accounts.save(b.token,b.snapshot));
    if(route==='load')return send(200,await accounts.load(b.token));
    if(route==='status')return send(200,await accounts.status(b.token));
    if(route==='logout')return send(200,await accounts.logout(b.token));
    if(route==='password')return send(200,await accounts.changePassword(b.token,b.password,b.newPassword,client));
    if(route==='delete')return send(200,await accounts.remove(b.token,b.password,client));
   }
   return send(404,{error:'Not found.'});
  }catch(e){send(e.status??500,{error:e.status?e.message:'The table service could not complete that request.'});}
 });
 server.requestTimeout=20000;server.headersTimeout=10000;
 return {server,table:()=>table,accounts};
}
if(require.main===module){
 const port=Number(process.env.QUESTBOUND_SYNC_PORT??8086);
 const {server}=createSyncServer();
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'The shared table is already running on port '+port+'.':e.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log('Questbound shared table ready on localhost:'+port+'.'));
}
module.exports={createSyncServer};
