import {useSceneTransition} from './SceneTransition';
import {sceneArtSubjects} from './worldArtRules';
import {EntityText as Text,useEncounter} from './EncounterOverlay';
import {storyText,questState} from './storyRules';
import {cue} from './cinematics';
import {quickActions} from './quickActions';
import {recordedTurn} from './playbackRules';
import {withSceneTrigger} from './sceneTriggers';
import {dungeonRooms,dungeonState} from './dungeonRules';
import React,{useState,useEffect,useRef} from 'react';
import {View,Text as PlainText,Pressable,ScrollView,StyleSheet,useWindowDimensions} from 'react-native';
import Icon from './Icon';
import DynamicArt from './DynamicArt';
import {creatureArtSubject,npcArtSubject} from './worldArtRules';
import {npcScene,npcLore} from './npcRules';
import {livingAllies,allyStats} from './encounterRules';
import {attitudeLabel,speciesRegard,regardLabel} from './relationshipRules';
import Inventory from './Inventory';
import {withStoryLog} from './storyLog';
import {withDeeds,deedById,deedList} from './deedRules';
import {speakTurn,stopNarrator} from './narrator';
import ShareTale from './ShareTale';
import {damageIcon,damageKind} from './chronicleRules';
import {useShownHp} from './cinematics';
import {playSound} from './audio';
import DungeonMaster from './DungeonMaster';
import AdventureMap from './AdventureMap';
import {commitDmTurn} from './dmContext';
import {campaignState,earnedGold} from './campaignRules';
import {mapState,mapLocation,placeDescription,placeName} from './mapRules';
import {spellDefense} from './spellRules';
import {combatBasics} from './combatRules';
import {encounterFoe,adventureStep,foeStanding} from './adventureRules';
import {Ornament,StatBar,useCountTo,HpFloaters,useHitReaction} from './ui';
import {rememberTurn} from './turnMemory';
import {useVisualViewport} from './webLayout';
import {fonts,colors,type,tint} from './theme';
// The side column's tabs on wide screens (phones have the same four beside Story in the bottom bar).
const sideTabs=[['quest','scroll','Quest'],['map','map','Map'],['pack','bag','Inventory'],['log','journal','Log']];
// The story log's marks: an icon and a tone for each kind of line.
const taleIcon={travel:'travel',place:'map',person:'people',fight:'swords',victory:'star',flight:'retreat',fall:'heart',death:'skull',deed:'speak',loot:'coin',rest:'rest',level:'starFill',quest:'scroll'};
const taleTone={fight:'#f06a4f',fall:'#f06a4f',death:'#f06a4f',flight:'#e0a860',victory:tint('#cba6ff'),level:tint('#cba6ff'),rest:'#6fbf8e',quest:tint('#cba6ff')};
export default function Adventure({hero,game,setGame,health,setHealth,table,layout,levelUp=false,onLevelUp,onNewHero,onTyping}){
 const transition=useSceneTransition();
 const [tab,setTab]=useState('story');
 // While the player types on a phone, everything but the story and the message box steps aside.
 const [typing,setTypingState]=useState(false),setTyping=value=>{setTypingState(value);onTyping?.(value);},visibleHeight=useVisualViewport().height;
 const {width:windowWidth,height:windowHeight}=useWindowDimensions();
 // New turns (yours, the table's or a scene moment) bring a phone player back to the story.
 const lastTurn=game.playback?.at(-1)?.id??0;
 useEffect(()=>{setTab('story');},[lastTurn,game.sceneCue?.id]);
 const stats=combatBasics(hero),foe=encounterFoe(hero,game),map=mapState(game),campaign=campaignState(game),quest=questState(game);
 const [inConversation,setInConversation]=useState(false);
 const [sideTab,setSideTab]=useState('quest');
 // The share sheet (the tale card), and a narrator silenced when the play screen is left.
 const [sharing,setSharing]=useState(false);
 useEffect(()=>()=>stopNarrator(),[]);
 const [error,setError]=useState(''),[showLog,setShowLog]=useState(false),sendRef=useRef(null),encounter=useEncounter(),shown=useShownHp(),foeCount=useCountTo(shown.foe??game.enemyHP),foeHit=useHitReaction(shown.foe??game.enemyHP);
 // A turn is applied to the adventure as it stands, or (options.from) to the state before the last turn when the
 // Dungeon Master takes that turn back. The state before each of the player's own turns is remembered for that.
 const act=async(action,conversation,random=Math.random,options)=>{try{stopNarrator();}catch{}const from=options?.from??{game,health},tablePoint=table?.joined?table.checkpoint():null;if(conversation&&table?.joined)conversation={...conversation,actorName:table.name||'Adventurer'};let result=conversation?commitDmTurn(hero,from.game,from.health,action,conversation,random):adventureStep(from.game,from.health,hero,action,random);if(result.error){setError(storyText(game,result.error));return result;}if(conversation)result=recordedTurn(hero,from.game,from.health,result,result.conversation??conversation,conversation.npcId??null);result={...result,game:{...result.game}};delete result.game.sceneCue;if(!conversation?.trigger&&!conversation?.direct)result.game=withSceneTrigger(from.game,result.game,action);result.game=withStoryLog(from.game,result.game,hero,{action});const marked=withDeeds(result.game,hero);result.game=marked.game;if(result.game.sceneCue&&table?.joined)result.game={...result.game,sceneCue:{...result.game.sceneCue,origin:table.deviceId}};await transition.prepare(sceneArtSubjects(result.game));if(tablePoint&&!table.isCurrent(tablePoint)){const error='The table changed while this scene was preparing. Your action was not applied; try again from the latest turn.';setError(error);return {game,health,error};}if(conversation&&!conversation.trigger&&!conversation.direct)rememberTurn(from.game,from.health);setGame(result.game);setHealth(result.health);setError('');
  // Deeds earned this turn are announced one after another, and the narrator reads the turn aloud when asked to.
  marked.fresh.forEach((id,i)=>setTimeout(()=>cue('deed',{deed:deedById(id)}),1400+i*4400));
  if(conversation&&!conversation.direct&&result.turn)try{speakTurn(result.turn);}catch{}
  // A new chapter of a long tale is announced across the screen.
  const opened=result.game.story?.chapters&&(result.game.story.chapter??0)>(from.game.story?.chapter??0)?result.game.story.chapters[result.game.story.chapter]:null;
  if(opened)setTimeout(()=>cue('area',{over:'Chapter '+(result.game.story.chapter+1),title:opened.title}),500);
  return result;};
 // A lead ticked (or reopened) by hand: the same record the Dungeon Master keeps, with its line in the story so far.
 const markLead=id=>{if(!game.story?.leads||table?.joined&&!table.synchronized)return;const next={...game,story:{...game.story,leads:game.story.leads.map(l=>l.id!==id?l:l.done?{id:l.id,title:l.title,hook:l.hook}:{...l,done:true})}};setGame(withDeeds(withStoryLog(game,next,hero,{}),hero).game);};
 if(!stats.available||stats.ac===null)return <Text style={s.text}>Complete your abilities and equipment through Character Selection before playing.</Text>;
 const scenes={inn:game.enemyHP===0?'The inn is warm. Beyond the window, the restored bridge lantern shines. The keeper welcomes you back.':map.accepted?'The keeper tends the hearth. Mara, a traveling medicine courier, sits nearby. The bridge still needs its light.':'Rain drives you into the crossroads inn. A keeper raises a flickering blue lantern. “The bridge light is missing. Will you bring it back?” A healing draught waits on the table.',tower:map.clue?'Beneath the watchtower bell, you recognize the signal: low, high, low.':'Ivy threads through a cracked bell tower. Three marks are carved beneath its bell.',bridge:game.enemyHP===0?'Warm light falls across the restored bridge. Travelers cross safely.':'A restless wisp circles the broken bridge lamp.',combat:'The Lantern Wisp hovers within melee reach. Tell the DM what you do.',victory:'The lantern shines again. You can claim the keeper’s reward and ask about further work.',defeat:'The keeper has pulled you to safety. Tell the DM when you want to begin another adventure.',escaped:'You escaped the wisp. Tell the DM when you want to begin another adventure.'};
 const standing=foeStanding(foe,game.enemyHP),sideWidth=layout==='wide'?Math.round(Math.min(370,Math.max(220,windowWidth*.36))):windowWidth;
 // One-tap actions for this moment; the map's Travel buttons send through the same Dungeon Master turn.
 const quick=[...(levelUp&&onLevelUp?[{key:'level-up',glyph:'✦',icon:'star',label:'Level up',primary:true,run:onLevelUp}]:[]),...quickActions(hero,game,health)];
 // Whose move it is: the player's action, or (once it is spent) a bonus action or the end of the turn.
 const turnLabel=game.actionUsed?'Bonus action or end turn':'Your turn';
 const travel=id=>{const trip=quick.find(a=>a.destination===id);if(!trip)return;setTab('story');sendRef.current?.(trip);};
 const travelTo=quick.filter(a=>a.destination).map(a=>a.destination);
 // Pieces of the play area, arranged below for wide screens (side column) or phones (tabs).
 const foeName=game.wildFight?foe.name:game.story?.foe??foe.name,foeHp=shown.foe??game.enemyHP,creature=creatureArtSubject(game),hitDice=foe.count+'d'+foe.die+(foe.bonus?'+'+foe.bonus:'');
 const combatStrip=game.stage==='combat'&&<Pressable accessibilityRole="button" accessibilityLabel="Show everyone's combat HP" disabled={!encounter?.roster.length} onPress={()=>encounter?.open('combat')} dataSet={{qb:'plate-hot'}} style={s.strip}>
  {!!creature&&<View dataSet={{hit:foeHit}}><DynamicArt dataSet={{qb:'portrait-hot'}} subject={creature} style={s.stripAvatar} compact/></View>}
  <View style={{flex:1,minWidth:0,gap:5}}>
   <View style={s.stripTop}><PlainText numberOfLines={1} style={s.stripName}>{foe.group?standing+'× ':''}{foeName}</PlainText><View><PlainText style={s.stripStat}>{foeCount}/{foe.maximum}</PlainText><HpFloaters value={foeHp}/></View><View style={s.acBadge}><Icon name="shield" size={11} color="#ffc9b8"/><PlainText style={s.acText}>{foe.ac}</PlainText></View></View>
   <StatBar value={foeHp} maximum={foe.maximum} kind="enemy" height={7}/>
   {livingAllies(game).map(a=><PlainText key={'ally'+a.index} numberOfLines={1} style={s.stripAlly}>+ {a.name} · {a.hp}/{a.maximum} HP</PlainText>)}
  </View>
  <View style={s.roundBadge}><PlainText style={s.roundBadgeLabel}>{game.actionUsed?'Bonus':'Rnd'}</PlainText><PlainText style={s.roundBadgeText}>{game.round}</PlainText></View>
 </Pressable>;
 const statChip=(icon,text)=><View key={text} style={s.statChip}><Icon name={icon} size={12} color="#ffc9b8"/><PlainText style={s.statChipText}>{text}</PlainText></View>;
 const combatPlate=game.stage==='combat'&&<View dataSet={{qb:'plate-hot'}} style={[s.combat,{marginTop:0}]}>
  <View dataSet={{qb:'banner'}} style={s.banner}><Icon name="swords" size={13} color="#ffd9c9"/><PlainText numberOfLines={1} style={[s.bannerText,game.actionUsed&&{letterSpacing:1.6}]}>Round {game.round} · {turnLabel}</PlainText><Icon name="swords" size={13} color="#ffd9c9"/></View>
  <Pressable accessibilityRole="button" accessibilityLabel={'Show everyone\'s combat HP'} disabled={!encounter?.roster.length} onPress={()=>encounter?.open('combat')} style={[s.foeArt,{height:Math.round(Math.min(200,sideWidth*.62,Math.max(110,windowHeight*.3)))}]}>
   {!!creature&&<View dataSet={{hit:foeHit}} style={StyleSheet.absoluteFill}><DynamicArt subject={creature} style={StyleSheet.absoluteFill} compact/></View>}
   <View dataSet={{qb:'foe-shade'}} style={[StyleSheet.absoluteFill,{pointerEvents:'none'}]}/>
   <View style={s.foeCaption}><PlainText style={s.foeOver}>Opponent{foe.group?' · '+standing+' of '+foe.group.size+' standing':''}</PlainText><PlainText numberOfLines={2} style={[s.foeName,sideWidth<300&&{fontSize:20}]}>{foeName}</PlainText></View>
  </Pressable>
  {foe.group&&<Text style={s.group}>{'◆ '.repeat(standing)}{'◇ '.repeat(foe.group.size-standing)} {foe.group.plural}</Text>}
  <View style={s.foeRow}><Icon name="heart" size={13} color={colors.bloodBright}/><View><PlainText style={s.foeStat}>{foeCount}<PlainText style={s.foeMax}> / {foe.maximum} HP</PlainText></PlainText><HpFloaters value={foeHp}/></View></View>
  <StatBar value={foeHp} maximum={foe.maximum} kind="enemy" height={12}/>
  <View style={s.statChips}>{statChip('shield','AC '+foe.ac)}{statChip('swords','+'+foe.attackBonus+' to hit')}{statChip(damageIcon(damageKind(foe.type)),hitDice+' '+foe.type.toLowerCase())}</View>
  {/* A second creature fighting beside the foe. */}
  {livingAllies(game).map(a=>{const st=allyStats(game,a.index,hero.level??1);return <View key={'ally'+a.index} style={s.allyRow}><Icon name="swords" size={13} color="#ffb39e"/><View style={{flex:1,minWidth:0,gap:5}}><View style={s.allyTop}><PlainText numberOfLines={1} style={s.allyName}>{a.name}</PlainText><PlainText style={s.allyStat}>{a.hp} / {a.maximum} HP · AC {st.ac}</PlainText></View><StatBar value={a.hp} maximum={a.maximum} kind="enemy" height={7}/></View></View>;})}
  <View style={s.yourAc}><Icon name="shield" size={13} color={colors.gold}/><PlainText style={s.yourAcText}>Your armor class {spellDefense(game,stats.ac).ac}</PlainText></View>
 </View>;
 // Dying: three successes to live, three failures to die, rolled one turn at a time.
 const pips=(count,kind)=>[0,1,2].map(i=><View key={kind+i} dataSet={{qb:i<count?'pip-'+kind:undefined}} style={[s.pip,i<count&&(kind==='good'?s.pipGood:s.pipBad)]}/>);
 const dyingPanel=game.stage==='dying'&&game.dying&&<View dataSet={{qb:'plate-hot'}} accessibilityLiveRegion="polite" accessibilityLabel={'Dying. '+game.dying.successes+' successes, '+game.dying.failures+' failures.'} style={[s.dying,layout!=='wide'&&s.dyingStrip]}>
  <View style={s.labelRow}><Icon name="skull" size={14} color="#ffb39e"/><PlainText style={[s.label,{color:'#ffb39e'}]}>Dying</PlainText></View>
  {layout==='wide'&&<Text style={s.dyingText}>You lie unconscious{game.dying.placeName?' at '+game.dying.placeName:''}. Roll to hold on: three successes and you live, three failures and you die.</Text>}
  <View style={s.pipRows}><View style={s.pipRow}><Icon name="check" size={13} color={colors.heal}/>{pips(game.dying.successes,'good')}</View><View style={s.pipRow}><Icon name="close" size={13} color={colors.bloodBright}/>{pips(game.dying.failures,'bad')}</View></View>
 </View>;
 // Dead: the hero's epitaph, and the way to begin again with someone new.
 const deathPanel=game.stage==='dead'&&game.death&&<View dataSet={{qb:'plate'}} style={[s.epitaph,layout!=='wide'&&s.epitaphStrip]}>
  <Icon name="skull" size={layout==='wide'?24:18} color={colors.muted}/>
  <View style={{alignItems:'center',flexShrink:1}}>
   <PlainText style={s.epitaphOver}>Here lies</PlainText>
   <PlainText numberOfLines={1} style={[s.epitaphName,layout!=='wide'&&{fontSize:19}]}>{hero.name}</PlainText>
   <PlainText style={s.epitaphLine}>Level {hero.level} {hero.species??hero.race} {hero.class}</PlainText>
   <PlainText style={s.epitaphCause}>{game.death.cause}{game.death.place?' at '+game.death.place:''}.</PlainText>
  </View>
  {!!onNewHero&&<Pressable accessibilityRole="button" onPress={onNewHero} dataSet={{qb:'btn-primary'}} style={s.epitaphButton}><Icon name="quill" size={15} color={tint('#ffeef0')}/><PlainText style={s.epitaphButtonText}>Begin a new hero</PlainText></Pressable>}
 </View>;
 // The people of this story and how they feel about you: a grudge or a debt, else the last thing they remember.
 const toneColor={bad:colors.bloodBright,warn:'#e0a860',good:colors.heal,best:colors.goldBright,calm:colors.muted,dead:colors.faint};
 const voiced=t=>String(t).replace(/^The player\b/,'You').replace(/\bthe player\b/g,'you');
 const peoplePanel=<View dataSet={{qb:'plate'}} style={s.people}>
  <View style={s.labelRow}><Icon name="people" size={14} color={colors.goldMid}/><PlainText style={s.label}>People</PlainText></View>
  {[...npcScene(game)].sort((a,b)=>Number(b.present)-Number(a.present)).map(n=>{const standing=attitudeLabel(n),tone=toneColor[standing.tone],view=n.fate==='dead'||n.grudge||n.bond?null:speciesRegard(game,n.id,hero),sour=['hostile','unfriendly'].includes(n.attitude),warm=['friendly','devoted'].includes(n.attitude),kind=!view||(sour&&['kin','warm','curious'].includes(view.stance))||(warm&&['wary','scornful'].includes(view.stance))?null:regardLabel(view),said=n.grudge??n.bond??[...n.memories].reverse().find(m=>!/\((?:weapon-attack|harmful-spell)\)/.test(m)),name=game.story?.npcs?.[n.id]?.name??n.name;
   // Where they are now: beside you, or wherever they live (or were left waiting).
   const follow=game.followers?.[n.id],where=n.fate==='dead'?null:follow?.status==='following'?'With you':n.present?'Here':game.story?'At '+placeName(game,follow?follow.location:game.people?.[n.id]?.home??'inn'):null;
   return <View key={n.id} style={s.personRow}>
    <DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={[s.personAvatar,n.fate==='dead'&&{opacity:.4}]} compact/>
    <View style={{flex:1,minWidth:0}}>
     <PlainText numberOfLines={1} style={s.personName}>{name}</PlainText>
     <View style={s.standing}><View style={[s.standingDot,{backgroundColor:tone}]}/><PlainText style={[s.standingText,{color:tone}]}>{standing.label}</PlainText>{!!where&&<PlainText numberOfLines={1} style={s.where}>· {where}</PlainText>}</View>
     {!!kind&&<PlainText numberOfLines={1} style={s.regard}>{kind}</PlainText>}
     {!!said&&n.fate!=='dead'&&<PlainText numberOfLines={3} style={s.memory}>“{voiced(said)}”</PlainText>}
    </View>
   </View>;})}
 </View>;
 // Deeds: lasting marks of what the hero has done (deedRules.js), with the next one to earn, and the way to share the tale.
 const deeds=game.deeds??[],nextDeed=deedList.find(d=>!deeds.some(x=>x.id===d.id));
 const deedsPanel=<View dataSet={{qb:'plate'}} style={s.people}>
  <View style={s.labelRow}><Icon name="crown" size={14} color={colors.goldMid}/><PlainText style={s.label}>Deeds</PlainText><PlainText style={s.leadCount}>{deeds.length} of {deedList.length}</PlainText></View>
  {deeds.length?<View style={s.deedWrap}>{[...deeds].reverse().map(d=>{const deed=deedById(d.id);return deed?<View key={d.id} style={s.deedChip} accessibilityLabel={deed.title+': '+deed.line}><Icon name={deed.icon} size={13} color={colors.gold}/><PlainText style={s.deedChipText}>{deed.title}</PlainText></View>:null;})}</View>
   :<PlainText style={[s.caption,{marginVertical:0}]}>Nothing yet. Deeds mark what your hero has done and stay with them from tale to tale.</PlainText>}
  {!!nextDeed&&<PlainText style={s.leadNote}>Next: {nextDeed.title} · {nextDeed.line}</PlainText>}
  <Pressable accessibilityRole="button" accessibilityLabel="Share your tale" onPress={()=>{playSound('open');setSharing(true);}} dataSet={{qb:'btn'}} style={s.shareButton}><Icon name="send" size={14} color={colors.gold}/><PlainText style={s.shareText}>Share your tale</PlainText></Pressable>
 </View>;
 // What you wear, wield and carry; a carried weapon can be taken in hand from here.
 const inventoryPanel=<Inventory hero={hero} game={game} onWield={name=>setGame({...game,wield:name})}/>;
 const npcCombatPanel=game.npcCombat?.active&&<View dataSet={{qb:'plate-hot'}} style={s.combat}><View dataSet={{qb:'banner'}} style={s.banner}><Icon name="swords" size={13} color="#ffd9c9"/><PlainText style={s.bannerText}>Combat · Round {game.npcCombat.round}</PlainText><Icon name="swords" size={13} color="#ffd9c9"/></View><PlainText style={s.label}>Turn order</PlainText><View style={s.orderRow}>{game.npcCombat.order.map((n,i)=>{const name=n.id==='player'?'You':npcLore(game,n.id)?.name??n.id;return <React.Fragment key={n.id}>{i>0&&<Icon name="forward" size={12} color={colors.faint}/>}<View style={[s.orderChip,n.side==='enemy'&&{borderColor:'rgba(240,106,79,.6)'},n.id==='player'&&{borderColor:colors.gold}]}>{n.side!=='player'&&n.id!=='player'&&<Icon name={n.side==='enemy'?'swords':'shield'} size={11} color={n.side==='enemy'?'#ffb39e':colors.heal}/>}<Text style={s.orderText}>{name}</Text></View></React.Fragment>;})}</View><PlainText style={s.caption}>Describe an attack or spell, or send Dodge, Flee, Wait, or Surrender.</PlainText></View>;
 const questPanel=<>
  {npcCombatPanel}
  <View dataSet={{qb:'plate'}} style={s.quest}>
   <View style={s.labelRow}><Icon name={game.story?.status==='complete'?'star':'scroll'} size={14} color={colors.goldMid}/><PlainText style={s.label}>{game.story?(game.story.status==='complete'?'Adventure complete':'Current quest'):'A written adventure · Simplified rules'}</PlainText></View>
   <Text style={s.title}>{game.story?.title??'The Lantern at the Crossroads'}</Text>
   <Ornament style={{marginVertical:10}}/>
   {/* A long tale shows the chapter under way (its goal is what to do now) above the aim of the whole story. */}
   {!!quest?.current&&game.story.status!=='complete'&&<View style={s.chapter}>
    <View style={s.chapterTop}><PlainText style={s.chapterOver}>Chapter {quest.number} of {quest.chapters}</PlainText><View style={s.chapterPips} accessibilityLabel={(quest.number-1)+' of '+quest.chapters+' chapters finished'}>{Array.from({length:quest.chapters},(_,i)=><View key={i} style={[s.chapterPip,i<quest.number-1&&s.chapterPipDone,i===quest.number-1&&s.chapterPipNow]}/>)}</View></View>
    <PlainText style={s.chapterTitle}>{quest.current.title}</PlainText>
    <Text style={s.objective}>{quest.current.goal}</Text>
   </View>}
   {game.story&&(quest?.current&&game.story.status!=='complete'?<Text style={s.aim}><PlainText style={s.aimLabel}>The tale  </PlainText>{game.story.objective}</Text>:<Text style={s.objective}>{game.story.objective}</Text>)}
   <Text style={s.scene}>{game.npcCombat?.active?'Combat erupts. Nearby defenders take their turns.':game.stage==='dying'?'You lie unconscious, bleeding out.':game.stage==='dead'?'Your hero has died.':game.story?(game.stage==='combat'?'You face the '+(foe.group?.plural??(game.wildFight?foe.name:game.story.foe))+'.':game.stage==='wild'?placeDescription(game,mapLocation(game)):game.story.locations[game.stage]?.description??'The encounter has ended. Describe what you do next.'):game.dungeon?.active?dungeonRooms[game.dungeon.room].text:scenes[game.stage]}</Text>
  </View>
  {/* Leads: side errands heard of along the way, ticked off as they are seen through. */}
  {!!quest?.leads.length&&<View dataSet={{qb:'plate'}} style={s.people}>
   <View style={s.labelRow}><Icon name="search" size={14} color={colors.goldMid}/><PlainText style={s.label}>Leads</PlainText><PlainText style={s.leadCount}>{quest.leads.filter(l=>l.done).length} of {quest.leads.length}</PlainText></View>
   {/* The Dungeon Master ticks a lead when it is seen through; the player can tick (or untick) one too. */}
   {quest.leads.map(l=><View key={l.id} style={s.leadRow}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:!!l.done}} accessibilityLabel={(l.done?'Reopen the lead ':'Mark the lead as seen through: ')+l.title} hitSlop={10} onPress={()=>{playSound('click');markLead(l.id);}} style={[s.leadMark,l.done&&s.leadMarkDone]}>{l.done&&<Icon name="check" size={11} color={tint('#fff4f5')} strokeWidth={2.6}/>}</Pressable>
    <View style={{flex:1,minWidth:0}}><PlainText style={[s.leadTitle,l.done&&s.leadTitleDone]}>{l.title}</PlainText>{!l.done&&<Text style={s.leadHook}>{l.hook}</Text>}</View>
   </View>)}
   <PlainText style={s.leadNote}>Tap a circle to tick a lead off yourself.</PlainText>
  </View>}
  {game.dungeon?.active&&<View dataSet={{qb:'plate'}} style={s.log}><Text style={s.label}>Lantern Vaults · Room {game.dungeon.room+1} of 8</Text><Text style={s.heading}>{dungeonRooms[game.dungeon.room].name}</Text><Text style={s.caption}>Explored: {game.dungeon.visited.map(n=>dungeonRooms[n].name).join(' → ')}</Text><Text style={s.caption}>Passages: {dungeonRooms[game.dungeon.room].exits.map(n=>dungeonRooms[n].name).join(' · ')}</Text><Text style={s.caption}>Describe exploring a passage, searching, disarming a trap, confronting a guardian, or leaving. Each passage takes one exploration minute. The sanctuary seal may block deeper travel.</Text></View>}
  {peoplePanel}
  {deedsPanel}
  {['active','found'].includes(campaign.lensQuest)&&<Text style={s.scene}>{campaign.lensQuest==='found'?'The signal lens is in your inventory. Return it to the keeper.':'The keeper needs the signal lens from beneath the watchtower bell.'}</Text>}
  {!!game.pendingSpell&&<Text style={[s.caption,{color:colors.arcane}]}>✧ Spell awaiting a DM ruling. Ask the AI to resolve the spell or provide the detail it requested. Send “Cancel spell” to cancel.</Text>}
 </>;
 const tale=game.storyLog??[];
 const logPanel=<View dataSet={{qb:'plate'}} style={s.log}>
  <View style={s.labelRow}><Icon name="journal" size={14} color={colors.goldMid}/><PlainText style={s.label}>The story so far</PlainText><Pressable accessibilityRole="button" accessibilityLabel="Share your tale" onPress={()=>{playSound('open');setSharing(true);}} dataSet={{qb:'chip'}} style={s.shareChip}><Icon name="send" size={12} color={colors.gold}/><PlainText style={s.shareChipText}>Share</PlainText></Pressable></View>
  {!tale.length&&<PlainText style={[s.caption,{marginBottom:0}]}>Nothing of note yet. Every place you reach, everyone you meet, each fight and what came of it will be written here, briefly, as it happens.</PlainText>}
  {[...tale].reverse().map(e=>e.kind==='story'
   ?<View key={e.id} style={s.taleChapter}><View dataSet={{qb:'rule-left'}} style={s.taleRule}/><Icon name="scroll" size={13} color={colors.gold}/><PlainText style={s.taleChapterText}>{e.text}</PlainText><View dataSet={{qb:'rule-right'}} style={s.taleRule}/></View>
   :<View key={e.id} style={s.taleRow}><View style={[s.taleMark,{borderColor:taleTone[e.kind]??tint('rgba(178,34,58,.4)')}]}><Icon name={taleIcon[e.kind]??'star'} size={13} color={taleTone[e.kind]??colors.gold}/></View><Text style={s.taleText}>{e.text}</Text></View>)}
  {!!game.log.length&&<Pressable accessibilityRole="button" accessibilityState={{expanded:showLog}} onPress={()=>setShowLog(value=>!value)} style={[s.logToggle,{marginTop:10,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.18)')}]}><PlainText style={s.logToggleText}>{showLog?'Hide the latest rolls':'Latest rolls and rulings'}</PlainText><Icon name={showLog?'close':'d20'} size={14} color={colors.gold}/></Pressable>}
  {showLog&&game.log.map((entry,index)=><Text key={index} style={s.entry}>{storyText(game,entry)}</Text>)}
 </View>;
 const master=<DungeonMaster fill quick={quick} sendRef={sendRef} hero={hero} game={game} health={health} act={act} table={table} onConversationChange={setInConversation} onTyping={setTyping}/>;
 // With the keyboard up there is little height left: the side column, strips and tabs give it to the story.
 const cramped=typing&&(visibleHeight||windowHeight)<560;
 const mapPanel=<AdventureMap game={game} travelTo={travelTo} onTravel={travel}/>;
 const share=<ShareTale visible={sharing} onClose={()=>setSharing(false)} hero={hero} game={game}/>;
 const toast=!!error&&<Pressable accessibilityRole="alert" accessibilityHint="Tap to dismiss" onPress={()=>setError('')} dataSet={{qb:'enter'}} style={s.toast}><Icon name="info" size={16} color="#ffb39e"/><Text style={s.toastText}>{error}</Text><Icon name="close" size={14} color="#ffd2c2"/></Pressable>;
 // Wide (side column) and narrow (tabs) share one element tree, so turning a phone never remounts the
 // Dungeon Master: a turn in progress, its playback and a half-typed message all survive the rotation.
 if(layout==='wide'||layout==='narrow'){const wide=layout==='wide',story=wide||tab==='story';return <View style={wide?s.wide:s.narrow}>
  {wide&&<View style={[s.side,{width:sideWidth},cramped&&{display:'none'}]}>
   <View accessibilityRole="tablist" dataSet={{qb:'seg'}} style={s.sideTabs}>{sideTabs.map(([id,icon,label])=>{const on=sideTab===id;return <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected:on}} onPress={()=>{if(!on)playSound('page');setSideTab(id);}} dataSet={{qb:on?'seg-on':undefined,tip:label}} style={[s.sideTabItem,on&&s.sideTabOn]}>{(sideWidth>=440||sideWidth<280)&&<Icon name={icon} size={16} color={on?colors.goldBright:colors.muted}/>}{sideWidth>=280&&<PlainText numberOfLines={1} style={[s.sideTabText,on&&{color:colors.goldBright}]}>{label}</PlainText>}</Pressable>;})}</View>
   <ScrollView style={{flex:1,minHeight:0}} contentContainerStyle={s.sideContent}>{deathPanel}{dyingPanel}{combatPlate}{sideTab==='quest'&&questPanel}{sideTab==='map'&&mapPanel}{sideTab==='pack'&&inventoryPanel}{sideTab==='log'&&logPanel}</ScrollView>
  </View>}
  {!wide&&tab==='story'&&!cramped&&combatStrip}
  {!wide&&tab==='story'&&!cramped&&dyingPanel}
  {!wide&&tab==='story'&&!cramped&&deathPanel}
  {!wide&&toast}
  {share}
  {/* The Dungeon Master stays mounted on every tab so a turn in progress is never interrupted. */}
  <View style={[s.main,!story&&{display:'none'}]}>{wide&&toast}{master}</View>
  {!story&&<ScrollView style={s.main} contentContainerStyle={s.tabContent}>{tab==='quest'&&<>{combatPlate}{questPanel}</>}{tab==='map'&&mapPanel}{tab==='pack'&&inventoryPanel}{tab==='log'&&logPanel}</ScrollView>}
  {!wide&&<View dataSet={{qb:'tabbar'}} style={[s.tabBar,typing&&{display:'none'}]} accessibilityRole="tablist">{[['story','quill','Story'],['quest','scroll','Quest'],['map','map','Map'],['pack','bag','Inventory'],['log','journal','Log']].map(([id,icon,label])=>{const on=tab===id,alert=id==='quest'&&game.stage==='combat'&&!on;return <Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:on}} onPress={()=>{if(!on)playSound('page');setTab(id);}} dataSet={{qb:on?'tab-on':undefined}} style={[s.tab,on&&s.tabOn]}><View><Icon name={icon} size={20} color={on?colors.goldBright:colors.muted}/>{alert&&<View style={s.tabAlert}/>}</View><PlainText numberOfLines={1} style={[s.tabLabel,on&&s.tabOnText]}>{label}</PlainText></Pressable>;})}</View>}
 </View>;}
 return <View>
 {game.stage==='combat'&&<View dataSet={{qb:'plate'}} style={[s.combat,{marginTop:4,marginBottom:4}]}>
  <View dataSet={{qb:'banner'}} style={s.banner}><Text style={s.bannerText}>⚔  Round {game.round}  ·  Your turn  ⚔</Text></View>
  <Text style={s.label}>{'Opponent'}</Text>
  <Text style={s.foeName}>{game.wildFight?foe.name:game.story?.foe??foe.name}</Text>
  {foe.group&&<Text style={s.group}>{'◆ '.repeat(foeStanding(foe,game.enemyHP))}{'◇ '.repeat(foe.group.size-foeStanding(foe,game.enemyHP))} {foeStanding(foe,game.enemyHP)} of {foe.group.size} {foe.group.plural} standing</Text>}
  <View style={s.foeRow}><Text style={s.foeStat}>{game.enemyHP}<Text style={s.foeMax}> / {foe.maximum} HP</Text></Text><Text style={s.foeStat}>AC {foe.ac}  ·  +{foe.attackBonus} to hit  ·  {foe.count}d{foe.die}{foe.bonus?'+'+foe.bonus:''} {foe.type.toLowerCase()}</Text></View>
  <StatBar value={game.enemyHP} maximum={foe.maximum} kind="enemy" height={12}/>
  <Text style={s.caption}>Your armor class: {spellDefense(game,stats.ac).ac}. Describe an attack, spell, dodge, potion or retreat to the Dungeon Master.</Text>
 </View>}
 <DungeonMaster hero={hero} game={game} health={health} act={act} table={table} onConversationChange={setInConversation}/>
 {!inConversation&&<>
 {game.npcCombat?.active&&<View dataSet={{qb:'plate'}} style={s.combat}><View dataSet={{qb:'banner'}} style={s.banner}><Text style={s.bannerText}>⚔  Combat · Round {game.npcCombat.round}  ⚔</Text></View><Text style={s.label}>Turn order</Text><Text style={s.order}>{game.npcCombat.order.map(n=>(n.id==='player'?'You':npcLore(game,n.id)?.name??n.id)+(n.side==='enemy'?' ⚔':n.side==='ally'?' ⛨':'')).join('   ›   ')}</Text><Text style={s.caption}>Describe an attack or spell, or send Dodge, Flee, Wait, or Surrender.</Text></View>}
 <View dataSet={{qb:'plate'}} style={s.quest}>
  <Text style={s.label}>{game.story?(game.story.status==='complete'?'✦ Adventure complete':'Current quest'):'A written adventure · Simplified rules'}</Text>
  <Text style={s.title}>{game.story?.title??'The Lantern at the Crossroads'}</Text>
  <Ornament style={{marginVertical:10}}/>
  {game.story&&<Text style={s.objective}>{game.story.objective}</Text>}
  <Text style={s.scene}>{game.npcCombat?.active?'Combat erupts. Nearby defenders take their turns.':game.story?(game.stage==='combat'?'You face the '+(foe.group?.plural??(game.wildFight?foe.name:game.story.foe))+'.':game.story.locations[game.stage]?.description??'The encounter has ended. Describe what you do next.'):game.dungeon?.active?dungeonRooms[game.dungeon.room].text:scenes[game.stage]}</Text>
 </View>
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 {game.dungeon?.active&&<View dataSet={{qb:'plate'}} style={s.log}><Text style={s.label}>Lantern Vaults · Room {game.dungeon.room+1} of 8</Text><Text style={s.heading}>{dungeonRooms[game.dungeon.room].name}</Text><Text style={s.caption}>Explored: {game.dungeon.visited.map(n=>dungeonRooms[n].name).join(' → ')}</Text><Text style={s.caption}>Passages: {dungeonRooms[game.dungeon.room].exits.map(n=>dungeonRooms[n].name).join(' · ')}</Text><Text style={s.caption}>Describe exploring a passage, searching, disarming a trap, confronting a guardian, or leaving. Each passage takes one exploration minute. The sanctuary seal may block deeper travel.</Text></View>}
 {['active','found'].includes(campaign.lensQuest)&&<Text style={s.scene}>{campaign.lensQuest==='found'?'The signal lens is in your inventory. Return it to the keeper.':'The keeper needs the signal lens from beneath the watchtower bell.'}</Text>}
 {!!game.pendingSpell&&<Text style={[s.caption,{color:colors.arcane}]}>✧ Spell awaiting a DM ruling. Ask the AI to resolve the spell or provide the detail it requested. Send “Cancel spell” to cancel.</Text>}
 <AdventureMap game={game}/>
 {!!game.log.length&&<View dataSet={{qb:'plate'}} accessibilityLiveRegion="polite" style={s.log}><Pressable accessibilityRole="button" accessibilityState={{expanded:showLog}} onPress={()=>setShowLog(value=>!value)} style={s.logToggle}><Text style={s.logToggleText}>❦  {showLog?'Hide adventure log':'Show adventure log'}</Text><Text style={s.logToggleText}>{showLog?'▴':'▾'}</Text></Pressable>{showLog&&game.log.map((entry,index)=><Text key={index} style={s.entry}>{storyText(game,entry)}</Text>)}</View>}
 </>}
 </View>;
}
const s=StyleSheet.create({
 // Screen-fitting layouts: nothing scrolls the page; each region scrolls on its own.
 wide:{flex:1,minHeight:0,flexDirection:'row',gap:14},side:{width:370,flexGrow:0,flexShrink:0,minHeight:0},sideContent:{paddingBottom:12,gap:0},
 sideTabs:{flexDirection:'row',gap:4,padding:4,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.28)'),backgroundColor:tint('rgba(10,7,11,.55)')},
 // Each tab takes the room its word needs, so "Inventory" is never cut short in a narrow column.
 sideTabItem:{flexGrow:1,flexShrink:1,flexBasis:'auto',minWidth:0,minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:4,borderRadius:4,borderWidth:1,borderColor:'transparent'},sideTabOn:{borderColor:tint('rgba(224,74,92,.55)'),backgroundColor:tint('rgba(48,26,78,.9)')},
 sideTabText:{fontFamily:fonts.display,fontSize:10,fontWeight:'700',letterSpacing:.8,color:colors.muted,textTransform:'uppercase',flexShrink:1},
 taleChapter:{flexDirection:'row',alignItems:'center',gap:8,marginTop:14,marginBottom:2},taleRule:{flex:1,height:1,minWidth:10},taleChapterText:{flexShrink:1,fontFamily:fonts.display,fontSize:12,fontWeight:'700',letterSpacing:.8,color:colors.gold,textAlign:'center'},
 deedWrap:{flexDirection:'row',flexWrap:'wrap',gap:6},deedChip:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:9,paddingVertical:5,borderRadius:14,borderWidth:1,borderColor:tint('rgba(224,74,92,.45)'),backgroundColor:tint('rgba(48,26,78,.5)')},deedChipText:{fontFamily:fonts.display,fontSize:10.5,fontWeight:'700',letterSpacing:.8,color:colors.parchment,textTransform:'uppercase'},
 shareButton:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,minHeight:40,borderRadius:4,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)')},shareText:{fontFamily:fonts.display,fontSize:11.5,fontWeight:'700',letterSpacing:1.4,color:colors.gold,textTransform:'uppercase'},
 shareChip:{marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:5,minHeight:28,paddingHorizontal:10,borderRadius:14,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)')},shareChipText:{fontFamily:fonts.display,fontSize:10,fontWeight:'700',letterSpacing:1,color:colors.gold,textTransform:'uppercase'},
 taleRow:{flexDirection:'row',alignItems:'flex-start',gap:10,marginTop:9},taleMark:{width:24,height:24,borderRadius:12,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.3)'},
 taleText:{flex:1,fontFamily:fonts.story,fontSize:16,lineHeight:23,color:'#e6dfcd',paddingTop:1},regard:{fontFamily:fonts.ui,fontSize:11.5,color:'#b0a39e',marginTop:2,letterSpacing:.2},
 main:{flex:1,minHeight:0,minWidth:0},narrow:{flex:1,minHeight:0},tabContent:{padding:10,paddingBottom:20},
 // Phone combat strip: the foe's portrait, name, HP and armour class, and the round.
 strip:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:10,paddingVertical:7,marginHorizontal:6,borderWidth:1,borderColor:'rgba(220,90,70,.55)',borderRadius:6,marginBottom:6},
 stripAvatar:{width:38,height:38,borderRadius:19},
 stripTop:{flexDirection:'row',alignItems:'center',gap:8},
 stripName:{flex:1,fontFamily:fonts.display,color:'#f5e6e0',fontSize:15,fontWeight:'700',letterSpacing:.4},stripStat:{fontFamily:fonts.display,color:'#f5e6e0',fontSize:13,fontWeight:'800',fontVariant:['tabular-nums']},
 acBadge:{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:1,borderRadius:9,borderWidth:1,borderColor:'rgba(255,180,160,.35)'},acText:{fontFamily:fonts.ui,fontSize:11,fontWeight:'700',color:'#ffc9b8'},
 roundBadge:{alignItems:'center',justifyContent:'center',minWidth:36,paddingLeft:8,borderLeftWidth:1,borderLeftColor:'rgba(255,180,160,.25)'},roundBadgeLabel:{fontFamily:fonts.display,fontSize:8.5,letterSpacing:1.4,color:'#e79a86',textTransform:'uppercase'},roundBadgeText:{fontFamily:fonts.display,fontSize:17,fontWeight:'800',color:'#f5e6e0'},
 toast:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,paddingVertical:9,marginBottom:6,marginHorizontal:6,borderRadius:6,borderWidth:1,borderColor:'rgba(240,106,79,.5)',backgroundColor:'rgba(60,18,14,.92)'},toastText:{flex:1,fontFamily:fonts.ui,color:'#ffd2c2',fontSize:13,lineHeight:19},
 tabBar:{position:'relative',flexDirection:'row',backgroundColor:tint('rgba(14,10,14,.96)'),paddingTop:2,paddingBottom:2},
 tab:{flex:1,alignItems:'center',justifyContent:'center',minHeight:54,gap:3,borderTopWidth:2,borderTopColor:'transparent'},tabOn:{borderTopColor:colors.gold},
 tabAlert:{position:'absolute',top:-2,right:-5,width:8,height:8,borderRadius:4,backgroundColor:colors.bloodBright,borderWidth:1,borderColor:'#1a0a08'},
 tabLabel:{fontFamily:fonts.display,fontSize:9.5,fontWeight:'700',letterSpacing:.7,color:colors.muted,textTransform:'uppercase'},tabOnText:{color:colors.goldBright},
 quest:{padding:20,marginTop:14,borderWidth:1,borderColor:colors.goldLine,borderRadius:6},
 label:{...type.label},labelRow:{flexDirection:'row',alignItems:'center',gap:8},
 title:{fontFamily:fonts.display,color:colors.parchment,fontSize:21,lineHeight:28,fontWeight:'700',letterSpacing:.8,marginTop:8},
 objective:{fontFamily:fonts.story,fontSize:18,lineHeight:27,color:'#decdc5'},
 // A long tale: the chapter under way, the aim of the whole story, a level waiting to be taken, and the leads.
 chapter:{marginBottom:10},chapterTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 chapterOver:{fontFamily:fonts.display,fontSize:10,fontWeight:'700',letterSpacing:2,color:colors.goldMid,textTransform:'uppercase'},
 chapterPips:{flexDirection:'row',gap:5,alignItems:'center'},chapterPip:{width:16,height:4,borderRadius:2,backgroundColor:tint('rgba(178,34,58,.22)')},chapterPipDone:{backgroundColor:colors.goldMid},chapterPipNow:{backgroundColor:colors.goldBright},
 chapterTitle:{fontFamily:fonts.display,fontSize:16,fontWeight:'700',letterSpacing:.6,color:colors.goldBright,marginTop:6,marginBottom:6},
 aim:{fontFamily:fonts.story,fontSize:15,lineHeight:22,color:'#b9b3a3',paddingTop:10,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.16)')},aimLabel:{fontFamily:fonts.display,fontSize:9.5,fontWeight:'700',letterSpacing:1.8,color:colors.goldMid,textTransform:'uppercase'},
 leadCount:{marginLeft:'auto',fontFamily:fonts.ui,fontSize:11.5,color:colors.muted,fontVariant:['tabular-nums']},
 leadRow:{flexDirection:'row',alignItems:'flex-start',gap:10},leadMark:{width:18,height:18,borderRadius:9,borderWidth:1.5,borderColor:tint('rgba(178,34,58,.55)'),alignItems:'center',justifyContent:'center',marginTop:2},leadMarkDone:{backgroundColor:colors.gold,borderColor:tint('#f06e80')},
 leadTitle:{fontFamily:fonts.display,fontSize:14,fontWeight:'700',letterSpacing:.5,color:colors.parchment},leadTitleDone:{color:colors.muted,textDecorationLine:'line-through'},
 leadHook:{fontFamily:fonts.story,fontSize:15,lineHeight:22,color:'#cfc8b6',marginTop:2},leadNote:{fontFamily:fonts.ui,fontSize:11.5,color:colors.faint},
 scene:{fontFamily:fonts.story,fontStyle:'italic',fontSize:16.5,lineHeight:25,color:'#c9c3b3',marginTop:10},
 heading:{fontFamily:fonts.display,color:colors.parchment,fontSize:20,fontWeight:'700',letterSpacing:.8,marginVertical:8},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:21,marginVertical:10},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:22,marginTop:12},
 // Side-column combat card: round banner, the foe's painted portrait with its name, HP and stat chips.
 combat:{padding:16,paddingTop:0,marginTop:14,borderWidth:1,borderColor:'rgba(220,90,70,.6)',borderRadius:6,overflow:'hidden'},
 banner:{flexDirection:'row',justifyContent:'center',gap:10,marginHorizontal:-16,paddingVertical:8,marginBottom:12,alignItems:'center',backgroundColor:'rgba(120,24,16,.55)',borderBottomWidth:1,borderBottomColor:'rgba(240,106,79,.35)'},
 bannerText:{fontFamily:fonts.display,color:'#ffd9c9',fontSize:12,fontWeight:'800',letterSpacing:3,textTransform:'uppercase'},
 foeArt:{borderRadius:4,overflow:'hidden',backgroundColor:tint('#140c0c'),borderWidth:1,borderColor:'rgba(220,90,70,.5)',marginBottom:12,justifyContent:'flex-end'},
 foeCaption:{padding:12,paddingTop:30},foeOver:{fontFamily:fonts.display,fontSize:9.5,fontWeight:'700',letterSpacing:2,color:'#ffb39e',textTransform:'uppercase'},
 foeName:{fontFamily:fonts.display,color:'#fff0e6',fontSize:23,lineHeight:28,fontWeight:'800',letterSpacing:.8,marginTop:2},
 foeRow:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:7},
 foeStat:{fontFamily:fonts.display,color:'#f5e6e0',fontSize:17,fontWeight:'800',fontVariant:['tabular-nums']},group:{fontFamily:fonts.display,color:'#ffb39e',fontSize:12,fontWeight:'700',letterSpacing:1.2,marginBottom:8},foeMax:{fontSize:13,color:'#c9a89c',fontWeight:'400'},
 statChips:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:12},statChip:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:4,borderRadius:12,borderWidth:1,borderColor:'rgba(255,180,160,.28)',backgroundColor:'rgba(0,0,0,.25)'},
 statChipText:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'600',color:'#f0d6cc'},
 yourAc:{flexDirection:'row',alignItems:'center',gap:6,marginTop:12,paddingTop:10,borderTopWidth:1,borderTopColor:'rgba(255,180,160,.15)'},yourAcText:{fontFamily:fonts.ui,fontSize:12,color:colors.muted},
 order:{fontFamily:fonts.display,color:colors.parchment,fontSize:16,fontWeight:'700',letterSpacing:.6,marginVertical:8},
 orderRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6,marginVertical:8},orderChip:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:4,borderRadius:12,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(31,24,32,.8)')},
 orderText:{fontFamily:fonts.ui,fontSize:12.5,fontWeight:'600',color:'#e6dfcd'},
 log:{borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.25)'),padding:16,marginTop:14},
 logToggle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',minHeight:40},
 logToggleText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},
 entry:{fontFamily:fonts.story,color:'#d9d3c3',fontSize:15.5,lineHeight:24,marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.12)')},
 packRow:{flexDirection:'row',flexWrap:'wrap',gap:16},packStat:{flexDirection:'row',alignItems:'baseline',gap:6},packValue:{fontFamily:fonts.display,fontSize:17,fontWeight:'800',color:colors.parchment},packUnit:{fontFamily:fonts.ui,fontSize:12,color:colors.muted},
 packItem:{fontFamily:fonts.story,fontSize:15,lineHeight:22,color:'#e6dfcd'},
 people:{padding:16,marginTop:14,borderWidth:1,borderColor:colors.goldLine,borderRadius:6,gap:12},personRow:{flexDirection:'row',alignItems:'flex-start',gap:12},personAvatar:{width:44,height:44,borderRadius:22},
 personName:{fontFamily:fonts.display,fontSize:15,fontWeight:'700',letterSpacing:.6,color:colors.parchment},standing:{flexDirection:'row',alignItems:'center',gap:6,marginTop:3},standingDot:{width:7,height:7,borderRadius:4},
 standingText:{fontFamily:fonts.ui,fontSize:12,fontWeight:'600',letterSpacing:.3},stripAlly:{fontFamily:fonts.ui,fontSize:11.5,color:'#ffc9b8'},allyRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:12,paddingTop:10,borderTopWidth:1,borderTopColor:'rgba(240,106,79,.25)'},allyTop:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:8},allyName:{fontFamily:fonts.display,fontWeight:'700',fontSize:15,color:'#f3e3d6',flexShrink:1},allyStat:{fontFamily:fonts.ui,fontSize:12,color:'#ffc9b8'},where:{fontFamily:fonts.ui,fontSize:12,color:colors.muted,flexShrink:1},memory:{fontFamily:fonts.story,fontStyle:'italic',fontSize:14.5,lineHeight:21,color:'#d4cbb7',marginTop:4},
 // Dying: death-save pips. Dead: the epitaph.
 dying:{padding:16,marginTop:14,borderWidth:1,borderColor:'rgba(220,90,70,.6)',borderRadius:6,gap:10},dyingStrip:{marginTop:0,marginHorizontal:6,marginBottom:6,paddingVertical:8,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 dyingText:{fontFamily:fonts.story,fontStyle:'italic',fontSize:16,lineHeight:24,color:'#e6cfc6'},
 pipRows:{flexDirection:'row',gap:18,alignItems:'center'},pipRow:{flexDirection:'row',alignItems:'center',gap:6},
 pip:{width:14,height:14,borderRadius:7,borderWidth:1.5,borderColor:'rgba(255,200,185,.45)'},pipGood:{backgroundColor:colors.heal,borderColor:colors.heal},pipBad:{backgroundColor:colors.bloodBright,borderColor:colors.bloodBright},
 epitaph:{alignItems:'center',gap:8,padding:20,marginTop:14,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),borderRadius:6},epitaphStrip:{marginTop:0,marginHorizontal:6,marginBottom:6,padding:12,flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:10},
 epitaphOver:{fontFamily:fonts.display,fontSize:10,letterSpacing:3,color:colors.faint,textTransform:'uppercase'},epitaphName:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:1,color:colors.parchment},
 epitaphLine:{fontFamily:fonts.ui,fontSize:12,color:colors.gold,letterSpacing:.5},epitaphCause:{fontFamily:fonts.story,fontStyle:'italic',fontSize:15,lineHeight:22,color:'#cfc6b4',textAlign:'center',marginTop:2},
 epitaphButton:{flexDirection:'row',alignItems:'center',gap:8,minHeight:42,paddingHorizontal:18,borderRadius:21,borderWidth:1,borderColor:tint('#f06e80'),backgroundColor:tint('#9e1b32'),marginTop:4},epitaphButtonText:{fontFamily:fonts.display,fontSize:12,fontWeight:'800',letterSpacing:1.6,color:tint('#ffeef0'),textTransform:'uppercase'}});