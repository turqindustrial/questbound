import {useEffect,useRef,useState,useCallback} from 'react';
import {adventureSnapshot} from './adventureStorage';
import {tableMembership,setTableMembership,pollTable,saveTable,leaveTable,deviceId} from './tableClient';
import {createSharedTableSync} from './sharedTableSync';

export function useSharedTable({ready,hero,game,health,characterChosen,applyRemote}){
 const [membership,setMembership]=useState(tableMembership),[notice,setNotice]=useState('');
 const [status,setStatus]=useState({players:[],online:false,synchronized:false,error:''});
 const apply=useRef(applyRemote);apply.current=applyRemote;
 const controller=useRef(null);
 if(!controller.current)controller.current=createSharedTableSync({
  pollTable,saveTable,leaveTable,
  applyRemote:(snapshot,isCurrent)=>apply.current(snapshot,isCurrent),
  onStatus:change=>setStatus(previous=>({...previous,...change})),
  onVersion:version=>setTableMembership({version}),
  onConflict:()=>setNotice('Another player acted first. The table was updated and your last change was not kept.'),
 });
 const sync=controller.current;
 useEffect(()=>{
  if(!membership.joined||!ready)return;
  void sync.start(tableMembership().version).catch(()=>{});
  const timer=setInterval(()=>{void sync.poll().catch(()=>{});},2500);
  return()=>{clearInterval(timer);sync.stop();};
 },[membership.joined,ready,sync]);
 useEffect(()=>()=>sync.stop(),[sync]);
 useEffect(()=>{
  if(!membership.joined||!ready||!status.synchronized||!hero||!characterChosen)return;
  const snapshot=adventureSnapshot(hero,game,health,characterChosen),point=sync.checkpoint();
  // Capture the branch with the snapshot, not after a network wait.
  const timer=setTimeout(()=>{void sync.submit(snapshot,point).catch(()=>{});},350);
  return()=>clearTimeout(timer);
 },[membership.joined,ready,status.synchronized,hero,game,health,characterChosen,sync]);
 async function join(name,host){
  setTableMembership({name:name.trim().slice(0,40)});setNotice('');
  const snapshot=hero&&characterChosen?adventureSnapshot(hero,game,health,characterChosen):null;
  if(await sync.join(snapshot,host)){setTableMembership({joined:true});setMembership(tableMembership());}
 }
 async function leave(){
  // Cancel locally before waiting for a slow network response.
  const left=sync.leave();setTableMembership({joined:false});setMembership(tableMembership());
  setStatus({players:[],online:false,synchronized:false,error:''});await left;
 }
 const setActing=useCallback(value=>sync.setActing(value),[sync]);
 const me=deviceId(),others=status.players.filter(p=>p.id!==me);
 return {joined:membership.joined,name:membership.name,...status,others,otherActing:others.find(p=>p.acting)?.name??null,notice,clearNotice:()=>setNotice(''),join,leave,setActing,checkpoint:sync.checkpoint,isCurrent:sync.isCurrent,deviceId:me};
}