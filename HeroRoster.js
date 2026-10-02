import React,{useState} from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {GameButton,Section} from './ui';
import Icon from './Icon';
import HeroPortrait from './HeroPortrait';
import {fonts,colors,tint} from './theme';
// The heroes set aside on this device (switch to any of them) and the ones who died (remembered, not playable).
const when=iso=>{try{return new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});}catch{return '';}};
export default function HeroRoster({roster,graves,onPlay,onRetire,busy,compact}){
 const [confirm,setConfirm]=useState(null);
 if(!roster.length&&!graves.length)return null;
 return <View>
  {roster.length>0&&<><Section icon="people" title="Your other heroes"/>
   <Text style={s.note}>Each waits exactly where you left them. Playing one sets your current hero aside here.</Text>
   {roster.map(e=>{let hero=null;try{hero=JSON.parse(e.character);}catch{}const sum=e.summary;
    return <View key={e.id} dataSet={{qb:'plate'}} style={[s.card,compact&&{padding:12,gap:12}]}>
     {!!hero&&<HeroPortrait hero={hero} size={compact?46:56} level={sum.level}/>}
     <View style={{flex:1,minWidth:150}}>
      <Text numberOfLines={1} style={s.name}>{sum.name}</Text>
      <Text style={s.line}>Level {sum.level} · {sum.species} · {sum.class}</Text>
      {!!sum.story&&<Text numberOfLines={2} style={s.story}>{sum.story}{sum.place?' · '+sum.place:''}</Text>}
      <Text style={s.date}>Set aside {when(e.savedAt)}</Text>
     </View>
     {/* On a phone the two buttons sit side by side under the hero, across the whole card. */}
     <View style={[s.buttons,compact&&s.buttonsCompact]}>
      <GameButton icon="play" label={'Play '+sum.name.split(' ')[0]} variant="primary" disabled={busy} onPress={()=>{setConfirm(null);onPlay(e);}} style={[s.button,compact&&s.buttonCompact]}/>
      <GameButton icon="close" label={confirm===e.id?(compact?'Tap again':'Tap again to retire'):'Retire'} variant={confirm===e.id?'danger':'secondary'} disabled={busy} onPress={()=>{if(confirm===e.id){setConfirm(null);onRetire(e);}else setConfirm(e.id);}} style={[s.button,compact&&s.buttonCompact]}/>
     </View>
    </View>;})}
  </>}
  {graves.length>0&&<><Section icon="skull" title="The fallen"/>
   {graves.map(g=><View key={g.at+g.name} style={s.grave}>
    <Icon name="skull" size={16} color={colors.muted}/>
    <View style={{flex:1,minWidth:0}}>
     <Text style={s.graveName}>{g.name} <Text style={s.graveLine}>· Level {g.level} {g.class}</Text></Text>
     <Text style={s.graveCause}>{g.cause}{g.place?' at '+g.place:''}.</Text>
     <Text style={s.date}>{g.story?g.story+' · ':''}{when(g.at)}</Text>
    </View>
   </View>)}
  </>}
 </View>;
}
const s=StyleSheet.create({
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20,marginBottom:10},
 card:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:16,padding:16,marginBottom:10,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(31,24,32,.9)')},
 name:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:19,letterSpacing:.6},
 line:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:13,marginTop:2},
 story:{fontFamily:fonts.story,fontStyle:'italic',color:'#d4c5bf',fontSize:15,marginTop:4},
 date:{fontFamily:fonts.ui,color:colors.faint,fontSize:11.5,marginTop:4},
 buttons:{gap:8,flexGrow:1,minWidth:170,maxWidth:260},button:{marginTop:0},
 buttonsCompact:{flexDirection:'row',flexBasis:'100%',maxWidth:'100%'},buttonCompact:{flex:1,minWidth:0,paddingHorizontal:8},
 grave:{flexDirection:'row',gap:12,alignItems:'flex-start',paddingVertical:10,borderBottomWidth:1,borderBottomColor:tint('rgba(178,34,58,.15)')},
 graveName:{fontFamily:fonts.display,fontWeight:'700',color:'#cfc6b3',fontSize:15},graveLine:{fontFamily:fonts.ui,fontWeight:'400',color:colors.muted,fontSize:12.5},
 graveCause:{fontFamily:fonts.story,fontStyle:'italic',color:'#bdb3a0',fontSize:14.5,marginTop:2},
});
