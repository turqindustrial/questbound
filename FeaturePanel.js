import React,{useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {fonts,colors,tint} from './theme';
import {Section} from './ui';
import Icon from './Icon';
import featureCatalog from './classFeatureCatalog.json';
import {subclassOptions} from './subclassOptions';

const automaticNames=['Second Wind','Lay on Hands','Extra Attack','Improved Critical','Superior Critical','Draconic Resilience','Disciple of Life','Supreme Healing','Dark One\'s Blessing','Life Domain Spells','Oath of Devotion Spells','Draconic Spells','Fiend Spells'];
export default function FeaturePanel({hero}) {
  const [open,setOpen]=useState(null);
  const features=featureCatalog.filter(f=>f.class===hero.class && f.level<=hero.level && (!f.subclass || f.subclass===hero.plannedSubclass));
  return <View>
    <Section icon="crown" title={'Abilities at level '+hero.level}/>
    {hero.level>=3&&!!hero.plannedSubclass&&<><Text style={s.name}>{hero.plannedSubclass}</Text><Text style={s.text}>{subclassOptions[hero.class]?.[hero.plannedSubclass]??'Previously saved subclass.'}</Text></>}
    {!features.length && <Text style={s.caption}>Your level, hit points, proficiency and spell slots are all tracked for you.</Text>}
    {features.map((feature,index)=><View key={`${feature.name}-${feature.level}`} style={s.card}>
      <Pressable accessibilityRole="button" accessibilityState={{expanded:open===index}} onPress={()=>setOpen(open===index?null:index)} style={s.button}><View style={s.featureRow}><Text style={[s.name,{flex:1}]}>{feature.name}</Text><Text style={s.lvl}>Lv {feature.level}</Text><Icon name="forward" size={14} color={colors.gold} style={{transform:open===index?'rotate(-90deg)':'rotate(90deg)'}}/></View></Pressable>
      <Text style={[s.caption,automaticNames.includes(feature.name)&&{color:colors.gold}]}>{automaticNames.includes(feature.name)?'✦ Applied automatically in combat':'Played through the Dungeon Master: describe using it in your action.'}</Text>
      {open===index&&<Text style={s.text}>{feature.description.replace(/[*_]/g,'')}</Text>}
    </View>)}
    {hero.level>=3 && !features.some(f=>f.subclass) && <Text style={s.caption}>Your subclass is recorded on your sheet. Describe its powers to the Dungeon Master when you use them.</Text>}
  </View>;
}
const s=StyleSheet.create({heading:{fontFamily:fonts.display,color:colors.gold,fontSize:19,fontWeight:'700',letterSpacing:1.2,marginVertical:16},name:{fontFamily:fonts.display,color:colors.parchment,fontSize:16,fontWeight:'700',letterSpacing:.6},text:{fontFamily:fonts.ui,color:tint('#e6e1e5'),fontSize:14,lineHeight:23,marginVertical:8},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:20,marginVertical:8},card:{paddingHorizontal:14,paddingVertical:6,backgroundColor:tint('rgba(255,214,224,.03)'),borderWidth:1,borderColor:tint('rgba(178,34,58,.2)'),borderRadius:6,marginVertical:5},featureRow:{flexDirection:'row',alignItems:'center',gap:10},lvl:{fontFamily:fonts.ui,fontSize:11,fontWeight:'700',color:colors.goldMid},button:{minHeight:44,justifyContent:'center'}});
