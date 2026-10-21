import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {MenuItem,StatBar,Ornament} from './ui';
import Icon from './Icon';
import HeroPortrait from './HeroPortrait';
import TitleEmblem from './TitleEmblem';
import {combatBasics} from './combatRules';
import {fonts,colors,tint} from './theme';
import {playSound} from './audio';
// The title screen: the name in crimson foil, a console-style menu and the emblem (TitleEmblem: the host's painting,
// its serpent ring turning round the still Q and dagger) on the launch glow. Desktop places the seal beside the menu with the saved hero in a slim strip below
// it; upright phones place it above the hero strip and the compact menu; a phone on its side keeps the name and the
// compact menu on the left with the seal beside them.
export function homeLayout(width,height){
 const landscape=!(width>=860&&height>=560)&&width>=600&&width>height*1.3;
 const wide=(width>=860&&height>=560)||landscape,short=height<700,tiny=height<560&&!landscape;
 const logo=Math.max(landscape?26:34,Math.min(wide?96:72,Math.floor((landscape?width*.36:wide?Math.min(width*.58,860):width-40)/9.6),Math.floor(height/(landscape?7:short?8.5:7.2))));
 return {landscape,wide,short,tiny,logo,narrow:!wide};
}
export default function HomeScreen({hero,game,health,saved,unprotected=false,disabled,onContinue,onNew,onOpen,onFeedback,onLegal,width,height,notice}){
 const {landscape,wide,short,tiny,logo}=homeLayout(width,height);
 const stats=hero?combatBasics(hero):null,hp=health?.current??stats?.hp;
 // `saved`: a hero with a tale under way (App.js); a hero with none yet is offered New Adventure, not Continue.
 const where=game?.story?.title??null;
 // A hero who died keeps their slot as a memorial; a new hero is the way forward.
 const fallen=saved&&game?.stage==='dead';
 // On a phone the menu is compact (the two main entries, then the other four two to a row) so the emblem keeps the
 // middle of the screen; a desktop lists them in a column.
 const grid=!wide||landscape,others=[['sheet','Heroes','Character Selection'],['people',grid&&width<350?'Together':'Play Together','Multiplayer'],['d20','Dice','Dice Roller'],['settings','Settings','Settings']];
 const menu=<View style={[s.menu,!wide&&s.menuNarrow,landscape&&{marginTop:4,paddingLeft:0}]}>
  {!!hero&&saved&&<MenuItem primary={!fallen} icon="play" label="Continue" sub={!wide&&!short&&stats?.available?null:fallen?hero.name+' has fallen':hero.name+(where?' · '+where:'')} onPress={onContinue} disabled={disabled} center={!wide} style={grid&&{paddingVertical:5}}/>}
  <MenuItem primary={!saved||fallen} icon="compass" label="New Adventure" sub={saved&&!fallen?null:'Pick a hero and choose where the story begins'} onPress={onNew} disabled={disabled} center={!wide} style={grid&&{paddingVertical:5}}/>
  {grid?<View style={[s.menuGrid,landscape&&{maxWidth:360}]}>{others.map(([icon,label,target])=><View key={target} style={s.menuCell}><MenuItem icon={icon} label={label} size="small" tight onPress={()=>onOpen(target)} disabled={disabled} center={!wide}/></View>)}</View>
  :<View style={s.menuGroup}>{others.map(([icon,label,target])=><MenuItem key={target} icon={icon} label={label} size={short?'small':'large'} onPress={()=>onOpen(target)} disabled={disabled}/>)}</View>}
 </View>;
 // The saved hero, as a slim strip beneath the seal on a wide screen, or above the menu on
 // an upright phone, where it stands in for Continue's second line.
 const slot=!!hero&&stats?.available&&<Pressable accessibilityRole="button" accessibilityLabel={'Continue as '+hero.name} disabled={disabled} onPress={()=>{playSound('page');onContinue();}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'slot'}} style={[s.slot,!wide&&s.slotNarrow]}>
  <HeroPortrait hero={hero} size={44} level={hero.level}/>
  <View style={{flex:1,minWidth:0,gap:3}}>
   <View style={s.slotTop}><Text numberOfLines={1} style={s.slotName}>{hero.name}</Text><Text numberOfLines={1} style={[s.slotOverline,fallen&&{color:colors.bloodBright}]}>{fallen?'Fallen':'Level '+hero.level+' '+hero.class}</Text></View>
   {fallen?<Text numberOfLines={1} style={s.slotHpText}>{game.death.cause}{game.death.place?' at '+game.death.place:''}.</Text>
    :<View style={s.slotHp}><Icon name="heart" size={12} color={colors.heal}/><View style={{flex:1}}><StatBar value={hp} maximum={stats.hp} height={5}/></View><Text style={s.slotHpText}>{hp}/{stats.hp}</Text></View>}
  </View>
  <Icon name="forward" size={16} color={colors.gold}/>
 </Pressable>;
 const brand=<View style={[s.brand,!wide&&{alignItems:'center'},wide&&!landscape&&{width:Math.min(width*.6,880)},landscape&&{marginBottom:0}]}>
  <Text style={[s.overline,!wide&&{textAlign:'center'}]}>A tabletop adventure</Text>
  <Text accessibilityRole="header" dataSet={{qb:'title',glow:'on'}} style={[s.logo,{fontSize:logo,lineHeight:Math.round(logo*1.2),letterSpacing:Math.max(2,Math.round(logo/14))},!wide&&{textAlign:'center'}]}>Questbound</Text>
  {!tiny&&!landscape&&<><Ornament style={[s.rule,!wide&&{alignSelf:'center'}]}/>
  <Text style={[s.tagline,!wide&&{textAlign:'center'},short&&{fontSize:17}]}>Stories worth rolling for.</Text></>}
 </View>;
 // A player with an adventure and no account: it lives on this device only, so the way to keep it safe is offered here.
 const protect=unprotected&&<Pressable accessibilityRole="button" accessibilityLabel="Keep your progress safe: create an account" disabled={disabled} onPress={()=>{playSound('page');onOpen('Settings');}} onHoverIn={()=>playSound('tick')} style={[s.protect,!wide&&{alignSelf:'center',paddingLeft:0}]}><Icon name="key" size={14} color={colors.goldMid}/><Text style={s.protectText}>Keep your progress safe: <Text style={s.protectLink}>create an account</Text></Text></Pressable>;
 // The privacy policy and the terms, a tap away on every title screen.
 const legal=<View style={s.legalLinks}>{[['privacy','Privacy'],['terms','Terms'],['permissions','Permissions']].map(([tab,label],i)=><React.Fragment key={tab}>{i>0&&<Text style={s.legalDot}>·</Text>}<Pressable accessibilityRole="button" accessibilityLabel={{Privacy:'Privacy policy',Terms:'Terms of use',Permissions:'Permissions agreement'}[label]} disabled={disabled} onPress={()=>{playSound('page');onLegal?.(tab);}} onHoverIn={()=>playSound('tick')} style={s.legalLink}><Text style={s.legalText}>{label}</Text></Pressable></React.Fragment>)}</View>;
 const footer=<View style={[s.footer,!wide&&{justifyContent:'center',flexWrap:'wrap'}]}>
  <Pressable accessibilityRole="button" onPress={onFeedback} onHoverIn={()=>playSound('tick')} style={s.feedback}><Icon name="feedback" size={15} color={colors.gold}/><Text style={s.feedbackText}>Send playtest feedback</Text></Pressable>
  {(!wide||landscape)&&legal}
  {wide&&!landscape&&<View style={{flexDirection:'row',alignItems:'center',gap:14}}>{legal}<Text style={s.version}>Early access 0.1 · Playtest</Text></View>}
 </View>;
 if(landscape)return <View dataSet={{qb:'enter-slow'}} style={s.landscape}>
  {/* A phone on its side: the name, the compact menu and the feedback link share left side of the screen. */}
  <View style={s.landLeft}>{brand}{!!notice&&<View style={s.notice}>{notice}</View>}{menu}{footer}</View>
  <View style={{flex:1,alignItems:'center'}}><TitleEmblem size={Math.min(height*.48,width*.23)}/></View>
 </View>;
 if(wide)return <View dataSet={{qb:'enter-slow'}} style={s.wide}>
  {/* The name and menu sit beside the animated emblem. */}
  <View style={[s.left,height>=760&&{justifyContent:'flex-start',paddingTop:Math.round(height*.04)}]}>{brand}{!!notice&&<View style={s.notice}>{notice}</View>}{menu}{protect}</View>
  <View style={s.right}><View style={{flex:1,alignSelf:'stretch',alignItems:'center',justifyContent:'center'}}><TitleEmblem size={Math.min(width*.24,height*.4)}/></View>{slot}</View>
  <View style={s.footerWide}>{footer}</View>
 </View>;
 return <View dataSet={{qb:'enter-slow'}} style={[s.narrow,short&&{paddingTop:4}]}>
  {brand}
  <View style={{flexGrow:1,minHeight:tiny?8:16,alignItems:'center',justifyContent:'center'}}>{!tiny&&<TitleEmblem size={Math.max(60,Math.min(width*.45,(height-440)/1.42))}/>}</View>
  {!!notice&&<View style={[s.notice,{alignSelf:'center'}]}>{notice}</View>}
  {!short&&slot}
  {menu}
  {!short&&protect}
  {footer}
 </View>;
}
const s=StyleSheet.create({
 wide:{flex:1,minHeight:0,flexDirection:'row',paddingHorizontal:'6%',paddingTop:20,paddingBottom:56},
 landscape:{flex:1,minHeight:0,flexDirection:'row',alignItems:'center',paddingHorizontal:'5%',paddingVertical:8,gap:24},
 landLeft:{width:'46%',maxWidth:400,justifyContent:'center'},
 menuGrid:{flexDirection:'row',flexWrap:'wrap',marginTop:4},menuCell:{width:'50%'},
 left:{width:'48%',maxWidth:560,justifyContent:'center',gap:10},
 right:{flex:1,alignItems:'flex-end',justifyContent:'flex-end',paddingBottom:0},
 footerWide:{position:'absolute',left:'6%',right:'6%',bottom:14},
 narrow:{flex:1,minHeight:0,paddingHorizontal:18,paddingTop:10,paddingBottom:12,alignItems:'stretch'},
 brand:{marginBottom:8},
 overline:{fontFamily:fonts.display,fontSize:11,letterSpacing:5,color:colors.goldMid,textTransform:'uppercase',marginBottom:4},
 logo:{fontFamily:fonts.logo,fontWeight:'900',color:colors.gold},
 rule:{width:'70%',maxWidth:340,marginVertical:8,alignSelf:'flex-start'},
 tagline:{fontFamily:fonts.story,fontStyle:'italic',fontSize:20,color:tint('#decfc8'),letterSpacing:.4},
 menu:{marginTop:14,paddingLeft:22,gap:2},menuNarrow:{paddingLeft:0,alignItems:'stretch',marginTop:6},
 menuGroup:{marginTop:10,gap:0},
 slot:{width:360,maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:12,paddingVertical:9,paddingHorizontal:14,borderRadius:6,overflow:'hidden',borderWidth:1,borderColor:tint('rgba(178,34,58,.5)')},
 slotOverline:{fontFamily:fonts.display,fontSize:9.5,letterSpacing:1.6,color:colors.goldMid,textTransform:'uppercase',flexShrink:0},
 slotNarrow:{alignSelf:'center',width:'100%',maxWidth:420,marginBottom:8},
 slotTop:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10},
 slotName:{fontFamily:fonts.display,fontSize:16,fontWeight:'700',letterSpacing:.6,color:colors.parchment,flexShrink:1},
 slotHp:{flexDirection:'row',alignItems:'center',gap:8},slotHpText:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'600',color:colors.muted,fontVariant:['tabular-nums']},
 footer:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8},
 feedback:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40,paddingHorizontal:4},
 feedbackText:{fontFamily:fonts.display,fontSize:11.5,fontWeight:'700',letterSpacing:1.8,color:colors.gold,textTransform:'uppercase'},
 version:{fontFamily:fonts.display,fontSize:10,letterSpacing:2.4,color:tint('rgba(221,214,219,.5)'),textTransform:'uppercase'},
 notice:{maxWidth:460,marginTop:4},
 protect:{flexDirection:'row',alignItems:'center',gap:8,minHeight:36,marginTop:6,paddingLeft:22},
 legalLinks:{flexDirection:'row',alignItems:'center',gap:6},legalLink:{minHeight:36,justifyContent:'center',paddingHorizontal:4},legalText:{fontFamily:fonts.display,fontSize:10.5,letterSpacing:2,color:tint('rgba(221,214,219,.6)'),textTransform:'uppercase'},legalDot:{color:tint('rgba(221,214,219,.4)'),fontSize:12},
 protectText:{fontFamily:fonts.ui,fontSize:12.5,color:tint('#c4b5af'),textShadowColor:tint('rgba(0,0,0,.9)'),textShadowRadius:6},protectLink:{color:colors.goldBright,fontWeight:'600',textDecorationLine:'underline'},
});
