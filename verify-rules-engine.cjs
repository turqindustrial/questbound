// The campaign server's rules engine (rules-engine.cjs) is the browser's rules files run in a vm: every file a listed
// file imports must be listed too, every import must be one line ending in ';' (the engine strips them by line),
// the engine must load well inside its time limit, every name the server files call on it must exist, and nothing
// that the rules no longer have (partyVictory, before experience) may be named. If the engine failed to load,
// validSnapshot would quietly refuse every campaign ("Start with your own valid solo adventure").
const assert=require('node:assert/strict'),fs=require('node:fs');
const engine=fs.readFileSync('rules-engine.cjs','utf8');
const files=JSON.parse(engine.match(/const files=(\[[^\]]*\]);/)[1].replace(/'/g,'"'));
const exported=engine.match(/\(\{(readyHero[^}]*)\}\)/)[1].split(',').map(x=>x.trim());

// 1. Every listed file's local imports are listed too, and every import line can be stripped.
// playerStorage.js is the browser's storage: the engine gives the rules a stand-in AsyncStorage instead.
const stubbed=new Set(['playerStorage.js']),missing=[],unstrippable=[],seen=new Set(stubbed);
for(const file of files){
 const source=fs.readFileSync(file,'utf8');
 for(const line of source.split(/\r?\n/).filter(l=>/^import\b/.test(l)))if(!/;\s*$/.test(line))unstrippable.push(file+': '+line.slice(0,80));
 for(const m of source.matchAll(/^import\s[^\n]*?from\s+['"]\.\/([^'"]+)['"]/gm)){
  let name=m[1];if(name.endsWith('.json'))continue;if(!name.endsWith('.js'))name+='.js';
  if(!files.includes(name)&&!seen.has(name)){seen.add(name);missing.push(file+' imports '+name);}
 }
 assert.ok(!/\brequire\(/.test(source.replace(/\/\/.*$/gm,'')),file+' must not require() at load');
}
assert.deepEqual(missing,[],'the engine lists every rules file the listed files import');
assert.deepEqual(unstrippable,[],'every import is a single line ending in ";"');
for(const needed of ['subclassRules.js','lootRules.js','experienceRules.js','turnRules.js'])assert.ok(files.includes(needed),needed+' is in the engine');

// 2. No two listed files define the same top-level function (a later one would silently replace the earlier).
const owners={};
for(const file of files)for(const m of fs.readFileSync(file,'utf8').matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm))(owners[m[1]]??=[]).push(file);
const twice=Object.entries(owners).filter(([,list])=>list.length>1).map(([name,list])=>name+' ('+list.join(', ')+')');
assert.deepEqual(twice,[],'top-level names are unique across the engine files');

// 3. It loads, quickly, and every exported name is a real value.
const started=Date.now(),r=require('./rules-engine.cjs').rules(),took=Date.now()-started;
assert.ok(took<2500,'the engine loads well inside its 3 s limit ('+took+' ms)');
for(const name of exported)assert.notEqual(typeof r[name],'undefined',name+' is defined');
assert.ok(!exported.includes('partyVictory')&&r.partyVictory===undefined,'partyVictory is gone: experience pays every hero');

// 4. Every r.name(...) the server files call exists on the engine.
const calls=new Map();
for(const file of ['server-turn.cjs','campaigns.cjs','campaign-advancement.cjs'])for(const m of fs.readFileSync(file,'utf8').matchAll(/\br\.([A-Za-z_$][\w$]*)\s*\(/g))calls.set(m[1],file);
assert.ok(calls.size>20,'the server files call the engine');
const absent=[...calls].filter(([name])=>typeof r[name]!=='function').map(([name,file])=>name+' ('+file+')');
assert.deepEqual(absent,[],'every engine function the server calls exists');
for(const name of ['settleTurn','withExperience','advancedInPlace','levelCompanions','withCompanionClasses','acceptOffer','attuneItem','speakingPeople','attackTargets'])assert.ok(calls.has(name),'the server uses '+name);

console.log('Rules engine: '+files.length+' files with all their imports, '+exported.length+' names, loaded in '+took+' ms; the '+calls.size+' functions the campaign server calls all exist, and partyVictory is gone.');
