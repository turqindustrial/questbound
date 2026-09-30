import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {fonts,colors,type} from './theme';
import {loadoutFor} from './equipmentRules';

export default function LoadoutSummary({hero}) {
  const gear=loadoutFor(hero);
  const rows=[
    ['Close-range weapon',gear.mainWeapon],
    ['Protection',(gear.armor??'Unarmored')+(gear.shield?' + Shield':'')],
    ['Spellcasting focus',gear.focus],
    ['Bow & ammunition',gear.rangedWeapon?gear.rangedWeapon+' · '+gear.ammunition+' arrows':null],
    ['Tools',gear.tools.join(' · ')],
    ['Travel supplies',gear.pack],
  ].filter(([,value])=>value);
  return <View style={s.panel} accessibilityLabel={hero.class+' starting loadout'}>
    <Text style={s.title}>{hero.class} loadout</Text>
    {rows.map(([label,value])=><View key={label} style={s.row}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}
    <Text style={s.note}>{gear.armor||gear.shield?'Your listed protection is equipped. ':''}Your main close-range weapon is used for an attack unless you name another.{gear.focus?' Casting uses your focus when the spell allows it.':''}</Text>
  </View>;
}
const s=StyleSheet.create({panel:{padding:18,borderRadius:4,backgroundColor:'rgba(14,18,28,.9)',borderWidth:1,borderColor:colors.goldLine,marginVertical:12},title:{fontFamily:fonts.display,color:colors.gold,fontSize:17,fontWeight:'700',letterSpacing:1.2,marginBottom:12},row:{marginBottom:10},label:{...type.label,fontSize:9,lineHeight:16},value:{fontFamily:fonts.ui,color:'#e8e3d6',fontSize:15,lineHeight:23},note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:19,marginTop:4}});
