const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {resolve,reject,promise};};
const settle=()=>new Promise(r=>setImmediate(r));
function fixture(){
 let slots=[],index=0,pendingEffects=[],timers=[],membership={joined:true,name:'Alice',campaignId:'test'},serverVersion=1,gate=null,applyGate=null,fail=false;
 const calls=[],applied=[];
 const state=()=>({campaignId:'test',version:serverVersion,role:'owner',players:[],snapshot:{game:{version:serverVersion},health:null}});
 const useRef=v=>{const i=index++;return slots[i]??(slots[i]={current:v});};
 const useState=v=>{const i=index++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return [slots[i],n=>slots[i]=typeof n==='function'?n(slots[i]):n];};
 const useEffect=(fn,deps)=>{const i=index++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j])){slots[i]?.cleanup?.();slots[i]={deps};pendingEffects.push(()=>slots[i].cleanup=fn());}};
 const source=fs.readFileSync('useSharedTable.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
 const use=vm.runInNewContext(source+'\nuseSharedTable',{useRef,useState,useEffect,useCallback:f=>f,tableMembership:()=>membership,setTableMembership:c=>membership={...membership,...c},deviceId:()=> 'alice',crypto:require('node:crypto').webcrypto,
  setInterval:f=>{timers.push(f);return f},clearInterval:f=>timers=timers.filter(x=>x!==f),adventureSnapshot:()=>({}),
  campaignCall:async(route,body)=>{calls.push({route,body});if(route==='poll'){const s=state();if(gate){const g=gate;gate=null;await g.promise;}return s;}if(route==='campaign-turn'){if(fail){fail=false;throw Error('Lost connection');}serverVersion++;return state();}if(route==='campaign-edit'){serverVersion++;return state();}return {};}});
 const render=()=>{index=0;const value=use({ready:true,hero:{},game:{},health:null,characterChosen:true,applyRemote:async(s,current)=>{if(applyGate){const g=applyGate;applyGate=null;await g.promise;}if(current())applied.push(s.game.version);}});for(const fn of pendingEffects.splice(0))fn();return value;};
 return {render,calls,applied,poll:()=>timers[0](),delayPoll:()=>gate=deferred(),delayApply:()=>applyGate=deferred(),remote:()=>serverVersion++,failOnce:()=>fail=true};
}
(async()=>{
 let f=fixture(),table=f.render();await settle();assert.deepEqual(f.applied,[1]);
 const gate=f.delayPoll(),poll=f.poll();await settle();const turn=await table.turn('Attack');gate.resolve();await poll;
 assert.equal(turn.game.version,2);assert.deepEqual(f.applied,[1,2],'slow old polls cannot overwrite an acknowledged turn');
 assert.equal(f.calls.find(c=>c.route==='campaign-turn').body.snapshot,undefined,'no whole-state writes');
 // Even a poll already preparing its artwork is invalidated by a new action.
 f.remote();const art=f.delayApply(),preparing=f.poll();await settle();await table.turn('Look around');art.resolve();await preparing;assert.deepEqual(f.applied,[1,2,4]);
 // A disconnected retry carries the same identity and base version.
 f.failOnce();await assert.rejects(table.turn('Repeat safely'),/Lost connection/);await table.turn('Repeat safely');
 const turns=f.calls.filter(c=>c.route==='campaign-turn');assert.equal(turns.at(-1).body.requestId,turns.at(-2).body.requestId);
 const leaving=f.delayPoll(),old=f.poll();await settle();await table.leave();leaving.resolve();await old;assert.equal(f.applied.at(-1),5);
 // Account-local storage captures the owner before delayed writes.
 const values=new Map(),source=fs.readFileSync('playerStorage.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export default','const storage=').replace(/export /g,'');
 const p=vm.runInNewContext(source+'\n({storage,selectProfile,currentProfile})',{AsyncStorage:{getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k)}});
 p.selectProfile('a'.repeat(64));const own=p.storage.scope();p.selectProfile('b'.repeat(64));await own.setItem('hero','Alice');assert.equal(await p.storage.getItem('hero'),null);await p.storage.setItem('hero','Bob');p.selectProfile('a'.repeat(64));assert.equal(await p.storage.getItem('hero'),'Alice');
 console.log('Campaign client: slow polls, delayed artwork, retry identity, leave cancellation and account-local save isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
