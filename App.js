import AdventureIntros from './AdventureIntros';
import {findDmEndpoint,askDm} from './dmConnection';
import Followers from './Followers';
import DiceRoller from './DiceRoller';
import SceneTransitionProvider,{useSceneTransition} from './SceneTransition';
import {sceneArtSubjects,npcArtSubject} from './worldArtRules';
import {usePageWheel} from './usePageWheel';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import EncounterProvider,{CombatHealthButton,EntityText} from './EncounterOverlay';
import {freshStoryGame} from './storyRules';
import {hostileEncounterGame} from './hostileEncounter';
import CampaignJournal from './CampaignJournal';
import {addJournalNote,appendJournal} from './journalRules';
import Advancement from './Advancement';
import {spellSelectionError} from './spellOptions';
import {loadAdventure, saveAdventure, adventureSnapshot, validAdventure} from './adventureStorage';
import {useSharedTable} from './useSharedTable';
import {backupLocalSave} from './tableClient';
import SharedTable from './SharedTable';
import Adventure from './Adventure';
import {newAdventure} from './adventureRules';
import CharacterSheet from './CharacterSheet';
import {combatBasics} from './combatRules';
import CharacterBuilder from './CharacterBuilder';
import { blankBuild, buildError, makeCharacter, abilities, modifier } from './characterRules';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { loadCharacter, saveCharacter, isValidCharacter } from './characterStorage';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View, Image, useWindowDimensions } from 'react-native';
import {Panel,GameButton,Ornament,Eyebrow,StatBar,ScreenTitle,Section,Crest} from './ui';
import {fonts,colors,type} from './theme';
import {setMood,setAmbience,setDanger,playSound} from './audio';
import HomeScreen from './HomeScreen';
import Icon from './Icon';
import {classIcons} from './iconPaths';
import HeroPortrait from './HeroPortrait';
import CinematicLayer from './CinematicLayer';
import StoryLoading from './StoryLoading';
import {shortcutsBlocked} from './keyboard';
import {cue,useCue} from './cinematics';
// Page headings: overline, title and icon for the screens that have one.
const titles={'Character Selection':['Heroes','Choose your hero','sheet'],'Dice Roller':['Tabletop','Roll the dice','d20'],'Settings':['Options','Settings','settings'],'Level Up':['Victory earned','Level up','star']};
import {AudioToggle,AudioSettings} from './AudioControls';
import {FullscreenToggle,DisplaySettings} from './DisplayControls';
import GameHud from './GameHud';
import LaunchScreen from './LaunchScreen';
import SaveTransfer from './SaveTransfer';
import QuickHeroes from './QuickHeroes';
import FeedbackSheet from './Feedback';
const titleArt=require('./assets/map/crossroads-landscape.jpg');

export default function App(){return <SceneTransitionProvider><QuestboundApp/></SceneTransitionProvider>;}
function QuestboundApp() {
  const {width:windowWidth,height:windowHeight}=useWindowDimensions(),compact=windowWidth<600;
  // Short, wide windows (a phone on its side, a small full-screen window) put the title beside the menu.
  const shortHome=windowHeight<640&&windowWidth>windowHeight*1.2,denseHome=windowHeight<700;
  // The title lettering scales with the space it has so the full word always fits.
  const logoSize=Math.max(28,Math.min(76,Math.floor(((shortHome?windowWidth/2:windowWidth)-48)/9),Math.floor(windowHeight/9)));
  const scrollRef = useRef(null);
  usePageWheel(scrollRef);
  const transition=useSceneTransition();
  const [creatingStory,setCreatingStory]=useState(false),[newStoryRequested,setNewStoryRequested]=useState(false);
  const storyLock=useRef(false);
  const [selectedIntro,setSelectedIntro]=useState('surprise'),[showReady,setShowReady]=useState(false);
  const [screen, setScreenState] = useState('Home');
  const [form, setForm] = useState(blankBuild);
  const [hero, setHero] = useState(null);
  const [health, setHealth] = useState(null);
  const [game, setGame] = useState(newAdventure);
  const heroStats = hero ? combatBasics(hero) : null;
  const [characterChosen, setCharacterChosen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [adventureBlocked,setAdventureBlocked] = useState(false);
  const [saveStatus,setSaveStatus] = useState('');
  const [saveRetry,setSaveRetry] = useState(0);
  useEffect(() => {
    loadCharacter().then(async saved => {
      if (saved) {
        setHero(saved);
        setForm({...blankBuild(), ...saved, species: saved.species ?? saved.race});
        try {
          const adventure = await loadAdventure(saved);
          if(adventure){setGame(adventure.game);setHealth(adventure.health);setCharacterChosen(adventure.chosen);}
        } catch {setAdventureBlocked(true);setSaveStatus('Your adventure could not be loaded. Reopen the app to retry. Its saved progress has been protected.');}
      }
    }).catch(() => setStorageError('Your saved character could not be loaded. Reopen the app to retry. Saving is disabled to protect the existing save.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if(loading || !hero || storageError || adventureBlocked) return;
    let current=true;
    setSaveStatus('Saving adventure...');
    saveAdventure(adventureSnapshot(hero,game,health,characterChosen),hero)
      .then(()=>{if(current)setSaveStatus('Adventure saved on this device.');})
      .catch(()=>{if(current)setSaveStatus('Adventure not saved. Your progress is still open; retry before closing the app.');});
    return ()=>{current=false;};
  },[loading,hero,game,health,characterChosen,storageError,adventureBlocked,saveRetry]);
  const [error, setError] = useState('');
  // The shared table's adventure replaces this device's only after it passes the same checks as a local save.
  async function applyRemote(snapshot,isCurrent=()=>true){
    let remoteHero;try{remoteHero=JSON.parse(snapshot.character);}catch{throw Error('The shared adventure could not be read.');}
    if(!isValidCharacter(remoteHero)||!validAdventure(snapshot,remoteHero))throw Error('The shared adventure did not pass validation. This device kept its own save.');
    if(!isCurrent())return;
    backupLocalSave();
    await saveCharacter(remoteHero);
    if(!isCurrent())return;
    setHero(remoteHero);setForm({...blankBuild(),...remoteHero,species:remoteHero.species??remoteHero.race});
    setGame(snapshot.game);setHealth(snapshot.health);setCharacterChosen(snapshot.chosen);setNewStoryRequested(false);
  }
  const table=useSharedTable({ready:!loading&&!storageError&&!adventureBlocked,hero,game,health,characterChosen,applyRemote});
  async function setScreen(target){
    try{if(['Adventure','Character Sheet','Campaign Journal','Followers'].includes(target)&&hero)await transition.prepare([...sceneArtSubjects(game),...(target==='Followers'?Object.keys(game.followers??{}).map(id=>npcArtSubject(game,id)):[])]);setScreenState(target);}
    catch(e){setError(e.message);}
  }
  const button = (label, onPress, variant='secondary', style) => <GameButton key={label} label={label} variant={variant} disabled={loading||creatingStory} onPress={onPress} style={style}/>;
  async function playCharacter(begin=false){
    if(storyLock.current||loading||storageError||adventureBlocked||!hero)return;
    if(!newStoryRequested){setCharacterChosen(true);setScreen('Adventure');return;}
    if(begin!==true){setScreen('Adventure Opening');scrollRef.current?.scrollTo({y:0,animated:false});return;}
    storyLock.current=true;setCreatingStory(true);setError('');
    try{
      let next;
      if(selectedIntro==='hostile')next=hostileEncounterGame(hero,newAdventure(hero));
      else{
      const endpoint=await findDmEndpoint();
      const {ok,body}=await askDm(endpoint,{input:'Create a fresh adventure for my character.',context:{mode:'adventure',introId:selectedIntro,choices:[],player:{name:hero.name,class:hero.class,level:hero.level,background:hero.background,backstory:hero.backstory},previousStory:game.story?{title:game.story.title,premise:game.story.premise}:null,previousTitles:game.storyHistory??[],variation:Date.now()+'-'+Math.random()}});
      if(!ok)throw Error(body.error||'The story could not be created.');
      next=freshStoryGame(hero,{...body.story,introId:selectedIntro},newAdventure(hero));
      if([...(game.storyHistory??[]),game.story?.title].filter(Boolean).some(title=>title.toLowerCase()===next.story.title.toLowerCase()))throw Error('The DM repeated the previous story. Try again; your adventure is unchanged.');
      }
      next.storyHistory=[...new Set([...(game.storyHistory??[]),game.story?.title,next.story.title].filter(Boolean))].slice(-100);
      await transition.prepare(sceneArtSubjects(next));
      await saveAdventure(adventureSnapshot(hero,next,null,true),hero);
      setGame(next);setHealth(null);setCharacterChosen(true);setNewStoryRequested(false);setScreenState('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});
    }catch(e){setError(e.name==='TimeoutError'?'Story creation timed out. Your current adventure is unchanged; try again.':e.message);}
    finally{storyLock.current=false;setCreatingStory(false);}
  }
  async function saveHero() {
    if (loading || saving || storageError) return;
    if (buildError(form) || spellSelectionError(form)) {
      setError(buildError(form) || spellSelectionError(form)); return;
    }
    const character = makeCharacter(form);
    setSaving(true);
    setError('');
    try {
      await saveCharacter(character);
      setHero(character);
      setHealth(null); setGame(newAdventure(character));
      setCharacterChosen(false);setNewStoryRequested(true);
      setScreen('Character Selection');
      scrollRef.current?.scrollTo({y:0,animated:false});
    } catch {
      setError('Could not save your character. Your entries are still here; please try again.');
    } finally {
      setSaving(false);
    }
  }
  // A ready-made hero skips the builder: saved, then straight to choosing where the story begins.
  async function useReadyHero(character) {
    if (loading || saving || storageError) return;
    setSaving(true); setError('');
    try {
      if (hero) backupLocalSave();
      await saveCharacter(character);
      setHero(character); setForm({...blankBuild(), ...character, species: character.species ?? character.race});
      setHealth(null); setGame(newAdventure(character));
      setCharacterChosen(false); setNewStoryRequested(true); setShowReady(false);
      setScreenState('Adventure Opening');
      scrollRef.current?.scrollTo({y:0,animated:false});
    } catch {
      setError('Could not save that hero. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  async function saveAdvancement(character) {
    if(saving || storageError || game.stage!=='victory' || !hero || hero.level>=20 || character.level!==hero.level+1 || character.class!==hero.class)return;
    setSaving(true);setError('');
    try {const advanced=newAdventure(character,game);if(game.story){advanced.story=game.story;advanced.storyHistory=game.storyHistory;advanced.enemyHP=Math.min(game.enemyHP,advanced.enemyHP,game.story.foeStats?.maximum??Infinity);advanced.firedTriggers=game.firedTriggers;advanced.map={...advanced.map,accepted:true,visited:[...new Set(['inn',...(game.map?.visited??[]).filter(id=>['inn','bridge','tower'].includes(id))])],minutes:game.map?.minutes??0};}advanced.journal=appendJournal(advanced.journal,'level','Level gained',`${character.name} reached level ${character.level}.`);await transition.prepare(sceneArtSubjects(advanced));await saveCharacter(character);setHero(character);setForm(character);setGame(advanced);setHealth(null);setScreenState('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});cue('levelup',{level:character.level,sub:character.name+' is now a level '+character.level+' '+character.class+', rested and ready.'});}
    catch {setError('Could not save your level-up. Your previous character is still saved. Retry when ready.');}
    finally {setSaving(false);}
  }
  const gameScreen=['Adventure','Character Sheet','Campaign Journal','Followers'].includes(screen)&&characterChosen&&hero;
  const saved=characterChosen&&!!hero;
  // Settings opened from the game menu, and a level-up, stay inside the adventure: same scene, same score, a way back.
  const [returnToGame,setReturnToGame]=useState(false);
  const inGame=!!gameScreen||(saved&&(screen==='Level Up'||(screen==='Settings'&&returnToGame)));
  const openFromGame=target=>{setReturnToGame(target==='Settings');setScreen(target);};
  const backToGame=()=>{setReturnToGame(false);setScreen('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});};
  const fighting=inGame&&(game.stage==='combat'||!!game.npcCombat?.active);
  // The score waits for the launch screen; after that it follows the scene. Ambience follows the location,
  // and a heartbeat rises when the hero is at 30% HP or less.
  const [launched,setLaunched]=useState(false);
  // A blow against the hero shakes the play area for a moment.
  const [shake,setShake]=useState(0);
  useCue(useCallback(event=>{if(event.kind==='hurt'){setShake(event.id);setTimeout(()=>setShake(value=>value===event.id?0:value),450);}},[]));
  const playing=screen==='Adventure'&&characterChosen&&!!hero&&!!heroStats?.available;
  // Side-by-side play on large screens and on any landscape screen (a phone on its side has height for one column only).
  const wideGame=windowWidth>=960||(windowWidth>=560&&windowWidth>windowHeight*1.25);
  // Shelter (camp or inn, and after a fight ends) gets the warm haven theme; the road and ruins get the exploration theme.
  const sheltered=['inn','defeat','escaped','victory'].includes(game.stage)&&!game.dungeon?.active;
  useEffect(()=>{setMood(!launched?'silence':inGame?(fighting?'combat':sheltered?'haven':'explore'):'menu');},[launched,inGame,fighting,sheltered]);
  const ambienceKind=!launched?'none':inGame?(game.dungeon?.active?'cave':fighting?'battle':['inn','defeat','escaped'].includes(game.stage)?'hearth':'wild'):'menu';
  useEffect(()=>{setAmbience(ambienceKind);},[ambienceKind]);
  // Esc on a page opened from the game (journal, sheet, party, settings) returns to the adventure.
  const escapeRef=useRef(null);escapeRef.current=inGame&&screen!=='Adventure'&&screen!=='Level Up'?backToGame:null;
  useEffect(()=>{if(typeof document==='undefined')return;const onKey=e=>{if(e.key!=='Escape'||!escapeRef.current||shortcutsBlocked())return;e.preventDefault();escapeRef.current();};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[]);
  // The browser tab names the hero and where they are, and marks a fight.
  const tabTitle=inGame&&hero?(fighting?'⚔ ':'')+hero.name+(locationArtSubject(game)?.name?' · '+locationArtSubject(game).name:'')+' — Questbound':'Questbound';
  useEffect(()=>{if(typeof document!=='undefined')document.title=tabTitle;},[tabTitle]);
  // Entering the game rises out of black and names the place (a new tale names the story first).
  const areaName=inGame?locationArtSubject(game)?.name??null:null,seenArea=useRef(null),[unveil,setUnveil]=useState(0);
  useEffect(()=>{
    if(!launched)return;
    const previous=seenArea.current;seenArea.current=areaName;
    if(!areaName||previous)return;
    const stamp=Date.now();setUnveil(stamp);setTimeout(()=>setUnveil(value=>value===stamp?0:value),1600);
    const hostile=game.story?.introId==='hostile',fresh=!(game.playback?.length);
    cue('area',fresh?(hostile?{over:'Steel is drawn',title:areaName}:{over:'A new tale begins',title:game.story?.title??areaName,sub:game.story?areaName:null}):{over:game.story?.title??'The Lantern at the Crossroads',title:areaName});
  },[areaName,launched]);
  const hpRatio=inGame&&heroStats?.available?(health?.current??heroStats.hp)/Math.max(1,heroStats.hp):1;
  useEffect(()=>{setDanger(launched&&inGame&&hpRatio<=.3?1-hpRatio:0);},[launched,inGame,hpRatio]);
  // What a playtest note carries along automatically (the device is added by the feedback form itself).
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  const feedbackContext={hero:hero?hero.name+' (Level '+hero.level+' '+(hero.species??hero.race)+' '+hero.class+')':'',story:game.story?.title??'',screen,
    where:[game.story?.locations?.[['inn','bridge','tower'].includes(game.stage)?game.stage:'bridge']?.name,{combat:'in combat',victory:'after a victory',defeat:'after a defeat',escaped:'after retreating'}[game.stage]].filter(Boolean).join(', ')};
  // Only problems are worth showing away from Home; a routine "saved" line there is just noise.
  const saveProblem=!!saveStatus&&!/^(Adventure saved|Saving adventure)/.test(saveStatus);
  const home=screen==='Home'&&!inGame,wideHome=home&&windowWidth>=860&&windowHeight>=560;
  const homeNotice=(loading||!!storageError||saveProblem)&&<>{loading&&<Text style={s.note}>Loading saved character…</Text>}{!!storageError&&<Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}{saveProblem&&<Text accessibilityLiveRegion="polite" style={[s.saveStatus,{color:'#ffd49a'}]}>{saveStatus}</Text>}{saveStatus.startsWith('Adventure not saved')&&button('Retry adventure save',()=>setSaveRetry(value=>value+1))}</>;
  return <View dataSet={{qb:'root'}} style={s.root}>
  <View dataSet={{qb:'stage'}} style={[StyleSheet.absoluteFillObject,{pointerEvents:'none'}]}>
    {inGame?<DynamicArt subject={locationArtSubject(game)} style={StyleSheet.absoluteFillObject} quiet/>:<Image source={titleArt} dataSet={{qb:'backdrop'}} resizeMode="cover" style={StyleSheet.absoluteFillObject}/>}
    <View dataSet={{qb:inGame?'atmosphere-game':home?(wideHome?'atmosphere-home':'atmosphere-home-narrow'):'atmosphere'}} style={[StyleSheet.absoluteFillObject,{backgroundColor:inGame?'rgba(5,10,16,.35)':home?'rgba(6,8,12,.45)':'rgba(6,8,12,.72)'}]}/>
    {!inGame&&<View dataSet={{qb:'rays'}} style={StyleSheet.absoluteFillObject}/>}
    <View dataSet={{qb:'fog'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'vignette'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'embers'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'grain'}} style={StyleSheet.absoluteFillObject}/>
  </View>
  <EncounterProvider hero={hero} game={game} health={health}>
  <StatusBar style="light" />
  {playing?<View style={s.shell}>
    {/* In play: a fixed HUD and a play area that fills the rest of the screen. Nothing scrolls the page. */}
    <GameHud hero={hero} health={health} maxHp={heroStats.hp} wide={wideGame} onNavigate={openFromGame} levelUp={game.stage==='victory'&&hero.level<20} onLevelUp={()=>{setError('');setScreen('Level Up');}} feedback={feedbackContext}/>
    {(table.joined||!!storageError||!!saveProblem)&&<View style={[s.notices,compact&&{paddingHorizontal:8}]}>
      {!!storageError&&<Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
      {saveStatus.startsWith('Adventure not saved')?<Pressable accessibilityRole="button" onPress={()=>setSaveRetry(value=>value+1)}><Text style={s.tableNotice}>{saveStatus} Tap to retry.</Text></Pressable>:!!saveProblem&&<Text accessibilityRole="alert" style={s.tableNotice}>{saveStatus}</Text>}
      {table.joined&&<View dataSet={{qb:'plate'}} style={s.tableBar}><View style={s.tableRow}><Icon name="people" size={14} color="#9fe3d8"/><Text numberOfLines={1} style={[s.tableText,{flex:1}]}>Shared table · {table.players.length} {table.players.length===1?'player':'players'} {table.online?'':'· reconnecting…'}{table.otherActing?' · '+table.otherActing+' is taking a turn':''}</Text></View>{!!table.notice&&<Pressable accessibilityRole="button" onPress={table.clearNotice}><Text style={s.tableNotice}>{table.notice}  ✕</Text></Pressable>}{!!table.error&&<Text accessibilityRole="alert" style={s.tableNotice}>{table.error}</Text>}</View>}
    </View>}
    <View dataSet={{qb:shake?'shake':undefined}} style={[s.play,wideGame&&s.playWide,wideGame&&windowHeight<520&&{paddingTop:6,paddingBottom:6}]}>
      <Adventure layout={wideGame?'wide':'narrow'} levelUp={game.stage==='victory'&&hero.level<20} onLevelUp={()=>{setError('');setScreen('Level Up');}} table={table} hero={hero} game={game} setGame={setGame} health={health} setHealth={setHealth} onRestart={() => {setGame(newAdventure(hero,game));setHealth(null);}}/>
    </View>
  </View>:<View style={s.shell}>
    {/* Menus: a fixed top bar; only the framed content below scrolls, and short content is centred in the window. */}
    <View style={[s.topBar,compact&&{paddingHorizontal:12},home&&{minHeight:48}]}>
      {home?<View/>:inGame&&!['Level Up','Adventure'].includes(screen)?<Pressable accessibilityRole="button" accessibilityLabel="Back to the adventure" onPress={backToGame} dataSet={{qb:'chip'}} style={s.backChip}><Icon name="back" size={15} color={colors.gold}/><Text style={s.backChipText}>Adventure</Text></Pressable>:<Pressable accessibilityRole="button" accessibilityLabel="Main menu" onPress={()=>setScreen('Home')} style={s.brand}><View dataSet={{qb:'emblem'}} style={s.emblem}><Text dataSet={{qb:'title'}} style={s.emblemQ}>Q</Text></View>{windowWidth>=380&&<Text dataSet={{qb:'title'}} style={[s.logoSmall,compact&&{fontSize:17,letterSpacing:2}]}>Questbound</Text>}</Pressable>}
      <View style={s.controls}><FullscreenToggle compact/><AudioToggle compact/></View>
    </View>
  {home?<ScrollView ref={scrollRef} style={s.page} contentContainerStyle={{flexGrow:1}} keyboardShouldPersistTaps="handled">
    <HomeScreen hero={hero} game={game} health={health} saved={saved} disabled={loading||creatingStory} width={windowWidth} height={windowHeight} notice={homeNotice}
      onContinue={()=>{setNewStoryRequested(false);setReturnToGame(false);setScreen(characterChosen?'Adventure':'Character Selection');}}
      onNew={()=>{setNewStoryRequested(true);setError('');setScreen('Character Selection');}} onOpen={target=>setScreen(target)} onFeedback={()=>{playSound('open');setFeedbackOpen(true);}}/>
    <FeedbackSheet visible={feedbackOpen} onClose={()=>setFeedbackOpen(false)} context={feedbackContext}/>
  </ScrollView>:<ScrollView ref={scrollRef} style={s.page} contentContainerStyle={[s.content,gameScreen&&s.gameContent,compact&&{padding:12,paddingTop:4,paddingBottom:28},s.centred]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <View key={screen} dataSet={{qb:'enter'}}>
    <Panel variant={inGame?'glass':'panel'} style={[s.card,compact&&{padding:14}]}>{loading && <Text style={s.note}>Loading saved character…</Text>}{!!storageError && <Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
      {saveProblem&&<Text accessibilityLiveRegion="polite" style={[s.saveStatus,compact&&{marginBottom:10},{color:'#ffd49a'}]}>{saveStatus}</Text>}
      {saveStatus.startsWith('Adventure not saved') && button('Retry adventure save',()=>setSaveRetry(value=>value+1))}
        {table.joined && <View dataSet={{qb:'plate'}} style={s.tableBar}><View style={s.tableRow}><Icon name="people" size={14} color="#9fe3d8"/><Text style={[s.tableText,{flex:1}]}>Shared table · {table.players.length} {table.players.length===1?'player':'players'} {table.online?'':'· reconnecting…'}{table.otherActing?' · '+table.otherActing+' is taking a turn':''}</Text></View>{!!table.notice&&<Pressable accessibilityRole="button" onPress={table.clearNotice}><Text style={s.tableNotice}>{table.notice}  ✕</Text></Pressable>}{!!table.error&&<Text accessibilityRole="alert" style={s.tableNotice}>{table.error}</Text>}</View>}
      {!!titles[screen]&&<ScreenTitle eyebrow={titles[screen][0]} icon={titles[screen][2]} title={titles[screen][1]}/>}
      {screen === 'Character Selection' && <>
        {hero ? <>
          <View dataSet={{qb:'plate'}} style={[s.heroCard,compact&&{padding:14,gap:14}]}>
            <HeroPortrait hero={hero} size={compact?54:68} level={hero.level}/>
            <View style={{flex:1,minWidth:0}}>
              <Eyebrow>Your hero</Eyebrow>
              <Text numberOfLines={1} style={[s.heroName,compact&&{fontSize:23}]}>{hero.name}</Text>
              <Text style={s.heroLine}>Level {hero.level} · {hero.species ?? hero.race} · {hero.class}</Text>
              {!!hero.background && <Text style={s.heroBackground}>{hero.background}</Text>}
            </View>
          </View>
          {newStoryRequested&&<Text style={s.note}>{characterChosen?'A fresh story will be created for this character. It replaces your current adventure only when it is ready and saved.':'Next, choose where your story begins.'}</Text>}
          {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <GameButton icon="play" label={creatingStory?'Creating your new adventure…':'Play as '+hero.name} onPress={playCharacter} variant="primary" disabled={loading||creatingStory}/>
          <GameButton icon="quill" label="Edit character" onPress={() => {setForm({...blankBuild(),...hero,species:hero.species ?? hero.race}); setError(''); setScreen('Character Creation');}} disabled={loading||creatingStory}/>
        </> : <>
          <Section icon="spell" title="Quick start" style={{marginTop:0}}/>
          <Text style={s.body}>Pick a ready-made hero and you'll be choosing your adventure in seconds.</Text>
          <QuickHeroes onChoose={useReadyHero} disabled={saving||loading}/>
          {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <Section icon="quill" title="Or make your own"/>
        </>}
        <GameButton icon="sheet" label="Create new character" onPress={() => {setForm(blankBuild()); setError(''); setScreen('Character Creation');}} disabled={loading||creatingStory}/>
        {!!hero&&(showReady?<><Text style={[s.note,{marginTop:14}]}>Playing a ready-made hero replaces {hero.name} and the current adventure (a backup is kept under Multiplayer).</Text><QuickHeroes replacing={hero.name} onChoose={useReadyHero} disabled={saving||loading}/></>:<GameButton icon="spell" label="Try a ready-made hero" onPress={()=>setShowReady(true)} disabled={loading||creatingStory}/>)}
      </>}
      {screen === 'Adventure Opening' && hero && <AdventureIntros selected={selectedIntro} onSelect={setSelectedIntro} onStart={()=>playCharacter(true)} busy={creatingStory} error={error}/>}
      {screen === 'Character Creation' && !loading && <CharacterBuilder form={form} setForm={setForm} onSave={saveHero} saving={saving} blocked={!!storageError} saveError={error} hasSavedCharacter={!!hero} onPageChange={() => scrollRef.current?.scrollTo({y:0,animated:false})}/>}
      {screen === 'Level Up' && hero && <Advancement hero={hero} onSave={saveAdvancement} onCancel={()=>setScreen('Adventure')} saving={saving} error={error}/>}
      {screen === 'Character Sheet' && hero && <CharacterSheet setGame={setGame} hero={hero} game={game} health={health} setHealth={setHealth} healthLocked={game.stage !== 'inn'||!!game.npcCombat?.active} onBack={() => {setScreen('Adventure'); scrollRef.current?.scrollTo({y:0,animated:false});}}/>}
      {screen === 'Campaign Journal' && hero && <CampaignJournal game={game} blocked={loading || !!storageError || adventureBlocked} onAddNote={text=>setGame(current=>addJournalNote(current,text))} onBack={()=>{setScreen('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});}}/>}
      {screen === 'Followers' && hero && <Followers game={game} setGame={setGame} onBack={()=>setScreen('Adventure')}/>}
      {screen === 'Dice Roller' && <DiceRoller/>}
      {screen === 'Adventure' && <>
        {characterChosen && heroStats?.available && <View dataSet={{qb:'plate'}} style={s.hud}>
          <View style={s.hudIdentity}>
            <EntityText style={s.hudName}>{hero.name}</EntityText>
            <Text style={s.hudClass}>Level {hero.level} · {hero.species ?? hero.race} · {hero.class}</Text>
          </View>
          <View style={s.hudVitals}>
            <View style={s.hudRow}><Text style={s.hudLabel}>HIT POINTS</Text><Text style={s.hudValue}>{health?.current ?? heroStats.hp}<Text style={s.hudMax}> / {heroStats.hp}</Text>{(health?.temp??0)>0?<Text style={s.hudTemp}>  +{health.temp} temp</Text>:null}</Text></View>
            <StatBar value={health?.current ?? heroStats.hp} maximum={heroStats.hp} height={9}/>
          </View>
        </View>}
        {characterChosen && hero && <View style={s.quickTabs}>{[['Journal','Campaign Journal','❦'],['Character Sheet','Character Sheet','⚔'],['Followers','Followers','♞']].map(([label,target,glyph])=><Pressable key={target} accessibilityRole="button" accessibilityLabel={'Open '+label.toLowerCase()} dataSet={{qb:'chip'}} onPress={()=>{setScreen(target);scrollRef.current?.scrollTo({y:0,animated:false});}} style={s.quickTab}><Text style={s.quickTabText}><Text style={s.quickGlyph}>{glyph}</Text>  {label}</Text></Pressable>)}<CombatHealthButton/></View>}
        {characterChosen && hero && game.stage==='victory' && hero.level<20 && button('✦ Review earned level-up',()=>{setError('');setScreen('Level Up');scrollRef.current?.scrollTo({y:0,animated:false});},'primary')}

        {characterChosen && hero && <Adventure table={table} hero={hero} game={game} setGame={setGame} health={health} setHealth={setHealth} onRestart={() => {setGame(newAdventure(hero,game));setHealth(null);scrollRef.current?.scrollTo({y:0,animated:false});}}/>}
      </>}
      {screen === 'Multiplayer' && <SharedTable table={table} hero={hero} characterChosen={characterChosen} onPlay={()=>{setNewStoryRequested(false);setScreen(characterChosen?'Adventure':'Character Selection');}}/>}
      {screen === 'Settings' && <DisplaySettings/>}
      {screen === 'Settings' && <AudioSettings/>}
      {screen === 'Settings' && <SaveTransfer/>}
      {screen === 'Settings' && <View style={s.about}><Section icon="info" title="About" style={{marginTop:0}}/><Text style={s.aboutText}>Questbound Early Access 0.1. Your character, adventure progress, HP and supplies are saved on this device; Continue resumes your quest. The Dungeon Master runs on your privately configured AI service.</Text><Text style={s.aboutText}>This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.</Text></View>}
      {/* Screens inside the adventure have their own way back; Settings opened from the game returns there. */}
      {screen === 'Character Creation' ? <GameButton icon="back" label="Back to heroes" onPress={() => setScreen('Character Selection')} disabled={loading||creatingStory}/> : screen==='Settings'&&returnToGame&&saved ? <GameButton icon="back" label="Back to the adventure" onPress={backToGame} variant="primary"/> : screen !== 'Home' && !(gameScreen&&screen!=='Adventure') && screen!=='Level Up' && <GameButton icon="back" label="Main menu" onPress={() => setScreen('Home')} disabled={loading||creatingStory}/>}
    </Panel>
    </View>
  </ScrollView>}</View>}
  </EncounterProvider>
  {!!unveil&&<View key={unveil} dataSet={{qb:'unveil'}} style={[StyleSheet.absoluteFillObject,{pointerEvents:'none',zIndex:55}]}/>}
  <CinematicLayer levelReady={inGame&&game.stage==='victory'&&!!hero&&hero.level<20}/>
  {creatingStory&&selectedIntro!=='hostile'&&<StoryLoading introId={selectedIntro}/>}
  {!launched&&<LaunchScreen ready={!loading} onBegin={()=>setLaunched(true)}/>}
  </View>;
}
const s = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.ink,overflow:'hidden'},controls:{flexDirection:'row',gap:8,flexShrink:0},gameContent:{maxWidth:1120},
  topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,minHeight:52,paddingHorizontal:20,paddingVertical:8},
  shell:{flex:1,minHeight:0},play:{flex:1,minHeight:0,paddingHorizontal:0,paddingTop:6},playWide:{paddingHorizontal:16,paddingTop:14,paddingBottom:14,width:'100%',maxWidth:1500,alignSelf:'center'},
  notices:{paddingHorizontal:16,paddingTop:6,gap:6},centred:{flexGrow:1,justifyContent:'center'},
  homeRow:{flexDirection:'row',alignItems:'center',gap:32},
  denseButton:{minHeight:42,paddingVertical:9,marginTop:6},denseCell:{minHeight:40,paddingVertical:8},
  page:{flex:1,backgroundColor:'transparent'},
  content:{padding:24,paddingTop:18,paddingBottom:48,width:'100%',maxWidth:760,alignSelf:'center'},
  hero:{alignItems:'center',paddingTop:28,paddingBottom:34},
  heroEyebrow:{marginBottom:18,textAlign:'center'},
  logo:{fontFamily:fonts.logo,fontSize:76,fontWeight:'900',letterSpacing:6,color:colors.gold,textAlign:'center',lineHeight:92},
  heroRule:{width:'72%',maxWidth:380,alignSelf:'center',marginVertical:12},
  tagline:{fontFamily:fonts.story,fontStyle:'italic',fontSize:21,color:'#e9dcbd',textAlign:'center',letterSpacing:.5},
  header:{alignItems:'center',marginBottom:22},
    logoMedium:{fontFamily:fonts.logo,fontSize:40,fontWeight:'900',letterSpacing:4,color:colors.gold,textAlign:'center'},
  logoSmall:{fontFamily:fonts.logo,fontSize:24,fontWeight:'900',letterSpacing:3,color:colors.gold},
  headerRule:{width:'60%',maxWidth:300,alignSelf:'center',marginVertical:8},
  card:{padding:28},
  heading:{...type.heading,fontSize:26,marginBottom:16},
  homeHeading:{textAlign:'center',fontSize:22,letterSpacing:3,textTransform:'uppercase',color:colors.gold},
  center:{textAlign:'center'},
  body:{...type.body,fontSize:16,lineHeight:26,marginBottom:18},
  menuGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  menuCell:{flexGrow:1,flexBasis:'45%',marginTop:0,minHeight:48},
  menuCellText:{fontSize:12,letterSpacing:1.6},
  heroCard:{flexDirection:'row',alignItems:'center',gap:20,padding:20,borderWidth:1,borderColor:colors.goldLine,borderRadius:6,marginBottom:16},
  heroName:{fontFamily:fonts.display,fontSize:28,fontWeight:'700',color:colors.parchment,letterSpacing:1,marginTop:4},
  heroLine:{fontFamily:fonts.ui,fontSize:14,color:colors.gold,letterSpacing:.5},
  heroBackground:{fontFamily:fonts.story,fontStyle:'italic',fontSize:16,color:colors.muted,marginTop:4},
  hud:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:18,padding:16,borderWidth:1,borderColor:colors.goldLine,borderRadius:4,marginBottom:12},
  hudIdentity:{flexGrow:1,flexShrink:1,minWidth:170},
  hudName:{fontFamily:fonts.display,fontSize:22,fontWeight:'700',color:colors.parchment,letterSpacing:1},
  hudClass:{fontFamily:fonts.ui,fontSize:12,color:colors.gold,letterSpacing:.6,marginTop:3},
  hudVitals:{flexGrow:2,flexBasis:220,gap:6},
  hudRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'},
  hudLabel:{...type.label},
  hudValue:{fontFamily:fonts.display,fontSize:18,fontWeight:'700',color:colors.parchment},
  hudMax:{fontSize:13,color:colors.muted,fontWeight:'400'},
  hudTemp:{fontSize:12,color:colors.arcane},
  quickTabs:{flexDirection:'row',gap:8,marginBottom:8,flexWrap:'wrap'},
  quickTab:{flexGrow:1,alignItems:'center',paddingHorizontal:14,paddingVertical:10,minHeight:44,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.4)',backgroundColor:'rgba(20,25,36,.9)',justifyContent:'center'},
  quickTabText:{fontFamily:fonts.display,color:'#ecdcb8',fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
  quickGlyph:{color:colors.gold},
  tableRow:{flexDirection:'row',alignItems:'center',gap:8},tableBar:{padding:12,borderRadius:6,borderWidth:1,borderColor:'rgba(111,208,196,.35)',marginBottom:10,gap:6},tableText:{fontFamily:fonts.display,color:'#9fe3d8',fontSize:12,fontWeight:'700',letterSpacing:1.2},tableNotice:{fontFamily:fonts.ui,color:'#ffd49a',fontSize:13,lineHeight:19},
  saveStatus:{fontFamily:fonts.ui,color:colors.goldMid,fontSize:12,letterSpacing:.4,marginBottom:16},
  error:{color:colors.danger,marginTop:16,lineHeight:22,fontFamily:fonts.ui},
  note:{fontFamily:fonts.ui,color:'#d9bd84',fontSize:13,lineHeight:20,marginBottom:18},
  footer:{fontFamily:fonts.display,color:'rgba(201,164,92,.55)',fontSize:10,letterSpacing:2.4,textAlign:'center',marginTop:30},
  quickEyebrow:{marginTop:4,marginBottom:10},
  feedbackLink:{alignSelf:'center',marginTop:12,minHeight:44,paddingHorizontal:12,justifyContent:'center'},feedbackText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},
  about:{gap:8,paddingTop:16,marginBottom:6,borderTopWidth:1,borderTopColor:'rgba(201,164,92,.2)'},aboutText:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:19},
  backChip:{flexDirection:'row',alignItems:'center',gap:6,minHeight:40,paddingLeft:10,paddingRight:16,borderRadius:20,borderWidth:1,borderColor:'rgba(201,164,92,.45)',backgroundColor:'rgba(12,16,24,.8)',justifyContent:'center'},
  brand:{flexDirection:'row',alignItems:'center',gap:10,minHeight:44},emblem:{width:34,height:34,borderRadius:17,borderWidth:1.5,borderColor:colors.gold,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(12,10,6,.7)'},emblemQ:{fontFamily:fonts.logo,fontSize:19,fontWeight:'900',color:colors.gold,marginTop:-2},backChipText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
});







