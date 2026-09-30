import React,{useState,useEffect,useRef} from 'react';
import {View,Text,Pressable,Modal,StyleSheet,useWindowDimensions} from 'react-native';
import {CombatHealthButton} from './EncounterOverlay';
import {FullscreenToggle} from './DisplayControls';
import {AudioToggle} from './AudioControls';
import {GameButton,StatBar,IconButton,Crest,useCountTo,HpFloaters} from './ui';
import Icon from './Icon';
import {classIcons} from './iconPaths';
import HeroPortrait from './HeroPortrait';
import FeedbackSheet from './Feedback';
import {displayState,subscribeDisplay,toggleFullscreen} from './fullscreen';
import {audioSettings,subscribeAudio,setAudio,playSound} from './audio';
import {useShownHp} from './cinematics';
import {shortcutsBlocked} from './keyboard';
import {fonts,colors,type} from './theme';
// The in-game heads-up display: always on screen, never scrolls away. HP follows the story as a turn plays out.
export default function GameHud({hero,health,maxHp,wide,onNavigate,levelUp,onLevelUp,feedback={}}){
 const [menu,setMenu]=useState(false),[notes,setNotes]=useState(false),shown=useShownHp();
 const hp=shown.hero??health?.current??maxHp,temp=health?.temp??0,low=hp/Math.max(1,maxHp)<=.3,hpCount=useCountTo(hp);
 // Labels and the wordmark appear only when there is room, so every control stays on screen at any width.
 const {width,height}=useWindowDimensions(),wordmark=wide&&width>=1100,short=height<520,roomy=wide&&width>=900;
 const go=target=>{setMenu(false);playSound('page');onNavigate(target);};
 // Keyboard, as in a PC game: M or Esc opens the menu, J the journal, C the character sheet, P the party.
 const keys=useRef(null);keys.current={go,menu,open:()=>{setMenu(true);playSound('open');},close:()=>setMenu(false)};
 useEffect(()=>{
  if(typeof document==='undefined')return;
  const onKey=e=>{if(e.key==='Escape'&&keys.current.menu){e.preventDefault();keys.current.close();return;}if(e.ctrlKey||e.metaKey||e.altKey||shortcutsBlocked())return;
   const k=e.key.toLowerCase(),target={j:'Campaign Journal',c:'Character Sheet',p:'Followers'}[k];
   if(k==='escape'||k==='m'){e.preventDefault();keys.current.open();}else if(target){e.preventDefault();keys.current.go(target);}};
  document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
 },[]);
 return <View dataSet={{qb:'hud'}} style={[s.bar,!wide&&s.barCompact,short&&{paddingVertical:4}]}>
  {wordmark&&<View style={s.brand}><Text dataSet={{qb:'title'}} style={s.wordmark}>Questbound</Text><View style={s.divider}/></View>}
  <Pressable accessibilityRole="button" accessibilityLabel={'Open '+hero.name+"'s character sheet"} onPress={()=>go('Character Sheet')} style={s.identity}>
   <View dataSet={{qb:low?'low-ring':undefined}}><HeroPortrait hero={hero} size={wide&&!short?44:34} level={hero.level}/></View>
   <View style={[s.hero,!wide&&{flex:1}]}>
    <View style={s.heroTop}><Text numberOfLines={1} style={[s.name,!wide&&{fontSize:15}]}>{hero.name}</Text>{(wide||width>=400)&&<Text numberOfLines={1} style={s.meta}>{roomy?'Level '+hero.level+' '+hero.class:'Lv '+hero.level+' '+hero.class}</Text>}</View>
    <View style={s.hpRow}>
     <Icon name="heart" size={wide?14:12} color={low?colors.bloodBright:colors.heal}/>
     <View style={{flex:1}}><StatBar value={hp} maximum={maxHp} height={wide?10:8}/></View>
     <View><Text style={[s.hp,low&&{color:colors.bloodBright}]}>{hpCount}<Text style={s.hpMax}>/{maxHp}</Text>{temp>0?<Text style={s.temp}> +{temp}</Text>:null}</Text><HpFloaters value={hp}/></View>
    </View>
   </View>
  </Pressable>
  {levelUp&&<Pressable accessibilityRole="button" accessibilityLabel="Level up" onPress={onLevelUp} dataSet={{qb:'btn-primary'}} style={s.levelUp}><Icon name="star" size={14} color="#2a1a07"/>{wide&&<Text style={s.levelUpText}>Level up</Text>}</Pressable>}
  {wide?<View style={s.actions}>
    <IconButton icon="journal" label="Journal" tip="Journal · J" onPress={()=>go('Campaign Journal')}/>
    <IconButton icon="sheet" label="Character sheet" tip="Character sheet · C" onPress={()=>go('Character Sheet')}/>
    <IconButton icon="party" label="Party" tip="Party · P" onPress={()=>go('Followers')}/>
    <CombatHealthButton hud/>
    <View style={s.divider}/>
    <FullscreenToggle compact/><AudioToggle compact/>
    <IconButton icon="menu" label="Game menu" tip="Menu · M" onPress={()=>{setMenu(true);playSound('open');}}/>
   </View>
   :<View style={s.actions}><CombatHealthButton hud/><AudioToggle compact/><IconButton icon="menu" label="Game menu" onPress={()=>{setMenu(true);playSound('open');}}/></View>}
  <GameMenu visible={menu} hero={hero} hp={hp} maxHp={maxHp} onClose={()=>setMenu(false)} go={go} onFeedback={()=>{setMenu(false);setNotes(true);}}/>
  <FeedbackSheet visible={notes} onClose={()=>setNotes(false)} context={feedback}/>
 </View>;
}
function GameMenu({visible,onClose,go,onFeedback,hero,hp,maxHp}){
 const [display,setDisplay]=useState(displayState),[audio,setAudioState]=useState(audioSettings);
 useEffect(()=>subscribeDisplay(setDisplay),[]);useEffect(()=>subscribeAudio(setAudioState),[]);
 const cell=(icon,label,onPress)=><Pressable key={label} accessibilityRole="button" onPress={onPress} dataSet={{qb:'btn'}} style={s.cell}><Icon name={icon} size={20} color={colors.gold}/><Text style={s.cellText}>{label}</Text></Pressable>;
 return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}><Pressable accessibilityLabel="Close menu" onPress={onClose} dataSet={{qb:'scrim'}} style={s.scrim}><Pressable onPress={()=>{}} dataSet={{qb:'sheet'}} style={s.sheet} accessibilityViewIsModal>
  <View style={s.menuHead}>
   <HeroPortrait hero={hero} size={52} level={hero.level}/>
   <View style={{flex:1,minWidth:0}}><Text style={s.overline}>Paused</Text><Text numberOfLines={1} style={s.menuTitle}>{hero.name}</Text><Text style={s.menuMeta}>Level {hero.level} {hero.species??hero.race} {hero.class} · {hp}/{maxHp} HP</Text></View>
  </View>
  <GameButton variant="primary" icon="play" label="Resume" onPress={onClose}/>
  <View style={s.grid}>
   {cell('journal','Journal',()=>go('Campaign Journal'))}
   {cell('sheet','Character',()=>go('Character Sheet'))}
   {cell('party','Party',()=>go('Followers'))}
   {cell('settings','Settings',()=>go('Settings'))}
   {display.supported&&cell(display.fullscreen?'shrink':'expand',display.fullscreen?'Exit full screen':'Full screen',toggleFullscreen)}
   {cell(audio.muted?'sound':'mute',audio.muted?'Sound on':'Mute',()=>setAudio({muted:!audio.muted}))}
   {cell('feedback','Send feedback',onFeedback)}
   {cell('home','Main menu',()=>go('Home'))}
  </View>
  <Text style={s.menuNote}>Your adventure is saved on this device after every turn.</Text>
 </Pressable></Pressable></Modal>;
}
const s=StyleSheet.create({
 bar:{position:'relative',zIndex:5,flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:16,paddingVertical:8,backgroundColor:'rgba(8,10,16,.9)'},
 barCompact:{gap:8,paddingHorizontal:10,paddingVertical:6},
 brand:{flexDirection:'row',alignItems:'center',gap:14},wordmark:{fontFamily:fonts.logo,fontSize:19,fontWeight:'900',letterSpacing:2.5,color:colors.gold},
 divider:{width:1,height:26,backgroundColor:'rgba(201,164,92,.3)',marginHorizontal:2},
 identity:{flexDirection:'row',alignItems:'center',gap:12,flexShrink:1,flexGrow:1,minWidth:0,maxWidth:470},
 hero:{flexShrink:1,minWidth:120,flexGrow:1,gap:5},heroTop:{flexDirection:'row',alignItems:'baseline',gap:8},
 name:{fontFamily:fonts.display,fontSize:17,fontWeight:'700',color:colors.parchment,letterSpacing:.8,flexShrink:1},meta:{fontFamily:fonts.ui,fontSize:11.5,color:colors.gold,flexShrink:0,letterSpacing:.3},
 hpRow:{flexDirection:'row',alignItems:'center',gap:7},hp:{fontFamily:fonts.display,fontSize:14,fontWeight:'800',color:colors.parchment,fontVariant:['tabular-nums'],minWidth:44,textAlign:'right'},hpMax:{fontSize:11,color:colors.muted,fontWeight:'400'},temp:{fontSize:11,color:colors.arcane},
 actions:{flexDirection:'row',alignItems:'center',gap:7,marginLeft:'auto'},
 levelUp:{flexDirection:'row',alignItems:'center',gap:6,minHeight:36,paddingHorizontal:12,borderRadius:18,borderWidth:1,borderColor:'#fff0c4',backgroundColor:'#d9ae5f',justifyContent:'center'},levelUpText:{fontFamily:fonts.display,fontSize:11,fontWeight:'800',letterSpacing:1.2,color:'#2a1a07',textTransform:'uppercase'},
 scrim:{flex:1,backgroundColor:'rgba(2,3,6,.72)',alignItems:'center',justifyContent:'center',padding:18},
 sheet:{width:'100%',maxWidth:480,padding:24,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:'rgba(13,17,26,.98)'},
 menuHead:{flexDirection:'row',alignItems:'center',gap:16,marginBottom:6},
 overline:{...type.label},menuTitle:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:1,color:colors.parchment,marginTop:2},menuMeta:{fontFamily:fonts.ui,fontSize:12,color:colors.gold,marginTop:2},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},
 cell:{flexGrow:1,flexBasis:'45%',minHeight:58,paddingHorizontal:12,borderRadius:4,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'#1a202d',flexDirection:'row',alignItems:'center',gap:12},
 cellText:{fontFamily:fonts.display,fontSize:12.5,fontWeight:'700',letterSpacing:1.4,color:colors.parchment,textTransform:'uppercase',flexShrink:1},
 menuNote:{fontFamily:fonts.ui,fontSize:11.5,color:colors.faint,textAlign:'center',marginTop:14},
});
