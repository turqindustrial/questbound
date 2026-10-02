import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,StyleSheet} from 'react-native';
import {Section,Toggle,GameButton} from './ui';
import {cloudSettings,setCloudSettings,showCode,normalCode,downloadSave} from './cloudRules';
import {fonts,colors,tint} from './theme';
// Settings → Cloud save: this browser's recovery code, whether saving to the host PC is on, and restoring a hero
// from another browser's code.
export function CloudSaveSettings({onRestore,busy}){
 const [s,setS]=useState(null),[code,setCode]=useState(''),[message,setMessage]=useState(''),[working,setWorking]=useState(false);
 useEffect(()=>{let live=true;const load=()=>cloudSettings().then(v=>{if(live)setS(v);}).catch(()=>{});load();const t=setInterval(load,10000);return ()=>{live=false;clearInterval(t);};},[]);
 const restore=async()=>{
  if(normalCode(code).length!==12){setMessage('Enter the 12-letter recovery code from your other device.');return;}
  setWorking(true);setMessage('');
  try{const saved=await downloadSave(code);await onRestore(saved.snapshot);setS(await setCloudSettings({code:normalCode(code),savedAt:saved.savedAt}));setCode('');setMessage('Restored. This device now saves under that code too.');}
  catch(e){setMessage(e.message);}finally{setWorking(false);}
 };
 if(!s)return null;
 return <View dataSet={{qb:'plate'}} style={st.panel}>
  <Section icon="cloud" title="Recovery code" style={{marginTop:0}}/>
  <Text style={st.body}>Without an account, your hero and adventure are still kept on the host's PC under this recovery code. Write it down: entering it on another phone or browser that can reach the game carries you on there.</Text>
  <View dataSet={{qb:'plate'}} style={st.codeBox}><Text selectable style={st.code}>{showCode(s.code)}</Text><Text style={st.saved}>{!s.enabled?'Off':s.savedAt?'Saved '+new Date(s.savedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not saved yet'}</Text></View>
  <Toggle value={s.enabled} onChange={async v=>setS(await setCloudSettings({enabled:v}))} label="Save to the host PC" description="Keep a copy a few seconds after you play."/>
  <Text style={[st.body,{marginTop:12}]}>Restore from another device's code (your current hero is set aside under Heroes first):</Text>
  <View style={st.row}><TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={16} placeholder="XXXX-XXXX-XXXX" placeholderTextColor={tint('#938890')} accessibilityLabel="Recovery code" style={st.input}/><GameButton icon="cloud" label={working?'Restoring…':'Restore'} disabled={busy||working} onPress={restore} style={{marginTop:0}}/></View>
  {!!message&&<Text accessibilityLiveRegion="polite" style={st.message}>{message}</Text>}
 </View>;
}
const st=StyleSheet.create({
 panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18},
 body:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:13.5,lineHeight:21,marginBottom:8},
 codeBox:{flexDirection:'row',flexWrap:'wrap',alignItems:'baseline',justifyContent:'space-between',gap:8,padding:14,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(31,24,32,.9)'),marginBottom:8},
 code:{fontFamily:fonts.display,fontWeight:'700',fontSize:22,letterSpacing:3,color:colors.goldBright},
 saved:{fontFamily:fonts.ui,fontSize:12,color:colors.muted},
 row:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},
 input:{flexGrow:1,minWidth:180,fontFamily:fonts.display,fontSize:17,letterSpacing:2,color:'#f5efe1',backgroundColor:tint('rgba(8,5,9,.75)'),borderColor:tint('rgba(178,34,58,.4)'),borderWidth:1,borderRadius:3,paddingHorizontal:14,paddingVertical:11},
 message:{fontFamily:fonts.ui,color:'#ffd49a',fontSize:13,marginTop:8},
});
