import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {fonts,colors} from './theme';
import {Section} from './ui';
import {skillAbilities,backgroundSkills,classSkills,classSkillCount,expertiseCount,expertiseEligible,trainedSkills,skillCheckBonus} from './skillRules';
export default function SkillPanel({hero,game,setGame,locked}){
 const training=game.skillTraining??{skills:[],expertise:[]},limit=classSkillCount(hero),expertLimit=expertiseCount(hero),trained=trainedSkills(hero,game);
 const toggle=(key,skill)=>{
  if(locked||!setGame)return;
  const prior=training[key],next=prior.includes(skill)?prior.filter(s=>s!==skill):[...prior,skill];
  if(next.length>(key==='skills'?limit:expertLimit))return;
  const updated={...training,[key]:next};
  if(key==='skills')updated.expertise=updated.expertise.filter(s=>[...next,...(backgroundSkills[hero.background]??[])].includes(s));
  setGame({...game,skillTraining:updated});
 };
 return <View style={s.panel}>
  <Section icon="star" title="Skill training"/>
  <Text style={s.text}>Class choices: {training.skills.length}/{limit}. Expertise choices: {training.expertise.length}/{expertLimit}. These choices are saved with this adventure and used by the Dungeon Master.</Text>
  <Text style={s.note}>{backgroundSkills[hero.background]?'Background training: '+backgroundSkills[hero.background].join(', '):'This background’s skills have not been verified in our free-rules catalog yet; no background proficiency is assumed.'}</Text>
  {!classSkills[hero.class]&&<Text style={s.note}>This class’s skill-choice list is still awaiting its published reference.</Text>}
  {Object.entries(skillAbilities).map(([skill,ability])=>{
   const info=skillCheckBonus(hero,game,ability,skill),fixed=backgroundSkills[hero.background]?.includes(skill),selectable=classSkills[hero.class]?.includes(skill)&&!fixed;
   return <View key={skill} style={s.row}>
    <View style={{flex:1}}><Text style={s.text}>{skill} · {info.total>=0?'+':''}{info.total}</Text><Text style={s.note}>{ability}: {info.abilityBonus>=0?'+':''}{info.abilityBonus} + {info.trainingBonus} {info.expert?'Expertise':info.trained?'proficiency':'training'}{info.reliable?' · Reliable Talent':''}</Text></View>
    {selectable&&<Pressable accessibilityRole="checkbox" accessibilityLabel={'Proficiency in '+skill} accessibilityState={{checked:training.skills.includes(skill),disabled:locked}} disabled={locked||(!training.skills.includes(skill)&&training.skills.length>=limit)} onPress={()=>toggle('skills',skill)} dataSet={{qb:training.skills.includes(skill)?'seg-on':'chip'}} style={[s.button,training.skills.includes(skill)&&s.on]}><Text style={[s.text,training.skills.includes(skill)&&{color:colors.goldBright}]}>{training.skills.includes(skill)?'✓ Trained':'Train'}</Text></Pressable>}
    {expertLimit>0&&expertiseEligible(hero,skill)&&trained.includes(skill)&&<Pressable accessibilityRole="checkbox" accessibilityLabel={'Expertise in '+skill} accessibilityState={{checked:training.expertise.includes(skill),disabled:locked}} disabled={locked||(!training.expertise.includes(skill)&&training.expertise.length>=expertLimit)} onPress={()=>toggle('expertise',skill)} dataSet={{qb:training.expertise.includes(skill)?'seg-on':'chip'}} style={[s.button,training.expertise.includes(skill)&&s.on]}><Text style={[s.text,training.expertise.includes(skill)&&{color:colors.goldBright}]}>{training.expertise.includes(skill)?'✓ Expert':'Expertise'}</Text></Pressable>}
   </View>;
  })}
 </View>;
}
const s=StyleSheet.create({panel:{marginVertical:12},heading:{fontFamily:fonts.display,color:colors.gold,fontSize:19,fontWeight:'700',letterSpacing:1.2},text:{fontFamily:fonts.ui,color:'#e6e1e5',fontSize:14,lineHeight:22},note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:18},row:{flexDirection:'row',flexWrap:'wrap',gap:6,alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'rgba(178,34,58,.15)'},button:{paddingVertical:8,paddingHorizontal:14,minHeight:40,backgroundColor:'#271e29',borderWidth:1,borderColor:'rgba(178,34,58,.35)',borderRadius:20,justifyContent:'center'},on:{borderColor:'rgba(224,74,92,.7)',backgroundColor:'rgba(48,26,78,.9)'}});
