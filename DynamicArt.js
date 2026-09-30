import React,{useEffect,useState} from 'react';
import {View,Text,Image,ActivityIndicator,Pressable,StyleSheet} from 'react-native';
import {subscribeArt,retryArt,artIdentity,cachedArt} from './artClient';
import {fonts,colors} from './theme';
export default function DynamicArt({subject,style,compact=false,quiet=false,statusOnly=false,resizeMode='cover',dataSet}){
 const key=subject?artIdentity(subject):null,[state,setState]=useState({status:'pending'});
 useEffect(()=>{if(!subject)return;setState({status:'pending'});return subscribeArt(subject,value=>setState({...value,key}));},[key]);
 if(!subject)return null;
 const current=state.key===key?state:cachedArt(subject)??{status:'pending'};
 if(statusOnly&&current.status==='ready')return null;
 return <View dataSet={dataSet} style={[s.frame,quiet&&{borderRadius:0},style]}>
 {current.status==='ready'?<Image dataSet={{qb:'art-img'}} source={{uri:current.dataUrl}}accessibilityLabel={(subject.kind==='landscape'?'Scene: ':'Portrait of ')+subject.name} style={StyleSheet.absoluteFillObject} resizeMode={resizeMode}/>:<View style={s.placeholder}>
 {quiet?null:current.status==='pending'?<><ActivityIndicator size="small" color="#d6b582"/>{!compact&&<Text style={s.text}>Illustrating {subject.name}…</Text>}</>:compact?<Text accessibilityLabel="Portrait unavailable" style={s.symbol}>◇</Text>:<><Text accessibilityRole="alert" style={s.text}>{current.error}</Text><Pressable accessibilityRole="button" onPress={()=>retryArt(subject)} style={s.retry}><Text style={s.retryText}>Retry illustration</Text></Pressable></>}
 </View>}
 </View>;
}
const s=StyleSheet.create({frame:{overflow:'hidden',backgroundColor:'#101520',borderRadius:4},placeholder:{flex:1,alignItems:'center',justifyContent:'center',padding:8,gap:8},text:{fontFamily:fonts.story,fontStyle:'italic',color:'#c9bfa8',fontSize:14,lineHeight:20,textAlign:'center'},symbol:{color:colors.gold,fontSize:17},retry:{padding:8,minHeight:40,justifyContent:'center'},retryText:{fontFamily:fonts.display,letterSpacing:1.2,color:colors.gold,fontSize:12}});
