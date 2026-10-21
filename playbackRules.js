import {combatBasics} from './combatRules';
import {npcScene,npcLore,mentionsName} from './npcRules';
import {storyText} from './storyRules';

// More than one hero at the table: everyone reads the same feed, so what a turn says of the hero acting is told of them
// by name (fightLines.js, visibleTurn), never as "you". Alone, the second person as ever.
export const heroesAtTable=game=>!!game?.party&&typeof game.party==='object'&&!!game.party.members&&typeof game.party.lead==='string'&&Object.keys(game.party.members).length>1;
const pretty=id=>id.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
export function conversationPeople(game){
 if(game.npcCombat?.active||game.stage==='combat')return [];
 return npcScene(game).filter(n=>n.present&&n.hp>0).map(n=>({...n,name:game.story?.npcs[n.id]?.name??n.name,role:npcLore(game,n.id)?.role??''}));
}
// Who may speak in this turn's telling: the same people, and in a brawl also those fighting (they may shout, taunt,
// plead or yield; their deeds still come only from the game). Nobody chats through a fight with a creature. The Speak
// chips keep to conversationPeople, so a fight has no conversation screen.
export function speakingPeople(game){
 if(game.stage==='combat')return [];
 if(!game.npcCombat?.active)return conversationPeople(game);
 return npcScene(game).filter(n=>n.present&&n.hp>0).map(n=>({...n,name:game.story?.npcs?.[n.id]?.name??npcLore(game,n.id)?.name??n.name,role:npcLore(game,n.id)?.role??''}));
}
export function conversationTarget(game,input,current=null){
 const people=conversationPeople(game),q=input.toLowerCase();
 if(/^(?:I\s+)?(?:attack|stab|strike|slash|cast|go|move|travel|leave|goodbye|farewell|flee|surrender)\b/i.test(input.trim()))return null;
 const talking=/\b(?:talk|speak|ask|tell|say|greet|hello|hi|question|chat)\b/i.test(input);
 const named=people.find(n=>mentionsName(q,n.name)||(n.id==='keeper'&&!game.story&&/\b(?:bartender|innkeeper|keeper)\b/.test(q)));
 if(named&&(talking||mentionsName(q,named.name,true)))return named.id;
 return people.some(n=>n.id===current)?current:null;
}
export function activeEffectLines(game,health){
 const lines=[];
 if(game.concentration)lines.push(pretty(game.concentration.id)+' · Concentration · '+(game.concentration.remaining==null?game.concentration.duration:game.concentration.remaining+' rounds remaining'));
 if(health?.temp>0)lines.push(health.temp+' temporary HP'+(game.temporarySpell?' · '+pretty(game.temporarySpell.id)+' · '+game.temporarySpell.remaining+' rounds remaining':''));
 for(const [name,rounds] of Object.entries(game.enemyEffects??{}))lines.push('Target: '+name+' · '+rounds+' round'+(rounds===1?'':'s')+' remaining');
 for(const [key,label] of [['silenced','Silenced'],['handsBound','Hands bound'],['incapacitated','Incapacitated']])if(game.castingConditions?.[key])lines.push(label);
 return lines;
}
// At a shared table a player's line carries their table name and their seat (speakerSeat, opaque), so a device can
// hide the lines of someone its player muted (tableMutes.js) and a report can quote what that member typed.
// At a table of several heroes the turn says whose hero acted (by: their seat and hero's name), the player's line
// carries that hero's name too, and a person's line says whom it is said to (to: a hero's name or everyone) when the
// words do not: every member can then read the turn told of that hero by name (visibleTurn).
export function recordedTurn(hero,before,beforeHP,result,conversation,npcId=null){
 const table=heroesAtTable(before)||heroesAtTable(result.game)?(before.party??result.game.party):null,heroName=table?String(hero?.name??'').slice(0,100):'';
 const after=result.game,events=[{kind:conversation.trigger?'action':'player',text:conversation.question,...(conversation.actorName&&!conversation.trigger?{speakerName:String(conversation.actorName).slice(0,100)}:{}),...(!conversation.trigger&&typeof conversation.actorSeat==='string'&&/^seat-[a-f0-9]{16}$/.test(conversation.actorSeat)?{speakerSeat:conversation.actorSeat}:{}),...(heroName&&!conversation.trigger?{heroName}:{})}];
 const kind=text=>/initiative|turn order/i.test(text)?'initiative':/d20|\bd\d+\b|save |damage|\bHP\b/i.test(text)?'roll':'action';
 for(const text of result.events??[])if(text)events.push({kind:kind(text),text:storyText(after,text)});
 const hp=h=>h?.current??combatBasics(hero).hp;
 if(hp(beforeHP)!==hp(result.health))events.push({kind:'effect',text:hero.name+': '+hp(beforeHP)+' → '+hp(result.health)+' HP.'});
 for(const n of npcScene(after)){
  const old=npcScene(before).find(x=>x.id===n.id);
  if(old&&old.hp!==n.hp)events.push({kind:'effect',text:(after.story?.npcs[n.id]?.name??n.name)+': '+old.hp+' → '+n.hp+' HP.'});
 }
 // A creature met while exploring has its own HP line; the story's foe is untouched while it is fought.
 const foeName=g=>g.wildFight?.name??g.story?.foe??'Encounter opponent',wildStart=!before.wildFight&&!!after.wildFight,wildEnd=!!before.wildFight&&!after.wildFight;
 const foeNow=wildEnd?(after.world?.places?.find(p=>p.id===before.wildFight.place)?.threat?.hp??0):after.enemyHP;
 if(!wildStart&&before.enemyHP!==foeNow)events.push({kind:'effect',text:foeName(before.wildFight?before:after)+': '+before.enemyHP+' → '+foeNow+' HP.'});
 // The creature at the foe's side has its own HP line.
 for(const [i,a] of (after.foeAllies??before.foeAllies??[]).entries()){const was=before.foeAllies?.[i]?.hp,now=after.foeAllies?.[i]?.hp;if(was!==undefined&&now!==undefined&&was!==now)events.push({kind:'effect',text:a.name+': '+was+' → '+now+' HP.'});}
 for(let level=1;level<=9;level++){
  const used=(after.spellSlotsUsed?.[level-1]??0)-(before.spellSlotsUsed?.[level-1]??0);
  if(used>0)events.push({kind:'effect',text:'Spent '+used+' level '+level+' spell slot'+(used===1?'':'s')+'.'});
 }
 const previous=activeEffectLines(before,beforeHP),current=activeEffectLines(after,result.health);
 for(const text of current.filter(t=>!previous.includes(t)))events.push({kind:'effect',text:'Active: '+text});
 if(before.concentration?.id&&before.concentration.id!==after.concentration?.id)events.push({kind:'effect',text:pretty(before.concentration.id)+' concentration ended.'});
 for(const name of Object.keys(before.enemyEffects??{}))if(!after.enemyEffects?.[name])events.push({kind:'effect',text:'Target effect ended: '+name+'.'});
 if((beforeHP?.temp??0)>0&&!(result.health?.temp>0))events.push({kind:'effect',text:'Temporary HP depleted or expired.'});
 // Someone met in this very turn is named from the game after it.
 const speaker=id=>npcLore(after,id)?.name??npcLore(before,id)?.name??'Dungeon Master';
 if(conversation.dialogue?.length){
  // The narrator's framing stays visible alongside the spoken lines unless it merely repeats them.
  const spoken=conversation.dialogue.map(l=>l.text).join(' ');
  if(conversation.narration?.trim()&&!spoken.includes(conversation.narration.trim())&&!conversation.dialogue.some(l=>conversation.narration.includes(l.text)))events.push({kind:'narration',text:conversation.narration});
  const heroes=table?[heroName,...Object.entries(table.members??{}).filter(([id])=>id!==table.lead).map(([,m])=>heroNameOf(m.character))]:[];
  for(const line of conversation.dialogue){const to=table?addressedTo(line.text,heroes,heroName):null;events.push({kind:'dialogue',speakerId:line.speakerId,speakerName:speaker(line.speakerId),text:line.text,...(to?{to:to.slice(0,100)}:{})});}
 }
 // Replies with a dialogue list keep the narrator separate; only older replies without one speak as the addressed NPC.
 else if(npcId&&conversation.dialogue===undefined)events.push({kind:'dialogue',speakerId:npcId,speakerName:speaker(npcId),text:conversation.narration});
 else events.push({kind:'narration',text:conversation.narration});
 // A routine fight move told by the game itself (fightLines.js) is marked, with the round it fell in, so the
 // Dungeon Master is asked to tell one every few rounds of a long fight.
 const told=conversation.told==='game'?{told:'game',...(typeof conversation.fightRound==='string'&&conversation.fightRound.length<=40?{fightRound:conversation.fightRound}:{})}:{};
 const by=table&&heroName&&typeof table.lead==='string'?{by:{seat:table.lead,name:heroName}}:{};
 const turn={id:(before.playback?.at(-1)?.id??0)+1,npcId,participants:conversationPeople(after).map(n=>n.id),...told,...by,events:events.slice(0,100).map(e=>({...e,text:e.text.slice(0,2200)}))};
 return {...result,game:{...after,playback:[...(before.playback??[]),turn].slice(-12)},turn};
}

// ---------- Told of the hero by name at a table of several heroes ----------
// (the host, 2026-10-21: "make sure that when a player is being talked to or interacted with, that character is named
// instead of just saying "you" so players know who is being interacted with and who is available to respond.")
// The engine writes its lines from the acting hero's point of view ("You use Greatsword: d20 …", "The wolf attacks you:
// …"). Every member reads the same feed, so a member who did not act reads them told of that hero: the first mention by
// name, after it they/them/their, the verb made to agree ("Thalion uses Greatsword: …", "vs Thalion’s AC 16"). Words
// inside quotation marks are never touched. The acting player keeps "you".
const htSame={are:'is',were:'was',have:'has',do:'does',go:'goes',"aren't":"isn't","don't":"doesn't","haven't":"hasn't","weren't":"wasn't"};
const htKeep=new Set(['can','cannot',"can't",'could','will','would','shall','should','may','might','must','fell','took','drank','gave','got','had','made','said','saw','struck','threw','woke','rose','came','went','kept','left','lost','met','paid','sent','spent','stood','told','won','wore','ran','held','knew','led','felt','fought','brought','bought','caught','thought','slept','swung','shot','spoke','broke','chose','drew','flew','forgot','grew','tore','wrote','became','began','drove','ate','sank','was','did','found']);
const htAdverbs=new Set(['already','still','also','now','then','just','only','never','always','barely','nearly','finally','again','instead','quickly','first','both','each','alone']);
const htLinkers=/(?:^|[.!?;:—–(]\s*|\b(?:and|but|or|so|until|when|if|as|while|before|after|because|then|that|unless|though|once|where|whether|since)\s+)$/i;
// Words after which "you" is the object (a preposition, or a verb acting on the hero): "attacks you", "at you".
const htPrepositions=new Set(['at','to','on','upon','for','with','from','against','toward','towards','beside','behind','past','near','by','into','onto','over','under','around','about','of','through','across','off','without','like','than','among','beneath','within']);
const htActs=new Set(['let','help','make','see','find','found','leave','left','give','gave','take','took','carry','strike','struck','saw','tell','told','heal','knock','wake','keep','kept','bring','brought','catch','caught','put','set','pull','push','send','sent','follow','join','meet','met','thank','warn','call','ask','show','pay','grab','hold','held','hit','cut','hurt','bit','drag','spare','throw','threw']);
const htNotVerbs=new Set(['as','is','was','his','its','this','thus','perhaps','unless','always','yes','has','does','less','across','towards','afterwards','sometimes']);
const htObjectAfter=w=>{const low=String(w??'').toLowerCase();return htPrepositions.has(low)||htActs.has(low)||(/(?:s|ed)$/.test(low)&&!htNotVerbs.has(low));};
// A second verb sharing the hero as subject ("You hold your ground and end your turn") agrees too.
const htBase=new Set(['are','have','do','go','end','use','take','keep','hold','make','fall','rise','wake','drink','cast','gain','lose','regain','return','travel','arrive','reach','search','find','spend','stand','get','come','leave','pull','push','put','draw','strike','attack','roll','recover','feel','catch','breathe','shake','tear','step','move','fight','give','live','die','stabilise','stabilize','open','close','see','hear','know','learn','try','carry','follow','wait','rest','sleep','swing','throw','hurl','dodge','slip','turn','set','pick','bind','raise','lower','sling','strap','ready','settle','head','walk','ride','cross','climb','enter','flee','retreat','escape','look','watch','call','say','speak','tell','ask','hand','pour','offer','pay','buy','sell','trade','read','cut','hit','shoot','fire','loose','stab','slash','lunge','press','run','lie','drop','grab','collect','gather','share','claim','begin','finish','need','want','sense','notice']);
function htVerb(word){
 const low=word.toLowerCase(),out=htSame[low];
 if(out)return word[0]===word[0].toUpperCase()?out[0].toUpperCase()+out.slice(1):out;
 if(htKeep.has(low)||/ed$/.test(low)||!/^[a-z]+$/.test(low))return word;
 if(/(?:s|sh|ch|x|z|o)$/.test(low))return word+'es';
 if(/[^aeiou]y$/.test(low))return word.slice(0,-1)+'ies';
 return word+'s';
}
function htPlain(text,name){
 text=text.replace(/\bvs your AC\b/g,'vs '+name+'’s AC');
 let named=false,heroActs=false,out='';const re=/\b(you|your|yours|yourself|yourselves)\b/gi;let at=0,m;
 // Copy the words between: while the hero (by name) is the subject of the sentence, a second verb agrees too.
 const emit=seg=>{
  if(!heroActs){out+=seg;return;}
  const end=seg.search(/[.!?;:]/),head=end<0?seg:seg.slice(0,end);
  out+=head.replace(/\b(and|or|then)(\s+)([a-z]+)\b/g,(all,c,sp,v)=>htBase.has(v)?c+sp+htVerb(v):all)+(end<0?'':seg.slice(end));
  if(end>=0)heroActs=false;
 };
 while((m=re.exec(text))){
  const before=text.slice(0,m.index),word=m[1],low=word.toLowerCase(),cap=word[0]==='Y',start=/(?:^|[.!?]\s+)$/.test(before);
  const sayThey=t=>start||cap?t[0].toUpperCase()+t.slice(1):t;
  emit(text.slice(at,m.index));
  if(low==='your'||low==='yours'){out+=named?sayThey(low==='your'?'their':'theirs'):name+'’s';named=true;at=re.lastIndex;continue;}
  if(low==='yourself'||low==='yourselves'){out+=named?'themselves':name;named=true;at=re.lastIndex;continue;}
  // "you" starts a clause and a word follows: the subject, which takes the verb after it; after a preposition or a
  // verb acting on the hero it is the object (them).
  const rest=text.slice(re.lastIndex),next=rest.match(/^(\s+)([A-Za-z’']+)/),prev=before.match(/([A-Za-z’']+)\s*$/)?.[1];
  const butFor=/\b(?:anyone|anybody|everyone|everybody|no one|nobody|all|none|nothing|anything)\s+but\s*$/i.test(before);
  const subject=!!next&&!butFor&&(htLinkers.test(before)||(!htObjectAfter(prev)&&!/^(?:and|or|but|the|a|an)$/i.test(next[2])));
  if(subject){
   if(named){out+=sayThey('they');heroActs=false;at=re.lastIndex;continue;}
   out+=name;named=true;
   // Past an adverb or two ("You already know") to the verb; "You and Mara" stay plural.
   let tail=rest,lead='';
   for(let k=0;k<2;k++){const w=tail.match(/^(\s+)([A-Za-z’']+)/);if(!w||!htAdverbs.has(w[2].toLowerCase()))break;lead+=w[0];tail=tail.slice(w[0].length);}
   const verb=tail.match(/^(\s+)([A-Za-z’']+)/);
   if(verb&&!/^(?:and|or|nor)$/i.test(verb[2])){out+=lead+verb[1]+htVerb(verb[2]);at=re.lastIndex+lead.length+verb[0].length;heroActs=true;}
   else at=re.lastIndex;
   continue;
  }
  out+=named?'them':name;named=true;at=re.lastIndex;
 }
 emit(text.slice(at));
 return out;
}
export function heroTold(text,name){
 const who=String(name??'').trim();if(!who)return text;
 // Quoted words (anyone speaking) stay as they were said.
 return String(text).split(/(“[^”]*”|"[^"]*")/).map((part,i)=>i%2?part:htPlain(part,who)).join('');
}
// The lines the foe's turn wrote of this member's own hero by name, told back to them as "you".
export const toldToMe=(text,name)=>{const n=String(name??'').trim();if(!n)return text;const q=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return String(text).replace(new RegExp('^(.+?) attacks '+q+': ','u'),'$1 attacks you: ').replace(new RegExp('\\bvs '+q+'’s AC\\b','u'),'vs your AC').replace(new RegExp(' damage to '+q+'\\.','u'),' damage to you.');};
// Whom a person's line at a table of several heroes is said to: nobody named, so the hero acting when it says "you",
// or everyone when it speaks to the whole party. A line that names a hero already says whom.
export function addressedTo(text,heroNames,actor){
 const t=String(text??''),names=heroNames.filter(Boolean);
 if(names.some(n=>[n,n.split(/\s+/)[0]].some(p=>p.length>=3&&mentionsName(t,p))))return null;
 if(/\b(?:all of you|you all|both of you|the (?:two|three|four) of you|you (?:two|three|four)|the lot of you|every one of you|everyone|everybody|friends|travell?ers|heroes|adventurers)\b/i.test(t))return 'everyone';
 return /\b(?:you|your|yours|yourself)\b/i.test(t)?(actor||null):null;
}
const heroNameOf=character=>{try{return JSON.parse(character)?.name??null;}catch{return null;}};
export function visibleTurn(turn,game){
 // At a table of several heroes, a turn another member took is told of their hero by name; my own hero is "you".
 const mine=heroesAtTable(game)?heroNameOf(game.party.members?.[game.party.lead]?.character):null;
 const theirs=mine&&turn.by?.name&&turn.by.seat!==game.party.lead?turn.by.name:null;
 return {...turn,events:turn.events.filter(e=>e.kind!=='story').map(e=>{
  // The acting hero's own effects (a slot spent, a spell active on them, temporary hit points, concentration) say whose.
  const own=theirs&&e.kind==='effect'&&/^(?:Spent \d|Active: |Temporary HP |.+ concentration ended\.$)/.test(e.text);
  if(['roll','initiative','action','effect'].includes(e.kind)&&mine){const text=own?theirs+': '+e.text:toldToMe(theirs?heroTold(e.text,theirs):e.text,mine);return text===e.text&&!theirs?e:{...e,text,...(theirs?{toldOf:theirs}:{})};}
  if(e.kind==='player'&&e.heroName&&theirs)return {...e,toldOf:theirs};
  if(e.kind!=='dialogue')return e;
  const id=e.speakerId??turn.npcId,name=e.speakerName??game.story?.npcs?.[id]?.name??npcScene(game).find(n=>n.id===id)?.name??'Dungeon Master';
  const prefix=name+':',to=typeof e.to==='string'&&mine?(e.to==='everyone'?'all of you':e.to===mine?'you':e.to):null;
  return {...e,speakerName:name,...(to?{toLabel:to}:{}),text:e.text.toLowerCase().startsWith(prefix.toLowerCase())?e.text.slice(prefix.length).trim():e.text};
 })};
}
