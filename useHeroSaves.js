// The hero, their adventure and this device's saves, for App.js: the hero and adventure loaded at start and saved after
// every change (with the recovery-code copy), a shared table's adventure taken in after the same checks as a save
// (applyRemote), and the roster: heroes set aside and the fallen (heroSaveActions: switching heroes, a restore from
// another device, retiring a hero, laying the dead to rest).
import {useEffect,useState,useRef} from 'react';
import {blankBuild} from './characterRules';
import {newAdventure} from './adventureRules';
import {loadCharacter,saveCharacter,isValidCharacter,forgetCharacter} from './characterStorage';
import {loadAdventure,saveAdventure,adventureSnapshot,validAdventure,forgetAdventure} from './adventureStorage';
import {scheduleCloudSave} from './cloudRules';
import {noteProblem} from './problemLog';
import {sceneArtSubjects} from './worldArtRules';
import {isPartyGame,partyView} from './partyRules';
import {backupLocalSave} from './tableClient';
import {accountsOffered} from './accountRules';
import {loadRoster,loadGraveyard,setAside,saveLists,restoreEntry,layToRest} from './rosterRules';
export function useHeroSaves({transition,setNewStoryRequested}){
  const [form, setForm] = useState(blankBuild);
  const [hero, setHero] = useState(null);
  const [health, setHealth] = useState(null);
  const [game, setGame] = useState(newAdventure);
  const [characterChosen, setCharacterChosen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [adventureBlocked,setAdventureBlocked] = useState(false);
  const [saveStatus,setSaveStatus] = useState('');
  const [saveRetry,setSaveRetry] = useState(0);
  // Heroes set aside on this device and the fallen.
  const [roster,setRoster]=useState([]),[graves,setGraves]=useState([]);
  useEffect(()=>{Promise.all([loadRoster(),loadGraveyard()]).then(([r,g])=>{setRoster(r);setGraves(g);}).catch(()=>{});},[]);
  // A hero laid to rest (below): who it was, so nothing saves them again.
  const restingRef=useRef(null),[restingKey,setRestingKey]=useState(null);
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
    if(loading || !hero || storageError || adventureBlocked || restingRef.current===JSON.stringify(hero)) return;
    let current=true;
    setSaveStatus('Saving adventure...');
    const snapshot=adventureSnapshot(hero,game,health,characterChosen);
    saveAdventure(snapshot,hero)
      .then(()=>{scheduleCloudSave(snapshot);if(current)setSaveStatus('Adventure saved on this device.');})
      .catch(error=>{noteProblem({kind:'save',error:'Adventure not saved'+(error?.message?': '+error.message:''),stage:game?.stage});if(current)setSaveStatus('Adventure not saved. Your progress is still open; retry before closing the app.');});
    return ()=>{current=false;};
  },[loading,hero,game,health,characterChosen,storageError,adventureBlocked,saveRetry]);
  // The shared table's adventure replaces this device's only after it passes the same checks as a local save.
  async function applyRemote(snapshot,isCurrent=()=>true){
    await transition.prepare(sceneArtSubjects(snapshot.game));
    // A party: this device plays its own hero, joining with it the first time (partyRules.js).
    if(isPartyGame(snapshot?.game)){
      let view=partyView(snapshot,snapshot.game.party.lead); // the server sends each player the table with their own seat in the lead
      if(!view)throw Error((accountsOffered()?'This account':'This browser')+' has no hero in the campaign. Join with its campaign invite.');
      let mine;try{mine=JSON.parse(view.character);}catch{throw Error('The party could not be read.');}
      if(!isValidCharacter(mine)||!validAdventure(view,mine))throw Error('The party did not pass validation. This device kept its own save.');
      if(!isCurrent())return;
      backupLocalSave();
      if(view.character!==JSON.stringify(hero))await saveCharacter(mine);
      if(!isCurrent())return;
      setHero(mine);setForm({...blankBuild(),...mine,species:mine.species??mine.race});setGame(view.game);setHealth(view.health);setCharacterChosen(true);setNewStoryRequested(false);
      return;
    }
    let remoteHero;try{remoteHero=JSON.parse(snapshot.character);}catch{throw Error('The shared adventure could not be read.');}
    if(!isValidCharacter(remoteHero)||!validAdventure(snapshot,remoteHero))throw Error('The shared adventure did not pass validation. This device kept its own save.');
    if(!isCurrent())return;
    backupLocalSave();
    await saveCharacter(remoteHero);
    if(!isCurrent())return;
    setHero(remoteHero);setForm({...blankBuild(),...remoteHero,species:remoteHero.species??remoteHero.race});
    setGame(snapshot.game);setHealth(snapshot.health);setCharacterChosen(snapshot.chosen);setNewStoryRequested(false);
  }
  return {form,setForm,hero,setHero,health,setHealth,game,setGame,characterChosen,setCharacterChosen,loading,setLoading,saving,setSaving,storageError,setStorageError,adventureBlocked,setAdventureBlocked,saveStatus,setSaveStatus,saveRetry,setSaveRetry,roster,setRoster,graves,setGraves,restingRef,restingKey,setRestingKey,applyRemote};
}
// What changes the hero this device plays, or the roster (plain functions: they need the shared table, which needs
// applyRemote above).
export function heroSaveActions({hero,roster,graves,game,health,characterChosen,setError,setRoster,setGraves,saving,loading,storageError,creatingStory,setSaving,setHero,setForm,setGame,setHealth,setCharacterChosen,setNewStoryRequested,setAdventureBlocked,setScreenState,table,restingRef,setRestingKey}){
  // Before another hero takes this one's place: the living wait in the roster, the dead go to the graveyard.
  async function setCurrentAside(){
    if(!hero)return true;
    const next=setAside(roster,graves,hero,game,health,characterChosen);
    if(next.error){setError(next.error);return false;}
    await saveLists(next);setRoster(next.roster);setGraves(next.graves);return true;
  }
  // A hero from the roster becomes the current one (the current hero is set aside first). For a shared table (stay)
  // the screen does not change and the restored hero is returned, so the table can be joined with them.
  async function playFromRoster(entry,{stay=false}={}){
    if(saving||loading||storageError||creatingStory)return null;
    setSaving(true);setError('');
    try{
      const restored=restoreEntry(entry),aside=setAside(roster.filter(e=>e.id!==entry.id),graves,hero,game,health,characterChosen);
      if(aside.error)throw Error(aside.error);
      // The current hero is set aside first and the chosen one leaves the roster last, so nobody is lost midway.
      await saveLists({roster:[...aside.roster,entry],graves:aside.graves});
      await saveCharacter(restored.hero);await saveAdventure(restored.adventure,restored.hero);
      await saveLists(aside);setRoster(aside.roster);setGraves(aside.graves);
      setHero(restored.hero);setForm({...blankBuild(),...restored.hero,species:restored.hero.species??restored.hero.race});setGame(restored.game);setHealth(restored.health);setCharacterChosen(restored.chosen);setNewStoryRequested(!restored.chosen);setAdventureBlocked(false);
      if(!stay)setScreenState('Home');
      return restored;
    }catch(e){if(stay)throw Error(e.message||'Could not switch heroes. Your current hero is unchanged.');setError(e.message||'Could not switch heroes. Your current hero is unchanged.');return null;}
    finally{setSaving(false);}
  }
  // A hero brought over from another device by its recovery code; the current one is set aside first.
  async function restoreFromCloud(snapshot){
    if(table.joined)throw Error('Leave the shared table before importing a different save.');
    let restored;try{restored=JSON.parse(snapshot?.character);}catch{throw Error('That save could not be read. Nothing was changed.');}
    if(!isValidCharacter(restored)||!validAdventure(snapshot,restored))throw Error('That save did not pass the game\'s checks. Nothing was changed.');
    if(hero&&JSON.stringify(hero)!==snapshot.character&&!await setCurrentAside())throw Error('Your company is full. Retire a hero under Heroes first.');
    await saveCharacter(restored);await saveAdventure(snapshot,restored);
    setHero(restored);setForm({...blankBuild(),...restored,species:restored.species??restored.race});setGame(snapshot.game);setHealth(snapshot.health);setCharacterChosen(snapshot.chosen);setNewStoryRequested(!snapshot.chosen);setAdventureBlocked(false);
  }
  async function layHeroToRest(){
    if(!hero||game.stage!=='dead'||table.joined)return;
    const key=JSON.stringify(hero);if(restingRef.current===key)return;
    restingRef.current=key;setRestingKey(key);
    try{
      const [savedRoster,savedGraves]=await Promise.all([loadRoster(),loadGraveyard()]);
      const next=layToRest(savedRoster,savedGraves,hero,game);
      await saveLists(next);setRoster(next.roster);setGraves(next.graves);
      await forgetAdventure();await forgetCharacter();
    }catch{setError('Your fallen hero could not be laid to rest on this device. Reopen the game to try again.');}
  }
  async function retireFromRoster(entry){
    const next={roster:roster.filter(e=>e.id!==entry.id),graves};
    try{await saveLists(next);setRoster(next.roster);}catch{setError('Could not update your roster. Try again.');}
  }
  return {setCurrentAside,playFromRoster,restoreFromCloud,retireFromRoster,layHeroToRest};
}
