import React,{useState,useEffect} from 'react';
import {View,Text,Pressable,Modal,StyleSheet,useWindowDimensions} from 'react-native';
import {CombatHealthButton} from './EncounterOverlay';
import {FullscreenToggle} from './DisplayControls';
import {AudioToggle} from './AudioControls';
import {GameButton,StatBar} from './ui';
import {displayState,subscribeDisplay,toggleFullscreen} from './fullscreen';
import {audioSettings,subscribeAudio,setAudio,playSound} from './audio';
import {fonts,colors,type} from './theme';
// The in-game heads-up display: always on screen, never scrolls away.
export default function GameHud({hero,health,maxHp,wide,onNavigate,levelUp,onLevelUp}){
 const [menu,setMenu]=useState(false),hp=health?.current??maxHp,temp=health?.temp??0,low=hp/Math.max(1,maxHp)<=.3;
 // Labels and the wordmark appear only when there is room, so every control stays on screen at any width.
 const {width,height}=useWindowDimensions(),labels=wide&&width>=1180,wordmark=wide&&width>=1000,short=height<520;
 const go=target=>{setMenu(false);playSound('page');onNavigate(target);};
 const icon=(glyph,label,target)=><Pressable key={target} accessibilityRole="button" accessibilityLabel={'Open '+label.toLowerCase()} onPress={()=>go(target)} dataSet={{qb:'chip'}} style={s.icon}><Text style={s.iconGlyph}>{glyph}</Text>{labels&&<Text style={s.iconLabel}>{label}</Text>}</Pressable>;
 return <View dataSet={{qb:'hud'}} style={[s.bar,!wide&&s.barCompact,wide&&!labels&&{gap:10},short&&{paddingVertical:5}]}>
  {wide&&<View style={s.brand}><View dataSet={{qb:'emblem'}} style={s.emblem}><Text dataSet={{qb:'title'}} style={s.emblemQ}>Q</Text></View>{wordmark&&<Text dataSet={{qb:'title'}} style={s.wordmark}>Questbound</Text>}</View>}
  <View style={[s.hero,!wide&&{flex:1}]}>
   <View style={s.heroTop}><Text numberOfLines={1} style={[s.name,!wide&&{fontSize:15}]}>{hero.name}</Text><Text numberOfLines={1} style={s.meta}>Lv {hero.level} {hero.class}</Text></View>
   <View style={s.hpRow}><View style={{flex:1}}><StatBar value={hp} maximum={maxHp} height={wide?9:7}/></View><Text style={[s.hp,low&&{color:colors.bloodBright}]}>{hp}<Text style={s.hpMax}>/{maxHp}</Text>{temp>0?<Text style={s.temp}> +{temp}</Text>:null}</Text></View>
  </View>
  {levelUp&&<Pressable accessibilityRole="button" onPress={onLevelUp} dataSet={{qb:'btn-primary'}} style={s.levelUp}><Text style={s.levelUpText}>✦ {wide?'Level up':'Lv'}</Text></Pressable>}
  {wide?<View style={s.actions}>{icon('❦','Journal','Campaign Journal')}{icon('⚔','Sheet','Character Sheet')}{icon('♞','Party','Followers')}<CombatHealthButton hud label={labels}/><FullscreenToggle compact/><AudioToggle compact/>{menuButton()}</View>
   :<View style={s.actions}><AudioToggle compact/>{menuButton()}</View>}
  <GameMenu visible={menu} onClose={()=>setMenu(false)} go={go}/>
 </View>;
 function menuButton(){return <Pressable accessibilityRole="button" accessibilityLabel="Game menu" onPress={()=>{setMenu(true);playSound('page');}} dataSet={{qb:'chip'}} style={s.icon}><Text style={s.iconGlyph}>☰</Text></Pressable>;}
}
function GameMenu({visible,onClose,go}){
 const [display,setDisplay]=useState(displayState),[audio,setAudioState]=useState(audioSettings);
 useEffect(()=>subscribeDisplay(setDisplay),[]);useEffect(()=>subscribeAudio(setAudioState),[]);
 return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}><Pressable accessibilityLabel="Close menu" onPress={onClose} style={s.scrim}><Pressable onPress={()=>{}} dataSet={{qb:'panel'}} style={s.sheet} accessibilityViewIsModal>
  <Text style={s.overline}>Paused</Text><Text style={s.menuTitle}>Game menu</Text>
  <GameButton variant="primary" label="Resume" onPress={onClose}/>
  <View style={s.grid}>
   <GameButton label="❦  Journal" onPress={()=>go('Campaign Journal')} style={s.cell}/>
   <GameButton label="⚔  Character" onPress={()=>go('Character Sheet')} style={s.cell}/>
   <GameButton label="♞  Party" onPress={()=>go('Followers')} style={s.cell}/>
   <GameButton label="⚙  Settings" onPress={()=>go('Settings')} style={s.cell}/>
   {display.supported&&<GameButton label={display.fullscreen?'⛶  Exit full screen':'⛶  Full screen'} onPress={toggleFullscreen} style={s.cell}/>}
   <GameButton label={audio.muted?'♪  Sound on':'♪  Mute'} onPress={()=>setAudio({muted:!audio.muted})} style={s.cell}/>
  </View>
  <GameButton label="‹  Main menu" onPress={()=>go('Home')}/>
 </Pressable></Pressable></Modal>;
}
const s=StyleSheet.create({
 bar:{flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.35)',backgroundColor:'rgba(8,10,16,.9)'},
 barCompact:{gap:8,paddingHorizontal:10,paddingVertical:7},
 brand:{flexDirection:'row',alignItems:'center',gap:10},emblem:{width:36,height:36,borderRadius:18,borderWidth:1.5,borderColor:colors.gold,alignItems:'center',justifyContent:'center'},
 emblemQ:{fontFamily:fonts.logo,fontSize:20,fontWeight:'900',color:colors.gold,marginTop:-2},wordmark:{fontFamily:fonts.logo,fontSize:18,fontWeight:'900',letterSpacing:2.5,color:colors.gold},
 hero:{flexShrink:1,minWidth:150,maxWidth:420,flexGrow:1,gap:4},heroTop:{flexDirection:'row',alignItems:'baseline',gap:8},
 name:{fontFamily:fonts.display,fontSize:17,fontWeight:'700',color:colors.parchment,letterSpacing:.8,flexShrink:1},meta:{fontFamily:fonts.ui,fontSize:11.5,color:colors.gold,flexShrink:0},
 hpRow:{flexDirection:'row',alignItems:'center',gap:8},hp:{fontFamily:fonts.display,fontSize:14,fontWeight:'800',color:colors.parchment,fontVariant:['tabular-nums'],minWidth:44,textAlign:'right'},hpMax:{fontSize:11,color:colors.muted,fontWeight:'400'},temp:{fontSize:11,color:colors.arcane},
 actions:{flexDirection:'row',alignItems:'center',gap:6,marginLeft:'auto'},
 icon:{minWidth:40,minHeight:40,paddingHorizontal:10,borderRadius:20,borderWidth:1,borderColor:'rgba(201,164,92,.4)',backgroundColor:'rgba(12,16,24,.8)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
 iconGlyph:{fontSize:15,color:colors.gold},iconLabel:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:1.2,color:'#ecdcb8',textTransform:'uppercase'},
 levelUp:{minHeight:36,paddingHorizontal:12,borderRadius:18,borderWidth:1,borderColor:'#fff0c4',backgroundColor:'#d9ae5f',justifyContent:'center'},levelUpText:{fontFamily:fonts.display,fontSize:11,fontWeight:'800',letterSpacing:1.2,color:'#2a1a07'},
 scrim:{flex:1,backgroundColor:'rgba(2,3,6,.72)',alignItems:'center',justifyContent:'center',padding:18},
 sheet:{width:'100%',maxWidth:460,padding:24,borderRadius:4,borderWidth:1,borderColor:colors.goldLine,backgroundColor:'rgba(13,17,26,.98)'},
 overline:{...type.label,textAlign:'center'},menuTitle:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:2,color:colors.parchment,textAlign:'center',textTransform:'uppercase',marginTop:4,marginBottom:8},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:8},cell:{flexGrow:1,flexBasis:'45%',marginTop:0},
});
