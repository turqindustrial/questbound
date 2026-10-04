import {npcScene,npcLore} from './npcRules';
import {speciesRegard} from './relationshipRules';
import {seededRandom,mapLocation,knownPlaceIds,travelRoute,placeName} from './mapRules';
// Turning to someone: they speak first. The Dungeon Master writes the line from who they are, what is on their mind
// and how they feel about the hero (`cue`); the line here (`fallback`) stands in when the Dungeon Master cannot be
// reached, so nobody is ever met with silence.
const greetingPools={
 grudge:['You. I have nothing to say to you.','Get away from me. I have not forgotten.','Say it and go. I will not pretend for you.'],
 hostile:['What do you want? Make it quick.','Keep your distance and say your piece.','You have some nerve, coming to me.'],
 forgiven:['I said I would let it go, and I meant it. What is it?','We are square, you and I. Mostly. What do you need?'],
 unfriendly:['Hm. You again.','I am busy. What is it?','If this is another favour, the answer is no.'],
 following:['I am with you. What is the plan?','Lead on, or tell me what you need.','Something on your mind? I am listening.'],
 bond:['There you are. I was hoping you would come by.','Anything you need, you only have to ask.','I have not forgotten what I owe you. What is it?'],
 friendly:['Good to see you. What is on your mind?','Ah, it is you. Sit, talk.','Back again? Good. What do you need?'],
 kin:['One of our own, out here? Well met.','It does me good to see a face like mine. What brings you?'],
 warm:['Welcome, traveller. What can I do for you?','Come in out of the weather. What do you need?'],
 curious:['Well now. I do not often meet your kind. What brings you here?','Forgive me for staring. You are not from here, are you?'],
 wary:['Yes? State your business.','That is close enough. What do you want?'],
 scornful:['If you must. What do you want?','Your sort is not usually welcome here. Be brief.'],
 plain:['Yes? What is it?','You wanted a word?','Something I can do for you?','Go on, then. I am listening.']
};
// Which pool fits: what they hold against the hero or owe them, then how they feel, then (for someone with no feeling
// either way) how they take to the hero's kind.
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
 return ['kin','warm','curious','wary','scornful'].includes(stance)?stance:'plain';
}
// Someone who has only just spoken (they greeted the hero on arrival, or answered a moment ago) is not made to
// greet again: the conversation simply carries on.
export function shouldGreet(game,id){
 if(['combat','dying','dead'].includes(game?.stage)||game?.npcCombat?.active||game?.pendingSpell)return false;
 const last=game?.playback?.at(-1);
 return !last||!last.events.some(e=>e.kind==='dialogue'&&(e.speakerId??last.npcId)===id);
}
export function greeting(game,id,hero){
 const name=npcLore(game,id)?.name??npcScene(game).find(n=>n.id===id)?.name??'them',mood=greetingMood(game,id,hero),pool=greetingPools[mood];
 // The same person does not say the same stand-in line twice running.
 const pick=Math.floor(seededRandom('greeting:'+id+':'+(game.playback?.at(-1)?.id??0)+':'+(game.story?.id??''))()*pool.length);
 return {mood,scene:'You turn to '+name+'.',aside:name+' looks up.',fallback:pool[pick],
  cue:'The player has walked up to '+name+' and turned to them to talk, and has not said anything yet. In narration give one short sentence of what '+name+' is doing as the player comes up. Only '+name+' speaks: one or two sentences that open the conversation in their own voice, true to their personality, to what they are doing here and what is on their mind right now (the trouble at hand, their own worry or want), and to how they feel about the player: their attitude, any grudge or bond, what they remember of the player, and how they take to the player\'s kind (regardsYourKind). Someone meeting the player for the first time says who they take them for or asks what they want; someone who knows them picks up where they left off; a companion speaks as one who shares the road. A hostile or grudging person is curt, cold or tells them to leave, but answers in words of their own; nobody greets a stranger like an old friend. Give them something of their own to say (a worry, a piece of news, a question) rather than a bare hello, do not reveal secrets they would keep, do not answer for the player, and do not repeat an opening line they have used before (conversationHistory).'};
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
  return [ideaFits('What do you know about '+foe+'?')&&foe?'What do you know about '+foe+'?':'What do you know about the trouble here?',
   leadName&&ideaFits('Have you heard anything about '+leadName+'?')?'Have you heard anything about '+leadName+'?':'What is the news around here?',
   'Is there anything you need?'];
 }
 const here=npcScene(game).filter(n=>n.present&&n.hp>0);
 if(here.length){const who=ideaName(npcLore(game,here[0].id)?.name??here[0].name),ask='I ask '+who+' what is going on here.';return ['I look around.',ideaFits(ask)?ask:'I ask what is going on here.','I search the area for anything useful.'];}
 // Nobody about: the nearest place the hero knows of is somewhere to go.
 let nearest=null;
 try{const at=mapLocation(game);for(const id of knownPlaceIds(game)){if(id===at)continue;const route=travelRoute(game,at,id);if(route&&(!nearest||route.minutes<nearest.minutes))nearest={id,minutes:route.minutes};}}catch{}
 const go=nearest?'I head toward '+plain(placeName(game,nearest.id))+'.':null;
 return ['I look around.','I search the area for anything useful.',...(go&&ideaFits(go)?[go]:[])];
}
