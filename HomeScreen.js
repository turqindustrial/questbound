import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {MenuItem,Crest,StatBar,Ornament} from './ui';
import Icon from './Icon';
import {classIcons} from './iconPaths';
import HeroPortrait from './HeroPortrait';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import {combatBasics} from './combatRules';
import {fonts,colors} from './theme';
import {playSound} from './audio';
// The title screen: the painted world behind, the gilded name, and a console-style menu. Wide screens put the menu in a
// column on the left and the saved hero's "slot" on the right; phones stack the name above a thumb-reach menu.
export default function HomeScreen({hero,game,health,saved,disabled,onContinue,onNew,onOpen,onFeedback,width,height,notice}){
 // A phone on its side (or any short, wide window) puts the name on the left and the menu on the right.
 const landscape=!(width>=860&&height>=560)&&width>=600&&width>height*1.3;
 const wide=(width>=860&&height>=560)||landscape,short=height<700,tiny=height<560&&!landscape;
 const logo=Math.max(34,Math.min(wide?96:72,Math.floor((landscape?width*.44:wide?Math.min(width*.58,860):width-40)/9.6),Math.floor(height/(landscape?5.2:short?8.5:7.2))));
 const stats=hero?combatBasics(hero):null,hp=health?.current??stats?.hp;
 const where=game?.story?.title??(saved?'The Lantern at the Crossroads':null);
 // A hero who died keeps their slot as a memorial; a new hero is the way forward.
 const fallen=saved&&game?.stage==='dead';
 const menu=<View style={[s.menu,!wide&&s.menuNarrow]}>
  {!!hero&&<MenuItem primary={saved&&!fallen} icon="play" label="Continue" sub={fallen?hero.name+' has fallen':!wide&&!short&&stats?.available?null:hero.name+(where?' · '+where:'')} onPress={onContinue} disabled={disabled} center={!wide}/>}
  <MenuItem primary={!saved||fallen} icon="compass" label="New Adventure" sub={saved&&!fallen?null:'Pick a hero and choose where the story begins'} onPress={onNew} disabled={disabled} center={!wide}/>
  <View style={[s.menuGroup,!wide&&{alignItems:'center'}]}>
   <MenuItem icon="sheet" label="Heroes" size={short?'small':'large'} onPress={()=>onOpen('Character Selection')} disabled={disabled} center={!wide}/>
   <MenuItem icon="people" label="Play Together" size={short?'small':'large'} onPress={()=>onOpen('Multiplayer')} disabled={disabled} center={!wide}/>
   <MenuItem icon="d20" label="Dice" size={short?'small':'large'} onPress={()=>onOpen('Dice Roller')} disabled={disabled} center={!wide}/>
   <MenuItem icon="settings" label="Settings" size={short?'small':'large'} onPress={()=>onOpen('Settings')} disabled={disabled} center={!wide}/>
  </View>
 </View>;
 const slot=!!hero&&stats?.available&&<Pressable accessibilityRole="button" accessibilityLabel={'Continue as '+hero.name} disabled={disabled} onPress={()=>{playSound('page');onContinue();}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'slot'}} style={[s.slot,!wide&&s.slotNarrow]}>
  {saved&&!!game&&<><DynamicArt quiet subject={locationArtSubject(game)} style={[StyleSheet.absoluteFill,{opacity:.45,backgroundColor:'transparent'}]}/><View dataSet={{qb:'slot-shade'}} style={[StyleSheet.absoluteFill,{pointerEvents:'none'}]}/></>}
  <Text style={[s.slotOverline,fallen&&{color:colors.bloodBright}]}>{fallen?'Fallen hero':saved?'Your adventure':'Your hero'}</Text>
  <View style={s.slotTop}>
   <HeroPortrait hero={hero} size={wide?64:48} level={hero.level}/>
   <View style={{flex:1,minWidth:0}}>
    <Text numberOfLines={1} style={[s.slotName,!wide&&{fontSize:19}]}>{hero.name}</Text>
    <Text numberOfLines={1} style={s.slotLine}>Level {hero.level} {hero.species??hero.race} {hero.class}</Text>
   </View>
  </View>
  {!!where&&<Text numberOfLines={2} style={[s.slotStory,!wide&&{fontSize:15}]}>{where}</Text>}
  {fallen?<View style={s.slotHp}><Icon name="skull" size={13} color={colors.muted}/><Text numberOfLines={2} style={[s.slotHpText,{flex:1}]}>{game.death.cause}{game.death.place?' at '+game.death.place:''}.</Text></View>
   :<View style={s.slotHp}><Icon name="heart" size={13} color={colors.heal}/><View style={{flex:1}}><StatBar value={hp} maximum={stats.hp} height={6}/></View><Text style={s.slotHpText}>{hp}/{stats.hp}</Text></View>}
  <View style={s.slotFoot}><Text style={s.slotGo}>{fallen?'Their last page':saved?'Continue':'Choose your story'}</Text><Icon name="forward" size={14} color={colors.gold}/></View>
 </Pressable>;
 const brand=<View style={[s.brand,!wide&&{alignItems:'center'},wide&&!landscape&&{width:Math.min(width*.6,880)}]}>
  <Text style={[s.overline,!wide&&{textAlign:'center'}]}>A tabletop adventure</Text>
  <Text accessibilityRole="header" dataSet={{qb:'title',glow:'on'}} style={[s.logo,{fontSize:logo,lineHeight:Math.round(logo*1.2),letterSpacing:Math.max(2,Math.round(logo/14))},!wide&&{textAlign:'center'}]}>Questbound</Text>
  {!tiny&&<><Ornament style={[s.rule,!wide&&{alignSelf:'center'}]}/>
  <Text style={[s.tagline,!wide&&{textAlign:'center'},short&&{fontSize:17}]}>Stories worth rolling for.</Text></>}
 </View>;
 const footer=<View style={[s.footer,!wide&&{justifyContent:'center'}]}>
  <Pressable accessibilityRole="button" onPress={onFeedback} onHoverIn={()=>playSound('tick')} style={s.feedback}><Icon name="feedback" size={15} color={colors.gold}/><Text style={s.feedbackText}>Send playtest feedback</Text></Pressable>
  {wide&&!landscape&&<Text style={s.version}>Early access 0.1 · Playtest</Text>}
 </View>;
 if(landscape)return <View dataSet={{qb:'enter-slow'}} style={s.landscape}>
  <View style={s.landLeft}>{brand}</View>
  <View style={s.landRight}>{!!notice&&<View style={s.notice}>{notice}</View>}{menu}{footer}</View>
 </View>;
 if(wide)return <View dataSet={{qb:'enter-slow'}} style={s.wide}>
  <View style={s.left}>{brand}{!!notice&&<View style={s.notice}>{notice}</View>}{menu}</View>
  <View style={s.right}>{slot}</View>
  <View style={s.footerWide}>{footer}</View>
 </View>;
 return <View dataSet={{qb:'enter-slow'}} style={[s.narrow,short&&{paddingTop:4}]}>
  {brand}
  <View style={{flexGrow:1,minHeight:tiny?8:16}}/>
  {!!notice&&<View style={[s.notice,{alignSelf:'center'}]}>{notice}</View>}
  {!short&&slot}
  {menu}
  {footer}
 </View>;
}
const s=StyleSheet.create({
 wide:{flex:1,minHeight:0,flexDirection:'row',paddingHorizontal:'6%',paddingTop:20,paddingBottom:56},
 landscape:{flex:1,minHeight:0,flexDirection:'row',alignItems:'center',paddingHorizontal:'5%',paddingVertical:8,gap:24},
 landLeft:{flex:1.1,justifyContent:'center'},landRight:{flex:1,justifyContent:'center'},
 left:{width:'48%',maxWidth:560,justifyContent:'center',gap:10},
 right:{flex:1,alignItems:'flex-end',justifyContent:'flex-end',paddingBottom:8},
 footerWide:{position:'absolute',left:'6%',right:'6%',bottom:14},
 narrow:{flex:1,minHeight:0,paddingHorizontal:18,paddingTop:10,paddingBottom:12,alignItems:'stretch'},
 brand:{marginBottom:8},
 overline:{fontFamily:fonts.display,fontSize:11,letterSpacing:5,color:colors.goldMid,textTransform:'uppercase',marginBottom:4},
 logo:{fontFamily:fonts.logo,fontWeight:'900',color:colors.gold},
 rule:{width:'70%',maxWidth:340,marginVertical:8,alignSelf:'flex-start'},
 tagline:{fontFamily:fonts.story,fontStyle:'italic',fontSize:20,color:'#e9dcbd',letterSpacing:.4},
 menu:{marginTop:14,paddingLeft:22,gap:2},menuNarrow:{paddingLeft:0,alignItems:'stretch',marginTop:6},
 menuGroup:{marginTop:10,gap:0},
 slot:{width:340,maxWidth:'100%',padding:20,paddingTop:16,borderRadius:6,overflow:'hidden',borderWidth:1,borderColor:'rgba(201,164,92,.45)',gap:10},
 slotNarrow:{alignSelf:'center',width:'100%',maxWidth:420,padding:14,paddingTop:12,gap:8,marginBottom:8},
 slotOverline:{fontFamily:fonts.display,fontSize:10,letterSpacing:3,color:colors.goldMid,textTransform:'uppercase'},
 slotTop:{flexDirection:'row',alignItems:'center',gap:14},
 slotName:{fontFamily:fonts.display,fontSize:23,fontWeight:'700',letterSpacing:.8,color:colors.parchment},
 slotLine:{fontFamily:fonts.ui,fontSize:12.5,color:colors.gold,letterSpacing:.3,marginTop:3},
 slotStory:{fontFamily:fonts.story,fontStyle:'italic',fontSize:17,lineHeight:22,color:'#e6dac0'},
 slotHp:{flexDirection:'row',alignItems:'center',gap:8},slotHpText:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'600',color:colors.muted,fontVariant:['tabular-nums']},
 slotFoot:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:4,marginTop:2},slotGo:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:2,color:colors.gold,textTransform:'uppercase'},
 footer:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8},
 feedback:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40,paddingHorizontal:4},
 feedbackText:{fontFamily:fonts.display,fontSize:11.5,fontWeight:'700',letterSpacing:1.8,color:colors.gold,textTransform:'uppercase'},
 version:{fontFamily:fonts.display,fontSize:10,letterSpacing:2.4,color:'rgba(201,164,92,.6)',textTransform:'uppercase'},
 notice:{maxWidth:460,marginTop:4},
});
