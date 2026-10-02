import React,{useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {readyHeroes,readyHero} from './pregens';
import {combatBasics} from './combatRules';
import {Crest} from './ui';
import Icon from './Icon';
import {classIcons} from './iconPaths';
import HeroPortrait from './HeroPortrait';
import {playSound} from './audio';
import {fonts,colors,type} from './theme';
// Four ready-made heroes: one tap and a new player is choosing their adventure. Replacing an existing hero takes a
// second tap, so nobody loses a character by accident.
export default function QuickHeroes({onChoose,disabled,replacing=null}){
 const [armed,setArmed]=useState(null);
 return <View style={s.grid}>{readyHeroes.map(entry=>{
  const hero=readyHero(entry.key),confirm=!!replacing&&armed===entry.key,stats=combatBasics(hero);
  return <Pressable key={entry.key} accessibilityRole="button" accessibilityLabel={(confirm?'Confirm: ':'')+'Play as '+hero.name+', a level 1 '+hero.species+' '+hero.class} disabled={disabled}
   onPress={()=>{if(replacing&&!confirm){setArmed(entry.key);playSound('select');return;}playSound('select');onChoose(hero);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(confirm)}} style={[s.card,confirm&&s.confirm,disabled&&{opacity:.55}]}>
   <View style={s.top}>
    <HeroPortrait hero={hero} size={58}/>
    <View style={{flex:1,minWidth:0}}><Text style={s.role}>{entry.role}</Text><Text numberOfLines={1} style={s.name}>{hero.name}</Text><Text style={s.line}>{hero.species} {hero.class} · {hero.background}</Text></View>
   </View>
   <Text style={[s.tagline,confirm&&{color:colors.gold}]}>{confirm?'Tap again to replace '+replacing+' and your current adventure with '+hero.name+'.':entry.tagline}</Text>
   <View style={s.stats}>
    <View style={s.stat}><Icon name="heart" size={13} color={colors.heal}/><Text style={s.statText}>{stats.hp} HP</Text></View>
    <View style={s.stat}><Icon name="shield" size={13} color={colors.gold}/><Text style={s.statText}>AC {stats.ac}</Text></View>
    {!!hero.spells?.length&&<View style={s.stat}><Icon name="spell" size={13} color={colors.arcane}/><Text style={s.statText}>{hero.spells.length} spells</Text></View>}
    <View style={s.play}><Text style={s.playText}>{confirm?'Confirm':'Play'}</Text><Icon name="forward" size={13} color={colors.gold}/></View>
   </View>
  </Pressable>;})}
 </View>;
}
const s=StyleSheet.create({
 grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:14},
 card:{flexGrow:1,flexBasis:260,padding:16,borderRadius:6,borderWidth:1,borderColor:'rgba(178,34,58,.3)',backgroundColor:'#211822',gap:10},confirm:{borderColor:colors.gold},
 top:{flexDirection:'row',gap:14,alignItems:'center'},
 role:{...type.label,fontSize:9,marginBottom:2},name:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:19,letterSpacing:.6},
 line:{fontFamily:fonts.ui,color:colors.gold,fontSize:12,marginTop:2},tagline:{fontFamily:fonts.story,fontStyle:'italic',color:'#d2c7c3',fontSize:15.5,lineHeight:21},
 stats:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6,paddingTop:10,borderTopWidth:1,borderTopColor:'rgba(178,34,58,.15)'},
 stat:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:3,borderRadius:11,borderWidth:1,borderColor:'rgba(178,34,58,.22)',backgroundColor:'rgba(0,0,0,.2)'},
 statText:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'600',color:'#ddd5c2'},
 play:{marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:4},playText:{fontFamily:fonts.display,fontSize:11,fontWeight:'800',letterSpacing:1.8,color:colors.gold,textTransform:'uppercase'},
});
