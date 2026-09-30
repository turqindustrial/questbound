import {useSceneTransition} from './SceneTransition';
import {sceneArtSubjects} from './worldArtRules';
import {EntityText as Text,useEncounter} from './EncounterOverlay';
import {storyText} from './storyRules';
import {quickActions} from './quickActions';
import {recordedTurn} from './playbackRules';
import {withSceneTrigger} from './sceneTriggers';
import {dungeonRooms,dungeonState} from './dungeonRules';
import React,{useState,useEffect,useRef} from 'react';
import {View,Pressable,ScrollView,StyleSheet,useWindowDimensions} from 'react-native';
import DungeonMaster from './DungeonMaster';
import AdventureMap from './AdventureMap';
import {commitDmTurn} from './dmContext';
import {campaignState,earnedGold} from './campaignRules';
import {mapState} from './mapRules';
import {spellDefense} from './spellRules';
import {combatBasics} from './combatRules';
import {encounterFoe,adventureStep,foeStanding} from './adventureRules';
import {Ornament,StatBar} from './ui';
import {fonts,colors,type} from './theme';
export default function Adventure({hero,game,setGame,health,setHealth,table,layout,levelUp=false,onLevelUp}){
 const transition=useSceneTransition();
 const [tab,setTab]=useState('story');
 const {width:windowWidth}=useWindowDimensions();
 // New turns (yours, the table's or a scene moment) bring a phone player back to the story.
 const lastTurn=game.playback?.at(-1)?.id??0;
 useEffect(()=>{setTab('story');},[lastTurn,game.sceneCue?.id]);
 const stats=combatBasics(hero),foe=encounterFoe(hero,game),map=mapState(game),campaign=campaignState(game);
 const [inConversation,setInConversation]=useState(false);
 const [error,setError]=useState(''),[showLog,setShowLog]=useState(false),sendRef=useRef(null),encounter=useEncounter();
 const act=async(action,conversation,random=Math.random)=>{const tablePoint=table?.joined?table.checkpoint():null;if(conversation&&table?.joined)conversation={...conversation,actorName:table.name||'Adventurer'};let result=conversation?commitDmTurn(hero,game,health,action,conversation,random):adventureStep(game,health,hero,action,random);if(result.error){setError(storyText(game,result.error));return result;}if(conversation)result=recordedTurn(hero,game,health,result,conversation,conversation.npcId??null);result={...result,game:{...result.game}};delete result.game.sceneCue;if(!conversation?.trigger)result.game=withSceneTrigger(game,result.game,action);if(result.game.sceneCue&&table?.joined)result.game={...result.game,sceneCue:{...result.game.sceneCue,origin:table.deviceId}};await transition.prepare(sceneArtSubjects(result.game));if(tablePoint&&!table.isCurrent(tablePoint)){const error='The table changed while this scene was preparing. Your action was not applied; try again from the latest turn.';setError(error);return {game,health,error};}setGame(result.game);setHealth(result.health);setError('');return result;};
 if(!stats.available||stats.ac===null)return <Text style={s.text}>Complete your abilities and equipment through Character Selection before playing.</Text>;
 const scenes={inn:game.enemyHP===0?'The inn is warm. Beyond the window, the restored bridge lantern shines. The keeper welcomes you back.':map.accepted?'The keeper tends the hearth. Mara, a traveling medicine courier, sits nearby. The bridge still needs its light.':'Rain drives you into the crossroads inn. A keeper raises a flickering blue lantern. “The bridge light is missing. Will you bring it back?” A healing draught waits on the table.',tower:map.clue?'Beneath the watchtower bell, you recognize the signal: low, high, low.':'Ivy threads through a cracked bell tower. Three marks are carved beneath its bell.',bridge:game.enemyHP===0?'Warm light falls across the restored bridge. Travelers cross safely.':'A restless wisp circles the broken bridge lamp.',combat:'The Lantern Wisp hovers within melee reach. Tell the DM what you do.',victory:'The lantern shines again. You can claim the keeper’s reward and ask about further work.',defeat:'The keeper has pulled you to safety. Tell the DM when you want to begin another adventure.',escaped:'You escaped the wisp. Tell the DM when you want to begin another adventure.'};
 const standing=foeStanding(foe,game.enemyHP),sideWidth=layout==='wide'?Math.round(Math.min(370,Math.max(220,windowWidth*.36))):windowWidth;
 // One-tap actions for this moment; the map's Travel buttons send through the same Dungeon Master turn.
 const quick=[...(levelUp&&onLevelUp?[{key:'level-up',glyph:'✦',label:'Level up',primary:true,run:onLevelUp}]:[]),...quickActions(hero,game)];
 const travel=id=>{const trip=quick.find(a=>a.destination===id);if(!trip)return;setTab('story');sendRef.current?.(trip);};
 const travelTo=quick.filter(a=>a.destination).map(a=>a.destination);
 // Pieces of the play area, arranged below for wide screens (side column) or phones (tabs).
 const combatStrip=game.stage==='combat'&&<Pressable accessibilityRole="button" accessibilityLabel="Show everyone's combat HP" disabled={!encounter?.roster.length} onPress={()=>encounter?.open('combat')} dataSet={{qb:'plate'}} style={s.strip}>
  <View style={s.stripTop}><Text style={s.stripRound}>⚔ R{game.round}</Text><Text numberOfLines={1} style={s.stripName}>{foe.group?standing+'× ':''}{game.story?.foe??foe.name}</Text><Text style={s.stripStat}>{game.enemyHP}/{foe.maximum} · AC {foe.ac}</Text></View>
  <StatBar value={game.enemyHP} maximum={foe.maximum} kind="enemy" height={8}/>
 </Pressable>;
 const combatPlate=game.stage==='combat'&&<View dataSet={{qb:'plate'}} style={[s.combat,{marginTop:0}]}>
  <View dataSet={{qb:'banner'}} style={s.banner}><Text numberOfLines={1} style={s.bannerText}>{sideWidth<300?'Round '+game.round+'  ·  Your turn':'⚔  Round '+game.round+'  ·  Your turn  ⚔'}</Text></View>
  <Text style={s.label}>Opponent</Text>
  <Text style={[s.foeName,sideWidth<300&&{fontSize:24}]}>{game.story?.foe??foe.name}</Text>
  {foe.group&&<Text style={s.group}>{'◆ '.repeat(standing)}{'◇ '.repeat(foe.group.size-standing)} {standing} of {foe.group.size} {foe.group.plural} standing</Text>}
  <View style={s.foeRow}><Text style={s.foeStat}>{game.enemyHP}<Text style={s.foeMax}> / {foe.maximum} HP</Text></Text><Text style={s.foeStat}>AC {foe.ac}</Text></View>
  <StatBar value={game.enemyHP} maximum={foe.maximum} kind="enemy" height={12}/>
  <Text style={s.caption}>+{foe.attackBonus} to hit · {foe.count}d{foe.die}{foe.bonus?'+'+foe.bonus:''} {foe.type.toLowerCase()} · your AC {spellDefense(game,stats.ac).ac}</Text>
 </View>;
 const npcCombatPanel=game.npcCombat?.active&&<View dataSet={{qb:'plate'}} style={s.combat}><View dataSet={{qb:'banner'}} style={s.banner}><Text style={s.bannerText}>⚔  Combat · Round {game.npcCombat.round}  ⚔</Text></View><Text style={s.label}>Turn order</Text><Text style={s.order}>{game.npcCombat.order.map(n=>(n.id==='player'?'You':game.story?.npcs[n.id]?.name??(n.id==='keeper'?'The keeper':'Mara'))+(n.side==='enemy'?' ⚔':n.side==='ally'?' ⛨':'')).join('   ›   ')}</Text><Text style={s.caption}>Describe an attack or spell, or send Dodge, Flee, Wait, or Surrender.</Text></View>;
 const questPanel=<>
  {npcCombatPanel}
  <View dataSet={{qb:'plate'}} style={s.quest}>
   <Text style={s.label}>{game.story?(game.story.status==='complete'?'✦ Adventure complete':'Current quest'):'A written adventure · Simplified rules'}</Text>
   <Text style={s.title}>{game.story?.title??'The Lantern at the Crossroads'}</Text>
   <Ornament style={{marginVertical:10}}/>
   {game.story&&<Text style={s.objective}>{game.story.objective}</Text>}
   <Text style={s.scene}>{game.npcCombat?.active?'Combat erupts. Nearby defenders take their turns.':game.story?(game.stage==='combat'?'You face the '+(foe.group?.plural??game.story.foe)+'.':game.story.locations[game.stage]?.description??'The encounter has ended. Describe what you do next.'):game.dungeon?.active?dungeonRooms[game.dungeon.room].text:scenes[game.stage]}</Text>
  </View>
  {game.dungeon?.active&&<View dataSet={{qb:'plate'}} style={s.log}><Text style={s.label}>Lantern Vaults · Room {game.dungeon.room+1} of 8</Text><Text style={s.heading}>{dungeonRooms[game.dungeon.room].name}</Text><Text style={s.caption}>Explored: {game.dungeon.visited.map(n=>dungeonRooms[n].name).join(' → ')}</Text><Text style={s.caption}>Passages: {dungeonRooms[game.dungeon.room].exits.map(n=>dungeonRooms[n].name).join(' · ')}</Text><Text style={s.caption}>Describe exploring a passage, searching, disarming a trap, confronting a guardian, or leaving. Each passage takes one exploration minute. The sanctuary seal may block deeper travel.</Text></View>}
  {['active','found'].includes(campaign.lensQuest)&&<Text style={s.scene}>{campaign.lensQuest==='found'?'The signal lens is in your inventory. Return it to the keeper.':'The keeper needs the signal lens from beneath the watchtower bell.'}</Text>}
  {!!game.pendingSpell&&<Text style={[s.caption,{color:colors.arcane}]}>✧ Spell awaiting a DM ruling. Ask the AI to resolve the spell or provide the detail it requested. Send “Cancel spell” to cancel.</Text>}
 </>;
 const logPanel=!!game.log.length&&<View dataSet={{qb:'plate'}} accessibilityLiveRegion="polite" style={s.log}><Text style={s.label}>❦  Adventure log</Text>{game.log.map((entry,index)=><Text key={index} style={s.entry}>{storyText(game,entry)}</Text>)}</View>;
 const master=<DungeonMaster fill quick={quick} sendRef={sendRef} hero={hero} game={game} health={health} act={act} table={table} onConversationChange={setInConversation}/>;
 const mapPanel=<AdventureMap game={game} travelTo={travelTo} onTravel={travel}/>;
 const toast=!!error&&<Pressable accessibilityRole="alert" onPress={()=>setError('')} style={s.toast}><Text style={s.toastText}>{error}  ✕</Text></Pressable>;
 // Wide (side column) and narrow (tabs) share one element tree, so turning a phone never remounts the
 // Dungeon Master: a turn in progress, its playback and a half-typed message all survive the rotation.
 if(layout==='wide'||layout==='narrow'){const wide=layout==='wide',story=wide||tab==='story';return <View style={wide?s.wide:s.narrow}>
  {wide&&<ScrollView style={[s.side,{width:sideWidth}]} contentContainerStyle={s.sideContent}>{combatPlate}{questPanel}{mapPanel}{logPanel}</ScrollView>}
  {!wide&&tab==='story'&&combatStrip}
  {!wide&&toast}
  {/* The Dungeon Master stays mounted on every tab so a turn in progress is never interrupted. */}
  <View style={[s.main,!story&&{display:'none'}]}>{wide&&toast}{master}</View>
  {!story&&<ScrollView style={s.main} contentContainerStyle={s.tabContent}>{tab==='quest'&&<>{combatPlate}{questPanel}</>}{tab==='map'&&mapPanel}{tab==='log'&&(logPanel||<Text style={s.caption}>Nothing has happened yet.</Text>)}</ScrollView>}
  {!wide&&<View dataSet={{qb:'tabbar'}} style={s.tabBar} accessibilityRole="tablist">{[['story','❦','Story'],['quest','✦','Quest'],['map','◈','Map'],['log','☰','Log']].map(([id,glyph,label])=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:tab===id}} onPress={()=>setTab(id)} style={[s.tab,tab===id&&s.tabOn]}><Text style={[s.tabGlyph,tab===id&&s.tabOnText]}>{glyph}</Text><Text style={[s.tabLabel,tab===id&&s.tabOnText]}>{label}{id==='quest'&&game.stage==='combat'&&tab!=='quest'?' •':''}</Text></Pressable>)}</View>}
 </View>;}
 return <View>
 {game.stage==='combat'&&<View dataSet={{qb:'plate'}} style={[s.combat,{marginTop:4,marginBottom:4}]}>
  <View dataSet={{qb:'banner'}} style={s.banner}><Text style={s.bannerText}>⚔  Round {game.round}  ·  Your turn  ⚔</Text></View>
  <Text style={s.label}>{'Opponent'}</Text>
  <Text style={s.foeName}>{game.story?.foe??foe.name}</Text>
  {foe.group&&<Text style={s.group}>{'◆ '.repeat(foeStanding(foe,game.enemyHP))}{'◇ '.repeat(foe.group.size-foeStanding(foe,game.enemyHP))} {foeStanding(foe,game.enemyHP)} of {foe.group.size} {foe.group.plural} standing</Text>}
  <View style={s.foeRow}><Text style={s.foeStat}>{game.enemyHP}<Text style={s.foeMax}> / {foe.maximum} HP</Text></Text><Text style={s.foeStat}>AC {foe.ac}  ·  +{foe.attackBonus} to hit  ·  {foe.count}d{foe.die}{foe.bonus?'+'+foe.bonus:''} {foe.type.toLowerCase()}</Text></View>
  <StatBar value={game.enemyHP} maximum={foe.maximum} kind="enemy" height={12}/>
  <Text style={s.caption}>Your armor class: {spellDefense(game,stats.ac).ac}. Describe an attack, spell, dodge, potion or retreat to the Dungeon Master.</Text>
 </View>}
 <DungeonMaster hero={hero} game={game} health={health} act={act} table={table} onConversationChange={setInConversation}/>
 {!inConversation&&<>
 {game.npcCombat?.active&&<View dataSet={{qb:'plate'}} style={s.combat}><View dataSet={{qb:'banner'}} style={s.banner}><Text style={s.bannerText}>⚔  Combat · Round {game.npcCombat.round}  ⚔</Text></View><Text style={s.label}>Turn order</Text><Text style={s.order}>{game.npcCombat.order.map(n=>(n.id==='player'?'You':game.story?.npcs[n.id]?.name??(n.id==='keeper'?'The keeper':'Mara'))+(n.side==='enemy'?' ⚔':n.side==='ally'?' ⛨':'')).join('   ›   ')}</Text><Text style={s.caption}>Describe an attack or spell, or send Dodge, Flee, Wait, or Surrender.</Text></View>}
 <View dataSet={{qb:'plate'}} style={s.quest}>
  <Text style={s.label}>{game.story?(game.story.status==='complete'?'✦ Adventure complete':'Current quest'):'A written adventure · Simplified rules'}</Text>
  <Text style={s.title}>{game.story?.title??'The Lantern at the Crossroads'}</Text>
  <Ornament style={{marginVertical:10}}/>
  {game.story&&<Text style={s.objective}>{game.story.objective}</Text>}
  <Text style={s.scene}>{game.npcCombat?.active?'Combat erupts. Nearby defenders take their turns.':game.story?(game.stage==='combat'?'You face the '+(foe.group?.plural??game.story.foe)+'.':game.story.locations[game.stage]?.description??'The encounter has ended. Describe what you do next.'):game.dungeon?.active?dungeonRooms[game.dungeon.room].text:scenes[game.stage]}</Text>
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
 wide:{flex:1,minHeight:0,flexDirection:'row',gap:14},side:{width:370,flexGrow:0,flexShrink:0},sideContent:{paddingBottom:12,gap:0},
 main:{flex:1,minHeight:0,minWidth:0},narrow:{flex:1,minHeight:0},tabContent:{padding:10,paddingBottom:20},
 strip:{paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:'rgba(200,65,47,.6)',borderRadius:3,marginBottom:6,gap:6},
 stripTop:{flexDirection:'row',alignItems:'center',gap:10},stripRound:{fontFamily:fonts.display,color:'#ffb39e',fontSize:12,fontWeight:'800',letterSpacing:1},
 stripName:{flex:1,fontFamily:fonts.display,color:'#ffe6d6',fontSize:15,fontWeight:'700'},stripStat:{fontFamily:fonts.ui,color:'#e8c9bd',fontSize:12,fontVariant:['tabular-nums']},
 toast:{paddingHorizontal:12,paddingVertical:8,marginBottom:6,borderRadius:3,borderWidth:1,borderColor:'rgba(240,106,79,.5)',backgroundColor:'rgba(60,18,14,.85)'},toastText:{fontFamily:fonts.ui,color:'#ffd2c2',fontSize:13,lineHeight:19},
 tabBar:{flexDirection:'row',borderTopWidth:1,borderTopColor:'rgba(201,164,92,.35)',backgroundColor:'rgba(8,10,16,.96)',paddingTop:4,paddingBottom:2},
 tab:{flex:1,alignItems:'center',justifyContent:'center',minHeight:52,gap:2},tabOn:{borderTopWidth:2,borderTopColor:colors.gold,marginTop:-5,paddingTop:3},
 tabGlyph:{fontSize:17,color:colors.muted},tabLabel:{fontFamily:fonts.display,fontSize:10,fontWeight:'700',letterSpacing:1.4,color:colors.muted,textTransform:'uppercase'},tabOnText:{color:colors.gold},
 quest:{padding:22,marginTop:14,borderWidth:1,borderColor:colors.goldLine,borderRadius:4},
 label:{...type.label},
 title:{fontFamily:fonts.display,color:colors.parchment,fontSize:26,fontWeight:'700',letterSpacing:1,marginTop:8},
 objective:{fontFamily:fonts.story,fontSize:18,lineHeight:28,color:'#eadcb9'},
 scene:{fontFamily:fonts.story,fontStyle:'italic',fontSize:17,lineHeight:27,color:'#c9c3b3',marginTop:12},
 heading:{fontFamily:fonts.display,color:colors.parchment,fontSize:20,fontWeight:'700',letterSpacing:.8,marginVertical:8},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:21,marginVertical:10},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:22,marginTop:12},
 combat:{padding:22,paddingTop:0,marginTop:14,borderWidth:1,borderColor:'rgba(200,65,47,.6)',borderRadius:4,overflow:'hidden'},
 banner:{marginHorizontal:-22,paddingVertical:9,marginBottom:14,alignItems:'center',backgroundColor:'rgba(120,24,16,.55)',borderBottomWidth:1,borderBottomColor:'rgba(240,106,79,.35)'},
 bannerText:{fontFamily:fonts.display,color:'#ffd9c9',fontSize:12,fontWeight:'800',letterSpacing:3,textTransform:'uppercase'},
 foeName:{fontFamily:fonts.display,color:'#ffe6d6',fontSize:30,fontWeight:'800',letterSpacing:1,marginTop:6,marginBottom:10},
 foeRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',marginBottom:8},
 foeStat:{fontFamily:fonts.display,color:'#ffe6d6',fontSize:16,fontWeight:'700'},group:{fontFamily:fonts.display,color:'#ffb39e',fontSize:12,fontWeight:'700',letterSpacing:1.2,marginBottom:8},foeMax:{fontSize:13,color:'#c9a89c',fontWeight:'400'},
 order:{fontFamily:fonts.display,color:colors.parchment,fontSize:16,fontWeight:'700',letterSpacing:.6,marginVertical:8},
 log:{borderRadius:4,borderWidth:1,borderColor:'rgba(201,164,92,.25)',padding:16,marginTop:18},
 logToggle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',minHeight:40},
 logToggleText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},
 entry:{fontFamily:fonts.story,color:'#d9d3c3',fontSize:16,lineHeight:25,marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:'rgba(201,164,92,.12)'}});
