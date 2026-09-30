import {useSceneTransition} from './SceneTransition';
import {dmEndpoints} from './dmConnection';
import {recruitmentTargets} from './followerRules';
import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {npcArtSubject,creatureArtSubject} from './worldArtRules';
import {subscribeArt,artIdentity} from './artClient';
import {storyText} from './storyRules';
import TurnPlayback from './TurnPlayback';
import {conversationPeople,conversationTarget,activeEffectLines,visibleTurn} from './playbackRules';
import {adventureStep} from './adventureRules';
import {dmCommand} from './dmCommands';
import React,{useState,useEffect,useRef} from 'react';
import {View,Text as PlainText,TextInput,Pressable,ScrollView,StyleSheet,useWindowDimensions,Keyboard} from 'react-native';
import {dmContext,dmChoices,commitDmTurn} from './dmContext';
import {fonts,colors,type} from './theme';
import {playSound} from './audio';
const endpoints=dmEndpoints();
// The last service that answered ready; a remounted panel checks it first instead of rescanning every address.
let lastReady=null;
export default function DungeonMaster({hero,game,health,act,onConversationChange,table,fill=false,quick=[],sendRef}) {
  const {width:viewWidth,height:viewHeight}=useWindowDimensions(),compact=viewWidth<600,short=viewHeight<520;
  const transition=useSceneTransition();
  const openConversation=async id=>{try{await transition.prepare(conversationPeople(game).map(n=>npcArtSubject(game,n.id)));setConversationId(id);setError('');return true;}catch(e){setError(e.message);return false;}};
  const creature=creatureArtSubject(game),creatureKey=creature?artIdentity(creature):null;
  useEffect(()=>creature?subscribeArt(creature,()=>{}):undefined,[creatureKey]);
  const [conversationId,setConversationId]=useState(null),[animateId,setAnimateId]=useState(null),[playing,setPlaying]=useState(false);
  const people=conversationPeople(game),person=people.find(n=>n.id===conversationId);
  useEffect(()=>{if(conversationId&&!person)setConversationId(null);onConversationChange(!!person);},[conversationId,!!person,onConversationChange]);
  const [endpoint,setEndpoint]=useState(lastReady??endpoints[0]);
  const [connected,setConnected]=useState(false),[protocol,setProtocol]=useState(0),[checked,setChecked]=useState(false);
  const inputRef=useRef(null);
  const [input,setInput]=useState(''),[reply,setReply]=useState(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('Checking AI connection…'),[error,setError]=useState('');
  const fingerprint=JSON.stringify({hero,game,health}),latest=useRef(fingerprint),lock=useRef(false),alive=useRef(true),triedCue=useRef(null);latest.current=fingerprint;
  useEffect(()=>{
    alive.current=true;let checking=false,known=lastReady;
    // Once a ready service answers, only it is polled; the full list is scanned again if it stops answering.
    const probe=async list=>(await Promise.all(list.map(async url=>{try{const response=await fetch(url+'/health',{signal:AbortSignal.timeout(3000)});return response.ok?{url,state:await response.json()}:null;}catch{return null;}}))).filter(Boolean).sort((a,b)=>Number(b.state.ready)-Number(a.state.ready)||(b.state.actionProtocol??0)-(a.state.actionProtocol??0))[0];
    const check=async()=>{if(checking)return;checking=true;try{
      let found=known?await probe([known]):null;if(!found?.state.ready)found=await probe(endpoints);
      lastReady=known=found?.state.ready?found.url:null;if(!found)throw Error('Unavailable');
      if(alive.current){setEndpoint(found.url);setConnected(!!found.state.ready);setProtocol(found.state.actionProtocol??0);setStatus(!found.state.ready?'AI DM needs your private setup.':found.state.actionProtocol>=3?'AI DM connected · rulings enabled':found.state.actionProtocol===2?'AI DM connected · actions enabled':'AI DM connected · private service upgrade needed for rulings');}
    }catch{if(alive.current){setConnected(false);setProtocol(0);setStatus('AI DM server is not running. Reconnecting automatically…');}}finally{checking=false;if(alive.current)setChecked(true);}};
    check();const timer=setInterval(check,5000);return()=>{alive.current=false;clearInterval(timer);};
  },[]);
  const post=async(input,scene,hp,talkingTo,extra)=>{const response=await fetch(endpoint+'/dm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,context:{...dmContext(hero,scene,hp),conversationWith:talkingTo?{id:talkingTo.id,name:talkingTo.name,role:talkingTo.role}:null,conversationParticipants:conversationPeople(scene).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude})),...extra}}),signal:AbortSignal.timeout(90000)});const body=await response.json();if(!response.ok)throw Error(body.error||'The DM could not respond.');if(typeof body.narration!=='string'||!body.narration.trim()||body.narration.length>1800)throw Error('Invalid DM reply. Nothing was applied.');return body;};
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
  // Turns that arrive from other players at the table play out here too.
  const lastTurnId=game.playback?.at(-1)?.id??0,seenTurn=useRef(lastTurnId);
  useEffect(()=>{if(lastTurnId>seenTurn.current&&table?.joined)setAnimateId(lastTurnId);seenTurn.current=lastTurnId;},[lastTurnId]);
  // Each new turn brings the action row back to its first (main) action.
  const actionScroll=useRef(null);
  useEffect(()=>{actionScroll.current?.scrollTo?.({x:0,animated:true});},[lastTurnId]);
  // Tell the table while this player is taking a turn, so others wait instead of racing.
  useEffect(()=>{table?.setActing?.(busy);},[busy]);
  const waiting=table?.joined?table.otherActing:null; const tableSyncing=!!table?.joined&&!table.synchronized;
  // A quick action arrives as {question, action}: the sentence the DM hears and the engine action it resolves.
  async function ask(preset){
    preset=preset?.question&&preset.action?preset:null;
    const question=preset?.question??input.trim();
    if(lock.current||playing||!question||waiting||tableSyncing)return;const priorReply=reply,snapshot=fingerprint;if(compact)Keyboard.dismiss();lock.current=true;setBusy(true);setError('');playSound('send');
    const target=preset?null:conversationTarget(game,question,conversationId);
    if(target&&!await openConversation(target)){lock.current=false;setBusy(false);return;}
    const talkingTo=people.find(n=>n.id===target);
    const unchanged=()=>{if(!alive.current)throw Error('The adventure was closed. Nothing was applied.');if(latest.current!==snapshot)throw Error('The scene changed while the DM was thinking. Nothing was applied. Ask again.');};
    const request=async(scene=game,hp=health,extra={})=>{if(!connected)throw Error('The AI service is disconnected. Open your private AI setup window.');const body=await post(question,scene,hp,talkingTo,{recruitmentTargets:recruitmentTargets(scene,question,target),...extra});unchanged();return body;};
    const finish=async(action,body,normalizedCommand,random)=>{unchanged();const result=await act(action,{question,narration:body.narration,dialogue:body.dialogue,worldEvent:body.worldEvent,normalizedCommand,npcId:target},random);if(result.error)throw Error(result.error);setReply({narration:body.narration});setAnimateId(result.turn?.id??null);setConversationId(conversationPeople(result.game).some(n=>n.id===target)?target:null);if(!preset)setInput('');return result;};
    const cast=async(command,normalized,narration)=>{
      const rolled=[];const preview=adventureStep(game,health,hero,command.action,()=>{const value=Math.random();rolled.push(value);return value;});if(preview.error)throw Error(preview.error);
      if(preview.waiting&&protocol>=3){
        const body=await request(preview.game,preview.health);if(!body.ruling)throw Error('The DM did not resolve this spell. Nothing was spent; try again with more detail.');
        const action={type:'ai-spell',request:command.action.request,ruling:body.ruling},dice=[];
        const resolved=commitDmTurn(hero,game,health,action,{question,narration:body.narration,worldEvent:body.worldEvent,normalizedCommand:normalized},()=>{const value=Math.random();dice.push(value);return value;});
        if(resolved.error)throw Error(resolved.error);
        if(body.ruling.decision==='cast'){
          const reaction=await request(resolved.game,resolved.health,{engineResolved:(resolved.events??[]).map(t=>storyText(resolved.game,t)).slice(0,40)});
          body.narration=reaction.narration;body.dialogue=reaction.dialogue;
        }
        let index=0;await finish(action,body,normalized,()=>dice[index++]??0.5);
      }
      else {let body={narration:narration??command.narration??'Your action is resolved below.'};
        if(connected&&protocol>=3)body=await request(preview.game,preview.health,{engineResolved:(preview.events??[]).map(t=>storyText(preview.game,t)).slice(0,40)});
        let index=0;await finish(command.action,{narration:body.narration,dialogue:body.dialogue},normalized,()=>rolled[index++]??0.5);
      }
    };
    try{
      const command=preset?{action:preset.action}:dmCommand(hero,game,question,health,conversationId);
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
        let index=0;await finish(action,{narration:resolved.narration,dialogue:resolved.dialogue,worldEvent:null},undefined,()=>dice[index++]??0.5);return;
      }
      if(protocol>=3&&body.check){
        const action={type:'ai-check',check:body.check},dice=[];
        const preview=commitDmTurn(hero,game,health,action,{question,narration:body.narration,worldEvent:null},()=>{const value=Math.random();dice.push(value);return value;});
        if(preview.error)throw Error(preview.error);
        const resolved=await request(preview.game,preview.health,{engineResolved:(preview.events??[]).map(t=>storyText(preview.game,t)).slice(0,40)});
        let index=0;await finish(action,{narration:resolved.narration,dialogue:resolved.dialogue,worldEvent:null},undefined,()=>dice[index++]??0.5);return;
      }
      if(protocol>=3&&body.ruling){await finish({type:'ai-ruling',ruling:body.ruling},body);return;}
      const choice=body.actionId===null?null:dmChoices(hero,game).find(c=>c.id===body.actionId);if(body.actionId!==null&&!choice)throw Error('That action is no longer available.');
      if(protocol>=3&&choice){await cast({action:choice.action},undefined,body.narration);return;}
      const result=await finish(protocol>=2?(choice?.action??null):null,protocol>=3?body:{narration:body.narration});
      if(protocol<2&&choice)setReply({narration:body.narration,pending:choice,snapshot:JSON.stringify({hero,game:result.game,health:result.health})});
    }catch(e){if(alive.current)setError(e.name==='TimeoutError'?'The DM took too long. Nothing was applied.':storyText(game,e.message));}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  const turns=(person?(game.playback??[]).filter(t=>t.npcId===person.id||(t.participants??[]).some(id=>people.some(n=>n.id===id))):(game.playback??[])).map(t=>visibleTurn(t,game));
  const effects=activeEffectLines(game,health);
  const previousNarration=(game.journal?.entries??[]).filter(e=>e.title==='AI DM conversation').at(-1)?.text.split(/\n(?:AI DM|Dungeon Master): /).at(-1)?.split('\nResult:')[0];
  const attitude=person?.attitude==='hostile'?{label:'Hostile · remembers what happened',color:colors.bloodBright}:person?.attitude==='unfriendly'?{label:'Unfriendly',color:'#e0a860'}:{label:'Listening',color:colors.heal};
  const sendDisabled=busy||playing||!input.trim()||!!waiting||tableSyncing;
  const statusText=busy?(compact?'Resolving…':'Resolving your turn…'):playing?(compact?'Playing…':'Playing turn…'):connected?'Connected':checked?'Offline':'Connecting…';
  const statusColor=busy||playing||!checked?colors.gold:connected?colors.heal:'#8a6a35';
  const hint=tableSyncing?'Catching up with the shared table…':waiting?'⏳ '+waiting+' is taking a turn. Wait for the table.':null;
  // Quick actions: one tap sends; Cast… starts the sentence so the player names the spell and target.
  if(sendRef)sendRef.current=preset=>ask(preset);
  const actions=person?[]:quick,actionsDisabled=busy||playing||!!waiting||tableSyncing;
  const runAction=a=>{if(a.run){a.run();return;}if(a.prefill){setInput(a.prefill);setTimeout(()=>inputRef.current?.focus(),30);return;}ask(a);};
  // Phones and short windows scroll the row sideways; roomy screens wrap it. On a short screen (a phone on its
  // side) people and effects join the same row so the story keeps its height.
  const swipe=compact||short;
  const actionChips=actions.map(a=><Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.prefill?'Cast a spell: start typing it':a.question??a.label} accessibilityState={{disabled:actionsDisabled}} disabled={actionsDisabled} onPress={()=>runAction(a)} dataSet={{qb:a.primary&&!a.prefill?'btn-primary':'chip'}} style={[s.action,a.primary&&!a.prefill&&s.actionPrimary,actionsDisabled&&{opacity:.45}]}><PlainText style={[s.actionGlyph,a.primary&&!a.prefill&&s.actionPrimaryText]}>{a.glyph}</PlainText><PlainText numberOfLines={1} style={[s.actionText,a.primary&&!a.prefill&&s.actionPrimaryText]}>{a.label}</PlainText></Pressable>);
  const extraChips=[...effects.map(line=><View key={'effect:'+line} style={s.effectChip}><Text numberOfLines={1} style={s.effectChipText}>✧ {line}</Text></View>),
    ...people.filter(n=>n.id!==person?.id).map(n=><Pressable key={'person:'+n.id} accessibilityRole="button" accessibilityLabel={(person?'Address ':'Speak with ')+n.name} disabled={busy||playing} onPress={()=>openConversation(n.id)} dataSet={{qb:'chip'}} style={s.personChip}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={s.chipAvatar} compact/><PlainText numberOfLines={1} style={s.chipName}>{n.name}</PlainText><PlainText style={s.chipAction}>{person?'Address':'Speak'} ›</PlainText></Pressable>)];
  const row=(chips,wrap,ref)=>chips.length>0&&<ScrollView ref={ref} horizontal={!wrap} dataSet={{qb:wrap?'actions':'actions-scroll'}} showsHorizontalScrollIndicator={false} style={s.actionBar} contentContainerStyle={[s.actionContent,wrap&&s.actionWrap]} accessibilityLabel="Quick actions">{chips}</ScrollView>;
  const actionBar=short?row([...actionChips,...extraChips],false,actionScroll):<>{row(extraChips,false)}{row(actionChips,!swipe,actionScroll)}</>;
  const statusPill=<View style={s.status}><View style={[s.dot,{backgroundColor:statusColor}]}/><Text accessibilityLiveRegion="polite" style={[s.connection,{color:statusColor}]}>{statusText}</Text></View>;
  const composer=<TextInput ref={inputRef} dataSet={{qb:'input'}} accessibilityLabel="Action for the Dungeon Master" value={input} onChangeText={setInput} maxLength={1000} multiline onKeyPress={event=>{if(event.nativeEvent.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault?.();ask();}}} placeholder={person?'Speak to '+person.name+'…':'Describe your next move…'} placeholderTextColor="#7f889c" style={[s.input,fill&&s.fillInput,fill&&short&&{minHeight:42,paddingVertical:9}]}/>;
  const sendButton=<Pressable accessibilityRole="button" accessibilityLabel="Send to the Dungeon Master" accessibilityState={{disabled:sendDisabled}} disabled={sendDisabled} onPress={()=>ask()} dataSet={{qb:'btn-primary'}} style={[s.button,fill&&s.fillSend,fill&&short&&{minHeight:42,paddingVertical:8},sendDisabled&&{opacity:0.45}]}><Text style={s.buttonText}>{tableSyncing?'Catching up…':busy?(fill&&compact?'…':'Resolving…'):playing?(fill&&compact?'…':'Playing…'):waiting?'Waiting…':fill&&compact?'➤':'Send  ➤'}</Text></Pressable>;
  if(fill)return <View dataSet={{qb:'plate'}} style={[s.panel,s.fill,person&&s.conversation,(compact||short)&&s.fillCompact]}>
    {person?<View style={s.fillHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to adventure" disabled={busy||playing} onPress={()=>setConversationId(null)} style={s.fillBack}><Text style={s.backText}>‹</Text></Pressable>
      <DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,person.id)} style={[s.fillPortrait,compact&&{width:44,height:52},short&&{width:34,height:40}]}/>
      <View style={{flex:1,minWidth:0}}><PlainText numberOfLines={1} style={[s.personName,s.fillName,short&&{fontSize:16}]}>{person.name}</PlainText>{!short&&<PlainText numberOfLines={1} style={s.fillRole}>{person.role}</PlainText>}<View style={s.attitude}><View style={[s.dot,{backgroundColor:attitude.color}]}/><PlainText style={[s.attitudeText,{color:attitude.color}]}>{attitude.label}</PlainText></View></View>
    </View>:!short&&<View style={s.fillHeader}>
      <View style={{flex:1,minWidth:0}}><Text style={s.overline}>YOUR NARRATOR</Text><Text numberOfLines={1} style={[s.heading,s.fillHeading]}>The Dungeon Master</Text></View>
      {statusPill}
    </View>}
    {!connected&&checked&&<Text style={[s.caption,{marginBottom:6}]}>{status}</Text>}
    <TurnPlayback fill aside={short&&!person?statusPill:null} me={table?.joined?table.name:null} turns={turns} animateId={animateId} onPlayingChange={setPlaying} busy={busy} opening={person?'You turn to '+person.name+'.':previousNarration??game.story?.opening??'Describe what you do. Your story unfolds here.'}/>
    {!!hint&&<Text style={[s.hint,{color:colors.gold,marginTop:6}]}>{hint}</Text>}
    {actionBar}
    <View style={s.composer}>{composer}{sendButton}</View>
    {!!error&&<Text accessibilityRole="alert" style={[s.error,{marginTop:6}]}>{error}</Text>}
    {reply?.pending&&<Text style={s.caption}>Suggested action: {reply.pending.label}. Send “confirm action” to carry it out.</Text>}
  </View>;
  return <View dataSet={{qb:'plate'}} style={[s.panel,person&&s.conversation,compact&&{padding:14}]}>
    {person?<View><Pressable accessibilityRole="button" disabled={busy||playing} onPress={()=>setConversationId(null)} style={s.back}><Text style={s.backText}>‹  Back to adventure</Text></Pressable><View style={s.portraitRow}><DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,person.id)} style={[s.portrait,compact&&{width:132,height:156}]}/><View style={{flex:1,minWidth:150}}><Text style={s.overline}>{people.length>1?'GROUP CONVERSATION':'IN CONVERSATION'}</Text><PlainText style={[s.personName,compact&&{fontSize:24}]}>{person.name}</PlainText><Text style={s.role}>{person.role}</Text><View style={s.attitude}><View style={[s.dot,{backgroundColor:attitude.color}]}/><Text style={[s.attitudeText,{color:attitude.color}]}>{attitude.label}</Text></View></View></View>{people.length>1&&<View style={s.group}>{people.map(n=><Pressable key={n.id} accessibilityRole="button" accessibilityLabel={'Address '+n.name} disabled={busy||playing} onPress={()=>openConversation(n.id)} dataSet={{qb:'chip'}} style={[s.groupMember,n.id===person.id&&s.groupActive]}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={s.avatar} compact/><PlainText style={s.chipText}>{n.name}</PlainText></Pressable>)}</View>}</View>:<View style={s.header}><View><Text style={s.overline}>YOUR NARRATOR</Text><Text style={s.heading}>The Dungeon Master</Text></View><View style={s.status}><View style={[s.dot,{backgroundColor:busy||playing?colors.gold:connected?colors.heal:'#8a6a35'}]}/><Text accessibilityLiveRegion="polite" style={[s.connection,{color:busy||playing?colors.gold:connected?'#a6d8b8':'#d8b879'}]}>{busy?'Resolving your turn…':playing?'Playing turn…':connected?'Connected':'Offline'}</Text></View></View>}
    
    {!connected&&<Text style={s.caption}>{status}</Text>}
    <TurnPlayback me={table?.joined?table.name:null} turns={turns} animateId={animateId} onPlayingChange={setPlaying} busy={busy} opening={person?'You turn to '+person.name+'.':previousNarration??game.story?.opening??'Describe what you do. Your story unfolds here.'}/>
    <Text style={s.prompt}>{person?'What do you say?':'What do you do?'}</Text>
    <TextInput dataSet={{qb:'input'}} accessibilityLabel="Action for the Dungeon Master" value={input} onChangeText={setInput} maxLength={1000} multiline onKeyPress={event=>{if(event.nativeEvent.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault?.();ask();}}} placeholder={person?'Speak to '+person.name+'…':'Describe your next move…'} placeholderTextColor="#7f889c" style={s.input}/>
    <View style={s.toolbar}><Text style={[s.hint,!!waiting&&{color:colors.gold}]}>{tableSyncing?'Catching up with the shared table…':waiting?'⏳ '+waiting+' is taking a turn. Wait for the table.':compact?'Tap Send to DM':'Enter to send · Shift+Enter for a new line'}</Text><Pressable accessibilityRole="button" accessibilityState={{disabled:busy||playing||!input.trim()||!!waiting||tableSyncing}} disabled={busy||playing||!input.trim()||!!waiting||tableSyncing} onPress={()=>ask()}dataSet={{qb:'btn-primary'}} style={[s.button,(busy||playing||!input.trim()||!!waiting||tableSyncing)&&{opacity:0.45}]}><Text style={s.buttonText}>{tableSyncing?'Catching up…':busy?'Resolving…':playing?'Playing turn…':waiting?'Waiting…':'Send to DM  ➤'}</Text></Pressable></View>
    {effects.length>0&&<View style={s.effects}><Text style={[s.overline,{color:colors.arcane}]}>✧ ONGOING EFFECTS</Text>{effects.map(line=><Text key={line} style={s.effectText}>{line}</Text>)}</View>}
    {!person&&people.length>0&&<View style={s.people}><Text style={s.overline}>PEOPLE NEARBY</Text>{people.map(n=><Pressable key={n.id} accessibilityRole="button" disabled={busy||playing} onPress={()=>openConversation(n.id)} dataSet={{qb:'chip'}} style={s.personButton}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={s.avatar} compact/><View style={{flexShrink:1}}><PlainText style={s.chipName}>{n.name}</PlainText><PlainText style={s.chipRole} numberOfLines={1}>{n.role}</PlainText></View><PlainText style={s.chipAction} numberOfLines={1}>Speak ›</PlainText></Pressable>)}</View>}
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {reply?.pending&&<Text style={s.caption}>Suggested action: {reply.pending.label}. Send “confirm action” to carry it out.</Text>}
    {reply?.pending&&reply.snapshot!==fingerprint&&<Text style={s.caption}>The scene changed. Send a new message for a current suggestion.</Text>}
  </View>;
}
const s=StyleSheet.create({group:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},groupMember:{maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:10,paddingVertical:7,paddingHorizontal:10,borderWidth:1,borderColor:'rgba(201,164,92,.3)',borderRadius:3,backgroundColor:'rgba(20,25,36,.9)'},groupActive:{borderColor:colors.gold},
 conversation:{borderColor:'rgba(232,199,123,.6)'},back:{paddingVertical:10,marginBottom:10,minHeight:44,alignSelf:'flex-start'},backText:{fontFamily:fonts.display,letterSpacing:1.4,color:colors.gold,fontSize:12,fontWeight:'700',textTransform:'uppercase'},
 portraitRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:22,marginBottom:22},portrait:{width:168,height:200,borderRadius:3},
 personName:{fontFamily:fonts.display,fontWeight:'700',color:colors.parchment,fontSize:30,letterSpacing:1,marginBottom:6},role:{fontFamily:fonts.story,fontStyle:'italic',color:'#cdbf9f',fontSize:17,lineHeight:24,marginBottom:10},
 attitude:{flexDirection:'row',alignItems:'center',gap:8},attitudeText:{fontFamily:fonts.ui,fontSize:12,fontWeight:'600',letterSpacing:.4},
 dot:{width:8,height:8,borderRadius:4,boxShadow:'0 0 8px currentColor'},
 overline:{...type.label,marginBottom:6},
 effects:{padding:14,borderRadius:3,borderWidth:1,borderColor:'rgba(111,208,196,.35)',backgroundColor:'rgba(16,40,40,.55)',marginTop:14,marginBottom:6},effectText:{fontFamily:fonts.ui,color:'#bfe6de',fontSize:13,lineHeight:21},
 people:{gap:8,marginTop:18},personButton:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:8,paddingHorizontal:10,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.3)',backgroundColor:'rgba(20,25,36,.9)'},
 avatar:{width:40,height:40,borderRadius:20},chipText:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:.8,color:colors.parchment,fontSize:13},
 chipName:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:.8,color:colors.parchment,fontSize:14},chipRole:{fontFamily:fonts.ui,color:colors.muted,fontSize:11.5,marginTop:2},chipAction:{marginLeft:'auto',flexShrink:0,paddingLeft:8,fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
 panel:{padding:22,marginVertical:12,backgroundColor:'rgba(12,16,24,.8)',borderRadius:4,borderWidth:1,borderColor:colors.goldLine},
 // Fill mode: the panel takes the whole play area; the feed grows and the composer stays pinned to the bottom.
 fill:{flex:1,minHeight:0,marginVertical:0,padding:16,paddingBottom:12},fillCompact:{padding:10,paddingBottom:8,borderLeftWidth:0,borderRightWidth:0,borderRadius:0},
 fillHeader:{flexDirection:'row',alignItems:'center',gap:12,paddingBottom:10,marginBottom:6,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.22)'},
 fillHeading:{fontSize:18},fillBack:{minWidth:36,minHeight:44,justifyContent:'center',alignItems:'center'},
 fillPortrait:{width:56,height:66,borderRadius:3},fillName:{fontSize:20,marginBottom:2},fillRole:{fontFamily:fonts.story,fontStyle:'italic',color:'#cdbf9f',fontSize:14,marginBottom:3},
 effectChip:{paddingHorizontal:10,paddingVertical:6,borderRadius:14,borderWidth:1,borderColor:'rgba(111,208,196,.4)',backgroundColor:'rgba(16,40,40,.7)'},effectChipText:{fontFamily:fonts.ui,color:'#bfe6de',fontSize:12},
 personChip:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4,paddingLeft:4,paddingRight:10,borderRadius:22,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'rgba(20,25,36,.92)'},chipAvatar:{width:30,height:30,borderRadius:15},
 composer:{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:8},
 actionBar:{flexGrow:0,flexShrink:0,marginTop:8},actionContent:{gap:8,alignItems:'center',paddingRight:40},actionWrap:{flexDirection:'row',flexWrap:'wrap',paddingRight:0},
 action:{flexDirection:'row',alignItems:'center',gap:7,minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:'rgba(201,164,92,.45)',backgroundColor:'rgba(20,25,36,.92)',maxWidth:260},
 actionPrimary:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},actionGlyph:{fontSize:14,color:colors.gold},
 actionText:{fontFamily:fonts.display,fontSize:12,fontWeight:'700',letterSpacing:1.1,color:'#ecdcb8',textTransform:'uppercase',flexShrink:1},actionPrimaryText:{color:'#2a1a07'},
 fillInput:{flex:1,minHeight:48,maxHeight:130,paddingVertical:12,fontSize:17,lineHeight:24},
 fillSend:{minHeight:48,paddingHorizontal:18,justifyContent:'center',alignItems:'center'},
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end',gap:8,flexWrap:'wrap',marginBottom:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.22)'},
 heading:{fontFamily:fonts.display,color:colors.parchment,fontSize:22,fontWeight:'700',letterSpacing:1.2},
 status:{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:5,paddingHorizontal:10,borderRadius:20,backgroundColor:'rgba(0,0,0,.35)',borderWidth:1,borderColor:'rgba(255,255,255,.06)'},
 connection:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'600',letterSpacing:.4},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20,marginBottom:12},
 prompt:{fontFamily:fonts.display,color:colors.gold,fontSize:13,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase',marginTop:6,marginBottom:10},
 input:{fontFamily:fonts.story,color:'#f5efe1',backgroundColor:'rgba(4,6,10,.75)',borderColor:'rgba(201,164,92,.4)',borderWidth:1,borderRadius:3,padding:16,minHeight:92,textAlignVertical:'top',fontSize:18,lineHeight:26},
 toolbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginTop:12},hint:{fontFamily:fonts.ui,color:colors.faint,fontSize:11.5,flexShrink:1},
 button:{paddingVertical:13,paddingHorizontal:24,backgroundColor:'#d9ae5f',borderRadius:3,borderWidth:1,borderColor:'#fff0c4',minHeight:46,justifyContent:'center'},buttonText:{fontFamily:fonts.display,color:'#2a1a07',fontSize:13,fontWeight:'800',letterSpacing:1.8,textTransform:'uppercase'},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:22,marginTop:12}
});
