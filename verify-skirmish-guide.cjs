const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// The Skirmish's first-lesson hints (skirmishGuide.js): one line for each moment, none outside the Skirmish.
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('skirmishGuide.js','utf8').replace(/^export (const|function)/gm,'$1')+'\n;this.out={skirmishHint};',ctx);
const {skirmishHint}=ctx.out;
const skirmish={story:{introId:'hostile'},stage:'combat',enemyHP:16,potions:1,playback:[]};
assert.match(skirmishHint(skirmish,{current:12},12),/first move/i);
assert.match(skirmishHint({...skirmish,playback:[{id:1}]},{current:12},12),/one action and one bonus action/i);
assert.match(skirmishHint({...skirmish,actionUsed:true},{current:12},12),/action is spent/i);
assert.match(skirmishHint(skirmish,{current:6},12),/healing draught/i);
assert.match(skirmishHint({...skirmish,potions:0,playback:[{id:1}]},{current:6},12),/one action and one bonus action/i,'no draught, no draught hint');
assert.match(skirmishHint(skirmish,{current:4},12),/Retreat/);
assert.match(skirmishHint({...skirmish,enemyHP:4},{current:12},12),/nearly down/i);
assert.match(skirmishHint({...skirmish,stage:'dying'},{current:0},12),/death save/i);
assert.equal(skirmishHint({...skirmish,stage:'dead'},{current:0},12),null);
assert.match(skirmishHint({...skirmish,stage:'bridge',enemyHP:0,foeFate:'slain'},{current:9},12),/You won/);
assert.match(skirmishHint({...skirmish,stage:'inn'},{current:9},12),/got clear/i);
assert.equal(skirmishHint({...skirmish,story:{introId:'surprise'}},{current:12},12),null,'written tales get no lesson');
assert.equal(skirmishHint(null,{current:12},12),null);
// Shown in the game only to a first-time player, under the actions.
const dm=fs.readFileSync('DungeonMaster.js','utf8');assert.ok(dm.includes("skirmishHint(game,health,")&&dm.includes('tips&&lesson'));
console.log('Skirmish lesson: a line for each moment of the practice fight, and none in a written tale.');
