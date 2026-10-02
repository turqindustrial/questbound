import React,{useState,useEffect} from 'react';
import {View,Text,TextInput,Pressable,Modal,ScrollView,Linking,StyleSheet} from 'react-native';
import {GameButton} from './ui';
import Icon from './Icon';
import {fonts,colors,type} from './theme';
// Playtest feedback from inside the game. On a shared or Wi-Fi link the note goes to the host's PC
// (playtest-feedback.md in the Questbound folder); the host's own desktop points to GitHub instead.
const ISSUES='https://github.com/turqindustrial/questbound/issues/new/choose',NAME_KEY='questbound.tester.name';
export function feedbackEndpoint(location=globalThis.location){
 const desktop=location&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&['8081','8082'].includes(location.port);
 return !location||desktop?null:'/api/feedback';
}
export function deviceLabel(nav=globalThis.navigator,win=globalThis){
 const ua=nav?.userAgent??'';
 const os=/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)||(/Macintosh/.test(ua)&&nav?.maxTouchPoints>1)?'iPad':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS X/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':'Other device';
 const browser=/Edg\//.test(ua)?'Edge':/SamsungBrowser/.test(ua)?'Samsung Internet':/CriOS|Chrome\//.test(ua)?'Chrome':/FxiOS|Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'browser';
 let app='';try{if(win?.matchMedia?.('(display-mode: standalone)').matches||nav?.standalone)app=' · home-screen app';}catch{}
 return os+' · '+browser+(win?.innerWidth?' · '+win.innerWidth+'×'+win.innerHeight:'')+app;
}
const readName=()=>{try{return globalThis.localStorage?.getItem(NAME_KEY)??'';}catch{return '';}};
const saveName=value=>{try{globalThis.localStorage?.setItem(NAME_KEY,value);}catch{}};
export default function FeedbackSheet({visible,onClose,context={}}){
 const endpoint=feedbackEndpoint();
 const [name,setName]=useState(readName),[text,setText]=useState(''),[rating,setRating]=useState(null),[state,setState]=useState('idle'),[error,setError]=useState('');
 useEffect(()=>{if(visible){setState('idle');setError('');}},[visible]);
 async function send(){
  if(state==='sending'||text.trim().length<2)return;setState('sending');setError('');saveName(name.trim());
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({text:text.trim(),rating,context:{...context,player:name.trim(),device:deviceLabel()}})});
   const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.error||'The note could not be sent. Try again in a moment.');
   setState('sent');setText('');setRating(null);
  }catch(e){setState('idle');setError(e.name==='TimeoutError'?'The host’s PC took too long to answer. Try again in a moment.':e.message);}
 }
 return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}><Pressable accessibilityLabel="Close feedback" onPress={onClose} dataSet={{qb:'scrim'}} style={s.scrim}><Pressable onPress={()=>{}} dataSet={{qb:'sheet'}} style={s.sheet} accessibilityViewIsModal>
  <ScrollView contentContainerStyle={{gap:12}} keyboardShouldPersistTaps="handled">
   <View style={s.emblem}><Icon name="feedback" size={24} color={colors.goldBright}/></View><Text style={s.overline}>Playtest</Text><Text style={s.title}>Send feedback</Text>
   {!endpoint?<>
    <Text style={s.text}>You’re the host. Notes your testers send from inside the game arrive in <Text style={{color:colors.parchment}}>playtest-feedback.md</Text> in the Questbound folder. To note something yourself, use GitHub issues.</Text>
    <GameButton label="Open GitHub issues" onPress={()=>Linking.openURL(ISSUES)}/>
   </>:state==='sent'?<>
    <View style={s.sent}><Icon name="check" size={22} color={colors.heal}/><Text style={[s.text,{color:colors.heal,flex:1}]}>Thank you! Your note reached the host.</Text></View>
    <GameButton label="Send another" onPress={()=>setState('idle')}/>
   </>:<>
    <Text style={s.text}>What was fun, confusing, slow, too loud or broken? Your device and where you are in the game are included automatically.</Text>
    <Text style={s.label}>How was it?</Text>
    <View style={s.stars} accessibilityRole="radiogroup">{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityRole="radio" accessibilityLabel={n+' of 5'} accessibilityState={{checked:rating===n}} onPress={()=>setRating(rating===n?null:n)} style={s.star}><Icon name={rating>=n?'starFill':'star'} size={30} color={rating>=n?colors.gold:'#7f767c'}/></Pressable>)}</View>
    <Text style={s.label}>Your note</Text>
    <TextInput value={text} onChangeText={setText} multiline maxLength={2000} placeholder="The fight was great, but I didn’t know how to…" placeholderTextColor="#938890" accessibilityLabel="Your feedback" dataSet={{qb:'input'}} style={[s.input,{minHeight:110}]}/>
    <Text style={s.label}>Your name (optional)</Text>
    <TextInput value={name} onChangeText={setName} maxLength={60} placeholder="So the host knows who wrote it" placeholderTextColor="#938890" accessibilityLabel="Your name" dataSet={{qb:'input'}} style={s.input}/>
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <GameButton variant="primary" icon={state==='sending'?'quill':'send'} label={state==='sending'?'Sending…':'Send to the host'} disabled={state==='sending'||text.trim().length<2} onPress={send}/>
    <Text style={s.small}>Prefer GitHub? <Text accessibilityRole="link" onPress={()=>Linking.openURL(ISSUES)} style={{color:colors.gold,textDecorationLine:'underline'}}>Open an issue</Text>.</Text>
   </>}
   <GameButton label="Close" onPress={onClose}/>
  </ScrollView>
 </Pressable></Pressable></Modal>;
}
const s=StyleSheet.create({
 scrim:{flex:1,backgroundColor:'rgba(5,3,5,.78)',alignItems:'center',justifyContent:'center',padding:16},
 emblem:{alignSelf:'center',width:52,height:52,borderRadius:26,borderWidth:1,borderColor:'rgba(224,74,92,.6)',alignItems:'center',justifyContent:'center',backgroundColor:'rgba(48,26,78,.45)'},sent:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:6,borderWidth:1,borderColor:'rgba(111,191,142,.45)'},
 sheet:{width:'100%',maxWidth:480,maxHeight:'92%',padding:22,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:'rgba(22,16,23,.98)'},
 overline:{...type.label,textAlign:'center'},title:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:2,color:colors.parchment,textAlign:'center',textTransform:'uppercase'},
 text:{fontFamily:fonts.ui,color:'#d4ced2',fontSize:14,lineHeight:22},label:{...type.label,marginTop:4},small:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,textAlign:'center'},
 stars:{flexDirection:'row',gap:6},star:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},starText:{fontSize:30,color:'#7f767c'},
 input:{fontFamily:fonts.story,color:'#f5efe1',backgroundColor:'rgba(8,5,9,.75)',borderColor:'rgba(178,34,58,.4)',borderWidth:1,borderRadius:4,padding:12,fontSize:17,lineHeight:24,textAlignVertical:'top'},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:13,lineHeight:20},
});
