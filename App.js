import AdventureIntros from './AdventureIntros';
import {findDmEndpoint,writeStory} from './dmConnection';
import Followers from './Followers';
import DiceRoller from './DiceRoller';
import SceneTransitionProvider,{useSceneTransition} from './SceneTransition';
import {sceneArtSubjects,npcArtSubject} from './worldArtRules';
import {usePageWheel} from './usePageWheel';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import EncounterProvider,{CombatHealthButton,EntityText} from './EncounterOverlay';
import {freshStoryGame,levelUpReady,foeForLevel} from './storyRules';
import {hostileEncounterGame} from './hostileEncounter';
import CampaignJournal from './CampaignJournal';
import {addJournalNote,appendJournal,appendStoryLog} from './journalRules';
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
import {fonts,colors,type,tint} from './theme';
import {setMood,setAmbience,setDanger,playSound} from './audio';
import HomeScreen,{homeLayout,titleArt} from './HomeScreen';
import Icon from './Icon';
import {classIcons} from './iconPaths';
import HeroPortrait from './HeroPortrait';
import CinematicLayer from './CinematicLayer';
import StoryLoading from './StoryLoading';
import {shortcutsBlocked} from './keyboard';
import {cue,useCue} from './cinematics';
import {withDeeds,deedById} from './deedRules';
// Page headings: overline, title and icon for the screens that have one.
const titles={'Legal':['Questbound','Privacy and terms','info'],'Character Selection':['Heroes','Choose your hero','sheet'],'Dice Roller':['Tabletop','Roll the dice','d20'],'Settings':['Options','Settings','settings'],'Level Up':['A level earned','Level up','star']};
import {AudioToggle,AudioSettings} from './AudioControls';
import {FullscreenToggle,DisplaySettings} from './DisplayControls';
import {StorySettings} from './StoryControls';
import {ThemeSettings} from './ThemeControls';
import Legal from './Legal';
import {placeName,mapLocation} from './mapRules';
import {displayState} from './fullscreen';
import GameHud from './GameHud';
import LaunchScreen from './LaunchScreen';
import Agreement from './Agreement';
import {agreementStatus,acceptAgreement} from './agreementRules';
import SaveTransfer from './SaveTransfer';
import QuickHeroes from './QuickHeroes';
import HeroRoster from './HeroRoster';
import {scheduleCloudSave} from './cloudRules';
import {CloudSaveSettings} from './CloudSaveSettings';
import {AccountSettings} from './AccountSettings';
import {accountState} from './accountRules';
import {loadRoster,loadGraveyard,setAside,saveLists,restoreEntry} from './rosterRules';
import {carriedBase,joinRegion,canContinueRegion,regionSummary,sequelBearings} from './sequelRules';
import FeedbackSheet from './Feedback';
import {useVisualViewport} from './webLayout';
// The title paintings: four heroes against a lich, wide for a computer or a phone on its side (dark on the left,
// where the menu sits) and tall for an upright phone (see assets/title/ART-NOTES.md).
const titleWide=require('./assets/title/questbound-title-wide.jpg'),titleTall=require('./assets/title/questbound-title-tall.jpg');

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
  // Whether the player is signed in to an account (their adventure is then also kept on the host's PC).
  const [account,setAccount]=useState(null);
  // Which legal page is open (privacy, terms or licences), and where it was opened from.
  const [legalTab,setLegalTab]=useState('privacy'),[legalFrom,setLegalFrom]=useState('Home');
  const openLegal=(tab,from)=>{setLegalTab(tab);setLegalFrom(from);setScreenState('Legal');scrollRef.current?.scrollTo({y:0,animated:false});};
  useEffect(()=>{accountState().then(setAccount).catch(()=>{});},[]);
  const [saveRetry,setSaveRetry] = useState(0);
  // Heroes set aside on this device and the fallen; a new story can carry on in the same region.
  const [roster,setRoster]=useState([]),[graves,setGraves]=useState([]),[editingHero,setEditingHero]=useState(false),[continueRegion,setContinueRegion]=useState(true);
  useEffect(()=>{Promise.all([loadRoster(),loadGraveyard()]).then(([r,g])=>{setRoster(r);setGraves(g);}).catch(()=>{});},[]);
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
    const snapshot=adventureSnapshot(hero,game,health,characterChosen);
    saveAdventure(snapshot,hero)
      .then(()=>{scheduleCloudSave(snapshot);if(current)setSaveStatus('Adventure saved on this device.');})
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
  // The saved adventure is this hero's: if it ended in death, the hero cannot be played again.
  const heroFallen=!!hero&&characterChosen&&game.stage==='dead';
  const canContinue=!!hero&&characterChosen&&!heroFallen&&canContinueRegion(game),continuingNow=continueRegion&&canContinue;
  // Before another hero takes this one's place: the living wait in the roster, the dead go to the graveyard.
  async function setCurrentAside(){
    if(!hero)return true;
    const next=setAside(roster,graves,hero,game,health,characterChosen);
    if(next.error){setError(next.error);return false;}
    await saveLists(next);setRoster(next.roster);setGraves(next.graves);return true;
  }
  async function playFromRoster(entry){
    if(saving||loading||storageError||creatingStory)return;
    setSaving(true);setError('');
    try{
      const restored=restoreEntry(entry),aside=setAside(roster.filter(e=>e.id!==entry.id),graves,hero,game,health,characterChosen);
      if(aside.error)throw Error(aside.error);
      // The current hero is set aside first and the chosen one leaves the roster last, so nobody is lost midway.
      await saveLists({roster:[...aside.roster,entry],graves:aside.graves});
      await saveCharacter(restored.hero);await saveAdventure({version:1,character:entry.character,game:restored.game,health:restored.health,chosen:restored.chosen},restored.hero);
      await saveLists(aside);setRoster(aside.roster);setGraves(aside.graves);
      setHero(restored.hero);setForm({...blankBuild(),...restored.hero,species:restored.hero.species??restored.hero.race});setGame(restored.game);setHealth(restored.health);setCharacterChosen(restored.chosen);setNewStoryRequested(!restored.chosen);setAdventureBlocked(false);
      setScreenState('Home');
    }catch(e){setError(e.message||'Could not switch heroes. Your current hero is unchanged.');}
    finally{setSaving(false);}
  }
  // A hero brought over from another device by its recovery code; the current one is set aside first.
  async function restoreFromCloud(snapshot){
    let restored;try{restored=JSON.parse(snapshot?.character);}catch{throw Error('That save could not be read. Nothing was changed.');}
    if(!isValidCharacter(restored)||!validAdventure(snapshot,restored))throw Error('That save did not pass the game\'s checks. Nothing was changed.');
    if(hero&&JSON.stringify(hero)!==snapshot.character&&!await setCurrentAside())throw Error('Your company is full. Retire a hero under Heroes first.');
    await saveCharacter(restored);await saveAdventure(snapshot,restored);
    setHero(restored);setForm({...blankBuild(),...restored,species:restored.species??restored.race});setGame(snapshot.game);setHealth(snapshot.health);setCharacterChosen(snapshot.chosen);setNewStoryRequested(!snapshot.chosen);setAdventureBlocked(false);
  }
  async function retireFromRoster(entry){
    const next={roster:roster.filter(e=>e.id!==entry.id),graves};
    try{await saveLists(next);setRoster(next.roster);}catch{setError('Could not update your roster. Try again.');}
  }
  async function playCharacter(begin=false){
    if(storyLock.current||loading||storageError||adventureBlocked||!hero||heroFallen)return;
    if(!newStoryRequested){setCharacterChosen(true);setScreen('Adventure');return;}
    if(begin!==true){setScreen('Adventure Opening');scrollRef.current?.scrollTo({y:0,animated:false});return;}
    storyLock.current=true;setCreatingStory(true);setError('');
    try{
      let next;
      // The next chapter in the same region: the story writer is told what the hero leaves behind, and the old
      // region joins the new map a few miles away.
      const continuing=continuingNow,bearing=sequelBearings[Math.floor(Math.random()*sequelBearings.length)],miles=4+Math.round(Math.random()*30)/10;
      const base=newAdventure(hero,characterChosen?carriedBase(game):undefined);
      if(selectedIntro==='hostile'&&!continuing)next=hostileEncounterGame(hero,base);
      else{
      const endpoint=await findDmEndpoint();
      const {ok,body}=await writeStory(endpoint,{input:continuing?'Create the next chapter of my character\'s journey in the same region.':'Create a fresh adventure for my character.',context:{mode:'adventure',introId:continuing?'surprise':selectedIntro,...(continuing?{continuing:regionSummary(game,bearing)}:{}),choices:[],player:{name:hero.name,species:hero.species??hero.race,class:hero.class,level:hero.level,background:hero.background,backstory:hero.backstory},previousStory:game.story?{title:game.story.title,premise:game.story.premise}:null,previousTitles:game.storyHistory??[],variation:Date.now()+'-'+Math.random()}});
      if(!ok)throw Error(body.error||'The story could not be created.');
      next=freshStoryGame(hero,{...body.story,introId:continuing?'surprise':selectedIntro},base);
      if([...(game.storyHistory??[]),game.story?.title].filter(Boolean).some(title=>title.toLowerCase()===next.story.title.toLowerCase()))throw Error('The DM repeated the previous story. Try again; your adventure is unchanged.');
      }
      if(characterChosen&&game.story)next=joinRegion(next,game,{sameRegion:continuing,bearing,miles});
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
      if (hero && !editingHero && !await setCurrentAside()) return;
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
      if (hero && !await setCurrentAside()) return;
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
    if(saving || storageError || !hero || !levelUpReady(game,hero) || character.level!==hero.level+1 || character.class!==hero.class)return;
    setSaving(true);setError('');
    // A level earned on the road (a long tale gives one every second chapter) is taken where the hero stands: rested
    // as after a night's sleep, everything else untouched, and a main foe not yet met grows to match. A level won by
    // beating the main foe is taken as before, back at the starting place.
    if(game.stage!=='victory'){
      try{
        let advanced={...game,encounterLevel:character.level,levelsOwed:Math.max(0,(game.levelsOwed??1)-1),round:1};
        for(const key of ['resources','spellSlotsUsed','arcanumUsed','shortRests','concentration','temporarySpell','enemyEffects','bonusUsed','slotSpentThisTurn','reactionUsed','actionUsed','dodging','castingConditions','heroCondition','foeTricks'])delete advanced[key];
        if(!advanced.levelsOwed)delete advanced.levelsOwed;
        advanced=foeForLevel(advanced,character.level);
        advanced.journal=appendJournal(advanced.journal??game.journal,'level','Level gained',`${character.name} reached level ${character.level}.`);advanced.storyLog=appendStoryLog(game.storyLog,'level',`${character.name} reached level ${character.level}.`);
        await saveCharacter(character);const marked=withDeeds(advanced,character);setHero(character);setForm(character);setGame(marked.game);setHealth(null);setScreenState('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});cue('levelup',{level:character.level,sub:character.name+' is now a level '+character.level+' '+character.class+', rested and ready.'});marked.fresh.forEach((id,i)=>setTimeout(()=>cue('deed',{deed:deedById(id)}),4200+i*4400));
      }catch{setError('Could not save your level-up. Your previous character is still saved. Retry when ready.');}
      finally{setSaving(false);}
      return;
    }
    try {const advanced=newAdventure(character,game);if(game.story){advanced.story=game.story;advanced.storyHistory=game.storyHistory;advanced.enemyHP=Math.min(game.enemyHP,advanced.enemyHP,game.story.foeStats?.maximum??Infinity);advanced.firedTriggers=game.firedTriggers;if(game.foeFate)advanced.foeFate=game.foeFate;if(game.npcFate)advanced.npcFate=game.npcFate;if(game.world)advanced.world={...game.world,at:null};if(game.people)advanced.people=game.people;advanced.map={...advanced.map,accepted:true,visited:[...new Set(['inn',...(game.map?.visited??[]).filter(id=>['inn','bridge','tower'].includes(id)||game.world?.places?.some(p=>p.id===id))])],minutes:game.map?.minutes??0};}advanced.journal=appendJournal(advanced.journal,'level','Level gained',`${character.name} reached level ${character.level}.`);advanced.storyLog=appendStoryLog(game.storyLog,'level',`${character.name} reached level ${character.level}.`);if(game.wield)advanced.wield=game.wield;await transition.prepare(sceneArtSubjects(advanced));await saveCharacter(character);const marked=withDeeds(advanced,character);setHero(character);setForm(character);setGame(marked.game);setHealth(null);setScreenState('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});cue('levelup',{level:character.level,sub:character.name+' is now a level '+character.level+' '+character.class+', rested and ready.'});marked.fresh.forEach((id,i)=>setTimeout(()=>cue('deed',{deed:deedById(id)}),4200+i*4400));}
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
  // The permissions agreement is asked once per browser, after the launch screen and before anything else.
  const [agreed,setAgreed]=useState(()=>agreementStatus().accepted);
  // A blow against the hero shakes the play area for a moment.
  const [shake,setShake]=useState(0);
  useCue(useCallback(event=>{if(event.kind==='hurt'&&displayState().screenEffects){setShake(event.id);setTimeout(()=>setShake(value=>value===event.id?0:value),450);}},[]));
  const playing=screen==='Adventure'&&characterChosen&&!!hero&&!!heroStats?.available;
  // A phone's keyboard leaves little height: the play screen says when the player is typing.
  const [typingPlay,setTypingPlay]=useState(false),visibleHeight=useVisualViewport().height||windowHeight;
  // Side-by-side play on large screens and on any landscape screen (a phone on its side has height for one column only).
  const wideGame=windowWidth>=960||(windowWidth>=560&&windowWidth>windowHeight*1.25);
  // Shelter (camp or inn, and after a fight ends) gets the warm haven theme; the road and ruins get the exploration theme.
  const sheltered=['inn','defeat','escaped','victory'].includes(game.stage)&&!game.dungeon?.active;
  // At death the score falls silent.
  const dead=inGame&&game.stage==='dead';
  useEffect(()=>{setMood(!launched||dead?'silence':inGame?(fighting?'combat':sheltered?'haven':'explore'):'menu');},[launched,inGame,fighting,sheltered,dead]);
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
  useEffect(()=>{setDanger(launched&&inGame&&!dead&&hpRatio<=.3?1-hpRatio:0);},[launched,inGame,hpRatio,dead]);
  // What a playtest note carries along automatically (the device is added by the feedback form itself).
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  const feedbackContext={hero:hero?hero.name+' (Level '+hero.level+' '+(hero.species??hero.race)+' '+hero.class+')':'',story:game.story?.title??'',screen,
    where:[game.story?placeName(game,mapLocation(game)):null,{combat:'in combat',victory:'after a victory',defeat:'after a defeat',escaped:'after retreating',dying:'while dying',dead:'after dying'}[game.stage]].filter(Boolean).join(', ')};
  // Only problems are worth showing away from Home; a routine "saved" line there is just noise.
  const saveProblem=!!saveStatus&&!/^(Adventure saved|Saving adventure)/.test(saveStatus);
  // The title screen's shape decides which painting is shown and how it is framed (see titleArt).
  const homeShape=homeLayout(windowWidth,windowHeight),art=titleArt(windowWidth,windowHeight,{protect:saved&&!account});
  const home=screen==='Home'&&!inGame,wideHome=home&&homeShape.wide;
  useEffect(()=>{if(typeof document==='undefined')return;const set=(name,value)=>document.documentElement.style.setProperty('--qb-title-'+name,value+'px');set('top',art.top);set('size',art.size);set('edge',art.edge);set('fade',art.fade);},[art.top,art.size,art.edge,art.fade]);
  const homeNotice=(loading||!!storageError||saveProblem)&&<>{loading&&<Text style={s.note}>Loading saved character…</Text>}{!!storageError&&<Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}{saveProblem&&<Text accessibilityLiveRegion="polite" style={[s.saveStatus,{color:'#ffd49a'}]}>{saveStatus}</Text>}{saveStatus.startsWith('Adventure not saved')&&button('Retry adventure save',()=>setSaveRetry(value=>value+1))}</>;
  return <View dataSet={{qb:'root'}} style={s.root}>
  <View dataSet={{qb:'stage'}} style={[StyleSheet.absoluteFillObject,{pointerEvents:'none'}]}>
    {inGame?<DynamicArt subject={locationArtSubject(game)} style={StyleSheet.absoluteFillObject} quiet/>:<Image key={art.frame==='tall'?'tall':'wide'} source={art.frame==='tall'?titleTall:titleWide} dataSet={{qb:'backdrop',frame:art.frame}} resizeMode="cover" style={s.backdrop}/>}
    <View dataSet={{qb:inGame?'atmosphere-game':home?(wideHome?'atmosphere-home':'atmosphere-home-narrow'):'atmosphere'}} style={[StyleSheet.absoluteFillObject,{backgroundColor:inGame?tint('rgba(13,7,14,.35)'):home?tint('rgba(10,7,11,.45)'):tint('rgba(10,7,11,.72)')}]}/>
    {!inGame&&<View dataSet={{qb:'rays'}} style={StyleSheet.absoluteFillObject}/>}
    <View dataSet={{qb:'fog'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'vignette',home:home?'on':'off'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'embers'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'grain'}} style={StyleSheet.absoluteFillObject}/>
  </View>
  <EncounterProvider hero={hero} game={game} health={health}>
  <StatusBar style="light" />
  {playing?<View style={s.shell}>
    {/* In play: a fixed HUD and a play area that fills the rest of the screen. Nothing scrolls the page. While the
        player types on a small phone, the HUD gives its row to the story too. */}
    <View style={[{zIndex:5},typingPlay&&visibleHeight<430&&{display:'none'}]}><GameHud hero={hero} health={health} maxHp={heroStats.hp} wide={wideGame} onNavigate={openFromGame} levelUp={levelUpReady(game,hero)} onLevelUp={()=>{setError('');setScreen('Level Up');}} feedback={feedbackContext}/></View>
    {(table.joined||!!storageError||!!saveProblem)&&<View style={[s.notices,compact&&{paddingHorizontal:8}]}>
      {!!storageError&&<Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
      {saveStatus.startsWith('Adventure not saved')?<Pressable accessibilityRole="button" onPress={()=>setSaveRetry(value=>value+1)}><Text style={s.tableNotice}>{saveStatus} Tap to retry.</Text></Pressable>:!!saveProblem&&<Text accessibilityRole="alert" style={s.tableNotice}>{saveStatus}</Text>}
      {table.joined&&<View dataSet={{qb:'plate'}} style={s.tableBar}><View style={s.tableRow}><Icon name="people" size={14} color="#9fe3d8"/><Text numberOfLines={1} style={[s.tableText,{flex:1}]}>Shared table · {table.players.length} {table.players.length===1?'player':'players'} {table.online?'':'· reconnecting…'}{table.otherActing?' · '+table.otherActing+' is taking a turn':''}</Text></View>{!!table.notice&&<Pressable accessibilityRole="button" onPress={table.clearNotice}><Text style={s.tableNotice}>{table.notice}  ✕</Text></Pressable>}{!!table.error&&<Text accessibilityRole="alert" style={s.tableNotice}>{table.error}</Text>}</View>}
    </View>}
    <View dataSet={{qb:shake?'shake':undefined}} style={[s.play,wideGame&&s.playWide,wideGame&&windowHeight<520&&{paddingTop:6,paddingBottom:6}]}>
      <Adventure onTyping={setTypingPlay} layout={wideGame?'wide':'narrow'} levelUp={levelUpReady(game,hero)} onLevelUp={()=>{setError('');setScreen('Level Up');}} onNewHero={()=>{setError('');setNewStoryRequested(true);setScreenState('Character Selection');}} table={table} hero={hero} game={game} setGame={setGame} health={health} setHealth={setHealth} onRestart={() => {setGame(newAdventure(hero,game));setHealth(null);}}/>
    </View>
  </View>:<View style={s.shell}>
    {/* Menus: a fixed top bar; only the framed content below scrolls, and short content is centred in the window. */}
    <View style={[s.topBar,compact&&{paddingHorizontal:12},home&&{minHeight:48}]}>
      {home?<View/>:inGame&&!['Level Up','Adventure'].includes(screen)?<Pressable accessibilityRole="button" accessibilityLabel="Back to the adventure" onPress={backToGame} dataSet={{qb:'chip'}} style={s.backChip}><Icon name="back" size={15} color={colors.gold}/><Text style={s.backChipText}>Adventure</Text></Pressable>:<Pressable accessibilityRole="button" accessibilityLabel="Main menu" onPress={()=>setScreen('Home')} style={s.brand}><View dataSet={{qb:'emblem'}} style={s.emblem}><Text dataSet={{qb:'title'}} style={s.emblemQ}>Q</Text></View>{windowWidth>=380&&<Text dataSet={{qb:'title'}} style={[s.logoSmall,compact&&{fontSize:17,letterSpacing:2}]}>Questbound</Text>}</Pressable>}
      <View style={s.controls}><FullscreenToggle compact/><AudioToggle compact/></View>
    </View>
  {home?<ScrollView ref={scrollRef} style={s.page} contentContainerStyle={{flexGrow:1}} keyboardShouldPersistTaps="handled">
    <HomeScreen hero={hero} game={game} health={health} saved={saved} unprotected={saved&&!account} onLegal={tab=>openLegal(tab,'Home')} disabled={loading||creatingStory} width={windowWidth} height={windowHeight} notice={homeNotice}
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
        {hero && heroFallen ? <>
          {/* A hero who died stays dead: their card becomes a memorial, and the way on is a new hero. */}
          <View dataSet={{qb:'plate'}} style={[s.heroCard,compact&&{padding:14,gap:14},{opacity:.85}]}>
            <HeroPortrait hero={hero} size={compact?54:68} level={hero.level}/>
            <View style={{flex:1,minWidth:0}}>
              <Eyebrow style={{color:colors.bloodBright}}>Fallen</Eyebrow>
              <Text numberOfLines={1} style={[s.heroName,compact&&{fontSize:23}]}>{hero.name}</Text>
              <Text style={s.heroLine}>Level {hero.level} · {hero.species ?? hero.race} · {hero.class}</Text>
              <Text style={s.heroBackground}>{game.death.cause}{game.death.place?' at '+game.death.place:''}.</Text>
            </View>
          </View>
          <Text style={s.note}>{hero.name}'s story is over. Choose a ready-made hero or make a new one to begin again.</Text>
          {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <QuickHeroes replacing={hero.name} onChoose={useReadyHero} disabled={saving||loading}/>
        </> : hero ? <>
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
          <GameButton icon="quill" label="Edit character" onPress={() => {setEditingHero(true); setForm({...blankBuild(),...hero,species:hero.species ?? hero.race}); setError(''); setScreen('Character Creation');}} disabled={loading||creatingStory}/>
        </> : <>
          <Section icon="spell" title="Quick start" style={{marginTop:0}}/>
          <Text style={s.body}>Pick a ready-made hero and you'll be choosing your adventure in seconds.</Text>
          <QuickHeroes onChoose={useReadyHero} disabled={saving||loading}/>
          {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <Section icon="quill" title="Or make your own"/>
        </>}
        <GameButton icon="sheet" label="Create new character" onPress={() => {setEditingHero(false); setForm(blankBuild()); setError(''); setScreen('Character Creation');}} disabled={loading||creatingStory}/>
        {!!hero&&!heroFallen&&(showReady?<><Text style={[s.note,{marginTop:14}]}>Playing a ready-made hero sets {hero.name} aside with their adventure; switch back below any time.</Text><QuickHeroes replacing={hero.name} onChoose={useReadyHero} disabled={saving||loading}/></>:<GameButton icon="spell" label="Try a ready-made hero" onPress={()=>setShowReady(true)} disabled={loading||creatingStory}/>)}
        <HeroRoster roster={roster} graves={graves} onPlay={playFromRoster} onRetire={retireFromRoster} busy={saving||loading||creatingStory} compact={compact}/>
      </>}
      {screen === 'Adventure Opening' && hero && <AdventureIntros selected={selectedIntro} onSelect={setSelectedIntro} onStart={()=>playCharacter(true)} busy={creatingStory} error={error} continuation={canContinue?{title:game.story.title,place:game.story.locations.inn.name}:null} continuing={continuingNow} onContinuing={setContinueRegion}/>}
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
        {characterChosen && hero && levelUpReady(game,hero) && button('✦ Review earned level-up',()=>{setError('');setScreen('Level Up');scrollRef.current?.scrollTo({y:0,animated:false});},'primary')}

        {characterChosen && hero && <Adventure table={table} hero={hero} game={game} setGame={setGame} health={health} setHealth={setHealth} onRestart={() => {setGame(newAdventure(hero,game));setHealth(null);scrollRef.current?.scrollTo({y:0,animated:false});}}/>}
      </>}
      {screen === 'Multiplayer' && <SharedTable table={table} hero={hero} characterChosen={characterChosen} onPlay={()=>{setNewStoryRequested(false);setScreen(characterChosen?'Adventure':'Character Selection');}}/>}
      {screen === 'Legal' && <Legal tab={legalTab} onTab={setLegalTab}/>}
      {screen === 'Settings' && <AccountSettings onRestore={restoreFromCloud} busy={saving||loading} onChange={setAccount} onLegal={tab=>openLegal(tab,'Settings')}/>}
      {screen === 'Settings' && <StorySettings/>}
      {screen === 'Settings' && <ThemeSettings/>}
      {screen === 'Settings' && <DisplaySettings/>}
      {screen === 'Settings' && <AudioSettings/>}
      {screen === 'Settings' && <CloudSaveSettings onRestore={restoreFromCloud} busy={saving||loading}/>}
      {screen === 'Settings' && <SaveTransfer/>}
      {screen === 'Settings' && <View style={s.about}><Section icon="info" title="About" style={{marginTop:0}}/><Text style={s.aboutText}>Questbound Early Access 0.1. Your character, adventure progress, HP and supplies are saved on this device; Continue resumes your quest. The Dungeon Master runs on your privately configured AI service.</Text><Text style={s.aboutText}>Questbound is an independent production, compatible with fifth edition, and is not affiliated with Wizards of the Coast. Its rules text includes material from the System Reference Documents 5.2 and 5.1 by Wizards of the Coast LLC under the Creative Commons Attribution 4.0 International License (see Licences and credits).</Text>
        <View style={s.legalRow}>{[['privacy','Privacy policy','key'],['terms','Terms of use','scroll'],['permissions','Permissions agreement','check'],['licences','Licences and credits','book']].map(([tab,label,icon])=><GameButton key={tab} icon={icon} label={label} onPress={()=>openLegal(tab,'Settings')} style={s.legalButton}/>)}</View></View>}
      {/* Screens inside the adventure have their own way back; Settings opened from the game returns there. */}
      {screen === 'Character Creation' ? <GameButton icon="back" label="Back to heroes" onPress={() => setScreen('Character Selection')} disabled={loading||creatingStory}/> : screen==='Legal' ? <GameButton icon="back" label={legalFrom==='Settings'?'Back to settings':'Main menu'} onPress={()=>setScreen(legalFrom==='Settings'?'Settings':'Home')}/> : screen==='Settings'&&returnToGame&&saved ? <GameButton icon="back" label="Back to the adventure" onPress={backToGame} variant="primary"/> : screen !== 'Home' && !(gameScreen&&screen!=='Adventure') && screen!=='Level Up' && <GameButton icon="back" label="Main menu" onPress={() => setScreen('Home')} disabled={loading||creatingStory}/>}
    </Panel>
    </View>
  </ScrollView>}</View>}
  </EncounterProvider>
  {!!unveil&&<View key={unveil} dataSet={{qb:'unveil'}} style={[StyleSheet.absoluteFillObject,{pointerEvents:'none',zIndex:55}]}/>}
  <CinematicLayer levelReady={inGame&&!!hero&&levelUpReady(game,hero)}/>
  {creatingStory&&(selectedIntro!=='hostile'||continuingNow)&&<StoryLoading introId={continuingNow?'surprise':selectedIntro} near={continuingNow?game.story?.locations?.inn?.name??null:null}/>}
  <Agreement visible={launched&&!agreed&&screen!=='Legal'} onAccept={()=>{acceptAgreement();setAgreed(true);playSound('open');}} onLegal={tab=>openLegal(tab,'Home')}/>
  {!launched&&<LaunchScreen ready={!loading} onBegin={()=>setLaunched(true)}/>}
  </View>;
}
const s = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.ink,overflow:'hidden'},
  // An image from a file brings its own pixel size as its style; the backdrop must say it fills the screen instead
  // (without this the picture stopped at its own width and wide windows showed black on the right).
  backdrop:{position:'absolute',left:0,top:0,right:0,bottom:0,width:'100%',height:'100%'},controls:{flexDirection:'row',gap:8,flexShrink:0},gameContent:{maxWidth:1120},
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
  tagline:{fontFamily:fonts.story,fontStyle:'italic',fontSize:21,color:'#decfc8',textAlign:'center',letterSpacing:.5},
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
  quickTab:{flexGrow:1,alignItems:'center',paddingHorizontal:14,paddingVertical:10,minHeight:44,borderRadius:3,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(31,24,32,.9)'),justifyContent:'center'},
  quickTabText:{fontFamily:fonts.display,color:'#dfcdc5',fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
  quickGlyph:{color:colors.gold},
  tableRow:{flexDirection:'row',alignItems:'center',gap:8},tableBar:{padding:12,borderRadius:6,borderWidth:1,borderColor:'rgba(111,208,196,.35)',marginBottom:10,gap:6},tableText:{fontFamily:fonts.display,color:'#9fe3d8',fontSize:12,fontWeight:'700',letterSpacing:1.2},tableNotice:{fontFamily:fonts.ui,color:'#ffd49a',fontSize:13,lineHeight:19},
  saveStatus:{fontFamily:fonts.ui,color:colors.goldMid,fontSize:12,letterSpacing:.4,marginBottom:16},
  error:{color:colors.danger,marginTop:16,lineHeight:22,fontFamily:fonts.ui},
  note:{fontFamily:fonts.ui,color:tint('#c9aab2'),fontSize:13,lineHeight:20,marginBottom:18},
  footer:{fontFamily:fonts.display,color:tint('rgba(178,34,58,.55)'),fontSize:10,letterSpacing:2.4,textAlign:'center',marginTop:30},
  quickEyebrow:{marginTop:4,marginBottom:10},
  feedbackLink:{alignSelf:'center',marginTop:12,minHeight:44,paddingHorizontal:12,justifyContent:'center'},feedbackText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},
  about:{gap:8,paddingTop:16,marginBottom:6,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.2)')},aboutText:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,lineHeight:19},legalRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4},legalButton:{flexGrow:1,flexBasis:160,marginTop:0},
  backChip:{flexDirection:'row',alignItems:'center',gap:6,minHeight:40,paddingLeft:10,paddingRight:16,borderRadius:20,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),backgroundColor:tint('rgba(20,15,21,.8)'),justifyContent:'center'},
  brand:{flexDirection:'row',alignItems:'center',gap:10,minHeight:44},emblem:{width:34,height:34,borderRadius:17,borderWidth:1.5,borderColor:colors.gold,alignItems:'center',justifyContent:'center',backgroundColor:tint('rgba(12,6,7,.7)')},emblemQ:{fontFamily:fonts.logo,fontSize:19,fontWeight:'900',color:colors.gold,marginTop:-2},backChipText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
});







