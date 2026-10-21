// The turn with the Dungeon Master, as DungeonMaster.js plays it: the connection to the service, what the player types,
// the words sent (post) and the reply applied (ask), people who speak first (scene cues, the Speak chip: engage) and
// turns arriving from the table. The pure pieces are in dmTurnRules.js; DungeonMaster.js draws the screen.
import {useSceneTransition} from './SceneTransition';
import {dmEndpoints,askDm} from './dmConnection';
import {recruitmentTargets} from './followerRules';
import {npcArtSubject} from './worldArtRules';
import {conversationPeople,conversationTarget} from './playbackRules';
import {adventureStep} from './adventureRules';
import {dmCommand,withAttackIntent} from './dmCommands';
import {storyPreferences} from './storyPreferences';
import {suggestionsFlag} from './suggestionPanel';
import {useState,useEffect,useRef,useMemo} from 'react';
import {Keyboard} from 'react-native';
import {commitDmTurn} from './dmContext';
import {playSound} from './audio';
import {speakTurn,stopNarrator} from './narrator';
import {turnToRewind,forgetTurn,toDungeonMaster,withoutAddress} from './turnMemory';
import {touchKeyboard} from './webLayout';
import {greeting,shouldGreet} from './greetings';
import {turnOrderView} from './encounterRules';
import {noteProblem} from './problemLog';
import {deedById} from './deedRules';
import {cue} from './cinematics';
import {countTurn,noteTalking} from './playMetrics';
import {routineTelling} from './fightLines';
import {turnRequestContext,dmReplyError,outOfCharacterContext,engineLines,turnRecord,toldReply,suggestionLines,turnFailureMessage,benignTurnFailure,arrivingTurn} from './dmTurnRules';
import {dmChoices,mapMoves} from "./dmChoiceRules";
const endpoints=dmEndpoints();
// The last service that answered ready; a remounted panel checks it first instead of rescanning every address.
let lastReady=null;
export function useDmTurn({hero,game,health,act,onConversationChange,table,compact}){
  // When the Dungeon Master cannot be reached: the host is told what to start, a guest only that it is not answering.
  const offline=()=>dmEndpoints()[0]==='/api'?'The host\'s Dungeon Master is not answering right now. Your words are kept here; try again in a moment.':'The Dungeon Master service is not running on this PC. Start it with Questbound.cmd, then try again; your words are kept here.';
  // Out of character: the next message goes to the Dungeon Master as a player, not into the story.
  const [direct,setDirect]=useState(false);
  const transition=useSceneTransition();
  const openConversation=async id=>{try{await transition.prepare(conversationPeople(game).map(n=>npcArtSubject(game,n.id)));setConversationId(id);setError('');return true;}catch(e){setError(e.message);return false;}};
  const [conversationId,setConversationId]=useState(null),[animateId,setAnimateId]=useState(null),[playing,setPlaying]=useState(false);
  const people=conversationPeople(game),person=people.find(n=>n.id===conversationId);
  useEffect(()=>{if(conversationId&&!person)setConversationId(null);onConversationChange(!!person);noteTalking(!!person);},[conversationId,!!person,onConversationChange]);
  // Just you two: with others about, the one turned to answers alone unless the player opens the talk to everyone here.
  const [alone,setAlone]=useState(true);
  useEffect(()=>{setAlone(true);},[conversationId]);
  // Things the player might say next (the Suggestions tab), as the Dungeon Master wrote them for the latest turn. Only
  // this device's memory holds them: they are never saved or shared with the table.
  const [ideas,setIdeas]=useState(null);
  const keepIdeas=(turn,personId,body)=>setIdeas({turn:turn??null,person:personId??null,lines:suggestionLines(body)});
  const [endpoint,setEndpoint]=useState(lastReady??endpoints[0]);
  const [connected,setConnected]=useState(false),[protocol,setProtocol]=useState(0),[checked,setChecked]=useState(false),[unpaired,setUnpaired]=useState(false);
  const inputRef=useRef(null);
  const [input,setInput]=useState(''),[reply,setReply]=useState(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('Checking AI connection…'),[error,setError]=useState(''),[errorProblem,setErrorProblem]=useState(null);
  // A failed turn is shown in the error row and kept in the problem log (problemLog.js), so a playtest note can say
  // what was tried and what went wrong; the Report chip beside the error opens one. A scene that moved on, or an
  // adventure that was closed, is not a problem.
  const refusal=message=>Object.assign(Error(message),{refused:true});
  const fail=(e,{said=null,action=null}={})=>{
    if(!alive.current)return;
    const message=turnFailureMessage(game,e);
    const benign=benignTurnFailure(message);
    const entry=benign?null:noteProblem({kind:e?.refused?'refused':'dm',said,error:message,stage:game.stage,action:action?.type??null,spell:action?.spell??action?.request?.spell??null});
    setErrorProblem(entry);setError(message);
  };
  // Worked out once per change of the game, not on every streamed line of narration.
  const fingerprint=useMemo(()=>JSON.stringify({hero,game,health}),[hero,game,health]),latest=useRef(fingerprint),lock=useRef(false),alive=useRef(true),triedCue=useRef(null);latest.current=fingerprint;
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
  const post=async(input,scene,hp,talkingTo,extra)=>{const {ok,status:code,body}=await askDm(endpoint,{input,context:turnRequestContext({hero,scene,hp,input,health,preferences:storyPreferences(),talkingTo,alone,extra:{...suggestionsFlag(),...extra}})},{onNarration:text=>{if(alive.current)setDraft(text);}});if(code===401)setUnpaired(true);const problem=dmReplyError(ok,body);if(problem)throw Error(problem);return body;};
  // A scene trigger lets present characters speak first; the written line stands in when the AI is unavailable.
  useEffect(()=>{
    const cue=game.sceneCue,attempt=cue&&cue.id+'@'+fingerprint;if(table?.joined||!cue||busy||playing||lock.current||triedCue.current===attempt)return;
    // At a shared table only the device whose action caused the moment asks the NPCs to speak.
    if(cue.origin&&table?.joined&&cue.origin!==table.deviceId)return;
    const speaker=people.find(n=>n.id===cue.speakerId)??people[0],snapshot=fingerprint;triedCue.current=attempt;
    lock.current=true;setBusy(true);setError('');
    (async()=>{
      let narration=cue.scene,dialogue=speaker?[{speakerId:speaker.id,text:cue.fallback}]:[],said=null;
      if(connected&&speaker)try{const body=await post(cue.scene,game,health,speaker,{sceneTrigger:{id:cue.id,cue:cue.cue},recruitmentTargets:[]});const lines=(body.dialogue??[]).filter(l=>people.some(n=>n.id===l.speakerId));if(lines.length){narration=body.narration;dialogue=lines;said=body;}}catch{}
      if(!alive.current||latest.current!==snapshot)return;
      const result=await act(null,{question:cue.scene,narration,dialogue,trigger:true,npcId:speaker?.id??null});
      if(!result.error){setAnimateId(result.turn?.id??null);const talking=!!speaker&&conversationPeople(result.game).some(n=>n.id===speaker.id);if(talking)setConversationId(speaker.id);keepIdeas(result.turn?.id,talking?speaker.id:conversationId,said);}
    })().catch(e=>fail(e)).finally(()=>{lock.current=false;if(alive.current)setBusy(false);});
  },[game.sceneCue?.id,busy,playing]);
  // Turning to someone (the Speak chip): the conversation opens and they speak first, in their own voice and true to
  // how they feel about the hero. The Dungeon Master writes the line; a stand-in is used when it cannot be reached.
  // Someone who has only just spoken is not made to greet again.
  const engage=async id=>{
    if(lock.current||busy||playing)return;
    if(!await openConversation(id))return;
    const speaker=conversationPeople(game).find(n=>n.id===id);
    if(!speaker||waiting||tableSyncing||turnWait||!shouldGreet(game,id))return;
    const opening=greeting(game,id,hero),snapshot=fingerprint;
    lock.current=true;setBusy(true);setError('');setDraft('');
    // At a shared table the campaign server works out the greeting and plays it as a turn (server-turn.cjs, greet).
    if(table?.joined){
      try{const prefs=storyPreferences(),result=await table.turn(opening.scene,{npcId:id,greet:true,...suggestionsFlag(),oneOnOne:alone&&people.length>1,storyPreferences:{brutality:prefs.brutality,narrator:prefs.narrator},autoShield:prefs.autoShield!==false});
       if(!alive.current)return;
       const talking=conversationPeople(result.game).some(n=>n.id===id);if(talking)setConversationId(id);keepIdeas(result.turn?.id,talking?id:null,result);setAnimateId(result.turn?.id??null);}
      catch(e){fail(e);}
      finally{lock.current=false;if(alive.current){setBusy(false);setDraft('');}}
      return;
    }
    try{
      let narration=opening.aside,dialogue=[{speakerId:id,text:opening.fallback}],said=null;
      if(connected)try{const body=await post(opening.scene,game,health,speaker,{sceneTrigger:{id:'greet:'+id,cue:opening.cue},recruitmentTargets:[]});const lines=(body.dialogue??[]).filter(l=>l.speakerId===id).slice(0,2);if(lines.length){narration=body.narration;dialogue=lines;said=body;}}catch{}
      if(!alive.current||latest.current!==snapshot)return;
      const result=await act(null,{question:opening.scene,narration,dialogue,trigger:true,npcId:id});
      if(!result.error){setAnimateId(result.turn?.id??null);const talking=conversationPeople(result.game).some(n=>n.id===id);if(talking)setConversationId(id);keepIdeas(result.turn?.id,talking?id:null,said);}
    }catch(e){fail(e);}
    finally{lock.current=false;if(alive.current){setBusy(false);setDraft('');}}
  };
  // Turns that arrive from other players at the table play out here too, once and in order, as the acting player's own
  // turn does. The new turn is marked to play in the very render that first holds it (state set during render), so the
  // feed never shows it whole first and then plays it again from its first line (it did when this was an effect, a
  // render late). The first state after a reload or on joining is shown as it is: only a table already in step plays
  // what arrives.
  const lastTurnId=game.playback?.at(-1)?.id??0,inStep=!!table?.joined&&!!table.synchronized;
  const [seenTurn,setSeenTurn]=useState({id:lastTurnId,inStep});
  const arriving=arrivingTurn(seenTurn,lastTurnId,inStep);if(arriving.changed){setSeenTurn(arriving.next);if(arriving.play)setAnimateId(lastTurnId);}
  const spoken=useRef(lastTurnId);
  useEffect(()=>{if(table?.joined&&animateId===lastTurnId&&spoken.current!==lastTurnId){spoken.current=lastTurnId;try{speakTurn(game.playback.at(-1));}catch{}}},[animateId,lastTurnId]);
  const waiting=table?.joined?table.otherActing:null; const tableSyncing=!!table?.joined&&!table.synchronized;
  // A party's fight goes in turns (adventureRules.js): on someone else's turn this device waits.
  const turnsNow=turnOrderView(game),turnWait=turnsNow&&!turnsNow.mine?turnsNow.current:null;
  // A quick action arrives as {question, action}: the sentence the DM hears and the engine action it resolves.
  async function ask(preset){
    // A preset with `parse` is a complete typed sentence (a spell from the Cast… picker) read by the normal parser.
    preset=preset?.question&&(preset.action||preset.parse)?preset:null;
    const question=preset?.question??input.trim();
    const toDm=!preset&&(direct||toDungeonMaster(question));
    if(lock.current||playing||!question||waiting||tableSyncing||(game.stage==='dead'&&!toDm)||(turnWait&&!toDm&&preset?.action?.type!=='party-pass'))return;const priorReply=reply,snapshot=fingerprint;if(compact||touchKeyboard()){inputRef.current?.blur?.();Keyboard.dismiss();}lock.current=true;setBusy(true);setError('');setDraft('');playSound('send');countTurn();
    if(table?.joined){
      try{stopNarrator();}catch{}
      // The campaign server resolves the turn with its own dice through the same rules (server-turn.cjs); this device
      // sends its words, its view of the scene (just you two) and its own settings, and shows what comes back.
      try{const target=conversationTarget(game,question,conversationId),prefs=storyPreferences(),said=toDm?withoutAddress(question)||question:question;
       const result=await table.turn(question,{npcId:target,...suggestionsFlag(),direct:toDm,...(preset?.action?{action:preset.action}:{}),oneOnOne:!!target&&target===conversationId&&alone&&people.length>1,storyPreferences:{brutality:prefs.brutality,narrator:prefs.narrator},autoShield:prefs.autoShield!==false});
       if(!alive.current)return;
       const talking=!!target&&conversationPeople(result.game).some(n=>n.id===target);
       keepIdeas(result.turn?.id,talking?target:null,result);
       const fault=toDm&&result.fault?noteProblem({kind:'reported',said,answer:result.narration,stage:game.stage}):null;
       setReply({narration:result.narration,fault:fault?{problem:fault,said}:null});setAnimateId(result.turn?.id??null);setConversationId(target);setInput('');setDirect(false);
       (result.deeds??[]).forEach((id,i)=>setTimeout(()=>{const deed=deedById(id);if(deed)cue('deed',{deed});},1400+i*4400));}
      catch(e){fail(e,{said:question,action:preset?.action??null});}
      finally{lock.current=false;if(alive.current){setBusy(false);setDraft('');}}return;
    }
    // Speaking to the Dungeon Master directly: an answer out of character, and the last turn taken back when the
    // DM agrees it went wrong. Nothing else about the game changes.
    if(toDm){
      try{
        if(!connected)throw Error(offline());
        const said=withoutAddress(question)||question,back=table?.joined?null:turnToRewind(game),last=game.playback?.at(-1);
        const body=await post(said,game,health,null,{recruitmentTargets:[],outOfCharacter:outOfCharacterContext(back,last)});
        if(!alive.current)throw Error('The adventure was closed. Nothing was applied.');
        if(latest.current!==snapshot)throw Error('The scene changed while the DM was thinking. Ask again.');
        const rewound=body.rewind===true&&!!back;
        const result=await act(null,{question:('To the Dungeon Master: '+said).slice(0,1000),narration:body.narration.slice(0,1700)+(rewound?'\n\nYour last turn has been taken back. Say what you meant to do.':''),dialogue:[],direct:true,npcId:null},undefined,rewound?{from:back}:undefined);
        if(result.error)throw refusal(result.error);
        if(rewound)forgetTurn();
        // The Dungeon Master agreed something went wrong: kept as a problem, with a chip to tell the host.
        const fault=body.fault===true?noteProblem({kind:'reported',said,answer:body.narration,stage:game.stage}):null;
        setReply({narration:body.narration,fault:fault?{problem:fault,said}:null});setAnimateId(result.turn?.id??null);setInput('');setDirect(false);
      }catch(e){fail(e,{said:question});}
      finally{lock.current=false;if(alive.current){setBusy(false);setDraft('');}}
      return;
    }
    const target=preset?null:conversationTarget(game,question,conversationId);
    if(target&&!await openConversation(target)){lock.current=false;setBusy(false);return;}
    const talkingTo=people.find(n=>n.id===target);
    const unchanged=()=>{if(!alive.current)throw Error('The adventure was closed. Nothing was applied.');if(latest.current!==snapshot)throw Error('The scene changed while the DM was thinking. Nothing was applied. Ask again.');};
    const request=async(scene=game,hp=health,extra={})=>{if(!connected)throw Error(offline());const body=await post(question,scene,hp,talkingTo,{recruitmentTargets:recruitmentTargets(scene,question,target),...extra});unchanged();return body;};
    const finish=async(action,body,normalizedCommand,random)=>{unchanged();const result=await act(action,turnRecord(question,body,normalizedCommand,target),random);if(result.error)throw refusal(result.error);setReply({narration:body.narration});setAnimateId(result.turn?.id??null);const talking=conversationPeople(result.game).some(n=>n.id===target);setConversationId(talking?target:null);keepIdeas(result.turn?.id,talking?target:null,body);if(!preset)setInput('');return result;};
    const cast=async(command,normalized,narration,chosen=null)=>{
      // The player's own words ("knock him out") shape the preview exactly as they will shape the committed turn.
      const rolled=[];const preview=adventureStep(withAttackIntent(game,question),health,hero,command.action,()=>{const value=Math.random();rolled.push(value);return value;});if(preview.error)throw refusal(preview.error);
      if(preview.waiting&&protocol>=3){
        const body=await request(preview.game,preview.health);if(!body.ruling)throw Error('The DM did not resolve this spell. Nothing was spent; try again with more detail.');
        const action={type:'ai-spell',request:command.action.request,ruling:body.ruling},dice=[];
        const resolved=commitDmTurn(hero,game,health,action,{question,narration:body.narration,worldEvent:body.worldEvent,normalizedCommand:normalized},()=>{const value=Math.random();dice.push(value);return value;});
        if(resolved.error)throw refusal(resolved.error);
        if(body.ruling.decision==='cast'){
          const reaction=await request(resolved.game,resolved.health,{engineResolved:engineLines(resolved.game,resolved.events)});
          body.narration=reaction.narration;body.dialogue=reaction.dialogue;body.relationships=reaction.relationships;body.remember=reaction.remember;body.loot=reaction.loot;body.introduce=reaction.introduce;body.suggestions=reaction.suggestions;
        }
        let index=0;await finish(action,body,normalized,()=>dice[index++]??0.5);
      }
      else {let body={narration:narration??command.narration??'Your action is resolved below.'};
        // A routine fight move (a plain attack, Dodge, End turn, a draught...) is told by the game itself, with no request
        // to the Dungeon Master; a fight's start, kills, critical hits and every few rounds still go to it (fightLines.js).
        // A routine calm move the Dungeon Master chose keeps its own reply (calmLines.js chosenTelling): no second request.
        const told=narration===undefined||chosen?routineTelling({hero,before:game,preview,health,action:command.action,words:question,preferences:storyPreferences(),chosen}):null;
        if(told)body=told;
        else if(connected&&protocol>=3)body=await request(preview.game,preview.health,{engineResolved:engineLines(preview.game,preview.events)});
        let index=0;await finish(command.action,{narration:body.narration,dialogue:body.dialogue,relationships:body.relationships,remember:body.remember,loot:body.loot,introduce:body.introduce,suggestions:body.suggestions,told:body.told,fightRound:body.fightRound},normalized,()=>rolled[index++]??0.5);
      }
    };
    let attempted=preset?.action??null;
    try{
      const command=preset?.action?{action:preset.action}:dmCommand(hero,game,question,health,preset?null:conversationId);attempted=command?.action??attempted;
      if(command?.action){await cast(command,command.normalizedCommand??question);return;}
      if(/^confirm action[.!]?$/i.test(question)){if(!priorReply?.pending||priorReply.snapshot!==snapshot)throw Error('There is no current action to confirm.');await finish(priorReply.pending.action,{narration:'Your action is resolved below.'});return;}
      // A rule's refusal (no slot, not in a fight, already concentrating...) is shown as it is; only a cast the game could
      // not read goes to the Dungeon Master, who may work out what was meant (context.castingIssue).
      if(command?.error&&(protocol<3||(/^(?:I )?cast\s/i.test(question.trim())&&!command.soft)))throw refusal(command.error);
      const body=await request(game,health,command?.error?{castingIssue:command.error}:{});
      if(protocol>=3&&body.castCommand){const interpreted=dmCommand(hero,game,body.castCommand,health);if(!interpreted?.action||interpreted.error||interpreted.action.type!=='spell')throw Error(interpreted?.error||'The spell interpretation was invalid.');await cast(interpreted,body.castCommand,body.narration);return;}
      if(protocol>=3&&body.recruitment?.length){
        const action={type:'recruitment',plans:body.recruitment},dice=[];
        const preview=commitDmTurn(hero,game,health,action,{question,narration:body.narration,npcId:target},()=>{const value=Math.random();dice.push(value);return value;});
        if(preview.error)throw refusal(preview.error);
        // A join, a refusal or an offer was decided in the reply itself: it is told as it stands. Only a check is asked again.
        const resolved=body.retell||body.recruitment.some(p=>p?.decision==='check')?await request(preview.game,preview.health,{engineResolved:preview.events}):body;
        let index=0;await finish(action,toldReply(resolved),undefined,()=>dice[index++]??0.5);return;
      }
      if(protocol>=3&&body.check){
        const action={type:'ai-check',check:body.check},dice=[];
        const preview=commitDmTurn(hero,game,health,action,{question,narration:body.narration,worldEvent:null,npcId:target},()=>{const value=Math.random();dice.push(value);return value;});
        if(preview.error)throw refusal(preview.error);
        const resolved=await request(preview.game,preview.health,{engineResolved:engineLines(preview.game,preview.events)});
        let index=0;await finish(action,toldReply(resolved),undefined,()=>dice[index++]??0.5);return;
      }
      if(protocol>=3&&body.ruling){await finish({type:'ai-ruling',ruling:body.ruling},body);return;}
      // A place the DM revealed: added to the map, and walked to when the player set out for it.
      if(protocol>=3&&body.discovery){const {travel,...place}=body.discovery;await finish({type:'discover',place,travel},body);return;}
      // A creature the DM sprang on the player out in the wilds: the fight starts, and the player moves first.
      if(protocol>=3&&body.ambush){await finish({type:'ambush',foe:body.ambush},body);return;}
      const choice=body.actionId===null?null:[...dmChoices(hero,game,health),...mapMoves(game)].find(c=>c.id===body.actionId);if(body.actionId!==null&&!choice)throw Error('That action is no longer available.');
      if(protocol>=3&&choice){await cast({action:choice.action},undefined,body.narration,body.retell?null:body);return;}
      const result=await finish(protocol>=2?(choice?.action??null):null,protocol>=3?body:{narration:body.narration});
      if(protocol<2&&choice)setReply({narration:body.narration,pending:choice,snapshot:JSON.stringify({hero,game:result.game,health:result.health})});
    }catch(e){fail(e,{said:question,action:attempted});}
    finally{lock.current=false;if(alive.current){setBusy(false);setDraft('');}}
  }
  // At a table the draft is the table's (useSharedTable.js: the narration of whoever's turn is being resolved, this
  // player's own included, as the Dungeon Master writes it); alone it is this device's own streamed request.
  const shownDraft=table?.joined?table.draft?.text??'':busy?draft:'';
  return {direct,setDirect,openConversation,conversationId,setConversationId,animateId,playing,setPlaying,people,person,alone,setAlone,ideas,connected,checked,unpaired,status,inputRef,input,setInput,reply,busy,error,errorProblem,fingerprint,draft:shownDraft,engage,lastTurnId,waiting,tableSyncing,turnsNow,turnWait,ask};
}
