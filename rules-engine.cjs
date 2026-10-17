// The same trusted rules used in the browser, evaluated on the server. Player input is data only.
const vm=require('node:vm'),{rulesSource}=require('./rules-files.cjs');
// The rules files and their order are kept in rules-files.cjs (rulesFiles), the one list every check reads too.
let engine;
function rules(){
 if(engine)return engine;
 const source=rulesSource();
 engine=vm.runInNewContext(source+'\n;({readyHero,canTakeInHand,setShield,heroSpecies,newAdventure,adventureStep,validAdventure,isValidCharacter,adventureSnapshot,combatBasics,startParty,joinParty,partyView,settleParty,canonicalParty,turnOrderView,dmChoices,mapMoves,dmContext,dmCommand,withAttackIntent,commitDmTurn,recordedTurn,withStoryLog,withDeeds,settleTurn,routineTelling,routineFightTurn,fightTelling,memoryOf,withMemory,rememberFacts,memoryBlock,validMemory,chronicleView,closedMemory,withExperience,xpForLevel,advancedInPlace,levelCompanions,withCompanionClasses,acceptOffer,attuneItem,speakingPeople,attackTargets,conversationPeople,conversationTarget,withSceneTrigger,recruitmentTargets,storyText,isPartyGame,addJournalNote,levelUpReady,foeForLevel,buildError,makeCharacter,quickActions,attackActions,spellActions,gearedHero,weaponAttacks,advancementLevels,subclassOptions,validPlannedSubclass,spellSelectionError,appendJournal,appendStoryLog,hostileEncounterGame,hostileFoes,manageFollower,validSkillTraining,greeting,shouldGreet,upgradeAdventure,upgradeCharacter,currentSaveVersion})',{AsyncStorage:{},console},{timeout:3000});
 return engine;
}
// The same rules in a context of their own, for the Dungeon Master to check a ready journey before it is offered
// (dm-server.cjs journeyCheck, tale-library.cjs): the tale must seat a hero and make a valid adventure.
let storyEngine;
function storyChecks(){
 if(storyEngine)return storyEngine;
 const source=rulesSource();
 storyEngine=vm.runInNewContext(source+'\n;({readyHero,newAdventure,freshStoryGame,validStory,validAdventure,adventureSnapshot})',{AsyncStorage:{},console},{timeout:3000});
 return storyEngine;
}
module.exports={rules,storyChecks};
