// The one list of Questbound's rules files, in the order they are put together: the campaign server's rules engine
// (rules-engine.cjs), the checks (verify-*.cjs), dm-probe, dm-judgment and balance-check all read it here. A new
// rules file goes into `rulesFiles` once, at the place its top-level values need (a file whose top level reads another
// file's constant comes after it; functions may be in any order). Concatenated files share one scope, so every
// top-level name must be unique across them. verify-rules-engine.cjs checks the list, its imports and the names, and
// that nobody keeps a copy.
// A few checks deliberately load a handful of modules on their own, to test them in isolation; verify-rules-engine.cjs
// names them (subsets) and refuses any other copy of the list.
const fs=require('node:fs'),path=require('node:path');
const rulesFiles=['saveVersion.js','subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','memoryRules.js','spellOptions.js','equipmentRules.js','characterRules.js','subclassRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','lastingSpellRules.js','spellBuffRules.js','spellDamageRules.js','spellConditionRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','lootRules.js','adventureRules.js','wildFightRules.js','partyTurnRules.js','brawlRules.js','recoveryRules.js','travelRules.js','crossroadsRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','experienceRules.js','saveMigrations.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','dmSceneRules.js','dmChoiceRules.js','turnResourceRules.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','playbackRules.js','calmLines.js','toldAhead.js','fightLines.js','sceneTriggers.js','greetings.js','turnRules.js'];
// Pure modules the screens use beside the rules (art subjects, descriptions, the feed's cards, the roster, save codes,
// map drawing, the tale card...). The server never loads them; the checks that test them add them after the rules
// with `rulesSource({extra:[...]})` (or `withHelpers` for all of them).
const helperFiles=['worldArtRules.js','descriptions.js','chronicleRules.js','playbackHp.js','entityRules.js','rosterRules.js','turnMemory.js','mapLayout.js','mapArt.js','characterDraft.js','saveCodes.js','taleRules.js','characterOptions.js','suggestionRules.js','dmTurnRules.js'];
// A source file as text, with LF line endings whatever the checkout holds.
const readText=file=>fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n');
// One module made ready to share a scope with the others: its imports and the word export removed.
const moduleSource=file=>readText(file).replace(/^\s*import .*;\n/gm,'').replace(/export /g,'');
// The spell catalogue and slot table the rules expect as `catalog` and `progression`.
const dataSource=()=>'const catalog='+readText('spellCatalog.json')+';const progression='+readText('spellProgression.json')+';\n';
// The whole rules source, ready for vm.runInNewContext: the data, `files` (all the rules unless a check deliberately
// loads fewer) and any `extra` helper modules after them.
function rulesSource({files=rulesFiles,extra=[],data=true}={}){
 const list=[...files,...extra.filter(f=>!files.includes(f))];
 return (data?dataSource():'')+list.map(moduleSource).join('\n');
}
const withHelpers=helperFiles;
module.exports={rulesFiles,helperFiles,withHelpers,readText,moduleSource,dataSource,rulesSource};
