import React,{useState} from 'react';
import {View,Text,TextInput,StyleSheet} from 'react-native';
import {GameButton,Ornament,ScreenTitle,Section} from './ui';
import Icon from './Icon';
import {localBackup,restoreLocalBackup} from './tableClient';
import {fonts,colors,type,tint} from './theme';
export default function SharedTable({table,hero,characterChosen,onPlay}){
 const [name,setName]=useState(table.name||hero?.name||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),backup=localBackup();
 const run=async fn=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <View>
  <ScreenTitle eyebrow="Multiplayer" icon="people" title="The shared table" sub="One adventure, played together from several phones and computers."/>
  <Text style={s.copy}>Everyone at the table sees the same story as it happens and can send actions to the Dungeon Master; while one player is taking a turn, the others wait. The same table also lets you continue your own adventure on another device.</Text>
  {table.joined?<>
   <View dataSet={{qb:'plate'}} style={s.status}>
    <View style={s.online}><View style={[s.dot,{backgroundColor:table.online?colors.heal:colors.gold}]}/><Text style={s.label}>{table.online?'Connected':'Reconnecting…'}</Text></View>
    <Text style={s.title}>Seated as {table.name||'Adventurer'}</Text>
    <Text style={s.label}>At the table</Text>
    {table.players.map(p=><View key={p.id} style={s.player}><View style={[s.seat,p.acting&&{borderColor:colors.gold}]}><Icon name={p.acting?'quill':'sheet'} size={14} color={p.acting?colors.goldBright:colors.gold}/></View><Text style={s.playerName}>{p.name}{p.id===table.deviceId?' (this device)':''}</Text><Text style={s.playerState}>{p.acting?'taking a turn…':'here'}</Text></View>)}
    {!table.players.length&&<Text style={s.copy}>Waiting for the table…</Text>}
   </View>
   {!!table.error&&<Text style={s.error}>{table.error}</Text>}
   <GameButton variant="primary" icon="play" label="Play at the table" onPress={onPlay}/>
   <GameButton icon="retreat" label="Leave the table" disabled={busy} onPress={()=>run(table.leave)}/>
   <Text style={s.note}>Leaving keeps this device's copy of the adventure. Other players can carry on without you.</Text>
  </>:<>
   <Section icon="sheet" title="Take a seat"/>
   <Text style={s.label}>Your name at the table</Text>
   <TextInput dataSet={{qb:'input'}} accessibilityLabel="Your name at the table" value={name} onChangeText={setName} maxLength={40} placeholder="e.g. Sam" placeholderTextColor={tint('#938890')} style={s.input}/>
   <GameButton variant="primary" icon="people" label={busy?'Joining…':'Join the table'} disabled={busy||!name.trim()} onPress={()=>run(()=>table.join(name,false))}/>
   <Text style={s.note}>Joining loads the table's adventure and character on this device. If the table is empty, your current adventure starts it. Your own save is backed up here first.</Text>
   <GameButton icon="flag" label="Start the table with my adventure" disabled={busy||!name.trim()||!hero||!characterChosen} onPress={()=>run(()=>table.join(name,true))}/>
   <Text style={s.note}>{hero&&characterChosen?'Replaces whatever the table was playing with '+hero.name+'’s adventure.':'Choose a character and begin an adventure first to host.'}</Text>
   {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </>}
  {!!backup&&!table.joined&&<><Ornament glyph="✦"/><Text style={s.note}>A copy of this device's own adventure from before you joined a table is kept here ({new Date(backup).toLocaleString()}).</Text><GameButton icon="transfer" label="Restore my own adventure" onPress={()=>{restoreLocalBackup();globalThis.location?.reload();}}/></>}
 </View>;
}
const s=StyleSheet.create({lead:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,color:colors.gold,fontSize:24,marginBottom:10},copy:{fontFamily:fonts.ui,color:tint('#d4ced2'),lineHeight:23,fontSize:14.5,marginBottom:6},
 label:{...type.label,marginTop:10,marginBottom:6},title:{fontFamily:fonts.display,color:colors.parchment,fontSize:22,fontWeight:'700',letterSpacing:.8},
 online:{flexDirection:'row',alignItems:'center',gap:8},seat:{width:30,height:30,borderRadius:15,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),alignItems:'center',justifyContent:'center'},
 status:{padding:18,borderRadius:6,borderWidth:1,borderColor:'rgba(111,208,196,.4)',marginBottom:8},player:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderBottomWidth:1,borderBottomColor:tint('rgba(178,34,58,.12)')},
 dot:{width:9,height:9,borderRadius:5},playerName:{fontFamily:fonts.display,color:colors.parchment,fontSize:15,fontWeight:'700',flex:1},playerState:{fontFamily:fonts.ui,color:colors.muted,fontSize:12},
 input:{fontFamily:fonts.story,color:'#f5efe1',backgroundColor:tint('rgba(8,5,9,.75)'),borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),borderRadius:4,padding:14,fontSize:18},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginTop:8},error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:21,marginTop:12}});
