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
 const checkpoint=()=>({session:epoch.current,branch:version.current});
 const isCurrent=p=>joined.current&&p?.session===epoch.current&&p?.branch===version.current;
 async function adopt(data,at=epoch.current,stamp=generation.current){
  const current=()=>at===epoch.current&&stamp===generation.current;
  if(!current())return;
  if(data.snapshot)await apply.current(data.snapshot,current);
  if(!current())return;
  version.current=data.version;setTableMembership({version:data.version,campaignId:data.campaignId});
  setStatus({players:data.players??[],members:data.members??data.players??[],banned:data.banned??null,online:true,synchronized:true,error:'',role:data.role,you:data.you,needsHero:data.needsHero===true,needsTale:data.needsTale===true});
 }
 // Removed by the table's host (campaigns.cjs ban): this device leaves the table calmly and says why; its own saved
 // adventure from before it joined can be restored on the table screen as after leaving.
 const removedFrom=e=>{if(!e?.removed)return false;epoch.current++;joined.current=false;setTableMembership({joined:false});setMembership(tableMembership());setStatus({players:[],online:false,synchronized:false,error:''});setNotice(e.message);return true;};
 useEffect(()=>{
  if(!membership.joined||!ready)return;joined.current=true;const at=++epoch.current;let polling=false;
  const poll=async()=>{if(polling||busy.current)return;polling=true;const before=version.current,stamp=generation.current;try{const data=await campaignCall('poll',{knownVersion:before});if(!busy.current&&before===version.current)await adopt(data,at,stamp);}catch(e){if(at===epoch.current&&!removedFrom(e))setStatus(s=>({...s,online:false,error:e.message}));}finally{polling=false;}};
  poll();const timer=setInterval(poll,2500);return()=>{clearInterval(timer);epoch.current++;};
 },[membership.joined,membership.campaignId,ready]);
 // Joining (or hosting) always brings a hero (SharedTable.js: the hero the player chose for this table, as a solo
 // snapshot); taking a seat again at a campaign this device already belongs to is a poll.
 async function join(name,host,{code='',campaignId=null,snapshot=null}={}){
  if(busy.current)return;busy.current=true;setNotice('');
  try{const brought=snapshot??(hero&&characterChosen?adventureSnapshot(hero,game,health,characterChosen):null);
   const data=campaignId?await campaignCall('poll',{campaignId,knownVersion:-1}):await campaignCall(host?'campaign-create':'campaign-join',{snapshot:brought,name,...(host?{}:{invite:code.trim()})});
   setTableMembership({joined:true,name:name.trim().slice(0,40),campaignId:data.campaignId,version:data.version});joined.current=true;epoch.current++;await adopt(data);setInvite(data.invite??'');setMembership(tableMembership());
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
 async function leave(){epoch.current++;joined.current=false;setTableMembership({joined:false});setMembership(tableMembership());setStatus({players:[],online:false,synchronized:false,error:''});await campaignCall('leave').catch(()=>{});}
 async function turn(question,{npcId=null,direct=false,action,oneOnOne=false,greet=false,storyPreferences,autoShield=true}={}){
  if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;
  const payload={question,npcId,direct,...(action===undefined?{}:{action}),...(oneOnOne?{oneOnOne:true}:{}),...(greet?{greet:true}:{}),...(storyPreferences?{storyPreferences}:{}),...(autoShield===false?{autoShield:false}:{}),baseVersion:version.current};
  const signature=JSON.stringify(payload);if(retry.current?.signature!==signature)retry.current={signature,id:globalThis.crypto.randomUUID()};
  try{const data=await campaignCall('campaign-turn',{...payload,requestId:retry.current.id},300000).catch(e=>{removedFrom(e);throw e;});await adopt(data,at);if(data.conflict){retry.current=null;noteProblem({kind:'table',error:'Another player acted first; the turn was not kept.'});throw Error('Another player acted first. The campaign is updated; try your action again.');}retry.current=null;return {game:data.snapshot.game,health:data.snapshot.health,turn:data.turn,narration:data.narration,suggestions:data.suggestions??[],fault:data.fault===true,deeds:data.deeds??[],xp:data.xp??null};}
  finally{busy.current=false;}
 }
 async function edit(change){if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;try{const data=await campaignCall('campaign-edit',{...change,baseVersion:version.current}).catch(e=>{removedFrom(e);throw e;});await adopt(data,at);if(data.conflict){noteProblem({kind:'table',error:'The campaign changed; an edit was not kept.'});throw Error('The campaign changed. Try that edit again.');}return data;}finally{busy.current=false;}}
 // Moderation (campaigns.cjs): a report on another member goes to the host of the game; the table's host may remove a
 // member and keep them out, and let them back. Muting is this device's alone (tableMutes.js).
 async function report(seat,reason,words=''){return campaignCall('campaign-report',{seat,reason,...(words.trim()?{words:words.trim().slice(0,500)}:{})});}
 async function ban(seat){if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;try{const data=await campaignCall('campaign-ban',{seat});await adopt(data,at);return data;}finally{busy.current=false;}}
 async function unban(ref){const data=await campaignCall('campaign-unban',{ref});setStatus(s=>({...s,banned:data.banned??s.banned}));return data;}
 // This player's seat at the campaign (opaque; never an account id), else the device id before the first answer.
 const me=status.you??deviceId(),others=status.players.filter(p=>p.id!==me);
 return {joined:membership.joined,name:membership.name,campaignId:membership.campaignId,...status,invite,others,otherActing:others.find(p=>p.acting)?.name??null,notice,clearNotice:()=>setNotice(''),join,leave,turn,edit,report,ban,unban,bringHero,startTale,members:status.members??status.players,setActing:useCallback(()=>{},[]),checkpoint,isCurrent,deviceId:me,
  newInvite:async()=>{const data=await campaignCall('campaign-invite');setInvite(data.invite);},listCampaigns:()=>campaignCall('campaign-list')};
}
