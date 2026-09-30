import React,{useState,useEffect,useRef} from 'react';
import {View,Text as PlainText,Pressable,ScrollView,StyleSheet,AccessibilityInfo,Animated,Platform,useWindowDimensions} from 'react-native';
import {EntityText as Text} from './EncounterOverlay';
import {fonts,colors} from './theme';
import {playSound} from './audio';
import {eventSounds} from './feedSounds';
const labels={player:'YOU',initiative:'INITIATIVE',roll:'DICE & RESULTS',action:'ACTION',effect:'EFFECT',narration:'DUNGEON MASTER'};
const glyphs={player:'❯',initiative:'⚔',roll:'⬢',action:'✦',effect:'✧',narration:'❦',dialogue:'❝'};
const feed={player:'feed-player',initiative:'feed-roll',roll:'feed-roll',effect:'feed-effect',dialogue:'feed-dialogue'};
const native=Platform.OS!=='web';
function EventRow({event,reduceMotion,sound,me}){
 useEffect(()=>{if(sound)eventSounds(event).forEach(([name,delay=0,options])=>playSound(name,delay,options));},[]);
 const opacity=useRef(new Animated.Value(reduceMotion?1:0)).current,rise=useRef(new Animated.Value(reduceMotion?0:8)).current;
 useEffect(()=>{if(reduceMotion){opacity.setValue(1);rise.setValue(0);return;}const animation=Animated.parallel([Animated.timing(opacity,{toValue:1,duration:320,useNativeDriver:native}),Animated.timing(rise,{toValue:0,duration:320,useNativeDriver:native})]);animation.start();return()=>animation.stop();},[reduceMotion]);
 const prose=['narration','dialogue'].includes(event.kind),dice=['roll','initiative'].includes(event.kind);
 return <Animated.View dataSet={{qb:feed[event.kind]??'feed'}} style={[s.event,dice&&s.roll,event.kind==='effect'&&s.effect,event.kind==='player'&&s.player,event.kind==='dialogue'&&s.dialogue,event.kind==='narration'&&s.narration,{opacity,transform:[{translateY:rise}]}]}>
  <PlainText style={[s.label,event.kind==='dialogue'&&s.speaker,dice&&s.diceLabel,event.kind==='effect'&&{color:'#8fd8cc'},event.kind==='player'&&{color:'#a9bdf0'}]}>{glyphs[event.kind]??'✦'}  {event.kind==='dialogue'?(event.speakerName??'Dungeon Master').toUpperCase():event.kind==='player'&&event.speakerName&&event.speakerName!==me?event.speakerName.toUpperCase():labels[event.kind]}</PlainText>
  <Text style={[s.text,prose&&s.prose,event.kind==='dialogue'&&s.quote,dice&&s.diceText]}>{event.kind==='dialogue'?'“'+event.text.replace(/^[“"]|[”"]$/g,'')+'”':event.text}</Text>
 </Animated.View>;
}
export default function TurnPlayback({turns=[],animateId,onPlayingChange,opening,busy,me=null,fill=false,aside=null}){
 const turn=turns.at(-1),[phase,setPhase]=useState({id:null,count:0}),[history,setHistory]=useState(false),[reduceMotion,setReduceMotion]=useState(false),scroll=useRef(null),follow=useRef(true),{height,width}=useWindowDimensions();
 const count=turn?(phase.id===turn.id?phase.count:turn.id===animateId&&!reduceMotion?1:turn.events.length):0;
 const playing=!!turn&&count<turn.events.length;
 const feedLimit=width<600?Math.max(150,Math.min(260,height*.3)):Math.max(230,Math.min(400,height*.43));
 useEffect(()=>{let mounted=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(mounted)setReduceMotion(v);});const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return()=>{mounted=false;subscription.remove();};},[]);
 useEffect(()=>{
  if(!turn)return;
  follow.current=true;if(!fill)scroll.current?.scrollTo({y:0,animated:false});
  setPhase({id:turn.id,count:turn.id===animateId&&!reduceMotion?1:turn.events.length});
  if(turn.id!==animateId||reduceMotion)return;
  const timer=setInterval(()=>setPhase(p=>{const count=Math.min(turn.events.length,p.count+1);if(count===turn.events.length)clearInterval(timer);return {id:turn.id,count};}),850);
  return()=>clearInterval(timer);
 },[turn?.id,animateId,reduceMotion]);
 useEffect(()=>{onPlayingChange(playing);return()=>onPlayingChange(false);},[playing,onPlayingChange]);
 // Fill mode: one continuous chronicle. Earlier turns sit above; the newest plays out at the bottom and the view follows it.
 if(fill)return <View style={s.fillPanel}>
  <View style={s.fillBar}><PlainText style={[s.title,{marginVertical:4}]}>{busy?'Resolving your action…':playing?'Playing out the turn…':turn?'Chronicle · Turn '+turn.id:'The story'}</PlainText>{playing?<Pressable accessibilityRole="button" onPress={()=>setPhase({id:turn.id,count:turn.events.length})} style={s.skipInline}><PlainText style={s.link}>Show all ›</PlainText></Pressable>:aside}</View>
  <ScrollView ref={scroll} accessibilityLabel="Adventure response feed" style={s.fillScroll} contentContainerStyle={s.fillContent} scrollEventThrottle={80} onScroll={e=>{const n=e.nativeEvent;follow.current=n.contentOffset.y+n.layoutMeasurement.height>=n.contentSize.height-80;}} onContentSizeChange={()=>{if(follow.current)scroll.current?.scrollToEnd({animated:!reduceMotion});}}>
   {!turn&&<Text style={s.opening}>{opening}</Text>}
   {turns.slice(0,-1).map(t=><View key={t.id} style={s.pastTurn}><PlainText style={s.divider}>— Turn {t.id} —</PlainText>{t.events.map((e,i)=><EventRow key={t.id+'-'+i} event={e} reduceMotion me={me}/>)}</View>)}
   {turn&&<View accessibilityLiveRegion="polite">{turns.length>1&&<PlainText style={s.divider}>— Turn {turn.id} —</PlainText>}{turn.events.slice(0,count).map((e,i)=><EventRow key={turn.id+'-'+i} event={e} reduceMotion={reduceMotion||turn.id!==animateId} sound={turn.id===animateId} me={me}/>)}</View>}
  </ScrollView>
 </View>;
 return <View style={s.panel}>
 <View style={s.header}><PlainText style={s.title}>{busy?'Resolving your action…':playing?'Playing out the turn…':turn?'Turn '+turn.id:'THE STORY'}</PlainText><View style={s.skipSlot}>{playing&&<Pressable accessibilityRole="button" onPress={()=>setPhase({id:turn.id,count:turn.events.length})} style={s.skip}><PlainText style={s.link}>Show all now</PlainText></Pressable>}</View></View>
 <ScrollView ref={scroll} accessibilityLabel="Adventure response feed" style={[s.scroll,{maxHeight:feedLimit,...(playing?{minHeight:feedLimit}:{})}]} nestedScrollEnabled scrollEventThrottle={80} onScroll={e=>{const n=e.nativeEvent;follow.current=n.contentOffset.y+n.layoutMeasurement.height>=n.contentSize.height-60;}} onContentSizeChange={()=>{if(follow.current&&turn?.id===animateId)scroll.current?.scrollToEnd({animated:!reduceMotion});}}>
 <View accessibilityLiveRegion="polite">{turn?turn.events.slice(0,count).map((e,i)=><EventRow key={turn.id+'-'+i} event={e} reduceMotion={reduceMotion||turn.id!==animateId} sound={turn.id===animateId} me={me}/>):<Text style={s.opening}>{opening}</Text>}</View>
 </ScrollView>
 {turns.length>1&&<View style={s.historyToggle}><Pressable accessibilityRole="button" accessibilityState={{expanded:history}} onPress={()=>setHistory(v=>!v)} style={s.skip}><PlainText style={s.link}>{history?'Hide earlier turns':'Earlier turns ('+(turns.length-1)+')'}</PlainText></Pressable></View>}
 {history&&turns.length>1&&<ScrollView style={s.history} nestedScrollEnabled>{turns.slice(0,-1).map(t=><View key={t.id}><PlainText style={s.title}>Turn {t.id}</PlainText>{t.events.map((e,i)=><EventRow key={t.id+'-'+i} event={e} reduceMotion me={me}/>)}</View>)}</ScrollView>}
 </View>;
}
const s=StyleSheet.create({panel:{marginBottom:6},
 fillPanel:{flex:1,minHeight:0},fillBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:30},skipInline:{paddingHorizontal:6,minHeight:30,justifyContent:'center'},
 fillScroll:{flex:1,minHeight:0,overscrollBehavior:'contain'},fillContent:{paddingBottom:8},
 pastTurn:{opacity:.82},divider:{fontFamily:fonts.display,color:'rgba(201,164,92,.6)',fontSize:10,letterSpacing:2.4,textAlign:'center',marginVertical:10,textTransform:'uppercase'},header:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},skipSlot:{minWidth:95,height:44},historyToggle:{height:44},
 title:{flexShrink:1,fontFamily:fonts.display,color:colors.goldMid,fontSize:11,fontWeight:'700',letterSpacing:2.4,textTransform:'uppercase',marginVertical:10},
 scroll:{flexGrow:0,overscrollBehavior:'auto',overflowAnchor:'none'},history:{maxHeight:320},
 opening:{fontFamily:fonts.story,color:'#efe7d4',fontSize:19,lineHeight:31,paddingVertical:12},
 event:{borderLeftWidth:2,borderColor:'rgba(201,164,92,.35)',paddingVertical:12,paddingHorizontal:14,marginBottom:8,backgroundColor:'rgba(14,19,29,.7)',borderRadius:2},
 narration:{borderColor:'rgba(232,199,123,.55)',backgroundColor:'transparent',paddingLeft:16},
 dialogue:{borderColor:'#d59a55'},
 roll:{borderColor:colors.gold},effect:{borderColor:'#6fd0c4'},player:{borderColor:'#8ea6e6',marginLeft:24},
 label:{fontFamily:fonts.display,color:'#b9a787',fontSize:10,fontWeight:'700',letterSpacing:1.8,marginBottom:7},
 speaker:{color:'#f0c690',fontSize:11},diceLabel:{color:colors.gold},
 text:{fontFamily:fonts.ui,color:'#e2e6ec',fontSize:14,lineHeight:23},
 prose:{fontFamily:fonts.story,fontSize:18,lineHeight:28,color:'#efe7d4'},
 quote:{fontStyle:'italic',color:'#f6ead0'},
 diceText:{fontFamily:fonts.ui,fontSize:13.5,color:'#f3e6c6',fontVariant:['tabular-nums']},
 skip:{paddingVertical:12,paddingHorizontal:6,minHeight:44},link:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'}});
