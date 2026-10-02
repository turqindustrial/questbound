import React,{useState} from 'react';
import {View,Text,TextInput,Pressable,Modal,StyleSheet} from 'react-native';
import {fonts,colors,type,tint} from './theme';
import Icon from './Icon';
import {GameButton} from './ui';
import {abilities,finalScores,modifier,validDevScores} from './characterRules';
import {combatBasics} from './combatRules';
import {playSound} from './audio';
// Developer options for testing: behind a short code, the hero's level and ability scores can be set freely.
// The code keeps the panel out of a tester's way; it is not a secret and protects nothing.
const CODE='6969';
let unlocked=false;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export default function DeveloperOptions({form,onChange}){
 const [open,setOpen]=useState(false),[asking,setAsking]=useState(false),[code,setCode]=useState(''),[wrong,setWrong]=useState(false);
 const tryCode=()=>{if(code.trim()===CODE){unlocked=true;setAsking(false);setCode('');setWrong(false);setOpen(true);playSound('open');}else{setWrong(true);setCode('');}};
 const level=form.level??1,custom=validDevScores(form.devScores),scores=finalScores(form);
 const setLevel=next=>onChange({level:clamp(next,1,20),devLevel:clamp(next,1,20)});
 const setScore=(name,next)=>onChange({devScores:{...scores,...(custom?form.devScores:{}),[name]:clamp(next,1,20)},devLevel:level});
 const preview=(()=>{try{return combatBasics({...form,level,scores});}catch{return null;}})();
 const stepper=(label,value,onStep,hint)=><View key={label} style={s.row}>
  <View style={{flex:1,minWidth:0}}><Text style={s.rowLabel}>{label}</Text>{!!hint&&<Text style={s.rowHint}>{hint}</Text>}</View>
  <Pressable accessibilityRole="button" accessibilityLabel={'Lower '+label} onPress={()=>onStep(value-1)} onLongPress={()=>onStep(value-5)} dataSet={{qb:'chip'}} style={s.step}><Text style={s.stepText}>−</Text></Pressable>
  <Text accessibilityLabel={label+' '+value} style={s.value}>{value}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={'Raise '+label} onPress={()=>onStep(value+1)} onLongPress={()=>onStep(value+5)} dataSet={{qb:'chip'}} style={s.step}><Text style={s.stepText}>+</Text></Pressable>
 </View>;
 return <View style={s.wrap}>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} accessibilityLabel="Developer options" onPress={()=>{if(open){setOpen(false);return;}if(unlocked){setOpen(true);return;}setWrong(false);setCode('');setAsking(true);}} dataSet={{qb:'chip'}} style={s.tab}><Icon name="cog" size={13} color={colors.muted}/><Text style={s.tabText}>Developer options</Text></Pressable>
  <Modal transparent visible={asking} animationType="fade" onRequestClose={()=>setAsking(false)}><Pressable accessibilityLabel="Close" onPress={()=>setAsking(false)} dataSet={{qb:'scrim'}} style={s.scrim}><Pressable onPress={()=>{}} dataSet={{qb:'sheet'}} style={s.sheet} accessibilityViewIsModal>
   <View style={s.emblem}><Icon name="key" size={22} color={colors.goldBright}/></View>
   <Text style={s.overline}>Testing</Text><Text style={s.title}>Developer code</Text>
   <Text style={s.text}>Enter the developer code to set this hero’s level and ability scores freely.</Text>
   <TextInput autoFocus value={code} onChangeText={value=>{setCode(value.replace(/\D/g,'').slice(0,8));setWrong(false);}} onSubmitEditing={tryCode} keyboardType="number-pad" inputMode="numeric" maxLength={8} autoComplete="off" accessibilityLabel="Developer code" placeholder="Code" placeholderTextColor={tint('#938890')} dataSet={{qb:'input'}} style={s.input}/>
   {wrong&&<Text accessibilityRole="alert" style={s.error}>That code is not right.</Text>}
   <GameButton variant="primary" icon="key" label="Unlock" onPress={tryCode} disabled={!code}/>
   <GameButton label="Cancel" onPress={()=>setAsking(false)}/>
  </Pressable></Pressable></Modal>
  {open&&<View dataSet={{qb:'plate'}} style={s.panel}>
   <View style={s.head}><Icon name="cog" size={15} color={colors.gold}/><Text style={s.heading}>Developer options</Text></View>
   <Text style={s.text}>For testing. The level and scores here replace the usual rules (level 1, the standard array and background increases). Hold − or + to step by five.</Text>
   {stepper('Level',level,setLevel,preview?.available?preview.hp+' HP · proficiency +'+preview.proficiency:null)}
   <View style={s.rule}/>
   {abilities.map(name=>stepper(name,scores[name],next=>setScore(name,next),'Modifier '+(modifier(scores[name])>=0?'+':'')+modifier(scores[name])))}
   <View style={s.buttons}>
    <GameButton label="All scores 20" onPress={()=>onChange({devScores:Object.fromEntries(abilities.map(a=>[a,20])),devLevel:level})}/>
    <GameButton label="Back to the standard rules" onPress={()=>onChange({devScores:undefined,devLevel:undefined,level:1})} disabled={!custom&&level===1}/>
   </View>
   <Text style={s.note}>{custom?'Custom scores are in use: the ability page’s choices are ignored for this hero.':'Scores still follow the ability page until you change one here.'}{level>1?' A hero above level 1 needs spells for that level: check the spells page before saving.':''}</Text>
  </View>}
 </View>;
}
const s=StyleSheet.create({
 wrap:{marginTop:18},
 tab:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,minHeight:32,paddingHorizontal:12,borderRadius:16,borderWidth:1,borderColor:tint('rgba(178,34,58,.22)'),backgroundColor:tint('rgba(31,24,32,.6)')},
 tabText:{fontFamily:fonts.ui,fontSize:11.5,color:colors.muted,letterSpacing:.3},
 panel:{marginTop:10,padding:16,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,gap:8},
 head:{flexDirection:'row',alignItems:'center',gap:8},heading:{fontFamily:fonts.display,color:colors.gold,fontSize:14,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},
 text:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:13.5,lineHeight:21},note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:19},
 row:{flexDirection:'row',alignItems:'center',gap:10,minHeight:48},rowLabel:{fontFamily:fonts.display,color:colors.parchment,fontSize:14,fontWeight:'700',letterSpacing:.8},rowHint:{fontFamily:fonts.ui,color:colors.muted,fontSize:11.5,marginTop:1},
 step:{width:44,height:44,borderRadius:22,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),backgroundColor:tint('#271e29'),alignItems:'center',justifyContent:'center'},stepText:{fontFamily:fonts.display,color:colors.gold,fontSize:22,fontWeight:'700',lineHeight:26},
 value:{minWidth:40,textAlign:'center',fontFamily:fonts.display,color:colors.goldBright,fontSize:22,fontWeight:'800',fontVariant:['tabular-nums']},
 rule:{height:1,backgroundColor:tint('rgba(178,34,58,.18)'),marginVertical:4},buttons:{gap:8,marginTop:6},
 scrim:{flex:1,backgroundColor:tint('rgba(5,3,5,.78)'),alignItems:'center',justifyContent:'center',padding:16},
 sheet:{width:'100%',maxWidth:380,padding:22,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(22,16,23,.98)'),gap:12},
 emblem:{alignSelf:'center',width:48,height:48,borderRadius:24,borderWidth:1,borderColor:tint('rgba(224,74,92,.6)'),alignItems:'center',justifyContent:'center',backgroundColor:tint('rgba(48,26,78,.45)')},
 overline:{...type.label,textAlign:'center'},title:{fontFamily:fonts.display,fontSize:22,fontWeight:'700',letterSpacing:2,color:colors.parchment,textAlign:'center',textTransform:'uppercase'},
 input:{fontFamily:fonts.display,color:'#f5efe1',backgroundColor:tint('rgba(8,5,9,.75)'),borderColor:tint('rgba(178,34,58,.4)'),borderWidth:1,borderRadius:4,padding:12,fontSize:22,letterSpacing:6,textAlign:'center'},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:13,textAlign:'center'},
});
