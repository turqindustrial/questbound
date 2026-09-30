import {useSceneTransition} from './SceneTransition';
import React,{createContext,useContext,useState} from 'react';
import {View,Text,Pressable,Modal,ScrollView,StyleSheet,useWindowDimensions} from 'react-native';
import {encounterEntities,combatRoster,entityMentions} from './entityRules';
import DynamicArt from './DynamicArt';
import {fonts,colors,type} from './theme';
import {IconButton,StatBar} from './ui';
import Icon from './Icon';
const EncounterContext=createContext(null);
export function EntityText({children,...props}){
 const context=useContext(EncounterContext);
 const render=(child,key)=>typeof child==='string'?entityMentions(child,context?.entities??[]).map((part,i)=>part.id?<Text key={key+'-'+i} accessibilityRole="link" accessibilityLabel={'Open '+context.entities.find(e=>e.id===part.id).name+' character sheet'} onPress={event=>{event.stopPropagation?.();context.open(part.id);}} style={s.nameLink}>{part.text}</Text>:part.text):Array.isArray(child)?child.map((item,i)=>render(item,key+'-'+i)):child;
 return <Text {...props}>{render(children,'text')}</Text>;
}
export const useEncounter=()=>useContext(EncounterContext);
// hud: a round button sized like the other HUD controls, with or without its label.
export function CombatHealthButton({hud=false,label=true,activeOnly=false}){
 const context=useContext(EncounterContext);if(!context?.roster.length||(activeOnly&&!context.active))return null;
 if(hud)return context.active?<IconButton hot icon="swords" label="Combat: everyone's HP" onPress={()=>context.open('combat')}/>:<IconButton icon="heart" label="Last encounter: everyone's HP" onPress={()=>context.open('combat')}/>;
 return <Pressable accessibilityRole="button" accessibilityLabel="Show everyone's combat HP" onPress={()=>context.open('combat')} dataSet={{qb:'chip-hot'}} style={s.trigger}><View style={s.triggerRow}><Icon name="swords" size={16} color="#ffd2c2"/><Text style={s.triggerText}>Combat HP</Text></View></Pressable>;
}
export default function EncounterProvider({hero,game,health,children}){
 const transition=useSceneTransition(),{height,width}=useWindowDimensions();
 const [selected,setSelected]=useState(null),entities=encounterEntities(hero,game,health),roster=combatRoster(entities,game),entity=entities.find(e=>e.id===selected),combat=selected==='combat';
  const active=game.npcCombat?.active||game.stage==='combat';
 async function open(id){try{const art=entities.find(e=>e.id===id)?.art;if(art)await transition.prepare([art]);setSelected(id);}catch{}}
 return <EncounterContext.Provider value={{entities,roster,open,active}}>{children}
 <Modal visible={!!selected} transparent animationType="fade" onRequestClose={()=>setSelected(null)}>
 <Pressable accessibilityLabel="Close" onPress={()=>setSelected(null)} dataSet={{qb:'scrim'}} style={s.scrim}><Pressable onPress={()=>{}} accessibilityViewIsModal dataSet={{qb:'sheet'}} style={[s.modal,width<600&&{padding:16}]}>
 <View style={s.header}><View style={{flex:1,minWidth:0}}><Text style={s.overline}>{combat?(active?'Round '+(game.npcCombat?.round??game.round)+' · Remaining HP':'Encounter ended · current HP'):[entity?.species,entity?.className].filter(Boolean).join(' · ')||'Character'}</Text><Text accessibilityRole="header" numberOfLines={2} style={s.title}>{combat?'Combat encounter':entity?.name??'Character'}</Text></View><IconButton icon="close" label="Close" size={38} onPress={()=>setSelected(null)}/></View>
 <ScrollView style={{maxHeight:Math.max(120,Math.min(560,height*.9-110)),flexShrink:1}}>
 {combat?<>{roster.map(e=>{const enemy=e.side==='enemy',low=!enemy&&(e.hp??0)/Math.max(1,e.maximum)<=.3;return <View key={e.id} style={[s.member,enemy&&{borderColor:'rgba(220,90,70,.4)'}]}>
  <View style={s.memberTop}>
   <View style={[s.side,enemy&&{borderColor:'rgba(240,106,79,.6)'},e.side==='player'&&{borderColor:colors.gold}]}><Icon name={enemy?'swords':e.side==='player'?'sheet':'shield'} size={16} color={enemy?'#ffb39e':e.side==='player'?colors.goldBright:colors.heal}/></View>
   <View style={{flex:1,minWidth:0}}><Pressable accessibilityRole="link" onPress={()=>open(e.id)}><Text numberOfLines={1} style={[s.nameLink,s.memberName]}>{e.name}</Text></Pressable><Text style={s.memberMeta}>{e.side==='player'?'You':e.side==='ally'?'Ally':'Opponent'}{e.initiative!=null?' · Initiative '+e.initiative:''}{e.hp===0?' · Downed':''}</Text></View>
   <Text style={[s.hp,low&&{color:colors.bloodBright}]}>{e.hp??'—'}<Text style={s.hpMax}> / {e.maximum}</Text></Text>
  </View>
  <StatBar value={e.hp??0} maximum={e.maximum} kind={enemy?'enemy':'hp'} height={8}/>
  {!!e.temp&&<Text style={s.memberMeta}>+{e.temp} temporary HP</Text>}
 </View>;})}<Text style={s.note}>HP reflects the latest committed outcome, including while the turn plays back.</Text></>:entity&&<>
 {entity.art&&<DynamicArt dataSet={{qb:'portrait'}} subject={entity.art} resizeMode="contain" style={s.portrait}/>}
 <View style={s.facts}>{[['Race / species',entity.species],['Class',entity.className],['Level',entity.level],['Armor Class',entity.ac],['Hit Points',entity.hp==null?'Not in this encounter':entity.hp+' / '+entity.maximum],['Temporary HP',entity.temp]].filter(([,value])=>value!=null&&value!=='').map(([label,value])=><View key={label} dataSet={{qb:'plate'}} style={s.fact}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}</View>
 {!!entity.scores&&<><Text style={s.section}>Ability scores</Text><View style={s.facts}>{Object.entries(entity.scores??{}).map(([ability,score])=><View key={ability} dataSet={{qb:'plate'}} style={[s.fact,s.ability]}><Text style={s.label}>{ability.slice(0,3)}</Text><Text style={s.value}>{score}</Text><Text style={s.mod}>{Math.floor((score-10)/2)>=0?'+':''}{Math.floor((score-10)/2)}</Text></View>)}</View></>}
 {!!entity.description&&<Text style={s.description}>{entity.description}</Text>}{!!entity.note&&<Text style={s.note}>{entity.note}</Text>}
 {roster.length>0&&<Pressable accessibilityRole="button" dataSet={{qb:'chip-hot'}} style={s.trigger} onPress={()=>setSelected('combat')}><View style={s.triggerRow}><Icon name="swords" size={15} color="#ffd2c2"/><Text style={s.triggerText}>View combat HP</Text></View></Pressable>}
 </>}
 </ScrollView></Pressable></Pressable></Modal></EncounterContext.Provider>;
}
const s=StyleSheet.create({nameLink:{color:'#f3c98a',textDecorationLine:'underline',textDecorationStyle:'dotted',textDecorationColor:'rgba(232,199,123,.6)',fontWeight:'600'},
 trigger:{flexGrow:1,alignItems:'center',paddingHorizontal:16,paddingVertical:10,minHeight:44,borderRadius:22,borderWidth:1,borderColor:'rgba(200,65,47,.7)',backgroundColor:'rgba(60,18,14,.8)',justifyContent:'center',marginTop:10},triggerText:{fontFamily:fonts.display,color:'#ffd2c2',fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},triggerRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 scrim:{flex:1,backgroundColor:'rgba(2,3,6,.78)',alignItems:'center',justifyContent:'center',padding:16},
 modal:{width:'100%',maxWidth:600,maxHeight:'92%',backgroundColor:'rgba(13,17,26,.98)',borderWidth:1,borderColor:colors.goldLine,borderRadius:6,padding:24},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14,paddingBottom:12,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.22)'},
 overline:{...type.label,fontSize:9.5},
 title:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,fontSize:23,color:colors.parchment,marginTop:3},
 portrait:{aspectRatio:1,maxHeight:420,width:'100%',marginBottom:18,borderRadius:4},
 facts:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16},fact:{width:'30%',minWidth:108,flexGrow:1,padding:12,borderRadius:5,borderWidth:1,borderColor:'rgba(201,164,92,.22)'},
 ability:{minWidth:84,width:'15%',alignItems:'center'},mod:{fontFamily:fonts.ui,fontSize:12,fontWeight:'700',color:colors.gold,marginTop:2},
 label:{...type.label,fontSize:9,marginBottom:6},value:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:19},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:20,marginVertical:5},section:{...type.subheading,marginBottom:12},
 description:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:17,lineHeight:26,marginVertical:12},
 member:{padding:12,marginBottom:10,borderRadius:6,borderWidth:1,borderColor:'rgba(201,164,92,.22)',backgroundColor:'rgba(255,236,190,.03)',gap:8},
 memberTop:{flexDirection:'row',alignItems:'center',gap:12},memberName:{fontFamily:fonts.display,fontSize:16,letterSpacing:.5},memberMeta:{fontFamily:fonts.ui,fontSize:11.5,color:colors.muted,marginTop:2},
 side:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:'rgba(111,191,142,.6)',alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.25)'},
 hp:{fontFamily:fonts.display,fontWeight:'800',color:colors.parchment,fontSize:18,fontVariant:['tabular-nums']},hpMax:{fontSize:12,color:colors.muted,fontWeight:'400'},
});