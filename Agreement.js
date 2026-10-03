import React from 'react';
import {View,Text,Modal,ScrollView,StyleSheet,useWindowDimensions} from 'react-native';
import {GameButton} from './ui';
import Icon from './Icon';
import {permissionsAgreement} from './legalText';
import {fonts,colors,type,tint} from './theme';
// Before the first game in a browser (and again when the legal texts change): what the game will do, in seven short
// points, and one tap to agree. The full texts open from here, and the dialog returns when the player comes back.
const icons={'Your words go to an AI':'quill','Saves in this browser':'key','Copies on the host\'s computer':'cloud','Feedback and service records':'feedback','Sound and full screen':'sound','Age and conduct':'shield','Changing your mind':'door'};
export default function Agreement({visible,onAccept,onLegal}){
 const {height}=useWindowDimensions(),short=height<620;
 return <Modal transparent visible={visible} animationType="fade" onRequestClose={()=>{}}><View dataSet={{qb:'scrim'}} style={s.scrim}><View dataSet={{qb:'sheet'}} style={[s.sheet,{maxHeight:Math.max(200,height-24)},short&&{padding:14}]} accessibilityViewIsModal>
  <ScrollView style={{flexShrink:1}} contentContainerStyle={{gap:short?9:12,paddingRight:8}} keyboardShouldPersistTaps="handled">
   <View style={s.emblem}><Icon name="scroll" size={24} color={colors.goldBright}/></View><Text style={s.overline}>Permissions agreement</Text><Text style={s.title}>Before you play</Text>
   <Text style={s.text}>Questbound is run by its host on their own computer, with an AI Dungeon Master. Here is what the game will do, so you can decide.</Text>
   {permissionsAgreement.sections.map(section=><View key={section.heading} style={s.item}><View style={s.itemIcon}><Icon name={icons[section.heading]??'info'} size={16} color={colors.gold}/></View><View style={{flex:1,gap:2}}><Text style={s.itemHead}>{section.heading}</Text><Text style={s.itemText}>{section.paragraphs[0]}</Text></View></View>)}
   <Text style={s.small}>By continuing you accept the <Text accessibilityRole="link" onPress={()=>onLegal('terms')} style={s.link}>terms of use</Text> and the <Text accessibilityRole="link" onPress={()=>onLegal('privacy')} style={s.link}>privacy policy</Text>, and confirm that you are 16 or older. <Text accessibilityRole="link" onPress={()=>onLegal('permissions')} style={s.link}>Read the full agreement</Text>.</Text>
   <GameButton variant="primary" icon="check" label="I agree, let me play" onPress={onAccept}/>
   <Text style={s.small}>If you do not agree, close this page and do not play.</Text>
  </ScrollView>
 </View></View></Modal>;
}
const s=StyleSheet.create({
 scrim:{flex:1,backgroundColor:tint('rgba(5,3,5,.82)'),alignItems:'center',justifyContent:'center',padding:12},
 sheet:{width:'100%',maxWidth:540,padding:22,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(22,16,23,.98)')},
 emblem:{alignSelf:'center',width:52,height:52,borderRadius:26,borderWidth:1,borderColor:tint('rgba(224,74,92,.6)'),alignItems:'center',justifyContent:'center',backgroundColor:tint('rgba(48,26,78,.45)')},
 overline:{...type.label,textAlign:'center'},title:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:2,color:colors.parchment,textAlign:'center',textTransform:'uppercase'},
 text:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:14,lineHeight:22},
 item:{flexDirection:'row',gap:12,alignItems:'flex-start'},itemIcon:{width:30,height:30,borderRadius:15,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),alignItems:'center',justifyContent:'center',backgroundColor:tint('rgba(8,5,9,.6)'),marginTop:1},
 itemHead:{fontFamily:fonts.display,fontSize:13,fontWeight:'700',letterSpacing:1,color:colors.gold},itemText:{fontFamily:fonts.ui,color:tint('#c9bfc6'),fontSize:13,lineHeight:19},
 small:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,textAlign:'center'},link:{color:colors.gold,textDecorationLine:'underline'},
});
