import React,{useState,useEffect,useLayoutEffect,useRef} from 'react';
import {View,Text as PlainText,Pressable,ScrollView,StyleSheet,AccessibilityInfo,Animated,Platform,useWindowDimensions} from 'react-native';
import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import Icon from './Icon';
import {fonts,colors,tint} from './theme';
import {playSound} from './audio';
import {eventSounds} from './feedSounds';
import {describeEvent,damageIcon,verdictLabels} from './chronicleRules';
import {shownHp} from './playbackHp';
import {cue,setShownHp} from './cinematics';
const native=Platform.OS!=='web',web=!native;
// Cinematic cues that ride along with a line's sounds: a hit on you, a critical, healing, victory and defeat.
function cueFor(event,sounds,view){
 const first=(String(event.text??'').match(/^[^.!?]*[.!?]?/)?.[0]??'').trim();
 for(const [name,delay=0] of sounds){
  const at=fn=>setTimeout(fn,delay*1000);
  if(name.startsWith('impact:')&&name.endsWith(':me'))at(()=>cue('hurt'));
  else if(name==='crit')at(()=>cue('crit'));
  else if(name==='heal')at(()=>cue('heal'));
  else if(name==='victory')at(()=>cue(/Adventure complete/i.test(event.text)?'complete':'victory',{sub:first}));
  else if(name==='defeat')at(()=>cue('defeat',{sub:first}));
  else if(name==='down')at(()=>cue('down',{sub:'Hold on. Each turn, roll to survive.'}));
  else if(name==='death')at(()=>cue('death',{sub:/kills you outright/.test(event.text)?'The blow kills you outright.':'Your last breath leaves you.'}));
  else if(name==='whoosh'){const place=String(event.text??'').match(arrivalLine)?.[1]?.trim();if(place)at(()=>cue('area',{over:'You arrive at',title:place}));}
 }
 if(view.type==='round')cue('round',{round:view.round,sub:view.round===1?'Steel is drawn':'The fight goes on'});
}
// A die as it appears in the feed: it tumbles in, its face flickering through other numbers, then lands on the
// roll with a small bounce (a natural 20 lands gold, a 1 lands red). Past turns and reduced motion show it at rest.
const ROLL_TICKS=9,ROLL_TICK=62;
function DieFace({value,animate,small,sides=20}){
 const size=small?30:40,[face,setFace]=useState(animate?1+Math.floor(Math.random()*sides):value),[landed,setLanded]=useState(!animate);
 useEffect(()=>{
  if(!animate)return;
  let tick=0;const timer=setInterval(()=>{tick++;if(tick>=ROLL_TICKS){clearInterval(timer);setFace(value);setLanded(true);}else setFace(1+Math.floor(Math.random()*sides));},ROLL_TICK);
  return()=>clearInterval(timer);
 },[]);
 const shown=landed?value:face,top=landed&&value===20,low=landed&&value===1;
 return <View dataSet={{qb:'die-face',nat:top?'max':low?'one':'',roll:animate?(landed?'landed':'on'):'off'}} style={[s.die,{width:size,height:size,borderRadius:small?6:8}]}>
  <PlainText style={[s.dieText,small&&{fontSize:14},top&&{color:tint('#ffeef0')},low&&{color:'#ffd2c2'}]}>{shown}</PlainText>
 </View>;
}
// A rolled amount (damage, healing, hit points lost): it spins through numbers and settles on the result.
function RollNumber({value,live,style,prefix=''}){
 const [shown,setShown]=useState(live?null:value);
 useEffect(()=>{
  if(!live)return;
  let tick=0;const top=Math.max(4,value*2),timer=setInterval(()=>{tick++;if(tick>=7){clearInterval(timer);setShown(value);}else setShown(1+Math.floor(Math.random()*top));},55);
  return()=>clearInterval(timer);
 },[]);
 const settled=shown===value;
 return <PlainText dataSet={{qb:live&&settled?'num-pop':undefined}} style={[style,live&&!settled&&{opacity:.75}]}>{prefix}{shown??'·'}</PlainText>;
}
function Verdict({kind,actor,live=false}){
 const bad=(actor==='foe'&&['hit','crit'].includes(kind))||['failure'].includes(kind),good=(actor!=='foe'&&['hit','crit','failed','success'].includes(kind));
 const filled=kind==='crit';
 const tone=bad?colors.bloodBright:good?(kind==='success'?colors.heal:colors.gold):colors.muted;
 return <View dataSet={{qb:live?'verdict':undefined}} style={[s.verdict,{borderColor:tone},filled&&{backgroundColor:tone}]}><PlainText style={[s.verdictText,{color:filled?tint('#fff4f5'):tone}]}>{verdictLabels[kind]??kind}</PlainText></View>;
}
function EventRow({event,reduceMotion,sound,me,avatarFor,sceneFor,lead=false}){
 const view=describeEvent(event);
 useEffect(()=>{if(!sound)return;const sounds=eventSounds(event);sounds.forEach(([name,delay=0,options])=>playSound(name,delay,options));try{cueFor(event,sounds,view);}catch{}},[]);
 const opacity=useRef(new Animated.Value(reduceMotion?1:0)).current,rise=useRef(new Animated.Value(reduceMotion?0:8)).current;
 useEffect(()=>{if(reduceMotion){opacity.setValue(1);rise.setValue(0);return;}const animation=Animated.parallel([Animated.timing(opacity,{toValue:1,duration:320,useNativeDriver:native}),Animated.timing(rise,{toValue:0,duration:320,useNativeDriver:native})]);animation.start();return()=>animation.stop();},[reduceMotion]);
 const motion={opacity,transform:[{translateY:rise}]},live=sound&&!reduceMotion;
 const wrap=(children,style,dataSet)=><Animated.View accessible accessibilityLabel={event.text} dataSet={dataSet} style={[style,motion]}>{children}</Animated.View>;
 switch(view.type){
  case 'roll':case 'save':case 'initiative':{
   const foe=view.actor==='foe',crit=view.verdict==='crit';
   const over=view.type==='initiative'?'Initiative':view.type==='save'?'Saving throw':view.check?view.check+' check':foe?'Enemy attack':/check|Perception|Persuasion|Insight|Stealth|Athletics|Investigation|Convince|Search/i.test(view.title+view.math)?'Check':'Your roll';
   return wrap(<>
    <DieFace value={view.natural} animate={live} small={view.type==='initiative'}/>
    <View style={s.cardBody}>
     <PlainText style={[s.cardOver,foe&&{color:'#e79a86'}]}>{over}{view.mode?' · '+view.mode:''}</PlainText>
     <Text numberOfLines={2} style={s.cardTitle}>{view.title||'Roll'}</Text>
     <PlainText style={s.cardMath}>{view.math}{view.target?'  vs '+view.target:''}</PlainText>
     {!!view.outcome&&<Text style={s.cardOutcome}>{view.outcome}</Text>}
    </View>
    <View style={s.cardSide}>
     {view.verdict?<Verdict kind={view.verdict} actor={view.actor} live={live}/>:view.total!=null&&<PlainText style={s.total}>{view.total}</PlainText>}
     {view.damage?.amount>0&&<View style={s.inlineDamage}><Icon name={damageIcon(view.damage.damageType)} size={13} color={colors.gold}/><RollNumber value={view.damage.amount} live={live} style={s.inlineDamageText}/></View>}
    </View>
   </>,[s.card,foe&&s.cardFoe,crit&&s.cardCrit],{qb:crit?'feed-crit':foe?'feed-hurt':'feed-roll'});
  }
  case 'damage':return wrap(<>
   <View style={s.dmgIcon}><Icon name={damageIcon(view.damageType)} size={20} color={colors.goldBright}/></View>
   <RollNumber value={view.amount} live={live} style={s.dmgNum}/>
   <View style={{flex:1,minWidth:0}}><PlainText style={s.dmgLabel}>{view.damageType||'damage'} damage</PlainText>{!!view.math&&<PlainText numberOfLines={1} style={s.cardMath}>{view.math}</PlainText>}</View>
  </>,[s.card,s.dmgCard],{qb:'feed-roll'});
  case 'hurt':return wrap(<>
   <View style={[s.dmgIcon,{borderColor:'rgba(240,106,79,.6)'}]}><Icon name={damageIcon(view.damageType)} size={20} color="#ffb39e"/></View>
   <RollNumber value={view.amount} live={live} prefix="−" style={[s.dmgNum,{color:colors.bloodBright}]}/>
   <View style={{flex:1,minWidth:0}}><PlainText style={[s.dmgLabel,{color:'#ffc9b8'}]}>HP lost{view.damageType?' · '+view.damageType:''}{view.absorbed?' · '+view.absorbed+' absorbed':''}</PlainText>{!!view.math&&<PlainText numberOfLines={1} style={s.cardMath}>{view.math}</PlainText>}</View>
  </>,[s.card,s.cardFoe],{qb:'feed-hurt'});
  case 'heal':return wrap(<>
   <View style={[s.dmgIcon,{borderColor:'rgba(111,191,142,.6)'}]}><Icon name="heal" size={18} color={colors.heal}/></View>
   <RollNumber value={view.amount} live={live} prefix="+" style={[s.dmgNum,{color:colors.heal}]}/>
   <View style={{flex:1,minWidth:0}}><PlainText style={[s.dmgLabel,{color:'#bfe8cd'}]}>HP restored</PlainText><PlainText numberOfLines={1} style={s.cardMath}>{view.title}</PlainText></View>
  </>,[s.card,s.healCard],{qb:'feed-effect'});
  case 'hp':{const down=view.to<view.from;return wrap(<>
   <Icon name="heart" size={13} color={down?colors.bloodBright:colors.heal}/>
   <Text numberOfLines={1} style={s.hpName}>{view.name}</Text>
   <PlainText style={s.hpChange}>{view.from} → <PlainText style={{color:colors.parchment,fontWeight:'800'}}>{view.to}</PlainText> HP</PlainText>
   <View style={[s.delta,{borderColor:down?'rgba(240,106,79,.6)':'rgba(111,191,142,.6)'}]}><PlainText style={[s.deltaText,{color:down?colors.bloodBright:colors.heal}]}>{down?'−':'+'}{Math.abs(view.to-view.from)}</PlainText></View>
  </>,s.hpRow);}
  case 'round':return wrap(<><View dataSet={{qb:'rule-left'}} style={s.roundRule}/><Icon name="swords" size={15} color={colors.bloodBright}/><PlainText style={s.roundText}>Round {view.round}</PlainText><Icon name="swords" size={15} color={colors.bloodBright}/><View dataSet={{qb:'rule-right'}} style={s.roundRule}/></>,s.round);
  case 'turn':return wrap(<View style={s.turnPill}><Icon name="star" size={11} color={colors.goldBright}/><PlainText style={s.turnText}>Your turn</PlainText></View>,s.turnRow);
  case 'opening':return wrap(<><Icon name="bolt" size={13} color={colors.gold}/><PlainText style={s.overText}>Opening attack</PlainText></>,s.overRow);
  case 'order':return wrap(<><PlainText style={s.overText}>Turn order</PlainText>{view.names.map((n,i)=><React.Fragment key={i}>{i>0&&<Icon name="forward" size={12} color={colors.faint}/>}<View style={[s.orderChip,n==='You'&&s.orderYou]}><Text style={[s.orderText,n==='You'&&{color:colors.goldBright}]}>{n}</Text></View></React.Fragment>)}</>,s.overRow);
  case 'note':return wrap(<><Icon name="spell" size={13} color={colors.arcane}/><Text style={s.noteText}>{view.text}</Text></>,s.noteRow);
  // The long tale: a chapter closes on what it revealed, the next opens on its goal; a lead is seen through; a level is earned.
  case 'chapter-done':case 'chapter':{const done=view.type==='chapter-done';return wrap(<>
   <View style={s.dmgIcon}><Icon name={done?'check':'scroll'} size={18} color={colors.goldBright}/></View>
   <View style={s.cardBody}>
    <PlainText style={s.cardOver}>Chapter {view.number} {done?'complete':'begins'}</PlainText>
    <Text style={s.cardTitle}>{view.title}</Text>
    <Text style={s.cardOutcome}>{view.text}</Text>
   </View>
  </>,[s.card,s.taleCard],{qb:'feed-roll'});}
  case 'lead':return wrap(<>
   <View style={s.dmgIcon}><Icon name="check" size={18} color={colors.goldBright}/></View>
   <View style={s.cardBody}><PlainText style={s.cardOver}>Lead seen through</PlainText><Text style={s.cardTitle}>{view.title}</Text></View>
  </>,[s.card,s.taleCard],{qb:'feed-roll'});
  case 'level':return wrap(<>
   <View style={s.dmgIcon}><Icon name="starFill" size={18} color={colors.goldBright}/></View>
   <View style={s.cardBody}><PlainText style={s.cardOver}>A level earned</PlainText><PlainText style={s.cardOutcome}>Take it when you are ready, out of a fight.</PlainText></View>
  </>,[s.card,s.taleCard],{qb:'feed-roll'});
 }
 const kind=event.kind;
 // Arriving somewhere shows that place's painting as an illustrated plate, like a page in a storybook.
 const arrival=kind==='action'&&String(event.text??'').match(arrivalLine)?.[1],scene=arrival&&sceneFor?.(arrival);
 if(scene)return wrap(<ScenePlate subject={scene} over="You arrive at"/>,s.plateWrap);
 if(kind==='player'){const who=event.speakerName&&event.speakerName!==me?event.speakerName:'You';return wrap(<>
  <View style={s.playerHead}><Icon name="quill" size={12} color={tint('#caa9f0')}/><PlainText style={s.playerLabel}>{who}</PlainText></View>
  <Text style={s.playerText}>{event.text}</Text>
 </>,s.player,{qb:'feed-player'});}
 if(kind==='dialogue'){const subject=avatarFor?.(event.speakerId);return wrap(<>
  <View style={s.speakerRow}>{subject?<DynamicArt dataSet={{qb:'avatar'}} subject={subject} style={s.speakerAvatar} compact/>:<View style={s.speakerMark}><Icon name="speak" size={14} color={tint('#e36778')}/></View>}<PlainText style={s.speakerName}>{(event.speakerName??'Dungeon Master')}</PlainText></View>
  <Text style={s.quote}>“{event.text.replace(/^[“"]|[”"]$/g,'')}”</Text>
 </>,s.dialogue,{qb:'feed-dialogue'});}
 if(kind==='narration'){const text=String(event.text??''),cap=lead&&/^[A-Za-z]/.test(text);return wrap(<>
  <Text style={s.prose}>{cap?<PlainText style={s.dropCap}>{text[0]}</PlainText>:null}{cap?text.slice(1):text}</Text>
 </>,s.narration);}
 return wrap(<><Icon name="star" size={12} color={colors.gold}/><Text style={s.actionText}>{event.text}</Text></>,s.actionRow);
}
// "You travel to Lookout Rock. 900 ft; 3 minutes pass." names the place up to the first full stop.
const arrivalLine=/^You (?:arrive at|return to|fall back to|travel to|reach) ([^.!;]+)/;
function ScenePlate({subject,over}){
 return <View style={s.plate}>
  <DynamicArt subject={subject} style={StyleSheet.absoluteFill} compact/>
  <View dataSet={{qb:'plate-shade'}} style={[StyleSheet.absoluteFill,{pointerEvents:'none'}]}/>
  <View style={s.plateCaption}><PlainText style={s.plateOver}>{over}</PlainText><PlainText numberOfLines={1} style={s.plateName}>{subject.name}</PlainText></View>
 </View>;
}
function Divider({label}){return <View style={s.divider}><View dataSet={{qb:'rule-left'}} style={s.dividerRule}/><PlainText style={s.dividerText}>{label}</PlainText><View dataSet={{qb:'rule-right'}} style={s.dividerRule}/></View>;}
function Writing(){return <View dataSet={{qb:'typing'}} style={s.writing} accessibilityLabel="The Dungeon Master is writing"><Icon name="quill" size={14} color={colors.gold}/><View style={s.dots}>{[0,1,2].map(i=><View key={i} dataSet={{qb:'dot'}} style={s.dot}/>)}</View></View>;}
const leadIndex=events=>events.findIndex(e=>e.kind==='narration');
export default function TurnPlayback({turns=[],animateId,onPlayingChange,opening,busy,me=null,fill=false,aside=null,intro=null,names=null,avatarFor=null,sceneFor=null,openingScene=null,typing=false}){
 const turn=turns.at(-1),[phase,setPhase]=useState({id:null,count:0}),[history,setHistory]=useState(false),[reduceMotion,setReduceMotion]=useState(false),scroll=useRef(null),follow=useRef(true),{height,width}=useWindowDimensions();
 // The feed follows the newest line until the player scrolls up (its own scrolling only ever moves down), and the
 // first jump to the end, when the game opens, is instant rather than animated.
 const lastY=useRef(0),settled=useRef(false);
 const count=turn?(phase.id===turn.id?phase.count:turn.id===animateId&&!reduceMotion?1:turn.events.length):0;
 const playing=!!turn&&count<turn.events.length;
 const feedLimit=width<600?Math.max(150,Math.min(260,height*.3)):Math.max(230,Math.min(400,height*.43));
 useEffect(()=>{let mounted=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(mounted)setReduceMotion(v);});const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return()=>{mounted=false;subscription.remove();};},[]);
 useEffect(()=>{
  if(!turn)return;
  follow.current=true;if(!fill)scroll.current?.scrollTo({y:0,animated:false});
  setPhase({id:turn.id,count:turn.id===animateId&&!reduceMotion?1:turn.events.length});
  if(turn.id!==animateId||reduceMotion)return;
  const timer=setInterval(()=>setPhase(p=>{const count=Math.min(turn.events.length,p.count+1);if(count===turn.events.length)clearInterval(timer);return {id:turn.id,count};}),850);
  return()=>clearInterval(timer);
 },[turn?.id,animateId,reduceMotion]);
 useEffect(()=>{onPlayingChange(playing);return()=>onPlayingChange(false);},[playing,onPlayingChange]);
 // While this turn plays, the HUD's HP bars follow the story instead of jumping straight to the result.
 useLayoutEffect(()=>{if(!fill||!names)return;const animating=!!turn&&turn.id===animateId&&!reduceMotion&&playing;setShownHp(animating?shownHp(turn.events,count,names):null);},[fill,turn?.id,count,animateId,reduceMotion,playing,names?.hero,names?.foe]);
 useEffect(()=>()=>{if(fill)setShownHp(null);},[fill]);
 const row=(t,e,i,live)=><EventRow key={t.id+'-'+i} event={e} reduceMotion={!live||reduceMotion} sound={live} me={me} avatarFor={avatarFor} sceneFor={sceneFor} lead={i===leadIndex(t.events)}/>;
 // Fill mode: one continuous chronicle. Earlier turns sit above; the newest plays out at the bottom and the view follows it.
 // While the player types on a phone the feed gives its header up, and it stays on its last lines as its height
 // changes (a keyboard opening must not hide what the player is replying to).
 if(fill)return <View style={s.fillPanel}>
  <View style={[s.fillBar,typing&&{display:'none'}]}><View style={s.fillTitleRow}><Icon name="journal" size={13} color={colors.goldMid}/><PlainText style={[s.title,{marginVertical:4}]}>{turn?'Chronicle · Turn '+turn.id:'The story'}</PlainText></View>{playing?<Pressable accessibilityRole="button" onPress={()=>setPhase({id:turn.id,count:turn.events.length})} style={s.skipInline}><PlainText style={s.link}>Show all</PlainText><Icon name="forward" size={12} color={colors.gold}/></Pressable>:aside}</View>
  <ScrollView ref={scroll} accessibilityLabel="Adventure response feed" style={s.fillScroll} contentContainerStyle={s.fillContent} scrollEventThrottle={80} onLayout={()=>{if(follow.current&&settled.current)scroll.current?.scrollToEnd({animated:false});}} onScroll={e=>{const n=e.nativeEvent,y=n.contentOffset.y;if(y+n.layoutMeasurement.height>=n.contentSize.height-80)follow.current=true;else if(y<lastY.current-2)follow.current=false;lastY.current=y;}} onContentSizeChange={()=>{if(!follow.current)return;scroll.current?.scrollToEnd({animated:settled.current&&!reduceMotion});settled.current=true;}}>
   {intro}
   {!!openingScene&&(!turn||turns[0]?.id===1)&&<ScenePlate subject={openingScene} over="Where your tale begins"/>}
   {!turn&&<Text style={s.opening}>{opening}</Text>}
   {turns.slice(0,-1).map(t=><View key={t.id} style={s.pastTurn}><Divider label={'Turn '+t.id}/>{t.events.map((e,i)=>row(t,e,i,false))}</View>)}
   {turn&&<View accessibilityLiveRegion="polite">{turns.length>1&&<Divider label={'Turn '+turn.id}/>}{turn.events.slice(0,count).map((e,i)=>row(turn,e,i,turn.id===animateId))}</View>}
   {busy&&<Writing/>}
  </ScrollView>
 </View>;
 return <View style={s.panel}>
 <View style={s.header}><PlainText style={s.title}>{busy?'Resolving your action…':playing?'Playing out the turn…':turn?'Turn '+turn.id:'THE STORY'}</PlainText><View style={s.skipSlot}>{playing&&<Pressable accessibilityRole="button" onPress={()=>setPhase({id:turn.id,count:turn.events.length})} style={s.skip}><PlainText style={s.link}>Show all now</PlainText></Pressable>}</View></View>
 <ScrollView ref={scroll} accessibilityLabel="Adventure response feed" style={[s.scroll,{maxHeight:feedLimit,...(playing?{minHeight:feedLimit}:{})}]} nestedScrollEnabled scrollEventThrottle={80} onScroll={e=>{const n=e.nativeEvent;follow.current=n.contentOffset.y+n.layoutMeasurement.height>=n.contentSize.height-60;}} onContentSizeChange={()=>{if(follow.current&&turn?.id===animateId)scroll.current?.scrollToEnd({animated:!reduceMotion});}}>
 <View accessibilityLiveRegion="polite">{turn?turn.events.slice(0,count).map((e,i)=>row(turn,e,i,turn.id===animateId)):<Text style={s.opening}>{opening}</Text>}</View>
 </ScrollView>
 {turns.length>1&&<View style={s.historyToggle}><Pressable accessibilityRole="button" accessibilityState={{expanded:history}} onPress={()=>setHistory(v=>!v)} style={s.skip}><PlainText style={s.link}>{history?'Hide earlier turns':'Earlier turns ('+(turns.length-1)+')'}</PlainText></Pressable></View>}
 {history&&turns.length>1&&<ScrollView style={s.history} nestedScrollEnabled>{turns.slice(0,-1).map(t=><View key={t.id}><PlainText style={s.title}>Turn {t.id}</PlainText>{t.events.map((e,i)=>row(t,e,i,false))}</View>)}</ScrollView>}
 </View>;
}
const shadow=web?{textShadow:tint('0 0 14px rgba(230,48,82,.45)')}:{};
const s=StyleSheet.create({panel:{marginBottom:6},
 fillPanel:{flex:1,minHeight:0},fillBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:30},fillTitleRow:{flexDirection:'row',alignItems:'center',gap:8,flexShrink:1},
 skipInline:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:6,minHeight:30},
 fillScroll:{flex:1,minHeight:0,overscrollBehavior:'contain'},fillContent:{paddingBottom:8},
 pastTurn:{opacity:.8},
 divider:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:12},dividerRule:{flex:1,height:1},dividerText:{fontFamily:fonts.display,color:tint('rgba(178,34,58,.75)'),fontSize:10,letterSpacing:2.6,textTransform:'uppercase'},
 header:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},skipSlot:{minWidth:95,height:44},historyToggle:{height:44},
 title:{flexShrink:1,fontFamily:fonts.display,color:colors.goldMid,fontSize:11,fontWeight:'700',letterSpacing:2.4,textTransform:'uppercase',marginVertical:10},
 scroll:{flexGrow:0,overscrollBehavior:'auto',overflowAnchor:'none'},history:{maxHeight:320},
 opening:{fontFamily:fonts.story,color:'#efe7d4',fontSize:19,lineHeight:31,paddingVertical:12},
 // Result cards: die, title and arithmetic, verdict.
 card:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:9,paddingHorizontal:12,marginBottom:6,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.28)'),backgroundColor:tint('rgba(25,17,26,.72)')},
 cardFoe:{borderColor:'rgba(240,106,79,.38)'},cardCrit:{borderColor:tint('rgba(201,140,255,.8)')},
 cardBody:{flex:1,minWidth:0},cardSide:{alignItems:'flex-end',gap:6},
 cardOver:{fontFamily:fonts.display,fontSize:9.5,fontWeight:'700',letterSpacing:1.8,color:colors.goldMid,textTransform:'uppercase'},
 cardTitle:{fontFamily:fonts.display,fontSize:15,fontWeight:'700',color:colors.parchment,letterSpacing:.4,marginTop:1},
 cardMath:{fontFamily:fonts.ui,fontSize:12,color:tint('#b8aeb5'),marginTop:2,fontVariant:['tabular-nums']},
 cardOutcome:{fontFamily:fonts.story,fontStyle:'italic',fontSize:15,lineHeight:21,color:'#ded2cd',marginTop:4},
 die:{alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:tint('rgba(224,74,92,.55)'),backgroundColor:tint('#2c202e')},
 dieText:{fontFamily:fonts.display,fontSize:18,fontWeight:'800',color:colors.parchment,fontVariant:['tabular-nums']},
 verdict:{paddingHorizontal:9,paddingVertical:3,borderRadius:3,borderWidth:1.5},verdictText:{fontFamily:fonts.display,fontSize:10.5,fontWeight:'800',letterSpacing:1.6,textTransform:'uppercase'},
 total:{fontFamily:fonts.display,fontSize:22,fontWeight:'800',color:colors.goldBright,fontVariant:['tabular-nums']},
 inlineDamage:{flexDirection:'row',alignItems:'center',gap:4},inlineDamageText:{fontFamily:fonts.display,fontSize:15,fontWeight:'800',color:colors.goldBright},
 dmgCard:{borderColor:tint('rgba(224,74,92,.4)')},healCard:{borderColor:'rgba(111,191,142,.45)'},taleCard:{alignItems:'flex-start',borderColor:tint('rgba(224,74,92,.55)'),backgroundColor:tint('rgba(40,22,62,.6)')},
 dmgIcon:{width:36,height:36,borderRadius:18,borderWidth:1,borderColor:tint('rgba(224,74,92,.5)'),alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.3)'},
 dmgNum:{fontFamily:fonts.display,fontSize:28,fontWeight:'800',color:colors.goldBright,minWidth:34,fontVariant:['tabular-nums'],...shadow},
 dmgLabel:{fontFamily:fonts.display,fontSize:12,fontWeight:'700',letterSpacing:1.4,color:'#dfcdc5',textTransform:'uppercase'},
 hpRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:5,paddingHorizontal:12,marginBottom:4},
 hpName:{flexShrink:1,fontFamily:fonts.display,fontSize:13,fontWeight:'700',color:'#ded2cd'},hpChange:{fontFamily:fonts.ui,fontSize:12.5,color:colors.muted,fontVariant:['tabular-nums']},
 delta:{marginLeft:'auto',paddingHorizontal:7,paddingVertical:1,borderRadius:10,borderWidth:1},deltaText:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'800',fontVariant:['tabular-nums']},
 round:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:10},roundRule:{flex:1,height:1},
 roundText:{fontFamily:fonts.display,fontSize:13,fontWeight:'800',letterSpacing:3.2,color:'#ffc4b0',textTransform:'uppercase'},
 turnRow:{alignItems:'center',marginVertical:8},turnPill:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:14,paddingVertical:5,borderRadius:14,borderWidth:1,borderColor:tint('rgba(224,74,92,.6)'),backgroundColor:tint('rgba(48,26,78,.7)')},
 turnText:{fontFamily:fonts.display,fontSize:11,fontWeight:'800',letterSpacing:2.4,color:colors.goldBright,textTransform:'uppercase'},
 overRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8,marginVertical:6,paddingHorizontal:4},
 overText:{fontFamily:fonts.display,fontSize:10,fontWeight:'700',letterSpacing:2,color:colors.goldMid,textTransform:'uppercase'},
 orderChip:{paddingHorizontal:9,paddingVertical:3,borderRadius:12,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(31,24,32,.8)')},orderYou:{borderColor:tint('rgba(224,74,92,.7)')},
 orderText:{fontFamily:fonts.ui,fontSize:12,fontWeight:'600',color:'#d9d3c3'},
 noteRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4,paddingHorizontal:12,marginBottom:4},noteText:{flex:1,fontFamily:fonts.ui,fontSize:12.5,lineHeight:18,color:'#a8ddd4'},
 player:{alignSelf:'flex-end',maxWidth:'88%',marginLeft:28,marginBottom:10,marginTop:4,paddingVertical:9,paddingHorizontal:14,borderRadius:10,borderTopRightRadius:3,borderWidth:1,borderColor:tint('rgba(183,142,230,.4)'),backgroundColor:tint('rgba(54,38,56,.6)')},
 playerHead:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:3},playerLabel:{fontFamily:fonts.display,fontSize:9.5,fontWeight:'700',letterSpacing:1.8,color:tint('#caa9f0'),textTransform:'uppercase'},
 playerText:{fontFamily:fonts.story,fontStyle:'italic',fontSize:17,lineHeight:24,color:tint('#ede4f7')},
 dialogue:{marginBottom:10,marginTop:2,paddingVertical:10,paddingHorizontal:14,borderLeftWidth:2,borderColor:tint('#c31f35'),borderRadius:4,backgroundColor:tint('rgba(25,17,26,.6)')},
 speakerRow:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:6},speakerAvatar:{width:30,height:30,borderRadius:15},
 speakerMark:{width:30,height:30,borderRadius:15,borderWidth:1,borderColor:tint('rgba(242,50,76,.5)'),alignItems:'center',justifyContent:'center'},
 speakerName:{fontFamily:fonts.display,fontSize:12,fontWeight:'800',letterSpacing:1.6,color:tint('#e36778'),textTransform:'uppercase'},
 quote:{fontFamily:fonts.story,fontStyle:'italic',fontSize:18,lineHeight:28,color:'#ecdfd9'},
 narration:{paddingVertical:6,paddingHorizontal:4,marginBottom:10},
 prose:{fontFamily:fonts.story,fontSize:18.5,lineHeight:29,color:'#efe7d4'},
 dropCap:{fontFamily:fonts.logo,fontSize:30,fontWeight:'900',color:colors.gold,lineHeight:29},
 actionRow:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:7,paddingHorizontal:12,marginBottom:6,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.22)'),backgroundColor:tint('rgba(25,17,26,.55)')},
 actionText:{flex:1,fontFamily:fonts.ui,fontSize:13.5,lineHeight:20,color:tint('#e9e5e8')},
 plateWrap:{marginVertical:8},plate:{height:170,borderRadius:6,overflow:'hidden',borderWidth:1,borderColor:tint('rgba(224,74,92,.45)'),backgroundColor:tint('#1b141c'),justifyContent:'flex-end'},
 plateCaption:{padding:14,paddingTop:24},plateOver:{fontFamily:fonts.display,fontSize:9.5,fontWeight:'700',letterSpacing:2.4,color:colors.goldMid,textTransform:'uppercase'},
 plateName:{fontFamily:fonts.display,fontSize:21,fontWeight:'700',letterSpacing:1,color:'#f6eae5',marginTop:2},
 writing:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:10,paddingHorizontal:6},writingText:{fontFamily:fonts.story,fontStyle:'italic',fontSize:15.5,color:'#c2b1ab'},
 dots:{flexDirection:'row',gap:4,marginLeft:2},dot:{width:5,height:5,borderRadius:3,backgroundColor:colors.gold},
 skip:{paddingVertical:12,paddingHorizontal:6,minHeight:44},link:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'}});
