// Writing that takes longer than one request can wait (a long tale written with real thought takes minutes). The
// game asks for it once, is told it is under way, and asks again every few seconds until it is ready: no request
// stays open for more than a moment, so neither a phone's gateway nor the shared link's tunnel gives up on it.
// The running Dungeon Master keeps this module loaded between requests (it is not reloaded with dm-server.cjs), so
// keep it small and steady; bump `revision` when it changes and the server loads it afresh.
const revision=1;
const keep=15*60*1000,atOnce=4,held=60;
const jobIdOk=id=>typeof id==='string'&&/^[A-Za-z0-9-]{16,64}$/.test(id);
function createStoryJobs({now=Date.now}={}){
 const jobs=new Map();
 const view=job=>job.status==='ready'?{status:'ready',result:job.result}:job.status==='failed'?{status:'failed',error:job.error}:{status:'pending'};
 const sweep=()=>{const t=now();for(const [id,job] of jobs)if(t-job.at>keep)jobs.delete(id);while(jobs.size>held)jobs.delete(jobs.keys().next().value);};
 // Starts the work once per id; asking again with the same id reports on the same job.
 function start(id,run){
  if(!jobIdOk(id))return {status:'failed',error:'The story could not be started. Your adventure is unchanged; try again.'};
  sweep();
  const known=jobs.get(id);if(known)return view(known);
  if([...jobs.values()].filter(job=>job.status==='pending').length>=atOnce)return {status:'failed',error:'The story writer is busy with other tales. Try again in a minute. Your adventure is unchanged.'};
  const job={status:'pending',at:now()};jobs.set(id,job);
  Promise.resolve().then(run).then(result=>{job.status='ready';job.result=result;job.at=now();},e=>{job.status='failed';job.at=now();job.error=e?.name==='TimeoutError'?'The story took too long to write. Your adventure is unchanged; try again.':String(e?.message||'The story could not be written. Your adventure is unchanged.').slice(0,300);});
  return view(job);
 }
 // A job nobody knows (the Dungeon Master was restarted meanwhile, or it was collected long ago) says so.
 function poll(id){const job=jobIdOk(id)?jobs.get(id):null;return job?view(job):{status:'unknown'};}
 return {start,poll,size:()=>jobs.size};
}
const storyJobs=createStoryJobs();
module.exports={revision,createStoryJobs,storyJobs,jobIdOk};
