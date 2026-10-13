import React,{useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import Icon from './Icon';
import {colors,fonts,tint} from './theme';
import {playSound} from './audio';
import {setMuted,isMutedLine,useMutedMembers} from './tableMutes';
// What a player can do about another member of a shared table (asked for by the host on 2026-10-13: "add per-player
// mute or report and a host ban"): Mute (this device only, tableMutes.js), Report (to the host of the game, with a
// reason and optional words; campaigns.cjs report) and, for the table's host, Remove and ban (with a confirmation;
// they leave the table and cannot rejoin this campaign until the host lets them back). Used on the table screen
// (SharedTable.js) for every member and on the play screen for a hero tapped in the party row (PartyPanel.js).
// Chips wrap; nothing scrolls sideways.
export const reportReasons=[['harassment','Harassment'],['hateful','Hateful words'],['sexual','Sexual content'],['spam','Spam or flooding'],['cheating','Cheating'],['other','Something else']];
function Chip({label,icon,onPress,on=false,danger=false,disabled=false,accessibilityLabel}){
 return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel??label} accessibilityState={{disabled,selected:on}} disabled={disabled} dataSet={{qb:'chip'}} onPress={()=>{playSound('click');onPress();}} style={[s.chip,on&&s.chipOn,danger&&s.chipDanger,disabled&&{opacity:.5}]}>
  {!!icon&&<Icon name={icon} size={13} color={danger?tint('#f2a093'):on?colors.goldBright:colors.gold}/>}<Text numberOfLines={1} style={[s.chipText,on&&{color:colors.goldBright}]}>{label}</Text>
 </Pressable>;
}
export default function MemberActions({table,member,onClose=null}){
 const muted=useMutedMembers(table.campaignId),isMuted=muted.some(m=>m.seat===member.id);
 const [mode,setMode]=useState(null),[reason,setReason]=useState(null),[words,setWords]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const host=table.role==='owner'&&member.role!=='owner',first=String(member.name??'this player');
 const run=async(fn,done)=>{setBusy(true);setError('');try{await fn();setMessage(done);setMode(null);return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}};
 return <View dataSet={{qb:'member-actions'}} accessibilityLabel={'What to do about '+first} style={s.box}>
  <View style={s.row}>
   <Chip icon={isMuted?'sound':'mute'} label={isMuted?'Unmute':'Mute'} on={isMuted} accessibilityLabel={(isMuted?'Unmute ':'Mute ')+first} onPress={()=>{setMuted(member,!isMuted,table.campaignId);setMessage(isMuted?first+' is no longer muted on this device.':first+'’s words are hidden on this device. The game still plays their moves.');}}/>
   <Chip icon="flag" label="Report" on={mode==='report'} accessibilityLabel={'Report '+first} onPress={()=>{setMode(mode==='report'?null:'report');setMessage('');setError('');}}/>
   {host&&<Chip icon="close" danger label="Remove and ban" on={mode==='ban'} accessibilityLabel={'Remove and ban '+first} onPress={()=>{setMode(mode==='ban'?null:'ban');setMessage('');setError('');}}/>}
   {!!onClose&&<Chip icon="back" label="Done" onPress={onClose}/>}
  </View>
  {mode==='report'&&<View style={s.panel}>
   <Text style={s.lead}>Why are you reporting {first}?</Text>
   <View style={s.row}>{reportReasons.map(([id,label])=><Chip key={id} label={label} on={reason===id} onPress={()=>setReason(id)}/>)}</View>
   <TextInput dataSet={{qb:'input'}} accessibilityLabel="What happened (optional)" value={words} onChangeText={setWords} maxLength={500} multiline placeholder="What happened (optional)" placeholderTextColor={tint('#938890')} style={s.input}/>
   <Text style={s.note}>The host of the game receives your reason, your words, both your table names and the last few lines {first} typed at this table. Nothing else.</Text>
   <View style={s.row}>
    <Chip icon="send" label={busy?'Sending…':'Send report'} disabled={busy||!reason} onPress={()=>run(()=>table.report(member.id,reason,words),'Sent to the host. Thank you for telling them.').then(ok=>{if(ok){setReason(null);setWords('');}})}/>
    <Chip label="Cancel" onPress={()=>setMode(null)}/>
   </View>
  </View>}
  {mode==='ban'&&<View accessibilityRole="alert" style={[s.panel,s.warn]}>
   <Text style={s.lead}>Remove {first} from this table?</Text>
   <Text style={s.note}>Their hero leaves the party, and they cannot rejoin this campaign, even with a new invite, until you let them back from the table screen.</Text>
   <View style={s.row}>
    <Chip icon="close" danger label={busy?'Removing…':'Remove and ban'} disabled={busy} onPress={()=>run(()=>table.ban(member.id),first+' has left the table and cannot rejoin it.')}/>
    <Chip label={'Keep '+first} onPress={()=>setMode(null)}/>
   </View>
  </View>}
  {!!message&&<Text accessibilityLiveRegion="polite" style={s.note}>{message}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 </View>;
}
// A muted member's line in the feed, folded: "<Name> said something (muted). Show".
export function MutedLine({name,text,style,textStyle}){
 const [shown,setShown]=useState(false);
 return <View dataSet={{qb:'feed-muted'}} style={style}>
  <View style={s.mutedRow}><Icon name="mute" size={12} color={colors.muted}/><Text style={s.mutedText}>{(name||'Someone')+' said something (muted). '}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel={shown?'Hide it again':'Show what '+(name||'they')+' said'} onPress={()=>setShown(v=>!v)} style={s.show}><Text style={s.showText}>{shown?'Hide':'Show'}</Text></Pressable></View>
  {shown&&<Text style={textStyle}>{text}</Text>}
 </View>;
}
export {isMutedLine,useMutedMembers};
const s=StyleSheet.create({
 box:{gap:6,paddingVertical:4},
 row:{flexDirection:'row',flexWrap:'wrap',gap:6,alignItems:'center'},
 chip:{flexDirection:'row',alignItems:'center',gap:5,minHeight:34,maxWidth:'100%',paddingHorizontal:11,borderRadius:17,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(25,17,26,.8)')},
 chipOn:{borderColor:colors.goldBright,backgroundColor:tint('rgba(91,52,168,.28)')},
 chipDanger:{borderColor:tint('#c8412f'),backgroundColor:tint('rgba(90,29,23,.6)')},
 chipText:{flexShrink:1,fontFamily:fonts.ui,fontSize:13,fontWeight:'600',color:colors.text},
 panel:{gap:8,padding:10,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.25)'),backgroundColor:tint('rgba(12,8,14,.6)')},
 warn:{borderColor:tint('rgba(200,65,47,.6)')},
 lead:{fontFamily:fonts.display,fontSize:14,fontWeight:'700',letterSpacing:.5,color:colors.parchment},
 note:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:18,color:colors.muted},
 error:{fontFamily:fonts.ui,fontSize:13,lineHeight:19,color:colors.danger},
 input:{minHeight:64,fontFamily:fonts.story,fontSize:16,color:tint('#f5efe1'),backgroundColor:tint('rgba(8,5,9,.75)'),borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),borderRadius:4,padding:10,textAlignVertical:'top'},
 mutedRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6},
 mutedText:{fontFamily:fonts.ui,fontSize:13,fontStyle:'italic',color:colors.muted},
 show:{paddingHorizontal:6,minHeight:28,justifyContent:'center'},
 showText:{fontFamily:fonts.ui,fontSize:13,fontWeight:'700',color:colors.gold,textDecorationLine:'underline'},
});
