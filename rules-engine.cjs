// The same trusted rules used in the browser, evaluated on the server. Player input is data only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','playbackRules.js','sceneTriggers.js'];
let engine;
function rules(){
 if(engine)return engine;
 const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
 const source='const catalog='+read('spellCatalog.json')+';const progression='+read('spellProgression.json')+';\n'+files.map(f=>read(f).replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
 engine=vm.runInNewContext(source+'\n;({readyHero,newAdventure,adventureStep,validAdventure,isValidCharacter,adventureSnapshot,combatBasics,startParty,joinParty,partyView,settleParty,canonicalParty,turnOrderView,dmChoices,dmContext,dmCommand,withAttackIntent,commitDmTurn,recordedTurn,withStoryLog,withDeeds,partyVictory,conversationPeople,conversationTarget,withSceneTrigger,recruitmentTargets,storyText,isPartyGame,addJournalNote,levelUpReady,foeForLevel,buildError,makeCharacter,quickActions,attackActions,spellActions,gearedHero,weaponAttacks,advancementLevels,subclassOptions,spellSelectionError,appendJournal,appendStoryLog,hostileEncounterGame,hostileFoes,manageFollower,validSkillTraining})',{AsyncStorage:{},console},{timeout:3000});
 return engine;
}
module.exports={rules};
