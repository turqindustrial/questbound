import React,{useEffect,useState} from 'react';
import {View,Text,Image,StyleSheet} from 'react-native';
import {Crest} from './ui';
import {classIcons} from './iconPaths';
import {heroArtSubject} from './worldArtRules';
import {subscribeArt,cachedArt,artIdentity} from './artClient';
import {fonts,colors,tint} from './theme';
// The hero's painted portrait in a crimson medallion, with their level. Until the painting is ready (or if it cannot
// be made) the class crest stands in, so the frame never shows a spinner.
export default function HeroPortrait({hero,size=56,level,style}){
 const subject=heroArtSubject(hero),key=subject?artIdentity(subject):null;
 const [art,setArt]=useState(()=>subject?cachedArt(subject):null);
 useEffect(()=>subject?subscribeArt(subject,value=>setArt({...value})):undefined,[key]);
 if(art?.status!=='ready'||!art.dataUrl)return <Crest icon={classIcons[hero?.class]??'star'} size={size} level={level} style={style}/>;
 const badge=Math.max(18,size*.36);
 return <View dataSet={{qb:'crest'}} style={[{width:size,height:size,borderRadius:size/2},style]} accessibilityLabel={'Portrait of '+hero.name}>
  <View style={[StyleSheet.absoluteFill,{borderRadius:size/2,overflow:'hidden'}]}><Image dataSet={{qb:'art-img'}} source={{uri:art.dataUrl}} resizeMode="cover" style={StyleSheet.absoluteFill}/></View>
  {level!=null&&<View dataSet={{qb:'badge'}} style={[s.badge,{minWidth:badge,height:badge,borderRadius:badge/2}]}><Text style={[s.level,{fontSize:Math.max(10,Math.round(size*.2))}]}>{level}</Text></View>}
 </View>;
}
const s=StyleSheet.create({
 badge:{position:'absolute',right:-4,bottom:-4,paddingHorizontal:4,alignItems:'center',justifyContent:'center',backgroundColor:colors.gold,borderWidth:1,borderColor:tint('#f06e80')},
 level:{fontFamily:fonts.display,fontWeight:'800',color:tint('#ffeef0')},
});
