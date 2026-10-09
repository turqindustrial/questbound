// Only earned choices are accepted; class, equipment and base abilities come from the saved hero.
// A level is taken where the hero stands (experienceRules.advancedInPlace, as App.saveAdvancement does when solo).
function advanceCharacter(snapshot,choices){
 const r=require('./rules-engine.cjs').rules(),hero=JSON.parse(snapshot.character),game=snapshot.game;
 const fail=message=>{throw Object.assign(Error(message),{status:400});};
 if(!r.levelUpReady(game,hero))fail('Finish the encounter and earn the experience for a level before advancing.');
 if(!choices||choices.level!==hero.level+1||choices.class!==hero.class)fail('Choose the next earned level for your current class.');
 const level=hero.level+1,old=hero.advancements??[],improve=r.advancementLevels(hero.class).includes(level),next=choices.advancements??[];
 if(JSON.stringify(next.slice(0,old.length))!==JSON.stringify(old)||next.length!==old.length+(improve?1:0)||(improve&&next.at(-1).level!==level))fail('Keep your earlier ability choices and select the earned improvement.');
 const subclass=hero.level>=3?hero.plannedSubclass:choices.plannedSubclass;
 if(subclass&&!Object.hasOwn(r.subclassOptions[hero.class]??{},subclass))fail('Choose a subclass for your class.');
 if(level>=3&&!subclass)fail('Choose your subclass.');
 const form={...hero,level,advancementVersion:1,advancements:next,plannedSubclass:subclass,spells:choices.spells,spellbook:choices.spellbook,arcanum:choices.arcanum};
 const problem=r.buildError(form)||r.spellSelectionError(form);if(problem)fail(problem);
 const character=r.makeCharacter(form);
 // The party world and every other hero remain intact when one hero advances.
 let advanced=r.advancedInPlace(game,hero,character);
 advanced=r.foeForLevel(advanced,character.level);
 advanced=r.levelCompanions(advanced,character.level);
 advanced.journal=r.appendJournal(advanced.journal??game.journal,'level','Level gained',character.name+' reached level '+level+'.');
 advanced.storyLog=r.appendStoryLog(game.storyLog,'level',character.name+' reached level '+level+'.');
 return r.adventureSnapshot(character,r.withDeeds(advanced,character).game,null,true);
}
module.exports={advanceCharacter};
