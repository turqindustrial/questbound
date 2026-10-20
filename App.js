import AdventureIntros from './AdventureIntros';
import {findDmEndpoint,writeStory} from './dmConnection';
import {loadJourneys,playedJourneys,journeysToOffer,rememberJourney} from './journeyLibrary';
import {sequelPlacement,taleChoice,taleRequest,taleRepeats,taleHistory} from './startTale';
import Followers from './Followers';
import DiceRoller from './DiceRoller';
import SceneTransitionProvider,{useSceneTransition} from './SceneTransition';
import {sceneArtSubjects,npcArtSubject} from './worldArtRules';
import {usePageWheel} from './usePageWheel';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import EncounterProvider,{CombatHealthButton,EntityText} from './EncounterOverlay';
import {freshStoryGame,levelUpReady,foeForLevel} from './storyRules';
import {advancedInPlace,experienceView} from './experienceRules';
import {hostileEncounterGame} from './hostileEncounter';
import CampaignJournal from './CampaignJournal';
import {addJournalNote,appendJournal,appendStoryLog} from './journalRules';
import Advancement from './Advancement';
import {spellSelectionError} from './spellOptions';
import {saveAdventure, adventureSnapshot} from './adventureStorage';
import {useSharedTable} from './useSharedTable';
import {useHeroSaves,heroSaveActions} from './useHeroSaves';
import {s} from './appStyles';
import {backupLocalSave,tableMembership} from './tableClient';
import {isPartyGame,joinParty,soloFromParty,partyMembers} from './partyRules';
import PartyPanel from './PartyPanel';
import MemberActions,{useMutedMembers} from './TableMemberActions';
import SharedTable from './SharedTable';
import Adventure from './Adventure';
import {newAdventure} from './adventureRules';
import CharacterSheet from './CharacterSheet';
import {gearedHero} from './inventoryRules';
import {combatBasics} from './combatRules';
import CharacterBuilder from './CharacterBuilder';
import { blankBuild, buildError, makeCharacter, abilities, modifier, heroSpecies } from './characterRules';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { saveCharacter, isValidCharacter } from './characterStorage';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, TextInput, Pressable, View, Image, Platform, useWindowDimensions } from 'react-native';
import {Panel,GameButton,Ornament,Eyebrow,StatBar,ScreenTitle,Section,Crest} from './ui';
import {colors,tint} from './theme';
import {setMood,setAmbience,setDanger,playSound} from './audio';
import {setNarratorStyle} from './narrator';
import {storyPreferences,subscribeStoryPreferences,narratorOf} from './storyPreferences';
import HomeScreen,{homeLayout} from './HomeScreen';
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
import DeveloperDiagnostics from './DeveloperDiagnostics';
import Legal from './Legal';
import {placeName,mapLocation} from './mapRules';
import {displayState} from './fullscreen';
import GameHud from './GameHud';
import LaunchScreen from './LaunchScreen';
import {EmblemMark} from './TitleEmblem';
import Agreement from './Agreement';
import {agreementStatus,acceptAgreement} from './agreementRules';
import SaveTransfer from './SaveTransfer';
import QuickHeroes from './QuickHeroes';
import HeroRoster from './HeroRoster';
import {CloudSaveSettings} from './CloudSaveSettings';
import {AccountSettings} from './AccountSettings';
import {accountState,bootstrapAccount,accountsRequired,accountsNeeded,accountsOffered} from './accountRules';
import {currentProfile,subscribeProfile} from './playerStorage';
import {deathIsFinal} from './deathRules';
import {carriedBase,joinRegion,canContinueRegion} from './sequelRules';
import {levelCompanions} from './followerRules';
import FeedbackSheet,{deviceLabel,useFeedbackRequests} from './Feedback';
import {feedbackDetails,feedbackSummary,pageBuild} from './feedbackRules';
import {recentProblems} from './problemLog';
import {audioHealth} from './audio';
import {perfHealth,startPerfWatch,setCovered} from './perfWatch';
import {currentTheme} from './theme';
import {questState} from './storyRules';
import {turnOrderView} from './encounterRules';
import {useVisualViewport} from './webLayout';
import SessionRating from './SessionRating';
import {InsightSettings} from './InsightControls';
import {startPlayMetrics,notePlace,noteTale,noteStoryWait,placeOf,talking,readInsight,noteRatingShown,sessionSeconds,deviceSeconds,subscribeInsight} from './playMetrics';
import {ratingMomentOf,mayAskRating} from './ratingRules';
// The title painting: a valley at dusk, dark on the left where the menu sits (see assets/title/ART-NOTES.md).
const titlePainting=require('./assets/title/questbound-title.jpg');

export default function App(){
 const [ready,setReady]=useState(false),[profile,setProfile]=useState(currentProfile);
 useEffect(()=>{const off=subscribeProfile(setProfile);bootstrapAccount(undefined,{required:accountsRequired}).finally(()=>{setProfile(currentProfile());setReady(true);});return off;},[]);
 useEffect(()=>{const changed=e=>{if(e.key==='questbound.account.v2')globalThis.location?.reload();};globalThis.addEventListener?.('storage',changed);return()=>globalThis.removeEventListener?.('storage',changed);},[]);
 if(!ready)return <View style={{flex:1,backgroundColor:colors.ink,padding:30}}><Text style={{color:colors.text}}>{accountsRequired?'Opening your account…':'Opening Questbound…'}</Text></View>;
 return <SceneTransitionProvider key={profile}><QuestboundApp/></SceneTransitionProvider>;
}
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
  const [selectedIntro,setSelectedIntro]=useState('easy'),[showReady,setShowReady]=useState(false),[idea,setIdea]=useState('');
  const [screen, setScreenState] = useState('Home');
  // Whether the player is signed in to an account (their adventure is then also kept on the host's PC). While accounts
  // are not offered (accountsOffered in accountRules.js: the beta) nothing about accounts is shown and saves stay local.
  const [account,setAccount]=useState(null);
  // Which legal page is open (privacy, terms or licences), and where it was opened from.
  const [legalTab,setLegalTab]=useState('privacy'),[legalFrom,setLegalFrom]=useState('Home');
  const openLegal=(tab,from)=>{setLegalTab(tab);setLegalFrom(from);setScreenState('Legal');scrollRef.current?.scrollTo({y:0,animated:false});};
  useEffect(()=>{accountState().then(a=>{setAccount(a);if(a?.hold&&accountsOffered())setScreenState('Settings');}).catch(()=>{});},[]);
  // The read-aloud narrator sounds like the chosen narrator (storyPreferences.js narrators).
  useEffect(()=>{const apply=p=>setNarratorStyle(narratorOf(p.narrator).voice);apply(storyPreferences());return subscribeStoryPreferences(apply);},[]);
  // A hero being edited, and whether a new story carries on in the same region.
  const [editingHero,setEditingHero]=useState(false),[continueRegion,setContinueRegion]=useState(true);
  // The hero, their adventure and this device's saves (useHeroSaves.js).
  const saves=useHeroSaves({transition,setNewStoryRequested}),{form,setForm,hero,setHero,health,setHealth,game,setGame,characterChosen,setCharacterChosen,loading,saving,setSaving,storageError,adventureBlocked,saveStatus,setSaveRetry,roster,graves,restingKey,applyRemote}=saves;
  // The hero as the adventure has them (Aid raises the hit point maximum while it lasts).
  const heroStats = hero ? combatBasics(gearedHero(hero, game)) : null;
  const [error, setError] = useState('');
  const table=useSharedTable({ready:!loading&&!storageError&&!adventureBlocked,hero,game,health,characterChosen,applyRemote});
  const {setCurrentAside,playFromRoster,restoreFromCloud,retireFromRoster,layHeroToRest}=heroSaveActions({...saves,setError,creatingStory,setNewStoryRequested,setScreenState,table});
  // Play needs a signed-in, verified account only once accounts are required (accountsRequired in accountRules.js);
  // until then a browser plays as a guest and an account stays an offer in Settings.
  const mustSignIn=accountsNeeded()&&!account?.verified;
  useEffect(()=>{if(!loading&&mustSignIn&&['Adventure','Character Creation','Multiplayer','Adventure Opening','Level Up'].includes(screen)){setScreenState('Settings');setError('Sign in and verify your email before playing. Your earlier saves are kept.');}},[screen,mustSignIn,loading]);
  // Leaving a party table: this device's adventure goes on alone from where the party stands.
  useEffect(()=>{if(!table.joined&&isPartyGame(game))setGame(g=>isPartyGame(g)?soloFromParty({game:g},hero?.level??null).game:g);},[table.joined,game,hero]);
  const party=partyMembers(game).filter(m=>!m.lead);
  // Another hero tapped in the party row opens Mute, Report and (for the table's host) Remove and ban beneath it.
  const [memberOpen,setMemberOpen]=useState(null),mutedHere=useMutedMembers(table.campaignId),openedMember=memberOpen?(table.members??[]).find(m=>m.id===memberOpen):null;
  async function setScreen(target){
    if(table.joined&&['Character Selection','Character Creation','Adventure Opening'].includes(target)){setScreenState('Multiplayer');setError('Leave the shared table before changing your hero or starting a separate adventure.');return;}
    if(['Adventure','Character Creation','Multiplayer','Adventure Opening'].includes(target)&&mustSignIn){setScreenState('Settings');setError('Sign in and verify your email before playing. Your existing guest saves are kept.');return;}
    try{if(['Adventure','Character Sheet','Campaign Journal','Followers'].includes(target)&&hero)await transition.prepare([...sceneArtSubjects(game),...(target==='Followers'?Object.keys(game.followers??{}).map(id=>npcArtSubject(game,id)):[])]);setScreenState(target);}
    catch(e){setError(e.message);}
  }
  const button = (label, onPress, variant='secondary', style) => <GameButton key={label} label={label} variant={variant} disabled={loading||creatingStory} onPress={onPress} style={style}/>;
  // The saved adventure is this hero's: if it ended in death, the hero cannot be played again.
  const heroFallen=!!hero&&characterChosen&&game.stage==='dead';
  const canContinue=!!hero&&characterChosen&&!heroFallen&&canContinueRegion(game),continuingNow=continueRegion&&canContinue;
  // Ready journeys (journeyLibrary.js, tale-library.cjs): asked for whenever the New Adventure screen opens. A journey
  // this device has played, or whose title the hero has already lived, is never offered. Null: the library could not
  // be reached, and the written openings are offered as before.
  const [journeysOnOffer,setJourneysOnOffer]=useState(null);
  useEffect(()=>{if(screen!=='Adventure Opening')return;let current=true;(async()=>{const [list,played]=await Promise.all([loadJourneys(),playedJourneys()]);if(current)setJourneysOnOffer(list?journeysToOffer(list,{played,titles:[...(game?.storyHistory??[]),game?.story?.title]}):null);})();return()=>{current=false;};},[screen]);
  // With journeys on offer, a choice they stand in for (Easy to get into, a written opening, a journey no longer on
  // offer) moves to the first journey; without them, a journey choice goes back to Easy to get into.
  useEffect(()=>{const id=String(selectedIntro);if(!journeysOnOffer?.length){if(id.startsWith('journey:'))setSelectedIntro('easy');return;}if(['idea','surprise','hostile'].includes(id)||journeysOnOffer.some(j=>'journey:'+j.id===id))return;setSelectedIntro('journey:'+journeysOnOffer[0].id);},[journeysOnOffer,selectedIntro]);
  // A hero who has died and cannot be brought back (deathRules.js deathIsFinal; or whose player lets them go) is laid
  // to rest: a memorial line in the graveyard, and the hero and their adventure leave this device's save, so they can
  // never be continued, set aside or chosen again. The epitaph stays on screen until the player leaves the play
  // screen; then the way on is a new hero. Never at a shared table: the table keeps the seat (partyRules.js).
  const finalDeath=!loading&&!storageError&&!adventureBlocked&&!!hero&&characterChosen&&!table.joined&&deathIsFinal(game,hero);
  useEffect(()=>{if(finalDeath)layHeroToRest();},[finalDeath]);
  // Once the player leaves the play screen, the hero laid to rest is gone from memory too.
  useEffect(()=>{
    if(!restingKey||!hero||JSON.stringify(hero)!==restingKey||!['Home','Character Selection','Character Creation','Adventure Opening','Multiplayer'].includes(screen))return;
    setHero(null);setGame(newAdventure());setHealth(null);setCharacterChosen(false);setNewStoryRequested(true);setForm(blankBuild());setEditingHero(false);setShowReady(false);
  },[screen,hero,restingKey]);
  // A new portrait for the hero (HeroFacePicker.js on the Character Sheet): saved on the hero, and the adventure follows
  // (the save effect above); at a shared table it is the campaign's `portrait` edit, so every player sees it.
  async function choosePortrait(portrait){
    if(!hero)return;
    const next={...hero};if(portrait)next.portrait=portrait;else delete next.portrait;
    if(!isValidCharacter(next)){setError('That portrait could not be kept.');return;}
    if(table.joined){try{await table.edit({kind:'portrait',portrait:portrait??null});}catch(e){setError(e.message);}return;}
    try{await saveCharacter(next);setHero(next);setForm(f=>({...f,portrait}));}catch{setError('Your new portrait could not be saved. Try again.');}
  }
  async function playCharacter(begin=false){
    if(storyLock.current||loading||storageError||adventureBlocked||!hero||heroFallen)return;
    if(!newStoryRequested){setCharacterChosen(true);setScreen('Adventure');return;}
    if(begin!==true){setScreen('Adventure Opening');scrollRef.current?.scrollTo({y:0,animated:false});return;}
    storyLock.current=true;setCreatingStory(true);setError('');
    let waiting=false;
    try{
      let next;
      // The next chapter in the same region: the story writer is told what the hero leaves behind, and the old
      // region joins the new map a few miles away.
      const continuing=continuingNow,{bearing,miles}=sequelPlacement();
      const base=newAdventure(hero,characterChosen?carriedBase(game):undefined);
      if(selectedIntro==='hostile'&&!continuing){noteTale('hostile',null);next=hostileEncounterGame(hero,base);}
      else{
      // The opening, the player's idea and any ready journey (startTale.js).
      const {wish,start,journeyId,introId}=taleChoice({selectedIntro,continuing,idea,easyStart:storyPreferences().easyStart,journeysOnOffer});
      noteTale(continuing?'next':start.introId,!!start.easyStart);noteStoryWait('start');waiting=true;
      const endpoint=await findDmEndpoint();
      const {ok,status,body}=await writeStory(endpoint,taleRequest({hero,game,characterChosen,continuing,bearing,wish,journeyId,introId,start}));
      // A journey that has just left the library: the journeys on offer are asked for again.
      if(!ok){if(journeyId&&status===409)loadJourneys().then(async list=>{const played=await playedJourneys();setJourneysOnOffer(list?journeysToOffer(list,{played,titles:[...(game?.storyHistory??[]),game?.story?.title]}):null);});throw Error(body.error||'The story could not be created.');}
      next=freshStoryGame(hero,{...body.story,introId},base);
      if(taleRepeats(game,next))throw Error('The DM repeated the previous story. Try again; your adventure is unchanged.');
      }
      if(characterChosen&&game.story)next=joinRegion(next,game,{sameRegion:continuing,bearing,miles});
      next.storyHistory=taleHistory(game,next);
      await transition.prepare(sceneArtSubjects(next));
      await saveAdventure(adventureSnapshot(hero,next,null,true),hero);
      // A journey played on this device is never offered here again.
      if(next.story?.libraryId)await rememberJourney(next.story.libraryId);
      if(waiting)noteStoryWait('done');waiting=false;
      setGame(next);setHealth(null);setCharacterChosen(true);setNewStoryRequested(false);setIdea('');setScreenState('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});
    }catch(e){if(waiting)noteStoryWait('failed');setError(e.name==='TimeoutError'?'Story creation timed out. Your current adventure is unchanged; try again.':e.message);}
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
    // At a shared table the campaign server takes the level (campaign-advancement.cjs, the same rules as below).
    if(table.joined){try{await table.edit({kind:'advance',character});setScreenState('Adventure');cue('levelup',{level:character.level,sub:character.name+' is now a level '+character.level+' '+character.class+'.'});}catch(e){setError(e.message);}finally{setSaving(false);}return;}
    // A level is taken where the hero stands, whatever earned the experience for it: rested as after a night's sleep,
    // everything else untouched (the party at a shared table too), and a main foe not yet met grows to match.
    try{
      let advanced=advancedInPlace(game,hero,character);
      advanced=foeForLevel(advanced,character.level);
      // Companions come along a step behind: one level below the hero.
      advanced=levelCompanions(advanced,character.level);
      advanced.journal=appendJournal(advanced.journal??game.journal,'level','Level gained',`${character.name} reached level ${character.level}.`);advanced.storyLog=appendStoryLog(game.storyLog,'level',`${character.name} reached level ${character.level}.`);
      await saveCharacter(character);const marked=withDeeds(advanced,character);setHero(character);setForm(character);setGame(marked.game);setHealth(null);setScreenState('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});cue('levelup',{level:character.level,sub:character.name+' is now a level '+character.level+' '+character.class+', rested and ready.'});marked.fresh.forEach((id,i)=>setTimeout(()=>cue('deed',{deed:deedById(id)}),4200+i*4400));
    }catch{setError('Could not save your level-up. Your previous character is still saved. Retry when ready.');}
    finally{setSaving(false);}
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
    // A tale nobody has played a turn of yet (its first turn is the opening itself: storyRules.js freshStoryGame).
    const hostile=game.story?.introId==='hostile',fresh=!(game.playback??[]).some(t=>t.events?.some(e=>e.kind==='player'));
    cue('area',fresh?(hostile?{over:'Steel is drawn',title:areaName}:{over:'A new tale begins',title:game.story?.title??areaName,sub:game.story?areaName:null}):{over:game.story?.title??'The Lantern at the Crossroads',title:areaName});
  },[areaName,launched]);
  const hpRatio=inGame&&heroStats?.available?(health?.current??heroStats.hp)/Math.max(1,heroStats.hp):1;
  useEffect(()=>{setDanger(launched&&inGame&&!dead&&hpRatio<=.3?1-hpRatio:0);},[launched,inGame,hpRatio,dead]);
  // What a playtest note carries: the one-line summary as before, and the details (feedbackRules.js) worked out when
  // the note is sent, so they describe the game at that moment. The device line is added by the feedback form itself.
  const [feedbackOpen,setFeedbackOpen]=useState(false),[feedbackRequest,setFeedbackRequest]=useState(null);
  const feedbackState=useRef(null);feedbackState.current={hero,game,health,screen,table};
  const feedbackContext=useCallback(()=>{
    const {hero,game,health,screen,table}=feedbackState.current,place=game?.story?placeName(game,mapLocation(game)):null;
    const order=turnOrderView(game),turn=order?.current?(order.current.mine?'your turn':order.current.name+'’s turn')+' (round '+order.round+')':null;
    const win=typeof window!=='undefined'?window:{},nav=typeof navigator!=='undefined'?navigator:{},display=displayState();
    let reducedMotion=false;try{reducedMotion=!!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}catch{}
    return {summary:feedbackSummary({hero,game,screen,place}),details:feedbackDetails({hero,game,health,screen,theme:currentTheme(),place,chapter:questState(game)?.current?.title??null,turn,table,
      device:{label:deviceLabel(),dpr:win.devicePixelRatio,cores:nav.hardwareConcurrency,memory:nav.deviceMemory,reducedMotion,effects:display.effectsActive,fullscreen:display.fullscreen},
      audio:audioHealth(),perf:perfHealth(),problems:recentProblems(5),build:pageBuild()})};
  },[]);
  // Only problems are worth showing away from Home; a routine "saved" line there is just noise.
  const saveProblem=!!saveStatus&&!/^(Adventure saved|Saving adventure)/.test(saveStatus);
  // The title screen's shape decides how the painting is framed: the horizon when wide, the tower on an upright phone.
  const homeShape=homeLayout(windowWidth,windowHeight);
  const home=screen==='Home'&&!inGame,wideHome=home&&homeShape.wide;
  // On Home the title screen's own sheet answers requests to open feedback (in play, GameHud's does).
  useFeedbackRequests(request=>{setFeedbackRequest(request??{});setFeedbackOpen(true);},home);
  // Full-screen covers: while a tale is written or the agreement is asked, the scenery underneath holds still.
  const storyCover=creatingStory&&(selectedIntro!=='hostile'||continuingNow),agreementShown=launched&&!agreed&&screen!=='Legal';
  useEffect(()=>{setCovered('story',storyCover);return()=>setCovered('story',false);},[storyCover]);
  useEffect(()=>{setCovered('agreement',agreementShown);return()=>setCovered('agreement',false);},[agreementShown]);
  // Anonymous play counts (playMetrics.js): where this session is, as one word from a fixed list; sent when the page
  // is hidden or left, never with anything typed or named.
  useEffect(()=>{startPlayMetrics();},[]);
  useEffect(()=>{notePlace(placeOf({launched,storyCover,screen,inGame,stage:game.stage,fighting,talking:talking()}));},[launched,storyCover,screen,inGame,game.stage,fighting]);
  // "How was that session?" (SessionRating.js, ratingRules.js): offered a few seconds after a natural stopping point
  // (a chapter or the tale finished, a long rest, the hero's death, or leaving play for the title), never in a fight,
  // while dying, typing or waiting for a tale, and only as often as the rules allow.
  const [rating,setRating]=useState(null),ratingTimer=useRef(null),ratingGame=useRef(game),wasInGame=useRef(inGame);
  const ratingBlocked=useRef(true);
  ratingBlocked.current=!launched||agreementShown||storyCover||feedbackOpen||typingPlay||(fighting&&game.stage!=='dead')||game.stage==='dying'||!!game.turnOrder||!!game.pendingSpell;
  // The title cards of a finished fight, a tale, a level, a death or a new place (CinematicLayer.js) go first: the
  // card waits until they have faded.
  const cinematicUntil=useRef(0);
  useCue(useCallback(event=>{const hold={death:8600,victory:3800,defeat:3800,down:3800,complete:3800,levelup:4000,area:4100,deed:4600}[event.kind];if(hold)cinematicUntil.current=Math.max(cinematicUntil.current,Date.now()+hold);},[]));
  const offerRating=useCallback(moment=>{
    clearTimeout(ratingTimer.current);
    const show=tries=>{
      const wait=cinematicUntil.current-Date.now();
      if(wait>0&&tries<6){ratingTimer.current=setTimeout(()=>show(tries+1),wait+700);return;}
      const insight=readInsight();
      if(!mayAskRating({ask:insight.ask,record:insight.rating,moment,sessionSeconds:sessionSeconds(),deviceSeconds:deviceSeconds(),now:Date.now(),blocked:ratingBlocked.current}))return;
      noteRatingShown();setRating(old=>old??{moment,id:Date.now()});
    };
    ratingTimer.current=setTimeout(()=>show(0),moment==='leave'?1200:moment==='death'?6000:3500);
  },[]);
  useEffect(()=>()=>clearTimeout(ratingTimer.current),[]);
  useEffect(()=>subscribeInsight(i=>{if(!i.ask)setRating(null);}),[]);
  useEffect(()=>{const before=ratingGame.current;ratingGame.current=game;if(!playing)return;const moment=ratingMomentOf(before,game);if(moment)offerRating(moment);},[game]);
  useEffect(()=>{const was=wasInGame.current;wasInGame.current=inGame;if(was&&!inGame&&screen==='Home')offerRating('leave');},[inGame,screen]);
  const homeNotice=(loading||!!storageError||saveProblem)&&<>{loading&&<Text style={s.note}>Loading saved character…</Text>}{!!storageError&&<Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}{saveProblem&&<Text accessibilityLiveRegion="polite" style={[s.saveStatus,{color:tint('#ffd49a')}]}>{saveStatus}</Text>}{saveStatus.startsWith('Adventure not saved')&&button('Retry adventure save',()=>setSaveRetry(value=>value+1))}</>;
  return <View dataSet={{qb:'root'}} style={s.root}>
  <View dataSet={{qb:'stage'}} style={[StyleSheet.absoluteFillObject,{pointerEvents:'none'}]}>
    {inGame?<DynamicArt subject={locationArtSubject(game)} style={StyleSheet.absoluteFillObject} quiet/>:home?<View dataSet={{qb:'launch-glow'}} style={StyleSheet.absoluteFillObject}/>:<Image source={titlePainting} dataSet={{qb:'backdrop',frame:homeShape.wide?'wide':'tall'}} resizeMode="cover" style={s.backdrop}/>}
    <View dataSet={{qb:inGame?'atmosphere-game':home?(wideHome?'atmosphere-home':'atmosphere-home-narrow'):'atmosphere'}} style={[StyleSheet.absoluteFillObject,{backgroundColor:inGame?tint('rgba(13,7,14,.35)'):home?tint('rgba(10,7,11,.45)'):tint('rgba(10,7,11,.72)')}]}/>
    {!inGame&&<View dataSet={{qb:'rays'}} style={StyleSheet.absoluteFillObject}/>}
    <View dataSet={{qb:'fog'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'vignette',home:home?'on':'off'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'embers'}} style={StyleSheet.absoluteFillObject}/>
    <View dataSet={{qb:'grain'}} style={StyleSheet.absoluteFillObject}/>
  </View>
  <EncounterProvider hero={hero} game={game} health={health}>
  <StatusBar style="light" />
  {playing?<View dataSet={{safe:'pad'}} style={s.shell}>
    {/* In play: a fixed HUD and a play area that fills the rest of the screen. Nothing scrolls the page. While the
        player types on a small phone, the HUD gives its row to the story too. */}
    <View style={[{zIndex:5},typingPlay&&visibleHeight<430&&{display:'none'}]}><GameHud hero={hero} game={game} health={health} maxHp={heroStats.hp} xp={experienceView(game,hero)} wide={wideGame} onNavigate={openFromGame} levelUp={levelUpReady(game,hero)} onLevelUp={()=>{setError('');setScreen('Level Up');}} feedback={feedbackContext}/></View>
    {(table.joined||!!table.notice||!!storageError||!!saveProblem)&&<View style={[s.notices,compact&&{paddingHorizontal:8}]}>
      {!table.joined&&!!table.notice&&<Pressable accessibilityRole="alert" onPress={table.clearNotice}><Text style={s.tableNotice}>{table.notice}  ✕</Text></Pressable>}
      {!!storageError&&<Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
      {saveStatus.startsWith('Adventure not saved')?<Pressable accessibilityRole="button" onPress={()=>setSaveRetry(value=>value+1)}><Text style={s.tableNotice}>{saveStatus} Tap to retry.</Text></Pressable>:!!saveProblem&&<Text accessibilityRole="alert" style={s.tableNotice}>{saveStatus}</Text>}
      {table.joined&&<View dataSet={{qb:'plate'}} style={s.tableBar}><View style={s.tableRow}><Icon name="people" size={14} color={tint('#9fe3d8')}/><Text numberOfLines={1} style={[s.tableText,{flex:1}]}>Shared table · {table.players.length} {table.players.length===1?'player':'players'} {table.online?'':'· reconnecting…'}{table.otherActing?' · '+table.otherActing+' is taking a turn':''}</Text></View>{party.length>0&&<PartyPanel game={game} health={health} maxHp={heroStats?.hp??1} onMember={setMemberOpen} openMember={memberOpen} mutedSeats={mutedHere.map(m=>m.seat)}/>}{!!openedMember&&<MemberActions table={table} member={openedMember} named onClose={()=>setMemberOpen(null)}/>}{!!table.notice&&<Pressable accessibilityRole="button" onPress={table.clearNotice}><Text style={s.tableNotice}>{table.notice}  ✕</Text></Pressable>}{!!table.error&&<Text accessibilityRole="alert" style={s.tableNotice}>{table.error}</Text>}</View>}
    </View>}
    <View dataSet={{qb:shake?'shake':undefined}} style={[s.play,wideGame&&s.playWide,wideGame&&windowHeight<520&&{paddingTop:6,paddingBottom:6}]}>
      <Adventure onTyping={setTypingPlay} layout={wideGame?'wide':'narrow'} levelUp={levelUpReady(game,hero)} onLevelUp={()=>{setError('');setScreen('Level Up');}} onNewHero={()=>{setError('');setNewStoryRequested(true);setScreen('Character Selection');}} resting={!!restingKey&&restingKey===JSON.stringify(hero)} onLetGo={layHeroToRest} table={table} hero={hero} game={game} setGame={setGame} health={health} setHealth={setHealth} onRestart={() => {setGame(newAdventure(hero,game));setHealth(null);}}/>
    </View>
  </View>:<View dataSet={{safe:'pad'}} style={s.shell}>
    {/* Menus: a fixed top bar; only the framed content below scrolls, and short content is centred in the window. */}
    <View style={[s.topBar,compact&&{paddingHorizontal:12},home&&{minHeight:48}]}>
      {home?<View/>:inGame&&!['Level Up','Adventure'].includes(screen)?<Pressable accessibilityRole="button" accessibilityLabel="Back to the adventure" onPress={backToGame} dataSet={{qb:'chip'}} style={s.backChip}><Icon name="back" size={15} color={colors.gold}/><Text style={s.backChipText}>Adventure</Text></Pressable>:<Pressable accessibilityRole="button" accessibilityLabel="Main menu" onPress={()=>setScreen('Home')} style={s.brand}><EmblemMark size={42}/>{windowWidth>=380&&<Text dataSet={{qb:'title'}} style={[s.logoSmall,compact&&{fontSize:17,letterSpacing:2}]}>Questbound</Text>}</Pressable>}
      <View style={s.controls}><FullscreenToggle compact/><AudioToggle compact/></View>
    </View>
  {home?<ScrollView ref={scrollRef} style={s.page} contentContainerStyle={{flexGrow:1}} keyboardShouldPersistTaps="handled">
    <HomeScreen hero={hero} game={game} health={health} saved={saved} unprotected={saved&&!account&&accountsOffered()} onLegal={tab=>openLegal(tab,'Home')} disabled={loading||creatingStory} width={windowWidth} height={windowHeight} notice={homeNotice}
      onContinue={()=>{setNewStoryRequested(false);setReturnToGame(false);setScreen(characterChosen?'Adventure':'Character Selection');}}
      onNew={()=>{setNewStoryRequested(true);setError('');setScreen('Character Selection');}} onOpen={target=>setScreen(target)} onFeedback={()=>{playSound('open');setFeedbackRequest(null);setFeedbackOpen(true);}}/>
    <FeedbackSheet visible={feedbackOpen} onClose={()=>{setFeedbackOpen(false);setFeedbackRequest(null);}} context={feedbackContext} problem={feedbackRequest?.problem??null} prefill={feedbackRequest?.prefill??''}/>
  </ScrollView>:<ScrollView ref={scrollRef} style={s.page} contentContainerStyle={[s.content,gameScreen&&s.gameContent,screen==='Adventure Opening'&&journeysOnOffer?.length&&s.journeyContent,compact&&{padding:12,paddingTop:4,paddingBottom:28},s.centred]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='web'?'none':'on-drag'}>
    {/* Web scroll events include the browser bringing a focused field above the phone keyboard.
        Dismissing on that scroll immediately blurs the field and closes the keyboard. */}
    <View key={screen} dataSet={{qb:'enter'}}>
    <Panel variant={inGame?'glass':'panel'} style={[s.card,compact&&{padding:14}]}>{loading && <Text style={s.note}>Loading saved character…</Text>}{!!storageError && <Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
      {saveProblem&&<Text accessibilityLiveRegion="polite" style={[s.saveStatus,compact&&{marginBottom:10},{color:tint('#ffd49a')}]}>{saveStatus}</Text>}
      {saveStatus.startsWith('Adventure not saved') && button('Retry adventure save',()=>setSaveRetry(value=>value+1))}
        {table.joined && <View dataSet={{qb:'plate'}} style={s.tableBar}><View style={s.tableRow}><Icon name="people" size={14} color={tint('#9fe3d8')}/><Text style={[s.tableText,{flex:1}]}>Shared table · {table.players.length} {table.players.length===1?'player':'players'} {table.online?'':'· reconnecting…'}{table.otherActing?' · '+table.otherActing+' is taking a turn':''}</Text></View>{party.length>0&&<PartyPanel game={game} health={health} maxHp={heroStats?.hp??1}/>}{!!table.notice&&<Pressable accessibilityRole="button" onPress={table.clearNotice}><Text style={s.tableNotice}>{table.notice}  ✕</Text></Pressable>}{!!table.error&&<Text accessibilityRole="alert" style={s.tableNotice}>{table.error}</Text>}</View>}
      {!!titles[screen]&&<ScreenTitle eyebrow={titles[screen][0]} icon={titles[screen][2]} title={titles[screen][1]}/>}
      {screen === 'Character Selection' && <>
        {hero && heroFallen ? <>
          {/* A hero who died stays dead: their card becomes a memorial, and the way on is a new hero. */}
          <View dataSet={{qb:'plate'}} style={[s.heroCard,compact&&{padding:14,gap:14},{opacity:.85}]}>
            <HeroPortrait hero={hero} size={compact?54:68} level={hero.level}/>
            <View style={{flex:1,minWidth:0}}>
              <Eyebrow style={{color:colors.bloodBright}}>Fallen</Eyebrow>
              <Text numberOfLines={1} style={[s.heroName,compact&&{fontSize:23}]}>{hero.name}</Text>
              <Text style={s.heroLine}>Level {hero.level} · {heroSpecies(hero)} · {hero.class}</Text>
              <Text style={s.heroBackground}>{game.death.cause}{game.death.place?' at '+game.death.place:''}.</Text>
            </View>
          </View>
          <Text style={s.note}>{table.joined?hero.name+' has fallen at the shared table. Leave the table to bring a new hero, then join again with the campaign invite.':hero.name+' can still be brought back: continue their adventure to ask. Or choose a ready-made hero or make a new one, and '+hero.name+' is laid to rest.'}</Text>
          {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <QuickHeroes replacing={hero.name} onChoose={useReadyHero} disabled={saving||loading}/>
        </> : hero ? <>
          <View dataSet={{qb:'plate'}} style={[s.heroCard,compact&&{padding:14,gap:14}]}>
            <HeroPortrait hero={hero} size={compact?54:68} level={hero.level}/>
            <View style={{flex:1,minWidth:0}}>
              <Eyebrow>Your hero</Eyebrow>
              <Text numberOfLines={1} style={[s.heroName,compact&&{fontSize:23}]}>{hero.name}</Text>
              <Text style={s.heroLine}>Level {hero.level} · {heroSpecies(hero)} · {hero.class}</Text>
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
      {screen === 'Adventure Opening' && hero && <AdventureIntros selected={selectedIntro} onSelect={setSelectedIntro} idea={idea} onIdea={setIdea} onStart={()=>playCharacter(true)} busy={creatingStory} error={error} journeys={continuingNow?null:journeysOnOffer} continuation={canContinue?{title:game.story.title,place:game.story.locations.inn.name}:null} continuing={continuingNow} onContinuing={setContinueRegion}/>}
      {screen === 'Character Creation' && !loading && <CharacterBuilder form={form} setForm={setForm} onSave={saveHero} saving={saving} blocked={!!storageError} saveError={error} hasSavedCharacter={!!hero} onPageChange={() => scrollRef.current?.scrollTo({y:0,animated:false})}/>}
      {screen === 'Level Up' && hero && <Advancement hero={hero} xp={experienceView(game,hero)} onSave={saveAdvancement} onCancel={()=>setScreen('Adventure')} saving={saving} error={error}/>}
      {screen === 'Character Sheet' && hero && <CharacterSheet onPortrait={choosePortrait} setGame={table.joined?next=>table.edit({kind:'training',training:next.skillTraining}).catch(e=>setError(e.message)):setGame} hero={hero} game={game} health={health} setHealth={setHealth} healthLocked={game.stage !== 'inn'||!!game.npcCombat?.active} onBack={() => {setScreen('Adventure'); scrollRef.current?.scrollTo({y:0,animated:false});}}/>}
      {screen === 'Campaign Journal' && hero && <CampaignJournal game={game} blocked={loading || !!storageError || adventureBlocked} onAddNote={text=>table.joined?table.edit({kind:'note',text}).catch(e=>setError(e.message)):setGame(current=>addJournalNote(current,text))} onBack={()=>{setScreen('Adventure');scrollRef.current?.scrollTo({y:0,animated:false});}}/>}
      {screen === 'Followers' && hero && <Followers hero={hero} game={game} setGame={setGame} onManage={table.joined?(id,action)=>table.edit(action==='accept'?{kind:'accept-offer',id}:{kind:'follower',id,action}):null} onBack={()=>setScreen('Adventure')}/>}
      {screen === 'Dice Roller' && <DiceRoller/>}
      {screen === 'Adventure' && <>
        {characterChosen && heroStats?.available && <View dataSet={{qb:'plate'}} style={s.hud}>
          <View style={s.hudIdentity}>
            <EntityText style={s.hudName}>{hero.name}</EntityText>
            <Text style={s.hudClass}>Level {hero.level} · {heroSpecies(hero)} · {hero.class}</Text>
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
      {screen === 'Settings' && accountsOffered() && <AccountSettings onRestore={restoreFromCloud} busy={saving||loading} onChange={setAccount} onLegal={tab=>openLegal(tab,'Settings')}/>}
      {screen === 'Settings' && <StorySettings/>}
      {screen === 'Settings' && <ThemeSettings/>}
      {screen === 'Settings' && <DeveloperDiagnostics/>}
      {screen === 'Settings' && <DisplaySettings/>}
      {screen === 'Settings' && <AudioSettings/>}
      {screen === 'Settings' && accountsOffered() && <CloudSaveSettings onRestore={restoreFromCloud} busy={saving||loading}/>}
      {screen === 'Settings' && <InsightSettings/>}
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
  {rating&&<SessionRating key={rating.id} moment={rating.moment} top={playing?(wideGame?76:68):64} onClose={()=>setRating(null)}/>}
  {storyCover&&<StoryLoading introId={continuingNow?'surprise':String(selectedIntro).startsWith('journey:')?'easy':selectedIntro} near={continuingNow?game.story?.locations?.inn?.name??null:null}/>}
  <Agreement visible={agreementShown} onAccept={()=>{acceptAgreement();setAgreed(true);playSound('open');}} onLegal={tab=>openLegal(tab,'Home')}/>
  {!launched&&<LaunchScreen ready={!loading} onBegin={()=>{setLaunched(true);startPerfWatch();}}/>}
  </View>;
}







