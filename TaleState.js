import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import Icon from './Icon';
import {fonts,colors,tint} from './theme';
import {taleQuestView} from './stagingRules';
// A written tale on the Quest tab and in the journal (the stories spec, 1.6): what is at stake now, the latest sign of
// the foe's plan ("Out of sight": a sign, never a counter), the choices made and the ending taken. Only what has
// happened is shown (stagingRules.js taleQuestView). Nothing for a tale that is not a written one.
export default function TaleState({game,style}){
 const view=taleQuestView(game);
 if(!view||(!view.stakes.length&&!view.sign&&!view.choices.length&&!view.ending))return null;
 const row=(icon,label,children,key)=><View key={key} style={s.row}><Icon name={icon} size={13} color={colors.goldMid}/><View style={{flex:1,minWidth:0}}><Text style={s.label}>{label}</Text>{children}</View></View>;
 return <View dataSet={{qb:'tale-state'}} style={[s.wrap,style]}>
  {!!view.ending&&row('starFill','Ending',<Text style={s.ending}>{view.ending}</Text>,'ending')}
  {!!view.stakes.length&&row('heart','At stake',view.stakes.map((k,i)=><Text key={i} style={s.text}><Text style={s.strong}>{k.name}</Text>: {k.state.replace(/[.\s]+$/,'')}.</Text>),'stakes')}
  {!!view.sign&&!view.ending&&row('eye','Out of sight',<Text style={s.sign}>{view.sign}</Text>,'sign')}
  {!!view.choices.length&&row('flag','Choices made',view.choices.map((c,i)=><Text key={i} style={s.text}>{c.lapsed?'Left to fate: ':'You chose: '}{c.label}.</Text>),'choices')}
 </View>;
}
const s=StyleSheet.create({
 wrap:{gap:10,paddingTop:10,marginTop:10,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.16)')},
 row:{flexDirection:'row',gap:8,alignItems:'flex-start'},
 label:{fontFamily:fonts.display,fontSize:9.5,fontWeight:'700',letterSpacing:1.8,color:colors.goldMid,textTransform:'uppercase',marginBottom:2},
 text:{fontFamily:fonts.ui,fontSize:13.5,lineHeight:20,color:colors.text},
 strong:{fontWeight:'700',color:colors.parchment},
 sign:{fontFamily:fonts.story,fontStyle:'italic',fontSize:15,lineHeight:22,color:tint('#cfc8b6')},
 ending:{fontFamily:fonts.display,fontSize:15,fontWeight:'700',letterSpacing:.6,color:colors.goldBright}});
