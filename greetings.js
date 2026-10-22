import {npcScene,npcLore} from './npcRules';
import {speciesRegard} from './relationshipRules';
import {seededRandom,mapLocation,knownPlaceIds,travelRoute,placeName,travelError} from './mapRules';
import {heroesAtTable} from './playbackRules';
// Turning to someone: they speak first, in a line written here, with no request to the Dungeon Master (the host,
// 2026-10-22, approving it: the first request comes when the player says something). The line fits what they hold
// against the hero or owe them, how they feel, how they take to the hero's kind, whether they know the hero already,
// what they do and whether they live where the hero finds them; a short aside says what they are doing as the hero
// comes up. Nobody says a line said in the last two turns, two people here never say the same words, and someone
// does not greet the hero with a line of their own from earlier in the tale while they have others left.
// Lines may name the hero ({hero}: the first name, for those who know them); an aside's second form (after |) is
// for a table of several heroes, where the telling names the hero instead of saying "you".
const greetingPools={
 grudge:['You. I have nothing to say to you.','Get away from me. I have not forgotten.','Say it and go. I will not pretend for you.','You have a nerve, showing your face to me.','Whatever you want, the answer is no.','Stay where you are. Speak from there.','I see you, and I remember. What do you want?','Not you. Anyone but you.'],
 hostile:['What do you want? Make it quick.','Keep your distance and say your piece.','You have some nerve, coming to me.','I am not your friend. Talk, then leave.','Hands where I can see them. Now speak.','One wrong word and we are done here.','Well? Out with it.','Go and bother someone else. Or say it fast.'],
 forgiven:['I said I would let it go, and I meant it. What is it?','We are square, you and I. Mostly. What do you need?','I have not forgotten, but I have set it down. Go on.','Still getting used to this. What brings you over?','Careful with my patience, but yes, I am listening.'],
 unfriendly:['Hm. You again.','I am busy. What is it?','If this is another favour, the answer is no.','Make it short. I have work to do.','What now?','I suppose you want something.','Oh. It is you.','Talk, if you must.'],
 following:['I am with you. What is the plan?','Lead on, or tell me what you need.','Something on your mind? I am listening.','Here. What is it?','We have a moment. Talk to me.','Say the word and I am moving.','{hero}? You have that look again. What is it?','Trouble, or just a question?'],
 bond:['There you are. I was hoping you would come by.','Anything you need, you only have to ask.','I have not forgotten what I owe you. What is it?','{hero}! Come, sit. What do you need?','For you, I have all the time in the world.','Whatever it is, I will help if I can.','Good to see you safe. Tell me everything.'],
 friendly:['Good to see you. What is on your mind?','Ah, it is you. Sit, talk.','Back again? Good. What do you need?','{hero}! I hoped I would see you today.','Well met again. What news?','A friendly face at last. What can I do?','Come over here. How are you holding up?','You look like you have a question for me.'],
 again:['Something else on your mind?','Yes? Was there more?','More questions? Go on, then.','What else can I do for you?','Still here? What is it?','You again. What is it this time?','I remember you. Go on.'],
 kin:['One of our own, out here? Well met.','It does me good to see a face like mine. What brings you?','Well, well. Kin, and far from home by the look of you.','Sit with me, cousin. What do you need?'],
 warm:['Welcome, traveller. What can I do for you?','Come in out of the weather. What do you need?','Always glad of new company. What brings you?','Hello there. You look like you could use a friend.'],
 curious:['Well now. I do not often meet your kind. What brings you here?','Forgive me for staring. You are not from here, are you?','Now there is a sight. Where have you come from?','Your kind, here? There must be a story in that.'],
 wary:['Yes? State your business.','That is close enough. What do you want?','I do not know you. What is it?','Easy, now. Say what you came to say.'],
 scornful:['If you must. What do you want?','Your sort is not usually welcome here. Be brief.','Hm. I suppose I have to talk to you.','Say it quickly. People are watching.'],
 plain:['Yes? What is it?','You wanted a word?','Something I can do for you?','Go on, then. I am listening.','Can I help you?','Hello. Lost, or looking for someone?','A new face. What brings you over?','Yes? Be quick, I have a lot on.']
};
// What they do colours what they say (for anyone not set against the hero): matched on their role.
const greetingRoles=[
 [/\b(?:inn|innkeeper|tavern|alehouse|barkeep|publican|host|hostess|landlord|landlady)\b/,['Need a room, or just a drink?','Hungry? There is stew, and it is mostly hot.','Sit anywhere. What will it be?']],
 [/\b(?:smith|blacksmith|forge|armou?rer|farrier|tinker)\b/,['Something that needs mending?','Mind the sparks. What can I make you?','If it is a blade, let me see it.']],
 [/\b(?:guard|soldier|watch|watchman|sergeant|warden|sentry|militia|marshal|constable)\b/,['State your business, and keep it short.','Trouble on the road, or just passing?','Keep your weapon sheathed and we will get along.']],
 [/\b(?:priest|priestess|temple|shrine|acolyte|cleric|monk|nun|chaplain|oracle|abbot|abbess)\b/,['Peace to you. What troubles you?','You look weary. Sit a moment.','The doors are open to all. What do you seek?']],
 [/\b(?:healer|herbalist|herb-wife|apothecary|physician|surgeon|midwife|leech)\b/,['Hurt anywhere? Sit, let me look.','If you are bleeding, say so first.','Herbs, bandages or advice? I have all three.']],
 [/\b(?:merchant|trader|peddler|pedlar|shopkeeper|shop|vendor|stall|chandler|factor|seller|dealer)\b/,['Looking to buy, or to sell?','Everything here is honest work, and honestly priced.','Have a look. Ask before you touch.']],
 [/\b(?:scholar|sage|archivist|librarian|scribe|clerk|historian|chronicler|wizard|mage|alchemist|astronomer)\b/,['Mind the papers. What do you need to know?','A question? Good. Nobody asks me anything.','If this is about old things, you came to the right place.']],
 [/\b(?:farmer|herder|herdsman|shepherd|shepherdess|miller|orchard|goatherd|crofter|swineherd)\b/,['Mind where you step. What can I do for you?','Not much passes this way but weather. What brings you?']],
 [/\b(?:hunter|huntress|trapper|ranger|guide|scout|forester|woodsman|tracker|poacher)\b/,['Quiet, now. Game spooks easy. What is it?','You came a long way on foot, by the look of you.']],
 [/\b(?:fisher|fisherman|fisherwoman|fishwife|fishmonger|sailor|ferryman|ferrywoman|ferry|boatman|boat|dock|docker|mariner|bargee|bargeman|harbour|harbor)\b/,['Need passage, or just news of the water?','The tide waits for no one. What is it?']],
 [/\b(?:bard|minstrel|singer|musician|poet|storyteller|piper|player)\b/,['A new face! Have you a story for me?','Careful, or you will end up in a song.']],
 [/\b(?:cook|baker|brewer|butcher)\b/,['You have the look of someone who skipped a meal.','Mind the oven. What do you need?']],
 [/\b(?:miner|quarryman|quarry|digger|delver|prospector)\b/,['Dust everywhere, sorry. What do you need?','Watch your head. What brings you to me?']],
 [/\b(?:noble|lord|lady|reeve|mayor|elder|headman|headwoman|steward|magistrate|councillor|alderman)\b/,['You may speak. Briefly.','I have a great deal to see to. What is it?']],
 [/\b(?:thief|smuggler|fence|cutpurse|pickpocket|fixer|informant)\b/,['Keep your voice down. What do you want?','You did not see me here. Now, what is it?']],
];
// Someone who lives where the hero finds them, meeting them for the first time.
const greetingHomes=['Not many find their way to {place}. What brings you?','Welcome to {place}, such as it is.','You are new to {place}. Looking for someone?','Visitors are rare in {place}. What do you need?'];
// What they are doing as the hero comes up: by how they feel, and (for anyone not set against the hero) by their work.
const greetingAsides={
 grudge:['{name} goes very still.','{name}\'s face hardens.','{name} does not look up.','{name} stiffens.'],
 hostile:['{name} watches you come, unsmiling.|{name} watches {hero} come, unsmiling.','{name} squares up.','{name} folds both arms.'],
 forgiven:['{name} gives a guarded nod.','{name} looks up, then nods once.'],
 unfriendly:['{name} glances up without warmth.','{name} sighs.','{name} barely looks up.'],
 following:['{name} falls into step beside you.|{name} falls into step beside {hero}.','{name} looks over.','{name} leans in.'],
 bond:['{name}\'s face lights up.','{name} breaks into a smile.','{name} hurries over.'],
 friendly:['{name} smiles.','{name} raises a hand in greeting.','{name} looks up and grins.'],
 again:['{name} looks up.','{name} turns.','{name} pauses mid-task.'],
 kin:['{name} looks you over with a slow smile.|{name} looks {hero} over with a slow smile.','{name} gives a nod of recognition.'],
 warm:['{name} beckons you closer.|{name} beckons {hero} closer.','{name} smiles a welcome.'],
 curious:['{name} looks you up and down.|{name} looks {hero} up and down.','{name} stares a moment too long.'],
 wary:['{name} takes half a step back.','{name} keeps a careful distance.'],
 scornful:['{name}\'s lip curls.','{name} gives a thin, cold look.'],
 plain:['{name} looks up.','{name} turns to face you.|{name} turns to face {hero}.','{name} pauses mid-task.','{name} glances over.']
};
const greetingRoleAsides=[
 [/\b(?:inn|innkeeper|tavern|alehouse|barkeep|publican|host|hostess|landlord|landlady)\b/,['{name} sets down a half-polished cup.','{name} wipes the counter and looks up.']],
 [/\b(?:smith|blacksmith|forge|armou?rer|farrier|tinker)\b/,['{name} rests the hammer on the anvil.','{name} wipes soot from both hands.']],
 [/\b(?:guard|soldier|watch|watchman|sergeant|warden|sentry|militia|marshal|constable)\b/,['{name} straightens, a hand near the hilt.','{name} steps away from the post.']],
 [/\b(?:priest|priestess|temple|shrine|acolyte|cleric|monk|nun|chaplain|oracle|abbot|abbess)\b/,['{name} looks up from a murmured prayer.']],
 [/\b(?:healer|herbalist|herb-wife|apothecary|physician|surgeon|midwife|leech)\b/,['{name} wipes herb-stained fingers clean.']],
 [/\b(?:merchant|trader|peddler|pedlar|shopkeeper|shop|vendor|stall|chandler|factor|seller|dealer)\b/,['{name} looks up from a tally of coins.']],
 [/\b(?:scholar|sage|archivist|librarian|scribe|clerk|historian|chronicler|wizard|mage|alchemist|astronomer)\b/,['{name} marks the page and looks up.']],
 [/\b(?:farmer|herder|herdsman|shepherd|shepherdess|miller|orchard|goatherd|crofter|swineherd)\b/,['{name} straightens, rubbing a stiff back.']],
 [/\b(?:hunter|huntress|trapper|ranger|guide|scout|forester|woodsman|tracker|poacher)\b/,['{name} looks up from mending a snare.']],
 [/\b(?:fisher|fisherman|fisherwoman|fishwife|fishmonger|sailor|ferryman|ferrywoman|ferry|boatman|boat|dock|docker|mariner|bargee|bargeman|harbour|harbor)\b/,['{name} lets a coil of rope drop.']],
 [/\b(?:bard|minstrel|singer|musician|poet|storyteller|piper|player)\b/,['{name} breaks off a tune.']],
 [/\b(?:cook|baker|brewer|butcher)\b/,['{name} dusts flour from both hands.']],
 [/\b(?:miner|quarryman|quarry|digger|delver|prospector)\b/,['{name} sets down a pick.']],
 [/\b(?:noble|lord|lady|reeve|mayor|elder|headman|headwoman|steward|magistrate|councillor|alderman)\b/,['{name} looks up from a sheaf of papers.']],
 [/\b(?:thief|smuggler|fence|cutpurse|pickpocket|fixer|informant)\b/,['{name} glances about before answering.']],
];
// Moods in which what someone does or where they live may colour the greeting (not for anyone set against the hero).
const openMoods=['plain','again','warm','curious','kin','friendly','bond','following'];
// Which pool fits: what they hold against the hero or owe them, then how they feel, then (for someone with no feeling
// either way) how they take to the hero's kind, then whether they have spoken with the hero before.
function greetingMood(game,id,hero){
 const n=npcScene(game).find(x=>x.id===id);if(!n)return 'plain';
 if(n.grudge)return 'grudge';
 if(n.attitude==='hostile')return 'hostile';
 // A grudge set down: civil, but the past is not forgotten.
 if(n.forgave&&['unfriendly','indifferent'].includes(n.attitude)&&game.followers?.[id]?.status!=='following')return 'forgiven';
 if(n.attitude==='unfriendly')return 'unfriendly';
 if(game.followers?.[id]?.status==='following')return 'following';
 if(n.bond||n.attitude==='devoted')return 'bond';
 if(n.attitude==='friendly')return 'friendly';
 const stance=speciesRegard(game,id,hero)?.stance;
 if(['kin','warm','curious','wary','scornful'].includes(stance))return stance;
 return spokeBefore(game,id)?'again':'plain';
}
// Whether someone has already talked with the hero (a line of theirs in the feed, or a memory of the hero).
function spokeBefore(game,id){
 if((game?.npcMemory?.[id]?.memories??[]).length)return true;
 return (game?.playback??[]).some(t=>(t.events??[]).some(e=>e.kind==='dialogue'&&(e.speakerId??t.npcId)===id));
}
// Someone who has only just spoken (they greeted the hero on arrival, or answered a moment ago) is not made to
// greet again: the conversation simply carries on.
export function shouldGreet(game,id){
 if(['combat','dying','dead'].includes(game?.stage)||game?.npcCombat?.active||game?.pendingSpell)return false;
 const last=game?.playback?.at(-1);
 return !last||!last.events.some(e=>e.kind==='dialogue'&&(e.speakerId??last.npcId)===id);
}
// The hero as people here call them: the first name, unless another hero at the table shares it.
function greetHeroName(hero,game){
 const whole=String(hero?.name??'').trim()||'friend',first=whole.split(/\s+/)[0];
 const others=Object.entries(game?.party?.members??{}).filter(([id])=>id!==game?.party?.lead).map(([,m])=>{try{return String(JSON.parse(m.character)?.name??'');}catch{return '';}});
 return first.length>=2&&!others.some(n=>n.split(/\s+/)[0].toLowerCase()===first.toLowerCase())?first:whole;
}
const greetPlace=name=>String(name??'').trim().replace(/^The /,'the ')||'this place';
const greetForm=(line,party)=>{const at=line.indexOf('|');return at<0?line:party?line.slice(at+1):line.slice(0,at);};
// Every line this person said in the feed (the latest 40 turns), so they do not greet with the same words again.
const ownLines=(game,id)=>new Set((game?.playback??[]).slice(-40).flatMap(t=>(t.events??[]).filter(e=>e.kind==='dialogue'&&(e.speakerId??t.npcId)===id).map(e=>e.text)));
// A line for someone, skipping any line in `avoid` (said in the last two turns, or another person here will say it),
// then their own earlier greetings while others are left; when every line of their own kind is taken, a plain one.
function poolLine(game,id,hero,avoid){
 const mood=greetingMood(game,id,hero),lore=npcLore(game,id),role=String(lore?.role??'').toLowerCase();
 const random=seededRandom('greeting:'+id+':'+(game.playback?.at(-1)?.id??0)+':'+(game.story?.id??''));
 const shuffle=list=>list.map(s=>({s,r:random()})).sort((a,b)=>a.r-b.r).map(x=>x.s);
 const open=openMoods.includes(mood),here=mapLocation(game),home=game.people?.[id]?.home===here&&mood!=='again'&&mood!=='following';
 const extra=open?[...greetingRoles.filter(([re])=>re.test(role)).flatMap(([,lines])=>lines),...(home?greetingHomes.map(l=>l.replace('{place}',greetPlace(placeName(game,here)))):[])]:[];
 const first=random()<0.45?[...shuffle(extra),...shuffle(greetingPools[mood])]:[...shuffle(greetingPools[mood]),...shuffle(extra)];
 const name=greetHeroName(hero,game),fill=line=>line.replace(/\{hero\}/g,name),own=ownLines(game,id);
 const lines=first.map(fill);
 const line=lines.find(l=>!avoid.has(l)&&!own.has(l))??lines.find(l=>!avoid.has(l))??greetingPools.plain.find(l=>!avoid.has(l))??lines[0];
 return {mood,line};
}
// Everyone here gets a different line, and none repeats what was said in the last two turns: two people greeting in
// the same scene never say the same words (people in the order the scene lists them).
export function standInGreetings(game,hero){
 const said=new Set((game?.playback??[]).slice(-2).flatMap(t=>t.events.filter(e=>e.kind==='dialogue').map(e=>e.text))),lines={};
 for(const n of npcScene(game).filter(x=>x.present)){const p=poolLine(game,n.id,hero,said);lines[n.id]=p;said.add(p.line);}
 return lines;
}
// What they are doing as the hero comes up (a different aside from the one they last had, where there is one).
function greetingAside(game,id,hero,mood){
 const name=npcLore(game,id)?.name??npcScene(game).find(n=>n.id===id)?.name??'Someone',role=String(npcLore(game,id)?.role??'').toLowerCase(),party=heroesAtTable(game);
 const random=seededRandom('aside:'+id+':'+(game.playback?.at(-1)?.id??0)+':'+(game.story?.id??''));
 const work=openMoods.includes(mood)?greetingRoleAsides.filter(([re])=>re.test(role)).flatMap(([,lines])=>lines):[];
 const pool=work.length&&random()<0.6?[...work,...greetingAsides[mood]]:greetingAsides[mood]??greetingAsides.plain;
 const told=new Set((game?.playback??[]).slice(-40).flatMap(t=>(t.events??[]).filter(e=>e.kind==='narration').map(e=>e.text)));
 const lines=pool.map(l=>greetForm(l,party).replace(/\{name\}/g,name).replace(/\{hero\}/g,greetHeroName(hero,game)));
 const start=Math.floor(random()*lines.length);
 for(let i=0;i<lines.length;i++){const l=lines[(start+i)%lines.length];if(!told.has(l))return l;}
 return lines[start];
}
// The greeting itself: the move shown in the feed (no words put in the player's mouth), what they are doing, and
// their opening line.
export function greeting(game,id,hero){
 const name=npcLore(game,id)?.name??npcScene(game).find(n=>n.id===id)?.name??'them';
 // The same person does not say the same line twice running, and nobody says another's line.
 const said=new Set((game?.playback??[]).slice(-2).flatMap(t=>t.events.filter(e=>e.kind==='dialogue').map(e=>e.text)));
 const {mood,line}=standInGreetings(game,hero)[id]??poolLine(game,id,hero,said);
 // Someone the hero has never talked with, and not set against them, shows what they are after (greetingAgenda).
 const aside=greetingAside(game,id,hero,mood),agenda=openMoods.includes(mood)&&mood!=='following'&&!spokeBefore(game,id)?greetingAgenda(game,id):'';
 return {mood,scene:'You turn to '+name+'.',aside:agenda?aside+' '+agenda:aside,line};
}
// What someone met for the first time is after, in the aside (the stories spec, Phase A8, 2026-10-22: the game's written
// greeting took the place of the Dungeon Master's, which was where a person's agenda used to surface), so the Dungeon
// Master's first reply, which reads the feed, carries it on. Only a public want: something they would say or show to a
// stranger, never a secret (the project review and the deployment check, 2026-10-22: hooks and motives are written for
// the Dungeon Master, and "Calven is plainly hoping to … without drawing attention to himself" gave away a hidden prince,
// "Milly was paid to keep quiet about a cellar" and "a crime from his youth" others). Safe by design:
// - Told from a want (the motive), never from a hook: a library person's hook is by nature their secret thread ("cannot
//   report it without exposing…"), and its words cannot show which hook is public (on the host's library, 7 of the 18
//   hooks with none of the words below still held a secret: a predator fed under the ferry, a bell wagered away, a grave
//   marker moved, a lord's forged will).
// - Whose want: keeper's or mara's motive, or the library's own motive of someone met from the people library (who
//   carries its hook too); never a resident's (the story writer's residents carry the tale's secrets in their motives).
// - Nothing at all when the whole motive (not just the part said) touches secrecy, crime, deception, a hidden past or
//   name, love kept from others, blackmail, bribes, theft, betrayal, debts and what is owed or borrowed, what someone
//   saw, knows or must not learn, shame, blame, amends, curses, pacts and dreams, fear, or the hero, the party,
//   outsiders and strangers (`agendaHush`). No agenda is better than a risky one, so the hush is wide on purpose.
// - Only the want's first clause is said (cut before "even if", "without", "before", "while", "though" and the like),
//   by name in a frame ("Oona is hoping to …"); never "you". verify-agendas.cjs runs it over the host's people library.
const motiveNotVerb=/^(?:a|an|the|his|her|their|its|my|our|your|they|he|she|it|i|we|someone|something|nothing|no|not|to|for|wants?|needs?|is|was|has|had|being|only|just|very|more|most)\b/i;
const agendaHushWords=[
 // secrecy, hiding and keeping quiet
 'secret\\w*','hid','hid(?:e|es|den|ing)','hideout\\w*','conceal\\w*','disguis\\w*','cover(?:s|ed|ing)?','covert\\w*','private\\w*','quietly',
 '(?:keep|keeps|kept|keeping|stay|stays|stayed|staying) (?:it |this |that |\\w+ )?quiet','quiet about','hush\\w*','suppress\\w*',
 'silen(?:ce|ced|ces|cing|t) (?:about|on|him|her|them)','say nothing','says nothing','said nothing','tell no one','tells no one',
 'anonym\\w*','nameless','unnamed','a certain','unseen','undiscover\\w*','unnoticed','undetected','buri(?:ed|es)','bury\\w*','sealed',
 'locked away','alone','unaware','privy',
 // what someone saw, knows, or must not learn
 'knows?','knew','known','remembers?','suspect\\w*','recogni[sz]\\w*','witness\\w*','overh(?:ear|eard|ears)','eavesdrop\\w*',
 'what (?:he|she|they|it) (?:saw|did|does|witnessed|heard|found|took|was|were|is|are)','who (?:he|she|they) (?:was|were|is|are|used to be|really)',
 '(?:anyone|anybody|nobody|no one|someone|everyone|people|others|family|kin|kinsfolk|relatives?|crew|camp|town|village|neighbou?rs?|owner|rival|patron|lord|officials?|creditors?|customers?|apprentice|master|parents?|husband|wife|brother|sister|sibling)\\s+(?:\\w+\\s+)?(?:learn\\w*|discover\\w*|notic\\w*|find(?:s|ing)? out|found out|realis\\w*|realiz\\w*|knows?|suspect\\w*|asks?|sees?|hears?|catch\\w*|expects?)',
 '(?:before|without|until|unless|lest|so that|in case)\\b[^,;.]*?\\b(?:learn\\w*|discover\\w*|notic\\w*|find(?:s|ing)? out|found out|realis\\w*|realiz\\w*|reveal\\w*|expos\\w*|admit\\w*|explain\\w*|mention\\w*|discuss\\w*|guess\\w*|asking|questions?|recall\\w*|connect\\w*|trace\\w*|tracks? (?:him|her|them)|find (?:him|her|them))',
 'from\\s+(?:learning|knowing|finding|discovering|seeing|hearing)','nobody (?:knows|asks)','no one (?:knows|asks)','reveal\\w*','expos\\w*','uncover\\w*',
 'unmask\\w*','admit\\w*','confess\\w*','explain\\w*','mention\\w*','discuss\\w*','involv\\w*','implicat\\w*','attention','gossip\\w*','rumou?r\\w*',
 'scandal\\w*','talk of the',
 // deception, a false face, a hidden name, origin or past
 'lie','lies','lied','lying','liar\\w*','pretend\\w*','preten[cs]e\\w*','false\\w*','fake\\w*','forg(?:e|ed|er|ers|ery|eries|ing)','counterfeit\\w*',
 'fraud\\w*','deceiv\\w*','decept\\w*','trick\\w*','cheat\\w*','swindl\\w*','impersonat\\w*','mislead\\w*','misled','feign\\w*','posing','poses? as',
 'guise','masquerad\\w*','alias\\w*','insist\\w*','swear\\w*','swore','sworn','den(?:y|ies|ied|ial)','identit\\w*',
 '(?:true|real|old|other|another|assumed|false|new|chosen|birth|family|fresh|clean) name','names?\\s+(?:he|she|they)\\s+(?:left|chose|abandoned|used|bore|gave up)',
 'under (?:a|an|another|his|her|their|the) (?:\\w+ )?name','(?:clear|restore|redeem) (?:his|her|their|my) (?:own |good )?name',
 'remov\\w* (?:a |the |his |her |their )?name','eras(?:e|ed|es|ing|ure)','former\\w*','old life','new life','(?:his|her|their) (?:own )?past','the past',
 'past life','fresh start','clean (?:start|slate)','start (?:anew|over)','birthright','foundling\\w*','parentage','origins?','bastard\\w*','baby','babe',
 'infant','left with (?:her|him|them)','prince\\w*','royal\\w*','throne','crown','title','claim\\w*','reclaim\\w*','abandon\\w*','renounc\\w*','disown\\w*','exile\\w*',
 'banish\\w*','cast (?:her|him|them) out','cast out','reputation','disgrac\\w*','dishonou?r\\w*','shame\\w*','ashamed','infam\\w*','notorious',
 'dismiss\\w*','stripped of','read','reading','illitera\\w*','letters','unlettered','to disappear','to vanish','lie low','lying low','go to ground',
 // crime, wrongdoing and blame
 'crim(?:e|es|inal\\w*)','steal\\w*','stole','stolen','theft\\w*','thie(?:f|ves|ving)','thief\\w*','rob','robs','robbed','robbing','robber\\w*',
 'burgl\\w*','loot\\w*','pilfer\\w*','embezzl\\w*','smuggl\\w*','contraband','poach\\w*','brib\\w*','paid to','(?:was|were|been|is|are) paid',
 'hush money','bought','blackmail\\w*','extort\\w*','ransom\\w*','murder\\w*','kill\\w*','slay\\w*','slew','slain','assassin\\w*','poison\\w*',
 'arson\\w*','fugitive\\w*','outlaw\\w*','the law','lawm[ae]n','wanted','bount(?:y|ies)','jail\\w*','gaol\\w*','prison\\w*','captur\\w*','escap\\w*',
 'fled','flee\\w*','runaway\\w*','gang\\w*','accomplice\\w*','illicit','illegal\\w*','unlawful\\w*','forbidden','taboo','grave[- ]?robb\\w*',
 'sabotag\\w*','tamper\\w*','disturbed','framed','frame','guilt\\w*','culprit\\w*','accus\\w*','blam\\w*','prove\\b[^.;]*\\bnever','wrong(?:ed|s|doing)?',
 'misdeed\\w*','mistake\\w*','harm(?:ed|s|ing|ful)?','youthful','fail(?:ed|ure|ures)','intimidat\\w*','sin','sins','sinned','crooked','black market',
 // betrayal and spying
 'betray\\w*','traitor\\w*','treach\\w*','turncoat\\w*','informant\\w*','informer\\w*','inform on','spy','spies','spied','spying',
 'double[- ]cross\\w*','sold out','sell(?:s|ing)? out','agents?','broke(?:n)? (?:\\w+ )?(?:oath|oaths|vow|vows|promise|promises|word|faith)',
 'lur(?:e|ed|es|ing)','ambush\\w*','entrap\\w*','set up','trap(?:s|ped|ping)? (?:him|her|them)',
 // love kept from others
 'lov(?:e|es|ed|er|ers|ing)','beloved','sweetheart\\w*','affair\\w*','tryst\\w*','romanc\\w*','elop\\w*','paramour\\w*','mistress\\w*',
 'engag(?:ed|ement\\w*)','betroth\\w*','courting','courtship','suitor\\w*','jilt\\w*',
 // debts, bargains and what is owed or borrowed
 'debt\\w*','creditor\\w*','lender\\w*','loan\\w*','owe','owes','owed','owing','pay(?:s|ing)? off','paid off','repay\\w*','obligation\\w*',
 'borrow\\w*','lent','lend\\w*','collateral','pawn\\w*','wager\\w*','gambl\\w*','bargain\\w*','pact\\w*','patron\\w*','favou?rs?','bound','binding','indebted',
 'collect(?:s|ed|ing)? (?:on|the|a|what)',
 // amends, regret, trust lost and fear
 'amends','aton\\w*','repent\\w*','redeem\\w*','redemption','forgiv\\w*','regret\\w*','remorse\\w*','penance','trust','confid(?:e|ed|ence|ences)',
 'fear\\w*','afraid','dread\\w*','haunt\\w*','again',
 // curses, pacts, dreams and dangerous gifts
 'curse\\w*','dream\\w*','nightmare\\w*','dragon\\w*','demon\\w*','fiend\\w*','devil\\w*','presence','magic\\w*','power','powers','spell\\w*',
 'possess\\w*','inherit\\w*',
 // one creature kept or fed (a hungry marsh creature, the thing below), never the wild creatures of a place
 '(?:a|an|the|their|his|her|its) (?:\\w+ ){0,2}(?:creature|beast|predator|monster|thing)',
 // avoidance and pursuit
 'avoid\\w*','evad\\w*','dodg\\w*','outrun\\w*','stay(?:s|ing)? ahead','keep(?:s|ing)? ahead','pursu\\w*','hunted','hunting (?:him|her|them)',
 'catch(?:es|ing)? up','caught','track(?:s|ed|ing)? (?:him|her|them)','follow(?:s|ed|ing)? (?:him|her|them)',
 // the hero and their party, outsiders and strangers (a hook's "a stranger must…" means the hero)
 'hero','heroes','adventurers?','party','parties','outsiders?','strangers?',
];
const agendaHush=new RegExp('\\b(?:'+agendaHushWords.join('|')+')\\b','i');
const agendaCut=/;|:|\.\s|,\s+(?:and|but|so|yet|or|while|though|whatever|no matter|even|despite|before|until|unless|without)\b|\s+(?:even if|even though|without|though|although|unless|before|until|while|whatever|no matter|despite|so that|and then|but|yet)\s/i;
// A sentence of the aside starts with a capital ("the keeper" is a name in the old crossroads tale).
const agendaSentence=t=>t?t[0].toUpperCase()+t.slice(1):t;
// Whose motive may be told: keeper's or mara's, or the library's own of someone met from the people library (who carries
// its hook beside it); never a resident's, which is the story writer's, nor anyone the Dungeon Master made up.
function agendaMotive(game,id,lore){
 if(id==='keeper'||id==='mara')return String(lore?.motive??'');
 const p=game?.people?.[id];
 return p&&!p.resident&&p.pool&&p.hook?String(lore?.motive??''):'';
}
export function greetingAgenda(game,id){
 const lore=npcLore(game,id),whole=String(lore?.name??'').trim();if(!whole)return '';
 const motive=agendaMotive(game,id,lore).replace(/\s+/g,' ').trim().replace(/[.!]+$/,'');
 if(!motive||/[?;:"“”]/.test(motive)||agendaHush.test(motive))return '';
 // "They want to …", "Wants to …", "To …", "Find her brother.": the first clause, as "to …".
 const plain=motive.split(agendaCut)[0].trim().replace(/[,.!]+$/,'');
 const wants=/^(?:(?:they|he|she|[A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)?)\s+)?(?:wants?|hopes?|needs?|means|longs?|aims?|plans?|intends?|wish(?:es)?|seeks?|(?:is|are) (?:hoping|trying|determined|eager))\s+(to\s+.+)$/i.exec(plain);
 const bare=/^to\s+\S+\s+\S/i.test(plain)?plain[0].toLowerCase()+plain.slice(1):'';
 const aim=wants?wants[1]:bare||(/^[A-Za-z]+\s+\S+\s+\S/.test(plain)&&!motiveNotVerb.test(plain)&&!/^[A-Z][a-z]+\s+[A-Z]/.test(plain)?'to '+plain[0].toLowerCase()+plain.slice(1):'');
 if(!aim||aim.length<12||aim.length>150||/\byou\b/i.test(aim)||agendaHush.test(aim))return '';
 const called=ideaName(whole),random=seededRandom('agenda:'+id+':'+(game?.story?.id??''));
 return agendaSentence(called+(random()<0.5?' is hoping ':' looks to be hoping ')+aim+'.');
}
// ---------- Greetings at moments the game notices (sceneTriggers.js) ----------
// Coming back to the tale's starting place, and the morning after a long rest: the people there speak first in a line
// written here, with no request (the cue is `written`). Other moments (waking from near death, a fight lost or won,
// the first arrival somewhere) are still told by the Dungeon Master.
const cueGreetingPools={
 'return-inn':{
  warm:['You are back! Sit down and tell me everything.','There you are. We were starting to worry.','Back in one piece. Good. What did you find?','Welcome back. The fire is still going.'],
  plain:['You are back. What did you find out there?','Back already? Any news from the road?','So you made it back. What is the word?','There you are. Was it as bad as they say?'],
  cold:['Back again. I suppose you want something.','Oh. You came back.','Hm. Still alive, then.']},
 rest:{
  warm:['Morning. You slept like a stone.','Good morning! There is bread, if you want it.','Up already? Ready for another day of it?','Morning. You look better for the sleep.'],
  plain:['Morning. Sleep well?','You are up. The day is wasting.','Morning. Did the floor treat you kindly?','Awake at last. What is the plan today?'],
  cold:['Morning. Do not expect breakfast.','You are still here, then.','Up, are you? Good. Do not dawdle.']},
};
const cueAsides={'return-inn':['{name} looks up as you come in.','{name} spots you at the door.','{name} turns at the sound of the door.'],rest:['{name} is already up.','{name} nods a good morning.','{name} looks over, half awake.']};
export const writtenCues=Object.keys(cueGreetingPools);
// The line and aside for a written cue (null for a cue the Dungeon Master tells), seeded and never one said lately.
export function cueGreeting(game,id,kind){
 const pools=cueGreetingPools[kind];if(!pools)return null;
 const n=npcScene(game).find(x=>x.id===id),cold=!!n?.grudge||['hostile','unfriendly'].includes(n?.attitude),warm=!cold&&(game.followers?.[id]?.status==='following'||!!n?.bond||['friendly','devoted'].includes(n?.attitude));
 const pool=pools[cold?'cold':warm?'warm':'plain'],name=npcLore(game,id)?.name??n?.name??'Someone';
 const random=seededRandom('cue:'+kind+':'+id+':'+(game.playback?.at(-1)?.id??0)+':'+(game.story?.id??''));
 const said=new Set((game?.playback??[]).slice(-40).flatMap(t=>(t.events??[]).map(e=>e.text)));
 const pick=list=>{const start=Math.floor(random()*list.length);for(let i=0;i<list.length;i++){const l=list[(start+i)%list.length];if(!said.has(l))return l;}return list[start];};
 return {line:pick(pool),aside:pick(cueAsides[kind].map(a=>a.replace('{name}',name)))};
}

// ---------- Things the player might say next ----------
// The Suggestions tab offers two or three short replies in the player's own voice. The Dungeon Master writes them with
// each turn (the reply's suggestions); these stand in when it has not (a turn from another player at the table, a
// reload, the Dungeon Master out of reach). Never in a fight, while dying or dead, or while a spell waits on a ruling.
const ideaPools={
 grudge:['I know what I did. I am not asking you to forget it.','Tell me what it would take to set this right.','Then I will leave you be.','I will not make excuses. What do you need from me?'],
 cold:['I did not come to fight. Hear me out.','What would it take for you to trust me?','Is there someone else here who will talk to me?','Fair enough. I will keep my distance.'],
 forgiven:['Thank you for letting it go. I will not waste it.','Is there anything I can do to keep the peace between us?','I am glad we can talk again.'],
 following:['What do you make of all this?','How are you holding up?','Stay close. We move soon.','Is there anything you need before we go on?'],
};
const ideaTitles=/^(?:captain|lady|lord|sir|dame|master|mistress|old|elder|brother|sister|father|mother|doctor|healer|aunt|uncle|young)$/i;
// What the hero would call someone: a first name without the title ("Oona" for Captain Oona Brask), or "the keeper".
function ideaName(name){
 const words=String(name??'').trim().split(/\s+/).filter(Boolean);
 if(/^the$/i.test(words[0]??''))return ['the',...words.slice(1)].join(' ');
 return words.filter((w,i)=>!(i<words.length-1&&ideaTitles.test(w)))[0]??'them';
}
const ideaPick=(lines,seed)=>{const random=seededRandom(seed),pool=[...lines],out=[];while(pool.length&&out.length<3)out.push(pool.splice(Math.floor(random()*pool.length),1)[0]);return out;};
const ideaFits=t=>typeof t==='string'&&t.length>=8&&t.length<=110;
export function replyIdeas(game,hero,personId=null){
 if(!game||['combat','dying','dead'].includes(game.stage)||game.npcCombat?.active||game.wildFight||game.pendingSpell)return [];
 const seed='ideas:'+(game.playback?.at(-1)?.id??0)+':'+(personId??'')+':'+(game.story?.id??'');
 const plain=t=>String(t).replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"');
 if(personId){
  const mood=greetingMood(game,personId,hero);
  if(mood==='grudge')return ideaPick(ideaPools.grudge,seed);
  if(['hostile','unfriendly','wary','scornful'].includes(mood))return ideaPick(ideaPools.cold,seed);
  if(mood==='forgiven'||mood==='following')return ideaPick(ideaPools[mood],seed);
  const foe=game.story?.foe,lead=(game.story?.leads??[]).find(l=>l&&!l.done);
  const leadName=lead?plain(lead.title).replace(/^(The|A|An) /,w=>w.toLowerCase()):null;
  // Things to ask this person in particular: about the trouble, what they do here, who they are, so two people
  // turned to one after the other are not asked the same three things.
  const lore=npcLore(game,personId),role=String(lore?.role??'').toLowerCase(),home=game.people?.[personId]?.home,place=plain(placeName(game,mapLocation(game))),own=[
   /\b(?:trader|merchant|smith|peddler|seller|stall|shop|cook|baker|brewer|innkeeper|tavern)/.test(role)?'What do you have to sell?':null,
   /\b(?:guard|captain|soldier|sergeant|watch|warden|sentry)/.test(role)?'Have you seen anything strange on your watch?':null,
   /\b(?:priest|priestess|temple|shrine|abbess|abbot|monk|nun|cleric|healer)/.test(role)?'What do the faithful make of all this?':null,
   /\b(?:guide|hunter|scout|ferry|boat|bargee|tracker|ranger|carter)/.test(role)?'Could you show me the way?':null,
   home===mapLocation(game)?'How long have you lived in '+place+'?':'What brings you to '+place+'?',
   'Who else should I talk to around here?','What is your part in all this?'].filter(t=>t&&ideaFits(t));
  const trouble=ideaFits('What do you know about '+foe+'?')&&foe?'What do you know about '+foe+'?':'What do you know about the trouble here?';
  const rumour=leadName&&ideaFits('Have you heard anything about '+leadName+'?')?'Have you heard anything about '+leadName+'?':'What is the news around here?';
  return [trouble,...ideaPick([rumour,'Is there anything you need?',...own],seed+':own:'+personId).slice(0,2)];
 }
 const here=npcScene(game).filter(n=>n.present&&n.hp>0);
 // Several people here: a different thing to say to two of them, so nobody is offered one line for everyone.
 if(here.length>1){const [a,b]=ideaPick(here.map(n=>n.id),seed+':who').map(id=>ideaName(npcLore(game,id)?.name??here.find(n=>n.id===id).name)),foe=game.story?.foe,askA='I ask '+a+' what is going on here.',askB=foe&&ideaFits('I ask '+b+' what they know about '+foe+'.')?'I ask '+b+' what they know about '+foe+'.':'I ask '+b+' who else I should talk to.';return [ideaFits(askA)?askA:'I ask what is going on here.',ideaFits(askB)?askB:'I ask around.','I look around.'];}
 if(here.length){const who=ideaName(npcLore(game,here[0].id)?.name??here[0].name),ask='I ask '+who+' what is going on here.';return ['I look around.',ideaFits(ask)?ask:'I ask what is going on here.','I search the area for anything useful.'];}
 // Nobody about: the nearest place the hero knows of is somewhere to go (only one the map lets them go to now).
 let nearest=null;
 try{const at=mapLocation(game);for(const id of knownPlaceIds(game)){if(id===at||travelError(game,id))continue;const route=travelRoute(game,at,id);if(route&&(!nearest||route.minutes<nearest.minutes))nearest={id,minutes:route.minutes};}}catch{}
 const go=nearest?'I head toward '+plain(placeName(game,nearest.id))+'.':null;
 return ['I look around.','I search the area for anything useful.',...(go&&ideaFits(go)?[go]:[])];
}
