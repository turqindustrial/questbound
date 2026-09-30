import React,{useEffect,useState} from 'react';
import {View,Text,Image,Pressable,StyleSheet} from 'react-native';
import {subscribeArt,retryArt,artIdentity,cachedArt} from './artClient';
import Icon from './Icon';
import {fonts,colors} from './theme';
const kindIcons={landscape:'map',portrait:'sheet',creature:'swords'};
// A painted illustration from the world-art service. While it is being painted the frame shimmers softly (with a
// caption when there is room); the finished painting fades in; a failure offers a retry where it appears.
export default function DynamicArt({subject,style,compact=false,quiet=false,statusOnly=false,resizeMode='cover',dataSet}){
 const key=subject?artIdentity(subject):null,[state,setState]=useState({status:'pending'});
 useEffect(()=>{if(!subject)return;setState({status:'pending'});return subscribeArt(subject,value=>setState({...value,key}));},[key]);
 if(!subject)return null;
 const current=state.key===key?state:cachedArt(subject)??{status:'pending'};
 if(statusOnly&&current.status==='ready')return null;
 const waiting=current.status==='pending';
 return <View dataSet={dataSet} style={[s.frame,quiet&&{borderRadius:0},style]}>
 {current.status==='ready'?<Image dataSet={{qb:'art-img'}} source={{uri:current.dataUrl}} accessibilityLabel={(subject.kind==='landscape'?'Scene: ':'Portrait of ')+subject.name} style={StyleSheet.absoluteFillObject} resizeMode={resizeMode}/>:<View dataSet={{qb:waiting&&!quiet?'art-wait':undefined}} style={s.placeholder}>
 {quiet?null:waiting?(!compact&&<View style={s.caption}><Icon name="quill" size={15} color="#d6b582"/><Text style={s.text}>Painting {subject.name}…</Text></View>):compact?<Icon name={kindIcons[subject.kind]??'star'} size={16} color={colors.goldDeep}/>:<><Text accessibilityRole="alert" style={s.text}>{current.error}</Text><Pressable accessibilityRole="button" onPress={()=>retryArt(subject)} dataSet={{qb:'chip'}} style={s.retry}><Icon name="retreat" size={14} color={colors.gold}/><Text style={s.retryText}>Retry illustration</Text></Pressable></>}
 </View>}
 </View>;
}
const s=StyleSheet.create({frame:{overflow:'hidden',backgroundColor:'#101520',borderRadius:4},placeholder:{flex:1,alignItems:'center',justifyContent:'center',padding:8,gap:8},
 caption:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:8},
 text:{fontFamily:fonts.story,fontStyle:'italic',color:'#c9bfa8',fontSize:14,lineHeight:20,textAlign:'center',flexShrink:1},
 retry:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,minHeight:38,borderRadius:19,borderWidth:1,borderColor:'rgba(201,164,92,.45)',justifyContent:'center'},retryText:{fontFamily:fonts.display,letterSpacing:1.2,color:colors.gold,fontSize:12,fontWeight:'700',textTransform:'uppercase'}});
