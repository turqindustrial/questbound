import React,{createContext,useContext,useRef,useState,useEffect} from 'react';
import {View,Text,Pressable,Modal,StyleSheet,ActivityIndicator,Image,ScrollView,useWindowDimensions} from 'react-native';
import {ensureArt,artIdentity} from './artClient';
import {fonts} from './theme';
const Context=createContext(null),decoded=new Set();
export const useSceneTransition=()=>useContext(Context);
export default function SceneTransitionProvider({children}){
 const {height}=useWindowDimensions();
 const [state,setState]=useState(null),active=useRef(null),alive=useRef(true),last=useRef(null);
 if(state)last.current=state;const display=state??last.current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.reject(Error('Scene preparation ended before it was applied.'));active.current=null;};},[]);
 async function load(job,retry){
  if(job.running)return;job.running=true;let completed=0;
  setState({total:job.subjects.length,completed:0,error:null});
  try{
   const results=await Promise.allSettled(job.subjects.map(async subject=>{const data=await ensureArt(subject,{retry});if(active.current!==job)return;await Image.prefetch(data);decoded.add(artIdentity(subject));completed++;if(alive.current&&active.current===job)setState({total:job.subjects.length,completed,error:null});}));
   if(active.current!==job)return;const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;active.current=null;last.current={total:job.subjects.length,completed:job.subjects.length,error:null};setState(null);job.resolve();
  }catch(error){if(active.current===job&&alive.current)setState({total:job.subjects.length,completed,error:error.message});}
  finally{job.running=false;}
 }
 function prepare(subjects){
  const unique=[...new Map(subjects.filter(Boolean).map(s=>[artIdentity(s),s])).values()].filter(s=>!decoded.has(artIdentity(s)));
  if(!unique.length)return Promise.resolve();
  if(active.current)return Promise.reject(Error('A scene is already being prepared.'));
  return new Promise((resolve,reject)=>{const job={subjects:unique,resolve,reject,running:false};active.current=job;void load(job,false);});
 }
 function cancel(){const job=active.current;active.current=null;setState(null);job?.reject(Error('Scene preparation cancelled. Your action was not applied.'));}
 const progress=display?.total?Math.round(100*(display.completed??0)/display.total):0;
 return <Context.Provider value={{prepare}}>{children}<Modal transparent visible={!!state} animationType="fade" onRequestClose={cancel}><View style={s.shade}><View dataSet={{qb:'panel'}} style={[s.panel,{maxHeight:Math.max(180,height-32)}]} accessibilityViewIsModal><ScrollView style={{flexShrink:1}} contentContainerStyle={{gap:14,alignItems:'stretch'}}><Text style={s.overline}>{display?.error?'A moment, traveler':'The world takes shape'}</Text><Text accessibilityRole="header" style={s.title}>{display?.error?'The scene isn’t ready yet':'Preparing the next scene'}</Text>{!display?.error&&<ActivityIndicator color="#e8c77b" size="large"/>}{!display?.error&&<View style={s.track}><View dataSet={{qb:'bar-hp'}} style={[s.fill,{width:Math.max(6,progress)+'%'}]}/></View>}<Text accessibilityLiveRegion="polite" style={s.text}>{display?.error??'Painting the scene… '+display?.completed+' of '+display?.total+' illustrations ready'}</Text><Text style={s.note}>Your current scene stays in place until every image is ready.</Text>{!!display?.error&&<Pressable accessibilityRole="button" dataSet={{qb:'btn-primary'}} onPress={()=>active.current&&load(active.current,true)} style={[s.button,s.primary]}><Text style={[s.label,{color:'#2a1a07'}]}>Retry illustrations</Text></Pressable>}<Pressable accessibilityRole="button" dataSet={{qb:'btn'}} onPress={cancel} style={s.button}><Text style={s.label}>Stay here</Text></Pressable></ScrollView></View></View></Modal></Context.Provider>;
}
const s=StyleSheet.create({shade:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(2,3,6,.8)',padding:24},panel:{width:'100%',maxWidth:460,padding:28,borderRadius:4,backgroundColor:'rgba(13,17,26,.98)',borderWidth:1,borderColor:'rgba(201,164,92,.45)',gap:14},
 overline:{fontFamily:fonts.display,color:'#c9a45c',fontSize:10,fontWeight:'700',letterSpacing:3,textTransform:'uppercase',textAlign:'center'},
 title:{color:'#f1e6cc',fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,fontSize:23,textAlign:'center'},
 track:{height:8,borderRadius:2,backgroundColor:'rgba(0,0,0,.55)',borderWidth:1,borderColor:'rgba(201,164,92,.35)',overflow:'hidden'},fill:{height:'100%',backgroundColor:'#e8c77b'},
 text:{fontFamily:fonts.ui,color:'#d8dde6',fontSize:14,lineHeight:22,textAlign:'center'},note:{fontFamily:fonts.ui,color:'#8f98aa',fontSize:12,lineHeight:20,textAlign:'center'},
 button:{padding:12,minHeight:46,borderWidth:1,borderColor:'rgba(201,164,92,.4)',borderRadius:3,backgroundColor:'#1a202d',justifyContent:'center'},primary:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},
 label:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1.6,fontSize:13,textTransform:'uppercase',color:'#ecd4aa',textAlign:'center'}});
