import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import Icon from './Icon';
import {fonts,colors,tint} from './theme';
// A written tale finished (the stories spec, 1.7): a small card at the top of the play screen saying how long it took
// and which ending was found (and how many of how many), with the way on: the Written tales shelf, or the next tale in
// this region (the story writer's sequel, which carries memory and people). App.js shows it once, when the tale's last
// scene is played on this device (shelfRules.js shelfFinishCard words it).
export default function TaleFinished({card,top=64,onShelf,onContinue,onClose}){
 return <View style={[s.layer,{top}]}>
  <View dataSet={{qb:'plate',tale:'finished'}} accessibilityRole="dialog" accessibilityLabel={card.title} style={s.card}>
   <View style={s.head}>
    <Icon name="starFill" size={18} color={colors.goldBright}/>
    <Text style={s.title} numberOfLines={2}>{card.title}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} dataSet={{keepfocus:'true'}} style={s.close}><Icon name="close" size={16} color={colors.muted}/></Pressable>
   </View>
   <Text style={s.line}>{card.line}</Text>
   {!!card.ending&&<Text style={s.ending}>{card.ending}</Text>}
   <Text style={s.small}>{card.next}</Text>
   <View style={s.row}>
    <Pressable accessibilityRole="button" onPress={onShelf} dataSet={{keepfocus:'true'}} style={[s.button,s.primary]}><Icon name="scroll" size={14} color={tint('#ffeef0')}/><Text style={[s.buttonText,{color:tint('#ffeef0')}]} numberOfLines={1}>Written tales</Text></Pressable>
    {!!onContinue&&<Pressable accessibilityRole="button" onPress={onContinue} dataSet={{keepfocus:'true'}} style={s.button}><Icon name="map" size={14} color={colors.gold}/><Text style={s.buttonText} numberOfLines={1}>Continue in this region</Text></Pressable>}
   </View>
  </View>
 </View>;
}
const s=StyleSheet.create({
 layer:{position:'absolute',left:0,right:0,zIndex:71,alignItems:'center',paddingHorizontal:12,pointerEvents:'box-none'},
 card:{width:'100%',maxWidth:460,padding:14,gap:8,borderRadius:8,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(22,16,23,.97)')},
 head:{flexDirection:'row',alignItems:'center',gap:8},
 title:{flex:1,minWidth:0,fontFamily:fonts.display,fontSize:17,fontWeight:'700',letterSpacing:.8,color:colors.parchment},
 close:{width:36,height:36,alignItems:'center',justifyContent:'center',borderRadius:18},
 line:{fontFamily:fonts.ui,fontSize:14.5,lineHeight:21,color:colors.text},
 ending:{fontFamily:fonts.story,fontStyle:'italic',fontSize:16,lineHeight:23,color:colors.goldBright},
 small:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:18,color:colors.muted},
 row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:2},
 button:{flexGrow:1,flexShrink:1,minWidth:0,minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),backgroundColor:tint('rgba(39,30,41,.9)')},
 primary:{borderColor:tint('#f06e80'),backgroundColor:tint('#9e1b32')},
 buttonText:{fontFamily:fonts.ui,fontSize:13.5,fontWeight:'700',color:colors.text,flexShrink:1}});
