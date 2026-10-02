import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,Animated,Easing,Platform,StyleSheet,useWindowDimensions,AccessibilityInfo} from 'react-native';
import {playSound} from './audio';
import {fonts,colors,tint} from './theme';
const native=Platform.OS!=='web';
// The launch sequence: the emblem draws in, the title rises out of the dark, then one tap begins the game.
// That tap is also what browsers require before sound (and full screen) may start.
export default function LaunchScreen({ready,onBegin}){
 const {width,height}=useWindowDimensions(),size=Math.min(width,height);
 const emblem=useRef(new Animated.Value(0)).current,title=useRef(new Animated.Value(0)).current,prompt=useRef(new Animated.Value(0)).current,exit=useRef(new Animated.Value(1)).current;
 const [armed,setArmed]=useState(false),started=useRef(false);
 // The page's own loading card (public/index.html) steps aside once the title card is drawn.
 useEffect(()=>{globalThis.document?.getElementById('qb-boot')?.remove();},[]);
 useEffect(()=>{
  let reduce=false,alive=true;
  AccessibilityInfo.isReduceMotionEnabled().then(v=>{reduce=v;}).finally(()=>{
   if(!alive)return;const d=reduce?0:1;
   Animated.sequence([
    Animated.timing(emblem,{toValue:1,duration:1300*d,easing:Easing.out(Easing.cubic),useNativeDriver:native}),
    Animated.timing(title,{toValue:1,duration:1100*d,easing:Easing.out(Easing.quad),useNativeDriver:native}),
    Animated.timing(prompt,{toValue:1,duration:500*d,useNativeDriver:native}),
   ]).start(()=>alive&&setArmed(true));
  });
  return()=>{alive=false;};
 },[]);
 const done=useRef(false),finish=()=>{if(done.current)return;done.current=true;onBegin();};
 function begin(){
  if(started.current)return;started.current=true;
  playSound('boot');
  Animated.timing(exit,{toValue:0,duration:1400,delay:900,easing:Easing.inOut(Easing.quad),useNativeDriver:native}).start(finish);
  // Browsers pause animations in background tabs; never leave the player stuck behind the title card.
  setTimeout(finish,2700);
 }
 useEffect(()=>{const key=e=>{if(!['Tab','Shift','Control','Alt','Meta'].includes(e.key))begin();};document?.addEventListener?.('keydown',key);return()=>document?.removeEventListener?.('keydown',key);},[]);
 // Everything scales with the smaller side so the whole card fits any window, including a phone on its side.
 const short=height<520,ring=Math.round(size*(short?.27:.34)),q=Math.round(ring*.56),logo=Math.max(28,Math.min(84,Math.floor((width-48)/9),Math.floor(height/(short?8:7))));
 return <Animated.View style={[StyleSheet.absoluteFill,s.root,{opacity:exit}]}>
  <Pressable accessibilityRole="button" accessibilityLabel="Tap to begin Questbound" onPress={begin} style={[s.fill,short&&{gap:8,padding:12}]}>
   <View dataSet={{qb:'launch-glow'}} style={[StyleSheet.absoluteFill,s.passThrough]}/>
   <View dataSet={{qb:'rays'}} style={[StyleSheet.absoluteFill,s.passThrough]}/>
   <View dataSet={{qb:'embers'}} style={[StyleSheet.absoluteFill,s.passThrough]}/>
   <View dataSet={{qb:'grain'}} style={[StyleSheet.absoluteFill,s.passThrough]}/>
   <Animated.View style={{marginVertical:Math.round(ring*.2),opacity:emblem,transform:[{scale:emblem.interpolate({inputRange:[0,1],outputRange:[.82,1]})}]}}>
    <View dataSet={{qb:'bezel',dir:'back'}} style={[s.bezel,{width:ring*1.42,height:ring*1.42,left:-ring*.21,top:-ring*.21}]}/>
    <View dataSet={{qb:'bezel'}} style={[s.bezel,{width:ring*1.28,height:ring*1.28,left:-ring*.14,top:-ring*.14}]}/>
    <View dataSet={{qb:'launch-ring'}} style={[s.ring,{width:ring,height:ring,borderRadius:ring/2}]}>
     <View style={[s.inner,{width:ring-18,height:ring-18,borderRadius:(ring-18)/2}]}/>
     <Text dataSet={{qb:'title'}} style={[s.q,{fontSize:q,lineHeight:Math.round(q*1.15)}]}>Q</Text>
    </View>
   </Animated.View>
   <Animated.View style={{alignItems:'center',opacity:title,transform:[{translateY:title.interpolate({inputRange:[0,1],outputRange:[14,0]})}]}}>
    <Text style={s.eyebrow}>A tabletop adventure</Text>
    <Text dataSet={{qb:'title',glow:'on'}} style={[s.logo,{fontSize:logo,lineHeight:Math.round(logo*1.22)}]}>Questbound</Text>
    <Text style={s.tagline}>Stories worth rolling for.</Text>
   </Animated.View>
   <Animated.View style={[s.promptWrap,short&&{marginTop:6},{opacity:prompt}]}>
    <Text dataSet={{qb:armed?'launch-prompt':undefined}} style={s.prompt}>{ready?'Tap anywhere to begin':'Opening the tome…'}</Text>
    <Text style={s.hint}>Best with sound · headphones recommended</Text>
   </Animated.View>
  </Pressable>
 </Animated.View>;
}
const s=StyleSheet.create({
 root:{zIndex:100,backgroundColor:colors.ink},passThrough:{pointerEvents:'none'},fill:{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:18,overflow:'hidden'},
 ring:{borderWidth:2,borderColor:colors.gold,alignItems:'center',justifyContent:'center'},bezel:{position:'absolute',pointerEvents:'none'},inner:{position:'absolute',borderWidth:1,borderColor:tint('rgba(178,34,58,.45)')},
 q:{fontFamily:fonts.logo,fontWeight:'900',color:colors.gold,textAlign:'center'},
 eyebrow:{fontFamily:fonts.display,fontSize:11,letterSpacing:5,color:colors.goldMid,textTransform:'uppercase',marginBottom:6},
 logo:{fontFamily:fonts.logo,fontWeight:'900',letterSpacing:5,color:colors.gold,textAlign:'center'},
 tagline:{fontFamily:fonts.story,fontStyle:'italic',fontSize:19,color:'#decfc8',marginTop:4},
 promptWrap:{alignItems:'center',marginTop:26,gap:8},prompt:{fontFamily:fonts.display,fontSize:13,fontWeight:'700',letterSpacing:4,color:colors.parchment,textTransform:'uppercase'},
 hint:{fontFamily:fonts.ui,fontSize:11.5,color:colors.faint,letterSpacing:.5},
});
