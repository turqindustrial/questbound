// The framed menu page of App.js: which screen shows (heroes, a new adventure, the builder, a level up, the character
// sheet, journal, companions, dice, the shared table, the legal pages and settings), with the save and table notices
// above it and the way back below. App.js keeps the state and what each screen does.
import React from 'react';
import AdventureIntros from './AdventureIntros';
import Followers from './Followers';
import DiceRoller from './DiceRoller';
import {CombatHealthButton,EntityText} from './EncounterOverlay';
import {levelUpReady} from './storyRules';
import {experienceView} from './experienceRules';
import CampaignJournal from './CampaignJournal';
import {addJournalNote} from './journalRules';
import Advancement from './Advancement';
import PartyPanel from './PartyPanel';
import SharedTable from './SharedTable';
import Adventure from './Adventure';
import CharacterSheet from './CharacterSheet';
import CharacterBuilder from './CharacterBuilder';
import { blankBuild, heroSpecies } from './characterRules';
import { Text, Pressable, View } from 'react-native';
import {Panel,GameButton,Eyebrow,StatBar,ScreenTitle,Section} from './ui';
import {colors,tint} from './theme';
import Icon from './Icon';
import HeroPortrait from './HeroPortrait';
import {AudioSettings} from './AudioControls';
import {DisplaySettings} from './DisplayControls';
import {StorySettings} from './StoryControls';
import {ThemeSettings} from './ThemeControls';
import DeveloperDiagnostics from './DeveloperDiagnostics';
import Legal from './Legal';
import SaveTransfer from './SaveTransfer';
import QuickHeroes from './QuickHeroes';
import HeroRoster from './HeroRoster';
import {CloudSaveSettings} from './CloudSaveSettings';
import {AccountSettings} from './AccountSettings';
import {accountsOffered} from './accountRules';
import {InsightSettings} from './InsightControls';
import {s} from './appStyles';
// Page headings: overline, title and icon for the screens that have one.
const titles={'Legal':['Questbound','Privacy and terms','info'],'Character Selection':['Heroes','Choose your hero','sheet'],'Dice Roller':['Tabletop','Roll the dice','d20'],'Settings':['Options','Settings','settings'],'Level Up':['A level earned','Level up','star']};
export default function MenuScreens({writtenShelf=null,screen,inGame,compact,loading,storageError,saveProblem,saveStatus,button,setSaveRetry,table,party,game,health,heroStats,hero,heroFallen,error,useReadyHero,saving,newStoryRequested,characterChosen,creatingStory,playCharacter,setEditingHero,setForm,setError,setScreen,showReady,setShowReady,roster,graves,playFromRoster,retireFromRoster,selectedIntro,setSelectedIntro,idea,setIdea,continuingNow,journeysOnOffer,canContinue,setContinueRegion,form,saveHero,scrollRef,saveAdvancement,choosePortrait,setGame,setHealth,adventureBlocked,setNewStoryRequested,legalTab,setLegalTab,restoreFromCloud,setAccount,openLegal,legalFrom,returnToGame,saved,backToGame,gameScreen,heroForTable,tableTale,tablePick,taleReplace,onTableHero,onChooseTale}){
  return <View key={screen} dataSet={{qb:'enter'}}>
    <Panel variant={inGame?'glass':'panel'} style={[s.card,compact&&{padding:14}]}>{loading && <Text style={s.note}>Loading saved character…</Text>}{!!storageError && <Text accessibilityRole="alert" style={s.error}>{storageError}</Text>}
      {saveProblem&&<Text accessibilityLiveRegion="polite" style={[s.saveStatus,compact&&{marginBottom:10},{color:tint('#ffd49a')}]}>{saveStatus}</Text>}
      {saveStatus.startsWith('Adventure not saved') && button('Retry adventure save',()=>setSaveRetry(value=>value+1))}
        {table.joined && <View dataSet={{qb:'plate'}} style={s.tableBar}><View style={s.tableRow}><Icon name="people" size={14} color={tint('#9fe3d8')}/><Text style={[s.tableText,{flex:1}]}>Shared table · {table.players.length} {table.players.length===1?'player':'players'} {table.online?'':'· reconnecting…'}{table.otherActing?' · '+table.otherActing+' is taking a turn':''}</Text></View>{party.length>0&&!table.needsHero&&<PartyPanel game={game} health={health} maxHp={heroStats?.hp??1}/>}{!!table.notice&&<Pressable accessibilityRole="button" onPress={table.clearNotice}><Text style={s.tableNotice}>{table.notice}  ✕</Text></Pressable>}{!!table.error&&<Text accessibilityRole="alert" style={s.tableNotice}>{table.error}</Text>}</View>}
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
          <Text style={s.note}>{table.joined?hero.name+' has fallen at the shared table. Bring a new hero to your seat from the table screen (Play Together), or leave the table.':hero.name+' can still be brought back: continue their adventure to ask. Or choose a ready-made hero or make a new one, and '+hero.name+' is laid to rest.'}</Text>
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
      {screen === 'Adventure Opening' && hero && (table.joined?tableTale&&<AdventureIntros forTable={{replacing:taleReplace&&game.story?.status!=='complete'?game.story?.title??null:null}} selected={selectedIntro} onSelect={setSelectedIntro} idea={idea} onIdea={setIdea} onStart={()=>playCharacter(true)} busy={creatingStory} error={error} journeys={journeysOnOffer} written={writtenShelf}/>
        :<AdventureIntros selected={selectedIntro} onSelect={setSelectedIntro} idea={idea} onIdea={setIdea} onStart={()=>playCharacter(true)} busy={creatingStory} error={error} journeys={continuingNow?null:journeysOnOffer} written={continuingNow?null:writtenShelf} continuation={canContinue?{title:game.story.title,place:game.story.locations.inn.name,shelf:!!writtenShelf}:null} continuing={continuingNow} onContinuing={setContinueRegion}/>)}
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

        {characterChosen && hero && <Adventure table={table} hero={hero} game={game} setGame={setGame} health={health} setHealth={setHealth}/>}
      </>}
      {screen === 'Multiplayer' && <SharedTable table={table} hero={hero} game={game} roster={roster} busy={saving||loading||creatingStory} heroForTable={heroForTable} onNewHero={onTableHero} onChooseTale={onChooseTale} onPlay={()=>{setNewStoryRequested(false);setScreen('Adventure');}}/>}
      {screen === 'Character Creation' && tablePick && <Text style={s.note}>This hero is made for the shared table: once saved, you bring them to your seat there.</Text>}
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
      {screen === 'Character Creation' ? <GameButton icon="back" label={table.joined?'Back to the table':'Back to heroes'} onPress={() => setScreen(table.joined?'Multiplayer':'Character Selection')} disabled={loading||creatingStory}/> : screen === 'Adventure Opening' && table.joined ? <GameButton icon="back" label="Back to the table" onPress={() => setScreen('Multiplayer')} disabled={loading||creatingStory}/> : screen==='Legal' ? <GameButton icon="back" label={legalFrom==='Settings'?'Back to settings':'Main menu'} onPress={()=>setScreen(legalFrom==='Settings'?'Settings':'Home')}/> : screen==='Settings'&&returnToGame&&saved ? <GameButton icon="back" label="Back to the adventure" onPress={backToGame} variant="primary"/> : screen !== 'Home' && !(gameScreen&&screen!=='Adventure') && screen!=='Level Up' && <GameButton icon="back" label="Main menu" onPress={() => setScreen('Home')} disabled={loading||creatingStory}/>}
    </Panel>
    </View>;
}
