import React, {useState} from 'react';
import {View, Text, TextInput, Pressable, StyleSheet} from 'react-native';
import {fonts,colors} from './theme';
import {healthAmount,updateHealth} from './healthRules';

export default function HealthTracker({maximum,health,setHealth,readOnly=false}) {
  const [amount,setAmount] = useState('');
  const [error,setError] = useState('');
  const current = health?.current ?? maximum, temp = health?.temp ?? 0;
  function apply(kind) {
    const value = healthAmount(amount);
    if (value === null) {setError('Enter a whole number from 1 to 9999.');return;}
    setHealth(previous=>updateHealth(previous,maximum,kind,value));
    setAmount('');setError('');
  }
  const button = (label,handler,disabled=false) => <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={handler} style={[s.button,disabled && {opacity:0.45}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
  return <View style={s.panel}>
    <Text style={s.heading}>Hit points</Text>
    <View accessibilityLiveRegion="polite"><Text style={s.value}>{current} / {maximum} HP</Text><Text style={s.text}>Temporary HP: {temp}</Text></View>
    {current === 0 ? <Text style={s.warning}>0 HP — resolve unconsciousness, death saves, and possible massive damage with the DM. This tracker does not determine death or prevent attacks yet. Temporary HP does not restore consciousness.</Text> : current <= maximum/2 && <Text style={s.warning}>Bloodied — half your maximum HP or less.</Text>}
    {readOnly ? <Text style={s.caption}>The adventure controls HP during this quest. Use its combat actions to take damage or drink your healing draught.</Text> : <>
    <Text style={s.caption}>Enter damage received or healing granted by the DM or an effect. Use the final damage after any resistance or other adjustments.</Text>
    <TextInput accessibilityLabel="Hit-point amount" keyboardType="number-pad" value={amount} onChangeText={value=>{setAmount(value);setError('');}} maxLength={6} placeholder="Amount" placeholderTextColor="#96a1b6" style={s.input}/>
    {!!error && <Text accessibilityRole="alert" style={s.warning}>{error}</Text>}
    <View style={s.row}>{button('Take damage',()=>apply('damage'))}{button('Receive healing',()=>apply('heal'))}</View>
    {button('Replace temporary HP',()=>apply('temporary'))}
    <Text style={s.caption}>Temporary HP absorbs damage first. New temporary HP replaces the old amount; keep your existing amount by leaving it unchanged. Healing does not restore temporary HP.</Text>
    {!!health?.message && <Text accessibilityLiveRegion="polite" style={s.text}>{health.message}</Text>}
    {button('Undo last HP change',()=>{setHealth(previous=>previous?.previous ? {...previous.previous,message:'Last HP change undone.'} : previous);setError('');},!health?.previous)}
    </>}
    <Text style={s.caption}>HP is saved on this device and stays when you leave the sheet or refresh. Starting a new adventure or saving a character resets HP. Long rests are available at the inn. Death saves and other manual effects still need DM handling.</Text>
  </View>;
}
const s=StyleSheet.create({panel:{backgroundColor:'rgba(14,18,28,.9)',padding:18,borderRadius:4,marginVertical:16,borderWidth:1,borderColor:colors.goldLine},heading:{fontFamily:fonts.display,fontSize:20,fontWeight:'700',letterSpacing:1.2,color:colors.parchment},value:{fontFamily:fonts.display,fontSize:34,fontWeight:'800',color:colors.gold,marginVertical:8},text:{fontFamily:fonts.ui,color:'#dde1ea',fontSize:15,lineHeight:24},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:21,marginVertical:8},warning:{fontFamily:fonts.ui,color:colors.danger,lineHeight:22,marginVertical:8},input:{fontFamily:fonts.display,color:'#f5efe1',backgroundColor:'rgba(4,6,10,.75)',borderWidth:1,borderColor:'rgba(201,164,92,.4)',padding:14,borderRadius:3,fontSize:18,marginVertical:8},row:{flexDirection:'row',flexWrap:'wrap',gap:8},button:{backgroundColor:'#1a202d',borderWidth:1,borderColor:'rgba(201,164,92,.35)',padding:14,borderRadius:3,minHeight:48,marginTop:8,justifyContent:'center'},buttonText:{fontFamily:fonts.display,color:colors.parchment,textAlign:'center',fontWeight:'700',letterSpacing:1.4,fontSize:13,textTransform:'uppercase'}});
