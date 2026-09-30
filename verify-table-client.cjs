const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const create=vm.runInNewContext(fs.readFileSync('sharedTableSync.js','utf8').replace(/export /g,'')+'\ncreateSharedTableSync');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const snap=turn=>({version:1,character:'hero',game:{turn},health:null,chosen:true});
function fixture(){
 let state={version:1,snapshot:snap('original'),players:[]},pollGate=null,saveGate=null,applyError=null,failSave=null,inside=0,maxInside=0;
 const calls=[],applied=[],versions=[],notices=[],status=[];
 const sync=create({
  pollTable:async known=>{calls.push({kind:'poll',known});inside++;maxInside=Math.max(maxInside,inside);try{if(pollGate){const gate=pollGate;pollGate=null;await gate.promise;}return {...state,...(known===state.version?{snapshot:undefined}:{})};}finally{inside--; }},
  saveTable:async(snapshot,baseVersion,force)=>{calls.push({kind:'save',snapshot,baseVersion,force});inside++;maxInside=Math.max(maxInside,inside);try{if(saveGate){const gate=saveGate;saveGate=null;await gate.promise;}if(failSave==='before'){failSave=null;throw Error('Disconnected');}if(!force&&baseVersion!==state.version)return {...state,conflict:true};state={...state,version:state.version+1,snapshot};if(failSave==='after'){failSave=null;throw Error('Receipt lost');}return {...state,snapshot:undefined};}finally{inside--; }},
  applyRemote:async snapshot=>{if(applyError)throw applyError;applied.push(snapshot);},
  onStatus:s=>status.push(s),onVersion:v=>versions.push(v),onConflict:()=>notices.push('conflict'),leaveTable:async()=>calls.push({kind:'leave'}),
 });
 return {sync,calls,applied,versions,notices,status,get state(){return state;},get maxInside(){return maxInside;},remote:turn=>{state={...state,version:state.version+1,snapshot:snap(turn)};},empty:()=>{state={...state,version:0,snapshot:null};},delayPoll:()=>pollGate=deferred(),delaySave:()=>saveGate=deferred(),badApply:value=>applyError=value,fail:value=>failSave=value};
}
(async()=>{
 // Original regression: a stale autosave queued behind a slow poll must never
 // acquire the incoming version number and overwrite the newer remote turn.
 let f=fixture();await f.sync.start(1);const oldPoint=f.sync.checkpoint();
 const gate=f.delayPoll(),poll=f.sync.poll();await settle();
 const oldSave=f.sync.submit(snap('stale local'),oldPoint);f.remote('new remote');gate.resolve();await Promise.all([poll,oldSave]);
 assert.equal(f.state.snapshot.game.turn,'new remote');assert.equal(f.calls.filter(c=>c.kind==='save').length,0);assert.ok(f.notices.length);
 await f.sync.submit(snap('late scene preparation'),oldPoint);assert.equal(f.state.snapshot.game.turn,'new remote');
 // Same stored version on reload still needs the full snapshot before saving.
 f=fixture();const initial=f.delayPoll(),starting=f.sync.start(1);await settle();await f.sync.submit(snap('old browser save'));initial.resolve();await starting;
 assert.equal(f.calls[0].known,-1);assert.equal(f.applied[0].game.turn,'original');assert.equal(f.calls.filter(c=>c.kind==='save').length,0);
 // Rapid local updates follow our own acknowledgements, with no concurrent I/O.
 f=fixture();await f.sync.start();const saveGate=f.delaySave(),one=f.sync.submit(snap('one'));await settle();
 const two=f.sync.submit(snap('two')),three=f.sync.submit(snap('three')),during=f.sync.poll();saveGate.resolve();await Promise.all([one,two,three,during]);
  const writes=f.calls.filter(c=>c.kind==='save');assert.equal(writes.length,2);assert.equal(writes[1].snapshot.game.turn,'three');assert.equal(writes[1].baseVersion,2);assert.equal(f.state.snapshot.game.turn,'three');assert.equal(f.maxInside,1);
 // A local undo during an in-flight save must itself be saved after that write.
 f=fixture();await f.sync.start();const undoGate=f.delaySave(),change=f.sync.submit(snap('temporary change'));await settle();const undo=f.sync.submit(snap('original'));undoGate.resolve();await Promise.all([change,undo]);assert.equal(f.state.snapshot.game.turn,'original');assert.equal(f.calls.filter(c=>c.kind==='save').length,2);
 // The server wins a genuine concurrent write; the discarded local branch stays discarded.
 f=fixture();await f.sync.start();f.remote('other player won');await f.sync.submit(snap('losing turn'));assert.equal(f.state.snapshot.game.turn,'other player won');assert.equal(f.applied.at(-1).game.turn,'other player won');assert.equal(f.notices.length,1);
 // Leaving invalidates queued work and ignores an old poll response.
 f=fixture();await f.sync.start();const leaveGate=f.delayPoll(),oldPoll=f.sync.poll();await settle();const queued=f.sync.submit(snap('after leave')),left=f.sync.leave();f.remote('while leaving');leaveGate.resolve();await Promise.all([oldPoll,queued,left]);
 assert.equal(f.applied.length,1);assert.equal(f.calls.filter(c=>c.kind==='save').length,0);assert.equal(f.calls.at(-1).kind,'leave');
 // Unmount/stop also cancels responses, and rejoining starts a new session.
 f=fixture();const stopGate=f.delayPoll(),oldStart=f.sync.start();await settle();f.sync.stop();stopGate.resolve();await oldStart;assert.equal(f.applied.length,0);await f.sync.start();assert.equal(f.applied.length,1);
 // Invalid remote saves do not advance the version or publish our old state.
 f=fixture();await f.sync.start();f.badApply(Error('Invalid saved adventure'));f.remote('invalid');await assert.rejects(f.sync.poll(),/Invalid/);await f.sync.submit(snap('must not replace invalid'));assert.equal(f.versions.at(-1),1);assert.equal(f.calls.filter(c=>c.kind==='save').length,0);f.badApply(null);await f.sync.poll();assert.equal(f.versions.at(-1),2);
 // Failed writes retry after polling; a lost success receipt never duplicates a turn.
 f=fixture();await f.sync.start();f.fail('before');await assert.rejects(f.sync.submit(snap('retry me')),/Disconnected/);await f.sync.poll();await settle();assert.equal(f.state.snapshot.game.turn,'retry me');assert.equal(f.state.version,2);
 f=fixture();await f.sync.start();f.fail('after');await assert.rejects(f.sync.submit(snap('already saved')),/Receipt/);await f.sync.poll();await settle();assert.equal(f.state.version,2);assert.equal(f.calls.filter(c=>c.kind==='save').length,1);assert.equal(f.applied.at(-1).game.turn,'already saved');
 // Two devices discovering an empty table must not force-replace each other.
 f=fixture();f.empty();const joinGate=f.delaySave(),joining=f.sync.join(snap('my adventure'));await settle();f.remote('first host');joinGate.resolve();assert.equal(await joining,true);assert.equal(f.calls.find(c=>c.kind==='save').force,false);assert.equal(f.state.snapshot.game.turn,'first host');assert.equal(f.applied.at(-1).game.turn,'first host');
 f=fixture();await f.sync.join(snap('explicit replacement'),true);assert.equal(f.calls.find(c=>c.kind==='save').force,true);assert.equal(f.state.snapshot.game.turn,'explicit replacement');
 console.log('Passed: slow-poll stale-save regression, delayed actions, reload reconciliation, ordered/coalesced writes, real conflicts, leave/unmount cancellation, rejoin, invalid saves, offline retry, lost receipts and competing first hosts.');
})().catch(error=>{console.error(error);process.exitCode=1;});
