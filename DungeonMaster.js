import {useSceneTransition} from './SceneTransition';
import {dmEndpoints,askDm} from './dmConnection';
import {spellActions} from './quickActions';
import {recruitmentTargets} from './followerRules';
import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {npcArtSubject,creatureArtSubject,placeArtSubject,locationArtSubject} from './worldArtRules';
import {subscribeArt,artIdentity} from './artClient';
import {storyText} from './storyRules';
import TurnPlayback from './TurnPlayback';
import {conversationPeople,conversationTarget,activeEffectLines,visibleTurn} from './playbackRules';
import {adventureStep} from './adventureRules';
import {dmCommand,withAttackIntent} from './dmCommands';
import {storyPreferences} from './storyPreferences';
import {skirmishHint} from './skirmishGuide';
import {attitudeLabel} from './relationshipRules';
import React,{useState,useEffect,useRef,useMemo} from 'react';
import Icon from './Icon';
import {KeyHint,IconButton} from './ui';
import {shortcutsBlocked} from './keyboard';
import {View,Text as PlainText,TextInput,Pressable,ScrollView,StyleSheet,useWindowDimensions,Keyboard} from 'react-native';
import {dmContext,dmChoices,commitDmTurn} from './dmContext';
import {fonts,colors,type,tint} from './theme';
import {playSound} from './audio';
import {turnToRewind,forgetTurn,toDungeonMaster,withoutAddress} from './turnMemory';
import {touchKeyboard} from './webLayout';
import {combatBasics} from './combatRules';
import ActionGuide from './ActionGuide';
import {greeting,shouldGreet} from './greetings';
const endpoints=dmEndpoints();
// The last service that answered ready; a remounted panel checks it first instead of rescanning every address.
let lastReady=null;
export default function DungeonMaster({hero,game,health,act,onConversationChange,table,fill=false,quick=[],sendRef,onTyping}) {
  const {width:viewWidth,height:viewHeight}=useWindowDimensions(),compact=viewWidth<600,short=viewHeight<520;
  // Typing on a phone: while the message box has the keyboard, the story keeps the screen and the action row,
  // header and tabs step aside. Losing focus for an instant (a tap on Send) does not flip the layout back.
  const [focused,setFocused]=useState(false),blurTimer=useRef(null);
  const onFocus=()=>{clearTimeout(blurTimer.current);setFocused(true);},onBlur=()=>{clearTimeout(blurTimer.current);blurTimer.current=setTimeout(()=>setFocused(false),180);};
  useEffect(()=>()=>clearTimeout(blurTimer.current),[]);
  const typing=fill&&focused&&touchKeyboard();
  useEffect(()=>{onTyping?.(typing);return()=>onTyping?.(false);},[typing]);
  // When the Dungeon Master cannot be reached: the host is told what to start, a guest only that it is not answering.
  const offline=()=>dmEndpoints()[0]==='/api'?'The host\'s Dungeon Master is not answering right now. Your words are kept here; try again in a moment.':'The Dungeon Master service is not running on this PC. Start it with Questbound.cmd, then try again; your words are kept here.';
  // Out of character: the next message goes to the Dungeon Master as a player, not into the story.
  const [direct,setDirect]=useState(false);
  const transition=useSceneTransition();
  const openConversation=async id=>{try{await transition.prepare(conversationPeople(game).map(n=>npcArtSubject(game,n.id)));setConversationId(id);setError('');return true;}catch(e){setError(e.message);return false;}};
  const creature=creatureArtSubject(game),creatureKey=creature?artIdentity(creature):null;
  useEffect(()=>creature?subscribeArt(creature,()=>{}):undefined,[creatureKey]);
  const [conversationId,setConversationId]=useState(null),[animateId,setAnimateId]=useState(null),[playing,setPlaying]=useState(false);
  const people=conversationPeople(game),person=people.find(n=>n.id===conversationId);
  useEffect(()=>{if(conversationId&&!person)setConversationId(null);onConversationChange(!!person);},[conversationId,!!person,onConversationChange]);
  const [endpoint,setEndpoint]=useState(lastReady??endpoints[0]);
  const [connected,setConnected]=useState(false),[protocol,setProtocol]=useState(0),[checked,setChecked]=useState(false),[unpaired,setUnpaired]=useState(false);
  const inputRef=useRef(null);
  const [input,setInput]=useState(''),[reply,setReply]=useState(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('Checking AI connection…'),[error,setError]=useState('');
  const fingerprint=JSON.stringify({hero,game,health}),latest=useRef(fingerprint),lock=useRef(false),alive=useRef(true),triedCue=useRef(null);latest.current=fingerprint;
  useEffect(()=>{
    alive.current=true;let checking=false,known=lastReady;
    // Once a ready service answers, only it is polled; the full list is scanned again if it stops answering.
    // A shared-link gateway answers 401 when this browser's invite has lapsed (or the host restarted sharing).
    const probe=async list=>(await Promise.all(list.map(async url=>{try{const response=await fetch(url+'/health',{signal:AbortSignal.timeout(3000)});return response.status===401?{url,state:{ready:false,unpaired:true}}:response.ok?{url,state:await response.json()}:null;}catch{return null;}}))).filter(Boolean).sort((a,b)=>Number(b.state.ready)-Number(a.state.ready)||(b.state.actionProtocol??0)-(a.state.actionProtocol??0))[0];
    const check=async()=>{if(checking)return;checking=true;try{
      let found=known?await probe([known]):null;if(!found?.state.ready)found=await probe(endpoints);
      lastReady=known=found?.state.ready?found.url:null;if(!found)throw Error('Unavailable');
      if(alive.current)setUnpaired(!!found.state.unpaired);
      if(alive.current){setEndpoint(found.url);setConnected(!!found.state.ready);setProtocol(found.state.actionProtocol??0);setStatus(found.state.unpaired?'Your invite has lapsed or the host restarted sharing. Reload the page and enter the invite code to continue; your hero is safe in this browser.':!found.state.ready?'The Dungeon Master is not set up yet on the host’s PC.':found.state.actionProtocol>=3?'AI DM connected · rulings enabled':found.state.actionProtocol===2?'AI DM connected · actions enabled':'AI DM connected · private service upgrade needed for rulings');}
    }catch{if(alive.current){setConnected(false);setProtocol(0);setStatus('The Dungeon Master is not answering. Reconnecting automatically…');}}finally{checking=false;if(alive.current)setChecked(true);}};
    check();const timer=setInterval(check,5000);return()=>{alive.current=false;clearInterval(timer);};
  },[]);
  // While the Dungeon Master writes, the narration so far shows under the story (a streaming service only).
  const [draft,setDraft]=useState('');
  // turnStart tells the DM service the hero's hit points before this turn, so figures part-way through it check out.
  const post=async(input,scene,hp,talkingTo,extra)=>{const most=combatBasics(hero).hp,{ok,status:code,body}=await askDm(endpoint,{input,context:{...dmContext(hero,scene,hp),turnStart:{hp:health?.current??most,max:most},storyPreferences:storyPreferences(),conversationWith:talkingTo?{id:talkingTo.id,name:talkingTo.name,role:talkingTo.role}:null,conversationParticipants:conversationPeople(scene).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude})),...extra}},{onNarration:text=>{if(alive.current)setDraft(text);}});if(code===401)setUnpaired(true);if(!ok)throw Error(body.error||'The DM could not respond.');if(typeof body.narration!=='string'||!body.narration.trim()||body.narration.length>1800)throw Error('Invalid DM reply. Nothing was applied.');return body;};
  // A scene trigger lets present characters speak first; the written line stands in when the AI is unavailable.
  useEffect(()=>{
    const cue=game.sceneCue,attempt=cue&&cue.id+'@'+fingerprint;if(!cue||busy||playing||lock.current||triedCue.current===attempt)return;
    // At a shared table only the device whose action caused the moment asks the NPCs to speak.
    if(cue.origin&&table?.joined&&cue.origin!==table.deviceId)return;
    const speaker=people.find(n=>n.id===cue.speakerId)??people[0],snapshot=fingerprint;triedCue.current=attempt;
    lock.current=true;setBusy(true);setError('');
    (async()=>{
      let narration=cue.scene,dialogue=speaker?[{speakerId:speaker.id,text:cue.fallback}]:[];
      if(connected&&speaker)try{const body=await post(cue.scene,game,health,speaker,{sceneTrigger:{id:cue.id,cue:cue.cue},recruitmentTargets:[]});const lines=(body.dialogue??[]).filter(l=>people.some(n=>n.id===l.speakerId));if(lines.length){narration=body.narration;dialogue=lines;}}catch{}
      if(!alive.current||latest.current!==snapshot)return;
      const result=await act(null,{question:cue.scene,narration,dialogue,trigger:true,npcId:speaker?.id??null});
      if(!result.error){setAnimateId(result.turn?.id??null);if(speaker&&conversationPeople(result.game).some(n=>n.id===speaker.id))setConversationId(speaker.id);}
    })().catch(e=>{if(alive.current)setError(e.message);}).finally(()=>{lock.current=false;if(alive.current)setBusy(false);});
  },[game.sceneCue?.id,busy,playing]);
  // Turning to someone (the Speak chip): the conversation opens and they speak first, in their own voice and true to
  // how they feel about the hero. The Dungeon Master writes the line; a stand-in is used when it cannot be reached.
  // Someone who has only just spoken is not made to greet again.
  const engage=async id=>{
    if(lock.current||busy||playing)return;
    if(!await openConversation(id))return;
    const speaker=conversationPeople(game).find(n=>n.id===id);
    if(!speaker||waiting||tableSyncing||!shouldGreet(game,id))return;
    const opening=greeting(game,id,hero),snapshot=fingerprint;
    lock.current=true;setBusy(true);setError('');setDraft('');
    try{
      let narration=opening.aside,dialogue=[{speakerId:id,text:opening.fallback}];
      if(connected)try{const body=await post(opening.scene,game,health,speaker,{sceneTrigger:{id:'greet:'+id,cue:opening.cue},recruitmentTargets:[]});const lines=(body.dialogue??[]).filter(l=>l.speakerId===id).slice(0,2);if(lines.length){narration=body.narration;dialogue=lines;}}catch{}
      if(!alive.current||latest.current!==snapshot)return;
      const result=await act(null,{question:opening.scene,narration,dialogue,trigger:true,npcId:id});
      if(!result.error){setAnimateId(result.turn?.id??null);if(conversationPeople(result.game).some(n=>n.id===id))setConversationId(id);}
    }catch(e){if(alive.current)setError(e.message);}
    finally{lock.current=false;if(alive.current){setBusy(false);setDraft('');}}
  };
  // Turns that arrive from other players at the table play out here too.
  const lastTurnId=game.playback?.at(-1)?.id??0,seenTurn=useRef(lastTurnId);
  useEffect(()=>{if(lastTurnId>seenTurn.current&&table?.joined)setAnimateId(lastTurnId);seenTurn.current=lastTurnId;},[lastTurnId]);
  // Each new turn brings the action row back to its first (main) action.
  const actionScroll=useRef(null),[spellsOpen,setSpellsOpen]=useState(false),[guide,setGuide]=useState(false);
  // A one-time "How to play" card for new players; dismissed once per device.
  const [tips,setTips]=useState(()=>{try{return !globalThis.localStorage?.getItem('questbound.tips.v1');}catch{return false;}});
  // A player who read the primer while their tale was written needs only a reminder; the Skirmish teaches as it goes.
  const [primed]=useState(()=>{try{return !!globalThis.localStorage?.getItem('questbound.primer.v1');}catch{return false;}});
  const lesson=tips?skirmishHint(game,health,combatBasics(hero).hp):null;
  const dismissTips=()=>{setTips(false);try{globalThis.localStorage?.setItem('questbound.tips.v1','seen');}catch{}};
  useEffect(()=>{if(tips&&lastTurnId>=3)dismissTips();},[lastTurnId]);
  useEffect(()=>{actionScroll.current?.scrollTo?.({x:0,animated:true});setSpellsOpen(false);},[lastTurnId]);
  // Tell the table while this player is taking a turn, so others wait instead of racing.
  useEffect(()=>{table?.setActing?.(busy);},[busy]);
  const waiting=table?.joined?table.otherActing:null; const tableSyncing=!!table?.joined&&!table.synchronized;
  // A quick action arrives as {question, action}: the sentence the DM hears and the engine action it resolves.
  async function ask(preset){
    // A preset with `parse` is a complete typed sentence (a spell from the Cast… picker) read by the normal parser.
    preset=preset?.question&&(preset.action||preset.parse)?preset:null;
    const question=preset?.question??input.trim();
    const toDm=!preset&&(direct||toDungeonMaster(question));
    if(lock.current||playing||!question||waiting||tableSyncing||(game.stage==='dead'&&!toDm))return;const priorReply=reply,snapshot=fingerprint;if(compact||touchKeyboard()){inputRef.current?.blur?.();Keyboard.dismiss();}lock.current=true;setBusy(true);setError('');setDraft('');playSound('send');
    // Speaking to the Dungeon Master directly: an answer out of character, and the last turn taken back when the
    // DM agrees it went wrong. Nothing else about the game changes.
    if(toDm){
      try{
        if(!connected)throw Error(offline());
        const said=withoutAddress(question)||question,back=table?.joined?null:turnToRewind(game),last=game.playback?.at(-1);
        const body=await post(said,game,health,null,{recruitmentTargets:[],outOfCharacter:{canRewind:!!back,lastTurn:last?{said:last.events.find(e=>e.kind==='player')?.text??null,resolved:last.events.filter(e=>['initiative','roll','action','effect'].includes(e.kind)).map(e=>e.text).slice(0,30)}:null}});
        if(!alive.current)throw Error('The adventure was closed. Nothing was applied.');
        if(latest.current!==snapshot)throw Error('The scene changed while the DM was thinking. Ask again.');
        const rewound=body.rewind===true&&!!back;
        const result=await act(null,{question:('To the Dungeon Master: '+said).slice(0,1000),narration:body.narration.slice(0,1700)+(rewound?'\n\nYour last turn has been taken back. Say what you meant to do.':''),dialogue:[],direct:true,npcId:null},undefined,rewound?{from:back}:undefined);
        if(result.error)throw Error(result.error);
        if(rewound)forgetTurn();
        setReply({narration:body.narration});setAnimateId(result.turn?.id??null);setInput('');setDirect(false);
      }catch(e){if(alive.current)setError(e.name==='TimeoutError'?'The DM took too long. Nothing was applied.':storyText(game,e.message));}
      finally{lock.current=false;if(alive.current){setBusy(false);setDraft('');}}
      return;
    }
    const target=preset?null:conversationTarget(game,question,conversationId);
    if(target&&!await openConversation(target)){lock.current=false;setBusy(false);return;}
    const talkingTo=people.find(n=>n.id===target);
    const unchanged=()=>{if(!alive.current)throw Error('The adventure was closed. Nothing was applied.');if(latest.current!==snapshot)throw Error('The scene changed while the DM was thinking. Nothing was applied. Ask again.');};
    const request=async(scene=game,hp=health,extra={})=>{if(!connected)throw Error(offline());const body=await post(question,scene,hp,talkingTo,{recruitmentTargets:recruitmentTargets(scene,question,target),...extra});unchanged();return body;};
    const finish=async(action,body,normalizedCommand,random)=>{unchanged();const result=await act(action,{question,narration:body.narration,dialogue:body.dialogue,worldEvent:body.worldEvent,relationships:body.relationships,loot:body.loot,introduce:body.introduce??null,normalizedCommand,npcId:target},random);if(result.error)throw Error(result.error);setReply({narration:body.narration});setAnimateId(result.turn?.id??null);setConversationId(conversationPeople(result.game).some(n=>n.id===target)?target:null);if(!preset)setInput('');return result;};
    const cast=async(command,normalized,narration)=>{
      // The player's own words ("knock him out") shape the preview exactly as they will shape the committed turn.
      const rolled=[];const preview=adventureStep(withAttackIntent(game,question),health,hero,command.action,()=>{const value=Math.random();rolled.push(value);return value;});if(preview.error)throw Error(preview.error);
      if(preview.waiting&&protocol>=3){
        const body=await request(preview.game,preview.health);if(!body.ruling)throw Error('The DM did not resolve this spell. Nothing was spent; try again with more detail.');
        const action={type:'ai-spell',request:command.action.request,ruling:body.ruling},dice=[];
        const resolved=commitDmTurn(hero,game,health,action,{question,narration:body.narration,worldEvent:body.worldEvent,normalizedCommand:normalized},()=>{const value=Math.random();dice.push(value);return value;});
        if(resolved.error)throw Error(resolved.error);
        if(body.ruling.decision==='cast'){
          const reaction=await request(resolved.game,resolved.health,{engineResolved:(resolved.events??[]).map(t=>storyText(resolved.game,t)).slice(0,40)});
          body.narration=reaction.narration;body.dialogue=reaction.dialogue;body.relationships=reaction.relationships;body.loot=reaction.loot;body.introduce=reaction.introduce;
        }
        let index=0;await finish(action,body,normalized,()=>dice[index++]??0.5);
      }
      else {let body={narration:narration??command.narration??'Your action is resolved below.'};
        if(connected&&protocol>=3)body=await request(preview.game,preview.health,{engineResolved:(preview.events??[]).map(t=>storyText(preview.game,t)).slice(0,40)});
        let index=0;await finish(command.action,{narration:body.narration,dialogue:body.dialogue,relationships:body.relationships,loot:body.loot,introduce:body.introduce},normalized,()=>rolled[index++]??0.5);
      }
    };
    try{
      const command=preset?.action?{action:preset.action}:dmCommand(hero,game,question,health,preset?null:conversationId);
      if(command?.action){await cast(command,command.normalizedCommand??question);return;}
      if(/^confirm action[.!]?$/i.test(question)){if(!priorReply?.pending||priorReply.snapshot!==snapshot)throw Error('There is no current action to confirm.');await finish(priorReply.pending.action,{narration:'Your action is resolved below.'});return;}
      if(command?.error&&protocol<3)throw Error(command.error);
      const body=await request(game,health,command?.error?{castingIssue:command.error}:{});
      if(protocol>=3&&body.castCommand){const interpreted=dmCommand(hero,game,body.castCommand,health);if(!interpreted?.action||interpreted.error||interpreted.action.type!=='spell')throw Error(interpreted?.error||'The spell interpretation was invalid.');await cast(interpreted,body.castCommand,body.narration);return;}
      if(protocol>=3&&body.recruitment?.length){
        const action={type:'recruitment',plans:body.recruitment},dice=[];
        const preview=commitDmTurn(hero,game,health,action,{question,narration:body.narration,npcId:target},()=>{const value=Math.random();dice.push(value);return value;});
        if(preview.error)throw Error(preview.error);
        const resolved=await request(preview.game,preview.health,{engineResolved:preview.events});
        let index=0;await finish(action,{narration:resolved.narration,dialogue:resolved.dialogue,worldEvent:null,relationships:resolved.relationships,loot:resolved.loot,introduce:resolved.introduce},undefined,()=>dice[index++]??0.5);return;
      }
      if(protocol>=3&&body.check){
        const action={type:'ai-check',check:body.check},dice=[];
        const preview=commitDmTurn(hero,game,health,action,{question,narration:body.narration,worldEvent:null,npcId:target},()=>{const value=Math.random();dice.push(value);return value;});
        if(preview.error)throw Error(preview.error);
        const resolved=await request(preview.game,preview.health,{engineResolved:(preview.events??[]).map(t=>storyText(preview.game,t)).slice(0,40)});
        let index=0;await finish(action,{narration:resolved.narration,dialogue:resolved.dialogue,worldEvent:null,relationships:resolved.relationships,loot:resolved.loot,introduce:resolved.introduce},undefined,()=>dice[index++]??0.5);return;
      }
      if(protocol>=3&&body.ruling){await finish({type:'ai-ruling',ruling:body.ruling},body);return;}
      // A place the DM revealed: added to the map, and walked to when the player set out for it.
      if(protocol>=3&&body.discovery){const {travel,...place}=body.discovery;await finish({type:'discover',place,travel},body);return;}
      // A creature the DM sprang on the player out in the wilds: the fight starts, and the player moves first.
      if(protocol>=3&&body.ambush){await finish({type:'ambush',foe:body.ambush},body);return;}
      const choice=body.actionId===null?null:dmChoices(hero,game).find(c=>c.id===body.actionId);if(body.actionId!==null&&!choice)throw Error('That action is no longer available.');
      if(protocol>=3&&choice){await cast({action:choice.action},undefined,body.narration);return;}
      const result=await finish(protocol>=2?(choice?.action??null):null,protocol>=3?body:{narration:body.narration});
      if(protocol<2&&choice)setReply({narration:body.narration,pending:choice,snapshot:JSON.stringify({hero,game:result.game,health:result.health})});
    }catch(e){if(alive.current)setError(e.name==='TimeoutError'?'The DM took too long. Nothing was applied.':storyText(game,e.message));}
    finally{lock.current=false;if(alive.current){setBusy(false);setDraft('');}}
  }
  const turns=(person?(game.playback??[]).filter(t=>t.npcId===person.id||(t.participants??[]).some(id=>people.some(n=>n.id===id))):(game.playback??[])).map(t=>visibleTurn(t,game));
  const effects=activeEffectLines(game,health);
  // Names the playback uses to move the HUD's HP bars in step with the story, and portraits for speakers.
  const foeTitle=game.wildFight?.name??game.story?.foe??'Encounter opponent',names=useMemo(()=>({hero:hero.name,foe:foeTitle}),[hero.name,foeTitle]);
  const avatarFor=id=>id?npcArtSubject(game,id):null,sceneFor=name=>placeArtSubject(game,name);
  const previousNarration=(game.journal?.entries??[]).filter(e=>e.title==='AI DM conversation').at(-1)?.text.split(/\n(?:AI DM|Dungeon Master): /).at(-1)?.split('\nResult:')[0];
  const standing=attitudeLabel(person),attitude={label:standing.label,color:{bad:colors.bloodBright,warn:'#e0a860',good:colors.heal,best:colors.goldBright,calm:colors.heal,dead:colors.muted}[standing.tone]};
  const dead=game.stage==='dead',dying=game.stage==='dying';
  const sendDisabled=busy||playing||!input.trim()||!!waiting||tableSyncing||(dead&&!direct);
  const statusText=busy?(compact?'Resolving…':'Resolving your turn…'):playing?(compact?'Playing…':'Playing turn…'):connected?'Connected':checked?'Offline':'Connecting…';
  const statusColor=busy||playing||!checked?colors.gold:connected?colors.heal:tint('#7d1b2e');
  const hint=tableSyncing?'Catching up with the shared table…':waiting?'⏳ '+waiting+' is taking a turn. Wait for the table.':null;
  // Quick actions: one tap sends; Cast… starts the sentence so the player names the spell and target.
  if(sendRef)sendRef.current=preset=>ask(preset);
  // Cast… swaps the row for the hero's spells; a spell casts in one tap (or starts the sentence when it needs a target).
  const spellRow=[{key:'spells-back',glyph:'‹',icon:'back',label:'Back',run:()=>setSpellsOpen(false)},...spellActions(hero,game)];
  const actions=person?[]:spellsOpen?spellRow:quick,actionsDisabled=busy||playing||!!waiting||tableSyncing;
  const runAction=a=>{
    if(a.key==='cast'){setSpellsOpen(true);return;}
    if(a.run){a.run();return;}
    if(a.key.startsWith('spell:'))setSpellsOpen(false);
    if(a.prefill){setInput(a.prefill);setTimeout(()=>inputRef.current?.focus(),30);return;}
    ask(a.action?a:{question:a.question,parse:true});
  };
  // Phones and short windows scroll the row sideways; roomy screens wrap it. On a short screen (a phone on its
  // side) people and effects join the same row so the story keeps its height.
  // (A window of middling height, a small laptop, also keeps the actions to one row and drops the narrator's
  // heading, so the story has the room.)
  const snug=viewHeight<700,swipe=compact||short||snug;
  // With a keyboard, 1–9 press the matching action (shown as a small key on each chip).
  const keysRef=useRef({});keysRef.current={actions,disabled:actionsDisabled,run:a=>runAction(a)};
  useEffect(()=>{
    if(typeof document==='undefined')return;
    const onKey=e=>{if(e.ctrlKey||e.metaKey||e.altKey||!/^[1-9]$/.test(e.key)||shortcutsBlocked())return;
      const {actions,disabled,run}=keysRef.current,a=actions[Number(e.key)-1];if(!a||disabled)return;e.preventDefault();playSound('click');run(a);};
    document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
  },[]);
  const actionChips=actions.map((a,i)=>{const lead=a.primary&&!a.prefill;return <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.prefill?'Cast a spell: start typing it':a.question??a.label} accessibilityState={{disabled:actionsDisabled}} disabled={actionsDisabled} onPress={()=>runAction(a)} onHoverIn={()=>!actionsDisabled&&playSound('tick')} dataSet={{qb:lead?'btn-primary':'chip',pulse:lead&&i===0&&game.stage==='combat'&&!actionsDisabled&&!spellsOpen?'on':'off'}} style={[s.action,lead&&s.actionPrimary,actionsDisabled&&{opacity:.45}]}>
    <Icon name={a.icon??'star'} size={16} color={lead?tint('#ffeef0'):colors.gold}/>
    <PlainText numberOfLines={1} style={[s.actionText,lead&&s.actionPrimaryText]}>{a.label}</PlainText>
    {!!a.detail&&<PlainText style={s.actionDetail}>{a.detail}</PlainText>}
    {!compact&&i<9&&<KeyHint dark={lead}>{i+1}</KeyHint>}
  </Pressable>;});
  // The guide: what every action (or spell) in the row does, one tap away.
  if(actions.length)actionChips.push(<Pressable key="guide" accessibilityRole="button" accessibilityLabel={spellsOpen?'What these spells do':'What these actions do'} onPress={()=>{playSound('open');setGuide(true);}} dataSet={{qb:'chip'}} style={[s.action,{paddingHorizontal:11}]}><Icon name="info" size={16} color={colors.gold}/></Pressable>);
  // A first-time player's first turns: things to try saying. A tap writes the words into the message box (it does
  // not send them), which shows that anything can be typed.
  const starters=tips&&lastTurnId<2&&!person&&!dead&&!dying&&!direct&&!input&&game.stage!=='combat'&&!game.npcCombat?.active?['I look around.','I ask what is going on here.']:[];
  const extraChips=[...effects.map(line=><View key={'effect:'+line} style={s.effectChip}><Icon name="spell" size={13} color={colors.arcane}/><Text numberOfLines={1} style={s.effectChipText}>{line}</Text></View>),
    ...people.filter(n=>n.id!==person?.id).map(n=><Pressable key={'person:'+n.id} accessibilityRole="button" accessibilityLabel={(person?'Address ':'Speak with ')+n.name} disabled={busy||playing} onPress={()=>engage(n.id)} dataSet={{qb:'chip'}} style={s.personChip}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={s.chipAvatar} compact/><PlainText numberOfLines={1} style={s.chipName}>{n.name}</PlainText><View style={s.chipSpeak}><Icon name="speak" size={13} color={colors.gold}/><PlainText style={s.chipAction}>{person?'Address':'Speak'}</PlainText></View></Pressable>),
    ...starters.map(text=><Pressable key={'try:'+text} accessibilityRole="button" accessibilityLabel={'Try saying: '+text} disabled={busy||playing} onPress={()=>{playSound('click');setInput(text);setTimeout(()=>inputRef.current?.focus(),30);}} dataSet={{qb:'chip',keepfocus:'true'}} style={s.tryChip}><Icon name="quill" size={13} color={colors.goldMid}/><PlainText numberOfLines={1} style={s.tryText}>Try: {text}</PlainText></Pressable>)];
  const row=(chips,wrap,ref)=>chips.length>0&&<ScrollView ref={ref} horizontal={!wrap} dataSet={{qb:wrap?'actions':'actions-scroll'}} showsHorizontalScrollIndicator={false} style={s.actionBar} contentContainerStyle={[s.actionContent,wrap&&s.actionWrap]} accessibilityLabel="Quick actions">{chips}</ScrollView>;
  const actionBar=short?row([...actionChips,...extraChips],false,actionScroll):<>{row(extraChips,false)}{row(actionChips,!swipe,actionScroll)}</>;
  const statusPill=<View style={s.status}><View style={[s.dot,{backgroundColor:statusColor}]}/><Text accessibilityLiveRegion="polite" style={[s.connection,{color:statusColor}]}>{statusText}</Text></View>;
  const composer=<TextInput ref={inputRef} dataSet={{qb:'input',composer:'true'}} onFocus={onFocus} onBlur={onBlur} accessibilityLabel={direct?'Message for the Dungeon Master, out of character':'Action for the Dungeon Master'} editable={!dead||direct} value={input} onChangeText={setInput} maxLength={1000} multiline onKeyPress={event=>{if(event.nativeEvent.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault?.();ask();}}} placeholder={direct?(compact?'Ask the Dungeon Master…':'Ask the Dungeon Master: a ruling, a mistake, or what you meant to do…'):dead?'Your hero has died.':dying?(compact?'Fight to hold on…':'You are dying. Fight to hold on…'):person?'Speak to '+person.name+'…':game.stage==='combat'||game.npcCombat?.active?(compact?(game.actionUsed?'Bonus action, or end turn…':'Your move…'):game.actionUsed?'A bonus action, or end your turn…':'Your move: attack, cast a spell, dodge, or try something bold…'):'Describe your next move…'} placeholderTextColor={tint('#938890')} style={[s.input,fill&&s.fillInput,fill&&short&&{minHeight:42,paddingVertical:9},direct&&s.inputDirect]}/>;
  // The DM switch: the next message is a word with the Dungeon Master, player to DM.
  const dmSwitch=<Pressable accessibilityRole="switch" accessibilityState={{checked:direct,disabled:busy||playing}} accessibilityLabel="Speak to the Dungeon Master out of character" disabled={busy||playing} onPress={()=>{playSound('click');setDirect(value=>!value);setTimeout(()=>inputRef.current?.focus(),30);}} dataSet={{qb:direct?'seg-on':'chip',keepfocus:'true'}} style={[s.dmSwitch,direct&&s.dmSwitchOn,fill&&short&&{minHeight:42},(busy||playing)&&{opacity:.45}]}><Icon name="speak" size={16} color={direct?colors.goldBright:colors.gold}/><PlainText style={[s.dmSwitchText,direct&&{color:colors.goldBright}]}>DM</PlainText></Pressable>;
  const sendLabel=tableSyncing?'Catching up…':busy?'Resolving…':playing?'Playing…':waiting?'Waiting…':direct?'Ask':'Send';
  const sendButton=<Pressable accessibilityRole="button" accessibilityLabel="Send to the Dungeon Master" accessibilityState={{disabled:sendDisabled}} disabled={sendDisabled} onPress={()=>ask()} dataSet={{qb:'btn-primary',keepfocus:'true'}} style={[s.button,fill&&s.fillSend,fill&&short&&{minHeight:42,paddingVertical:8},fill&&compact&&{paddingHorizontal:14,minWidth:52},sendDisabled&&{opacity:0.45}]}><View style={s.sendRow}>{fill&&compact?(busy||playing?<Icon name="dots" size={20} color={tint('#ffeef0')}/>:<Icon name="send" size={20} color={tint('#ffeef0')} strokeWidth={2}/>):<><PlainText style={s.buttonText}>{sendLabel}</PlainText>{!busy&&!playing&&!waiting&&!tableSyncing&&<Icon name="send" size={16} color={tint('#ffeef0')} strokeWidth={2}/>}</>}</View></Pressable>;
  if(fill)return <View dataSet={{qb:'plate'}} style={[s.panel,s.fill,person&&s.conversation,(compact||short)&&s.fillCompact]}>
    {person?<View style={[s.fillHeader,typing&&short&&{display:'none'}]}>
      <IconButton icon="back" label="Back to adventure" size={36} disabled={busy||playing} onPress={()=>setConversationId(null)}/>
      <DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,person.id)} style={[s.fillPortrait,compact&&{width:44,height:52},short&&{width:34,height:40}]}/>
      <View style={{flex:1,minWidth:0}}><PlainText numberOfLines={1} style={[s.personName,s.fillName,short&&{fontSize:16}]}>{person.name}</PlainText>{!short&&<PlainText numberOfLines={1} style={s.fillRole}>{person.role}</PlainText>}<View style={s.attitude}><View style={[s.dot,{backgroundColor:attitude.color}]}/><PlainText style={[s.attitudeText,{color:attitude.color}]}>{attitude.label}</PlainText></View></View>
    </View>:!short&&!compact&&!snug&&<View style={s.fillHeader}>
      <View style={s.dmMark}><Icon name="quill" size={compact?17:19} color={colors.goldBright}/></View>
      <View style={{flex:1,minWidth:0}}><Text style={s.overline}>YOUR NARRATOR</Text><Text numberOfLines={1} style={[s.heading,s.fillHeading,compact&&{fontSize:16}]}>The Dungeon Master</Text></View>
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
      {primed?<View style={s.tipRow}><Icon name="quill" size={15} color={colors.gold}/><PlainText style={s.tipsText}>As you read while you waited: type what you do, or tap an action below. If something goes wrong, tap DM and tell the Dungeon Master.</PlainText></View>:<>
      <View style={s.tipRow}><Icon name="swords" size={15} color={colors.gold}/><PlainText style={s.tipsText}>Tap an action below{compact?'':' (or press its number key)'}, or type anything you want to do or say.</PlainText></View>
      <View style={s.tipRow}><Icon name="d20" size={15} color={colors.gold}/><PlainText style={s.tipsText}>The Dungeon Master decides what happens; the dice decide how it goes.</PlainText></View>
      <View style={s.tipRow}><Icon name="speak" size={15} color={colors.gold}/><PlainText style={s.tipsText}>Something went wrong, or you meant something else? Tap DM beside the message box and tell the Dungeon Master.</PlainText></View>
      <View style={s.tipRow}><Icon name="menu" size={15} color={colors.gold}/><PlainText style={s.tipsText}>Tap an underlined name to learn more. The menu holds your character sheet, journal, settings and feedback.</PlainText></View></>}
      <Pressable accessibilityRole="button" onPress={dismissTips} dataSet={{qb:'chip'}} style={s.tipsButton}><Icon name="check" size={14} color={colors.gold}/><PlainText style={s.tipsButtonText}>Got it</PlainText></Pressable>
    </View>:null} aside={(short||compact||snug)&&!person?statusPill:null} typing={typing} me={table?.joined?table.name:null} turns={turns} animateId={animateId} onPlayingChange={setPlaying} busy={busy} opening={person?'You turn to '+person.name+'.':previousNarration??game.story?.opening??'Describe what you do. Your story unfolds here.'}/>
    {!!hint&&<Text style={[s.hint,{color:colors.gold,marginTop:6}]}>{hint}</Text>}
    {tips&&lesson&&!person&&<View dataSet={{qb:'enter'}} style={s.lesson}><Icon name="info" size={14} color={colors.goldMid}/><PlainText style={s.lessonText}>{lesson}</PlainText></View>}
    {busy&&!!draft&&<View dataSet={{qb:'plate'}} accessibilityLiveRegion="polite" style={s.draft}><Icon name="quill" size={14} color={colors.gold}/><PlainText numberOfLines={compact?3:5} style={s.draftText}>{draft}</PlainText></View>}
    {!typing&&actionBar}
    <ActionGuide visible={guide} onClose={()=>setGuide(false)} actions={actions} hero={hero} game={game} spells={spellsOpen} disabled={actionsDisabled} onRun={runAction}/>
    {direct&&<View style={s.directNote}><Icon name="speak" size={13} color={colors.goldBright}/><PlainText style={s.directText}>{compact?'Out of character: the story waits.':'Out of character. Ask about a ruling, or say what went wrong or what you meant to do: the story waits, and the Dungeon Master can take your last turn back.'}</PlainText></View>}
    <View style={s.composer}>{dmSwitch}{composer}{sendButton}</View>
    {!!error&&<View accessibilityRole="alert" style={s.errorRow}><Icon name="info" size={15} color={colors.danger}/><Text style={[s.error,{marginTop:0,flex:1}]}>{error}</Text></View>}
    {reply?.pending&&<Text style={s.caption}>Suggested action: {reply.pending.label}. Send “confirm action” to carry it out.</Text>}
  </View>;
  return <View dataSet={{qb:'plate'}} style={[s.panel,person&&s.conversation,compact&&{padding:14}]}>
    {person?<View><Pressable accessibilityRole="button" disabled={busy||playing} onPress={()=>setConversationId(null)} style={s.back}><Text style={s.backText}>‹  Back to adventure</Text></Pressable><View style={s.portraitRow}><DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,person.id)} style={[s.portrait,compact&&{width:132,height:156}]}/><View style={{flex:1,minWidth:150}}><Text style={s.overline}>{people.length>1?'GROUP CONVERSATION':'IN CONVERSATION'}</Text><PlainText style={[s.personName,compact&&{fontSize:24}]}>{person.name}</PlainText><Text style={s.role}>{person.role}</Text><View style={s.attitude}><View style={[s.dot,{backgroundColor:attitude.color}]}/><Text style={[s.attitudeText,{color:attitude.color}]}>{attitude.label}</Text></View></View></View>{people.length>1&&<View style={s.group}>{people.map(n=><Pressable key={n.id} accessibilityRole="button" accessibilityLabel={'Address '+n.name} disabled={busy||playing} onPress={()=>openConversation(n.id)} dataSet={{qb:'chip'}} style={[s.groupMember,n.id===person.id&&s.groupActive]}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={s.avatar} compact/><PlainText style={s.chipText}>{n.name}</PlainText></Pressable>)}</View>}</View>:<View style={s.header}><View><Text style={s.overline}>YOUR NARRATOR</Text><Text style={s.heading}>The Dungeon Master</Text></View><View style={s.status}><View style={[s.dot,{backgroundColor:busy||playing?colors.gold:connected?colors.heal:tint('#7d1b2e')}]}/><Text accessibilityLiveRegion="polite" style={[s.connection,{color:busy||playing?colors.gold:connected?'#a6d8b8':'#d8b879'}]}>{busy?'Resolving your turn…':playing?'Playing turn…':connected?'Connected':'Offline'}</Text></View></View>}
    
    {!connected&&<Text style={s.caption}>{status}</Text>}
    <TurnPlayback me={table?.joined?table.name:null} turns={turns} animateId={animateId} onPlayingChange={setPlaying} busy={busy} opening={person?'You turn to '+person.name+'.':previousNarration??game.story?.opening??'Describe what you do. Your story unfolds here.'}/>
    <Text style={s.prompt}>{person?'What do you say?':'What do you do?'}</Text>
    <TextInput dataSet={{qb:'input'}} accessibilityLabel="Action for the Dungeon Master" value={input} onChangeText={setInput} maxLength={1000} multiline onKeyPress={event=>{if(event.nativeEvent.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault?.();ask();}}} placeholder={person?'Speak to '+person.name+'…':'Describe your next move…'} placeholderTextColor={tint('#938890')} style={s.input}/>
    <View style={s.toolbar}><Text style={[s.hint,!!waiting&&{color:colors.gold}]}>{tableSyncing?'Catching up with the shared table…':waiting?'⏳ '+waiting+' is taking a turn. Wait for the table.':compact?'Tap Send to DM':'Enter to send · Shift+Enter for a new line'}</Text><Pressable accessibilityRole="button" accessibilityState={{disabled:busy||playing||!input.trim()||!!waiting||tableSyncing}} disabled={busy||playing||!input.trim()||!!waiting||tableSyncing} onPress={()=>ask()}dataSet={{qb:'btn-primary'}} style={[s.button,(busy||playing||!input.trim()||!!waiting||tableSyncing)&&{opacity:0.45}]}><Text style={s.buttonText}>{tableSyncing?'Catching up…':busy?'Resolving…':playing?'Playing turn…':waiting?'Waiting…':'Send to DM  ➤'}</Text></Pressable></View>
    {effects.length>0&&<View style={s.effects}><Text style={[s.overline,{color:colors.arcane}]}>✧ ONGOING EFFECTS</Text>{effects.map(line=><Text key={line} style={s.effectText}>{line}</Text>)}</View>}
    {!person&&people.length>0&&<View style={s.people}><Text style={s.overline}>PEOPLE NEARBY</Text>{people.map(n=><Pressable key={n.id} accessibilityRole="button" disabled={busy||playing} onPress={()=>engage(n.id)} dataSet={{qb:'chip'}} style={s.personButton}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={s.avatar} compact/><View style={{flexShrink:1}}><PlainText style={s.chipName}>{n.name}</PlainText><PlainText style={s.chipRole} numberOfLines={1}>{n.role}</PlainText></View><PlainText style={s.chipAction} numberOfLines={1}>Speak ›</PlainText></Pressable>)}</View>}
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {reply?.pending&&<Text style={s.caption}>Suggested action: {reply.pending.label}. Send “confirm action” to carry it out.</Text>}
    {reply?.pending&&reply.snapshot!==fingerprint&&<Text style={s.caption}>The scene changed. Send a new message for a current suggestion.</Text>}
  </View>;
}
const s=StyleSheet.create({group:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},groupMember:{maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:10,paddingVertical:7,paddingHorizontal:10,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),borderRadius:3,backgroundColor:tint('rgba(31,24,32,.9)')},groupActive:{borderColor:colors.gold},
 conversation:{borderColor:tint('rgba(224,74,92,.6)')},back:{paddingVertical:10,marginBottom:10,minHeight:44,alignSelf:'flex-start'},backText:{fontFamily:fonts.display,letterSpacing:1.4,color:colors.gold,fontSize:12,fontWeight:'700',textTransform:'uppercase'},
 portraitRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:22,marginBottom:22},portrait:{width:168,height:200,borderRadius:3},
 personName:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:30,letterSpacing:1,marginBottom:6},role:{fontFamily:fonts.story,fontStyle:'italic',color:'#c2b1ab',fontSize:17,lineHeight:24,marginBottom:10},
 attitude:{flexDirection:'row',alignItems:'center',gap:8},attitudeText:{fontFamily:fonts.ui,fontSize:12,fontWeight:'600',letterSpacing:.4},
 dot:{width:8,height:8,borderRadius:4,boxShadow:'0 0 8px currentColor'},
 overline:{...type.label,marginBottom:6},
 effects:{padding:14,borderRadius:3,borderWidth:1,borderColor:'rgba(111,208,196,.35)',backgroundColor:'rgba(16,40,40,.55)',marginTop:14,marginBottom:6},effectText:{fontFamily:fonts.ui,color:'#bfe6de',fontSize:13,lineHeight:21},
 people:{gap:8,marginTop:18},personButton:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:8,paddingHorizontal:10,borderRadius:3,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(31,24,32,.9)')},
 avatar:{width:40,height:40,borderRadius:20},chipText:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:.8,color:colors.parchment,fontSize:13},
 chipName:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:.8,color:colors.parchment,fontSize:14},chipRole:{fontFamily:fonts.ui,color:colors.muted,fontSize:11.5,marginTop:2},chipAction:{flexShrink:0,fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
 panel:{padding:22,marginVertical:12,backgroundColor:tint('rgba(20,15,21,.8)'),borderRadius:4,borderWidth:1,borderColor:colors.goldLine},
 // Fill mode: the panel takes the whole play area; the feed grows and the composer stays pinned to the bottom.
 fill:{flex:1,minHeight:0,marginVertical:0,padding:16,paddingBottom:12},fillCompact:{padding:10,paddingBottom:8,borderLeftWidth:0,borderRightWidth:0,borderRadius:0},
 fillHeader:{flexDirection:'row',alignItems:'center',gap:12,paddingBottom:10,marginBottom:6,borderBottomWidth:1,borderBottomColor:tint('rgba(178,34,58,.22)')},
 fillHeading:{fontSize:18},fillBack:{minWidth:36,minHeight:44,justifyContent:'center',alignItems:'center'},
 fillPortrait:{width:56,height:66,borderRadius:3},fillName:{fontSize:20,marginBottom:2},fillRole:{fontFamily:fonts.story,fontStyle:'italic',color:'#c2b1ab',fontSize:14,marginBottom:3},
 effectChip:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:6,borderRadius:14,borderWidth:1,borderColor:'rgba(111,208,196,.4)',backgroundColor:'rgba(16,40,40,.7)',maxWidth:320},effectChipText:{fontFamily:fonts.ui,color:'#bfe6de',fontSize:12,flexShrink:1},
 lesson:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:6,paddingHorizontal:4},lessonText:{flex:1,fontFamily:fonts.ui,fontSize:12.5,lineHeight:18,color:tint('#c9bfc6')},
 tryChip:{flexDirection:'row',alignItems:'center',gap:6,minHeight:36,paddingHorizontal:12,paddingVertical:6,borderRadius:18,borderWidth:1,borderStyle:'dashed',borderColor:tint('rgba(176,140,245,.5)'),backgroundColor:tint('rgba(20,15,21,.7)')},tryText:{fontFamily:fonts.story,fontStyle:'italic',fontSize:15,color:tint('#e2dde1')},
 notice:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:12,marginBottom:8,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(23,17,24,.85)')},noticeText:{fontFamily:fonts.ui,fontSize:13,lineHeight:20,color:colors.muted},
 errorRow:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:8,paddingVertical:8,paddingHorizontal:10,borderRadius:6,borderWidth:1,borderColor:'rgba(240,106,79,.35)',backgroundColor:'rgba(60,18,14,.5)'},
 sendRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},chipSpeak:{flexDirection:'row',alignItems:'center',gap:4,marginLeft:4},
 dmMark:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:tint('rgba(224,74,92,.6)'),alignItems:'center',justifyContent:'center',backgroundColor:tint('rgba(48,26,78,.45)')},
 tipsHead:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4},tipRow:{flexDirection:'row',alignItems:'flex-start',gap:10,marginTop:4},
 personChip:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4,paddingLeft:4,paddingRight:10,borderRadius:22,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(31,24,32,.92)')},chipAvatar:{width:30,height:30,borderRadius:15},
 composer:{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:8},
 dmSwitch:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,minHeight:48,paddingHorizontal:11,borderRadius:3,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(31,24,32,.92)')},dmSwitchOn:{borderColor:colors.goldBright,backgroundColor:tint('rgba(48,26,78,.92)')},
 dmSwitchText:{fontFamily:fonts.display,fontSize:11,fontWeight:'800',letterSpacing:1.2,color:colors.gold},
 inputDirect:{borderColor:colors.goldBright,backgroundColor:tint('rgba(34,18,52,.8)')},
 directNote:{flexDirection:'row',alignItems:'flex-start',gap:8,marginTop:8,paddingHorizontal:2},directText:{flex:1,fontFamily:fonts.ui,fontSize:12,lineHeight:17,color:tint('#d9808c')},
 draft:{flexDirection:'row',gap:10,alignItems:'flex-start',marginTop:8,paddingVertical:10,paddingHorizontal:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.3)'),backgroundColor:tint('rgba(23,17,24,.85)')},draftText:{flex:1,fontFamily:fonts.story,fontStyle:'italic',fontSize:16,lineHeight:23,color:'#ded1cb'},
 actionBar:{flexGrow:0,flexShrink:0,marginTop:8},actionContent:{gap:8,alignItems:'center',paddingRight:40},actionWrap:{flexDirection:'row',flexWrap:'wrap',paddingRight:0},
 action:{flexDirection:'row',alignItems:'center',gap:7,minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),backgroundColor:tint('rgba(31,24,32,.92)'),maxWidth:260},
 tips:{padding:14,paddingBottom:10,marginTop:4,marginBottom:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(224,74,92,.45)'),gap:2},tipsTitle:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'},
 tipsText:{flex:1,fontFamily:fonts.ui,color:tint('#dfd9dd'),fontSize:13,lineHeight:20},tipsButton:{alignSelf:'flex-end',flexDirection:'row',alignItems:'center',gap:6,minHeight:36,paddingHorizontal:14,marginTop:8,borderRadius:18,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),justifyContent:'center'},tipsButtonText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
 actionPrimary:{backgroundColor:tint('#9e1b32'),borderColor:tint('#f06e80')},actionDetail:{fontFamily:fonts.ui,fontSize:10.5,color:colors.muted,letterSpacing:.3},actionGlyph:{fontSize:14,color:colors.gold},
 actionText:{fontFamily:fonts.display,fontSize:12,fontWeight:'700',letterSpacing:1.1,color:'#dfcdc5',textTransform:'uppercase',flexShrink:1},actionPrimaryText:{color:tint('#ffeef0')},
 fillInput:{flex:1,minHeight:48,maxHeight:130,paddingVertical:12,fontSize:17,lineHeight:24},
 fillSend:{minHeight:48,paddingHorizontal:18,justifyContent:'center',alignItems:'center'},
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',gap:8,flexWrap:'wrap',marginBottom:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:tint('rgba(178,34,58,.22)')},
 heading:{fontFamily:fonts.display,color:colors.parchment,fontSize:22,fontWeight:'700',letterSpacing:1.2},
 status:{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:5,paddingHorizontal:10,borderRadius:20,backgroundColor:'rgba(0,0,0,.35)',borderWidth:1,borderColor:'rgba(255,255,255,.06)'},
 connection:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'600',letterSpacing:.4},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20,marginBottom:12},
 prompt:{fontFamily:fonts.display,color:colors.gold,fontSize:13,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase',marginTop:6,marginBottom:10},
 input:{fontFamily:fonts.story,color:'#f5efe1',backgroundColor:tint('rgba(8,5,9,.75)'),borderColor:tint('rgba(178,34,58,.4)'),borderWidth:1,borderRadius:3,padding:16,minHeight:92,textAlignVertical:'top',fontSize:18,lineHeight:26},
 toolbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginTop:12},hint:{fontFamily:fonts.ui,color:colors.faint,fontSize:11.5,flexShrink:1},
 button:{paddingVertical:13,paddingHorizontal:24,backgroundColor:tint('#9e1b32'),borderRadius:3,borderWidth:1,borderColor:tint('#f06e80'),minHeight:46,justifyContent:'center'},buttonText:{fontFamily:fonts.display,color:tint('#ffeef0'),fontSize:13,fontWeight:'800',letterSpacing:1.8,textTransform:'uppercase'},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:22,marginTop:12}
});
