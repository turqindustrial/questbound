import React,{useEffect,useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {audioSettings,setAudio,subscribeAudio,playSound} from './audio';
import {fonts,colors,type} from './theme';
import {IconButton,Section,Toggle} from './ui';
import Icon from './Icon';
function useAudioSettings(){const [value,setValue]=useState(audioSettings);useEffect(()=>subscribeAudio(setValue),[]);return value;}
export function AudioToggle({style,compact=false}){
 const a=useAudioSettings();
 if(compact)return <IconButton icon={a.muted?'mute':'sound'} label={a.muted?'Turn sound on':'Mute sound'} onPress={()=>setAudio({muted:!a.muted})} style={style}/>;
 return <Pressable accessibilityRole="button" accessibilityLabel={a.muted?'Turn sound on':'Mute sound'} onPress={()=>setAudio({muted:!a.muted})} dataSet={{qb:'chip'}} style={[s.toggle,style]}><View style={s.toggleRow}><Icon name={a.muted?'mute':'sound'} size={14} color={colors.gold}/><Text style={s.toggleText}>{a.muted?'Sound off':'Sound on'}</Text></View></Pressable>;
}
const levels=[['Off',0],['Low',.3],['Med',.6],['High',.85],['Max',1]];
const icons={master:'sound',music:'music',ambience:'leaf',effects:'swords'};
export function AudioSettings(){
 const a=useAudioSettings();
 const row=(label,key,preview)=><View style={s.row}><View style={s.rowHead}><Icon name={icons[key]} size={14} color={colors.goldMid}/><Text style={s.label}>{label}</Text></View><View dataSet={{qb:'seg'}} style={s.options}>{levels.map(([name,value])=>{const on=Math.abs(a[key]-value)<.05;return <Pressable key={name} accessibilityRole="radio" accessibilityLabel={label+' '+({Med:'medium'}[name]??name.toLowerCase())} accessibilityState={{checked:on}} onPress={()=>{setAudio({[key]:value,muted:false});if(preview)setTimeout(()=>playSound(preview),50);}} dataSet={{qb:on?'seg-on':undefined}} style={[s.option,on&&s.optionOn]}><Text style={[s.optionText,on&&{color:colors.goldBright}]}>{name}</Text></Pressable>;})}</View></View>;
 return <View dataSet={{qb:'plate'}} style={s.panel}>
  <Section icon="music" title="Sound" style={{marginTop:0,marginBottom:2}}/>
  <Text style={s.caption}>The score, ambience and effects are performed live on your device and mixed like a film: music follows the scene, the world sounds different at the hearth, on the road and underground, and blows land on the side they come from. Headphones recommended.</Text>
  {row('Master','master','chime')}
  {row('Music','music')}
  {row('Ambience','ambience')}
  {row('Effects','effects','hit')}
  <Toggle value={a.night} onChange={night=>setAudio({night})} label="Night mode" description="Evens out loud hits and quiet moments for late-night play or small speakers."/>
  <Toggle value={a.muted} onChange={muted=>setAudio({muted})} label="Mute all sound" description="Silences music, ambience and effects on this device."/>
 </View>;
}
const s=StyleSheet.create({toggle:{paddingHorizontal:12,paddingVertical:8,minHeight:36,borderRadius:18,borderWidth:1,borderColor:'rgba(178,34,58,.4)',backgroundColor:'rgba(20,15,21,.8)',justifyContent:'center'},toggleRow:{flexDirection:'row',alignItems:'center',gap:6},toggleText:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.2,textTransform:'uppercase'},
 panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18,gap:12},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20},
 row:{gap:8},rowHead:{flexDirection:'row',alignItems:'center',gap:7},label:{...type.label},
 options:{flexDirection:'row',gap:4,padding:3,borderRadius:6,borderWidth:1,borderColor:'rgba(178,34,58,.25)'},
 option:{flex:1,minWidth:0,minHeight:40,paddingHorizontal:4,borderRadius:4,borderWidth:1,borderColor:'transparent',justifyContent:'center',alignItems:'center'},optionOn:{borderColor:'rgba(224,74,92,.55)',backgroundColor:'rgba(48,26,78,.9)'},
 optionText:{fontFamily:fonts.display,color:colors.muted,fontSize:12,fontWeight:'700',letterSpacing:1,textTransform:'uppercase'},
});
