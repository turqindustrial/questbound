import React,{useState} from 'react';
import {View,Text,TextInput,Platform,StyleSheet} from 'react-native';
import {GameButton,Section} from './ui';
import {exportSave,readSave,applySave} from './saveCodes';
import {backupLocalSave} from './tableClient';
import {fonts,colors,type} from './theme';
// Settings panel: copy this browser's save as a code, or load a code from another device or playtest link.
export default function SaveTransfer(){
 const [code,setCode]=useState(''),[shown,setShown]=useState(''),[pending,setPending]=useState(null),[status,setStatus]=useState(''),[error,setError]=useState('');
 if(Platform.OS!=='web')return null;
 async function copy(){
  setError('');setStatus('');
  try{const text=await exportSave();setShown(text);try{await navigator.clipboard.writeText(text);setStatus('Save code copied. Keep it somewhere safe, or paste it here on your other device.');}catch{setStatus('Select the code below and copy it.');}}
  catch(e){setError(e.message);}
 }
 async function check(){setError('');setStatus('');try{setPending(await readSave(code));}catch(e){setPending(null);setError(e.message);}}
 function load(){try{backupLocalSave();applySave(pending);setStatus('Loading '+pending.hero.name+'…');setTimeout(()=>globalThis.location?.reload(),300);}catch{setError('This browser would not store the save. Check that it allows site data, then try again.');}}
 return <View dataSet={{qb:'plate'}} style={s.panel}>
  <Section icon="transfer" title="Move your hero" style={{marginTop:0,marginBottom:2}}/>
  <Text style={s.caption}>Your hero and adventure are saved in this browser, at this address. A save code carries them to another device, another browser or a new playtest link, and doubles as a backup.</Text>
  <GameButton icon="transfer" label="Copy save code" onPress={copy} style={{marginTop:0}}/>
  {!!shown&&<TextInput value={shown} editable={false} selectTextOnFocus multiline accessibilityLabel="Your save code" style={s.code}/>}
  <Text style={[s.label,{marginTop:6}]}>Load a save code</Text>
  <TextInput value={code} onChangeText={value=>{setCode(value);setPending(null);setError('');}} multiline autoCapitalize="none" autoCorrect={false} placeholder="Paste a save code here" placeholderTextColor="#7f889c" accessibilityLabel="Paste a save code" dataSet={{qb:'input'}} style={s.code}/>
  {pending?<>
   <Text style={s.caption}>This replaces the hero and adventure saved in this browser with <Text style={{color:colors.parchment}}>{pending.hero.name}</Text> (level {pending.hero.level} {pending.hero.class}). The current save is kept as a backup under Multiplayer.</Text>
   <GameButton variant="primary" icon="check" label={'Load '+pending.hero.name} onPress={load} style={{marginTop:0}}/>
  </>:<GameButton icon="search" label="Check save code" disabled={!code.trim()} onPress={check} style={{marginTop:0}}/>}
  {!!status&&<Text accessibilityLiveRegion="polite" style={s.ok}>{status}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 </View>;
}
const s=StyleSheet.create({
 panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18,gap:10},
 heading:{fontFamily:fonts.display,color:colors.gold,fontSize:17,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20},label:{...type.label},
 code:{fontFamily:'monospace',fontSize:12,color:'#e2e6ec',backgroundColor:'rgba(4,6,10,.75)',borderWidth:1,borderColor:'rgba(201,164,92,.35)',borderRadius:4,padding:10,minHeight:64,maxHeight:120},
 ok:{fontFamily:fonts.ui,color:colors.heal,fontSize:13,lineHeight:20},error:{fontFamily:fonts.ui,color:colors.danger,fontSize:13,lineHeight:20},
});
