import React,{useEffect,useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {audioSettings,setAudio,subscribeAudio,playSound} from './audio';
import {fonts,colors,type} from './theme';
function useAudioSettings(){const [value,setValue]=useState(audioSettings);useEffect(()=>subscribeAudio(setValue),[]);return value;}
export function AudioToggle({style,compact=false}){
 const a=useAudioSettings();
 return <Pressable accessibilityRole="button" accessibilityLabel={a.muted?'Turn sound on':'Mute sound'} onPress={()=>setAudio({muted:!a.muted})} dataSet={{qb:'chip'}} style={[s.toggle,style]}><Text style={[s.toggleText,compact&&{fontSize:14,letterSpacing:0},a.muted&&compact&&{textDecorationLine:'line-through',color:colors.muted}]}>{compact?'♪':a.muted?'♪ Sound off':'♪ Sound on'}</Text></Pressable>;
}
const levels=[['Off',0],['Low',.3],['Med',.6],['High',.85],['Max',1]];
export function AudioSettings(){
 const a=useAudioSettings();
 const row=(label,key,preview)=><View style={s.row}><Text style={s.label}>{label}</Text><View style={s.options}>{levels.map(([name,value])=>{const on=Math.abs(a[key]-value)<.05;return <Pressable key={name} accessibilityRole="radio" accessibilityLabel={label+' '+({Med:'medium'}[name]??name.toLowerCase())} accessibilityState={{checked:on}} onPress={()=>{setAudio({[key]:value,muted:false});if(preview)setTimeout(()=>playSound(preview),50);}} dataSet={{qb:on?'btn-primary':'chip'}} style={[s.option,on&&s.optionOn]}><Text style={[s.optionText,on&&{color:'#2a1a07'}]}>{name}</Text></Pressable>;})}</View></View>;
 return <View dataSet={{qb:'plate'}} style={s.panel}>
  <Text style={s.heading}>Sound</Text>
  <Text style={s.caption}>The score, ambience and effects are performed live on your device and mixed like a film: music follows the scene, the world sounds different at the hearth, on the road and underground, and blows land on the side they come from. Headphones recommended.</Text>
  {row('Master','master','chime')}
  {row('Music','music')}
  {row('Ambience','ambience')}
  {row('Effects','effects','hit')}
  <Pressable accessibilityRole="switch" accessibilityState={{checked:a.night}} onPress={()=>setAudio({night:!a.night})} style={s.nightRow}><View dataSet={{qb:a.night?'btn-primary':'chip'}} style={[s.box,a.night&&s.boxOn]}><Text style={s.tick}>{a.night?'✓':''}</Text></View><View style={{flexShrink:1}}><Text style={s.nightTitle}>Night mode</Text><Text style={s.caption}>Evens out loud hits and quiet moments for late-night play or small speakers.</Text></View></Pressable>
  <Pressable accessibilityRole="switch" accessibilityState={{checked:a.muted}} onPress={()=>setAudio({muted:!a.muted})} dataSet={{qb:'chip'}} style={s.mute}><Text style={s.optionText}>{a.muted?'Unmute all sound':'Mute all sound'}</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({toggle:{paddingHorizontal:12,paddingVertical:8,minHeight:36,borderRadius:18,borderWidth:1,borderColor:'rgba(201,164,92,.4)',backgroundColor:'rgba(12,16,24,.8)',justifyContent:'center'},toggleText:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.2},
 panel:{padding:18,borderRadius:4,borderWidth:1,borderColor:colors.goldLine,marginBottom:18,gap:12},heading:{fontFamily:fonts.display,color:colors.gold,fontSize:17,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20},
 row:{gap:8},label:{...type.label},options:{flexDirection:'row',gap:6},option:{flex:1,minWidth:0,minHeight:42,paddingHorizontal:4,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'#1a202d',justifyContent:'center',alignItems:'center'},optionOn:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},
 optionText:{fontFamily:fonts.display,color:colors.parchment,fontSize:12,fontWeight:'700',letterSpacing:1,textTransform:'uppercase'},
 nightRow:{flexDirection:'row',alignItems:'center',gap:12,minHeight:44},box:{width:24,height:24,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.5)',backgroundColor:'#1a202d',alignItems:'center',justifyContent:'center'},boxOn:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},tick:{color:'#2a1a07',fontWeight:'800',fontSize:14},nightTitle:{fontFamily:fonts.display,color:colors.parchment,fontSize:14,fontWeight:'700',letterSpacing:.8},mute:{minHeight:44,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'#1a202d',justifyContent:'center',alignItems:'center'}});
