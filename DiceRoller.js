import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {GameButton} from './ui';
import Icon from './Icon';
import {playSound} from './audio';
import {fonts,colors,tint} from './theme';
const dice=[4,6,8,10,12,20,100];
// A tabletop die for moments of fate: pick the die, roll, and keep the last few results in view.
export default function DiceRoller(){
 const [sides,setSides]=useState(20),[result,setResult]=useState(null),[face,setFace]=useState(20),[rolling,setRolling]=useState(false),[reduced,setReduced]=useState(false),[history,setHistory]=useState([]);
 const motion=useRef(new Animated.Value(0)).current,locked=useRef(false),timer=useRef(null),animation=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive.current)setReduced(value);});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{alive.current=false;clearInterval(timer.current);animation.current?.stop();listener.remove();};},[]);
 function choose(n){if(locked.current||n===sides)return;playSound('select');setSides(n);setFace(n);setResult(null);}
 function roll(){
  if(locked.current)return;locked.current=true;setRolling(true);setResult(null);
  const die=sides,next=1+Math.floor(Math.random()*die);motion.setValue(0);playSound('dice');playSound('dice',.35);
  if(!reduced)timer.current=setInterval(()=>setFace(1+Math.floor(Math.random()*die)),65);
  animation.current=Animated.timing(motion,{toValue:1,duration:reduced?180:950,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'});
  animation.current.start(({finished})=>{clearInterval(timer.current);if(!alive.current||!finished)return;setFace(next);setResult(next);setRolling(false);locked.current=false;setHistory(h=>[{die,value:next,id:Date.now()},...h].slice(0,8));
   if(die===20&&next===20)playSound('victory');else if(die===20&&next===1)playSound('defeat');else playSound('chime');});
 }
 const crit=sides===20&&result===20,fumble=sides===20&&result===1,best=result===sides&&sides!==20;
 return <View style={s.panel}>
  <Text style={s.intro}>A die for your next moment of fate.</Text>
  <View accessibilityRole="radiogroup" dataSet={{qb:'seg'}} style={s.picker}>{dice.map(n=>{const on=n===sides;return <Pressable key={n} accessibilityRole="radio" accessibilityState={{checked:on}} accessibilityLabel={'d'+n} onPress={()=>choose(n)} dataSet={{qb:on?'seg-on':undefined}} style={[s.pick,on&&s.pickOn]}><Text style={[s.pickText,on&&{color:colors.goldBright}]}>d{n}</Text></Pressable>;})}</View>
  <View dataSet={{qb:'tray'}} style={s.tray} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
   <Animated.View dataSet={{qb:'die'}} style={[s.die,crit&&{borderColor:tint('#eadaff')},fumble&&{borderColor:'#f06a4f'},!reduced&&{transform:[{translateY:motion.interpolate({inputRange:[0,.25,.5,.75,1],outputRange:[0,-24,0,-9,0]})},{rotate:motion.interpolate({inputRange:[0,1],outputRange:['0deg','720deg']})},{scale:motion.interpolate({inputRange:[0,.5,1],outputRange:[1,1.12,1]})}]}]}>
    <View style={s.facet}/><Text style={[s.face,sides===100&&{fontSize:38}]}>{result==null&&!rolling?sides:face}</Text>
   </Animated.View>
   <Text style={s.dieName}>d{sides}</Text>
  </View>
  <Text accessibilityLiveRegion="polite" style={[s.result,(crit||best)&&{color:tint('#eadaff')},fumble&&{color:'#ff9a7c'}]}>{rolling?'Rolling…':result==null?'Ready to roll':crit?'Natural 20 — critical!':fumble?'Natural 1 — fate frowns':best?'Maximum roll · '+result:'d'+sides+' · '+result}</Text>
  <GameButton variant="primary" icon="d20" label={rolling?'Rolling…':'Roll d'+sides} disabled={rolling} onPress={roll} style={{minWidth:240}}/>
  {history.length>0&&<View style={s.history}><Text style={s.historyLabel}>Recent rolls</Text><View style={s.historyRow}>{history.map(h=><View key={h.id} style={[s.chip,h.die===20&&h.value===20&&{borderColor:colors.gold},h.die===20&&h.value===1&&{borderColor:colors.bloodBright}]}><Text style={s.chipDie}>d{h.die}</Text><Text style={s.chipValue}>{h.value}</Text></View>)}</View></View>}
 </View>;
}
const s=StyleSheet.create({panel:{alignItems:'center',paddingVertical:4},intro:{fontFamily:fonts.story,fontStyle:'italic',color:'#dacec9',fontSize:19,lineHeight:28,textAlign:'center'},
 picker:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:4,padding:4,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.28)'),marginTop:16},
 pick:{flexGrow:1,minWidth:42,minHeight:40,paddingHorizontal:4,borderRadius:4,borderWidth:1,borderColor:'transparent',alignItems:'center',justifyContent:'center'},pickOn:{borderColor:tint('rgba(224,74,92,.55)'),backgroundColor:tint('rgba(48,26,78,.9)')},
 pickText:{fontFamily:fonts.display,fontSize:14,fontWeight:'700',letterSpacing:.8,color:colors.muted},
 tray:{height:240,width:'100%',alignItems:'center',justifyContent:'center',marginTop:16,borderRadius:8,backgroundColor:tint('rgba(23,13,24,.6)')},
 die:{width:120,height:120,backgroundColor:tint('#452d49'),borderWidth:3,borderColor:colors.gold,borderRadius:26,alignItems:'center',justifyContent:'center'},
 facet:{position:'absolute',width:84,height:84,borderWidth:1,borderColor:tint('rgba(224,74,92,.55)'),transform:[{rotate:'45deg'}]},
 face:{fontFamily:fonts.display,fontSize:48,fontWeight:'800',color:'#f5e6e0',...Platform.select({web:{textShadow:'0 2px 6px rgba(0,0,0,.6)'},default:{textShadowColor:'rgba(0,0,0,.6)',textShadowRadius:6,textShadowOffset:{width:0,height:2}}})},
 dieName:{position:'absolute',bottom:12,fontFamily:fonts.display,fontSize:11,letterSpacing:3,color:tint('rgba(224,74,92,.6)'),textTransform:'uppercase'},
 result:{minHeight:58,padding:16,fontFamily:fonts.display,fontWeight:'700',letterSpacing:1.4,fontSize:21,color:colors.gold,textAlign:'center'},
 history:{alignSelf:'stretch',marginTop:18,gap:8,alignItems:'center'},historyLabel:{fontFamily:fonts.display,fontSize:10,letterSpacing:2.4,color:colors.goldMid,textTransform:'uppercase'},
 historyRow:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:6},
 chip:{flexDirection:'row',alignItems:'baseline',gap:5,paddingHorizontal:10,paddingVertical:4,borderRadius:12,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:'rgba(0,0,0,.25)'},
 chipDie:{fontFamily:fonts.ui,fontSize:10.5,color:colors.muted},chipValue:{fontFamily:fonts.display,fontSize:15,fontWeight:'800',color:colors.parchment},
});
