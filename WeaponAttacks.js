import React, {useState} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {fonts,colors,tint} from './theme';
import {weaponAttacks, rollAttack, rollDamage} from './weaponRules';
import {signed} from './combatRules';

function WeaponCard({weapon}) {
  const [mode,setMode] = useState('normal');
  const [attack,setAttack] = useState(null);
  const [damage,setDamage] = useState(null);
  const button = (label,onPress,selected=false,disabled=false) => <Pressable key={label} accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[s.button,selected && s.selected,disabled && {opacity:0.45}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
  return <View style={s.card}>
    <Text style={s.title}>{weapon.name}</Text>
    <Text style={s.text}>Attack {signed(weapon.attackBonus)} · Damage {weapon.count}d{weapon.die}{signed(weapon.bonus)} {weapon.type.toLowerCase()}</Text>
    <Text style={s.caption}>{weapon.ability} {signed(weapon.bonus)}{weapon.proficient ? ` +${weapon.attackBonus-weapon.bonus} proficiency to hit` : ' · Not proficient'}{weapon.monk ? ' · Martial Arts' : ''}</Text>
    <Text style={s.caption}>{weapon.ranged ? weapon.range : `Melee reach 5 ft.${weapon.range ? ` · ${weapon.range}` : ''}`}{weapon.versatile ? ' · One-handed damage' : weapon.twoHands ? ' · Two-handed' : ''}</Text>
    {weapon.heavyDisadvantage && <Text style={s.notice}>Heavy weapon: disadvantage because {weapon.ranged ? 'Dexterity' : 'Strength'} is below 13.</Text>}
    {!!weapon.blocked && <Text style={s.notice}>{weapon.blocked}</Text>}
    <View style={s.row}>{['normal','advantage','disadvantage'].map(value=>button(value[0].toUpperCase()+value.slice(1),()=>{setMode(value);setAttack(null);setDamage(null);},mode===value))}</View>
    {button(`Roll ${weapon.name} attack`,()=>{setAttack(rollAttack(weapon,mode));setDamage(null);},false,!!weapon.blocked)}
    {!!attack && <View accessibilityLiveRegion="polite">
      <Text style={s.result}>{attack.critical ? 'Natural 20 — critical hit!' : attack.miss ? 'Natural 1 — automatic miss' : `Attack total: ${attack.total}`}</Text>
      <Text style={s.caption}>{attack.mode}: d20 [{attack.dice.join(', ')}] → {attack.natural} {signed(weapon.attackBonus)} = {attack.total}</Text>
      {!attack.miss && <>
        {!attack.critical && <Text style={s.caption}>Compare this total with the target’s armor class. Roll damage only if it hits.</Text>}
        {!damage && button(attack.critical ? `Roll ${weapon.name} critical damage` : `Hit: roll ${weapon.name} damage`,()=>setDamage(rollDamage(weapon,attack.critical)))}
      </>}
    </View>}
    {!!damage && <View accessibilityLiveRegion="polite"><Text style={s.result}>{damage.total} {weapon.type.toLowerCase()} damage</Text><Text style={s.caption}>Dice [{damage.dice.join(', ')}] {signed(weapon.bonus)} · Minimum 0</Text></View>}
  </View>;
}
export default function WeaponAttacks({hero}) {
  const attacks = weaponAttacks(hero);
  return <View><Text style={s.heading}>Weapon attacks</Text>
    <Text style={s.caption}>Weapon rolls at your current level. Choose advantage or disadvantage when the situation calls for it; if both apply, they cancel. Long-range attacks have disadvantage; targets beyond maximum range cannot be attacked.</Text>
    {attacks.length ? attacks.map(weapon=><WeaponCard key={weapon.name} weapon={weapon}/>) : <Text style={s.text}>Save your abilities and starter equipment to add weapon attacks.</Text>}
    <Text style={s.caption}>These practice rolls do not change hit points or consume ammunition. Rolls reset when you leave this sheet. Extra attacks, weapon mastery, Sneak Attack, Rage, feats, spells, and fighting styles are not applied yet.</Text>
  </View>;
}
const s=StyleSheet.create({heading:{fontFamily:fonts.display,color:colors.parchment,fontSize:21,fontWeight:'700',letterSpacing:1,marginTop:24},card:{backgroundColor:tint('rgba(24,17,25,.9)'),padding:18,borderRadius:4,borderWidth:1,borderColor:colors.goldLine,marginTop:14},title:{fontFamily:fonts.display,color:colors.gold,fontSize:19,fontWeight:'700',letterSpacing:.8,marginBottom:8},text:{fontFamily:fonts.ui,color:tint('#e6e1e5'),fontSize:15,lineHeight:25},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:21,marginVertical:5},notice:{fontFamily:fonts.ui,color:tint('#d6a0aa'),lineHeight:22},row:{flexDirection:'row',flexWrap:'wrap',gap:8},button:{backgroundColor:tint('#271e29'),borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),padding:14,borderRadius:3,minHeight:48,marginTop:8,justifyContent:'center'},selected:{backgroundColor:tint('rgba(48,26,78,.92)'),borderColor:colors.gold},buttonText:{fontFamily:fonts.display,color:colors.parchment,textAlign:'center',fontWeight:'700',letterSpacing:1.2,fontSize:13},result:{fontFamily:fonts.display,color:colors.gold,fontSize:20,fontWeight:'700',marginTop:14}});
