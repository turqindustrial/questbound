// Only suggestions that can happen (the host, 2026-10-21: "the dm was giving suggestions for actions that were not
// available, it should only recommend actions that are capable of actually occurring"). A suggestion that names a move
// the scene says this hero cannot make now is dropped quietly (never a reason to ask the Dungeon Master again): a spell
// they do not know or have nothing left to cast with, a draught they do not carry, a rest the choices do not offer, a
// journey to a place the game does not know (or any journey in a fight), an attack outside a fight at nobody here, or
// words to someone who is not here (or whom the game does not know). Talk, questions and plans about anything stay.
// One pure function for both sides: the Dungeon Master's service reads it beside the reply (dm-replies.cjs, with the
// scene it sent: body.context) and the device reads it with facts from the game itself (dmTurnRules.js possibleIdeas,
// which also asks the game's own reading of the words). No imports: dm-replies.cjs loads this file as text.
// facts: {stage, npcCombat, choices:[{id,label}|"[id] label"], nearbyNPCs, party, conversationParticipants,
// npcSocialState, peopleElsewhere, story, spellReference:[{name,level,availableCosts}], inventory:{healingDraughts,
// found}, world:{knownPlaces, morePlaces, morePlacesNotListed, farLands, regions, current, region}, travelRoutes}.
const sgPeopleWords=/^(?:I|We|Well|Yes|No|Now|Then|Perhaps|Maybe|Look|Listen|Wait|Come|Quick|Quickly|Careful|Enough|Please|Fine|Right|Good|Steady|Easy|Hold|Stop|Friends|Everyone|All|Sir|Madam|Lady|Lord|Captain|Friend|Stranger|Traveller|Traveler|Hey|Oh|Ah|Hm|Hmm|So|And|But|Or|If|When|Where|Who|What|Why|How|Thank|Thanks|Sorry|Very|Aye|Nay|Let|Let's|Help|Run|Go|Back|Down|Up|Away|Together|Again|Behind|Ahead|Over|Here|There|Not|Never|Always|Just|Only|Still|Easy|Sure|Agreed|Done|Ready|Peace|Mercy|Hello|Greetings|Farewell|Goodbye)$/;
const sgFirst=name=>String(name??'').toLowerCase().replace(/^(?:the|old|young|captain|brother|sister|lady|lord|sir|dame|master|mistress|keeper|elder)\s+/,'').split(/[\s,]+/)[0];
const sgNames=list=>(Array.isArray(list)?list:[]).map(n=>typeof n==='string'?n:n?.name).filter(n=>typeof n==='string'&&n.trim());
const sgNamed=(phrase,names)=>{const p=String(phrase).toLowerCase().trim();if(!p)return false;return names.some(n=>{const low=n.toLowerCase(),first=sgFirst(n);return p===low||p.startsWith(low)||low.startsWith(p)||(first.length>=3&&(p===first||p.startsWith(first+' ')||p.split(/[\s,]+/).includes(first)));});};
const sgPlace=p=>String(p??'').replace(/\s*\(.*$/,'').trim();
export function suggestionPossible(text,facts,spellNames=[]){
 const c=facts;if(!c||typeof c!=='object')return true;
 const t=String(text??'').trim(),fight=c.stage==='combat'||c.stage==='dying'||!!c.npcCombat?.active;
 const choices=Array.isArray(c.choices)?c.choices:[],offered=new Set(choices.map(x=>typeof x==='string'?(/^\[([^\]]+)\]/.exec(x)?.[1]??''):x?.id).filter(Boolean));
 const present=[...sgNames(c.nearbyNPCs),...sgNames(c.party),...sgNames(c.conversationParticipants)];
 const known=[...present,...sgNames(c.npcSocialState),...sgNames(c.peopleElsewhere),...Object.values(c.story?.npcs??{}).map(n=>n?.name).filter(Boolean)];
 // A spell: one this hero knows, with a slot or use left (cantrips always).
 const cast=/\b[Cc]ast(?:s|ing)?\s+(?:a |an |my |the )?([A-Z][^.!?,;]*)/.exec(t);
 if(cast){
  const words=cast[1].toLowerCase(),names=[...spellNames].filter(n=>typeof n==='string').sort((a,b)=>b.length-a.length);
  const name=names.find(n=>words===n.toLowerCase()||words.startsWith(n.toLowerCase()+' '));
  if(!name)return false;
  const spell=(Array.isArray(c.spellReference)?c.spellReference:[]).find(s=>s&&typeof s.name==='string'&&s.name.toLowerCase()===name.toLowerCase());
  if(!spell)return false;
  if(Number(spell.level)>0&&Array.isArray(spell.availableCosts)&&!spell.availableCosts.length)return false;
 }
 // A draught: only one the hero carries.
 if(/\b(?:drink|drinks|quaff|swig|sip|down|uncork|give|hand|pour|share|offer)\b[^.!?]*\b(?:potion|draught|elixir|tonic)s?\b/i.test(t)&&!/\b(?:buy|sell|trade|find|look for|ask|brew|price|cost)\b/i.test(t)){
  const inv=c.inventory??{},carried=(Number(inv.healingDraughts)||0)>0||(Array.isArray(inv.found)?inv.found:[]).some(i=>i&&(i.kind==='potion'||/potion|draught|elixir/i.test(String(i.name??''))));
  if(!carried)return false;
 }
 // A rest: only when the choices offer it.
 if(/\b(?:short rest|catch (?:my|our) breath|take a breather|rest (?:a moment|a while|a bit|for an hour))\b/i.test(t)&&!offered.has('short-rest'))return false;
 if(/\b(?:long rest|make camp|bed down|sleep (?:here|now|for the night|until)|rest (?:for|through) the night|settle (?:down|in) for the night|turn in for the night|get some sleep)\b/i.test(t)&&!offered.has('long-rest'))return false;
 // A journey: never in a fight; to a named place, only one the game knows (a place, a land, a journey on offer).
 const go=/^(?:I(?:'ll| will)? |let's |we )?(?:travel|head|go|return|set out|make (?:my|our) way|journey|ride|walk|hurry|press on|leave)\b(?: back| on| out)?\s+(?:to|for|toward|towards|into)\s+(?:the\s+)?(.+?)[.!]?$/i.exec(t);
 if(go){
  if(fight)return false;
  const dest=go[1].trim();
  if(/^[A-Z]/.test(dest)){
   const w=c.world??{},places=[...sgNames(w.knownPlaces),...(Array.isArray(w.morePlaces)?w.morePlaces:[]).map(sgPlace),...(Array.isArray(w.farLands)?w.farLands:[]).flatMap(l=>[l?.name,...(Array.isArray(l?.places)?l.places.map(sgPlace):[])]),...sgNames(w.regions),...sgNames(c.travelRoutes),w.current?.name,typeof w.region==='string'?w.region:w.region?.name,...choices.map(x=>typeof x==='string'?x:x?.label)].filter(p=>typeof p==='string'&&p.trim());
   const some=(Number(w.morePlacesNotListed)||0)>0,b=dest.toLowerCase().replace(/^the\s+/,'');
   if(!some&&!places.some(p=>{const a=p.toLowerCase().replace(/^the\s+/,'');return a===b||a.includes(b)||b.startsWith(a);}))return false;
  }
 }
 // An attack: in a fight, or at someone here.
 const blow=/^(?:I(?:'ll| will)? )?(?:attack|strike|stab|slash|hit|punch|kick|shoot|charge|lunge at|swing at|cut down|kill|ambush)\b\s*(?:at\s+)?(?:the\s+)?(.*)$/i.exec(t);
 if(blow&&!fight&&!sgNamed(blow[1],present))return false;
 // Words to someone (or a deed done to them): only to someone here; a name the game does not know is nobody.
 const to=/^(?:I(?:'ll| will)? )?(?:ask|tell|talk to|speak (?:to|with)|greet|thank|warn|call (?:out )?to|wave (?:to|at)|nod (?:to|at)|hand|give|show|offer|follow|hug|embrace|join|bow to|salute|reassure|comfort|question|press|accuse|promise|beg|trust|help|heal|introduce myself to)\s+(?:the\s+)?([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)*)/.exec(t);
 const hail=/^([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+)?),\s+\S/.exec(t);
 for(const who of [to?.[1],hail&&!sgPeopleWords.test(hail[1].split(/\s+/)[0])?hail[1]:null]){
  if(!who||sgPeopleWords.test(who.split(/\s+/)[0]))continue;
  if(sgNamed(who,present))continue;
  if(known.length||present.length)return false;
 }
 return true;
}
