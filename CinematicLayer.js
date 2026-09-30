import React,{useCallback,useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,StyleSheet,Platform,AccessibilityInfo,useWindowDimensions} from 'react-native';
import {useCue} from './cinematics';
import {displayState} from './fullscreen';
import {playSound} from './audio';
import Icon from './Icon';
import {fonts,colors} from './theme';
// Screen-wide moments laid over the game: a red pulse when you are hit, a gold flare on a critical, a banner sweeping in
// for each new round, and title cards for victory, defeat and a level gained. Flashes never take input; a title card
// can be tapped away and leaves by itself after a few seconds.
const web=Platform.OS==='web';
export default function CinematicLayer({levelReady=false}){
 const [flash,setFlash]=useState(null),[banner,setBanner]=useState(null),[finale,setFinale]=useState(null),[area,setArea]=useState(null),[burst,setBurst]=useState(null),timers=useRef([]),reduce=useRef(false),{width}=useWindowDimensions();
 useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(v=>{reduce.current=v;}).catch(()=>{});const t=timers.current;return()=>t.forEach(clearTimeout);},[]);
 const later=(fn,ms)=>{timers.current.push(setTimeout(fn,ms));};
 const handler=useCallback(event=>{
  if(!web)return;
  if(['hurt','crit','heal'].includes(event.kind)){if(!displayState().screenEffects)return;setFlash({kind:event.kind,id:event.id});later(()=>setFlash(f=>f?.id===event.id?null:f),1000);if(event.kind==='crit'){setBurst({id:event.id});later(()=>setBurst(b=>b?.id===event.id?null:b),1000);}return;}
  // Arriving somewhere (or a new tale beginning) names the place in large letters, then fades; it never takes input.
  if(event.kind==='area'){playSound('arrive');setArea({...event});later(()=>setArea(a=>a?.id===event.id?null:a),3700);return;}
  if(event.kind==='round'){playSound('round');setBanner({id:event.id,title:'Round '+event.round,sub:event.sub??'Roll for it'});later(()=>setBanner(b=>b?.id===event.id?null:b),1950);return;}
  if(['victory','defeat','levelup','complete'].includes(event.kind)){if(event.kind==='levelup')playSound('levelup');setBanner(null);setArea(null);setFinale({...event});later(()=>setFinale(f=>f?.id===event.id?null:f),event.kind==='levelup'?3600:3400);}
 },[]);
 useCue(handler);
 const dismiss=()=>{setFinale(null);};
 const dark=finale?.kind==='defeat';
 const card=finale&&{victory:{icon:'crown',over:'The dust settles',title:'Victory',sub:finale.sub},complete:{icon:'star',over:'Your tale is told',title:'Adventure complete',sub:finale.sub},defeat:{icon:'skull',over:'Darkness takes you',title:'Defeated',sub:finale.sub},levelup:{icon:'star',over:'Your legend grows',title:'Level '+finale.level,sub:finale.sub}}[finale.kind];
 return <View style={[StyleSheet.absoluteFill,s.layer,{pointerEvents:'box-none'}]}>
  {!!flash&&<View key={flash.id} dataSet={{qb:'flash-'+flash.kind}} style={[StyleSheet.absoluteFill,s.none]}/>}
  {!!burst&&<View key={'burst'+burst.id} style={[StyleSheet.absoluteFill,s.none,s.center]}><Text dataSet={{qb:'burst-text',lig:'off'}} style={[s.burst2,{fontSize:fit('Critical hit!',width,60,.75)}]}>Critical hit!</Text></View>}
  {!!banner&&<View key={banner.id} style={[StyleSheet.absoluteFill,s.none,s.center]} accessibilityLiveRegion="polite">
   <View dataSet={{qb:'cine-band'}} style={s.band}>
    <View dataSet={{qb:'cine-rule'}} style={s.bandRule}/>
    <Text dataSet={{qb:'cine-text'}} style={s.bandTitle}>{banner.title}</Text>
    <Text style={s.bandSub}>{banner.sub}</Text>
    <View dataSet={{qb:'cine-rule'}} style={s.bandRule}/>
   </View>
  </View>}
  {!!area&&<View key={area.id} dataSet={{qb:'area'}} style={[StyleSheet.absoluteFill,s.none,s.center]} accessibilityLiveRegion="polite">
   <View style={s.area}>
    <Text style={s.areaOver}>{area.over}</Text>
    <Text dataSet={{qb:'title',lig:'off'}} style={[s.areaTitle,{fontSize:fit(area.title,width,52,.7),lineHeight:Math.round(fit(area.title,width,52,.7)*1.2)}]}>{area.title}</Text>
    <View style={s.areaRule}><View dataSet={{qb:'rule-left'}} style={s.areaLine}/><View style={s.lozenge}/><View dataSet={{qb:'rule-right'}} style={s.areaLine}/></View>
    {!!area.sub&&<Text style={s.areaSub}>{area.sub}</Text>}
   </View>
  </View>}
  {!!card&&<Pressable key={finale.id} accessibilityRole="button" accessibilityLabel={card.title+'. Tap to continue.'} onPress={dismiss} dataSet={{qb:'finale'}} style={[StyleSheet.absoluteFill,s.center,{backgroundColor:dark?'rgba(10,2,2,.84)':'rgba(4,5,8,.78)'}]}>
   <View dataSet={{qb:'finale-burst',tone:dark?'dark':'gold'}} style={s.burst}/>
   {!dark&&<View dataSet={{qb:'rays-spin'}} style={s.burst}/>}
   <View dataSet={{qb:'finale-card'}} style={s.card}>
    <View style={[s.emblem,dark&&{borderColor:'rgba(220,90,70,.8)'}]}><Icon name={card.icon} size={34} color={dark?'#ff9f86':colors.goldBright}/></View>
    <Text style={[s.over,dark&&{color:'#d99a8a'}]}>{card.over}</Text>
    <Text dataSet={{qb:dark?undefined:'title',sheen:'on',lig:'off'}} style={[s.title,{fontSize:fit(card.title,width,56,.78),lineHeight:Math.round(fit(card.title,width,56,.78)*1.25)},dark&&{color:'#f0c6b8'}]}>{card.title}</Text>
    <View style={[s.rule,dark&&{backgroundColor:'rgba(220,90,70,.6)'}]}/>
    {!!card.sub&&<Text style={s.sub}>{card.sub}</Text>}
    {finale.kind==='victory'&&levelReady&&<View dataSet={{qb:'btn-primary'}} style={s.reward}><Icon name="star" size={14} color="#2a1a07"/><Text style={s.rewardText}>A new level awaits</Text></View>}
    <Text style={s.tap}>Tap to continue</Text>
   </View>
  </Pressable>}
 </View>;
}
// Largest size (up to max) at which a title fits the screen width on one line, roughly.
const fit=(text,width,max,em)=>Math.max(26,Math.min(max,Math.floor((width-48)/Math.max(4,String(text).length*em))));
const s=StyleSheet.create({
 burst2:{fontFamily:fonts.logo,fontWeight:'900',color:colors.goldBright,letterSpacing:2,textAlign:'center',...(web?{textShadow:'0 0 28px rgba(236,170,84,.9),0 3px 0 rgba(40,20,4,.9)'}:{})},
 area:{alignItems:'center',paddingHorizontal:40,paddingVertical:34,maxWidth:'100%'},
 areaOver:{fontFamily:fonts.display,fontSize:12,letterSpacing:5,color:'#e2c890',textTransform:'uppercase',textAlign:'center',...(web?{textShadow:'0 2px 8px rgba(0,0,0,.9)'}:{})},
 areaTitle:{fontFamily:fonts.logo,fontWeight:'900',color:colors.gold,textAlign:'center',letterSpacing:3,marginTop:6},
 areaRule:{flexDirection:'row',alignItems:'center',gap:10,width:280,maxWidth:'80%',marginVertical:10},areaLine:{flex:1,height:1},lozenge:{width:7,height:7,backgroundColor:colors.gold,transform:[{rotate:'45deg'}]},
 areaSub:{fontFamily:fonts.story,fontStyle:'italic',fontSize:18,color:'#eadfc6',textAlign:'center',...(web?{textShadow:'0 2px 8px rgba(0,0,0,.9)'}:{})},
 layer:{zIndex:60},none:{pointerEvents:'none'},center:{alignItems:'center',justifyContent:'center'},
 band:{width:'100%',paddingVertical:18,alignItems:'center',gap:6},
 bandRule:{width:'46%',maxWidth:420,height:1,backgroundColor:'rgba(232,199,123,.75)'},
 bandTitle:{fontFamily:fonts.display,fontSize:34,fontWeight:'800',color:colors.goldBright,textTransform:'uppercase',letterSpacing:8,textAlign:'center',...(web?{textShadow:'0 0 24px rgba(236,170,84,.6)'}:{})},
 bandSub:{fontFamily:fonts.story,fontStyle:'italic',fontSize:17,color:'#e9dcbd'},
 burst:{position:'absolute',width:900,height:900,borderRadius:450,pointerEvents:'none'},
 card:{alignItems:'center',paddingHorizontal:28,maxWidth:520},
 emblem:{width:76,height:76,borderRadius:38,borderWidth:1.5,borderColor:colors.gold,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(12,10,6,.8)',marginBottom:14},
 over:{fontFamily:fonts.display,fontSize:12,letterSpacing:5,color:colors.goldMid,textTransform:'uppercase'},
 title:{fontFamily:fonts.logo,fontWeight:'900',color:colors.gold,letterSpacing:3,textAlign:'center',marginVertical:4},
 rule:{width:180,height:1,backgroundColor:'rgba(232,199,123,.7)',marginVertical:10},
 sub:{fontFamily:fonts.story,fontStyle:'italic',fontSize:19,lineHeight:27,color:'#eadfc6',textAlign:'center'},
 reward:{flexDirection:'row',alignItems:'center',gap:8,marginTop:16,paddingHorizontal:16,paddingVertical:8,borderRadius:18,borderWidth:1,borderColor:'#fff0c4',backgroundColor:'#d9ae5f'},rewardText:{fontFamily:fonts.display,fontSize:12,fontWeight:'800',letterSpacing:1.6,color:'#2a1a07',textTransform:'uppercase'},
 tap:{fontFamily:fonts.display,fontSize:10,letterSpacing:3,color:colors.faint,textTransform:'uppercase',marginTop:18},
});
