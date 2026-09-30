import React,{createContext,useContext,useRef,useState,useEffect} from 'react';
import {View,Text,Pressable,Modal,StyleSheet,ActivityIndicator,Image,ScrollView,useWindowDimensions} from 'react-native';
import {ensureArt,artIdentity} from './artClient';
import {fonts} from './theme';
const Context=createContext(null),decoded=new Set();
export const useSceneTransition=()=>useContext(Context);
// A scene waits briefly for its illustrations so it usually arrives fully painted, but never holds play hostage:
// after a few seconds (or "Continue now") the story moves on and unfinished art fades in by itself when it's ready.
// Art that fails shows its own retry button where it appears.
const GRACE=5000,SHOW_AFTER=600;
export default function SceneTransitionProvider({children}){
 const {height}=useWindowDimensions();
 const [state,setState]=useState(null),active=useRef(null),alive=useRef(true),last=useRef(null);
 if(state)last.current=state;const display=state??last.current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.finish();active.current=null;};},[]);
 function prepare(subjects){
  const unique=[...new Map(subjects.filter(Boolean).map(s=>[artIdentity(s),s])).values()].filter(s=>!decoded.has(artIdentity(s)));
  if(!unique.length)return Promise.resolve();
  return new Promise(resolve=>{
   const job={total:unique.length,completed:0,done:false};
   job.finish=()=>{if(job.done)return;job.done=true;clearTimeout(job.timer);clearTimeout(job.show);if(active.current===job){active.current=null;if(alive.current)setState(null);}resolve();};
   active.current=job;
   job.show=setTimeout(()=>{if(!job.done&&alive.current&&active.current===job)setState({total:job.total,completed:job.completed});},SHOW_AFTER);
   job.timer=setTimeout(job.finish,GRACE);
   for(const subject of unique)ensureArt(subject).then(data=>Image.prefetch(data).catch(()=>{})).then(()=>decoded.add(artIdentity(subject)),()=>{}).finally(()=>{
    job.completed++;
    if(!job.done&&alive.current&&active.current===job)setState(current=>current?{...current,completed:job.completed}:current);
    if(job.completed===job.total)job.finish();
   });
  });
 }
 const proceed=()=>active.current?.finish();
 const progress=display?.total?Math.round(100*(display.completed??0)/display.total):0;
 return <Context.Provider value={{prepare}}>{children}<Modal transparent visible={!!state} animationType="fade" onRequestClose={proceed}><View style={s.shade}><View dataSet={{qb:'panel'}} style={[s.panel,{maxHeight:Math.max(180,height-32)}]} accessibilityViewIsModal><ScrollView style={{flexShrink:1}} contentContainerStyle={{gap:14,alignItems:'stretch'}}><Text style={s.overline}>The world takes shape</Text><Text accessibilityRole="header" style={s.title}>Preparing the next scene</Text><ActivityIndicator color="#e8c77b" size="large"/><View style={s.track}><View dataSet={{qb:'bar-hp'}} style={[s.fill,{width:Math.max(6,progress)+'%'}]}/></View><Text accessibilityLiveRegion="polite" style={s.text}>Painting the scene… {display?.completed??0} of {display?.total??0} illustrations ready</Text><Text style={s.note}>The story continues in a moment; anything still being painted appears when it’s ready.</Text><Pressable accessibilityRole="button" dataSet={{qb:'btn'}} onPress={proceed} style={s.button}><Text style={s.label}>Continue now</Text></Pressable></ScrollView></View></View></Modal></Context.Provider>;
}
const s=StyleSheet.create({shade:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(2,3,6,.8)',padding:24},panel:{width:'100%',maxWidth:460,padding:28,borderRadius:4,backgroundColor:'rgba(13,17,26,.98)',borderWidth:1,borderColor:'rgba(201,164,92,.45)',gap:14},
 overline:{fontFamily:fonts.display,color:'#c9a45c',fontSize:10,fontWeight:'700',letterSpacing:3,textTransform:'uppercase',textAlign:'center'},
 title:{color:'#f1e6cc',fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,fontSize:23,textAlign:'center'},
 track:{height:8,borderRadius:2,backgroundColor:'rgba(0,0,0,.55)',borderWidth:1,borderColor:'rgba(201,164,92,.35)',overflow:'hidden'},fill:{height:'100%',backgroundColor:'#e8c77b'},
 text:{fontFamily:fonts.ui,color:'#d8dde6',fontSize:14,lineHeight:22,textAlign:'center'},note:{fontFamily:fonts.ui,color:'#8f98aa',fontSize:12,lineHeight:20,textAlign:'center'},
 button:{padding:12,minHeight:46,borderWidth:1,borderColor:'rgba(201,164,92,.4)',borderRadius:3,backgroundColor:'#1a202d',justifyContent:'center'},primary:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},
 label:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1.6,fontSize:13,textTransform:'uppercase',color:'#ecd4aa',textAlign:'center'}});
