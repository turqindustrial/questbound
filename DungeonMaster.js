import {castMenu,attackActions,inBattle,speakAction} from './quickActions';
import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {npcArtSubject,creatureArtSubject,placeArtSubject,locationArtSubject} from './worldArtRules';
import {subscribeArt,artIdentity} from './artClient';
import TurnPlayback from './TurnPlayback';
import {activeEffectLines,visibleTurn} from './playbackRules';
import {storyPreferences,subscribeStoryPreferences,narratorOf} from './storyPreferences';
import {skirmishHint} from './skirmishGuide';
import {attitudeLabel} from './relationshipRules';
import React,{useState,useEffect,useRef,useMemo} from 'react';
import Icon from './Icon';
import {chipLayout} from './fitRules';
import {shortcutsBlocked} from './keyboard';
import {View,Text as PlainText,TextInput,Pressable,useWindowDimensions} from 'react-native';
import {colors,tint} from './theme';
import {playSound} from './audio';
import {touchKeyboard} from './webLayout';
import {gearedHero} from './inventoryRules';
import {combatBasics} from './combatRules';
import ActionGuide from './ActionGuide';
import {replyIdeas} from './greetings';
import {openFeedback} from './Feedback';
import {useDmTurn} from './useDmTurn';
import {s} from './dmStyles';
import SuggestionsBar,{ideaChipsFor} from './DmSuggestions';
import DmHeader from './DmHeader';
// Suggestions (out of battle): open or closed, and the sub-tab (say, speak or actions) last chosen, per device.
const panelKey='questbound.suggestions.v1';
const loadPanel=()=>{try{const v=JSON.parse(globalThis.localStorage?.getItem(panelKey)??'null');return {open:v?.open===true,tab:['say','speak','actions'].includes(v?.tab)?v.tab:'say'};}catch{return {open:false,tab:'say'};}};
export default function DungeonMaster({hero,game,health,act,onConversationChange,table,fill=false,quick=[],sendRef,onTyping}) {
  const {width:viewWidth,height:viewHeight}=useWindowDimensions(),compact=viewWidth<600,short=viewHeight<520;
  // Typing on a phone: while the message box has the keyboard, the story keeps the screen and the action row,
  // header and tabs step aside. Losing focus for an instant (a tap on Send) does not flip the layout back.
  const [focused,setFocused]=useState(false),blurTimer=useRef(null);
  const onFocus=()=>{clearTimeout(blurTimer.current);setFocused(true);},onBlur=()=>{clearTimeout(blurTimer.current);blurTimer.current=setTimeout(()=>setFocused(false),180);};
  useEffect(()=>()=>clearTimeout(blurTimer.current),[]);
  const typing=fill&&focused&&touchKeyboard();
  useEffect(()=>{onTyping?.(typing);return()=>onTyping?.(false);},[typing]);
 // The narrator's name heads the story (Settings → Story or the New Adventure screen choose who tells it).
 const [teller,setTeller]=useState(()=>narratorOf(storyPreferences().narrator));
 useEffect(()=>subscribeStoryPreferences(p=>setTeller(narratorOf(p.narrator))),[]);
  const creature=creatureArtSubject(game),creatureKey=creature?artIdentity(creature):null;
  useEffect(()=>creature?subscribeArt(creature,()=>{}):undefined,[creatureKey]);
  // The turn with the Dungeon Master (useDmTurn.js): the connection, the words sent, the reply applied, people who speak
  // first, and the state the screen shows while it happens.
  const {direct,setDirect,openConversation,conversationId,setConversationId,animateId,playing,setPlaying,people,person,alone,setAlone,ideas,connected,checked,unpaired,status,inputRef,input,setInput,reply,busy,error,errorProblem,fingerprint,draft,engage,lastTurnId,waiting,tableSyncing,turnsNow,turnWait,ask}=useDmTurn({hero,game,health,act,onConversationChange,table,compact});
  // Each new turn brings the action row back to its first (main) action.
  const [spellsOpen,setSpellsOpen]=useState(false),[guide,setGuide]=useState(false),[castSpell,setCastSpell]=useState(null);
  // The Attack… picker, and the target chosen in it (null: the foe, or nobody yet when only people are here).
  const [attackOpen,setAttackOpen]=useState(false),[attackTarget,setAttackTarget]=useState(null);
  const closeAttack=()=>{setAttackOpen(false);setAttackTarget(null);};
  // A one-time "How to play" card for new players; dismissed once per device.
  const [tips,setTips]=useState(()=>{try{return !globalThis.localStorage?.getItem('questbound.tips.v1');}catch{return false;}});
  // A player who read the primer while their tale was written needs only a reminder; the Skirmish teaches as it goes.
  const [primed]=useState(()=>{try{return !!globalThis.localStorage?.getItem('questbound.primer.v1');}catch{return false;}});
  const lesson=tips?skirmishHint(game,health,combatBasics(gearedHero(hero,game)).hp):null;
  const dismissTips=()=>{setTips(false);try{globalThis.localStorage?.setItem('questbound.tips.v1','seen');}catch{}};
  useEffect(()=>{if(tips&&lastTurnId>=3)dismissTips();},[lastTurnId]);
  useEffect(()=>{setSpellsOpen(false);setCastSpell(null);closeAttack();},[lastTurnId]);
  // Tell the table while this player is taking a turn, so others wait instead of racing.
  useEffect(()=>{table?.setActing?.(busy);},[busy]);
  // A party's fight goes in turns (adventureRules.js): on someone else's turn this device waits; after a minute and a
  // half (or at once when their player has left the table) it may pass that turn.
  const turnKey=turnWait?turnsNow.round+':'+turnWait.id:'';
  const [patience,setPatience]=useState('');
  useEffect(()=>{if(!turnKey)return;const timer=setTimeout(()=>setPatience(turnKey),90000);return()=>clearTimeout(timer);},[turnKey]);
  const awayFromTable=turnWait?.kind==='hero'&&!!table?.joined&&!(table.players??[]).some(p=>p.id===turnWait.id);
  const canPass=turnWait?.kind==='hero'&&(awayFromTable||patience===turnKey);
  // The turn has come round to this player: a sound, once a turn.
  const myTurnKey=turnsNow?.mine?turnsNow.round+':'+turnsNow.current?.id:'';
  useEffect(()=>{if(myTurnKey&&turnsNow.entries.filter(e=>e.kind==='hero').length>1)playSound('select');},[myTurnKey]);
  // After the Dungeon Master admits out of character that something went wrong: one tap tells the host, with the
  // player's own words already in the note.
  const faultChip=reply?.fault?<View style={s.faultRow}><PlainText style={s.faultText}>The Dungeon Master agrees this went wrong.</PlainText><Pressable accessibilityRole="button" accessibilityLabel="Tell the host about this" onPress={()=>{playSound('open');openFeedback({problem:reply.fault.problem,prefill:reply.fault.said});}} dataSet={{qb:'chip',keepfocus:'true'}} style={s.reportChip}><Icon name="feedback" size={13} color={colors.gold}/><PlainText style={s.reportText}>Tell the host about this</PlainText></Pressable></View>:null;
  const turns=(person?(game.playback??[]).filter(t=>t.npcId===person.id||(t.participants??[]).some(id=>people.some(n=>n.id===id))):(game.playback??[])).map(t=>visibleTurn(t,game));
  const effects=activeEffectLines(game,health);
  // Names the playback uses to move the HUD's HP bars in step with the story, and portraits for speakers.
  const foeTitle=game.wildFight?.name??game.story?.foe??'Encounter opponent',names=useMemo(()=>({hero:hero.name,foe:foeTitle}),[hero.name,foeTitle]);
  const avatarFor=id=>id?npcArtSubject(game,id):null,sceneFor=name=>placeArtSubject(game,name);
  const previousNarration=(game.journal?.entries??[]).filter(e=>e.title==='AI DM conversation').at(-1)?.text.split(/\n(?:AI DM|Dungeon Master): /).at(-1)?.split('\nResult:')[0];
  const standing=attitudeLabel(person),attitude={label:standing.label,color:{bad:colors.bloodBright,warn:tint('#e0a860'),good:colors.heal,best:colors.goldBright,calm:colors.heal,dead:colors.muted}[standing.tone]};
  const dead=game.stage==='dead',dying=game.stage==='dying';
  const sendDisabled=busy||playing||!input.trim()||!!waiting||tableSyncing||(dead&&!direct)||(!!turnWait&&!direct);
  const statusText=busy?(compact?'Resolving…':'Resolving your turn…'):playing?(compact?'Playing…':'Playing turn…'):connected?'Connected':checked?'Offline':'Connecting…';
  const statusColor=busy||playing||!checked?colors.gold:connected?colors.heal:tint('#7d1b2e');
  const hint=tableSyncing?'Catching up with the shared table…':waiting?'⏳ '+waiting+' is taking a turn. Wait for the table.':null;
  // Quick actions: one tap sends; Cast… starts the sentence so the player names the spell and target.
  if(sendRef)sendRef.current=preset=>ask(preset);
  // Battle (inBattle in quickActions.js: a creature fight, a brawl, a party's turn order, the hero dying): the action
  // buttons stay in view, because they remind the player what a turn can be. Everywhere else they fold into
  // Suggestions, closed until the player opens it: the message box and the story are the main thing.
  const battle=inBattle(game)||!!turnsNow;
  // Cast… swaps the row for the hero's spells: cantrips, then each spell level with its slots left (castMenu). A
  // levelled spell with more than one way to cast opens the slot organizer: each slot level it can take, a ritual or
  // a free casting, the lowest first, with what a higher slot gains. Its Back chip carries the spell's name, so the
  // ways to cast it start on the first line even on a phone.
  const menu=spellsOpen?castMenu(hero,game):[],choosing=castSpell?menu.find(a=>a.key===castSpell&&a.casts?.length>1)??null:null;
  const spellRow=choosing?[{key:'cast-back',glyph:'‹',icon:'back',label:choosing.label,detail:choosing.key.includes(':party:')?String(choosing.detail??'').split(' · ')[0]:'Slot?',run:()=>setCastSpell(null)},...choosing.casts]:[{key:'spells-back',glyph:'‹',icon:'back',label:'Back',run:()=>{setSpellsOpen(false);setCastSpell(null);}},...menu];
  const attackRow=attackOpen?attackActions(hero,game,health,attackTarget).map(a=>a.back?{...a,run:closeAttack}:a.target?{...a,run:()=>setAttackTarget(a.target)}:a):[];
  // Someone else's turn: who it is, and (when their player is away or slow) a way to pass it. Your own: said so.
  const waitRow=turnWait?[{key:'heading:turn-wait',heading:turnWait.name+'’s turn'+(turnWait.status==='down'?' · down':''),strong:true},...(canPass?[{key:'party-pass',glyph:'»',icon:'forward',label:'Skip '+turnWait.name.split(' ')[0],detail:awayFromTable?'Away':'Slow',question:'I pass '+turnWait.name+'’s turn: their player is away.',action:{type:'party-pass'}}]:[])]:null;
  // Out of battle the chips about people (an offer to come along, a fallen companion to revive) go under Speak with
  // the people here; the rest are the Actions.
  const turnRow=turnsNow?.mine&&quick.length?[{key:'heading:your-turn',heading:'Your turn',strong:true},...quick]:quick;
  const speakQuick=battle?[]:quick.filter(a=>speakAction(a.key)),calmQuick=battle?quick:quick.filter(a=>!speakAction(a.key));
  const actions=person?[]:waitRow??(spellsOpen?spellRow:attackOpen?attackRow:battle?turnRow:calmQuick),actionsDisabled=busy||playing||!!waiting||tableSyncing;
  const runAction=a=>{
    if(a.person){engage(a.person);return;}
    if(a.key==='cast'){closeAttack();setCastSpell(null);setSpellsOpen(true);return;}
    if(a.key==='attack-menu'){setSpellsOpen(false);setAttackOpen(true);return;}
    if(a.heading)return;
    if(a.casts?.length>1){setCastSpell(a.key);return;}
    if(attackOpen&&a.action)closeAttack();
    if(a.run){a.run();return;}
    if(a.key.startsWith('spell:')){setSpellsOpen(false);setCastSpell(null);}
    if(a.prefill){setInput(a.prefill);setTimeout(()=>inputRef.current?.focus(),30);return;}
    ask(a.action?a:{question:a.question,parse:true});
  };
  // Nothing scrolls sideways: the chips wrap, up to a few rows, and a More chip shows the rest in place (WrapRow,
  // chipLayout in fitRules.js). A short screen (a phone on its side) has one row, with people and effects in it so the
  // story keeps its height; a phone or a window of middling height (a small laptop, which also drops the narrator's
  // heading) has two; a roomy screen three. An open Attack… or Cast… picker, or the wait for another hero, gets more.
  const snug=viewHeight<700,fit=chipLayout(viewWidth,viewHeight),tight=fit.tight,chipH=fit.rowHeight;
  // Say: what the Dungeon Master offered with the latest turn, else a few stand-ins worked out here. A tap only fills
  // the message box (it never sends), so the player can change it first.
  const standIns=useMemo(()=>replyIdeas(game,hero,person?.id??null),[fingerprint,person?.id]);
  const ideaLines=direct||dead||dying||!!turnWait||!!waiting?[]:ideas?.turn===lastTurnId&&ideas.person===(person?.id??null)&&ideas.lines.length?ideas.lines:standIns;
  // In battle: the Actions | Say tabs beside the row, as before (never switching by themselves).
  const [tab,setTab]=useState('actions');
  // Out of battle: Suggestions, open or closed, and the sub-tab last chosen, kept per device.
  const [panel,setPanel]=useState(loadPanel);
  const savePanel=next=>{setPanel(next);try{globalThis.localStorage?.setItem(panelKey,JSON.stringify(next));}catch{}};
  const fillIdea=text=>{playSound('click');setInput(text);setTimeout(()=>inputRef.current?.focus(),30);};
  const ideasDisabled=busy||playing;
  // Speak: a chip for each person here (the dead hero speaks to no one), then the offers and revivals about people.
  const speakList=[...(dead?[]:people.filter(n=>n.id!==person?.id).map(n=>({key:'person:'+n.id,person:n.id,label:n.name}))),...speakQuick];
  const calmTabs=[['say','Say',ideaLines.length],['speak','Speak',speakList.length],...(person?[]:[['actions','Actions',actions.filter(a=>!a.heading).length]])];
  const shownTab=calmTabs.some(t=>t[0]===panel.tab)?panel.tab:'say';
  const showIdeas=battle?ideaLines.length>0&&(!actions.length||tab==='say'):panel.open&&shownTab==='say';
  // With a keyboard, 1–9 press the matching chip of whatever is in view (shown as a small key on each chip).
  const visible=battle?(showIdeas?ideaLines.map(text=>({key:'idea:'+text,text})):actions.filter(a=>!a.heading)):!panel.open?[]:shownTab==='say'?ideaLines.map(text=>({key:'idea:'+text,text})):shownTab==='speak'?speakList:actions.filter(a=>!a.heading);
  const keysRef=useRef({});keysRef.current={actions:visible,disabled:showIdeas?ideasDisabled:actionsDisabled,run:a=>a.text?fillIdea(a.text):runAction(a)};
  useEffect(()=>{
    if(typeof document==='undefined')return;
    const onKey=e=>{if(e.ctrlKey||e.metaKey||e.altKey||!/^[1-9]$/.test(e.key)||shortcutsBlocked())return;
      const {actions,disabled,run}=keysRef.current,a=actions[Number(e.key)-1];if(!a||disabled)return;e.preventDefault();if(!a.text)playSound('click');run(a);};
    document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
  },[]);
  const pressable=actions.filter(a=>!a.heading);
  const actionBar=<SuggestionsBar {...{visible,compact,chipH,pressable,actionsDisabled,runAction,game,spellsOpen,attackOpen,tight,actions,setGuide,effects,speakList,person,busy,playing,engage,dead,people,battle,waitRow,viewWidth,viewHeight,fit,lastTurnId,castSpell,shownTab,ideaLines,ideasDisabled,fillIdea,short,showIdeas,setTab,panel,speakQuick,calmQuick,savePanel,direct,calmTabs}}/>;
  // One on one or everyone here: who may answer when others are about.
  const aloneSwitch=people.length>1&&!!person&&<Pressable accessibilityRole="switch" accessibilityState={{checked:alone,disabled:busy||playing}} accessibilityLabel={alone?'Just you two: only '+person.name+' answers. Tap to let everyone here join in':'Everyone here may join in. Tap to speak with '+person.name+' alone'} disabled={busy||playing} onPress={()=>{playSound('click');setAlone(value=>!value);}} dataSet={{qb:alone?'seg-on':'chip',keepfocus:'true'}} style={[s.aloneSwitch,alone&&s.aloneOn,(busy||playing)&&{opacity:.45}]}><Icon name={alone?'speak':'people'} size={14} color={alone?colors.goldBright:colors.gold}/><PlainText numberOfLines={1} style={[s.aloneText,alone&&{color:colors.goldBright}]}>{alone?(compact?'You two':'Just you two'):(compact?'Everyone':'Everyone here')}</PlainText></Pressable>;
  const statusPill=<View style={s.status}><View style={[s.dot,{backgroundColor:statusColor}]}/><Text accessibilityLiveRegion="polite" style={[s.connection,{color:statusColor}]}>{statusText}</Text></View>;
  const composer=<TextInput ref={inputRef} dataSet={{qb:'input',composer:'true'}} onFocus={onFocus} onBlur={onBlur} accessibilityLabel={direct?'Message for the Dungeon Master, out of character':'Action for the Dungeon Master'} editable={!dead||direct} value={input} onChangeText={setInput} maxLength={1000} multiline onKeyPress={event=>{if(event.nativeEvent.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault?.();ask();}}} placeholder={direct?(compact?'Ask the Dungeon Master…':'Ask the Dungeon Master: a ruling, a mistake, or what you meant to do…'):turnWait?(compact?turnWait.name.split(' ')[0]+'’s turn…':'It is '+turnWait.name+'’s turn. Wait for it, or tap DM to ask the Dungeon Master something.'):dead?'Your hero has died.':dying?(compact?'Fight to hold on…':'You are dying. Fight to hold on…'):person?'Speak to '+person.name+'…':game.stage==='combat'||game.npcCombat?.active?(compact?(game.actionUsed?'Bonus action, or end turn…':'Your move…'):game.actionUsed?'A bonus action, or end your turn…':'Your move: attack, cast a spell, dodge, or try something bold…'):'Describe your next move…'} placeholderTextColor={tint('#938890')} style={[s.input,fill&&s.fillInput,fill&&short&&{minHeight:42,paddingVertical:9},direct&&s.inputDirect]}/>;
  // The DM switch: the next message is a word with the Dungeon Master, player to DM.
  const dmSwitch=<Pressable accessibilityRole="switch" accessibilityState={{checked:direct,disabled:busy||playing}} accessibilityLabel="Speak to the Dungeon Master out of character" disabled={busy||playing} onPress={()=>{playSound('click');setDirect(value=>!value);setTimeout(()=>inputRef.current?.focus(),30);}} dataSet={{qb:direct?'seg-on':'chip',keepfocus:'true'}} style={[s.dmSwitch,direct&&s.dmSwitchOn,fill&&short&&{minHeight:42},(busy||playing)&&{opacity:.45}]}><Icon name="speak" size={16} color={direct?colors.goldBright:colors.gold}/><PlainText style={[s.dmSwitchText,direct&&{color:colors.goldBright}]}>DM</PlainText></Pressable>;
  const sendLabel=tableSyncing?'Catching up…':busy?'Resolving…':playing?'Playing…':waiting||turnWait&&!direct?'Waiting…':direct?'Ask':'Send';
  const sendButton=<Pressable accessibilityRole="button" accessibilityLabel="Send to the Dungeon Master" accessibilityState={{disabled:sendDisabled}} disabled={sendDisabled} onPress={()=>ask()} dataSet={{qb:'btn-primary',keepfocus:'true'}} style={[s.button,fill&&s.fillSend,fill&&short&&{minHeight:42,paddingVertical:8},fill&&compact&&{paddingHorizontal:14,minWidth:52},sendDisabled&&{opacity:0.45}]}><View style={s.sendRow}>{fill&&compact?(busy||playing?<Icon name="dots" size={20} color={tint('#ffeef0')}/>:<Icon name="send" size={20} color={tint('#ffeef0')} strokeWidth={2}/>):<><PlainText style={s.buttonText}>{sendLabel}</PlainText>{!busy&&!playing&&!waiting&&!tableSyncing&&<Icon name="send" size={16} color={tint('#ffeef0')} strokeWidth={2}/>}</>}</View></Pressable>;
  if(fill)return <View dataSet={{qb:'plate'}} style={[s.panel,s.fill,person&&s.conversation,(compact||short)&&s.fillCompact]}>
    <DmHeader {...{person,typing,short,busy,playing,setConversationId,game,compact,attitude,aloneSwitch,snug,teller,statusPill}}/>
    {!connected&&checked&&<View accessibilityLiveRegion="polite" style={[s.notice,unpaired&&{borderColor:tint('rgba(224,74,92,.55)')}]}>
      <Icon name={unpaired?'key':'wait'} size={16} color={unpaired?colors.gold:colors.muted}/>
      <View style={{flex:1,minWidth:0,gap:8}}>
        <PlainText style={[s.noticeText,unpaired&&{color:tint('#e18a95')}]}>{status}</PlainText>
        {unpaired&&<Pressable accessibilityRole="button" onPress={()=>globalThis.location?.reload()} dataSet={{qb:'btn-primary'}} style={[s.button,{alignSelf:'flex-start',minHeight:40,paddingVertical:8}]}><View style={s.sendRow}><Icon name="key" size={15} color={tint('#ffeef0')}/><PlainText style={s.buttonText}>Reload and rejoin</PlainText></View></Pressable>}
      </View>
    </View>}
    <TurnPlayback fill names={names} avatarFor={avatarFor} sceneFor={sceneFor} openingScene={!person&&game.story?placeArtSubject(game,game.story.locations?.[game.story.introId==='hostile'?'bridge':'inn']?.name):null} intro={tips&&!person?<View dataSet={{qb:'plate'}} style={s.tips}>
      <View style={s.tipsHead}><Icon name="star" size={14} color={colors.gold}/><PlainText style={s.tipsTitle}>How to play</PlainText></View>
      {primed?<View style={s.tipRow}><Icon name="quill" size={15} color={colors.gold}/><PlainText style={s.tipsText}>As you read while you waited: type what you want to do. Suggestions, above the message box, has ideas when you want them. If something goes wrong, tap DM and tell the Dungeon Master.</PlainText></View>:<>
      <View style={s.tipRow}><Icon name="quill" size={15} color={colors.gold}/><PlainText style={s.tipsText}>Type what you want to do or say, in your own words.</PlainText></View>
      <View style={s.tipRow}><Icon name="star" size={15} color={colors.gold}/><PlainText style={s.tipsText}>Stuck? Suggestions, above the message box, has ideas: things to say, people to speak with, and actions such as travel or rest. In a fight your moves stay on screen as buttons{compact?'':' (or press their number keys)'}.</PlainText></View>
      <View style={s.tipRow}><Icon name="d20" size={15} color={colors.gold}/><PlainText style={s.tipsText}>The Dungeon Master decides what happens; the dice decide how it goes.</PlainText></View>
      <View style={s.tipRow}><Icon name="speak" size={15} color={colors.gold}/><PlainText style={s.tipsText}>Something went wrong, or you meant something else? Tap DM beside the message box and tell the Dungeon Master.</PlainText></View>
      <View style={s.tipRow}><Icon name="menu" size={15} color={colors.gold}/><PlainText style={s.tipsText}>Tap an underlined name to learn more. The menu holds your character sheet, journal, settings and feedback.</PlainText></View></>}
      <Pressable accessibilityRole="button" onPress={dismissTips} dataSet={{qb:'chip'}} style={s.tipsButton}><Icon name="check" size={14} color={colors.gold}/><PlainText style={s.tipsButtonText}>Got it</PlainText></Pressable>
    </View>:null} aside={(short||compact||snug)&&!person?statusPill:null} typing={typing} me={table?.joined?table.name:null} turns={turns} animateId={animateId} onPlayingChange={setPlaying} busy={busy} opening={person?'You turn to '+person.name+'.':previousNarration??game.story?.opening??'Describe what you do. Your story unfolds here.'}/>
    {!!hint&&<Text style={[s.hint,{color:colors.gold,marginTop:6}]}>{hint}</Text>}
    {tips&&lesson&&!person&&<View dataSet={{qb:'enter'}} style={s.lesson}><Icon name="info" size={14} color={colors.goldMid}/><PlainText style={s.lessonText}>{lesson}</PlainText></View>}
    {busy&&!!draft&&<View dataSet={{qb:'plate'}} accessibilityLiveRegion="polite" style={s.draft}><Icon name="quill" size={14} color={colors.gold}/><PlainText numberOfLines={compact?3:5} style={s.draftText}>{draft}</PlainText></View>}
    {!typing&&actionBar}
    <ActionGuide visible={guide} onClose={()=>setGuide(false)} actions={pressable} hero={hero} game={game} spells={spellsOpen} disabled={actionsDisabled} onRun={runAction}/>
    {direct&&<View style={s.directNote}><Icon name="speak" size={13} color={colors.goldBright}/><PlainText style={s.directText}>{compact?'Out of character: the story waits.':'Out of character. Ask about a ruling, or say what went wrong or what you meant to do: the story waits, and the Dungeon Master can take your last turn back.'}</PlainText></View>}
    <View style={s.composer}>{dmSwitch}{composer}{sendButton}</View>
    {!!error&&<View accessibilityRole="alert" style={s.errorRow}><Icon name="info" size={15} color={colors.danger}/><Text style={[s.error,{marginTop:0,flex:1}]}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Report this problem to the host" onPress={()=>{playSound('open');openFeedback({problem:errorProblem?.error===error?errorProblem:{kind:'dm',error,stage:game.stage}});}} dataSet={{qb:'chip',keepfocus:'true'}} style={s.reportChip}><Icon name="feedback" size={13} color={colors.gold}/><PlainText style={s.reportText}>Report</PlainText></Pressable></View>}
    {!!reply?.fault&&!error&&faultChip}
    {reply?.pending&&<Text style={s.caption}>Suggested action: {reply.pending.label}. Send “confirm action” to carry it out.</Text>}
  </View>;
  return <View dataSet={{qb:'plate'}} style={[s.panel,person&&s.conversation,compact&&{padding:14}]}>
    {person?<View><Pressable accessibilityRole="button" disabled={busy||playing} onPress={()=>setConversationId(null)} style={s.back}><Text style={s.backText}>‹  Back to adventure</Text></Pressable><View style={s.portraitRow}><DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,person.id)} style={[s.portrait,compact&&{width:132,height:156}]}/><View style={{flex:1,minWidth:150}}><Text style={s.overline}>{people.length>1?'GROUP CONVERSATION':'IN CONVERSATION'}</Text><PlainText style={[s.personName,compact&&{fontSize:24}]}>{person.name}</PlainText><Text style={s.role}>{person.role}{person.trainedAs?' · Level '+person.trainedAs.level+' '+person.trainedAs.class:''}</Text><View style={s.attitude}><View style={[s.dot,{backgroundColor:attitude.color}]}/><Text style={[s.attitudeText,{color:attitude.color}]}>{attitude.label}</Text></View></View></View>{people.length>1&&<View style={s.group}>{people.map(n=><Pressable key={n.id} accessibilityRole="button" accessibilityLabel={'Address '+n.name} disabled={busy||playing} onPress={()=>openConversation(n.id)} dataSet={{qb:'chip'}} style={[s.groupMember,n.id===person.id&&s.groupActive]}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={s.avatar} compact/><PlainText style={s.chipText}>{n.name}</PlainText></Pressable>)}{aloneSwitch}</View>}</View>:<View style={s.header}><View><Text style={s.overline}>YOUR NARRATOR</Text><Text style={s.heading}>The Dungeon Master</Text></View><View style={s.status}><View style={[s.dot,{backgroundColor:busy||playing?colors.gold:connected?colors.heal:tint('#7d1b2e')}]}/><Text accessibilityLiveRegion="polite" style={[s.connection,{color:busy||playing?colors.gold:connected?tint('#a6d8b8'):tint('#d8b879')}]}>{busy?'Resolving your turn…':playing?'Playing turn…':connected?'Connected':'Offline'}</Text></View></View>}
    
    {!connected&&<Text style={s.caption}>{status}</Text>}
    <TurnPlayback me={table?.joined?table.name:null} turns={turns} animateId={animateId} onPlayingChange={setPlaying} busy={busy} opening={person?'You turn to '+person.name+'.':previousNarration??game.story?.opening??'Describe what you do. Your story unfolds here.'}/>
    <Text style={s.prompt}>{person?'What do you say?':'What do you do?'}</Text>
    {ideaLines.length>0&&<View accessibilityLabel="Suggestions" style={[s.ideaWrap,{marginBottom:10}]}>{ideaChipsFor({ideaLines,ideasDisabled,fillIdea,short,chipH,compact,showIdeas})}</View>}
    <TextInput dataSet={{qb:'input'}} accessibilityLabel="Action for the Dungeon Master" value={input} onChangeText={setInput} maxLength={1000} multiline onKeyPress={event=>{if(event.nativeEvent.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault?.();ask();}}} placeholder={person?'Speak to '+person.name+'…':'Describe your next move…'} placeholderTextColor={tint('#938890')} style={s.input}/>
    <View style={s.toolbar}><Text style={[s.hint,!!waiting&&{color:colors.gold}]}>{tableSyncing?'Catching up with the shared table…':waiting?'⏳ '+waiting+' is taking a turn. Wait for the table.':compact?'Tap Send to DM':'Enter to send · Shift+Enter for a new line'}</Text><Pressable accessibilityRole="button" accessibilityState={{disabled:busy||playing||!input.trim()||!!waiting||tableSyncing}} disabled={busy||playing||!input.trim()||!!waiting||tableSyncing} onPress={()=>ask()}dataSet={{qb:'btn-primary'}} style={[s.button,(busy||playing||!input.trim()||!!waiting||tableSyncing)&&{opacity:0.45}]}><Text style={s.buttonText}>{tableSyncing?'Catching up…':busy?'Resolving…':playing?'Playing turn…':waiting?'Waiting…':'Send to DM  ➤'}</Text></Pressable></View>
    {effects.length>0&&<View style={s.effects}><Text style={[s.overline,{color:colors.arcane}]}>✧ ONGOING EFFECTS</Text>{effects.map(line=><Text key={line} style={s.effectText}>{line}</Text>)}</View>}
    {!person&&people.length>0&&<View style={s.people}><Text style={s.overline}>PEOPLE NEARBY</Text>{people.map(n=><Pressable key={n.id} accessibilityRole="button" disabled={busy||playing} onPress={()=>engage(n.id)} dataSet={{qb:'chip'}} style={s.personButton}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={s.avatar} compact/><View style={{flexShrink:1}}><PlainText style={s.chipName}>{n.name}</PlainText><PlainText style={s.chipRole} numberOfLines={1}>{n.role}</PlainText></View><PlainText style={s.chipAction} numberOfLines={1}>Speak ›</PlainText></Pressable>)}</View>}
    {!!error&&<View accessibilityRole="alert" style={[s.errorRow,{marginTop:12}]}><Text style={[s.error,{marginTop:0,flex:1}]}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Report this problem to the host" onPress={()=>{playSound('open');openFeedback({problem:errorProblem?.error===error?errorProblem:{kind:'dm',error,stage:game.stage}});}} dataSet={{qb:'chip',keepfocus:'true'}} style={s.reportChip}><Icon name="feedback" size={13} color={colors.gold}/><PlainText style={s.reportText}>Report</PlainText></Pressable></View>}
    {!!reply?.fault&&!error&&faultChip}
    {reply?.pending&&<Text style={s.caption}>Suggested action: {reply.pending.label}. Send “confirm action” to carry it out.</Text>}
    {reply?.pending&&reply.snapshot!==fingerprint&&<Text style={s.caption}>The scene changed. Send a new message for a current suggestion.</Text>}
  </View>;
}
