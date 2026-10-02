// What the player plainly asked for, read from their own words, so the Dungeon Master can be held to it.
//
// The model usually acts when asked; sometimes it answers a plain request ("I head for the lookout") with a refusal,
// an invented obstacle or a fight that ended long ago. Two things here make it dependable:
//   situation(context)  a few plain sentences of what is true right now (where the player is, whether a fight is on,
//                       what became of the foe, where they may go), put first in what the model reads;
//   secondLook(body, reply, ...)  a check of the reply against the player's words. When the reply starts no game
//                       action although the words ask for one the game offers, the model is asked once more with the
//                       point spelled out; if it still does not act and the request is unmistakable, the game acts
//                       itself (settled).
// Nothing here ever acts for a question, a plan, something said to someone, or a fight in progress.
const stop=new Set(['the','of','a','an','and','at','in','on','to','by','for','old','new','great','little','upper','lower','north','south','east','west']);
const wordsOf=name=>String(name??'').toLowerCase().split(/[^a-z0-9’']+/).map(w=>w.replace(/[’']s$/,'').replace(/[’']/g,'')).filter(w=>w.length>=3&&!stop.has(w));
const escaped=word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const hasWord=(text,word)=>new RegExp('\\b'+escaped(word)+'(?:s|es)?\\b').test(text);
const tidyInput=input=>String(input??'').toLowerCase().replace(/[’`]/g,"'").replace(/\s+/g,' ').trim();
const question=text=>/\?\s*["')]*$/.test(text)||/^(how|what|where|who|why|which|is|are|am|can|could|should|would|do|does|did|will|may)\b/.test(text);
const negated=text=>/\b(don't|do not|won't|will not|wouldn't|not going|never|instead of|rather than|refuse to|without (?:going|leaving|heading))\b/.test(text);
// Words that make a journey something said, planned or conditional rather than done now.
const hedged=text=>/\b(tell|tells|told|ask|asks|asked|say|says|said|suggest|suggests|promise|tomorrow|later|afterwards|after|before|once|when|whenever|if|unless|should|could|would|might|maybe|perhaps|plan|planning|consider|wonder|whether|thinking)\b/.test(text)||/["“”]/.test(text);
const moving=text=>/\b(go|goes|going|walk|walking|head|heading|travel|return|returning|ride|run|climb|hike|march|journey|hurry|sneak|proceed|trek|wander|stroll|jog|sprint|sail|row|swim|set (?:out|off)|make (?:my|our) way|making (?:my|our) way|leave|depart|follow|cross|enter|approach|move|get back|come back|make for|strike out|press on|venture)\b/.test(text);
const exploring=text=>/\b(north|south|east|west|northeast|northwest|southeast|southwest|northward|southward|eastward|westward|beyond|until i (?:find|reach|come)|what lies|explore|exploring|deeper|further|farther|onward|upstream|downstream|uphill|downhill|inland|horizon|somewhere new|new place|strike out|into the (?:wilds|wild|woods|forest|hills|mountains|marsh|swamp|desert|dunes|unknown|dark|depths)|follow(?:ing)? the [a-z' -]{3,40}|along the (?:shore|coast|river|road|trail|ridge|path|track|tracks|stream|cliffs?))\b/.test(text);
const compass=text=>(/\b(north|south|east|west)(?:-| )?(east|west)?(?:ward|wards)?\b/.exec(text)?.[0])??null;
const fighting=context=>['combat','dying','dead'].includes(context?.stage)||!!context?.encounter||!!context?.npcCombat?.active;
// The journeys on offer right now: each travel choice with the place it leads to.
function journeys(context){
 const names=new Map((context?.world?.knownPlaces??[]).map(p=>[p?.id,p?.name]));
 return (context?.choices??[]).filter(c=>typeof c?.id==='string'&&c.id.startsWith('travel-')).map(c=>({actionId:c.id,name:names.get(c.id.slice(7))??String(c.label??'').replace(/^Travel to /i,'')})).filter(j=>j.name);
}
// Which of those journeys the player's words name. A place is named by its whole name, or by a word no other known
// place shares ("the lookout" for Lookout Rock). `strong` means there is no doubt which place is meant.
function namedJourneys(text,context){
 const offered=journeys(context),all=[...(context?.world?.knownPlaces??[]).map(p=>p?.name),...offered.map(j=>j.name)].filter(Boolean);
 const count=word=>new Set(all.filter(name=>wordsOf(name).includes(word))).size;
 return offered.map(j=>{
  const words=wordsOf(j.name),whole=text.includes(j.name.toLowerCase()),own=words.filter(w=>count(w)===1&&hasWord(text,w));
  if(!whole&&!own.length)return null;
  return {...j,strong:whole||own.length===words.length||own.some(w=>w.length>=6)};
 }).filter(Boolean);
}
// Plain sentences of what is true now. They restate the structured fields, which the model sometimes reads past.
function situation(context){
 const c=context??{},lines=[],place=c.world?.current?.name??null,inFight=fighting(c),foe=c.story?.foe??null;
 if(place)lines.push('The player is at '+place+'.');
 if(c.stage==='dead')lines.push('The player\'s hero is dead.');
 else if(c.stage==='dying'||c.dying)lines.push('The player\'s hero is down and dying; whatever dropped them has turned away.');
 else if(inFight)lines.push('A fight is in progress'+(c.encounter?.name?' against '+c.encounter.name:c.npcCombat?.active?' with people here':'')+'.');
 else lines.push('No fight is in progress here: nothing is attacking the player, who is free to act, talk, rest where it is offered and travel.');
 if(foe){
  if(c.foeFate==='slain'||(c.enemyHP===0&&c.foeFate!=='subdued'))lines.push(foe+' is dead and no longer a threat.');
  else if(c.foeFate==='subdued')lines.push(foe+' is beaten and no longer a threat.');
  else if(!inFight&&place&&c.stage!=='bridge')lines.push(foe+' is not at '+place+' and is not attacking the player.');
 }
 const offered=journeys(c);
 if(offered.length&&!inFight)lines.push('The player may set out at once for any of: '+offered.map(j=>j.name+' ('+j.actionId+')').join(', ')+'. Nothing has to happen first.');
 return lines;
}
const started=reply=>[reply?.actionId,reply?.castCommand,reply?.check,reply?.discovery,reply?.ambush,reply?.ruling].some(v=>v!=null);
const offers=(context,id)=>(context?.choices??[]).some(c=>c?.id===id);
const phantomFight=text=>/\b(ambush|fight|encounter|battle|combat|attack|attacker)\b[^.!?]{0,70}\b(still|remains?)\b[^.!?]{0,40}\b(underway|in progress|active|unresolved|ongoing|unfinished|going on)\b|\b(?:can(?:no|')t|cannot|unable to)\s+(?:leave|abandon|walk away from|slip away from)\s+the\s+(?:fight|encounter|battle|ambush)\b|\bleaving the (?:fight|encounter|battle)\b/i.test(String(text??''));
// Simple requests a choice covers outright.
const plainChoices=[
 ['short-rest',/\b(short rest|catch (?:my|our) breath|take a breather|rest (?:a while|a little|briefly|for an hour|for a bit)|bind (?:my|our) wounds)\b/,'taking a short rest'],
 ['long-rest',/\b(long rest|rest for the night|rest until (?:morning|dawn)|sleep|bed down|turn in for the night|make camp for the night|get a night's rest)\b/,'resting for the night'],
 ['potion',/\b(drink|quaff|down|swallow|use)\b[^.!?]{0,30}\b(potion|draught)\b/,'drinking a healing draught'],
];
// A side errand (a lead) the player's words seem to settle: they name it (a word of its title) and do something that
// ends such errands (hand over, return, tell, pay, free, destroy...).
const settling=text=>/\b(give|gives|hand|hands|return|returns|put|place|deliver|bring|brought|show|present|tell|report|pay|repay|free|release|bury|destroy|burn|finish|settle|complete|here is|here's|found|kept my|as promised)\b/.test(text);
function settledLead(text,context){
 const open=(context?.quest?.openLeads??[]).filter(l=>l&&typeof l.id==='string'&&offers(context,'lead-done:'+l.id));
 if(!open.length||!settling(text))return null;
 const titles=open.map(l=>wordsOf(l.title)),count=word=>titles.filter(words=>words.includes(word)).length;
 const hits=open.filter((l,i)=>titles[i].some(w=>w.length>=4&&count(w)===1&&hasWord(text,w)));
 return hits.length===1?hits[0]:null;
}
// Is this reply what the player's words asked for? Returns null when it is (or when there is nothing to hold it to),
// else {kind, note, sure, actionId, say}: what is wrong, what to tell the model, and (sure) whether the request is so
// plain that the game may start actionId itself, with `say` as the telling.
function secondLook(body,reply,{canDiscover=false}={}){
 const context=body?.context??{},text=tidyInput(body?.input);
 if(!text||text.length>400||fighting(context)||context.engineResolved||context.sceneTrigger||context.outOfCharacter||context.pendingSpell)return null;
 const asking=question(text),plain=!asking&&!negated(text)&&!hedged(text)&&text.length<=200;
 const none=!started(reply),goes=!asking&&!negated(text)&&moving(text),named=goes?namedJourneys(text,context):[];
 if(none&&named.length===1){
  const j=named[0];
  return {kind:'known place',actionId:j.actionId,sure:plain&&j.strong,say:'You set out for '+j.name+'.',
   note:'Your last reply started no game action. The player\'s message reads as setting out for '+j.name+' now, and '+j.actionId+' is on offer and allowed (context.now says so). If they are setting out, select actionId '+j.actionId+' and narrate them leaving: no obstacle, warning or condition in the way, and nobody stopping them. Only if the message is plainly not a decision to go now (a question, a plan for later, something said to someone) answer it without the journey.'};
 }
 const wandering=goes&&!named.length&&exploring(text)&&canDiscover,toward=compass(text);
 if(wandering&&none)return {kind:'new place',sure:false,
  note:'Your last reply started no game action. The player\'s message reads as setting out for somewhere that is not a known place'+(toward?' ('+toward+')':'')+', and world.canDiscover is true. Reveal the place they come to with discovery (travel true'+(toward?', bearing '+toward:'')+') and narrate the way there and the arrival, rather than answering that nothing is there or that something must happen first. Only if the message is plainly not a decision to go now answer it without the journey.'};
 if(wandering&&typeof reply?.actionId==='string'&&reply.actionId.startsWith('travel-')){
  const sent=journeys(context).find(j=>j.actionId===reply.actionId);
  if(sent)return {kind:'wrong place',sure:false,
   note:'Your last reply sent the player to '+sent.name+', which their message does not name. They set out for somewhere not yet known'+(toward?' ('+toward+')':'')+', and world.canDiscover is true: reveal the place they come to with discovery (travel true'+(toward?', bearing '+toward:'')+') instead of a known place. Keep the travel choice only if '+sent.name+' is truly where their words lead.'};
 }
 if(none&&phantomFight(reply?.narration))return {kind:'phantom fight',sure:false,
  note:'Your last reply spoke of a fight or encounter as still going on. context.now is the truth: no fight is in progress and nothing is attacking the player. Answer the player\'s message again on that footing; if they asked for something a choice covers, select that actionId, and if they set out for somewhere new, use discovery.'};
 // A lead the player's words seem to settle: the model is asked whether this is the moment (the game never decides that itself).
 const lead=none&&!asking?settledLead(text,context):null;
 if(lead)return {kind:'lead',sure:false,
  note:'Your last reply closed nothing. The player\'s message may settle the lead "'+String(lead.title).slice(0,80)+'", and lead-done:'+lead.id+' is on offer. If this message completes it (the thing is handed over, the truth is told to the one who asked, the matter is settled for good or ill), select actionId lead-done:'+lead.id+' in this reply; the telling of the moment follows. If it only moves the errand along, answer as you did.'};
 if(none&&!asking&&!negated(text))for(const [id,pattern,what] of plainChoices)if(offers(context,id)&&pattern.test(text))return {kind:'offered choice',actionId:id,sure:plain,say:{'short-rest':'You take a short rest.','long-rest':'You settle down to rest.','potion':'You drink a healing draught.'}[id],
  note:'Your last reply started no game action. The player\'s message reads as '+what+', and '+id+' is on offer. Select actionId '+id+' unless the message is plainly not doing so now.'};
 return null;
}
// The reply the game gives itself when the model would not act on an unmistakable request: the action, a one-line telling.
function settled(fault){return {narration:fault.say,dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:fault.actionId,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,rewind:false};}
module.exports={situation,secondLook,settled,journeys,namedJourneys,fighting,started};
