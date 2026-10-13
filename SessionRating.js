import React,{useState,useEffect,useRef} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import Icon from './Icon';
import {feedbackEndpoint} from './Feedback';
import {ratingAnswers,ratingAnswerLabels,ratingBest,ratingWrong,ratingChipLabels} from './ratingRules';
import {sessionSummary,noteRatingAnswered,noteRatingDismissed} from './playMetrics';
import {fonts,colors,tint} from './theme';
// "How was that session?": a small card at a natural stopping point (App.js chooses the moment, ratingRules.js the
// rules). One tap on an answer sends it to the host at once, through the feedback route, as a session rating
// (feedback-notes.cjs): the answer, the moment and this session's counts (minutes, turns, failed turns, device, build),
// and nothing else: no name, hero, story or turns. Then the player may add a few chips and a line, sent as an addition.
// "Not now" (the cross) closes it and keeps it away for a week.
const faces={great:'faceGreat',good:'faceGood',okay:'faceOkay',rough:'faceRough'};
async function sendRating(body){
 const response=await fetch(feedbackEndpoint(),{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'not saved');return data;
}
export default function SessionRating({moment,top=64,onClose}){
 const [answer,setAnswer]=useState(null),[ref,setRef]=useState(null),[state,setState]=useState('ask'),[chips,setChips]=useState([]),[line,setLine]=useState('');
 const closing=useRef(null),done=useRef(false);
 useEffect(()=>()=>clearTimeout(closing.current),[]);
 const close=answered=>{if(done.current)return;done.current=true;clearTimeout(closing.current);if(!answered)noteRatingDismissed();onClose?.(answered);};
 async function choose(value){
  if(state!=='ask'&&state!=='failed')return;
  setAnswer(value);setState('sending');
  try{const data=await sendRating({kind:'session',rating:value,moment,session:sessionSummary()});noteRatingAnswered();setRef(data.ref??null);setState('more');}
  catch{setState('failed');}
 }
 const something=chips.length>0||!!line.trim();
 async function add(){
  if(state!=='more'||!ref||!something)return;
  setState('adding');
  try{await sendRating({kind:'session',follows:ref,chips,text:line.trim().slice(0,200)});setState('sent');closing.current=setTimeout(()=>close(true),2200);}
  catch{setState('more');}
 }
 const pick=id=>setChips(list=>list.includes(id)?list.filter(c=>c!==id):[...list,id].slice(0,6));
 const asking=state==='ask'||state==='sending'||state==='failed',adding=state==='more'||state==='adding';
 const offered=answer==='okay'||answer==='rough'?ratingWrong:ratingBest;
 return <View style={[s.layer,{top}]}>
  <View dataSet={{qb:'plate',rating:'card'}} accessibilityRole="dialog" accessibilityLabel="How was that session?" style={s.card}>
   <View style={s.head}>
    <Text style={s.title} numberOfLines={2}>{asking?'How was that session?':state==='sent'?'Thank you!':'Thanks! Anything to add?'}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={answer&&!asking?'Close':'Not now'} onPress={()=>close(!!answer&&!asking)} dataSet={{keepfocus:'true'}} style={s.close}><Icon name="close" size={16} color={colors.muted}/></Pressable>
   </View>
   {asking&&<>
    <View style={s.answers} accessibilityRole="radiogroup">{ratingAnswers.map(value=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={ratingAnswerLabels[value]} accessibilityState={{checked:answer===value,disabled:state==='sending'}} disabled={state==='sending'} onPress={()=>choose(value)} dataSet={{rating:value}} style={[s.answer,answer===value&&s.answerOn]}>
     <Icon name={faces[value]} size={26} color={answer===value?colors.goldBright:colors.gold}/>
     <Text style={s.answerText} numberOfLines={1}>{ratingAnswerLabels[value]}</Text>
    </Pressable>)}</View>
    <Text style={s.small}>{state==='failed'?'The host’s PC didn’t answer. Tap again to retry, or close this.':'One tap tells the host. Only your answer and how long you played are sent.'}</Text>
   </>}
   {adding&&<>
    <Text style={s.label}>{answer==='okay'||answer==='rough'?'What went wrong?':'What was best?'}</Text>
    <View style={s.chips}>{offered.map(id=><Pressable key={id} accessibilityRole="checkbox" accessibilityState={{checked:chips.includes(id)}} onPress={()=>pick(id)} dataSet={{keepfocus:'true',chip:id}} style={[s.chip,chips.includes(id)&&s.chipOn]}><Text style={[s.chipText,chips.includes(id)&&{color:colors.parchment}]} numberOfLines={1}>{ratingChipLabels[id]}</Text></Pressable>)}</View>
    <TextInput value={line} onChangeText={setLine} maxLength={200} placeholder="Add a line (optional)" placeholderTextColor={tint('#938890')} accessibilityLabel="Add a line" returnKeyType="send" onSubmitEditing={add} dataSet={{qb:'input'}} style={s.input}/>
    <View style={s.row}>
     <Pressable accessibilityRole="button" onPress={()=>close(true)} dataSet={{keepfocus:'true'}} style={s.button}><Text style={s.buttonText}>Done</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityState={{disabled:state==='adding'||!something}} disabled={state==='adding'||!something} onPress={add} dataSet={{keepfocus:'true'}} style={[s.button,s.primary,!something&&{opacity:.55}]}><Text style={[s.buttonText,{color:colors.parchment}]}>{state==='adding'?'Sending…':'Send'}</Text></Pressable>
    </View>
   </>}
   {state==='sent'&&<View style={s.sent}><Icon name="check" size={18} color={colors.heal}/><Text style={[s.small,{color:colors.heal,flex:1,textAlign:'left'}]}>It reached the host.</Text></View>}
  </View>
 </View>;
}
const s=StyleSheet.create({
 layer:{position:'absolute',left:0,right:0,zIndex:70,alignItems:'center',paddingHorizontal:12,pointerEvents:'box-none'},
 card:{width:'100%',maxWidth:440,padding:14,gap:10,borderRadius:8,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(22,16,23,.97)')},
 head:{flexDirection:'row',alignItems:'center',gap:8},
 title:{flex:1,minWidth:0,fontFamily:fonts.display,fontSize:16,fontWeight:'700',letterSpacing:.8,color:colors.parchment},
 close:{width:36,height:36,alignItems:'center',justifyContent:'center',borderRadius:18},
 answers:{flexDirection:'row',gap:6},
 answer:{flex:1,minWidth:0,minHeight:62,alignItems:'center',justifyContent:'center',gap:4,paddingVertical:8,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(39,30,41,.9)')},
 answerOn:{borderColor:tint('#f06e80'),backgroundColor:tint('#9e1b32')},
 answerText:{fontFamily:fonts.ui,fontSize:13,fontWeight:'600',color:colors.text},
 small:{fontFamily:fonts.ui,fontSize:12,lineHeight:17,color:colors.muted,textAlign:'center'},
 label:{fontFamily:fonts.display,fontSize:13,fontWeight:'700',letterSpacing:.8,color:colors.goldMid},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:6},
 chip:{minHeight:34,maxWidth:'100%',paddingHorizontal:12,justifyContent:'center',borderRadius:17,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(39,30,41,.9)')},
 chipOn:{borderColor:tint('#f06e80'),backgroundColor:tint('#9e1b32')},
 chipText:{fontFamily:fonts.ui,fontSize:13,color:colors.text},
 input:{fontFamily:fonts.story,fontSize:16,color:tint('#f5efe1'),backgroundColor:tint('rgba(8,5,9,.75)'),borderColor:tint('rgba(178,34,58,.4)'),borderWidth:1,borderRadius:4,paddingHorizontal:10,paddingVertical:8,minHeight:40},
 row:{flexDirection:'row',gap:8},
 button:{flex:1,minHeight:40,alignItems:'center',justifyContent:'center',borderRadius:4,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('#271e29')},
 primary:{backgroundColor:tint('#9e1b32'),borderColor:tint('#f06e80')},
 buttonText:{fontFamily:fonts.display,fontSize:13,fontWeight:'700',letterSpacing:1,color:colors.text,textTransform:'uppercase'},
 sent:{flexDirection:'row',alignItems:'center',gap:8},
});
