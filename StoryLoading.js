import React,{useEffect,useState} from 'react';
import {View,Text,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import intros from './adventureIntros.json';
import Icon from './Icon';
import {fonts,colors,tint} from './theme';
// While the Dungeon Master writes a new tale (about three minutes when the story writer thinks hard, half a minute
// when it does not), a loading screen in the manner of a console game: the chosen opening, a turning seal, a moving
// progress line and a new tip every few seconds.
const tips=[
 ['speak','Talk to anyone. Tap a person above the message box, or name them in what you type.'],
 ['d20','Every roll is real: the dice decide how it goes, the Dungeon Master tells you what it means.'],
 ['quill','You can type anything: sneak, bargain, search, bluff or try something clever.'],
 ['rest','Rest somewhere safe to recover hit points and spell slots.'],
 ['eye','Stuck? Ask the Dungeon Master what you notice.'],
 ['sound','Headphones bring out the score and the side each blow lands on.'],
 ['transfer','Settings → Move your hero copies a save code, a handy backup.'],
 ['scroll','A long tale is told in chapters. The Quest tab shows the one under way and the leads you have heard of.'],
 ['map','The map marks places you have only heard of, and roads that lead to other lands.'],
 ['star','Finish chapters to earn levels. Take one whenever you are out of a fight.'],
 ['people','People speak first when you turn to them, and they remember how you treated them.'],
];
// A first-time player (one who has not yet dismissed the in-game "How to play" card) gets the same wait as a short
// primer instead: six pages they can turn at their own pace, so that when the tale arrives they know how to play it.
export const primer=[
 ['quill','You are the hero','Say what you do in your own words: search the room, bargain, sneak, start a fight. There are no wrong commands, and you can always ask what you notice.'],
 ['swords','Quick actions','The buttons above the message box are things you can do at once: speak to someone, travel, attack, rest. Tap one, or type instead.'],
 ['d20','The dice decide','When something is uncertain the game rolls real dice and adds your hero\'s skill. The Dungeon Master tells you what the roll means.'],
 ['heart','Fights are deadly','On your turn you have one action and one bonus action. Watch your hit points: drink a healing draught, or retreat. A hero who dies stays dead.'],
 ['people','People remember','Tap Speak to talk to someone. They remember how you treat them: some will help, some will travel with you, and some will never forgive you.'],
 ['map','Your tale','The Quest tab shows the chapter under way and the Map where you can go. If something goes wrong, tap DM beside the message box and tell the Dungeon Master.'],
];
const firstTime=()=>{try{return !globalThis.localStorage?.getItem('questbound.tips.v1');}catch{return false;}};
// `hero` mode covers the Dungeon Master drafting a complete character from the player's idea.
// `near` names the place the hero is leaving when the next tale is set in the same region.
export default function StoryLoading({introId,hero=null,near=null}){
 const {width,height}=useWindowDimensions(),intro=intros.find(i=>i.id===introId),[tip,setTip]=useState(()=>Math.floor(Math.random()*tips.length)),[seconds,setSeconds]=useState(0);
 // The primer turns its own pages slowly until the player turns one themselves.
 const [teaching]=useState(()=>hero==null&&firstTime()),[page,setPage]=useState(0),[turned,setTurned]=useState(false),small=height<720,tiny=height<480;
 useEffect(()=>{const a=setInterval(()=>setTip(t=>(t+1)%tips.length),5200),b=setInterval(()=>setSeconds(s=>s+1),1000);return()=>{clearInterval(a);clearInterval(b);};},[]);
 useEffect(()=>{if(!teaching||turned)return;const t=setInterval(()=>setPage(p=>Math.min(primer.length-1,p+1)),11000);return()=>clearInterval(t);},[teaching,turned]);
 const turn=by=>{setTurned(true);setPage(p=>Math.max(0,Math.min(primer.length-1,p+by)));};
 const title=hero!=null?'Your hero':near?'The next tale':intro?.id==='surprise'?'A tale of your own':intro?.title??'Your next adventure';
 const detail=hero!=null?(hero.trim()?'“'+hero.trim().slice(0,160)+'”':'Anyone the dice allow'):near?'A few miles from '+near+', in the country you know.':intro?.setting;
 // A phone on its side has little height: the title shrinks and the lines around it step aside for the primer.
 const size=Math.max(tiny?20:24,Math.min(tiny?24:40,Math.floor((width-48)/(title.length*.62))));
 return <View dataSet={{qb:'scrim'}} style={[StyleSheet.absoluteFill,s.root]} accessibilityViewIsModal accessibilityLiveRegion="polite">
  <View dataSet={{qb:'launch-glow'}} style={[StyleSheet.absoluteFill,{opacity:.55,pointerEvents:'none'}]}/>
  <View dataSet={{qb:'enter-slow'}} style={s.content}>
   {!(teaching&&small)&&<View style={s.sealWrap}>
    <View dataSet={{qb:'bezel'}} style={s.bezel}/>
    <View dataSet={{qb:'launch-ring'}} style={s.seal}><Icon name="quill" size={40} color={colors.goldBright}/></View>
   </View>}
   {!tiny&&<Text style={s.overline}>{hero!=null?'New character':'A new tale'}</Text>}
   <Text dataSet={{qb:'title',lig:'off'}} style={[s.title,{fontSize:size,lineHeight:Math.round(size*1.25)}]}>{title}</Text>
   {!!detail&&!(tiny&&teaching)&&<Text style={s.setting}>{detail}</Text>}
   <View style={[s.track,tiny&&{marginTop:10}]}><View dataSet={{qb:'shimmer'}} style={s.fill}/></View>
   {/* The host asked for this (2026-10-02): a small request for patience, shown from the start, saying why the wait
       is worth it. A tale takes about three minutes at the host's usual setting. */}
   {hero==null&&seconds<300&&<Text style={s.time}>Please be patient: a full, fresh story is being written for you in real time. This takes a few minutes.</Text>}
   {(hero!=null?seconds>=60:seconds>=300)&&<Text style={s.time}>Taking longer than usual; it will appear as soon as it is ready.</Text>}
   {teaching?<View dataSet={{qb:'plate'}} style={[s.primer,tiny&&{marginTop:10,padding:10}]}>
    <Text style={s.primerOver}>How to play, while you wait · {page+1} of {primer.length}</Text>
    <View key={page} dataSet={{qb:'enter'}} style={[s.primerBody,tiny&&{minHeight:64,paddingVertical:4}]}>
     <View style={s.primerHead}><Icon name={primer[page][0]} size={18} color={colors.gold}/><Text style={s.primerTitle}>{primer[page][1]}</Text></View>
     <Text style={[s.primerText,tiny&&{fontSize:13,lineHeight:18}]}>{primer[page][2]}</Text>
    </View>
    <View style={s.primerNav}>
     <Pressable accessibilityRole="button" accessibilityLabel="Previous page" disabled={page===0} onPress={()=>turn(-1)} dataSet={{qb:'chip'}} style={[s.primerButton,page===0&&{opacity:.35}]}><Icon name="back" size={14} color={colors.gold}/><Text style={s.primerButtonText}>Back</Text></Pressable>
     <View style={s.dots}>{primer.map((_,i)=><View key={i} style={[s.dot,i===page&&s.dotOn]}/>)}</View>
     <Pressable accessibilityRole="button" accessibilityLabel="Next page" disabled={page===primer.length-1} onPress={()=>turn(1)} dataSet={{qb:'chip'}} style={[s.primerButton,page===primer.length-1&&{opacity:.35}]}><Text style={s.primerButtonText}>Next</Text><Icon name="forward" size={14} color={colors.gold}/></Pressable>
    </View>
   </View>
   :<View key={tip} dataSet={{qb:'enter'}} style={s.tip}><Icon name={tips[tip][0]} size={16} color={colors.gold}/><Text style={s.tipText}>{tips[tip][1]}</Text></View>}
  </View>
 </View>;
}
const s=StyleSheet.create({
 root:{zIndex:70,backgroundColor:tint('rgba(7,5,7,.94)'),alignItems:'center',justifyContent:'center',padding:24},
 content:{alignItems:'center',maxWidth:600,width:'100%'},
 sealWrap:{width:150,height:150,alignItems:'center',justifyContent:'center',marginBottom:18},
 bezel:{position:'absolute',width:150,height:150,pointerEvents:'none'},
 seal:{width:104,height:104,borderRadius:52,borderWidth:2,borderColor:colors.gold,alignItems:'center',justifyContent:'center'},
 overline:{fontFamily:fonts.display,fontSize:11,letterSpacing:4.5,color:colors.goldMid,textTransform:'uppercase',textAlign:'center'},
 title:{fontFamily:fonts.display,fontWeight:'800',color:colors.gold,textAlign:'center',marginTop:8,letterSpacing:2.5},
 setting:{fontFamily:fonts.story,fontStyle:'italic',fontSize:18,lineHeight:26,color:'#ddcfca',textAlign:'center',marginTop:8},
 track:{width:'70%',maxWidth:320,height:2,borderRadius:1,backgroundColor:'rgba(255,255,255,.08)',overflow:'hidden',marginTop:22},fill:{width:'100%',height:'100%',backgroundColor:colors.gold},
 time:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:19,color:colors.muted,textAlign:'center',marginTop:12,maxWidth:420},
 tip:{flexDirection:'row',alignItems:'center',gap:10,marginTop:28,paddingVertical:12,paddingHorizontal:16,borderRadius:8,borderWidth:1,borderColor:tint('rgba(178,34,58,.28)'),backgroundColor:tint('rgba(23,17,24,.75)'),maxWidth:480},
 tipText:{flex:1,fontFamily:fonts.ui,fontSize:13.5,lineHeight:20,color:tint('#e2dde1')},
 primer:{alignSelf:'stretch',marginTop:22,padding:16,borderRadius:8,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(23,17,24,.82)')},
 primerOver:{fontFamily:fonts.display,fontSize:10,letterSpacing:2.2,color:colors.goldMid,textTransform:'uppercase',textAlign:'center'},
 primerBody:{minHeight:112,justifyContent:'center',paddingVertical:10},
 primerHead:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,marginBottom:6},
 primerTitle:{fontFamily:fonts.display,fontSize:17,fontWeight:'700',letterSpacing:1,color:colors.parchment},
 primerText:{fontFamily:fonts.ui,fontSize:14,lineHeight:21,color:tint('#e2dde1'),textAlign:'center'},
 primerNav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 primerButton:{flexDirection:'row',alignItems:'center',gap:6,minHeight:40,minWidth:84,justifyContent:'center',paddingHorizontal:12,borderRadius:20,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(20,15,21,.8)')},
 primerButtonText:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:1.4,color:colors.gold,textTransform:'uppercase'},
 dots:{flexDirection:'row',gap:6,alignItems:'center'},dot:{width:6,height:6,borderRadius:3,backgroundColor:tint('rgba(178,34,58,.45)')},dotOn:{width:8,height:8,borderRadius:4,backgroundColor:colors.goldBright},
});
