import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {Segmented,Ornament} from './ui';
import {legalDocuments,legalUpdated} from './legalText';
import {agreementStatus,acceptedOn} from './agreementRules';
import {fonts,colors,tint} from './theme';
// The privacy policy, the terms of use and the licence notices (legalText.js), one at a time, read in the game.
export default function Legal({tab='privacy',onTab}){
 const doc=legalDocuments.find(d=>d.id===tab)??legalDocuments[0],agreed=doc.id==='permissions'?agreementStatus():null;
 return <View>
  <Segmented options={legalDocuments.map(d=>[d.id,d.title.replace(' and credits','').replace(' agreement','')])} value={doc.id} onChange={onTab} style={{marginBottom:14}}/>
  <Text style={s.updated}>Last updated {legalUpdated}{agreed?agreed.accepted?' · Accepted in this browser on '+acceptedOn(agreed.acceptedAt):' · Not yet accepted in this browser':''}</Text>
  {doc.sections.map(section=><View key={section.heading} style={s.section}>
   <Text style={s.heading}>{section.heading}</Text>
   {section.paragraphs.map((text,i)=>text.startsWith('- ')
    ?<View key={i} style={s.bullet}><Text style={s.dot}>•</Text><Text style={[s.text,{flex:1}]}>{text.slice(2)}</Text></View>
    :<Text key={i} style={s.text}>{text}</Text>)}
  </View>)}
  <Ornament style={{alignSelf:'center',width:'60%',marginTop:8}}/>
 </View>;
}
const s=StyleSheet.create({
 updated:{fontFamily:fonts.ui,fontSize:12.5,color:colors.muted,marginBottom:10},
 section:{marginBottom:16,gap:8},
 heading:{fontFamily:fonts.display,fontSize:15,fontWeight:'700',letterSpacing:1,color:colors.gold},
 text:{fontFamily:fonts.ui,fontSize:14.5,lineHeight:23,color:tint('#d4ced2')},
 bullet:{flexDirection:'row',gap:10,paddingLeft:4},
 dot:{fontFamily:fonts.ui,fontSize:14.5,lineHeight:23,color:colors.goldMid},
});
