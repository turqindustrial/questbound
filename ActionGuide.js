import React from 'react';
import {View,Text,Pressable,ScrollView,Modal,StyleSheet,useWindowDimensions} from 'react-native';
import Icon from './Icon';
import {fonts,colors,type,tint} from './theme';
import {actionDescription,actionCost,spellFacts} from './descriptions';
import {knownSpells} from './spellRules';
// What every action on offer does: opened from the "i" at the end of the action row. Each row names the action,
// what it costs in a fight (action or bonus action), and explains it in a sentence or two; spells add their level,
// casting time, range and duration. "Use" does it from here.
export default function ActionGuide({visible,onClose,actions,hero,game,onRun,disabled=false,spells=false}){
 const {height}=useWindowDimensions();
 const rows=actions.filter(a=>a.key!=='spells-back'&&a.key!=='guide');
 return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
  <Pressable accessibilityLabel="Close" onPress={onClose} dataSet={{qb:'scrim'}} style={s.scrim}>
   <Pressable onPress={()=>{}} dataSet={{qb:'sheet'}} style={[s.sheet,{maxHeight:Math.max(240,height-48)}]} accessibilityViewIsModal>
    <View style={s.head}>
     <View style={{flex:1,minWidth:0}}><Text style={s.over}>{spells?'Your spells':'What you can do now'}</Text><Text accessibilityRole="header" style={s.title}>{spells?'Spells':'Actions'}</Text></View>
     <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} dataSet={{qb:'chip'}} style={s.close}><Icon name="close" size={15} color={colors.gold}/><Text style={s.closeText}>Close</Text></Pressable>
    </View>
    <ScrollView style={{flexShrink:1}} contentContainerStyle={s.list}>
     {rows.map(a=>{const cost=actionCost(a,game),spell=a.key.startsWith('spell:')?knownSpells(hero).find(sp=>'spell:'+sp.id===a.key):null;
      return <View key={a.key} dataSet={{qb:'card'}} style={s.row}>
       <View style={[s.mark,a.primary&&{borderColor:colors.goldBright}]}><Icon name={a.icon??'star'} size={18} color={colors.goldBright}/></View>
       <View style={{flex:1,minWidth:0}}>
        <View style={s.nameRow}><Text style={s.name}>{a.label.replace(/…$/,'')}</Text>{!!cost&&<View style={[s.cost,cost==='Bonus action'&&s.costBonus]}><Text style={[s.costText,cost==='Bonus action'&&{color:'#a8ddd4'}]}>{cost}</Text></View>}</View>
        {!!spell&&<Text style={s.facts}>{spellFacts(spell)}</Text>}
        <Text style={s.text}>{actionDescription(a,hero,game)}</Text>
       </View>
       <Pressable accessibilityRole="button" accessibilityLabel={'Use '+a.label} accessibilityState={{disabled}} disabled={disabled} onPress={()=>{onClose();onRun(a);}} dataSet={{qb:'chip'}} style={[s.use,disabled&&{opacity:.45}]}><Text style={s.useText}>{a.key==='cast'?'Open':a.prefill?'Aim':'Use'}</Text></Pressable>
      </View>;})}
     <View style={s.tip}><Icon name="quill" size={14} color={colors.gold}/><Text style={s.tipText}>These are only the quick ones. Type anything else you want to try, in your own words: sneak, bargain, search, climb, bluff.</Text></View>
    </ScrollView>
   </Pressable>
  </Pressable>
 </Modal>;
}
const s=StyleSheet.create({
 scrim:{flex:1,backgroundColor:tint('rgba(5,3,5,.82)'),alignItems:'center',justifyContent:'center',padding:12},
 sheet:{width:'100%',maxWidth:600,padding:16,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(22,16,23,.98)'),gap:10},
 head:{flexDirection:'row',alignItems:'flex-end',gap:10},over:{...type.label},title:{fontFamily:fonts.display,fontSize:22,fontWeight:'700',letterSpacing:1,color:colors.parchment,marginTop:2},
 close:{flexDirection:'row',alignItems:'center',gap:6,minHeight:38,paddingHorizontal:12,borderRadius:19,borderWidth:1,borderColor:tint('rgba(178,34,58,.5)'),backgroundColor:tint('rgba(31,24,32,.92)')},closeText:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:1.3,color:colors.gold,textTransform:'uppercase'},
 list:{gap:8,paddingBottom:4},
 row:{flexDirection:'row',alignItems:'flex-start',gap:12,padding:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.22)'),backgroundColor:tint('rgba(25,17,26,.72)')},
 mark:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.3)'},
 nameRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},name:{fontFamily:fonts.display,fontSize:15,fontWeight:'700',letterSpacing:.6,color:colors.parchment},
 cost:{paddingHorizontal:8,paddingVertical:2,borderRadius:10,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)')},costBonus:{borderColor:'rgba(111,208,196,.5)'},costText:{fontFamily:fonts.ui,fontSize:10.5,fontWeight:'700',letterSpacing:.4,color:colors.gold,textTransform:'uppercase'},
 facts:{fontFamily:fonts.ui,fontSize:11.5,color:tint('#b8aeb5'),marginTop:3},
 text:{fontFamily:fonts.story,fontSize:15.5,lineHeight:22,color:'#ded2cd',marginTop:4},
 use:{alignSelf:'center',minHeight:38,minWidth:54,paddingHorizontal:12,borderRadius:19,borderWidth:1,borderColor:tint('rgba(178,34,58,.5)'),backgroundColor:tint('rgba(31,24,32,.92)'),alignItems:'center',justifyContent:'center'},useText:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:1.3,color:colors.gold,textTransform:'uppercase'},
 tip:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:12},tipText:{flex:1,fontFamily:fonts.ui,fontSize:12.5,lineHeight:19,color:colors.muted},
});
