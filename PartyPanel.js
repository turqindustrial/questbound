import React from 'react';
import {View,Text,ScrollView,StyleSheet} from 'react-native';
import Icon from './Icon';
import {colors,fonts,tint} from './theme';
import {partyMembers} from './partyRules';
import {turnOrderView} from './encounterRules';
// Every hero at a party table (partyRules.js) in one row: name, hit points as a bar, and how they stand. In a fight
// the row follows the turn order (adventureRules.js): the foe takes its place in it, and whose turn it is stands out.
export default function PartyPanel({game,health,maxHp}){
 const members=partyMembers(game);if(members.length<2)return null;
 const turns=turnOrderView(game),place=new Map((turns?.entries??[]).map((e,i)=>[e.id,i]));
 const cards=members.map(m=>{
  const status=m.lead?(game.stage==='dead'?'dead':game.stage==='dying'?'down':'up'):m.status;
  const most=m.lead?maxHp:m.maxHp,hp=status!=='up'?0:m.lead?(health?.current??maxHp):m.hp;
  return {key:m.id,kind:'hero',name:m.name,mine:m.lead,status,hp,most,current:turns?.current?.id===m.id};
 });
 // The foe (or each person in a brawl) between the heroes, where initiative put them.
 for(const e of turns?.entries??[])if(e.kind!=='hero')cards.push({key:e.id,kind:e.kind,name:e.name,status:e.down?'down':'up',current:e.current});
 if(turns)cards.sort((a,b)=>(place.get(a.key)??99)-(place.get(b.key)??99));
 return <View dataSet={{qb:'party-panel'}} accessibilityLabel={'Party'+(turns?', round '+turns.round:'')} style={s.panel}>
  {turns&&<Text style={s.round}>Round {turns.round}</Text>}
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
   {cards.map(c=>{
    const share=c.most?Math.max(0,Math.min(1,c.hp/c.most)):0,low=share<=.35;
    return <View key={c.key} accessible accessibilityLabel={c.name+(c.mine?' (you)':'')+(c.current?', taking their turn':'')+(c.kind==='hero'?(c.status==='dead'?', fallen':c.status==='down'?', down and dying':', '+c.hp+' of '+c.most+' hit points'):'')} style={[s.card,c.kind!=='hero'&&s.foeCard,c.current&&s.current,c.status==='dead'&&{opacity:.5}]}>
     <View style={s.nameRow}>
      {c.current&&<Icon name="forward" size={11} color={colors.goldBright}/>}
      {c.kind!=='hero'&&<Icon name="swords" size={11} color={tint('#f06e80')}/>}
      <Text numberOfLines={1} style={[s.name,c.mine&&{color:colors.goldBright}]}>{c.kind==='hero'?c.name.split(' ')[0]:c.name}{c.mine?' (you)':''}</Text>
     </View>
     {c.kind==='hero'?(c.status==='up'?<View style={s.hpRow}>
      <View style={s.bar}><View style={[s.fill,{width:Math.round(share*100)+'%',backgroundColor:low?colors.bloodBright:colors.heal}]}/></View>
      <Text style={[s.hp,low&&{color:colors.bloodBright}]}>{c.hp}/{c.most}</Text>
     </View>:<Text style={[s.state,{color:c.status==='dead'?colors.muted:colors.bloodBright}]}>{c.status==='dead'?'Fallen':'Down · dying'}</Text>)
     :<Text style={s.state}>{c.status==='down'?'Down':c.current?'Acting':'Waits'}</Text>}
    </View>;
   })}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 panel:{gap:4},
 round:{fontFamily:fonts.display,fontSize:10,fontWeight:'700',letterSpacing:1.6,color:colors.goldMid,textTransform:'uppercase'},
 row:{flexDirection:'row',gap:6,paddingRight:4},
 card:{minWidth:92,maxWidth:150,paddingVertical:5,paddingHorizontal:8,borderRadius:4,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(19,14,21,.85)'),gap:3},
 foeCard:{borderColor:tint('rgba(240,110,128,.35)')},
 current:{borderColor:colors.goldBright,backgroundColor:tint('rgba(91,52,168,.28)')},
 nameRow:{flexDirection:'row',alignItems:'center',gap:4},
 name:{flexShrink:1,fontFamily:fonts.display,fontSize:12,fontWeight:'700',letterSpacing:.6,color:colors.text},
 hpRow:{flexDirection:'row',alignItems:'center',gap:6},
 bar:{flex:1,height:5,minWidth:36,borderRadius:3,backgroundColor:tint('rgba(255,255,255,.08)'),overflow:'hidden'},
 fill:{height:'100%',borderRadius:3},
 hp:{fontFamily:fonts.ui,fontSize:11,color:colors.muted,fontVariant:['tabular-nums']},
 state:{fontFamily:fonts.ui,fontSize:11,color:colors.muted},
});
