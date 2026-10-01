import React,{useEffect,useState} from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {Section,Segmented} from './ui';
import {brutalityLevels,storyPreferences,subscribeStoryPreferences,setStoryPreferences} from './storyPreferences';
import {fonts,colors} from './theme';
// Settings → Story: how graphic the Dungeon Master is when people are hurt and killed.
export function StorySettings(){
 const [prefs,setPrefs]=useState(storyPreferences);
 useEffect(()=>{setPrefs(storyPreferences());return subscribeStoryPreferences(setPrefs);},[]);
 const level=brutalityLevels.find(l=>l.id===prefs.brutality)??brutalityLevels[1];
 return <View dataSet={{qb:'plate'}} style={s.panel}>
  <Section icon="quill" title="Story" style={{marginTop:0,marginBottom:2}}/>
  <Text style={s.label}>Brutality</Text>
  <Segmented options={brutalityLevels.map(l=>[l.id,l.label,l.icon])} value={level.id} onChange={id=>setStoryPreferences({brutality:id})}/>
  <Text accessibilityLiveRegion="polite" style={s.caption}>{level.description}</Text>
  <Text style={s.note}>Fights are deadly either way: heroes and the people they meet can be killed, and a hero who dies stays dead.</Text>
 </View>;
}
const s=StyleSheet.create({panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18,gap:10},
 label:{fontFamily:fonts.display,color:colors.parchment,fontSize:14,fontWeight:'700',letterSpacing:.8},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20},note:{fontFamily:fonts.ui,color:colors.faint,fontSize:12,lineHeight:18}});
