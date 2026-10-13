import React,{useState,useEffect} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {GameButton,Ornament,ScreenTitle,Section,Segmented} from './ui';
import Icon from './Icon';
import {localBackup,restoreLocalBackup} from './tableClient';
import MemberActions,{useMutedMembers} from './TableMemberActions';
import {accountsNeeded} from './accountRules';
import {fonts,colors,type,tint} from './theme';
export default function SharedTable({table,hero,characterChosen,onPlay}){
 const [code,setCode]=useState(''),[campaigns,setCampaigns]=useState([]);
 useEffect(()=>{table.listCampaigns().then(r=>setCampaigns(r.campaigns)).catch(()=>{});},[table.joined]);
 const [name,setName]=useState(table.name||hero?.name||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[mode,setMode]=useState('party'),backup=localBackup();
 const run=async fn=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 // Every member, here or away; another member's row opens Mute, Report and (for the host) Remove and ban.
 const [open,setOpen]=useState(null),muted=useMutedMembers(table.campaignId),acting=new Set(table.players.filter(p=>p.acting).map(p=>p.id));
 const members=(table.members??table.players).map(m=>({...m,here:m.here??true,acting:acting.has(m.id)}));
 return <View>
  <ScreenTitle eyebrow="Multiplayer" icon="people" title="The shared table" sub="One adventure, played together from several phones and computers."/>
  <Text style={s.copy}>{accountsNeeded()?'Verified members':'Members'} see the same committed story. The server applies actions and rolls dice; while one player is taking a turn, the others wait. In a party each player brings their own hero: up to four travel together, the foe can strike any of them, and a fallen friend can be revived with a draught. The same table also lets you continue your own adventure on another device.</Text>
  {!!table.notice&&!table.joined&&<Pressable accessibilityRole="alert" onPress={table.clearNotice}><Text style={s.error}>{table.notice}  ✕</Text></Pressable>}
  {table.joined?<>
   <View dataSet={{qb:'plate'}} style={s.status}>
    <View style={s.online}><View style={[s.dot,{backgroundColor:table.online?colors.heal:colors.gold}]}/><Text style={s.label}>{table.online?'Connected':'Reconnecting…'}</Text></View>
    <Text style={s.title}>Seated as {table.name||'Adventurer'}</Text>
    <Text style={s.label}>At the table</Text>
    {members.map(p=>{const me=p.id===table.deviceId,isMuted=muted.some(m=>m.seat===p.id);return <View key={p.id} dataSet={{qb:'table-member'}}>
     <View style={s.player}><View style={[s.seat,p.acting&&{borderColor:colors.gold}]}><Icon name={p.acting?'quill':isMuted?'mute':'sheet'} size={14} color={p.acting?colors.goldBright:colors.gold}/></View><Text numberOfLines={1} style={s.playerName}>{p.name}{me?' (this device)':''}{p.role==='owner'&&!me?' · host':''}</Text><Text style={s.playerState}>{p.acting?'taking a turn…':p.here?'here':'away'}{isMuted?' · muted':''}</Text>
      {!me&&<Pressable accessibilityRole="button" accessibilityState={{expanded:open===p.id}} accessibilityLabel={'Mute, report'+(table.role==='owner'?' or remove ':' ')+p.name} dataSet={{qb:'chip'}} onPress={()=>setOpen(open===p.id?null:p.id)} style={[s.more,open===p.id&&{borderColor:colors.goldBright}]}><Icon name={open===p.id?'close':'dots'} size={14} color={colors.gold}/></Pressable>}</View>
     {open===p.id&&!me&&<MemberActions table={table} member={p} onClose={()=>setOpen(null)}/>}
    </View>;})}
    {!members.length&&<Text style={s.copy}>Waiting for the table…</Text>}
    {members.length>1&&<Text style={s.note}>Use the ⋯ beside a player to mute them on this device or report them to the host of the game{table.role==='owner'?'; as this table’s host you can also remove and ban them':''}.</Text>}
    {table.role==='owner'&&!!table.banned?.length&&<><Text style={s.label}>Kept out of this table</Text>{table.banned.map(b=><View key={b.ref} style={s.player}><View style={s.seat}><Icon name="close" size={14} color={colors.gold}/></View><Text numberOfLines={1} style={s.playerName}>{b.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={'Let '+b.name+' back'} dataSet={{qb:'chip'}} disabled={busy} onPress={()=>run(()=>table.unban(b.ref))} style={s.unban}><Text style={s.unbanText}>Let back</Text></Pressable></View>)}<Text style={s.note}>Someone you let back can rejoin with a campaign invite.</Text></>}
   </View>
   {!!table.error&&<Text style={s.error}>{table.error}</Text>}
   <>{table.role==='owner'&&<GameButton label="Create a new campaign invite" onPress={()=>run(table.newInvite)} disabled={busy}/>} {!!table.invite&&<Text selectable style={s.note}>Campaign invite: {table.invite} · expires in 7 days. Share privately with your players.</Text>}</>
   <GameButton variant="primary" icon="play" label="Play at the table" onPress={onPlay}/>
   <GameButton icon="retreat" label="Leave the table" disabled={busy} onPress={()=>run(table.leave)}/>
   <Text style={s.note}>Leaving keeps this device's copy of the adventure. Other players can carry on without you.</Text>
  </>:<>
   <Section icon="sheet" title="Take a seat"/>
   {campaigns.map(c=><GameButton key={c.id} label={'Resume '+c.title} disabled={busy} onPress={()=>run(()=>table.join(name||hero?.name||'Adventurer',false,{campaignId:c.id}))}/>)}
   <Text style={s.label}>Your name at the table</Text>
   <TextInput dataSet={{qb:'input'}} accessibilityLabel="Your name at the table" value={name} onChangeText={setName} maxLength={40} placeholder="e.g. Sam" placeholderTextColor={tint('#938890')} style={s.input}/>
   <Text style={s.label}>Campaign invite</Text><TextInput value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} maxLength={16} accessibilityLabel="Campaign invite" style={s.input}/>
   <GameButton variant="primary" icon="people" label={busy?'Joining…':'Join the table'} disabled={busy||!name.trim()||!code.trim()} onPress={()=>run(()=>table.join(name,false,{code}))}/>
   <Text style={s.note}>At a party table you bring your current hero{hero?' ('+hero.name+')':''}; at a table that shares one hero, you play theirs. The campaign host supplies this invite{accountsNeeded()?' after you sign in and verify your email':''}. Your own save is backed up here first.</Text>
   <Section icon="party" title="Or host the table"/>
   <Segmented options={[['party','Everyone brings a hero','party'],['shared','Everyone plays mine','people']]} value={mode} onChange={setMode}/>
   <GameButton icon="flag" label={mode==='party'?'Start a party with my adventure':'Start the table with my adventure'} disabled={busy||!name.trim()||!hero||!characterChosen} onPress={()=>run(()=>table.join(name,true,{party:mode==='party'}))}/>
   <Text style={s.note}>{hero&&characterChosen?(mode==='party'?'Creates a separate campaign from '+hero.name+'’s adventure; each friend who joins brings their own hero into it.':'Creates a separate campaign from '+hero.name+'’s adventure; everyone who joins plays '+hero.name+'.'):'Choose a character and begin an adventure first to host.'}</Text>
   {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </>}
  {!!backup&&!table.joined&&<><Ornament glyph="✦"/><Text style={s.note}>A copy of this device's own adventure from before you joined a table is kept here ({new Date(backup).toLocaleString()}).</Text><GameButton icon="transfer" label="Restore my own adventure" onPress={()=>{restoreLocalBackup();globalThis.location?.reload();}}/></>}
 </View>;
}
const s=StyleSheet.create({lead:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,color:colors.gold,fontSize:24,marginBottom:10},copy:{fontFamily:fonts.ui,color:tint('#d4ced2'),lineHeight:23,fontSize:14.5,marginBottom:6},
 label:{...type.label,marginTop:10,marginBottom:6},title:{fontFamily:fonts.display,color:colors.parchment,fontSize:22,fontWeight:'700',letterSpacing:.8},
 online:{flexDirection:'row',alignItems:'center',gap:8},seat:{width:30,height:30,borderRadius:15,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),alignItems:'center',justifyContent:'center'},
 status:{padding:18,borderRadius:6,borderWidth:1,borderColor:tint('rgba(111,208,196,.4)'),marginBottom:8},player:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderBottomWidth:1,borderBottomColor:tint('rgba(178,34,58,.12)')},
 dot:{width:9,height:9,borderRadius:5},playerName:{fontFamily:fonts.display,color:colors.parchment,fontSize:15,fontWeight:'700',flex:1,minWidth:0},
 more:{width:36,height:34,borderRadius:17,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),alignItems:'center',justifyContent:'center'},
 unban:{minHeight:34,paddingHorizontal:12,borderRadius:17,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),justifyContent:'center'},unbanText:{fontFamily:fonts.ui,fontSize:13,fontWeight:'600',color:colors.gold},playerState:{fontFamily:fonts.ui,color:colors.muted,fontSize:12},
 input:{fontFamily:fonts.story,color:tint('#f5efe1'),backgroundColor:tint('rgba(8,5,9,.75)'),borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),borderRadius:4,padding:14,fontSize:18},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginTop:8},error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:21,marginTop:12}});
