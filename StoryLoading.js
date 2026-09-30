import React,{useEffect,useState} from 'react';
import {View,Text,StyleSheet,useWindowDimensions} from 'react-native';
import intros from './adventureIntros.json';
import Icon from './Icon';
import {fonts,colors} from './theme';
// While the Dungeon Master writes a new opening (usually 10–30 seconds), a loading screen in the manner of a console
// game: the chosen opening, a turning seal, a moving progress line and a new tip every few seconds.
const tips=[
 ['speak','Talk to anyone. Tap a person above the message box, or name them in what you type.'],
 ['d20','Every roll is real: the dice decide how it goes, the Dungeon Master tells you what it means.'],
 ['quill','You can type anything: sneak, bargain, search, bluff or try something clever.'],
 ['rest','Rest somewhere safe to recover hit points and spell slots.'],
 ['eye','Stuck? Ask the Dungeon Master what you notice.'],
 ['sound','Headphones bring out the score and the side each blow lands on.'],
 ['transfer','Settings → Move your hero copies a save code, a handy backup.'],
];
export default function StoryLoading({introId}){
 const {width}=useWindowDimensions(),intro=intros.find(i=>i.id===introId),[tip,setTip]=useState(()=>Math.floor(Math.random()*tips.length)),[seconds,setSeconds]=useState(0);
 useEffect(()=>{const a=setInterval(()=>setTip(t=>(t+1)%tips.length),5200),b=setInterval(()=>setSeconds(s=>s+1),1000);return()=>{clearInterval(a);clearInterval(b);};},[]);
 const title=intro?.id==='surprise'?'A tale of your own':intro?.title??'Your next adventure';
 const size=Math.max(24,Math.min(40,Math.floor((width-48)/(title.length*.62))));
 return <View dataSet={{qb:'scrim'}} style={[StyleSheet.absoluteFill,s.root]} accessibilityViewIsModal accessibilityLiveRegion="polite">
  <View dataSet={{qb:'launch-glow'}} style={[StyleSheet.absoluteFill,{opacity:.55,pointerEvents:'none'}]}/>
  <View dataSet={{qb:'enter-slow'}} style={s.content}>
   <View style={s.sealWrap}>
    <View dataSet={{qb:'bezel'}} style={s.bezel}/>
    <View dataSet={{qb:'launch-ring'}} style={s.seal}><Icon name="quill" size={40} color={colors.goldBright}/></View>
   </View>
   <Text style={s.overline}>The Dungeon Master is writing</Text>
   <Text dataSet={{qb:'title'}} style={[s.title,{fontSize:size,lineHeight:Math.round(size*1.25)}]}>{title}</Text>
   {!!intro?.setting&&<Text style={s.setting}>{intro.setting}</Text>}
   <View style={s.track}><View dataSet={{qb:'shimmer'}} style={s.fill}/></View>
   <Text style={s.time}>{seconds<25?'Names, places and a first conflict, made for your hero':seconds<60?'Still writing: a good opening takes a moment':'Taking longer than usual; it will appear as soon as it is ready'}</Text>
   <View key={tip} dataSet={{qb:'enter'}} style={s.tip}><Icon name={tips[tip][0]} size={16} color={colors.gold}/><Text style={s.tipText}>{tips[tip][1]}</Text></View>
  </View>
 </View>;
}
const s=StyleSheet.create({
 root:{zIndex:70,backgroundColor:'rgba(4,5,8,.94)',alignItems:'center',justifyContent:'center',padding:24},
 content:{alignItems:'center',maxWidth:560,width:'100%'},
 sealWrap:{width:150,height:150,alignItems:'center',justifyContent:'center',marginBottom:18},
 bezel:{position:'absolute',width:150,height:150,pointerEvents:'none'},
 seal:{width:104,height:104,borderRadius:52,borderWidth:2,borderColor:colors.gold,alignItems:'center',justifyContent:'center'},
 overline:{fontFamily:fonts.display,fontSize:11,letterSpacing:4.5,color:colors.goldMid,textTransform:'uppercase',textAlign:'center'},
 title:{fontFamily:fonts.logo,fontWeight:'900',color:colors.gold,textAlign:'center',marginTop:8,letterSpacing:1.5},
 setting:{fontFamily:fonts.story,fontStyle:'italic',fontSize:18,lineHeight:26,color:'#e6dac0',textAlign:'center',marginTop:8},
 track:{width:'70%',maxWidth:320,height:2,borderRadius:1,backgroundColor:'rgba(255,255,255,.08)',overflow:'hidden',marginTop:22},fill:{width:'100%',height:'100%',backgroundColor:colors.gold},
 time:{fontFamily:fonts.ui,fontSize:12,color:colors.faint,textAlign:'center',marginTop:10},
 tip:{flexDirection:'row',alignItems:'center',gap:10,marginTop:28,paddingVertical:12,paddingHorizontal:16,borderRadius:8,borderWidth:1,borderColor:'rgba(201,164,92,.28)',backgroundColor:'rgba(14,18,27,.75)',maxWidth:480},
 tipText:{flex:1,fontFamily:fonts.ui,fontSize:13.5,lineHeight:20,color:'#d9dde6'},
});
