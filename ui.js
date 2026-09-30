import React from 'react';
import {View,Text,Pressable,StyleSheet,Platform,useWindowDimensions} from 'react-native';
import {fonts,colors,type} from './theme';
import Icon from './Icon';
import {playSound} from './audio';
const web=Platform.OS==='web';
// Building blocks for the gilded look. On web, dataSet hooks add gradients, glows and corner filigree from webTheme.js.
export function Panel({children,style,variant='panel',...props}){
 return <View dataSet={{qb:variant}} style={[s.panel,variant==='glass'&&s.glass,style]} {...props}>{children}</View>;
}
export function GameButton({label,onPress,variant='secondary',disabled,style,textStyle,accessibilityLabel,icon}){
 const primary=variant==='primary',danger=variant==='danger';
 return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{disabled:!!disabled}} disabled={disabled} onPress={onPress} onHoverIn={()=>!disabled&&playSound('tick')} dataSet={{qb:primary?'btn-primary':danger?'btn-danger':'btn'}} style={({pressed})=>[s.button,primary&&s.primary,danger&&s.danger,pressed&&!disabled&&s.pressed,disabled&&s.disabled,style]}>
  <View style={s.buttonRow}>{!!icon&&<Icon name={icon} size={17} color={primary?'#2a1a07':colors.gold}/>}<Text style={[s.buttonText,primary&&s.primaryText,textStyle]}>{label}</Text></View>
 </Pressable>;
}
export function Ornament({style,glyph='◆'}){
 return <View style={[s.ornament,style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><View dataSet={{qb:'rule-left'}} style={s.rule}/><Text style={s.glyph}>{glyph}</Text><View dataSet={{qb:'rule-right'}} style={s.rule}/></View>;
}
export function Eyebrow({children,style}){return <Text style={[type.eyebrow,style]}>{children}</Text>;}
// A page heading: small engraved overline, the title, and a gilded rule.
export function ScreenTitle({eyebrow,title,sub,icon,align='left',style}){
 const center=align==='center';
 return <View style={[s.screenTitle,center&&{alignItems:'center'},style]}>
  {!!eyebrow&&<View style={s.eyebrowRow}>{!!icon&&<Icon name={icon} size={14} color={colors.goldMid}/>}<Text style={type.eyebrow}>{eyebrow}</Text></View>}
  <Text accessibilityRole="header" style={[s.screenHeading,center&&{textAlign:'center'}]}>{title}</Text>
  {!!sub&&<Text style={[s.screenSub,center&&{textAlign:'center'}]}>{sub}</Text>}
  <View style={[s.titleRule,center&&{alignSelf:'center'}]}><View dataSet={{qb:center?'rule-left':undefined}} style={[s.titleRuleLine,center?{flex:1}:{width:28,backgroundColor:colors.gold}]}/><View style={s.titleLozenge}/><View dataSet={{qb:'rule-right'}} style={[s.titleRuleLine,{flex:1}]}/></View>
 </View>;
}
// A section heading inside a page.
export function Section({title,icon,right,style}){
 return <View style={[s.section,style]}>{!!icon&&<Icon name={icon} size={16} color={colors.gold}/>}<Text style={s.sectionText}>{title}</Text><View dataSet={{qb:'rule-right'}} style={s.sectionRule}/>{right}</View>;
}
// A gilded medallion around a line emblem (class crests, hero portraits without art), with an optional level badge.
export function Crest({icon='star',size=56,level,style,color=colors.goldBright}){
 return <View dataSet={{qb:'crest'}} style={[{width:size,height:size,borderRadius:size/2,alignItems:'center',justifyContent:'center'},style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
  <Icon name={icon} size={Math.round(size*.5)} color={color} strokeWidth={1.5}/>
  {level!=null&&<View dataSet={{qb:'badge'}} style={[s.levelBadge,{minWidth:Math.max(18,size*.36),height:Math.max(18,size*.36),borderRadius:Math.max(9,size*.18)}]}><Text style={[s.levelText,{fontSize:Math.max(10,Math.round(size*.2))}]}>{level}</Text></View>}
 </View>;
}
// Round icon buttons for the HUD and top bars. `tip` shows a label on hover with a mouse.
export function IconButton({icon,label,tip,onPress,hot=false,size=40,disabled,style,children,active=false}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:!!disabled}} disabled={disabled} onPress={onPress} onHoverIn={()=>!disabled&&playSound('tick')} dataSet={{qb:hot?'hud-btn-hot':'hud-btn',tip:tip??label}} style={[s.iconButton,{minWidth:size,height:size,borderRadius:size/2},hot&&s.iconHot,active&&{borderColor:colors.gold},disabled&&s.disabled,style]}>
  <Icon name={icon} size={Math.round(size*.46)} color={hot?'#ffd2c2':active?colors.goldBright:colors.gold}/>{children}
 </Pressable>;
}
// Title-screen menu entries: large engraved words with an icon; the primary one is bigger and gilded.
export function MenuItem({label,sub,icon,onPress,primary=false,disabled=false,center=false,size='large',style}){
 const small=size==='small';
 return <Pressable accessibilityRole="button" accessibilityLabel={sub?label+'. '+sub:label} accessibilityState={{disabled}} disabled={disabled} onPress={()=>{playSound('page');onPress?.();}} onHoverIn={()=>!disabled&&playSound('tick')} dataSet={{qb:'menu-item',center:center?'on':'off'}} style={[s.menuItem,center&&{alignItems:'center'},small&&{paddingVertical:7},style]}>
  <View style={[s.menuRow,center&&{justifyContent:'center'}]}>
   {!!icon&&<View dataSet={{qb:'menu-icon',primary:primary?'on':'off'}}><Icon name={icon} size={small?16:primary?24:20} color={web?undefined:colors.gold}/></View>}
   <Text dataSet={{qb:'menu-label'}} style={[s.menuLabel,primary&&s.menuPrimary,small&&s.menuSmall]}>{label}</Text>
  </View>
  {!!sub&&<Text numberOfLines={1} style={[s.menuSub,center&&{textAlign:'center'},!!icon&&!center&&{marginLeft:small?26:primary?36:32}]}>{sub}</Text>}
 </Pressable>;
}
// Segmented tabs (character sheet, journal, settings).
export function Segmented({options,value,onChange,style}){
 // On a phone the tabs drop their icons and capitals so every tab stays on one row.
 const narrow=useWindowDimensions().width<520;
 return <View accessibilityRole="tablist" dataSet={{qb:'seg'}} style={[s.seg,narrow&&{flexWrap:'nowrap'},style]}>{options.map(([id,label,icon])=>{const on=value===id;return <Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:on}} onPress={()=>{if(!on){playSound('page');onChange(id);}}} dataSet={{qb:on?'seg-on':undefined}} style={[s.segItem,narrow&&s.segNarrow,on&&s.segOn]}>{!!icon&&!narrow&&<Icon name={icon} size={15} color={on?colors.goldBright:colors.muted}/>}<Text numberOfLines={1} style={[s.segText,narrow&&s.segTextNarrow,on&&{color:colors.goldBright}]}>{label}</Text></Pressable>;})}</View>;
}
export function StatBar({value,maximum,kind='hp',height=10,style}){
 const pct=Math.max(0,Math.min(100,100*(value??0)/Math.max(1,maximum)));
 const tone=kind==='hp'&&pct<=30?'bar-low':'bar-'+kind;
 return <View dataSet={{qb:'bar'}} style={[s.track,{height},style]} accessibilityRole="progressbar" accessibilityValue={{min:0,max:maximum,now:value??0}}>
  {/* The pale "ghost" trails behind a falling bar so a hit reads at a glance. */}
  {kind!=='temp'&&<View dataSet={{qb:'bar-ghost'}} style={[s.ghost,{width:pct+'%'}]}/>}
  <View dataSet={{qb:tone}} style={[s.fill,{width:pct+'%',backgroundColor:kind==='enemy'?colors.blood:kind==='temp'?colors.arcane:kind==='gold'?colors.gold:pct<=30?colors.blood:colors.heal}]}/>
 </View>;
}
// An on/off switch with a label and an optional description underneath.
export function Toggle({value,onChange,label,description,style}){
 return <Pressable accessibilityRole="switch" accessibilityState={{checked:!!value}} accessibilityLabel={label} onPress={()=>onChange(!value)} style={[s.toggleRow,style]}>
  <View style={{flex:1,minWidth:0}}><Text style={s.toggleLabel}>{label}</Text>{!!description&&<Text style={s.toggleDescription}>{description}</Text>}</View>
  <View dataSet={{qb:value?'btn-primary':'seg'}} style={[s.track2,value&&s.trackOn]}><View style={[s.knob,value&&s.knobOn]}/></View>
 </Pressable>;
}
export function KeyHint({children,style,dark=false}){return <View dataSet={{qb:'key'}} style={[s.key,dark&&{borderColor:'rgba(42,26,7,.45)',backgroundColor:'rgba(42,26,7,.12)'},style]}><Text style={[s.keyText,dark&&{color:'#3a2708'}]}>{children}</Text></View>;}
const s=StyleSheet.create({
 panel:{backgroundColor:'rgba(13,17,26,.92)',borderWidth:1,borderColor:colors.goldLine,borderRadius:6,padding:24},
 glass:{backgroundColor:'rgba(10,14,22,.78)'},
 button:{minHeight:52,paddingVertical:14,paddingHorizontal:20,marginTop:10,borderRadius:4,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'#1a202d',justifyContent:'center',alignItems:'center'},
 buttonRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
 primary:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},
 danger:{backgroundColor:'#5a1d17',borderColor:'#c8412f'},
 pressed:{transform:[{scale:.985}]},
 disabled:{opacity:.5},
 buttonText:{fontFamily:fonts.display,fontSize:14,fontWeight:'700',letterSpacing:2,color:colors.parchment,textAlign:'center',textTransform:'uppercase'},
 primaryText:{color:'#2a1a07'},
 ornament:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:14},
 rule:{flex:1,height:1,backgroundColor:colors.goldLine},
 glyph:{color:colors.gold,fontSize:10},
 screenTitle:{marginBottom:18},eyebrowRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},
 screenHeading:{fontFamily:fonts.display,fontSize:28,fontWeight:'700',letterSpacing:1.2,color:colors.parchment},
 screenSub:{fontFamily:fonts.story,fontStyle:'italic',fontSize:17,lineHeight:25,color:'#d9ccb0',marginTop:6},
 titleRule:{flexDirection:'row',alignItems:'center',gap:8,marginTop:12,width:'100%',maxWidth:420},titleRuleLine:{height:1,backgroundColor:colors.goldLine},
 titleLozenge:{width:7,height:7,transform:[{rotate:'45deg'}],backgroundColor:colors.gold},
 section:{flexDirection:'row',alignItems:'center',gap:10,marginTop:22,marginBottom:12},sectionText:{fontFamily:fonts.display,fontSize:15,fontWeight:'700',letterSpacing:1.8,color:colors.gold,textTransform:'uppercase'},sectionRule:{flex:1,height:1,backgroundColor:colors.goldFaint},
 levelBadge:{position:'absolute',right:-4,bottom:-4,paddingHorizontal:4,alignItems:'center',justifyContent:'center',backgroundColor:colors.gold,borderWidth:1,borderColor:'#fff0c4'},
 levelText:{fontFamily:fonts.display,fontWeight:'800',color:'#2a1a07'},
 iconButton:{paddingHorizontal:8,borderWidth:1,borderColor:'rgba(201,164,92,.45)',backgroundColor:'rgba(12,16,24,.85)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
 iconHot:{borderColor:'rgba(240,106,79,.75)',backgroundColor:'rgba(60,18,14,.85)'},
 menuItem:{paddingVertical:9,alignSelf:'stretch'},menuRow:{flexDirection:'row',alignItems:'center',gap:12},
 menuLabel:{fontFamily:fonts.display,fontSize:21,fontWeight:'700',letterSpacing:3,color:'#e9dcc0',textTransform:'uppercase'},
 menuPrimary:{fontSize:27,letterSpacing:3.5,color:colors.goldBright},menuSmall:{fontSize:14,letterSpacing:2.2,color:'#cfc2a4'},
 menuSub:{fontFamily:fonts.story,fontStyle:'italic',fontSize:15,color:'#b9ae95',marginTop:1},
 seg:{flexDirection:'row',flexWrap:'wrap',gap:4,padding:4,borderRadius:6,borderWidth:1,borderColor:'rgba(201,164,92,.28)',backgroundColor:'rgba(6,8,12,.55)',marginVertical:14},
 segItem:{flexGrow:1,flexBasis:0,minWidth:96,minHeight:42,paddingHorizontal:10,borderRadius:4,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderWidth:1,borderColor:'transparent'},
 segNarrow:{minWidth:0,paddingHorizontal:4},segTextNarrow:{fontSize:11.5,letterSpacing:.2},
 segOn:{borderColor:'rgba(232,199,123,.55)',backgroundColor:'rgba(58,46,26,.9)'},
 segText:{fontFamily:fonts.display,fontSize:12,fontWeight:'700',letterSpacing:1.3,color:colors.muted,textTransform:'uppercase'},
 track:{width:'100%',borderRadius:2,backgroundColor:'rgba(0,0,0,.55)',borderWidth:1,borderColor:'rgba(201,164,92,.35)',overflow:'hidden'},
 fill:{height:'100%'},ghost:{position:'absolute',left:0,top:0,bottom:0,backgroundColor:'rgba(255,236,190,.4)'},
 toggleRow:{flexDirection:'row',alignItems:'center',gap:14,minHeight:48,paddingVertical:4},toggleLabel:{fontFamily:fonts.display,fontSize:14,fontWeight:'700',letterSpacing:.8,color:colors.parchment},
 toggleDescription:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:18,color:colors.muted,marginTop:2},
 track2:{width:48,height:28,borderRadius:14,borderWidth:1,borderColor:'rgba(201,164,92,.45)',backgroundColor:'rgba(6,8,12,.7)',justifyContent:'center',paddingHorizontal:3},trackOn:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},
 knob:{width:20,height:20,borderRadius:10,backgroundColor:'#8d96a8',...(web?{transitionProperty:'transform, background-color',transitionDuration:'220ms'}:{})},knobOn:{backgroundColor:'#2a1a07',transform:[{translateX:20}]},
 key:{minWidth:18,height:18,paddingHorizontal:4,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.4)',backgroundColor:'rgba(0,0,0,.4)',alignItems:'center',justifyContent:'center'},
 keyText:{fontFamily:fonts.ui,fontSize:10,fontWeight:'700',color:colors.muted},
});
