import React,{createContext,useContext,useRef,useState,useEffect} from 'react';
import {View,Text,Pressable,Modal,StyleSheet,ActivityIndicator,Image,ScrollView,useWindowDimensions} from 'react-native';
import {ensureArt,artIdentity} from './artClient';
import Icon from './Icon';
import {fonts,colors} from './theme';
const Context=createContext(null),decoded=new Set();
export const useSceneTransition=()=>useContext(Context);
// A scene waits briefly for its illustrations so it usually arrives fully painted, but never holds play hostage:
// after a few seconds (or "Continue now") the story moves on and unfinished art fades in by itself when it's ready.
// Art that fails shows its own retry button where it appears.
const GRACE=5000,SHOW_AFTER=600;
const kindIcons={landscape:'map',portrait:'sheet',creature:'swords'};
export default function SceneTransitionProvider({children}){
 const {height}=useWindowDimensions();
 const [state,setState]=useState(null),active=useRef(null),alive=useRef(true),last=useRef(null);
 if(state)last.current=state;const display=state??last.current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.finish();active.current=null;};},[]);
 function prepare(subjects){
  const unique=[...new Map(subjects.filter(Boolean).map(s=>[artIdentity(s),s])).values()].filter(s=>!decoded.has(artIdentity(s)));
  if(!unique.length)return Promise.resolve();
  return new Promise(resolve=>{
   const items=unique.map(s=>({key:artIdentity(s),name:s.name,kind:s.kind,done:false}));
   const job={total:unique.length,completed:0,done:false};
   const snapshot=()=>({total:job.total,completed:job.completed,items:items.map(i=>({...i}))});
   job.finish=()=>{if(job.done)return;job.done=true;clearTimeout(job.timer);clearTimeout(job.show);if(active.current===job){active.current=null;if(alive.current)setState(null);}resolve();};
   active.current=job;
   job.show=setTimeout(()=>{if(!job.done&&alive.current&&active.current===job)setState(snapshot());},SHOW_AFTER);
   job.timer=setTimeout(job.finish,GRACE);
   unique.forEach((subject,index)=>ensureArt(subject).then(data=>Image.prefetch(data).catch(()=>{})).then(()=>decoded.add(artIdentity(subject)),()=>{}).finally(()=>{
    job.completed++;items[index].done=true;
    if(!job.done&&alive.current&&active.current===job)setState(current=>current?snapshot():current);
    if(job.completed===job.total)job.finish();
   }));
  });
 }
 const proceed=()=>active.current?.finish();
 const progress=display?.total?Math.round(100*(display.completed??0)/display.total):0;
 const place=display?.items?.find(i=>i.kind==='landscape')?.name;
 return <Context.Provider value={{prepare}}>{children}<Modal transparent visible={!!state} animationType="fade" onRequestClose={proceed}><View dataSet={{qb:'scrim'}} style={s.shade}><View style={[s.panel,{maxHeight:Math.max(180,height-32)}]} accessibilityViewIsModal><ScrollView style={{flexShrink:1}} contentContainerStyle={s.content}>
  <View style={s.ring}><ActivityIndicator color="#e8c77b" size="large"/></View>
  <Text style={s.overline}>The world takes shape</Text>
  <Text accessibilityRole="header" style={s.title}>{place??'Preparing the next scene'}</Text>
  <View style={s.rule}><View dataSet={{qb:'rule-left'}} style={s.ruleLine}/><View style={s.lozenge}/><View dataSet={{qb:'rule-right'}} style={s.ruleLine}/></View>
  <View style={s.items}>{(display?.items??[]).map(item=><View key={item.key} style={s.item}>
   <Icon name={kindIcons[item.kind]??'star'} size={15} color={item.done?colors.gold:colors.faint}/>
   <Text numberOfLines={1} style={[s.itemName,item.done&&{color:colors.parchment}]}>{item.name}</Text>
   {item.done?<Icon name="check" size={15} color={colors.heal}/>:<ActivityIndicator size="small" color="#8d96a8"/>}
  </View>)}</View>
  <View style={s.track}><View dataSet={{qb:'shimmer'}} style={[s.fill,{width:Math.max(8,progress)+'%'}]}/></View>
  <Text accessibilityLiveRegion="polite" style={s.note}>{display?.completed??0} of {display?.total??0} illustrations painted · the story continues in a moment</Text>
  <Pressable accessibilityRole="button" onPress={proceed} style={s.button}><Text style={s.label}>Continue now</Text><Icon name="forward" size={14} color={colors.gold}/></Pressable>
 </ScrollView></View></View></Modal></Context.Provider>;
}
const s=StyleSheet.create({shade:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(3,4,7,.86)',padding:24},
 panel:{width:'100%',maxWidth:440},content:{alignItems:'center',paddingVertical:8},
 ring:{width:64,height:64,borderRadius:32,borderWidth:1,borderColor:'rgba(232,199,123,.45)',alignItems:'center',justifyContent:'center',marginBottom:16,backgroundColor:'rgba(20,16,10,.6)'},
 overline:{fontFamily:fonts.display,color:'#c9a45c',fontSize:10.5,fontWeight:'700',letterSpacing:4,textTransform:'uppercase',textAlign:'center'},
 title:{color:'#f5ead0',fontFamily:fonts.display,fontWeight:'700',letterSpacing:1.2,fontSize:26,lineHeight:33,textAlign:'center',marginTop:8},
 rule:{flexDirection:'row',alignItems:'center',gap:8,width:'70%',marginVertical:16},ruleLine:{flex:1,height:1},lozenge:{width:7,height:7,backgroundColor:colors.gold,transform:[{rotate:'45deg'}]},
 items:{alignSelf:'stretch',gap:8,marginBottom:18},item:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,paddingVertical:8,borderRadius:6,borderWidth:1,borderColor:'rgba(201,164,92,.18)',backgroundColor:'rgba(14,18,27,.7)'},
 itemName:{flex:1,fontFamily:fonts.story,fontSize:16,color:'#9aa2b2'},
 track:{alignSelf:'stretch',height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,.08)',overflow:'hidden'},fill:{height:'100%',backgroundColor:'#e8c77b'},
 note:{fontFamily:fonts.ui,color:'#8f98aa',fontSize:12,lineHeight:19,textAlign:'center',marginTop:12},
 button:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:10,paddingHorizontal:14,minHeight:44,marginTop:8,justifyContent:'center'},
 label:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:2,fontSize:12,textTransform:'uppercase',color:colors.gold,textAlign:'center'}});
