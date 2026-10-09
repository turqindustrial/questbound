import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {fonts,colors,tint} from './theme';

// The seal of the opening animation with the serpent biting its tail turning around it (serpent.js, webTheme.js),
// the same ring as the launch card and the story seal; its CSS honours reduced motion and the player's colour theme.
export default function TitleEmblem({size=200}){
 return <View pointerEvents="none" accessible={false} style={{width:size*1.42,height:size*1.42,alignItems:'center',justifyContent:'center'}}>
  <View dataSet={{qb:'serpent'}} style={[s.layer,{width:size*1.42,height:size*1.42}]}/>
  <View dataSet={{qb:'launch-ring'}} style={[s.ring,{width:size,height:size,borderRadius:size/2}]}>
   <View style={[s.inner,{width:size-18,height:size-18,borderRadius:(size-18)/2}]}/>
   <Text dataSet={{qb:'title'}} style={{fontFamily:fonts.logo,fontWeight:'900',color:colors.gold,fontSize:size*.56,lineHeight:size*.7,textAlign:'center'}}>Q</Text>
  </View>
 </View>;
}
const s=StyleSheet.create({layer:{position:'absolute'},ring:{borderWidth:2,borderColor:colors.gold,alignItems:'center',justifyContent:'center'},inner:{position:'absolute',borderWidth:1,borderColor:tint('rgba(178,34,58,.45)')}});
