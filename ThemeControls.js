import React,{useEffect,useState} from 'react';
import {View,Text,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import {Section} from './ui';
import Icon from './Icon';
import {themeChoices,themeSwatches} from './themeRules';
import {fonts,colors,tint,currentTheme,subscribeTheme,setTheme} from './theme';
import {playSound} from './audio';
// Settings → Theme: the colour of the whole game on this device. Each choice shows its own colours (its main colour
// with a pip of its accent), whatever theme is on, and choosing one repaints the game at once.
export function ThemeSettings(){
 const [theme,setChosen]=useState(currentTheme);
 useEffect(()=>{setChosen(currentTheme());return subscribeTheme(setChosen);},[]);
 const chosen=themeChoices.find(choice=>choice.id===theme)??themeChoices[0];
 // Three to a row, or two on a phone, so every name fits beside its dot.
 const narrow=useWindowDimensions().width<520;
 return <View dataSet={{qb:'plate'}} style={s.panel}>
  <Section icon="palette" title="Theme" style={{marginTop:0,marginBottom:2}}/>
  <Text style={s.caption}>The colour of the game on this device: buttons, frames, lettering and glows. It changes at once.</Text>
  <View accessibilityRole="radiogroup" accessibilityLabel="Theme colour" style={s.row}>
   {themeChoices.map(choice=>{
    const on=choice.id===theme,swatch=themeSwatches(choice.id);
    return <Pressable key={choice.id} accessibilityRole="radio" accessibilityState={{checked:on}} accessibilityLabel={choice.label+' theme'} onPress={()=>{playSound('tick');setTheme(choice.id);}} dataSet={{qb:'card',selected:on?'true':'false'}} style={[s.choice,{flexBasis:narrow?'46%':'30%'},on&&s.choiceOn]}>
     <View style={[s.dot,{backgroundColor:swatch.deep,borderColor:swatch.main}]}><View style={[s.core,{backgroundColor:swatch.main}]}/><View style={[s.pip,{backgroundColor:swatch.accent}]}/></View>
     <Text numberOfLines={1} style={[s.name,on&&s.nameOn]}>{choice.label}</Text>
     {on&&<Icon name="check" size={14} color={colors.goldBright}/>}
    </Pressable>;
   })}
  </View>
  <Text accessibilityLiveRegion="polite" style={s.note}>{chosen.label} is on. Healing stays green, danger red and coins gold in every theme.</Text>
 </View>;
}
const s=StyleSheet.create({
 panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18,gap:10},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20},
 note:{fontFamily:fonts.ui,color:colors.faint,fontSize:12,lineHeight:18},
 row:{flexDirection:'row',flexWrap:'wrap',gap:8},
 choice:{flexGrow:1,minHeight:48,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,paddingHorizontal:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(20,15,21,.8)')},
 choiceOn:{borderColor:tint('rgba(190,150,255,.8)')},
 dot:{width:28,height:28,borderRadius:14,borderWidth:2,alignItems:'center',justifyContent:'center',flexShrink:0},
 core:{width:14,height:14,borderRadius:7},
 pip:{position:'absolute',right:-3,bottom:-3,width:11,height:11,borderRadius:6,borderWidth:2,borderColor:tint('#0a070b')},
 name:{flexShrink:1,flexGrow:1,fontFamily:fonts.display,fontSize:13,fontWeight:'700',letterSpacing:1.2,color:colors.text,textTransform:'uppercase'},
 nameOn:{color:colors.goldBright},
});
