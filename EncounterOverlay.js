import {useSceneTransition} from './SceneTransition';
import React,{createContext,useContext,useState} from 'react';
import {View,Text,Pressable,Modal,ScrollView,StyleSheet,useWindowDimensions} from 'react-native';
import {encounterEntities,combatRoster,entityMentions} from './entityRules';
import DynamicArt from './DynamicArt';
import {fonts,colors,type} from './theme';
const EncounterContext=createContext(null);
export function EntityText({children,...props}){
 const context=useContext(EncounterContext);
 const render=(child,key)=>typeof child==='string'?entityMentions(child,context?.entities??[]).map((part,i)=>part.id?<Text key={key+'-'+i} accessibilityRole="link" accessibilityLabel={'Open '+context.entities.find(e=>e.id===part.id).name+' character sheet'} onPress={event=>{event.stopPropagation?.();context.open(part.id);}} style={s.nameLink}>{part.text}</Text>:part.text):Array.isArray(child)?child.map((item,i)=>render(item,key+'-'+i)):child;
 return <Text {...props}>{render(children,'text')}</Text>;
}
export const useEncounter=()=>useContext(EncounterContext);
// hud: a round button sized like the other HUD controls, with or without its label.
export function CombatHealthButton({hud=false,label=true}){
 const context=useContext(EncounterContext);if(!context?.roster.length)return null;
 return <Pressable accessibilityRole="button" accessibilityLabel="Show everyone's combat HP" onPress={()=>context.open('combat')} style={hud?s.hudTrigger:s.trigger}><Text style={s.triggerText}>{hud&&!label?'⚔':'⚔  Combat HP'}</Text></Pressable>;
}
export default function EncounterProvider({hero,game,health,children}){
 const transition=useSceneTransition(),{height,width}=useWindowDimensions();
 const [selected,setSelected]=useState(null),entities=encounterEntities(hero,game,health),roster=combatRoster(entities,game),entity=entities.find(e=>e.id===selected),combat=selected==='combat';
  const active=game.npcCombat?.active||game.stage==='combat';
 async function open(id){try{const art=entities.find(e=>e.id===id)?.art;if(art)await transition.prepare([art]);setSelected(id);}catch{}}
 return <EncounterContext.Provider value={{entities,roster,open}}>{children}
 <Modal visible={!!selected} transparent animationType="fade" onRequestClose={()=>setSelected(null)}>
 <View style={s.scrim}><View accessibilityViewIsModal dataSet={{qb:'panel'}} style={[s.modal,width<600&&{padding:14}]}>
 <View style={s.header}><Text accessibilityRole="header" style={s.title}>{combat?'Combat encounter':entity?.name??'Character'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close character popup" onPress={()=>setSelected(null)} style={s.close}><Text style={s.closeText}>Close ×</Text></Pressable></View>
 <ScrollView style={{maxHeight:Math.max(120,Math.min(550,height*.9-100)),flexShrink:1}}>
 {combat?<><Text style={s.note}>{active?'Remaining HP · Round '+(game.npcCombat?.round??game.round):'Encounter ended · current HP'}</Text>{roster.map(e=><View key={e.id} style={s.member}><Pressable accessibilityRole="link" onPress={()=>open(e.id)}><Text style={s.nameLink}>{e.name}</Text></Pressable><Text style={s.note}>{e.side==='player'?'You':e.side==='ally'?'Ally':'Opponent'}{e.initiative!=null?' · Initiative '+e.initiative:''}</Text><Text style={s.hp}>{e.hp??'—'} / {e.maximum} HP{e.temp?' · '+e.temp+' temporary HP':''}{e.hp===0?' · Downed':''}</Text><View style={s.track}><View dataSet={{qb:e.side==='enemy'?'bar-enemy':'bar-hp'}} style={[s.fill,{width:Math.max(0,Math.min(100,100*(e.hp??0)/e.maximum))+'%'}]}/></View></View>)}<Text style={s.note}>HP reflects the latest committed outcome, including while the turn plays back.</Text></>:entity&&<>
 {entity.art&&<DynamicArt subject={entity.art} resizeMode="contain" style={s.portrait}/>}
 <View style={s.facts}>{[['Race / species',entity.species],['Class',entity.className],['Level',entity.level],['Armor Class',entity.ac],['Hit Points',entity.hp==null?'Not in this encounter':entity.hp+' / '+entity.maximum],['Temporary HP',entity.temp]].map(([label,value])=><View key={label} style={s.fact}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}</View>
 <Text style={s.section}>Ability scores</Text><View style={s.facts}>{Object.entries(entity.scores??{}).map(([ability,score])=><View key={ability} style={s.fact}><Text style={s.label}>{ability}</Text><Text style={s.value}>{score} <Text style={s.note}>({Math.floor((score-10)/2)>=0?'+':''}{Math.floor((score-10)/2)})</Text></Text></View>)}</View>
 {!!entity.description&&<Text style={s.description}>{entity.description}</Text>}{!!entity.note&&<Text style={s.note}>{entity.note}</Text>}
 {roster.length>0&&<Pressable accessibilityRole="button" style={s.trigger} onPress={()=>setSelected('combat')}><Text style={s.triggerText}>View combat HP</Text></Pressable>}
 </>}
 </ScrollView></View></View></Modal></EncounterContext.Provider>;
}
const s=StyleSheet.create({nameLink:{color:'#f3c98a',textDecorationLine:'underline',textDecorationStyle:'dotted',textDecorationColor:'rgba(232,199,123,.6)',fontWeight:'600'},
 trigger:{flexGrow:1,alignItems:'center',paddingHorizontal:16,paddingVertical:10,minHeight:44,borderRadius:3,borderWidth:1,borderColor:'rgba(200,65,47,.7)',backgroundColor:'rgba(60,18,14,.8)',justifyContent:'center'},triggerText:{fontFamily:fonts.display,color:'#ffd2c2',fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
 hudTrigger:{minWidth:40,minHeight:40,paddingHorizontal:12,borderRadius:20,borderWidth:1,borderColor:'rgba(200,65,47,.7)',backgroundColor:'rgba(60,18,14,.8)',alignItems:'center',justifyContent:'center'},
 scrim:{flex:1,backgroundColor:'rgba(2,3,6,.78)',alignItems:'center',justifyContent:'center',padding:16},
 modal:{width:'100%',maxWidth:640,maxHeight:'90%',backgroundColor:'rgba(13,17,26,.98)',borderWidth:1,borderColor:colors.goldLine,borderRadius:4,padding:24},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14,paddingBottom:12,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.22)'},
 title:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1.2,fontSize:24,color:colors.parchment,flexShrink:1},close:{padding:10,minHeight:44,justifyContent:'center'},closeText:{fontFamily:fonts.display,letterSpacing:1.4,color:colors.gold,fontWeight:'700',fontSize:12,textTransform:'uppercase'},
 portrait:{aspectRatio:1,maxHeight:440,width:'100%',marginBottom:18,borderRadius:3},
 facts:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16},fact:{width:'30%',minWidth:110,flexGrow:1,padding:12,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.2)',backgroundColor:'rgba(255,236,190,.03)'},
 label:{...type.label,fontSize:9,marginBottom:6},value:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:19},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:20,marginVertical:5},section:{...type.subheading,marginBottom:12},
 description:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:17,lineHeight:26,marginVertical:12},
 member:{padding:14,marginBottom:10,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.2)',backgroundColor:'rgba(255,236,190,.03)'},
 hp:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:17,marginVertical:5},
 track:{height:8,borderRadius:2,backgroundColor:'rgba(0,0,0,.55)',borderWidth:1,borderColor:'rgba(201,164,92,.3)',overflow:'hidden',marginTop:6},fill:{height:'100%',backgroundColor:'#94b58d'}});
