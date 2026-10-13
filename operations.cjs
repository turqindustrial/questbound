const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {secretKey,seal,unseal}=require('./private-secrets.cjs');
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value),{mode:0o600});fs.renameSync(file+'.tmp',file);}
// One line in the security log (.questbound-security.jsonl): mechanical labels only, never emails, passwords, session
// cookies, prompts, codes or network addresses. alerts.cjs (the gateway and the Dungeon Master) writes it this way too.
function auditTo(dir,event,details={},now=Date.now){
 const log=path.join(dir,'.questbound-security.jsonl');
 const row={at:new Date(now()).toISOString(),event:String(event).replace(/[^a-z-]/g,'').slice(0,60)};
 for(const k of ['account','campaign','route','status'])if(details[k]!==undefined)row[k]=String(details[k]).replace(/[^a-zA-Z0-9:_-]/g,'').slice(0,100);
 fs.mkdirSync(dir,{recursive:true});if(fs.existsSync(log)&&fs.statSync(log).size>1048576){fs.rmSync(log+'.old',{force:true});fs.renameSync(log,log+'.old');}fs.appendFileSync(log,JSON.stringify(row)+'\n',{mode:0o600});
}
function createOperations({dir=process.env.QUESTBOUND_DATA||__dirname,now=Date.now,key=null}={}){
 const store=path.join(dir,'.questbound-backups'),log=path.join(dir,'.questbound-security.jsonl'),ledger=path.join(dir,'.questbound-limits.json');
 let encryption=key,counters={};
 try{counters=JSON.parse(fs.readFileSync(ledger,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Usage ledger is unreadable; refusing to reset limits.');}
 const today=()=>new Date(now()).toISOString().slice(0,10),getKey=()=>encryption??(encryption=secretKey(path.join(dir,'.questbound-backup-key.dpapi')));
 // Mechanical labels only: never emails, passwords, session cookies, prompts or codes.
 const audit=(event,details={})=>auditTo(dir,event,details,now);
 // peek: only check that one more is allowed (a turn is counted once it is accepted); spend: count it even when the
 // allowance ran out meanwhile (the work is already done).
 function consume(identity,type,max,{peek=false,spend=false}={}){
  const day=today();if(counters.day!==day)counters={day,counts:{},total:{}};
  const id=crypto.createHash('sha256').update(identity).digest('hex'),counts=counters.counts??={},total=counters.total??={};
  if(!spend&&!counts[id]&&Object.keys(counts).length>=2000)throw Object.assign(Error('Daily service capacity reached.'),{status:429});
  const bucket=counts[id]??(peek?{}:(counts[id]={}));if(!spend&&((bucket[type]??0)>=max||(total[type]??0)>=max*20)){audit('usage-denied',{account:id,route:type});throw Object.assign(Error('Daily '+type+' limit reached. Try again tomorrow.'),{status:429});}
  if(peek)return;bucket[type]=(bucket[type]??0)+1;total[type]=(total[type]??0)+1;atomic(ledger,counters);
 }
 const valid=id=>/^(account|campaign|cloud)-[a-f0-9]{32,64}$/.test(id);
 const folder=id=>{if(!valid(id))throw Error('Invalid backup identity.');return path.join(store,id);};
 function list(id){const root=folder(id);try{return fs.readdirSync(root).filter(n=>/^\d{13}-[a-f0-9]{12}\.json$/.test(n)).sort().reverse();}catch{return [];}}
 const backup={
  put(id,value){const root=folder(id);fs.mkdirSync(root,{recursive:true});const file=path.join(root,String(now())+'-'+crypto.randomBytes(6).toString('hex')+'.json');atomic(file,{v:1,data:seal(getKey(),value)});for(const old of list(id).slice(20))fs.rmSync(path.join(root,old),{force:true});},
  list,
  read(id,version){if(!list(id).includes(version))throw Error('Unknown backup version.');const record=JSON.parse(fs.readFileSync(path.join(folder(id),version),'utf8'));return unseal(getKey(),record.data);},
  remove(id){for(const version of list(id))fs.rmSync(path.join(folder(id),version),{force:true});},
  verify(){let checked=0;try{for(const id of fs.readdirSync(store).filter(valid))for(const version of list(id).slice(0,1)){const value=backup.read(id,version);if(!require('./campaigns.cjs').validSnapshot(value.snapshot))throw Error('Backup adventure validation failed.');checked++;}}catch(e){if(e.code!=='ENOENT')throw e;}return {checked};},
 };
 function status(){let events=[];try{events=fs.readFileSync(log,'utf8').trim().split('\n').slice(-100).map(l=>JSON.parse(l));}catch{}return {day:today(),usage:counters.day===today()?counters.total??{}:{},alerts:events.filter(e=>/denied|failed|invalid|alert/.test(e.event)).slice(-20),backupVersions:20,mailConfigured:require('./mailer.cjs').createMailer({dir}).configured()};}
 return {audit,consume,backup,status};
}
module.exports={createOperations,atomic,auditTo};
