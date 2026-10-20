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
import {KeyHint,IconButton,WrapRow} from './ui';
import {chipLayout} from './fitRules';
import {shortcutsBlocked} from './keyboard';
import {View,Text as PlainText,TextInput,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import {fonts,colors,type,tint} from './theme';
import {playSound} from './audio';
import {touchKeyboard} from './webLayout';
import {gearedHero} from './inventoryRules';
import {combatBasics} from './combatRules';
import ActionGuide from './ActionGuide';
import {replyIdeas} from './greetings';
import {openFeedback} from './Feedback';
import {useDmTurn} from './useDmTurn';
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
  const hintOf=a=>{const i=visible.indexOf(a);return !compact&&i>=0&&i<9?i+1:null;};
  const actionChip=a=>{
    // A heading in the Attack… or Cast… picker (Melee, Ranged, Cantrips, Level 2): a small label, not a button.
    if(a.heading)return <View key={a.key} dataSet={{qb:'action-heading'}} style={[s.actionHeading,{height:chipH}]}><PlainText style={[s.actionHeadingText,a.quiet&&{color:colors.faint},a.strong&&s.actionHeadingStrong]}>{a.heading}</PlainText></View>;
    const i=pressable.indexOf(a),lead=a.primary&&!a.prefill,hint=hintOf(a);return <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.casts?.length>1?a.label+': choose a slot':a.key==='cast-back'?'Back to your spells (choosing a slot for '+a.label+')':a.key==='cast'?'Cast a spell: start typing it':a.prefill?a.label+': start the sentence, then name the target':a.question??a.label} accessibilityState={{disabled:actionsDisabled}} disabled={actionsDisabled} onPress={()=>runAction(a)} onHoverIn={()=>!actionsDisabled&&playSound('tick')} dataSet={{qb:lead?'btn-primary':'chip',pulse:lead&&i===0&&game.stage==='combat'&&!actionsDisabled&&!spellsOpen&&!attackOpen?'on':'off'}} style={[s.action,tight&&s.actionTight,lead&&s.actionPrimary,actionsDisabled&&{opacity:.45}]}>
    <Icon name={a.icon??'star'} size={tight?14:16} color={lead?tint('#ffeef0'):colors.gold}/>
    <PlainText numberOfLines={1} style={[s.actionText,tight&&s.actionTextTight,lead&&s.actionPrimaryText]}>{a.label}</PlainText>
    {!!a.detail&&<PlainText numberOfLines={1} style={[s.actionDetail,{flexShrink:0}]}>{a.detail}</PlainText>}
    {a.casts?.length>1&&<Icon name="forward" size={12} color={colors.goldMid}/>}
    {!!hint&&<KeyHint dark={lead}>{hint}</KeyHint>}
  </Pressable>;};
  const actionChips=actions.map(actionChip);
  // The guide: what every action (or spell) in the row does, one tap away.
  if(actions.length)actionChips.push(<Pressable key="guide" accessibilityRole="button" accessibilityLabel={spellsOpen?'What these spells do':'What these actions do'} onPress={()=>{playSound('open');setGuide(true);}} dataSet={{qb:'chip'}} style={[s.action,tight&&s.actionTight,{paddingHorizontal:11}]}><Icon name="info" size={tight?14:16} color={colors.gold}/></Pressable>);
  const effectChips=effects.map(line=><View key={'effect:'+line} style={[s.effectChip,{height:chipH-4}]}><Icon name="spell" size={13} color={colors.arcane}/><Text numberOfLines={1} style={s.effectChipText}>{line}</Text></View>);
  const personChip=n=>{const a=speakList.find(x=>x.person===n.id),hint=a?hintOf(a):null;return <Pressable key={'person:'+n.id} accessibilityRole="button" accessibilityLabel={(person?'Address ':'Speak with ')+n.name} disabled={busy||playing} onPress={()=>engage(n.id)} dataSet={{qb:'chip'}} style={[s.personChip,{height:chipH}]}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={[s.chipAvatar,tight&&s.chipAvatarTight]} compact/><PlainText numberOfLines={1} style={[s.chipName,tight&&{fontSize:13}]}>{n.name}</PlainText><View style={s.chipSpeak}><Icon name="speak" size={13} color={colors.gold}/>{!tight&&<PlainText style={s.chipAction}>{person?'Address':'Speak'}</PlainText>}</View>{!!hint&&<KeyHint>{hint}</KeyHint>}</Pressable>;};
  const peopleChips=(dead?[]:people.filter(n=>n.id!==person?.id)).map(personChip);
  const extraChips=[...effectChips,...(battle?peopleChips:[])];
  const picker=spellsOpen||attackOpen||!!waitRow;
  const {rows:chipRows,openRows}=chipLayout(viewWidth,viewHeight,{picker});
  const row=(chips,rows,key)=>chips.length>0&&<WrapRow key={key} rows={rows} openRows={openRows} rowHeight={chipH} gap={fit.gap} resetKey={lastTurnId+':'+spellsOpen+':'+attackOpen+':'+castSpell+':'+shownTab} label={key==='say'||key==='ideas'?'Suggestions':'Quick actions'} dataSet={{qb:'actions'}} style={s.actionBar}>{chips}</WrapRow>;
  // A suggestion is a short thing to say in the hero's own voice; a tap writes it into the box (it never sends). The
  // suggestions wrap onto a second line rather than scrolling sideways.
  const ideaChips=ideaLines.map((text,i)=><Pressable key={'idea:'+text} accessibilityRole="button" accessibilityLabel={'Suggestion: '+text} accessibilityState={{disabled:ideasDisabled}} disabled={ideasDisabled} onPress={()=>fillIdea(text)} onHoverIn={()=>!ideasDisabled&&playSound('tick')} dataSet={{qb:'chip',keepfocus:'true'}} style={[s.ideaChip,short&&{minHeight:0,height:chipH,paddingVertical:0},ideasDisabled&&{opacity:.45}]}><Icon name="quill" size={13} color={colors.goldMid}/><PlainText numberOfLines={short?1:2} style={[s.ideaText,short&&{fontSize:14}]}>{text}</PlainText>{!compact&&showIdeas&&i<9&&<KeyHint>{i+1}</KeyHint>}</Pressable>);
  const ideaRow=<View dataSet={{qb:'actions'}} accessibilityLabel="Suggestions" style={[s.actionBar,s.ideaWrap]}>{ideaChips}</View>;
  // In battle: Actions | Say. A short screen (a phone on its side) has one row of chips: the two tabs would fill it, so
  // a single small switch (a quill and the count, or the way back to the actions) stands before the row, and the
  // suggestions sit in the same height-limited row as the actions (one line each, the rest behind More), so the
  // message box always stays in view. The switch is outside the row so the first chip leads its own line.
  const tabButton=(id,label,count)=>{const on=id==='say'?showIdeas:!showIdeas;return <Pressable key={'tab:'+id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected:on}} onPress={()=>{if(on)return;playSound('click');setTab(id);}} dataSet={{qb:on?'seg-on':'chip',keepfocus:'true'}} style={[s.tab,on&&s.tabOn]}><PlainText style={[s.tabText,on&&s.tabTextOn]}>{label}</PlainText>{!on&&count>0&&<View style={s.tabCount}><PlainText style={s.tabCountText}>{count}</PlainText></View>}</Pressable>;};
  const tabButtons=ideaLines.length>0?[...(actions.length?[tabButton('actions','Actions',0)]:[]),tabButton('say','Say',ideaLines.length)]:[];
  const tabStrip=tabButtons.length>0&&<View accessibilityRole="tablist" style={s.tabs}>{tabButtons}</View>;
  const tabSwitch=tabButtons.length>1?[<Pressable key="tab:switch" accessibilityRole="tab" accessibilityLabel={showIdeas?'Actions':'Say ('+ideaLines.length+')'} accessibilityState={{selected:showIdeas}} onPress={()=>{playSound('click');setTab(showIdeas?'actions':'say');}} dataSet={{qb:showIdeas?'seg-on':'chip',keepfocus:'true',tab:'switch'}} style={[s.tab,{height:chipH,paddingHorizontal:9},showIdeas&&s.tabOn]}>{showIdeas?<><Icon name="back" size={13} color={colors.goldBright}/><PlainText style={[s.tabText,s.tabTextOn]}>Actions</PlainText></>:<><Icon name="quill" size={14} color={colors.goldMid}/><View style={s.tabCount}><PlainText style={s.tabCountText}>{ideaLines.length}</PlainText></View></>}</Pressable>]:[];
  const shortRow=showIdeas?row([...ideaChips,...extraChips],chipRows,'ideas'):row([...actionChips,...extraChips],chipRows,'all');
  const battleBar=short?(tabSwitch.length?<View style={s.switchRow}><View style={s.switchCell}>{tabSwitch}</View><View style={{flex:1,minWidth:0}}>{shortRow}</View></View>:shortRow):<>{row(extraChips,1,'extra')}{tabStrip}{showIdeas?ideaRow:row(actionChips,chipRows,'actions')}</>;
  // Out of battle: one Suggestions switch above the message box (closed unless the player keeps it open) that opens
  // onto Say, Speak and Actions. A dot on the closed switch says something new waits there (loot, an offer, a level).
  const fresh=!panel.open&&(speakQuick.length>0||calmQuick.some(a=>a.primary));
  const suggestToggle=<Pressable key="suggest" accessibilityRole="button" accessibilityState={{expanded:panel.open}} accessibilityLabel={panel.open?'Hide suggestions':'Suggestions: things to say, people to speak with, and actions'+(fresh?' (something new)':'')} onPress={()=>{playSound('click');savePanel({...panel,open:!panel.open});}} dataSet={{qb:panel.open?'seg-on':'chip',keepfocus:'true',suggest:'toggle'}} style={[s.tab,short&&{height:chipH,minHeight:0},panel.open&&s.tabOn]}>
    {panel.open&&(compact||short)?<Icon name="close" size={14} color={colors.goldBright}/>:<><Icon name="star" size={14} color={panel.open?colors.goldBright:colors.goldMid}/><PlainText style={[s.tabText,panel.open&&s.tabTextOn]}>Suggestions</PlainText>{panel.open&&<Icon name="close" size={12} color={colors.goldBright}/>}</>}
    {fresh&&<View dataSet={{qb:'fresh'}} style={s.freshDot}/>}
  </Pressable>;
  // The narrowest phones (under 360 wide) leave the counts off so the switch and the three tabs keep to one line.
  const narrowTabs=viewWidth<360;
  const subTab=([id,label,count])=>{const on=id===shownTab;return <Pressable key={'sub:'+id} accessibilityRole="tab" accessibilityLabel={label+(count?' ('+count+')':'')} accessibilityState={{selected:on}} onPress={()=>{if(on)return;playSound('click');savePanel({...panel,tab:id});}} dataSet={{qb:on?'seg-on':'chip',keepfocus:'true',suggest:id}} style={[s.tab,short&&{height:chipH,minHeight:0,paddingHorizontal:9},narrowTabs&&{paddingHorizontal:10},on&&s.tabOn]}>{short?<Icon name={{say:'quill',speak:'speak',actions:'compass'}[id]} size={15} color={on?colors.goldBright:colors.gold}/>:<PlainText style={[s.tabText,on&&s.tabTextOn]}>{label}</PlainText>}{!on&&!short&&!narrowTabs&&count>0&&<View style={s.tabCount}><PlainText style={s.tabCountText}>{count}</PlainText></View>}</Pressable>;};
  const quiet=text=><View key="quiet" style={[s.quietRow,short&&{height:chipH,minHeight:0}]}><PlainText numberOfLines={short?1:2} style={s.quietText}>{text}</PlainText></View>;
  const calmContent=!panel.open?null:shownTab==='say'?(ideaLines.length?(short?row(ideaChips,chipRows,'say'):ideaRow):quiet(direct?'Out of character: say what you need to the Dungeon Master.':'Nothing to suggest just now. Type what you say or do, in your own words.'))
    :shownTab==='speak'?(speakList.length?row([...peopleChips,...speakQuick.map(actionChip)],chipRows,'speak'):quiet('No one here to speak with. Type what you do, or travel somewhere new.'))
    :(actionChips.length||effectChips.length?row([...actionChips,...effectChips],chipRows,'actions'):quiet('Nothing to tap just now. Type what you do.'));
  const calmBar=calmTabs.every(t=>!t[2])&&!panel.open&&!effects.length?null:short?<View style={s.switchRow}><View accessibilityRole="tablist" style={[s.switchCell,s.subTabs]}>{suggestToggle}{panel.open&&!(picker&&shownTab==='actions')&&calmTabs.map(subTab)}</View><View style={{flex:1,minWidth:0}}>{calmContent}</View></View>
    :<View style={s.suggestPanel}><View accessibilityRole="tablist" style={s.tabs}>{suggestToggle}{panel.open&&calmTabs.map(subTab)}</View>{calmContent}</View>;
  const actionBar=battle?battleBar:calmBar;
  // One on one or everyone here: who may answer when others are about.
  const aloneSwitch=people.length>1&&!!person&&<Pressable accessibilityRole="switch" accessibilityState={{checked:alone,disabled:busy||playing}} accessibilityLabel={alone?'Just you two: only '+person.name+' answers. Tap to let everyone here join in':'Everyone here may join in. Tap to speak with '+person.name+' alone'} disabled={busy||playing} onPress={()=>{playSound('click');setAlone(value=>!value);}} dataSet={{qb:alone?'seg-on':'chip',keepfocus:'true'}} style={[s.aloneSwitch,alone&&s.aloneOn,(busy||playing)&&{opacity:.45}]}><Icon name={alone?'speak':'people'} size={14} color={alone?colors.goldBright:colors.gold}/><PlainText numberOfLines={1} style={[s.aloneText,alone&&{color:colors.goldBright}]}>{alone?(compact?'You two':'Just you two'):(compact?'Everyone':'Everyone here')}</PlainText></Pressable>;
  const statusPill=<View style={s.status}><View style={[s.dot,{backgroundColor:statusColor}]}/><Text accessibilityLiveRegion="polite" style={[s.connection,{color:statusColor}]}>{statusText}</Text></View>;
  const composer=<TextInput ref={inputRef} dataSet={{qb:'input',composer:'true'}} onFocus={onFocus} onBlur={onBlur} accessibilityLabel={direct?'Message for the Dungeon Master, out of character':'Action for the Dungeon Master'} editable={!dead||direct} value={input} onChangeText={setInput} maxLength={1000} multiline onKeyPress={event=>{if(event.nativeEvent.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault?.();ask();}}} placeholder={direct?(compact?'Ask the Dungeon Master…':'Ask the Dungeon Master: a ruling, a mistake, or what you meant to do…'):turnWait?(compact?turnWait.name.split(' ')[0]+'’s turn…':'It is '+turnWait.name+'’s turn. Wait for it, or tap DM to ask the Dungeon Master something.'):dead?'Your hero has died.':dying?(compact?'Fight to hold on…':'You are dying. Fight to hold on…'):person?'Speak to '+person.name+'…':game.stage==='combat'||game.npcCombat?.active?(compact?(game.actionUsed?'Bonus action, or end turn…':'Your move…'):game.actionUsed?'A bonus action, or end your turn…':'Your move: attack, cast a spell, dodge, or try something bold…'):'Describe your next move…'} placeholderTextColor={tint('#938890')} style={[s.input,fill&&s.fillInput,fill&&short&&{minHeight:42,paddingVertical:9},direct&&s.inputDirect]}/>;
  // The DM switch: the next message is a word with the Dungeon Master, player to DM.
  const dmSwitch=<Pressable accessibilityRole="switch" accessibilityState={{checked:direct,disabled:busy||playing}} accessibilityLabel="Speak to the Dungeon Master out of character" disabled={busy||playing} onPress={()=>{playSound('click');setDirect(value=>!value);setTimeout(()=>inputRef.current?.focus(),30);}} dataSet={{qb:direct?'seg-on':'chip',keepfocus:'true'}} style={[s.dmSwitch,direct&&s.dmSwitchOn,fill&&short&&{minHeight:42},(busy||playing)&&{opacity:.45}]}><Icon name="speak" size={16} color={direct?colors.goldBright:colors.gold}/><PlainText style={[s.dmSwitchText,direct&&{color:colors.goldBright}]}>DM</PlainText></Pressable>;
  const sendLabel=tableSyncing?'Catching up…':busy?'Resolving…':playing?'Playing…':waiting||turnWait&&!direct?'Waiting…':direct?'Ask':'Send';
  const sendButton=<Pressable accessibilityRole="button" accessibilityLabel="Send to the Dungeon Master" accessibilityState={{disabled:sendDisabled}} disabled={sendDisabled} onPress={()=>ask()} dataSet={{qb:'btn-primary',keepfocus:'true'}} style={[s.button,fill&&s.fillSend,fill&&short&&{minHeight:42,paddingVertical:8},fill&&compact&&{paddingHorizontal:14,minWidth:52},sendDisabled&&{opacity:0.45}]}><View style={s.sendRow}>{fill&&compact?(busy||playing?<Icon name="dots" size={20} color={tint('#ffeef0')}/>:<Icon name="send" size={20} color={tint('#ffeef0')} strokeWidth={2}/>):<><PlainText style={s.buttonText}>{sendLabel}</PlainText>{!busy&&!playing&&!waiting&&!tableSyncing&&<Icon name="send" size={16} color={tint('#ffeef0')} strokeWidth={2}/>}</>}</View></Pressable>;
  if(fill)return <View dataSet={{qb:'plate'}} style={[s.panel,s.fill,person&&s.conversation,(compact||short)&&s.fillCompact]}>
    {person?<View style={[s.fillHeader,typing&&short&&{display:'none'}]}>
      <IconButton icon="back" label="Back to adventure" size={36} disabled={busy||playing} onPress={()=>setConversationId(null)}/>
      <DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,person.id)} style={[s.fillPortrait,compact&&{width:44,height:52},short&&{width:34,height:40}]}/>
      <View style={{flex:1,minWidth:0}}><PlainText numberOfLines={1} style={[s.personName,s.fillName,short&&{fontSize:16}]}>{person.name}</PlainText>{!short&&<PlainText numberOfLines={1} style={s.fillRole}>{person.role}{person.trainedAs?' · Level '+person.trainedAs.level+' '+person.trainedAs.class:''}</PlainText>}<View style={s.attitude}><View style={[s.dot,{backgroundColor:attitude.color}]}/><PlainText style={[s.attitudeText,{color:attitude.color}]}>{attitude.label}</PlainText></View></View>
      {aloneSwitch}
    </View>:!short&&!compact&&!snug&&<View style={s.fillHeader}>
      <View style={s.dmMark}><Icon name={teller.icon} size={compact?17:19} color={colors.goldBright}/></View>
      <View style={{flex:1,minWidth:0}}><Text style={s.overline}>YOUR NARRATOR</Text><Text numberOfLines={1} style={[s.heading,s.fillHeading,compact&&{fontSize:16}]}>{teller.name}</Text></View>
      {statusPill}
    </View>}
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
    {ideaLines.length>0&&<View accessibilityLabel="Suggestions" style={[s.ideaWrap,{marginBottom:10}]}>{ideaChips}</View>}
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
const s=StyleSheet.create({group:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},groupMember:{maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:10,paddingVertical:7,paddingHorizontal:10,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),borderRadius:3,backgroundColor:tint('rgba(31,24,32,.9)')},groupActive:{borderColor:colors.gold},
 conversation:{borderColor:tint('rgba(224,74,92,.6)')},back:{paddingVertical:10,marginBottom:10,minHeight:44,alignSelf:'flex-start'},backText:{fontFamily:fonts.display,letterSpacing:1.4,color:colors.gold,fontSize:12,fontWeight:'700',textTransform:'uppercase'},
 portraitRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:22,marginBottom:22},portrait:{width:168,height:200,borderRadius:3},
 personName:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:30,letterSpacing:1,marginBottom:6},role:{fontFamily:fonts.story,fontStyle:'italic',color:tint('#c2b1ab'),fontSize:17,lineHeight:24,marginBottom:10},
 attitude:{flexDirection:'row',alignItems:'center',gap:8},attitudeText:{fontFamily:fonts.ui,fontSize:12,fontWeight:'600',letterSpacing:.4},
 dot:{width:8,height:8,borderRadius:4,boxShadow:'0 0 8px currentColor'},
 overline:{...type.label,marginBottom:6},
 effects:{padding:14,borderRadius:3,borderWidth:1,borderColor:tint('rgba(111,208,196,.35)'),backgroundColor:tint('rgba(16,40,40,.55)'),marginTop:14,marginBottom:6},effectText:{fontFamily:fonts.ui,color:tint('#bfe6de'),fontSize:13,lineHeight:21},
 people:{gap:8,marginTop:18},personButton:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:8,paddingHorizontal:10,borderRadius:3,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(31,24,32,.9)')},
 avatar:{width:40,height:40,borderRadius:20},chipText:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:.8,color:colors.parchment,fontSize:13},
 chipName:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:.8,color:colors.parchment,fontSize:14},chipRole:{fontFamily:fonts.ui,color:colors.muted,fontSize:11.5,marginTop:2},chipAction:{flexShrink:0,fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
 panel:{padding:22,marginVertical:12,backgroundColor:tint('rgba(20,15,21,.8)'),borderRadius:4,borderWidth:1,borderColor:colors.goldLine},
 // Fill mode: the panel takes the whole play area; the feed grows and the composer stays pinned to the bottom.
 fill:{flex:1,minHeight:0,marginVertical:0,padding:16,paddingBottom:12},fillCompact:{padding:10,paddingBottom:8,borderLeftWidth:0,borderRightWidth:0,borderRadius:0},
 fillHeader:{flexDirection:'row',alignItems:'center',gap:12,paddingBottom:10,marginBottom:6,borderBottomWidth:1,borderBottomColor:tint('rgba(178,34,58,.22)')},
 fillHeading:{fontSize:18},fillBack:{minWidth:36,minHeight:44,justifyContent:'center',alignItems:'center'},
 fillPortrait:{width:56,height:66,borderRadius:3},fillName:{fontSize:20,marginBottom:2},fillRole:{fontFamily:fonts.story,fontStyle:'italic',color:tint('#c2b1ab'),fontSize:14,marginBottom:3},
 effectChip:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:6,borderRadius:14,borderWidth:1,borderColor:tint('rgba(111,208,196,.4)'),backgroundColor:tint('rgba(16,40,40,.7)'),maxWidth:320},effectChipText:{fontFamily:fonts.ui,color:tint('#bfe6de'),fontSize:12,flexShrink:1},
 lesson:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:6,paddingHorizontal:4},lessonText:{flex:1,fontFamily:fonts.ui,fontSize:12.5,lineHeight:18,color:tint('#c9bfc6')},
 ideaChip:{flexDirection:'row',alignItems:'center',gap:6,minHeight:40,maxWidth:'100%',paddingHorizontal:12,paddingVertical:6,borderRadius:18,borderWidth:1,borderStyle:'dashed',borderColor:tint('rgba(176,140,245,.5)'),backgroundColor:tint('rgba(20,15,21,.7)')},ideaText:{flexShrink:1,fontFamily:fonts.story,fontStyle:'italic',fontSize:15,lineHeight:20,color:tint('#e2dde1')},
 ideaWrap:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},
 tabs:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8},tab:{flexDirection:'row',alignItems:'center',gap:6,minHeight:32,paddingHorizontal:12,borderRadius:3,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(23,17,24,.85)')},tabOn:{borderColor:colors.goldBright,backgroundColor:tint('rgba(48,26,78,.92)')},
 suggestPanel:{flexGrow:0,flexShrink:0},subTabs:{flexDirection:'row',alignItems:'center',gap:4},
 freshDot:{width:8,height:8,borderRadius:4,marginLeft:2,backgroundColor:tint('#f06e80')},
 quietRow:{minHeight:40,justifyContent:'center',paddingHorizontal:4,marginTop:8},quietText:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:18,color:colors.muted,fontStyle:'italic'},
 tabText:{fontFamily:fonts.display,fontSize:11,fontWeight:'800',letterSpacing:1.2,color:colors.gold,textTransform:'uppercase'},tabTextOn:{color:colors.goldBright},tabCount:{minWidth:18,height:18,borderRadius:9,paddingHorizontal:5,alignItems:'center',justifyContent:'center',backgroundColor:tint('rgba(176,140,245,.28)')},tabCountText:{fontFamily:fonts.ui,fontSize:10.5,fontWeight:'700',color:tint('#e2dde1')},
 aloneSwitch:{flexDirection:'row',alignItems:'center',gap:5,minHeight:36,paddingHorizontal:10,borderRadius:18,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(31,24,32,.92)'),flexShrink:0},aloneOn:{borderColor:colors.goldBright,backgroundColor:tint('rgba(48,26,78,.92)')},aloneText:{fontFamily:fonts.display,fontSize:10.5,fontWeight:'800',letterSpacing:1,color:colors.gold,textTransform:'uppercase'},
 notice:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:12,marginBottom:8,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(23,17,24,.85)')},noticeText:{fontFamily:fonts.ui,fontSize:13,lineHeight:20,color:colors.muted},
 reportChip:{flexDirection:'row',alignItems:'center',gap:5,minHeight:30,paddingHorizontal:10,borderRadius:15,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(20,15,21,.8)'),alignSelf:'center'},reportText:{fontFamily:fonts.ui,color:colors.gold,fontSize:12.5,fontWeight:'700',letterSpacing:.4},
 faultRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8,marginTop:8},faultText:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:18,flexShrink:1},
 errorRow:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:8,paddingVertical:8,paddingHorizontal:10,borderRadius:6,borderWidth:1,borderColor:tint('rgba(240,106,79,.35)'),backgroundColor:tint('rgba(60,18,14,.5)')},
 sendRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},chipSpeak:{flexDirection:'row',alignItems:'center',gap:4,marginLeft:4},
 dmMark:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:tint('rgba(224,74,92,.6)'),alignItems:'center',justifyContent:'center',backgroundColor:tint('rgba(48,26,78,.45)')},
 tipsHead:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4},tipRow:{flexDirection:'row',alignItems:'flex-start',gap:10,marginTop:4},
 personChip:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4,paddingLeft:4,paddingRight:10,borderRadius:22,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(31,24,32,.92)')},chipAvatar:{width:30,height:30,borderRadius:15},
 composer:{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:8},
 dmSwitch:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,minHeight:48,paddingHorizontal:11,borderRadius:3,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(31,24,32,.92)')},dmSwitchOn:{borderColor:colors.goldBright,backgroundColor:tint('rgba(48,26,78,.92)')},
 dmSwitchText:{fontFamily:fonts.display,fontSize:11,fontWeight:'800',letterSpacing:1.2,color:colors.gold},
 inputDirect:{borderColor:colors.goldBright,backgroundColor:tint('rgba(34,18,52,.8)')},
 directNote:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:8,paddingHorizontal:2},directText:{flex:1,fontFamily:fonts.ui,fontSize:12,lineHeight:17,color:tint('#d9808c')},
 draft:{flexDirection:'row',gap:10,alignItems:'flex-start',marginTop:8,paddingVertical:10,paddingHorizontal:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(23,17,24,.85)')},draftText:{flex:1,fontFamily:fonts.story,fontStyle:'italic',fontSize:16,lineHeight:23,color:tint('#ded1cb')},
 actionBar:{flexGrow:0,flexShrink:0,marginTop:8},switchRow:{flexDirection:'row',alignItems:'flex-start',gap:6,flexGrow:0,flexShrink:0},switchCell:{marginTop:8,flexShrink:0},
 action:{flexDirection:'row',alignItems:'center',gap:7,minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),backgroundColor:tint('rgba(31,24,32,.92)'),maxWidth:340},
 actionTight:{minHeight:0,height:36,paddingHorizontal:10,gap:5,maxWidth:'100%'},actionTextTight:{fontSize:11,letterSpacing:.6},chipAvatarTight:{width:26,height:26,borderRadius:13},
 tips:{padding:14,paddingBottom:10,marginTop:4,marginBottom:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(224,74,92,.45)'),gap:2},tipsTitle:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},
 tipsText:{flex:1,fontFamily:fonts.ui,color:tint('#dfd9dd'),fontSize:13,lineHeight:20},tipsButton:{alignSelf:'flex-end',flexDirection:'row',alignItems:'center',gap:6,minHeight:36,paddingHorizontal:14,marginTop:8,borderRadius:18,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),justifyContent:'center'},tipsButtonText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
 actionPrimary:{backgroundColor:tint('#9e1b32'),borderColor:tint('#f06e80')},actionHeading:{minHeight:40,justifyContent:'center',paddingLeft:6,paddingRight:2},actionHeadingText:{fontFamily:fonts.display,fontSize:10.5,fontWeight:'700',letterSpacing:2,color:colors.goldMid,textTransform:'uppercase'},actionHeadingStrong:{fontSize:12.5,color:colors.goldBright,letterSpacing:1.6},actionDetail:{fontFamily:fonts.ui,fontSize:10.5,color:colors.muted,letterSpacing:.3},actionGlyph:{fontSize:14,color:colors.gold},
 actionText:{fontFamily:fonts.display,fontSize:12,fontWeight:'700',letterSpacing:1.1,color:tint('#dfcdc5'),textTransform:'uppercase',flexShrink:1},actionPrimaryText:{color:tint('#ffeef0')},
 fillInput:{flex:1,minHeight:48,maxHeight:130,paddingVertical:12,fontSize:17,lineHeight:24},
 fillSend:{minHeight:48,paddingHorizontal:18,justifyContent:'center',alignItems:'center'},
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',gap:8,flexWrap:'wrap',marginBottom:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:tint('rgba(178,34,58,.22)')},
 heading:{fontFamily:fonts.display,color:colors.parchment,fontSize:22,fontWeight:'700',letterSpacing:1.2},
 status:{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:5,paddingHorizontal:10,borderRadius:20,backgroundColor:tint('rgba(0,0,0,.35)'),borderWidth:1,borderColor:tint('rgba(255,255,255,.06)')},
 connection:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'600',letterSpacing:.4},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20,marginBottom:12},
 prompt:{fontFamily:fonts.display,color:colors.gold,fontSize:13,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase',marginTop:6,marginBottom:10},
 input:{fontFamily:fonts.story,color:tint('#f5efe1'),backgroundColor:tint('rgba(8,5,9,.75)'),borderColor:tint('rgba(178,34,58,.4)'),borderWidth:1,borderRadius:3,padding:16,minHeight:92,textAlignVertical:'top',fontSize:18,lineHeight:26},
 toolbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginTop:12},hint:{fontFamily:fonts.ui,color:colors.faint,fontSize:11.5,flexShrink:1},
 button:{paddingVertical:13,paddingHorizontal:24,backgroundColor:tint('#9e1b32'),borderRadius:3,borderWidth:1,borderColor:tint('#f06e80'),minHeight:46,justifyContent:'center'},buttonText:{fontFamily:fonts.display,color:tint('#ffeef0'),fontSize:13,fontWeight:'800',letterSpacing:1.8,textTransform:'uppercase'},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:22,marginTop:12}
});
