import React,{useState,useEffect} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import allIntros from './adventureIntros.json';
import {GameButton,Ornament,ScreenTitle,Crest,Toggle,Segmented} from './ui';
import Icon from './Icon';
import {playSound} from './audio';
import {fonts,colors,type,tint} from './theme';
import {NarratorChoice,LengthChoice} from './StoryControls';
import {storyPreferences,setStoryPreferences,subscribeStoryPreferences} from './storyPreferences';
import DynamicArt from './DynamicArt';
import {shelfTierWords,shelfDifficulties,shelfTab,shelfTiersShown,shelfTabFor,shelfStatus,shelfFresh,shelfLived,writtenChoice} from './shelfRules';
const icons={hostile:'swords',surprise:'compass',idea:'quill',easy:'flag',crown:'crown',drowned:'wave',sunforge:'flame',winter:'frost',deep:'door',names:'eye',oath:'shield'};
// With a story behind them, a hero can carry on in the same region (the next chapter) or set out somewhere new.
function Continuation({continuation,continuing,onContinuing,busy}){
 // With written tales on the shelf, Somewhere new is where they are (the shelf shows once it is chosen).
 return <View style={s.choice}>{[[true,'map','Continue in this region','The next tale begins a few miles from '+continuation.place+'. Everyone you met, the places you found, every grudge and debt, your companions and your pack come with you, and the country you know keeps its own map.'],[false,'compass',continuation.shelf?'Somewhere new: a written tale or a new one':'Somewhere new','Leave '+continuation.place+' behind'+(continuation.shelf?' for a written tale, ready at once, or a new one':'')+'. Your companions and your pack come with you; the rest of the world is new.']].map(([value,icon,title,copy])=>{const chosen=continuing===value;return <Pressable key={title} accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onContinuing(value);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:'gold'}} style={[s.card,s.option,chosen&&s.selected]}>
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
// ---------- Written tales ----------
// The shelf of tales written by hand (written-shelf.cjs, shelfRules.js): first on the screen, grouped Short, Medium and
// Long in tabs (a tab only when it has tales; its count hidden under 360 px), each a card that sells the premise: its
// cover (free: the place library), length, mood, difficulty, title, land and hook; chosen, it opens in place to the
// blurb, what sets it apart, content notes, chapters and endings, who it suits, this device's history with it and
// Begin. Two columns from 680 px of width, one on phones; nothing scrolls sideways. A tale the hero has lived cannot be
// begun again by them (the card says so; Begin is disabled, never an error).
export const lengthBadge=card=>{const tier=shelfTierWords[card?.length]??shelfTierWords.short,m=card?.minutes;if(!m)return tier.badge;
 if(card.length==='short')return tier.badge+' · ABOUT '+Math.round((m[0]+m[1])/20)*10+' MIN';
 const lo=Math.round(m[0]/60),hi=Math.round(m[1]/60);return tier.badge+' · '+(card.length==='long'&&hi>=10?lo+' HOURS OR MORE':lo===hi?'ABOUT '+lo+' HOURS':lo+'–'+hi+' HOURS');};
const beginWords=card=>{const m=card?.minutes;if(!m)return 'Begin this tale';if(card.length==='short')return 'Begin · about '+Math.round((m[0]+m[1])/20)*10+' minutes';const lo=Math.round(m[0]/60),hi=Math.round(m[1]/60);return 'Begin · '+(lo===hi?'about '+lo+' hours':lo+' to '+hi+' hours');};
function Pips({level}){const d=shelfDifficulties[level]??shelfDifficulties.steady;return <View accessibilityLabel={'Difficulty: '+d.word} style={s.pips}>{[1,2,3].map(i=><View key={i} style={[s.pip,i<=d.pips&&s.pipOn]}/>)}<Text style={s.tagText}>{d.word.toUpperCase()}</Text></View>;}
function TaleCard({card:c,chosen,busy,onSelect,onStart,error,record,lived,heroName,narrow,wide,current=null}){
 const status=shelfStatus(c,record,current),fresh=shelfFresh(c),startHere=c.firstTale&&status.kind!=='finished';
 const head=<>
  {c.cover?<DynamicArt subject={c.cover} quiet style={[s.cover,{height:narrow?(chosen?80:96):wide?(chosen?150:120):(chosen?136:110)}]} dataSet={{qb:'tale-cover'}}/>:<View style={[s.cover,s.coverBlank]}><Icon name={terrainIcons[c.terrain]??'compass'} size={22} color={colors.goldDeep}/>{!!c.terrain&&<Text style={s.coverWord}>{c.terrain.toUpperCase()}</Text>}</View>}
  <View style={s.top}><View style={{flex:1,minWidth:0}}>
   <View style={s.tags}><Text style={s.badge}>{lengthBadge(c)}</Text>{!!c.mood&&<Text style={s.tone}>{c.mood.toUpperCase()}</Text>}<Pips level={c.difficulty}/>{startHere&&<JourneyTag icon="flag" text="START HERE"/>}{fresh&&status.kind==='new'&&<JourneyTag icon="star" text="NEW"/>}</View>
   <Text style={[s.title,narrow&&{fontSize:19}]}>{c.title}</Text>
   {!!(c.region||c.terrain)&&<View style={s.land}><Icon name={terrainIcons[c.terrain]??'map'} size={12} color={colors.goldMid}/><Text style={s.landText}>{[c.region,c.terrain].filter(Boolean).join(' · ')}</Text></View>}
  </View>{chosen&&<View style={s.check}><Icon name="check" size={16} color={tint('#fff4f5')} strokeWidth={2.4}/></View>}</View>
  <Text style={[s.setting,narrow&&{fontSize:15.5,lineHeight:22},!chosen&&{marginBottom:2}]}>{c.hook}</Text>
 </>;
 // Collapsed, the card is one tap target; chosen, it opens in place, with Begin (on a phone, and for the Start here tale at
 // every width, right under the hook, so the first tale's Begin is in view without scrolling; elsewhere after the details).
 if(!chosen)return <Pressable accessibilityRole="radio" accessibilityState={{checked:false,disabled:busy}} accessibilityLabel={c.title+'. '+c.hook} disabled={busy} onPress={()=>{playSound('select');onSelect(writtenChoice(c.id));}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:'false',tone:'gold',written:c.slug}} style={[s.card,s.journey]}>
  {head}{status.kind!=='new'&&<Text style={s.status}>{status.text}</Text>}
 </Pressable>;
 const begin=<View style={[s.begin,s.beginIn]}>
  {!!lived&&<Text style={s.lived}>{lived==='playing'?(heroName?heroName+' is':'Your hero is')+' in the middle of this tale. Continue it from the title screen, or play it with another hero.':(heroName?heroName+' has':'Your hero has')+' lived this tale. Play it with another hero.'}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  <GameButton variant="primary" icon={busy?'quill':'play'} label={busy?'One moment…':beginWords(c)} disabled={busy||!!lived} onPress={onStart} style={{marginTop:0}}/>
 </View>;
 return <View accessibilityRole="radio" accessibilityState={{checked:true}} accessibilityLabel={c.title+'. '+c.hook} dataSet={{qb:'card',selected:'true',tone:'gold',written:c.slug}} style={[s.card,s.journey,s.selected]}>
  {head}
  {(narrow||startHere)&&begin}
  {!!c.blurb&&<Text style={s.copy}>{c.blurb}</Text>}
  {!!c.special&&<View style={s.special}><Icon name="star" size={13} color={colors.goldBright}/><Text style={s.specialText}>{c.special}</Text></View>}
  <View style={s.meta}>
   <Text style={s.metaText}>{c.chapters+(c.chapters===1?' chapter':' chapters')+' · '+c.endings+(c.endings===1?' ending':' endings')+' · '+(c.party==='together'?'Best with 2–4 heroes':'Solo or up to four heroes')}</Text>
   {!!c.notes.length&&<Text style={s.metaText}>{'Content: '+c.notes.join(' · ')}</Text>}
   <Text style={[s.status,{marginTop:0}]}>{status.text}</Text>
  </View>
  {!narrow&&!startHere&&begin}
 </View>;
}
function TaleShelf({written,selected,onSelect,onStart,busy,error,narrow}){
 const {width:screenWidth}=useWindowDimensions(),[width,setWidth]=useState(0),two=width>=680,cell=two?Math.floor((width-12)/2):null;
 const cards=written.cards,records=written.records??{},tiers=shelfTiersShown(cards),tab=shelfTabFor(cards,written.tab),list=shelfTab(cards,tab,records);
 return <View style={[s.shelf,narrow&&{marginTop:0}]} dataSet={{qb:'written-shelf'}}>
  {!narrow&&<View style={s.shelfHead}><Icon name="scroll" size={14} color={colors.goldMid}/><Text style={s.shelfTitle}>Written tales</Text></View>}
  {tiers.length>1&&<Segmented options={tiers.map(t=>[t,shelfTierWords[t].tab+(screenWidth<360?'':' '+cards.filter(c=>c.length===t).length)])} value={tab} onChange={written.onTab} style={s.tabs}/>}
  {tiers.length<=1&&narrow&&<View style={s.shelfHead}><Icon name="scroll" size={14} color={colors.goldMid}/><Text style={s.shelfTitle}>Written tales</Text></View>}
  <Text style={s.shelfNote}>{shelfTierWords[tab].sub}</Text>
  <View onLayout={e=>setWidth(Math.floor(e.nativeEvent.layout.width))} dataSet={{qb:'tales'}} style={s.grid}>{list.map(c=><View key={c.id} style={[s.cell,cell?{width:cell}:{width:'100%'}]}>
   <TaleCard card={c} chosen={selected===writtenChoice(c.id)} busy={busy} onSelect={onSelect} onStart={onStart} error={error} record={records[c.id]} lived={shelfLived(c,{titles:written.titles??[],current:written.current,records})} heroName={written.heroName} narrow={narrow} wide={two} current={written.current}/>
  </View>)}</View>
 </View>;
}
// Let fate decide, with journeys ready: one of them, chosen by chance.
const fateCopy={setting:'One of the ready journeys, chosen for you by chance. You find out which when it begins.',conflict:'Its land, its people and its trouble stay a surprise until the first scene, and it starts at once.',journey:null,stakes:null,tone:'Any journey',arrival:'Ready at once'};
// Let fate decide, with written tales: one this device has not played, from the open tab, by chance.
const fateWrittenCopy={setting:'A written tale you haven’t played, chosen by chance from the tab that is open (from another tab once you have played them all). You find out which when it begins.',conflict:'It starts at once, with a clear first step.',journey:null,stakes:null,tone:'Any written tale',arrival:'Ready at once'};
const firstTime=()=>{try{return !globalThis.localStorage?.getItem('questbound.tips.v1');}catch{return false;}};
export default function AdventureIntros({selected,onSelect,onStart,busy,error,continuation=null,continuing=false,onContinuing,idea='',onIdea=()=>{},journeys=null,forTable=null,written=null}){
 const narrow=useWindowDimensions().width<420;
 // The host of a shared table chooses the table's tale here (campaigns.cjs tale): the same tales, without the Skirmish
 // (a table plays a tale) or a next tale in a region; every hero at the table begins it together.
 const intros=forTable?allIntros.filter(i=>!i.local):allIntros;
 // With journeys ready, the list is Your own tale, the journeys, Let fate decide (one of them) and the Skirmish; the
 // written openings and Easy to get into (every journey is one) are offered only when the library cannot be reached.
 const shelfOn=!continuing&&Array.isArray(written?.cards)&&written.cards.length>0,writtenChosen=String(selected).startsWith('written:');
 const library=Array.isArray(journeys)&&journeys.length>0,shown=library||shelfOn?intros.filter(i=>i.idea||i.id==='surprise'||i.local):intros;
 const ready=library&&(selected==='surprise'||String(selected).startsWith('journey:'));
 // The story writer's journeys sit folded under the written tales (opened by the player, or when one is chosen).
 const [moreOpen,setMoreOpen]=useState(false),moreShown=moreOpen||String(selected).startsWith('journey:');
 const firstTale=shelfOn&&!Object.keys(written.records??{}).length?written.cards.find(c=>c.firstTale)??null:null;
 if(continuation&&continuing)return <View><ScreenTitle eyebrow="Next tale" icon="map" title="Where does your story go next?" sub={'After '+continuation.title+'.'}/>
  <Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>
  <IdeaBox idea={idea} onIdea={onIdea} busy={busy} optional/>
  <View style={s.narrator}><NarratorChoice compact/><LengthChoice style={s.easy}/><EasyStart busy={busy}/></View>
  <View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':'play'} label={busy?'One moment…':'Begin the next tale'} disabled={busy} onPress={onStart} style={{marginTop:0}}/></View>
  <Ornament/><Text style={s.note}>Starting replaces your current adventure only after the new story has been created and saved.</Text></View>;
 return <View>{forTable?<ScreenTitle eyebrow="The shared table" icon="people" title="Choose the table’s tale" sub={shelfOn?'Every hero at the table begins it together, each with what they carry. Written tales start at once.':'Every hero at the table begins it together, each with what they carry. Pick a ready journey to start at once, or bring your own idea.'}/>:<ScreenTitle style={shelfOn&&narrow?{marginBottom:6}:null} eyebrow={shelfOn&&narrow?null:"New adventure"} icon="compass" title="Where does your story begin?" sub={shelfOn?(narrow?null:'Written tales start at once. Or bring your own idea.'):'Choose a tale, or bring your own idea. Each is yours alone: a long story told in chapters, with its own country, people, side errands and roads to other lands.'}/>}
  {!!forTable?.replacing&&<Text accessibilityRole="alert" style={s.first}>This replaces <Text style={s.firstStrong}>{forTable.replacing}</Text> for everyone at the table once the new tale begins.</Text>}
 {/* A first-time player (the in-game "How to play" card not yet dismissed) is told where to start. */}
  {!!firstTale&&!forTable&&!narrow&&<Text style={s.first}>New here? Start with <Text style={s.firstStrong}>{firstTale.title}</Text>: {lengthBadge(firstTale).split(' · ')[1]?.toLowerCase()??'a short tale'}, ready at once.</Text>}
  {!!continuation&&shelfOn&&<Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>}
  {shelfOn&&<TaleShelf written={written} selected={selected} onSelect={onSelect} onStart={onStart} busy={busy} error={error} narrow={narrow}/>}
  {!shelfOn&&!continuation&&!forTable&&firstTime()&&library&&<Text style={s.first}>First time here? Pick any <Text style={s.firstStrong}>ready journey</Text> below: each starts at once, with your orders in hand and a clear first errand. For a two-minute practice fight instead, choose <Text style={s.firstStrong}>Skirmish</Text> at the end of the list. Rather keep each turn short? Switch on <Text style={s.firstStrong}>Not so wordy</Text> just below.</Text>}
  {!shelfOn&&!continuation&&!forTable&&firstTime()&&!library&&<Text style={s.first}>First time here? Keep <Text style={s.firstStrong}>Easy start</Text> on and any tale begins with your orders in hand and a clear first errand; <Text style={s.firstStrong}>Easy to get into</Text> is ready the fastest. For a two-minute practice fight instead, choose <Text style={s.firstStrong}>Skirmish</Text> at the end of the list. Rather keep each turn short? Switch on <Text style={s.firstStrong}>Not so wordy</Text> just below.</Text>}
  {!!continuation&&!shelfOn&&<Continuation continuation={continuation} continuing={continuing} onContinuing={onContinuing} busy={busy}/>}
  <View style={s.narrator}><NarratorChoice compact/><LengthChoice style={s.easy}/>{selected!=='hostile'&&!writtenChosen&&!(shelfOn&&selected==='surprise')&&<EasyStart always={selected==='easy'||ready} journey={ready} busy={busy}/>}</View>
  {shelfOn&&<View style={s.shelfHead}><Icon name="quill" size={14} color={colors.goldMid}/><Text style={s.shelfTitle}>Or write a new one</Text></View>}
 {/* The Begin button sits right under the chosen opening, so a phone player never scrolls to find it. */}
 {shown.map(listed=>{const intro=shelfOn&&listed.id==='surprise'?{...listed,...fateWrittenCopy}:library&&listed.id==='surprise'?{...listed,...fateCopy}:listed,chosen=selected===intro.id,hot=!!intro.local,quick=(library||shelfOn)&&intro.id==='surprise';return <React.Fragment key={intro.id}><Pressable accessibilityRole="radio" accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>{if(!chosen)playSound('select');onSelect(intro.id);}} onHoverIn={()=>playSound('tick')} dataSet={{qb:'card',selected:String(chosen),tone:hot?'hot':'gold'}} style={[s.card,chosen&&s.selected,hot&&s.combat,chosen&&hot&&{borderColor:colors.bloodBright}]}>
 <View style={s.top}><Crest icon={icons[intro.id]??'star'} size={46} color={hot?tint('#ffb39e'):colors.goldBright}/><View style={{flex:1,minWidth:0}}>
  <View style={s.tags}><Text style={[s.tone,hot&&{color:tint('#ff9f86')}]}>{intro.tone.toUpperCase()}</Text>{intro.scale==='saga'&&!(shelfOn&&intro.id==='surprise')&&<View style={s.tag}><Icon name="scroll" size={10} color={colors.gold}/><Text style={s.tagText}>LONG TALE</Text></View>}{intro.errand&&<View style={s.tag}><Icon name="flag" size={10} color={colors.gold}/><Text style={s.tagText}>CLEAR START</Text></View>}{hot&&<View style={[s.tag,s.tagHot]}><Icon name="bolt" size={10} color={tint('#ffb39e')}/><Text style={[s.tagText,{color:tint('#ffb39e')}]}>INSTANT</Text></View>}{quick&&<JourneyTag icon="bolt" text="READY NOW"/>}</View>
  <Text style={[s.title,narrow&&{fontSize:19}]}>{intro.title}</Text></View>{chosen&&<View style={[s.check,hot&&{backgroundColor:colors.bloodBright,borderColor:tint('#ffd2c2')}]}><Icon name="check" size={16} color={tint('#fff4f5')} strokeWidth={2.4}/></View>}</View>
 <Text style={[s.setting,narrow&&{fontSize:16,lineHeight:23}]}>{intro.setting}</Text>
 {/* The chosen opening tells what is wrong, where the road leads and what is at stake. */}
 {chosen&&intro.idea&&<IdeaBox idea={idea} onIdea={onIdea} busy={busy}/>}
  {chosen&&<View style={s.facts}>{[[hot?'What it is':'The trouble',intro.conflict,'swords'],['The road',intro.journey,'travel'],['At stake',intro.stakes,'heart']].filter(f=>f[1]).map(([label,copy,icon])=><View key={label} style={s.fact}><View style={s.factHead}><Icon name={icon} size={12} color={colors.goldMid}/><Text style={s.label}>{label}</Text></View><Text style={s.copy}>{copy}</Text></View>)}</View>}
 <Text style={s.arrival}>— {intro.arrival}</Text></Pressable>
 {chosen&&<View style={s.begin}>{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}<GameButton variant="primary" icon={busy?'quill':hot?'swords':'play'} label={busy?(hot?'Drawing steel…':'One moment…'):intro.idea&&!ideaReady(idea)?'Write your idea first':'Begin '+(hot?'the encounter':'this adventure')} disabled={busy||(!!intro.idea&&!ideaReady(idea))} onPress={onStart} style={{marginTop:0}}/></View>}
 {intro.idea&&library&&!shelfOn&&<JourneyShelf journeys={journeys} selected={selected} onSelect={onSelect} onStart={onStart} busy={busy} error={error} narrow={narrow}/>}</React.Fragment>;})}
 {shelfOn&&library&&<View style={s.more}>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:moreShown}} onPress={()=>{playSound('page');setMoreOpen(!moreShown);}} dataSet={{qb:'more-journeys'}} style={s.moreHead}><Icon name="compass" size={14} color={colors.goldMid}/><Text style={[s.shelfTitle,{flex:1}]}>More journeys from the story writer</Text><Text style={s.shelfCount}>{journeys.length}</Text><Text style={s.moreWord}>{moreShown?'Hide':'Show'}</Text></Pressable>
  {moreShown&&<JourneyShelf journeys={journeys} selected={selected} onSelect={onSelect} onStart={onStart} busy={busy} error={error} narrow={narrow}/>}
 </View>}
 <Ornament/>
 <Text style={s.note}>{forTable?'The table’s tale begins for everyone once it is ready.':'Starting replaces your current adventure only after the new story has been created and saved.'}</Text></View>;
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
 journey:{padding:14,marginBottom:12},
 badge:{fontFamily:fonts.ui,fontSize:10,fontWeight:'800',letterSpacing:1.4,color:colors.goldBright},
 pips:{flexDirection:'row',alignItems:'center',gap:3},pip:{width:7,height:7,borderRadius:4,borderWidth:1,borderColor:colors.gold},pipOn:{backgroundColor:colors.gold},
 tabs:{marginBottom:6},
 status:{fontFamily:fonts.ui,fontSize:12.5,fontWeight:'700',color:colors.goldMid,marginTop:4},
 meta:{gap:4,paddingTop:10,marginTop:10,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.18)')},metaText:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:18,color:colors.muted},
 beginIn:{marginTop:4,marginBottom:12},
 lived:{fontFamily:fonts.ui,fontSize:13,lineHeight:19,color:tint('#ffd49a'),marginBottom:8},
 moreWord:{fontFamily:fonts.ui,fontSize:12,fontWeight:'700',color:colors.goldMid},more:{marginTop:6,marginBottom:10},moreHead:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40,paddingVertical:6,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.18)')},cover:{height:136,borderRadius:4,marginBottom:12},coverBlank:{height:44,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:tint('rgba(178,34,58,.18)'),backgroundColor:tint('rgba(8,5,9,.35)')},coverWord:{fontFamily:fonts.ui,fontSize:10,fontWeight:'700',letterSpacing:2,color:colors.goldDeep},
 land:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4},landText:{fontFamily:fonts.ui,fontSize:12.5,color:colors.muted,flexShrink:1},
 special:{flexDirection:'row',gap:8,alignItems:'flex-start',paddingTop:10,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.18)')},specialText:{fontFamily:fonts.ui,color:tint('#e7d9c9'),fontSize:13.5,lineHeight:20,flex:1,fontWeight:'600'},
 choice:{gap:0,marginBottom:6},option:{paddingVertical:14},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginBottom:4,textAlign:'center'},
 ideaWrap:{marginTop:2,marginBottom:12,gap:6},idea:{minHeight:92,fontFamily:fonts.ui,fontSize:15,lineHeight:22,color:colors.parchment,backgroundColor:tint('rgba(8,5,9,.75)'),borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),borderRadius:5,padding:12,textAlignVertical:'top'},ideaNote:{fontFamily:fonts.ui,color:colors.faint,fontSize:12,lineHeight:18},
  easy:{marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:tint('rgba(176,140,245,.22)')},
  narrator:{padding:14,borderRadius:6,borderWidth:1,borderColor:tint('rgba(176,140,245,.3)'),marginBottom:14},
  first:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:13.5,lineHeight:21,marginBottom:12,paddingVertical:10,paddingHorizontal:14,borderRadius:6,borderWidth:1,borderColor:tint('rgba(176,140,245,.4)'),backgroundColor:tint('rgba(48,26,78,.28)')},firstStrong:{color:colors.goldBright,fontWeight:'600'},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:12}});
