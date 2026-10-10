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
  setStatus({players:data.players??[],online:true,synchronized:true,error:'',role:data.role,you:data.you});
 }
 useEffect(()=>{
  if(!membership.joined||!ready)return;joined.current=true;const at=++epoch.current;let polling=false;
  const poll=async()=>{if(polling||busy.current)return;polling=true;const before=version.current,stamp=generation.current;try{const data=await campaignCall('poll',{knownVersion:before});if(!busy.current&&before===version.current)await adopt(data,at,stamp);}catch(e){if(at===epoch.current)setStatus(s=>({...s,online:false,error:e.message}));}finally{polling=false;}};
  poll();const timer=setInterval(poll,2500);return()=>{clearInterval(timer);epoch.current++;};
 },[membership.joined,membership.campaignId,ready]);
 async function join(name,host,{party=true,code='',campaignId=null}={}){
  if(busy.current)return;busy.current=true;setNotice('');
  try{const snapshot=hero&&characterChosen?adventureSnapshot(hero,game,health,characterChosen):null;
   const data=campaignId?await campaignCall('poll',{campaignId,knownVersion:-1}):await campaignCall(host?'campaign-create':'campaign-join',{snapshot,name,party,invite:code.trim()});
   setTableMembership({joined:true,name:name.trim().slice(0,40),campaignId:data.campaignId,version:data.version});joined.current=true;epoch.current++;await adopt(data);setInvite(data.invite??'');setMembership(tableMembership());
  }finally{busy.current=false;}
 }
 async function leave(){epoch.current++;joined.current=false;setTableMembership({joined:false});setMembership(tableMembership());setStatus({players:[],online:false,synchronized:false,error:''});await campaignCall('leave').catch(()=>{});}
 async function turn(question,{npcId=null,direct=false,action,oneOnOne=false,storyPreferences,autoShield=true}={}){
  if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;
  const payload={question,npcId,direct,...(action===undefined?{}:{action}),...(oneOnOne?{oneOnOne:true}:{}),...(storyPreferences?{storyPreferences}:{}),...(autoShield===false?{autoShield:false}:{}),baseVersion:version.current};
  const signature=JSON.stringify(payload);if(retry.current?.signature!==signature)retry.current={signature,id:globalThis.crypto.randomUUID()};
  try{const data=await campaignCall('campaign-turn',{...payload,requestId:retry.current.id},300000);await adopt(data,at);if(data.conflict){retry.current=null;noteProblem({kind:'table',error:'Another player acted first; the turn was not kept.'});throw Error('Another player acted first. The campaign is updated; try your action again.');}retry.current=null;return {game:data.snapshot.game,health:data.snapshot.health,turn:data.turn,narration:data.narration,suggestions:data.suggestions??[],fault:data.fault===true,deeds:data.deeds??[],xp:data.xp??null};}
  finally{busy.current=false;}
 }
 async function edit(change){if(busy.current)throw Error('Wait for the current turn.');busy.current=true;generation.current++;const at=epoch.current;try{const data=await campaignCall('campaign-edit',{...change,baseVersion:version.current});await adopt(data,at);if(data.conflict){noteProblem({kind:'table',error:'The campaign changed; an edit was not kept.'});throw Error('The campaign changed. Try that edit again.');}return data;}finally{busy.current=false;}}
 // This player's seat at the campaign (opaque; never an account id), else the device id before the first answer.
 const me=status.you??deviceId(),others=status.players.filter(p=>p.id!==me);
 return {joined:membership.joined,name:membership.name,campaignId:membership.campaignId,...status,invite,others,otherActing:others.find(p=>p.acting)?.name??null,notice,clearNotice:()=>setNotice(''),join,leave,turn,edit,setActing:useCallback(()=>{},[]),checkpoint,isCurrent,deviceId:me,
  newInvite:async()=>{const data=await campaignCall('campaign-invite');setInvite(data.invite);},listCampaigns:()=>campaignCall('campaign-list')};
}
