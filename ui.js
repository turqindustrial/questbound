import React from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {fonts,colors,type} from './theme';
// Building blocks for the gilded look. On web, dataSet hooks add gradients, glows and corner filigree from webTheme.js.
export function Panel({children,style,variant='panel',...props}){
 return <View dataSet={{qb:variant}} style={[s.panel,variant==='glass'&&s.glass,style]} {...props}>{children}</View>;
}
export function GameButton({label,onPress,variant='secondary',disabled,style,textStyle,accessibilityLabel,icon}){
 const primary=variant==='primary',danger=variant==='danger';
 return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{disabled:!!disabled}} disabled={disabled} onPress={onPress} dataSet={{qb:primary?'btn-primary':danger?'btn-danger':'btn'}} style={({pressed})=>[s.button,primary&&s.primary,danger&&s.danger,pressed&&!disabled&&s.pressed,disabled&&s.disabled,style]}>
  <Text style={[s.buttonText,primary&&s.primaryText,textStyle]}>{icon?icon+'  ':''}{label}</Text>
 </Pressable>;
}
export function Ornament({style,glyph='◆'}){
 return <View style={[s.ornament,style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><View dataSet={{qb:'rule-left'}} style={s.rule}/><Text style={s.glyph}>{glyph}</Text><View dataSet={{qb:'rule-right'}} style={s.rule}/></View>;
}
export function Eyebrow({children,style}){return <Text style={[type.eyebrow,style]}>{children}</Text>;}
export function StatBar({value,maximum,kind='hp',height=10,style}){
 const pct=Math.max(0,Math.min(100,100*(value??0)/Math.max(1,maximum)));
 return <View dataSet={{qb:'bar'}} style={[s.track,{height},style]} accessibilityRole="progressbar" accessibilityValue={{min:0,max:maximum,now:value??0}}>
  <View dataSet={{qb:kind==='hp'&&pct<=30?'bar-low':'bar-'+kind}} style={[s.fill,{width:pct+'%',backgroundColor:kind==='enemy'?colors.blood:kind==='temp'?colors.arcane:pct<=30?colors.blood:colors.heal}]}/>
 </View>;
}
const s=StyleSheet.create({
 panel:{backgroundColor:'rgba(13,17,26,.92)',borderWidth:1,borderColor:colors.goldLine,borderRadius:6,padding:24},
 glass:{backgroundColor:'rgba(10,14,22,.78)'},
 button:{minHeight:52,paddingVertical:14,paddingHorizontal:20,marginTop:10,borderRadius:4,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'#1a202d',justifyContent:'center',alignItems:'center'},
 primary:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},
 danger:{backgroundColor:'#5a1d17',borderColor:'#c8412f'},
 pressed:{transform:[{scale:.985}]},
 disabled:{opacity:.5},
 buttonText:{fontFamily:fonts.display,fontSize:14,fontWeight:'700',letterSpacing:2,color:colors.parchment,textAlign:'center',textTransform:'uppercase'},
 primaryText:{color:'#2a1a07'},
 ornament:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:14},
 rule:{flex:1,height:1,backgroundColor:colors.goldLine},
 glyph:{color:colors.gold,fontSize:10},
 track:{width:'100%',borderRadius:2,backgroundColor:'rgba(0,0,0,.55)',borderWidth:1,borderColor:'rgba(201,164,92,.35)',overflow:'hidden'},
 fill:{height:'100%'},
});
