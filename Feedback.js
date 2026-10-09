import React,{useState,useEffect,useRef} from 'react';
import {View,Text,TextInput,Pressable,Modal,ScrollView,Linking,StyleSheet} from 'react-native';
import {GameButton,Toggle} from './ui';
import Icon from './Icon';
import {fonts,colors,type,tint} from './theme';
// Playtest feedback from inside the game. Every note goes to the host's PC: playtest-feedback.md in the Questbound
// folder, with the full details in .questbound-feedback.jsonl beside it (feedback-notes.cjs), read with
// node feedback-report.cjs. The phone and tester links send it through the gateway, the host's own desktop through
// desktop-server.cjs. GitHub issues stay as a second way.
const ISSUES='https://github.com/turqindustrial/questbound/issues/new/choose',NAME_KEY='questbound.tester.name';
export const hostDesktop=(location=globalThis.location)=>!!location&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&['8081','8082'].includes(location.port);
export function feedbackEndpoint(location=globalThis.location){return location?'/api/feedback':null;}
// A small hub so anything in play (the Report chip beside an error, the Dungeon Master's admission of a fault) can open
// the feedback sheet that is on screen, with the problem attached and the player's words filled in.
const feedbackRequests=new Set();
export function openFeedback(request={}){feedbackRequests.forEach(fn=>{try{fn(request);}catch{}});return feedbackRequests.size>0;}
export function useFeedbackRequests(callback,active=true){
 const ref=useRef(callback);ref.current=callback;
 useEffect(()=>{if(!active)return;const fn=request=>ref.current?.(request);feedbackRequests.add(fn);return()=>feedbackRequests.delete(fn);},[active]);
}
// context is the one-line summary ({hero,story,screen,where}) or a function called at send that returns
// {summary, details} (App.js, feedbackRules.js), so the note carries the game as it is at that moment.
function gatherContext(context){
 try{const value=typeof context==='function'?context():context;if(value&&typeof value==='object'&&('summary' in value||'details' in value))return {summary:value.summary??{},details:value.details??null};return {summary:value??{},details:null};}catch{return {summary:{},details:null};}
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
export default function FeedbackSheet({visible,onClose,context={},problem=null,prefill=''}){
 const endpoint=feedbackEndpoint(),host=hostDesktop();
 const [include,setInclude]=useState(true);
 const [name,setName]=useState(readName),[text,setText]=useState(''),[rating,setRating]=useState(null),[state,setState]=useState('idle'),[error,setError]=useState('');
 useEffect(()=>{if(visible){setState('idle');setError('');setInclude(true);if(prefill)setText(old=>old.trim()?old:String(prefill).slice(0,2000));}},[visible,prefill]);
 async function send(){
  if(state==='sending'||text.trim().length<2)return;setState('sending');setError('');saveName(name.trim());
  try{
   const gathered=gatherContext(context);
   // Without the include toggle the note keeps only who and where; the last turns, story log and errors stay here.
   let details=gathered.details;
   if(details&&!include)details={v:details.v,build:details.build,screen:details.screen,device:details.device,audio:details.audio,perf:details.perf};
   else if(details&&problem&&!(details.problems??[]).some(p=>p?.id===problem.id))details={...details,problems:[...(details.problems??[]),problem].slice(-5)};
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({text:text.trim(),rating,context:{...gathered.summary,player:name.trim(),device:deviceLabel()},details})});
   const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.error||(host?'This PC’s game server did not take the note (it may be the development server). Use GitHub issues instead.':'The note could not be sent. Try again in a moment.'));
   setState('sent');setText('');setRating(null);
  }catch(e){setState('idle');setError(e.name==='TimeoutError'?'The host’s PC took too long to answer. Try again in a moment.':e.message);}
 }
 return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}><Pressable accessibilityLabel="Close feedback" onPress={onClose} dataSet={{qb:'scrim'}} style={s.scrim}><Pressable onPress={()=>{}} dataSet={{qb:'sheet'}} style={s.sheet} accessibilityViewIsModal>
  <ScrollView contentContainerStyle={{gap:12}} keyboardShouldPersistTaps="handled">
   <View style={s.emblem}><Icon name="feedback" size={24} color={colors.goldBright}/></View><Text style={s.overline}>Playtest</Text><Text style={s.title}>Send feedback</Text>
   {!endpoint?<>
    <Text style={s.text}>Feedback can only be sent from the game in a browser. Use GitHub issues instead.</Text>
    <GameButton label="Open GitHub issues" onPress={()=>Linking.openURL(ISSUES)}/>
   </>:state==='sent'?<>
    <View style={s.sent}><Icon name="check" size={22} color={colors.heal}/><Text style={[s.text,{color:colors.heal,flex:1}]}>Thank you! Your note reached the host.</Text></View>
    <GameButton label="Send another" onPress={()=>setState('idle')}/>
   </>:<>
    <Text style={s.text}>{host?'You’re the host: this note goes into playtest-feedback.md on this PC, beside your testers’ notes, with the details of where you are in the game.':'What was fun, confusing, slow, too loud or broken? Your device and where you are in the game are included automatically.'}</Text>
    {!!problem&&<View style={s.about}><Text style={s.aboutText} numberOfLines={3}>About: {problem.said?'“'+problem.said+'”':'your last turn'}{problem.error||problem.answer?' — '+(problem.error??problem.answer):''}</Text></View>}
    <Text style={s.label}>How was it?</Text>
    <View style={s.stars} accessibilityRole="radiogroup">{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityRole="radio" accessibilityLabel={n+' of 5'} accessibilityState={{checked:rating===n}} onPress={()=>setRating(rating===n?null:n)} style={s.star}><Icon name={rating>=n?'starFill':'star'} size={30} color={rating>=n?colors.gold:tint('#7f767c')}/></Pressable>)}</View>
    <Text style={s.label}>Your note</Text>
    <TextInput value={text} onChangeText={setText} multiline maxLength={2000} placeholder="The fight was great, but I didn’t know how to…" placeholderTextColor={tint('#938890')} accessibilityLabel="Your feedback" dataSet={{qb:'input'}} style={[s.input,{minHeight:110}]}/>
    <Text style={s.label}>Your name (optional)</Text>
    <TextInput value={name} onChangeText={setName} maxLength={60} placeholder="So the host knows who wrote it" placeholderTextColor={tint('#938890')} accessibilityLabel="Your name" dataSet={{qb:'input'}} style={s.input}/>
    <Toggle value={include} onChange={setInclude} label="Include what happened" description={problem?'Your last turns and the error, so the host can see what went wrong.':'Your last turns, the latest story lines and any errors the game showed you.'}/>
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <GameButton variant="primary" icon={state==='sending'?'quill':'send'} label={state==='sending'?'Sending…':'Send to the host'} disabled={state==='sending'||text.trim().length<2} onPress={send}/>
    <Text style={s.small}>Prefer GitHub? <Text accessibilityRole="link" onPress={()=>Linking.openURL(ISSUES)} style={{color:colors.gold,textDecorationLine:'underline'}}>Open an issue</Text>.</Text>
   </>}
   <GameButton label="Close" onPress={onClose}/>
  </ScrollView>
 </Pressable></Pressable></Modal>;
}
const s=StyleSheet.create({
 scrim:{flex:1,backgroundColor:tint('rgba(5,3,5,.78)'),alignItems:'center',justifyContent:'center',padding:16},
 emblem:{alignSelf:'center',width:52,height:52,borderRadius:26,borderWidth:1,borderColor:tint('rgba(224,74,92,.6)'),alignItems:'center',justifyContent:'center',backgroundColor:tint('rgba(48,26,78,.45)')},sent:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:6,borderWidth:1,borderColor:'rgba(111,191,142,.45)'},
 sheet:{width:'100%',maxWidth:480,maxHeight:'92%',padding:22,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(22,16,23,.98)')},
 overline:{...type.label,textAlign:'center'},title:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:2,color:colors.parchment,textAlign:'center',textTransform:'uppercase'},
 text:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:14,lineHeight:22},label:{...type.label,marginTop:4},small:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,textAlign:'center'},
 stars:{flexDirection:'row',gap:6},star:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},starText:{fontSize:30,color:tint('#7f767c')},
 input:{fontFamily:fonts.story,color:tint('#f5efe1'),backgroundColor:tint('rgba(8,5,9,.75)'),borderColor:tint('rgba(178,34,58,.4)'),borderWidth:1,borderRadius:4,padding:12,fontSize:17,lineHeight:24,textAlignVertical:'top'},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:13,lineHeight:20},
 about:{padding:10,borderRadius:4,borderLeftWidth:3,borderLeftColor:colors.goldMid,backgroundColor:tint('rgba(48,26,78,.35)')},aboutText:{fontFamily:fonts.story,color:colors.parchment,fontSize:15,lineHeight:21,fontStyle:'italic'},
});
