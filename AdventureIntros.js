import React from 'react';
import {View,Text,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import intros from './adventureIntros.json';
import {GameButton,Ornament,ScreenTitle,Crest} from './ui';
import Icon from './Icon';
import {playSound} from './audio';
import {fonts,colors,type} from './theme';
const icons={hostile:'swords',surprise:'compass',crown:'crown',drowned:'wave',sunforge:'flame',winter:'frost',deep:'door',names:'eye',oath:'shield'};
// With a story behind them, a hero can carry on in the same region (the next chapter) or set out somewhere new.
function Continuation({continuation,continuing,onContinuing,busy}){
 return <View style={s.choice}>{[[true,'map','Continue in this region','The next tale begins a few miles from '+continuation.place+'. Everyone you met, the places you found, every grudge and debt, your companions and your pack come with you, and the country you know keeps its own map.'],[false,'compass','Somewhere new','Leave '+continuation.place+' behind. Your companions and your pack come with you; the rest of the world is new.']].map(([value,icon,title,copy])=>{const chosen=continuing===value;return <Pressable key={title} accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onContinuing(value);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:'gold'}} style={[s.card,s.option,chosen&&s.selected]}>
  <View style={s.top}><Crest icon={icon} size={40} color={colors.goldBright}/><Text style={[s.title,{flex:1,fontSize:19}]}>{title}</Text>{chosen&&<View style={s.check}><Icon name="check" size={16} color="#fff4f5" strokeWidth={2.4}/></View>}</View>
  <Text style={s.copy}>{copy}</Text></Pressable>;})}</View>;
}
export default function AdventureIntros({selected,onSelect,onStart,busy,error,continuation=null,continuing=false,onContinuing}){
 const narrow=useWindowDimensions().width<420;
 if(continuation&&continuing)return <View><ScreenTitle eyebrow="Next tale" icon="map" title="Where does your story go next?" sub={'After '+continuation.title+'.'}/>
  <Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>
  <View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':'play'} label={busy?'One moment…':'Begin the next tale'} disabled={busy} onPress={onStart} style={{marginTop:0}}/></View>
  <Ornament/><Text style={s.note}>Starting replaces your current adventure only after the new story has been created and saved.</Text></View>;
 return <View><ScreenTitle eyebrow="New adventure" icon="compass" title="Where does your story begin?" sub="Choose a tale. Each is written fresh for your hero: a long story told in chapters, with its own country, people, side errands and roads to other lands."/>
 {!!continuation&&<Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>}
 {/* The Begin button sits right under the chosen opening, so a phone player never scrolls to find it. */}
 {intros.map(intro=>{const chosen=selected===intro.id,hot=!!intro.local;return <React.Fragment key={intro.id}><Pressable accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onSelect(intro.id);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:hot?'hot':'gold'}} style={[s.card,chosen&&s.selected,hot&&s.combat,chosen&&hot&&{borderColor:colors.bloodBright}]}>
 <View style={s.top}><Crest icon={icons[intro.id]??'star'} size={46} color={hot?'#ffb39e':colors.goldBright}/><View style={{flex:1,minWidth:0}}>
  <View style={s.tags}><Text style={[s.tone,hot&&{color:'#ff9f86'}]}>{intro.tone.toUpperCase()}</Text>{intro.scale==='saga'&&<View style={s.tag}><Icon name="scroll" size={10} color={colors.gold}/><Text style={s.tagText}>LONG TALE</Text></View>}{hot&&<View style={[s.tag,s.tagHot]}><Icon name="bolt" size={10} color="#ffb39e"/><Text style={[s.tagText,{color:'#ffb39e'}]}>INSTANT</Text></View>}</View>
  <Text style={[s.title,narrow&&{fontSize:19}]}>{intro.title}</Text></View>{chosen&&<View style={[s.check,hot&&{backgroundColor:colors.bloodBright,borderColor:'#ffd2c2'}]}><Icon name="check" size={16} color="#fff4f5" strokeWidth={2.4}/></View>}</View>
 <Text style={[s.setting,narrow&&{fontSize:16,lineHeight:23}]}>{intro.setting}</Text>
 {/* The chosen opening tells what is wrong, where the road leads and what is at stake. */}
 {chosen&&<View style={s.facts}>{[[hot?'What it is':'The trouble',intro.conflict,'swords'],['The road',intro.journey,'travel'],['At stake',intro.stakes,'heart']].filter(f=>f[1]).map(([label,copy,icon])=><View key={label} style={s.fact}><View style={s.factHead}><Icon name={icon} size={12} color={colors.goldMid}/><Text style={s.label}>{label}</Text></View><Text style={s.copy}>{copy}</Text></View>)}</View>}
 <Text style={s.arrival}>— {intro.arrival}</Text></Pressable>
 {chosen&&<View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':hot?'swords':'play'} label={busy?(hot?'Drawing steel…':'One moment…'):'Begin '+(hot?'the encounter':'this adventure')} disabled={busy} onPress={onStart} style={{marginTop:0}}/></View>}</React.Fragment>;})}
 <Ornament/>
 <Text style={s.note}>Starting replaces your current adventure only after the new story has been created and saved.</Text></View>;
}
const s=StyleSheet.create({
 copy:{fontFamily:fonts.ui,color:'#d4ced2',lineHeight:23,fontSize:14.5,marginBottom:10},
 card:{padding:18,borderRadius:6,borderWidth:1,borderColor:'rgba(178,34,58,.25)',backgroundColor:'#211822',marginBottom:12},
 selected:{borderColor:colors.gold},combat:{borderColor:'rgba(200,65,47,.5)'},
 top:{flexDirection:'row',gap:14,alignItems:'center',marginBottom:10},
 tags:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:4},
 tone:{fontFamily:fonts.display,color:'#b58cff',fontSize:10,fontWeight:'700',letterSpacing:2},
 tag:{flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:'rgba(224,74,92,.45)',borderRadius:10,paddingHorizontal:7,paddingVertical:2},
 tagText:{fontFamily:fonts.ui,fontSize:9,fontWeight:'700',letterSpacing:1.1,color:colors.gold},
 tagHot:{borderColor:'rgba(240,106,79,.55)'},
 title:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:21,letterSpacing:.6},
 check:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.gold,borderWidth:1,borderColor:'#f06e80'},
 setting:{fontFamily:fonts.story,fontStyle:'italic',color:'#ded1cb',fontSize:17,lineHeight:25,marginBottom:8},
 label:{...type.label,fontSize:9},facts:{gap:2,marginTop:2,marginBottom:2,paddingTop:10,borderTopWidth:1,borderTopColor:'rgba(178,34,58,.18)'},fact:{},factHead:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:4},
 arrival:{fontFamily:fonts.story,color:'#de96a5',fontSize:15.5,fontStyle:'italic'},
 begin:{marginTop:-4,marginBottom:16},
 choice:{gap:0,marginBottom:6},option:{paddingVertical:14},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginBottom:4,textAlign:'center'},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:12}});
