// The campaign server's rules engine (rules-engine.cjs) is the browser's rules files run in a vm: every file a listed
// file imports must be listed too, every import must be one line ending in ';' (the engine strips them by line),
// the engine must load well inside its time limit, every name the server files call on it must exist, and nothing
// that the rules no longer have (partyVictory, before experience) may be named. If the engine failed to load,
// validSnapshot would quietly refuse every campaign ("Start with your own valid solo adventure").
// The list itself lives in rules-files.cjs (rulesFiles, and helperFiles for the screens' pure modules the checks load
// beside them); nothing else may keep a copy of it.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {rulesFiles:files,helperFiles,rulesSource,readText}=require('./rules-files.cjs');
const engine=fs.readFileSync('rules-engine.cjs','utf8');
const exported=engine.match(/\(\{(readyHero[^}]*)\}\)/)[1].split(',').map(x=>x.trim());
assert.ok(engine.includes("require('./rules-files.cjs')")&&!/const files=\[/.test(engine),'the engine reads its files from rules-files.cjs');

// 1. Every listed file's local imports are listed too, and every import line can be stripped. A rules file imports
// only rules files; a helper may import rules files and other helpers.
// playerStorage.js is the browser's storage: the engine gives the rules a stand-in AsyncStorage instead.
const stubbed=new Set(['playerStorage.js']),missing=[],unstrippable=[],seen=new Set(stubbed);
for(const file of [...files,...helperFiles]){
 const source=readText(file),allowed=files.includes(file)?files:[...files,...helperFiles];
 for(const line of source.split('\n').filter(l=>/^import\b/.test(l)))if(!/;\s*$/.test(line))unstrippable.push(file+': '+line.slice(0,80));
 for(const m of source.matchAll(/^import\s[^\n]*?from\s+['"]\.\/([^'"]+)['"]/gm)){
  let name=m[1];if(name.endsWith('.json'))continue;if(!name.endsWith('.js'))name+='.js';
  if(!allowed.includes(name)&&!seen.has(name)){seen.add(name);missing.push(file+' imports '+name);}
 }
 assert.ok(!/\brequire\(/.test(source.replace(/\/\/.*$/gm,'')),file+' must not require() at load');
}
assert.deepEqual(missing,[],'the engine lists every rules file the listed files import');
assert.deepEqual(unstrippable,[],'every import is a single line ending in ";"');
for(const needed of ['subclassRules.js','lootRules.js','experienceRules.js','turnRules.js','memoryRules.js'])assert.ok(files.includes(needed),needed+' is in the engine');
assert.equal(new Set([...files,...helperFiles]).size,files.length+helperFiles.length,'no file is listed twice');

// 2. No two listed files (rules or helpers, which the checks load together) define the same top-level name (a later
// one would silently replace the earlier, or the concatenation would not even load).
const owners={};
for(const file of [...files,...helperFiles])for(const m of readText(file).matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm))(owners[m[1]]??=[]).push(file);
const twice=Object.entries(owners).filter(([,list])=>list.length>1).map(([name,list])=>name+' ('+list.join(', ')+')');
assert.deepEqual(twice,[],'top-level names are unique across the rules and helper files');
{const vm=require('node:vm'),all=vm.runInNewContext(rulesSource({extra:helperFiles})+'\n;({newAdventure,taleSummary,exportSave,heroArtSubject})',{AsyncStorage:{},console},{timeout:5000});
 assert.ok(Object.values(all).every(f=>typeof f==='function'),'the rules and every helper load together in one scope, in the listed order');}

// 3. One list: no other script keeps its own copy of it (a copy is how a check once missed memoryRules.js). A few
// checks deliberately load a handful of modules on their own, to test them in isolation; they are named here.
const subsets={'verify-casting-enforcement.cjs':'casting rules alone','verify-combat.cjs':'combat numbers alone','verify-weapons.cjs':'weapon numbers alone','verify-companions.cjs':'people and scene art alone','verify-dialogue-triggers.cjs':'scene triggers alone','verify-foes.cjs':'scene triggers alone','verify-playback.cjs':'playback alone','verify-legal.cjs':'the classes and species on offer','verify-map-layout.cjs':'map drawing alone','verify-new-story.cjs':'the story writer\'s output alone','verify-world-art.cjs':'art subjects alone','verify-theme.cjs':'files that write colours','verify-rules-engine.cjs':'this check'};
const copies=[];
// make-save-fixtures.cjs reads old builds' own lists out of git, as those builds loaded their rules.
for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.cjs')&&!['rules-files.cjs','make-save-fixtures.cjs'].includes(f))){
 const text=readText(file);
 for(const m of text.matchAll(/\[('[A-Za-z]+\.js'(?:\s*,\s*'[A-Za-z]+\.(?:js|json)')*)\]/g)){
  const list=m[1].match(/'[^']+'/g).map(s=>s.slice(1,-1)),rules=list.filter(f=>files.includes(f));
  if(list.includes('adventureRules.js')||list.includes('adventureStorage.js')||(rules.length>=2&&!subsets[file]))copies.push(file+': ['+list.slice(0,4).join(', ')+(list.length>4?', …':'')+']');
 }
 if(/match\(\/const files=/.test(text))copies.push(file+' reads the list out of rules-engine.cjs');
}
assert.deepEqual(copies,[],'every script reads the rules files from rules-files.cjs (rulesSource) or is a named deliberate subset');

// 4. It loads, quickly, and every exported name is a real value.
const started=Date.now(),r=require('./rules-engine.cjs').rules(),took=Date.now()-started;
assert.ok(took<2500,'the engine loads well inside its 3 s limit ('+took+' ms)');
for(const name of exported)assert.notEqual(typeof r[name],'undefined',name+' is defined');
assert.ok(!exported.includes('partyVictory')&&r.partyVictory===undefined,'partyVictory is gone: experience pays every hero');

// 5. Every r.name(...) the server files call exists on the engine.
const calls=new Map();
for(const file of ['server-turn.cjs','campaigns.cjs','campaign-advancement.cjs'])for(const m of fs.readFileSync(file,'utf8').matchAll(/\br\.([A-Za-z_$][\w$]*)\s*\(/g))calls.set(m[1],file);
assert.ok(calls.size>20,'the server files call the engine');
const absent=[...calls].filter(([name])=>typeof r[name]!=='function').map(([name,file])=>name+' ('+file+')');
assert.deepEqual(absent,[],'every engine function the server calls exists');
// The story so far is folded by settleTurn on the server as on a device, and the memory is checked with the save.
for(const name of ['withMemory','rememberFacts','memoryBlock','validMemory'])assert.equal(typeof r[name],'function',name+' is on the engine');
for(const name of ['settleTurn','withExperience','advancedInPlace','levelCompanions','withCompanionClasses','acceptOffer','attuneItem','speakingPeople','attackTargets'])assert.ok(calls.has(name),'the server uses '+name);

console.log('Rules engine: '+files.length+' files with all their imports, '+exported.length+' names, loaded in '+took+' ms; the '+calls.size+' functions the campaign server calls all exist, and partyVictory is gone.');
