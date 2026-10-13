import React,{useEffect,useState} from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {Section,Toggle} from './ui';
import {readInsight,setInsight,subscribeInsight} from './playMetrics';
import {fonts,colors} from './theme';
// Settings → Help improve Questbound (per device): the anonymous play counts (playMetrics.js) and the "How was that
// session?" question (SessionRating.js). Both are on unless turned off here; the privacy policy says what they carry.
export function InsightSettings(){
 const [prefs,setPrefs]=useState(readInsight);
 useEffect(()=>{setPrefs(readInsight());return subscribeInsight(()=>setPrefs(readInsight()));},[]);
 return <View dataSet={{qb:'plate'}} style={s.panel}>
  <Section icon="feedback" title="Help improve Questbound" style={{marginTop:0,marginBottom:2}}/>
  <Toggle value={prefs.counts} onChange={on=>setInsight({counts:on})} label="Share anonymous play counts" description="When you stop playing, the host gets numbers only: how long you played, how many turns you took and how many failed, where you stopped, the tale you chose and whether this is a phone. Never what you type, names or your story."/>
  <Toggle value={prefs.ask} onChange={on=>setInsight({ask:on})} label="Ask how a session went" description="Now and then, at a good stopping point, a small card asks “How was that session?”. One tap answers; at most once a day."/>
  <Text style={s.note}>Counts are kept by the host for 180 days. Turning them off forgets this device’s random counting id.</Text>
 </View>;
}
const s=StyleSheet.create({panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18,gap:10},note:{fontFamily:fonts.ui,color:colors.faint,fontSize:12,lineHeight:18}});
