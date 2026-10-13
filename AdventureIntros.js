import React,{useState,useEffect} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import intros from './adventureIntros.json';
import {GameButton,Ornament,ScreenTitle,Crest,Toggle} from './ui';
import Icon from './Icon';
import {playSound} from './audio';
import {fonts,colors,type,tint} from './theme';
import {NarratorChoice} from './StoryControls';
import {storyPreferences,setStoryPreferences,subscribeStoryPreferences} from './storyPreferences';
import DynamicArt from './DynamicArt';
const icons={hostile:'swords',surprise:'compass',idea:'quill',easy:'flag',crown:'crown',drowned:'wave',sunforge:'flame',winter:'frost',deep:'door',names:'eye',oath:'shield'};
// With a story behind them, a hero can carry on in the same region (the next chapter) or set out somewhere new.
function Continuation({continuation,continuing,onContinuing,busy}){
 return <View style={s.choice}>{[[true,'map','Continue in this region','The next tale begins a few miles from '+continuation.place+'. Everyone you met, the places you found, every grudge and debt, your companions and your pack come with you, and the country you know keeps its own map.'],[false,'compass','Somewhere new','Leave '+continuation.place+' behind. Your companions and your pack come with you; the rest of the world is new.']].map(([value,icon,title,copy])=>{const chosen=continuing===value;return <Pressable key={title} accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onContinuing(value);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:'gold'}} style={[s.card,s.option,chosen&&s.selected]}>
  <View style={s.top}><Crest icon={icon} size={40} color={colors.goldBright}/><Text style={[s.title,{flex:1,fontSize:19}]}>{title}</Text>{chosen&&<View style={s.check}><Icon name="check" size={16} color={tint('#fff4f5')} strokeWidth={2.4}/></View>}</View>
  <Text style={s.copy}>{copy}</Text></Pressable>;})}</View>;
}
// The player's own idea for a tale (up to 300 characters). On the Your own tale card it is the whole brief; before the
// next tale in a region it is an optional wish.
export const ideaLimit=300;
export const ideaReady=idea=>typeof idea==='string'&&idea.trim().length>=8;
function IdeaBox({idea,onIdea,busy,optional=false}){
 return <View style={s.ideaWrap}>
  <Text style={s.label}>{optional?'Anything you would like to happen? (optional)':'Your idea'}</Text>
  <TextInput value={idea} onChangeText={onIdea} editable={!busy} multiline maxLength={ideaLimit} accessibilityLabel={optional?'A wish for the next tale':'Your idea for the tale'} placeholder={optional?'A rival returns, a storm cuts the roads, my sister comes looking for me…':'A haunted lighthouse on a frozen coast. A heist in a city built on the back of a sleeping giant. A plague of silence…'} placeholderTextColor={tint('#938890')} style={s.idea}/>
  <Text style={s.ideaNote}>{idea.length}/{ideaLimit}. Tales stay in Questbound’s own world: name a book or film and you get its mood, with people and places of the tale’s own.</Text>
 </View>;
}
// Easy start (storyPreferences.js, per device, on unless turned off): any tale but the Skirmish begins with the hero's
// orders in hand. Easy to get into always begins that way, so the switch shows on and cannot be turned off there.
function EasyStart({always=false,busy,journey=false}){
 const [prefs,setPrefs]=useState(storyPreferences);
 useEffect(()=>{setPrefs(storyPreferences());return subscribeStoryPreferences(setPrefs);},[]);
 return <Toggle value={always||prefs.easyStart!==false} disabled={always||busy} onChange={on=>{playSound(on?'select':'tick');setStoryPreferences({easyStart:on});}} label="Easy start" description={journey?'Every ready journey begins this way: someone in charge gives you a clear first errand, and chapter 1 is that errand.':always?'Easy to get into always begins this way: someone in charge gives you a clear first errand, and chapter 1 is that errand.':'Begin with your orders in hand: someone in charge gives you a clear first errand, and chapter 1 is that errand.'} style={s.easy}/>;
}
// ---------- Ready journeys ----------
// The library's journeys (tale-library.cjs, journeyLibrary.js): each a long tale already written, with a pitch to
// compare (its hook, what you will do and face, its mood, its length and what sets it apart) and, once painted, the
// picture of where it begins. Each starts at once. Cards wrap in two columns where there is room, never sideways.
const terrainIcons={plains:'travel',forest:'leaf',hills:'map',mountains:'peak',coast:'wave',marsh:'cloud',desert:'sun',snow:'frost',caverns:'door'};
export const journeyChoice=id=>'journey:'+id;
function JourneyTag({icon,text}){return <View style={s.tag}><Icon name={icon} size={10} color={colors.gold}/><Text style={s.tagText}>{text}</Text></View>;}
function JourneyCard({journey:j,chosen,busy,onSelect,narrow,wide}){
 return <Pressable accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} accessibilityLabel={j.title+'. '+j.hook} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onSelect(journeyChoice(j.id));}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:'gold',journey:'true'}} style={[s.card,s.journey,chosen&&s.selected]}>
  {j.cover?<DynamicArt subject={j.cover} quiet style={[s.cover,{height:wide?150:narrow?118:136}]} dataSet={{qb:'journey-cover'}}/>:<View style={[s.cover,s.coverBlank]}><Icon name={terrainIcons[j.terrain]??'compass'} size={22} color={colors.goldDeep}/>{!!j.terrain&&<Text style={s.coverWord}>{j.terrain.toUpperCase()}</Text>}</View>}
  <View style={s.top}><View style={{flex:1,minWidth:0}}>
   <View style={s.tags}>{!!j.mood&&<Text style={s.tone}>{j.mood.toUpperCase()}</Text>}<JourneyTag icon="scroll" text={j.chapters+(j.chapters===1?' CHAPTER':' CHAPTERS')}/><JourneyTag icon="bolt" text="READY NOW"/></View>
   <Text style={[s.title,narrow&&{fontSize:19}]}>{j.title}</Text>
   {!!(j.region||j.terrain)&&<View style={s.land}><Icon name={terrainIcons[j.terrain]??'map'} size={12} color={colors.goldMid}/><Text style={s.landText}>{[j.region,j.terrain].filter(Boolean).join(' · ')}</Text></View>}
  </View>{chosen&&<View style={s.check}><Icon name="check" size={16} color={tint('#fff4f5')} strokeWidth={2.4}/></View>}</View>
  <Text style={[s.setting,narrow&&{fontSize:16,lineHeight:23}]}>{j.hook}</Text>
  {!!j.blurb&&<Text style={s.copy}>{j.blurb}</Text>}
  {!!j.special&&<View style={s.special}><Icon name="star" size={13} color={colors.goldBright}/><Text style={s.specialText}>{j.special}</Text></View>}
 </Pressable>;
}
function JourneyShelf({journeys,selected,onSelect,onStart,busy,error,narrow}){
 const [width,setWidth]=useState(0),two=width>=680,cell=two?Math.floor((width-12)/2):null;
 return <View style={s.shelf}>
  <View style={s.shelfHead}><Icon name="compass" size={14} color={colors.goldMid}/><Text style={s.shelfTitle}>Ready journeys</Text><Text style={s.shelfCount}>{journeys.length}</Text></View>
  <Text style={s.shelfNote}>Each is a long tale already written and ready to start at once. Read them, compare them, and choose the one that calls to you.</Text>
  <View onLayout={e=>setWidth(Math.floor(e.nativeEvent.layout.width))} dataSet={{qb:'journeys'}} style={s.grid}>{journeys.map(j=>{const chosen=selected===journeyChoice(j.id);return <View key={j.id} style={[s.cell,cell?{width:cell}:{width:'100%'}]}>
   <JourneyCard journey={j} chosen={chosen} busy={busy} onSelect={onSelect} narrow={narrow} wide={two}/>
   {chosen&&<View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':'play'} label={busy?'One moment…':'Begin this journey'} disabled={busy} onPress={onStart} style={{marginTop:0}}/></View>}
  </View>;})}</View>
 </View>;
}
// Let fate decide, with journeys ready: one of them, chosen by chance.
const fateCopy={setting:'One of the ready journeys, chosen for you by chance. You find out which when it begins.',conflict:'Its land, its people and its trouble stay a surprise until the first scene, and it starts at once.',journey:null,stakes:null,tone:'Any journey',arrival:'Ready at once'};
const firstTime=()=>{try{return !globalThis.localStorage?.getItem('questbound.tips.v1');}catch{return false;}};
export default function AdventureIntros({selected,onSelect,onStart,busy,error,continuation=null,continuing=false,onContinuing,idea='',onIdea=()=>{},journeys=null}){
 const narrow=useWindowDimensions().width<420;
 // With journeys ready, the list is Your own tale, the journeys, Let fate decide (one of them) and the Skirmish; the
 // written openings and Easy to get into (every journey is one) are offered only when the library cannot be reached.
 const library=Array.isArray(journeys)&&journeys.length>0,shown=library?intros.filter(i=>i.idea||i.id==='surprise'||i.local):intros;
 const ready=library&&(selected==='surprise'||String(selected).startsWith('journey:'));
 if(continuation&&continuing)return <View><ScreenTitle eyebrow="Next tale" icon="map" title="Where does your story go next?" sub={'After '+continuation.title+'.'}/>
  <Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>
  <IdeaBox idea={idea} onIdea={onIdea} busy={busy} optional/>
  <View style={s.narrator}><NarratorChoice compact/><EasyStart busy={busy}/></View>
  <View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':'play'} label={busy?'One moment…':'Begin the next tale'} disabled={busy} onPress={onStart} style={{marginTop:0}}/></View>
  <Ornament/><Text style={s.note}>Starting replaces your current adventure only after the new story has been created and saved.</Text></View>;
 return <View><ScreenTitle eyebrow="New adventure" icon="compass" title="Where does your story begin?" sub="Choose a tale, or bring your own idea. Each is yours alone: a long story told in chapters, with its own country, people, side errands and roads to other lands."/>
 {/* A first-time player (the in-game "How to play" card not yet dismissed) is told where to start. */}
  {!continuation&&firstTime()&&library&&<Text style={s.first}>First time here? Pick any <Text style={s.firstStrong}>ready journey</Text> below: each starts at once, with your orders in hand and a clear first errand. For a two-minute practice fight instead, choose <Text style={s.firstStrong}>Skirmish</Text> at the end of the list.</Text>}
  {!continuation&&firstTime()&&!library&&<Text style={s.first}>First time here? Keep <Text style={s.firstStrong}>Easy start</Text> on and any tale begins with your orders in hand and a clear first errand; <Text style={s.firstStrong}>Easy to get into</Text> is ready the fastest. For a two-minute practice fight instead, choose <Text style={s.firstStrong}>Skirmish</Text> at the end of the list.</Text>}
  {!!continuation&&<Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>}
  <View style={s.narrator}><NarratorChoice compact/>{selected!=='hostile'&&<EasyStart always={selected==='easy'||ready} journey={ready} busy={busy}/>}</View>
 {/* The Begin button sits right under the chosen opening, so a phone player never scrolls to find it. */}
 {shown.map(listed=>{const intro=library&&listed.id==='surprise'?{...listed,...fateCopy}:listed,chosen=selected===intro.id,hot=!!intro.local,quick=library&&intro.id==='surprise';return <React.Fragment key={intro.id}><Pressable accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onSelect(intro.id);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:hot?'hot':'gold'}} style={[s.card,chosen&&s.selected,hot&&s.combat,chosen&&hot&&{borderColor:colors.bloodBright}]}>
 <View style={s.top}><Crest icon={icons[intro.id]??'star'} size={46} color={hot?tint('#ffb39e'):colors.goldBright}/><View style={{flex:1,minWidth:0}}>
  <View style={s.tags}><Text style={[s.tone,hot&&{color:tint('#ff9f86')}]}>{intro.tone.toUpperCase()}</Text>{intro.scale==='saga'&&<View style={s.tag}><Icon name="scroll" size={10} color={colors.gold}/><Text style={s.tagText}>LONG TALE</Text></View>}{intro.errand&&<View style={s.tag}><Icon name="flag" size={10} color={colors.gold}/><Text style={s.tagText}>CLEAR START</Text></View>}{hot&&<View style={[s.tag,s.tagHot]}><Icon name="bolt" size={10} color={tint('#ffb39e')}/><Text style={[s.tagText,{color:tint('#ffb39e')}]}>INSTANT</Text></View>}{quick&&<JourneyTag icon="bolt" text="READY NOW"/>}</View>
  <Text style={[s.title,narrow&&{fontSize:19}]}>{intro.title}</Text></View>{chosen&&<View style={[s.check,hot&&{backgroundColor:colors.bloodBright,borderColor:tint('#ffd2c2')}]}><Icon name="check" size={16} color={tint('#fff4f5')} strokeWidth={2.4}/></View>}</View>
 <Text style={[s.setting,narrow&&{fontSize:16,lineHeight:23}]}>{intro.setting}</Text>
 {/* The chosen opening tells what is wrong, where the road leads and what is at stake. */}
 {chosen&&intro.idea&&<IdeaBox idea={idea} onIdea={onIdea} busy={busy}/>}
  {chosen&&<View style={s.facts}>{[[hot?'What it is':'The trouble',intro.conflict,'swords'],['The road',intro.journey,'travel'],['At stake',intro.stakes,'heart']].filter(f=>f[1]).map(([label,copy,icon])=><View key={label} style={s.fact}><View style={s.factHead}><Icon name={icon} size={12} color={colors.goldMid}/><Text style={s.label}>{label}</Text></View><Text style={s.copy}>{copy}</Text></View>)}</View>}
 <Text style={s.arrival}>— {intro.arrival}</Text></Pressable>
 {chosen&&<View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':hot?'swords':'play'} label={busy?(hot?'Drawing steel…':'One moment…'):intro.idea&&!ideaReady(idea)?'Write your idea first':'Begin '+(hot?'the encounter':'this adventure')} disabled={busy||(!!intro.idea&&!ideaReady(idea))} onPress={onStart} style={{marginTop:0}}/></View>}
 {intro.idea&&library&&<JourneyShelf journeys={journeys} selected={selected} onSelect={onSelect} onStart={onStart} busy={busy} error={error} narrow={narrow}/>}</React.Fragment>;})}
 <Ornament/>
 <Text style={s.note}>Starting replaces your current adventure only after the new story has been created and saved.</Text></View>;
}
const s=StyleSheet.create({
 copy:{fontFamily:fonts.ui,color:tint('#d4ced2'),lineHeight:23,fontSize:14.5,marginBottom:10},
 card:{padding:18,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.25)'),backgroundColor:tint('#211822'),marginBottom:12},
 selected:{borderColor:colors.gold},combat:{borderColor:tint('rgba(200,65,47,.5)')},
 top:{flexDirection:'row',gap:14,alignItems:'center',marginBottom:10},
 tags:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:4},
 tone:{fontFamily:fonts.display,color:tint('#b58cff'),fontSize:10,fontWeight:'700',letterSpacing:2},
 tag:{flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:tint('rgba(224,74,92,.45)'),borderRadius:10,paddingHorizontal:7,paddingVertical:2},
 tagText:{fontFamily:fonts.ui,fontSize:9,fontWeight:'700',letterSpacing:1.1,color:colors.gold},
 tagHot:{borderColor:tint('rgba(240,106,79,.55)')},
 title:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:21,letterSpacing:.6},
 check:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.gold,borderWidth:1,borderColor:tint('#f06e80')},
 setting:{fontFamily:fonts.story,fontStyle:'italic',color:tint('#ded1cb'),fontSize:17,lineHeight:25,marginBottom:8},
 label:{...type.label,fontSize:9},facts:{gap:2,marginTop:2,marginBottom:2,paddingTop:10,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.18)')},fact:{},factHead:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:4},
 arrival:{fontFamily:fonts.story,color:tint('#de96a5'),fontSize:15.5,fontStyle:'italic'},
 begin:{marginTop:-4,marginBottom:16},
 shelf:{marginTop:4,marginBottom:10},shelfHead:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4},shelfTitle:{...type.label,fontSize:11,letterSpacing:2},shelfCount:{fontFamily:fonts.ui,fontSize:11,fontWeight:'700',color:colors.goldBright,borderWidth:1,borderColor:tint('rgba(224,74,92,.45)'),borderRadius:9,paddingHorizontal:6,minWidth:18,textAlign:'center'},
 shelfNote:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:19,marginBottom:10},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:12,alignItems:'flex-start'},cell:{minWidth:0},
 journey:{padding:14,marginBottom:12},cover:{height:136,borderRadius:4,marginBottom:12},coverBlank:{height:44,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:tint('rgba(178,34,58,.18)'),backgroundColor:tint('rgba(8,5,9,.35)')},coverWord:{fontFamily:fonts.ui,fontSize:10,fontWeight:'700',letterSpacing:2,color:colors.goldDeep},
 land:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4},landText:{fontFamily:fonts.ui,fontSize:12.5,color:colors.muted,flexShrink:1},
 special:{flexDirection:'row',gap:8,alignItems:'flex-start',paddingTop:10,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.18)')},specialText:{fontFamily:fonts.ui,color:tint('#e7d9c9'),fontSize:13.5,lineHeight:20,flex:1,fontWeight:'600'},
 choice:{gap:0,marginBottom:6},option:{paddingVertical:14},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginBottom:4,textAlign:'center'},
 ideaWrap:{marginTop:2,marginBottom:12,gap:6},idea:{minHeight:92,fontFamily:fonts.ui,fontSize:15,lineHeight:22,color:colors.parchment,backgroundColor:tint('rgba(8,5,9,.75)'),borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),borderRadius:5,padding:12,textAlignVertical:'top'},ideaNote:{fontFamily:fonts.ui,color:colors.faint,fontSize:12,lineHeight:18},
  easy:{marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:tint('rgba(176,140,245,.22)')},
  narrator:{padding:14,borderRadius:6,borderWidth:1,borderColor:tint('rgba(176,140,245,.3)'),marginBottom:14},
  first:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:13.5,lineHeight:21,marginBottom:12,paddingVertical:10,paddingHorizontal:14,borderRadius:6,borderWidth:1,borderColor:tint('rgba(176,140,245,.4)'),backgroundColor:tint('rgba(48,26,78,.28)')},firstStrong:{color:colors.goldBright,fontWeight:'600'},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:12}});
