import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import intros from './adventureIntros.json';
import {GameButton,Ornament} from './ui';
import {fonts,colors,type} from './theme';
const glyphs={hostile:'⚔',surprise:'✦',caravan:'☼',harbor:'❄',canal:'⚜',garden:'❀',hollow:'☾'};
export default function AdventureIntros({selected,onSelect,onStart,busy,error}){
 return <View><Text style={s.lead}>Where does your story begin?</Text><Text style={s.copy}>Choose an opening. The Dungeon Master will create new names, discoveries, and a way forward around it.</Text>
 {/* The Begin button sits right under the chosen opening, so a phone player never scrolls to find it. */}
 {intros.map(intro=>{const chosen=selected===intro.id;return <React.Fragment key={intro.id}><Pressable accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>onSelect(intro.id)} dataSet={{qb:'card',selected:String(chosen)}} style={[s.card,chosen&&s.selected,intro.local&&s.combat]}>
 <View style={s.top}><Text style={[s.glyph,intro.local&&{color:colors.bloodBright}]}>{glyphs[intro.id]??'✦'}</Text><View style={{flex:1}}>
  <View style={s.tags}><Text style={[s.tone,intro.local&&{color:'#ff9f86'}]}>{intro.tone.toUpperCase()}</Text>{intro.openingDialogue&&<Text style={s.tag}>OPENS WITH DIALOGUE</Text>}{intro.local&&<Text style={[s.tag,s.tagHot]}>INSTANT · NO AI STORY</Text>}</View>
  <Text style={s.title}>{intro.title}</Text></View>{chosen&&<Text style={s.check}>✓</Text>}</View>
 <Text style={s.setting}>{intro.setting}</Text><Text style={s.label}>The first conflict</Text><Text style={s.copy}>{intro.conflict}</Text><Text style={s.arrival}>— {intro.arrival}</Text></Pressable>
 {chosen&&<View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" label={busy?(intro.local?'Drawing steel…':'The Dungeon Master is writing your opening…'):'Begin '+(intro.local?'the encounter':'this adventure')+'  ›'} disabled={busy} onPress={onStart} style={{marginTop:0}}/></View>}</React.Fragment>;})}
 <Ornament/>
 <Text style={s.note}>Starting replaces your current adventure only after the new story has been created and saved.</Text></View>;
}
const s=StyleSheet.create({lead:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,color:colors.gold,fontSize:24,marginBottom:10},
 copy:{fontFamily:fonts.ui,color:'#c9ced9',lineHeight:23,fontSize:14.5,marginBottom:10},
 card:{padding:20,borderRadius:4,borderWidth:1,borderColor:'rgba(201,164,92,.25)',backgroundColor:'#141a26',marginBottom:12},
 selected:{borderColor:colors.gold},combat:{borderColor:'rgba(200,65,47,.5)'},
 top:{flexDirection:'row',gap:14,alignItems:'flex-start',marginBottom:10},
 glyph:{fontSize:26,color:colors.gold,width:34,textAlign:'center',marginTop:4},
 tags:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:6},
 tone:{fontFamily:fonts.display,color:'#9fc4bf',fontSize:10,fontWeight:'700',letterSpacing:2},
 tag:{fontFamily:fonts.ui,fontSize:9,fontWeight:'700',letterSpacing:1.2,color:colors.gold,borderWidth:1,borderColor:'rgba(232,199,123,.45)',borderRadius:2,paddingHorizontal:6,paddingVertical:2},
 tagHot:{color:'#ffb39e',borderColor:'rgba(240,106,79,.55)'},
 title:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:22,letterSpacing:.8},
 check:{fontFamily:fonts.display,color:colors.gold,fontSize:22,fontWeight:'800'},
 setting:{fontFamily:fonts.story,fontStyle:'italic',color:'#e7dcc2',fontSize:17,lineHeight:25,marginBottom:10},
 label:{...type.label,fontSize:9,marginTop:4,marginBottom:6},
 arrival:{fontFamily:fonts.story,color:'#dfbe8c',fontSize:15.5,fontStyle:'italic'},
 begin:{marginTop:-4,marginBottom:16},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginBottom:4,textAlign:'center'},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:12}});
