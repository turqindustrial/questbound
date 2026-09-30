import React,{useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {readyHeroes,readyHero} from './pregens';
import {fonts,colors,type} from './theme';
// Four ready-made heroes: one tap and a new player is choosing their adventure. Replacing an existing hero takes a
// second tap, so nobody loses a character by accident.
export default function QuickHeroes({onChoose,disabled,replacing=null}){
 const [armed,setArmed]=useState(null);
 return <View style={s.grid}>{readyHeroes.map(entry=>{
  const hero=readyHero(entry.key),confirm=!!replacing&&armed===entry.key;
  return <Pressable key={entry.key} accessibilityRole="button" accessibilityLabel={(confirm?'Confirm: ':'')+'Play as '+hero.name+', a level 1 '+hero.species+' '+hero.class} disabled={disabled}
   onPress={()=>{if(replacing&&!confirm){setArmed(entry.key);return;}onChoose(hero);}} dataSet={{qb:'card',selected:String(confirm)}} style={[s.card,confirm&&s.confirm,disabled&&{opacity:.55}]}>
   <View style={s.top}>
    <Text style={s.glyph}>{entry.glyph}</Text>
    <View style={{flex:1,minWidth:0}}><Text style={s.role}>{entry.role}</Text><Text numberOfLines={1} style={s.name}>{hero.name}</Text><Text style={s.line}>{hero.species} {hero.class} · {hero.background}</Text></View>
   </View>
   <Text style={[s.tagline,confirm&&{color:colors.gold}]}>{confirm?'Tap again to replace '+replacing+' and your current adventure with '+hero.name+'.':entry.tagline}</Text>
  </Pressable>;})}
 </View>;
}
const s=StyleSheet.create({
 grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:14},
 card:{flexGrow:1,flexBasis:260,padding:14,borderRadius:4,borderWidth:1,borderColor:'rgba(201,164,92,.3)',backgroundColor:'#141a26',gap:8},confirm:{borderColor:colors.gold},
 top:{flexDirection:'row',gap:12,alignItems:'center'},glyph:{fontSize:24,color:colors.gold,width:30,textAlign:'center'},
 role:{...type.label,fontSize:9,marginBottom:2},name:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:18,letterSpacing:.6},
 line:{fontFamily:fonts.ui,color:colors.gold,fontSize:12,marginTop:2},tagline:{fontFamily:fonts.story,fontStyle:'italic',color:'#d9d0bb',fontSize:15,lineHeight:21},
});
