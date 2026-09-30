import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,Platform,StyleSheet,Text,View} from 'react-native';
import {GameButton} from './ui';
import {playSound} from './audio';
import {fonts,colors} from './theme';

export default function DiceRoller(){
 const [result,setResult]=useState(null),[face,setFace]=useState(20),[rolling,setRolling]=useState(false),[reduced,setReduced]=useState(false);
 const motion=useRef(new Animated.Value(0)).current,locked=useRef(false),timer=useRef(null),animation=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive.current)setReduced(value);});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{alive.current=false;clearInterval(timer.current);animation.current?.stop();listener.remove();};},[]);
 function roll(){
  if(locked.current)return;locked.current=true;setRolling(true);setResult(null);
  const next=1+Math.floor(Math.random()*20);motion.setValue(0);playSound('dice');playSound('dice',.35);
  if(!reduced)timer.current=setInterval(()=>setFace(value=>value%20+1),65);
  animation.current=Animated.timing(motion,{toValue:1,duration:reduced?180:950,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'});
  animation.current.start(({finished})=>{clearInterval(timer.current);if(!alive.current||!finished)return;setFace(next);setResult(next);setRolling(false);locked.current=false;if(next===20)playSound('victory');else if(next===1)playSound('defeat');else playSound('chime');});
 }
 const crit=result===20,fumble=result===1;
 return <View style={s.panel}>
  <Text style={s.intro}>A twenty-sided die for your next moment of fate.</Text>
  <View dataSet={{qb:'tray'}} style={s.tray} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
   <Animated.View dataSet={{qb:'die'}} style={[s.die,crit&&{borderColor:'#fff1c7'},fumble&&{borderColor:'#f06a4f'},!reduced&&{transform:[{translateY:motion.interpolate({inputRange:[0,.25,.5,.75,1],outputRange:[0,-24,0,-9,0]})},{rotate:motion.interpolate({inputRange:[0,1],outputRange:['0deg','720deg']})},{scale:motion.interpolate({inputRange:[0,.5,1],outputRange:[1,1.12,1]})}]}]}>
    <View style={s.facet}/><Text style={s.face}>{result==null&&!rolling?'20':face}</Text>
   </Animated.View>
  </View>
  <Text accessibilityLiveRegion="polite" style={[s.result,crit&&{color:'#fff1c7'},fumble&&{color:'#ff9a7c'}]}>{rolling?'Rolling…':result==null?'Ready to roll':crit?'Natural 20 — critical!':fumble?'Natural 1 — fate frowns':'d20 · '+result}</Text>
  <GameButton variant="primary" label={rolling?'Rolling…':'Roll d20'} disabled={rolling} onPress={roll} style={{minWidth:220}}/>
 </View>;
}
const s=StyleSheet.create({panel:{alignItems:'center',paddingVertical:12},intro:{fontFamily:fonts.story,fontStyle:'italic',color:'#e2d8c0',fontSize:19,lineHeight:28,textAlign:'center'},
 tray:{height:250,width:'100%',alignItems:'center',justifyContent:'center',marginTop:18,borderRadius:6,backgroundColor:'rgba(8,19,29,.6)'},
 die:{width:120,height:120,backgroundColor:'#224754',borderWidth:3,borderColor:colors.gold,borderRadius:26,alignItems:'center',justifyContent:'center'},
 facet:{position:'absolute',width:84,height:84,borderWidth:1,borderColor:'rgba(232,199,123,.55)',transform:[{rotate:'45deg'}]},
 face:{fontFamily:fonts.display,fontSize:48,fontWeight:'800',color:'#fff3d6',...Platform.select({web:{textShadow:'0 2px 6px rgba(0,0,0,.6)'},default:{textShadowColor:'rgba(0,0,0,.6)',textShadowRadius:6,textShadowOffset:{width:0,height:2}}})},
 result:{minHeight:58,padding:16,fontFamily:fonts.display,fontWeight:'700',letterSpacing:1.4,fontSize:21,color:colors.gold,textAlign:'center'}});
