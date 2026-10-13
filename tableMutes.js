// Muting another player at a shared table (asked for by the host on 2026-10-13: "add per-player mute or report"):
// on this device only, per campaign, a muted member's typed lines in the feed are folded away ("Ben said something
// (muted). Show"); the game still plays their moves and the Dungeon Master's telling is unchanged. Kept in this
// browser under the player's profile (questbound.mutes.v1: {campaignId: [{seat, name}]}), never sent anywhere.
// A line is matched by the member's seat (speakerSeat, playbackRules.js recordedTurn); lines from before seats were
// recorded, by their table name.
import {useEffect,useState} from 'react';
import {profileKey} from './playerStorage';
import {tableMembership} from './tableClient';
const KEY='questbound.mutes.v1',listeners=new Set();
const readAll=()=>{try{const v=JSON.parse(globalThis.localStorage?.getItem(profileKey(KEY))??'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}};
export function mutedMembers(campaignId=tableMembership().campaignId){
 const list=campaignId?readAll()[campaignId]:null;
 return Array.isArray(list)?list.filter(m=>m&&typeof m.seat==='string'&&typeof m.name==='string'):[];
}
export function setMuted(member,on,campaignId=tableMembership().campaignId){
 if(!campaignId||!member?.id)return;
 const all=readAll(),list=mutedMembers(campaignId).filter(m=>m.seat!==member.id);
 if(on)list.push({seat:member.id,name:String(member.name??'').slice(0,40)});
 if(list.length)all[campaignId]=list.slice(-12);else delete all[campaignId];
 // At most twenty campaigns remembered; the oldest go first.
 const keys=Object.keys(all);for(const k of keys.slice(0,Math.max(0,keys.length-20)))delete all[k];
 try{globalThis.localStorage?.setItem(profileKey(KEY),JSON.stringify(all));}catch{}
 for(const fn of listeners)try{fn();}catch{}
}
export function isMutedLine(event,list){
 if(event?.kind!=='player'||!list?.length)return false;
 return list.some(m=>event.speakerSeat?m.seat===event.speakerSeat:!!event.speakerName&&m.name===event.speakerName);
}
// The muted members of the table this device sits at, kept current when any screen changes them.
export function useMutedMembers(campaignId=tableMembership().campaignId){
 const [,bump]=useState(0);
 useEffect(()=>{const fn=()=>bump(n=>n+1);listeners.add(fn);return()=>{listeners.delete(fn);};},[]);
 return mutedMembers(campaignId);
}
