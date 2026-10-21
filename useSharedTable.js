import {useEffect,useRef,useState,useCallback} from 'react';
import {adventureSnapshot} from './adventureStorage';
import {tableMembership,setTableMembership,deviceId} from './tableClient';
import {campaignCall} from './campaignClient';
import {noteProblem} from './problemLog';
// The client sends intentions only. Account identity, dice and committed state live on the server.
export function useSharedTable({ready,hero,game,health,characterChosen,applyRemote}){
 const [membership,setMembership]=useState(tableMembership),[status,setStatus]=useState({players:[],online:false,synchronized:false,error:''}),[notice,setNotice]=useState(''),[invite,setInvite]=useState('');
 const apply=useRef(applyRemote);apply.current=applyRemote;
 const version=useRef(-1),epoch=useRef(0),generation=useRef(0),busy=useRef(false),joined=useRef(membership.joined),retry=useRef(null);
 // The live table (campaign-live.cjs): the presence this device last saw, the newest version heard of while its own turn
 // was resolving, the wait now held (so it can be let go and asked again at once) and this player's typing.
 const presence=useRef(''),heard=useRef(-1),held=useRef(null),typer=useRef({on:false,sent:0,idle:null,quiet:0});
 const checkpoint=()=>({session:epoch.current,branch:version.current});
 const isCurrent=p=>joined.current&&p?.session===epoch.current&&p?.branch===version.current;
 // After the first state this session (and outside joining), an update is applied at once, its pictures fetched meanwhile.
 async function adopt(data,at=epoch.current,stamp=generation.current,quick=version.current>=0){
  const current=()=>at===epoch.current&&stamp===generation.current;
  if(!current())return;
  if(data.snapshot)await apply.current(data.snapshot,current,{quick});
  if(!current())return;
  version.current=data.version;if(typeof data.presence==='string')presence.current=data.presence;setTableMembership({version:data.version,campaignId:data.campaignId});
  setStatus({players:data.players??[],members:data.members??data.players??[],banned:data.banned??null,online:true,synchronized:true,error:'',role:data.role,you:data.you,needsHero:data.needsHero===true,needsTale:data.needsTale===true});
 }
 // Removed by the table's host (campaigns.cjs ban): this device leaves the table calmly and says why; its own saved
 // adventure from before it joined can be restored on the table screen as after leaving.
 const removedFrom=e=>{if(!e?.removed)return false;epoch.current++;joined.current=false;setTableMembership({joined:false});setMembership(tableMembership());setStatus({players:[],online:false,synchronized:false,error:''});setNotice(e.message);return true;};
 // A wait answered while this device's own turn or edit is resolving: who is here, typing or acting; that turn's own
 // answer brings the state (a newer version heard of is remembered, so the next wait does not ask for it again).
 function adoptPresence(data,at){
  if(at!==epoch.current||!joined.current||!data)return;
  if(Number.isInteger(data.version)&&data.version>heard.current)heard.current=data.version;if(typeof data.presence==='string')presence.current=data.presence;
  setStatus(s=>({...s,players:data.players??s.players,members:data.members??data.players??s.members,banned:data.banned??s.banned,online:true,error:''}));
 }
 // Let the held wait go and ask again at once (after this device's own turn, so the wait asks for what it has missed).
 const rewait=()=>{if(version.current<heard.current)held.current?.abort?.();};
 useEffect(()=>{
  if(!membership.joined||!ready)return;joined.current=true;const at=++epoch.current;let polling=false,timer=null,pause=null;
  const alive=()=>at===epoch.current&&joined.current;
  const poll=async()=>{if(polling||busy.current)return;polling=true;const before=version.current,stamp=generation.current;try{const data=await campaignCall('poll',{knownVersion:before});if(!busy.current&&before===version.current)await adopt(data,at,stamp);}catch(e){if(at===epoch.current&&!removedFrom(e))setStatus(s=>({...s,online:false,error:e.message}));}finally{polling=false;}};
  // Held waits (campaign-wait): the table answers the moment something changes (a turn kept, an edit, someone arriving,
  // leaving, typing or acting), else after about 25 s; the device asks again at once. A server without the route (an
  // older build) answers 404, and the device polls every 2.5 s as before.
  const listen=async()=>{
   let rest=0;
   while(alive()){
    if(rest){await new Promise(done=>{pause=setTimeout(done,rest);});rest=0;if(!alive())break;}
    const before=version.current,stamp=generation.current,started=Date.now(),known=busy.current?Math.max(before,heard.current):before;
    const stop=typeof AbortController==='function'?new AbortController():null;held.current=stop;
    try{
     const data=await campaignCall('campaign-wait',{knownVersion:known,knownPresence:presence.current},40000,stop?.signal);
     if(!alive())break;
     if(!busy.current&&before===version.current&&stamp===generation.current)await adopt(data,at,stamp);else adoptPresence(data,at);
     rest=Date.now()-started<250?250:0;
    }catch(e){
     if(!alive())break;if(stop?.signal.aborted)continue;if(removedFrom(e))break;
     if(e.status===404||e.status===405){poll();timer=setInterval(poll,2500);break;}
     setStatus(s=>({...s,online:false,error:e.message}));rest=e.status===429?Math.min(30000,Math.max(1,e.retryAfter||5)*1000):3000;
    }finally{if(held.current===stop)held.current=null;}
   }
  };
  listen();
  return()=>{clearInterval(timer);clearTimeout(pause);epoch.current++;held.current?.abort?.();stopTyping();};
 },[membership.joined,membership.campaignId,ready]);
 // This player typing at the table (the message box, DungeonMaster.js): the first keystroke says so, again every few
 // seconds while they keep typing; an empty box, six quiet seconds, sending or leaving says no more. Never the words.
 const sendTyping=on=>{const t=typer.current;t.on=on;t.sent=Date.now();campaignCall('campaign-typing',{typing:on}).catch(e=>{if(e.status===404||e.status===405)t.quiet=Infinity;else if(e.status===429)t.quiet=Date.now()+Math.max(5,e.retryAfter||30)*1000;});};
 // Sending a turn needs no ping of its own: the table clears typing the moment the turn begins (campaign-live.cjs locks).
 function stopTyping(tell=true){const t=typer.current;clearTimeout(t.idle);t.idle=null;if(t.on){t.on=false;if(tell&&Date.now()>=t.quiet&&joined.current)sendTyping(false);}}
 function typed(text){
  const t=typer.current;if(!joined.current||Date.now()<t.quiet)return;
  if(!String(text??'').trim())return stopTyping();
  clearTimeout(t.idle);t.idle=setTimeout(stopTyping,6000);if(!t.on||Date.now()-t.sent>4000)sendTyping(true);
 }
 // Joining (or hosting) always brings a hero (SharedTable.js: the hero the player chose for this table, as a solo
 // snapshot); taking a seat again at a campaign this device already belongs to is a poll.
 async function join(name,host,{code='',campaignId=null,snapshot=null}={}){
  if(busy.current)return;busy.current=true;setNotice('');
  try{const brought=snapshot??(hero&&characterChosen?adventureSnapshot(hero,game,health,characterChosen):null);
   const data=campaignId?await campaignCall('poll',{campaignId,knownVersion:-1}):await campaignCall(host?'campaign-create':'campaign-join',{snapshot:brought,name,...(host?{}:{invite:code.trim()})});
   setTableMembership({joined:true,name:name.trim().slice(0,40),campaignId:data.campaignId,version:data.version});joined.current=true;epoch.current++;await adopt(data,epoch.current,generation.current,false);setInvite(data.invite??'');setMembership(tableMembership());
  }finally{busy.current=false;}
 }
 // A member with no hero of their own at the table (or whose hero has died) brings one to their seat.
 async function bringHero(snapshot){
  if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;
  try{const data=await campaignCall('campaign-join',{snapshot}).catch(e=>{removedFrom(e);throw e;});await adopt(data,at);return data;}finally{busy.current=false;}
 }
 // The host begins a tale for the whole table: a ready journey (its id) or a tale the host's device had written.
 async function startTale({journey=null,story=null,introId=null,replace=false}){
  if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;
  try{const data=await campaignCall('campaign-tale',{...(journey?{journey}:{story,introId}),...(replace?{replace:true}:{}),baseVersion:version.current},120000).catch(e=>{removedFrom(e);throw e;});await adopt(data,at);if(data.conflict)throw Error('The table changed meanwhile. Choose the tale again.');return data;}finally{busy.current=false;}
 }
 async function leave(){stopTyping();epoch.current++;joined.current=false;setTableMembership({joined:false});setMembership(tableMembership());setStatus({players:[],online:false,synchronized:false,error:''});await campaignCall('leave').catch(()=>{});}
 async function turn(question,{npcId=null,direct=false,action,oneOnOne=false,greet=false,storyPreferences,autoShield=true}={}){
  if(busy.current)throw Error('Wait for the current turn.');stopTyping(false);busy.current=true;generation.current++;const at=epoch.current;
  const payload={question,npcId,direct,...(action===undefined?{}:{action}),...(oneOnOne?{oneOnOne:true}:{}),...(greet?{greet:true}:{}),...(storyPreferences?{storyPreferences}:{}),...(autoShield===false?{autoShield:false}:{}),baseVersion:version.current};
  const signature=JSON.stringify(payload);if(retry.current?.signature!==signature)retry.current={signature,id:globalThis.crypto.randomUUID()};
  try{const data=await campaignCall('campaign-turn',{...payload,requestId:retry.current.id},300000).catch(e=>{removedFrom(e);throw e;});await adopt(data,at);if(data.conflict){retry.current=null;noteProblem({kind:'table',error:'Another player acted first; the turn was not kept.'});throw Error('Another player acted first. The campaign is updated; try your action again.');}retry.current=null;return {game:data.snapshot.game,health:data.snapshot.health,turn:data.turn,narration:data.narration,suggestions:data.suggestions??[],fault:data.fault===true,deeds:data.deeds??[],xp:data.xp??null};}
  finally{busy.current=false;rewait();}
 }
 async function edit(change){if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;try{const data=await campaignCall('campaign-edit',{...change,baseVersion:version.current}).catch(e=>{removedFrom(e);throw e;});await adopt(data,at);if(data.conflict){noteProblem({kind:'table',error:'The campaign changed; an edit was not kept.'});throw Error('The campaign changed. Try that edit again.');}return data;}finally{busy.current=false;rewait();}}
 // Moderation (campaigns.cjs): a report on another member goes to the host of the game; the table's host may remove a
 // member and keep them out, and let them back. Muting is this device's alone (tableMutes.js).
 async function report(seat,reason,words=''){return campaignCall('campaign-report',{seat,reason,...(words.trim()?{words:words.trim().slice(0,500)}:{})});}
 async function ban(seat){if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;try{const data=await campaignCall('campaign-ban',{seat});await adopt(data,at);return data;}finally{busy.current=false;}}
 async function unban(ref){const data=await campaignCall('campaign-unban',{ref});setStatus(s=>({...s,banned:data.banned??s.banned}));return data;}
 // This player's seat at the campaign (opaque; never an account id), else the device id before the first answer.
 const me=status.you??deviceId(),others=status.players.filter(p=>p.id!==me);
 // Who else is typing (never one already acting): their seat and table name.
 const typers=others.filter(p=>p.typing&&!p.acting).map(p=>({id:p.id,name:p.name}));
 return {joined:membership.joined,name:membership.name,campaignId:membership.campaignId,...status,invite,others,otherActing:others.find(p=>p.acting)?.name??null,typers,typed,notice,clearNotice:()=>setNotice(''),join,leave,turn,edit,report,ban,unban,bringHero,startTale,members:status.members??status.players,setActing:useCallback(()=>{},[]),checkpoint,isCurrent,deviceId:me,
  newInvite:async()=>{const data=await campaignCall('campaign-invite');setInvite(data.invite);},listCampaigns:()=>campaignCall('campaign-list')};
}
