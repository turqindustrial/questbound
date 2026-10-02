import React,{useEffect,useState} from 'react';
import {View,Text,Pressable,Modal,StyleSheet} from 'react-native';
import {displayState,subscribeDisplay,toggleFullscreen,setDisplayPrefs} from './fullscreen';
import {GameButton,IconButton,Section,Toggle} from './ui';
import {fonts,colors,type} from './theme';
function useDisplay(){const [state,setState]=useState(displayState);useEffect(()=>{setState(displayState());return subscribeDisplay(setState);},[]);return state;}
function HomeScreenHelp({visible,onClose}){
 return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}><View dataSet={{qb:'scrim'}} style={s.scrim}><View dataSet={{qb:'sheet'}} style={s.sheet} accessibilityViewIsModal>
  <Text style={s.overline}>Full screen on iPhone</Text>
  <Text style={s.heading}>Add Questbound to your Home Screen</Text>
  <Text style={s.step}>1.  Tap the Share button (the square with an arrow) in Safari’s toolbar.</Text>
  <Text style={s.step}>2.  Choose <Text style={s.em}>Add to Home Screen</Text>, then <Text style={s.em}>Add</Text>.</Text>
  <Text style={s.step}>3.  Open Questbound from its gold Q icon. It fills the screen with no browser bars.</Text>
  <Text style={s.note}>iPhone browsers don’t let web pages go full screen by themselves. The Home Screen version is the same game; pair it once with your code.</Text>
  <GameButton variant="primary" label="Got it" onPress={onClose}/>
 </View></View></Modal>;
}
// The corner button: full screen where the browser allows it, Home Screen instructions on iPhone.
export function FullscreenToggle({style,compact=false}){
 const d=useDisplay(),[help,setHelp]=useState(false);
 if(d.installed&&!d.supported)return null;
 if(!d.supported&&!d.ios)return null;
 if(compact)return <><IconButton icon={d.fullscreen?'shrink':'expand'} label={d.fullscreen?'Exit full screen':d.supported?'Full screen':'Full screen on iPhone'} onPress={()=>d.supported?toggleFullscreen():setHelp(true)} style={style}/><HomeScreenHelp visible={help} onClose={()=>setHelp(false)}/></>;
 return <><Pressable accessibilityRole="button" accessibilityLabel={d.fullscreen?'Exit full screen':'Enter full screen'} onPress={()=>d.supported?toggleFullscreen():setHelp(true)} dataSet={{qb:'chip'}} style={[s.toggle,style]}><Text style={[s.toggleText,compact&&s.icon]}>{compact?'⛶':d.fullscreen?'⛶ Exit full screen':'⛶ Full screen'}</Text></Pressable><HomeScreenHelp visible={help} onClose={()=>setHelp(false)}/></>;
}
export function DisplaySettings(){
 const d=useDisplay(),[help,setHelp]=useState(false);
 return <View dataSet={{qb:'plate'}} style={s.panel}>
  <Section icon="expand" title="Display" style={{marginTop:0,marginBottom:2}}/>
  {d.supported?<>
   <Text style={s.caption}>Hide the browser for a full-screen game. Press F on a keyboard to switch, or Esc to leave.</Text>
   <GameButton variant={d.fullscreen?'secondary':'primary'} icon={d.fullscreen?'shrink':'expand'} label={d.fullscreen?'Exit full screen':'Enter full screen'} onPress={toggleFullscreen} style={{marginTop:0}}/>
   <Toggle value={d.autoFullscreen} onChange={value=>setDisplayPrefs({autoFullscreen:value})} label="Full screen on first tap" description="Go full screen the first time you tap each visit."/>
  </>:d.installed?<Text style={s.caption}>Questbound is running from your Home Screen, already full screen.</Text>:d.ios?<>
   <Text style={s.caption}>On iPhone, add Questbound to your Home Screen to play full screen.</Text>
   <GameButton variant="primary" icon="info" label="Show me how" onPress={()=>setHelp(true)} style={{marginTop:0}}/>
  </>:<Text style={s.caption}>This browser doesn’t support full screen for web pages.</Text>}
  <Toggle value={d.screenEffects} onChange={value=>setDisplayPrefs({screenEffects:value})} label="Screen flashes and shake" description="The red flash and shake when you are hit, portraits flinching, violet flares and the critical-hit burst. Turn off if flashing effects bother you."/>
  <HomeScreenHelp visible={help} onClose={()=>setHelp(false)}/>
 </View>;
}
const s=StyleSheet.create({toggle:{paddingHorizontal:12,paddingVertical:8,minHeight:36,borderRadius:18,borderWidth:1,borderColor:'rgba(178,34,58,.4)',backgroundColor:'rgba(20,15,21,.8)',justifyContent:'center'},toggleText:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.2},icon:{fontSize:16,letterSpacing:0,minWidth:14,textAlign:'center'},
 panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18,gap:12},section:{fontFamily:fonts.display,color:colors.gold,fontSize:17,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20},
 switchRow:{flexDirection:'row',alignItems:'center',gap:12,minHeight:44},box:{width:24,height:24,borderRadius:3,borderWidth:1,borderColor:'rgba(178,34,58,.5)',backgroundColor:'#271e29',alignItems:'center',justifyContent:'center'},boxOn:{backgroundColor:'#9e1b32',borderColor:'#f06e80'},tick:{color:'#ffeef0',fontWeight:'800',fontSize:14},switchText:{fontFamily:fonts.ui,color:colors.text,fontSize:14,flexShrink:1},
 scrim:{flex:1,backgroundColor:'rgba(5,3,5,.8)',alignItems:'center',justifyContent:'center',padding:18},sheet:{width:'100%',maxWidth:440,padding:24,borderRadius:4,borderWidth:1,borderColor:colors.goldLine,backgroundColor:'rgba(22,16,23,.98)',gap:10},
 overline:{...type.label},heading:{fontFamily:fonts.display,color:colors.parchment,fontSize:21,fontWeight:'700',letterSpacing:.8,marginBottom:4},step:{fontFamily:fonts.ui,color:colors.text,fontSize:15,lineHeight:23},em:{fontWeight:'700',color:colors.gold},glyph:{color:colors.gold},note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginTop:4}});
