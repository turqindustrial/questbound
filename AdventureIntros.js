import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import intros from './adventureIntros.json';
import {GameButton,Ornament,ScreenTitle,Crest} from './ui';
import Icon from './Icon';
import {playSound} from './audio';
import {fonts,colors,type} from './theme';
const icons={hostile:'swords',surprise:'compass',caravan:'sun',harbor:'frost',canal:'eye',garden:'leaf',hollow:'spell'};
// With a story behind them, a hero can carry on in the same region (the next chapter) or set out somewhere new.
function Continuation({continuation,continuing,onContinuing,busy}){
 return <View style={s.choice}>{[[true,'map','Continue in this region','The next chapter begins a few miles from '+continuation.place+'. Everyone you met, the places you found, every grudge and debt, your companions and your pack come with you, and the country you know keeps its own map.'],[false,'compass','Somewhere new','Leave '+continuation.place+' behind. Your companions and your pack come with you; the rest of the world is new.']].map(([value,icon,title,copy])=>{const chosen=continuing===value;return <Pressable key={title} accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onContinuing(value);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:'gold'}} style={[s.card,s.option,chosen&&s.selected]}>
  <View style={s.top}><Crest icon={icon} size={40} color={colors.goldBright}/><Text style={[s.title,{flex:1,fontSize:19}]}>{title}</Text>{chosen&&<View style={s.check}><Icon name="check" size={16} color="#1a0f05" strokeWidth={2.4}/></View>}</View>
  <Text style={s.copy}>{copy}</Text></Pressable>;})}</View>;
}
export default function AdventureIntros({selected,onSelect,onStart,busy,error,continuation=null,continuing=false,onContinuing}){
 if(continuation&&continuing)return <View><ScreenTitle eyebrow="Next chapter" icon="map" title="Where does your story go next?" sub={'After '+continuation.title+'.'}/>
  <Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>
  <View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':'play'} label={busy?'One moment…':'Begin the next chapter'} disabled={busy} onPress={onStart} style={{marginTop:0}}/></View>
  <Ornament/><Text style={s.note}>Starting replaces your current adventure only after the new story has been created and saved.</Text></View>;
 return <View><ScreenTitle eyebrow="New adventure" icon="compass" title="Where does your story begin?" sub="Choose an opening. The Dungeon Master creates new names, discoveries and a way forward around it."/>
 {!!continuation&&<Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>}
 {/* The Begin button sits right under the chosen opening, so a phone player never scrolls to find it. */}
 {intros.map(intro=>{const chosen=selected===intro.id,hot=!!intro.local;return <React.Fragment key={intro.id}><Pressable accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onSelect(intro.id);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:hot?'hot':'gold'}} style={[s.card,chosen&&s.selected,hot&&s.combat,chosen&&hot&&{borderColor:colors.bloodBright}]}>
 <View style={s.top}><Crest icon={icons[intro.id]??'star'} size={46} color={hot?'#ffb39e':colors.goldBright}/><View style={{flex:1,minWidth:0}}>
  <View style={s.tags}><Text style={[s.tone,hot&&{color:'#ff9f86'}]}>{intro.tone.toUpperCase()}</Text>{intro.openingDialogue&&<View style={s.tag}><Icon name="speak" size={10} color={colors.gold}/><Text style={s.tagText}>OPENS WITH DIALOGUE</Text></View>}{hot&&<View style={[s.tag,s.tagHot]}><Icon name="bolt" size={10} color="#ffb39e"/><Text style={[s.tagText,{color:'#ffb39e'}]}>INSTANT</Text></View>}</View>
  <Text style={s.title}>{intro.title}</Text></View>{chosen&&<View style={[s.check,hot&&{backgroundColor:colors.bloodBright,borderColor:'#ffd2c2'}]}><Icon name="check" size={16} color="#1a0f05" strokeWidth={2.4}/></View>}</View>
 <Text style={s.setting}>{intro.setting}</Text>
 {chosen&&<><Text style={s.label}>The first conflict</Text><Text style={s.copy}>{intro.conflict}</Text></>}
 <Text style={s.arrival}>— {intro.arrival}</Text></Pressable>
 {chosen&&<View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':hot?'swords':'play'} label={busy?(hot?'Drawing steel…':'One moment…'):'Begin '+(hot?'the encounter':'this adventure')} disabled={busy} onPress={onStart} style={{marginTop:0}}/></View>}</React.Fragment>;})}
 <Ornament/>
 <Text style={s.note}>Starting replaces your current adventure only after the new story has been created and saved.</Text></View>;
}
const s=StyleSheet.create({
 copy:{fontFamily:fonts.ui,color:'#c9ced9',lineHeight:23,fontSize:14.5,marginBottom:10},
 card:{padding:18,borderRadius:6,borderWidth:1,borderColor:'rgba(201,164,92,.25)',backgroundColor:'#141a26',marginBottom:12},
 selected:{borderColor:colors.gold},combat:{borderColor:'rgba(200,65,47,.5)'},
 top:{flexDirection:'row',gap:14,alignItems:'center',marginBottom:10},
 tags:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:4},
 tone:{fontFamily:fonts.display,color:'#9fc4bf',fontSize:10,fontWeight:'700',letterSpacing:2},
 tag:{flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:'rgba(232,199,123,.45)',borderRadius:10,paddingHorizontal:7,paddingVertical:2},
 tagText:{fontFamily:fonts.ui,fontSize:9,fontWeight:'700',letterSpacing:1.1,color:colors.gold},
 tagHot:{borderColor:'rgba(240,106,79,.55)'},
 title:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:21,letterSpacing:.6},
 check:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.gold,borderWidth:1,borderColor:'#fff0c4'},
 setting:{fontFamily:fonts.story,fontStyle:'italic',color:'#e7dcc2',fontSize:17,lineHeight:25,marginBottom:8},
 label:{...type.label,fontSize:9,marginTop:4,marginBottom:6},
 arrival:{fontFamily:fonts.story,color:'#dfbe8c',fontSize:15.5,fontStyle:'italic'},
 begin:{marginTop:-4,marginBottom:16},
 choice:{gap:0,marginBottom:6},option:{paddingVertical:14},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginBottom:4,textAlign:'center'},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:12}});
