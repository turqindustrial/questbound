// One ordered request stream per device. A snapshot can follow acknowledgements
// of our own saves, but can never be rebased onto another device's adventure.
export function createSharedTableSync({pollTable,saveTable,leaveTable,applyRemote,onStatus=()=>{},onVersion=()=>{},onConflict=()=>{}}){
 let active=false,session=0,branch=0,version=0,initialized=false,confirmed=null;
 let tail=Promise.resolve(),pending=null,writing=null,pollTicket=null,acting=false;
 const checkpoint=()=>({session,branch});
 const isCurrent=point=>active&&point?.session===session&&point?.branch===branch;
 const enqueue=work=>{const job=tail.then(work);tail=job.catch(()=>{});return job;};
 const remember=value=>{version=value;onVersion(value);};
 function activate(knownVersion=0){
  active=true;session++;branch++;version=knownVersion;initialized=false;
  confirmed=null;pending=null;pollTicket=null;acting=false;
  onStatus({online:false,synchronized:false,error:''});
 }
 const current=token=>active&&session===token;
 function failure(error,token){if(current(token))onStatus({online:false,error:error.message});}
 async function adopt(data,token,conflict=false){
  if(!current(token))return;
  const raw=JSON.stringify(data.snapshot);
  const discarded=conflict||(pending&&pending.raw!==raw);
  // Invalidate writes and in-progress actions BEFORE applying the remote state.
  branch++;pending=null;initialized=false;onStatus({synchronized:false});
  const point=checkpoint();
  await applyRemote(data.snapshot,()=>isCurrent(point));
  if(!isCurrent(point))return;
  confirmed=raw;remember(data.version);initialized=true;
  onStatus({online:true,synchronized:true,error:'',players:data.players??[]});
  if(discarded)onConflict();
 }
 function write(job){
  const token=session;
  return enqueue(async()=>{
   if(!current(token)||!initialized||pending!==job||!isCurrent(job.point))return;
   writing=job;
   try{
    // No poll/adoption can run between reading this version and receiving its
    // acknowledgement. Only successful saves on this same branch advance it.
    const data=await saveTable(job.snapshot,version);
    if(!current(token))return;
    if(data.conflict){await adopt(data,token,true);return;}
    confirmed=job.raw;remember(data.version);
    if(pending===job)pending=null;
    onStatus({online:true,error:'',players:data.players??[]});
   }catch(error){failure(error,token);throw error;}
   finally{if(writing===job)writing=null;}
  });
 }
 function submit(snapshot,point=checkpoint()){
  if(!active||!initialized)return Promise.resolve();
  const raw=JSON.stringify(snapshot);
  if(!isCurrent(point)){if(raw!==confirmed)onConflict();return Promise.resolve();}
  if(raw===confirmed&&!writing){pending=null;return Promise.resolve();}
  const job={snapshot:JSON.parse(raw),raw,point};pending=job;
  return write(job);
 }
 function poll(){
  if(!active)return Promise.resolve();
  if(pollTicket)return pollTicket.promise;
  const token=session,ticket={};pollTicket=ticket;
  ticket.promise=enqueue(async()=>{
   if(!current(token))return;
   try{
    // Reloads always download the actual table, even if a stored version matches.
    const data=await pollTable(initialized?version:-1,acting);
    if(!current(token))return;
    if(data.snapshot&&(!initialized||data.version!==version))await adopt(data,token);
    else{
     if(!initialized){branch++;confirmed=null;pending=null;remember(data.version);initialized=true;}
     onStatus({online:true,synchronized:initialized,error:'',players:data.players??[]});
    }
   }catch(error){failure(error,token);throw error;}
  }).finally(()=>{if(pollTicket===ticket)pollTicket=null;});
  // Retry failures only after checking for newer progress or a lost save receipt.
  ticket.promise.then(()=>{if(current(token)&&pending)void write(pending).catch(()=>{});},()=>{});
  return ticket.promise;
 }
 function start(knownVersion=0){if(!active)activate(knownVersion);return poll();}
 function stop(){active=false;session++;branch++;pending=null;pollTicket=null;initialized=false;acting=false;}
 async function join(snapshot,host=false){
  activate();const token=session;
  try{return await enqueue(async()=>{
   if(!current(token))return false;
   const first=await pollTable(-1,false);if(!current(token))return false;
   if(host||!first.snapshot){
    if(!snapshot)throw Error('Choose a character and start an adventure before hosting the table.');
    // Empty-table joining is conditional; only explicit replacement uses force.
    const data=await saveTable(snapshot,first.version,host);if(!current(token))return false;
    if(data.conflict)await adopt(data,token,true);
    else{confirmed=JSON.stringify(snapshot);remember(data.version);initialized=true;onStatus({online:true,synchronized:true,error:'',players:data.players??[]});}
   }else await adopt(first,token);
   return current(token);
  });}catch(error){failure(error,token);if(current(token))stop();throw error;}
 }
 function leave(){stop();return enqueue(()=>leaveTable());}
 function setActing(value){if(acting===value)return;acting=value;if(active)void poll().catch(()=>{});}
 return {start,stop,poll,submit,join,leave,setActing,checkpoint,isCurrent};
}
