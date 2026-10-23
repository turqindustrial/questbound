import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import Icon from './Icon';
import {fonts,colors,tint} from './theme';
// A small card at the top of the play screen, with the way on (the 2026-10-23 campaign, the host's words: "once the
// player completes the story or decides to move to a new area, new potential stories should be written"):
// - kind 'finished': a tale finished, written or the story writer's. A written tale says how long it took and which
//   ending was found (shelfRules.js shelfFinishCard), a tale of the story writer's which tale it was (taleEndCard); then
//   what next: the next tale here (begun at once: a tale already written for this land, else one written for it), the
//   Written tales shelf, or somewhere new. App.js shows it once, when the tale's last scene is played on this device.
// - kind 'waits': "A tale waits in <Land>", while the hero stands in a land first reached in this tale (sequelRules.js
//   landTaleOffer), with Begin and Not now.
// `actions`: [{key, label, icon, primary, onPress}], each as wide as its words, wrapping to a new row when a row is full
// (never cut short or sideways); none at a shared
// table for a player who is not its host. `busy` while a tale is being started; `error` when one could not be.
export default function TaleFinished({card,kind='finished',top=64,actions=[],busy=false,error='',onClose}){
 return <View style={[s.layer,{top}]}>
  <View dataSet={{qb:'plate',tale:kind}} accessibilityRole="dialog" accessibilityLabel={card.title} style={s.card}>
   <View style={s.head}>
    <Icon name={kind==='waits'?'compass':'starFill'} size={18} color={colors.goldBright}/>
    <Text style={s.title} numberOfLines={2}>{card.title}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={kind==='waits'?'Not now':'Close'} disabled={busy} onPress={onClose} dataSet={{keepfocus:'true'}} style={s.close}><Icon name="close" size={16} color={colors.muted}/></Pressable>
   </View>
   <Text style={s.line}>{card.line}</Text>
   {!!card.ending&&<Text style={s.ending}>{card.ending}</Text>}
   {!!card.next&&<Text style={s.small}>{card.next}</Text>}
   {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
   {actions.length>0&&<View style={s.row}>
    {actions.map(a=><Pressable key={a.key} accessibilityRole="button" accessibilityState={{disabled:busy}} disabled={busy} onPress={a.onPress} dataSet={{keepfocus:'true',qb:'tale-'+a.key}} style={[s.button,a.primary&&s.primary,busy&&s.busy]}><Icon name={a.icon} size={14} color={a.primary?tint('#ffeef0'):colors.gold}/><Text style={[s.buttonText,a.primary&&{color:tint('#ffeef0')}]} numberOfLines={1}>{busy&&a.primary?'One moment…':a.label}</Text></Pressable>)}
   </View>}
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
 error:{fontFamily:fonts.ui,fontSize:13,lineHeight:19,color:colors.danger},
 row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:2},
 button:{flexGrow:1,flexShrink:1,flexBasis:'auto',minWidth:0,minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),backgroundColor:tint('rgba(39,30,41,.9)')},
 primary:{borderColor:tint('#f06e80'),backgroundColor:tint('#9e1b32')},
 busy:{opacity:.6},
 buttonText:{fontFamily:fonts.ui,fontSize:13.5,fontWeight:'700',color:colors.text,flexShrink:1}});
