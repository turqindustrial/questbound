import React,{useEffect,useState} from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {Section,Segmented} from './ui';
import {brutalityLevels,narrators,narratorOf,storyPreferences,subscribeStoryPreferences,setStoryPreferences} from './storyPreferences';
import {sampleNarrator} from './narrator';
import {fonts,colors} from './theme';
// Settings → Story: who tells the tale, and how graphic the Dungeon Master is when people are hurt and killed.
export function StorySettings(){
 const [prefs,setPrefs]=useState(storyPreferences);
 useEffect(()=>{setPrefs(storyPreferences());return subscribeStoryPreferences(setPrefs);},[]);
 const level=brutalityLevels.find(l=>l.id===prefs.brutality)??brutalityLevels[1];
 return <View dataSet={{qb:'plate'}} style={s.panel}>
  <Section icon="quill" title="Story" style={{marginTop:0,marginBottom:2}}/>
  <NarratorChoice/>
  <Text style={s.label}>Brutality</Text>
  <Segmented options={brutalityLevels.map(l=>[l.id,l.label,l.icon])} value={level.id} onChange={id=>setStoryPreferences({brutality:id})}/>
  <Text accessibilityLiveRegion="polite" style={s.caption}>{level.description}</Text>
  <Text style={s.note}>Fights are deadly either way: heroes and the people they meet can be killed, and a hero who dies stays dead.</Text>
 </View>;
}
// The narrator: chosen here and on the New Adventure screen (each follows the other). Choosing one reads its sample
// aloud when the narrator voice is on.
export function NarratorChoice({compact=false}){
 const [prefs,setPrefs]=useState(storyPreferences);
 useEffect(()=>{setPrefs(storyPreferences());return subscribeStoryPreferences(setPrefs);},[]);
 const teller=narratorOf(prefs.narrator);
 return <View style={{gap:8}}>
  <Text style={s.label}>{compact?'Told by':'Narrator'}</Text>
  <Segmented options={narrators.map(n=>[n.id,n.short,n.icon])} value={teller.id} onChange={id=>{setStoryPreferences({narrator:id});sampleNarrator(narratorOf(id).sample,{quiet:true});}}/>
  <Text accessibilityLiveRegion="polite" style={s.caption}><Text style={s.who}>{teller.name}. </Text>{teller.description}</Text>
  {!compact&&<Text style={s.sample}>“{teller.sample}”</Text>}
 </View>;
}
const s=StyleSheet.create({panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18,gap:10},
 label:{fontFamily:fonts.display,color:colors.parchment,fontSize:14,fontWeight:'700',letterSpacing:.8},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20},who:{color:colors.parchment,fontWeight:'600'},sample:{fontFamily:fonts.story,fontStyle:'italic',color:colors.text,fontSize:15,lineHeight:22},note:{fontFamily:fonts.ui,color:colors.faint,fontSize:12,lineHeight:18}});
