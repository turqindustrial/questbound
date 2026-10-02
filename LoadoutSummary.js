import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {fonts,colors,type} from './theme';
import Icon from './Icon';
import {readyLoadout,loadoutWarnings,weaponAttacks} from './weaponRules';

// What this hero has ready: the close-range weapon that suits their abilities best, what they wear, and anything
// in the kit that sits badly with them.
export default function LoadoutSummary({hero}) {
  const gear=readyLoadout(hero),main=weaponAttacks(hero).find(w=>w.name===gear.mainWeapon),warnings=loadoutWarnings(hero);
  const signed=n=>(n>=0?'+':'')+n;
  const rows=[
    ['Close-range weapon',gear.mainWeapon?gear.mainWeapon+(main?' · '+signed(main.attackBonus)+' to hit, '+main.count+'d'+main.die+(main.bonus?signed(main.bonus):'')+' '+main.type.toLowerCase()+' ('+main.ability+')':''):null],
    ['Protection',(gear.armor??'Unarmored')+(gear.shield?' + Shield':'')],
    ['Spellcasting focus',gear.focus],
    ['Bow & ammunition',gear.rangedWeapon?gear.rangedWeapon+' · '+gear.ammunition+' arrows':null],
    ['Tools',gear.tools.join(' · ')],
    ['Travel supplies',gear.pack],
  ].filter(([,value])=>value);
  return <View style={s.panel} accessibilityLabel={hero.class+' starting loadout'}>
    <View style={s.titleRow}><Icon name="bag" size={16} color={colors.gold}/><Text style={s.title}>{hero.class} loadout</Text></View>
    {rows.map(([label,value])=><View key={label} style={s.row}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}
    {warnings.map(text=><View key={text} style={s.warning}><Icon name="info" size={14} color="#e0a860"/><Text style={s.warningText}>{text}</Text></View>)}
    <Text style={s.note}>{gear.armor||gear.shield?'Your listed protection is equipped. ':''}{main?'Of the weapons in this kit, the '+gear.mainWeapon+' suits this hero’s abilities best, so it is used for an attack unless you name another.':'Your main close-range weapon is used for an attack unless you name another.'}{gear.focus?' Casting uses your focus when the spell allows it.':''}</Text>
  </View>;
}
const s=StyleSheet.create({titleRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12},panel:{padding:18,borderRadius:6,backgroundColor:'rgba(14,18,28,.9)',borderWidth:1,borderColor:colors.goldLine,marginVertical:12},title:{fontFamily:fonts.display,color:colors.gold,fontSize:17,fontWeight:'700',letterSpacing:1.2},row:{marginBottom:10},label:{...type.label,fontSize:9,lineHeight:16},value:{fontFamily:fonts.ui,color:'#e8e3d6',fontSize:15,lineHeight:23},note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:19,marginTop:4},
 warning:{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:8,padding:10,borderRadius:4,borderWidth:1,borderColor:'rgba(224,168,96,.45)',backgroundColor:'rgba(60,40,12,.35)'},warningText:{flex:1,fontFamily:fonts.ui,color:'#f0d6a8',fontSize:13,lineHeight:19}});
