const damageTypes=['Slashing','Piercing','Bludgeoning','Cold','Fire','Poison','Necrotic'];
function validFoeStats(f){
 const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 return !!f&&int(f.maximum,1,500)&&int(f.ac,5,30)&&int(f.attackBonus,-5,20)&&[4,6,8,10,12].includes(f.die)&&int(f.count,1,6)&&int(f.bonus,-5,20)&&damageTypes.includes(f.type)
  &&!!f.saves&&Object.entries(f.saves).every(([k,v])=>['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'].includes(k)&&int(v,-10,20))
  &&(f.group===undefined||(int(f.group.size,2,6)&&int(f.group.memberHP,1,200)&&f.maximum===f.group.size*f.group.memberHP&&typeof f.group.plural==='string'&&f.group.plural.length>0&&f.group.plural.length<=80));
}
export function validStory(s){
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 return !!s&&text(s.id,100)&&text(s.title,100)&&text(s.premise,800)&&text(s.opening,1000)&&text(s.objective,400)&&text(s.resolution,600)&&text(s.secret,800)&&text(s.foe,80)&&(s.foeSpecies===undefined||text(s.foeSpecies,80))&&(s.foeAppearance===undefined||text(s.foeAppearance,600))&&(s.foeStats===undefined||validFoeStats(s.foeStats))&&(s.foeDamageType===undefined||damageTypes.includes(s.foeDamageType))&&(s.openingDialogue===undefined||(Array.isArray(s.openingDialogue)&&s.openingDialogue.length>=1&&s.openingDialogue.length<=4&&s.openingDialogue.every(l=>l&&['keeper','mara'].includes(l.speakerId)&&text(l.text,300))))&&['active','complete'].includes(s.status)&&['inn','bridge','tower'].every(id=>s.locations?.[id]&&text(s.locations[id].name,80)&&text(s.locations[id].description,500))&&['keeper','mara'].every(id=>s.npcs?.[id]&&text(s.npcs[id].name,60)&&text(s.npcs[id].role,300)&&text(s.npcs[id].motive,400)&&(s.npcs[id].species===undefined||text(s.npcs[id].species,80))&&(s.npcs[id].appearance===undefined||text(s.npcs[id].appearance,600))&&(s.npcs[id].personality===undefined||text(s.npcs[id].personality,300)));
}
export function storyText(game,text){
 if(!game.story)return text;
 const s=game.story;
 if(/restored the crossing|wisp settles/.test(text))return 'The threat is defeated. Decide how to pursue your remaining objective.';
 if(/blue lantern/.test(text))return 'Resolve magical details from the current story and recorded discoveries.';
 return text.replace(/You retreat to the inn\. The bridge remains dark, but you live to try again\./g,`You retreat to ${s.locations.inn.name}. The ${s.foe} is still out there, but you live to try again.`).replace(/\bThe keeper\b|\bthe keeper\b|\bkeeper\b/g,s.npcs.keeper.name).replace(/\bMara\b/g,s.npcs.mara.name).replace(/\bLantern Wisp\b|\bthe wisp\b|\bwisp\b/gi,s.foe).replace(/Crossroads Inn|crossroads inn/gi,s.locations.inn.name).replace(/\bOld Stone Bridge\b|\bthe bridge\b|\bbridge\b/gi,s.locations.bridge.name).replace(/\bAbandoned Watchtower\b|\bthe watchtower\b|\bwatchtower\b/gi,s.locations.tower.name)
 .replace(/You collapse\. .*?This demo ends here\./g,'You fall unconscious. This encounter ends.').replace(/.*(?:restored the crossing|wisp settles|missing bridge light).*\n?/gi,'');
}
export function freshStoryGame(hero,story,base){
 if(!validStory(story))throw Error('The new story was incomplete. Your current adventure is unchanged.');
 const game={...base,story,map:{visited:['inn'],accepted:true,clue:false,peaceful:false,minutes:0},journal:{version:1,chapter:1,nextId:2,entries:[{id:1,chapter:1,kind:'quest',title:story.title,text:story.opening+'\nGoal: '+story.objective}]},log:[story.opening],worldFacts:[story.premise]};
 // Opening dialogue plays as the first turn, so the residents are already talking when the player arrives.
 if(story.openingDialogue)game.playback=[{id:1,npcId:null,participants:['keeper','mara'],events:[{kind:'narration',text:story.opening},...story.openingDialogue.map(l=>({kind:'dialogue',speakerId:l.speakerId,speakerName:story.npcs[l.speakerId].name,text:l.text}))]}];
 return game;
}
