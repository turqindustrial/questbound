const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// The story feed's reading of real engine lines (die faces, verdicts, damage, HP) and the HP bars that follow playback.
const load=file=>{const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8').replace(/^export (const|function)/gm,'$1')+'\n;this.out={'+(file==='chronicleRules.js'?'describeEvent,damageIcon':'shownHp')+'};',ctx);return ctx.out;};
const {describeEvent,damageIcon}=load('chronicleRules.js'),{shownHp}=load('playbackHp.js');
const d=(kind,text)=>JSON.parse(JSON.stringify(describeEvent({kind,text})));
let v=d('roll','You use Greatsword: d20 [15] (normal) + 3 Strength + 2 proficiency = 20 vs AC 13. Hit.');
assert.equal(v.type,'roll');assert.equal(v.title,'Greatsword');assert.equal(v.natural,15);assert.equal(v.total,20);assert.equal(v.target,'AC 13');assert.equal(v.verdict,'hit');assert.equal(v.actor,'you');assert.equal(v.math,'15 + 3 Strength + 2 proficiency = 20');
v=d('roll','Goblin Raider 1: d20 [17] (normal) +3 = 20 vs your AC 16. Hit.');
assert.equal(v.actor,'foe');assert.equal(v.title,'Goblin Raider 1');assert.equal(v.math,'17 + 3 = 20');assert.equal(v.target,'AC 16');
v=d('roll','You use Greatsword: d20 [20] (normal) + 3 Strength + 2 proficiency = 25 vs AC 13. Critical hit!');assert.equal(v.verdict,'crit');assert.equal(v.natural,20);
v=d('roll','You use Greatsword: d20 [2] (normal) + 3 Strength + 2 proficiency = 7 vs AC 13. Miss.');assert.equal(v.verdict,'miss');
v=d('roll','Fire Bolt: d20 [13, 9] (disadvantage) + 3 Intelligence + 2 proficiency = 14 vs AC 11. Hit; 7 Fire damage (1d10 [7]).');
assert.equal(v.natural,9);assert.equal(v.mode,'disadvantage');assert.equal(v.damage.amount,7);assert.equal(v.damage.damageType,'fire');assert.equal(v.title,'Fire Bolt');
v=d('roll','Burning Hands: Dexterity save d20 13 + 2 = 15 vs DC 13: success; 6 Fire damage. Damage 3d6 [4, 4, 4] = 12; halved on save.');
assert.equal(v.type,'save');assert.equal(v.verdict,'saved');assert.equal(v.damage.amount,6);assert.equal(v.outcome,'');
v=d('roll','Wisdom check: d20 14 +3 = 17 vs DC 15. Success. You spot the loose stone.');assert.equal(v.verdict,'success');assert.equal(v.outcome,'You spot the loose stone.');
v=d('roll','Search the ruins: Wisdom (Perception) d20 [8] + 1 ability + 2 training = 11 vs DC 12. Failure. Nothing turns up.');assert.equal(v.verdict,'failure');assert.equal(v.natural,8);assert.equal(v.outcome,'Nothing turns up.');
v=d('roll','You use Longsword against Mara: d20 [11] (normal) + 3 Strength + 2 proficiency = 16 vs AC 12. Hit; 7 Slashing damage (1d8 [4] + 3). 5 HP remaining.');assert.equal(v.title,'Longsword → Mara');assert.equal(v.damage.amount,7);assert.equal(v.outcome,'5 HP remaining.');
v=d('roll','You use Quarterstaff: d20 [4] (normal) + -1 Strength + 2 proficiency = 5 vs AC 11. Miss.');assert.equal(v.math,'4 − 1 Strength + 2 proficiency = 5','Negative modifiers read as subtraction');
v=d('initiative','Your initiative: d20 [12] + 1 = 13.');assert.equal(v.type,'initiative');assert.equal(v.natural,12);assert.equal(v.total,13);
v=d('initiative','Bandit Cutthroat initiative: d20 11 + 1 = 12.');assert.equal(v.type,'initiative');assert.equal(v.natural,11);assert.equal(v.title,'Bandit Cutthroat initiative');
v=d('initiative','Turn order: Bandit Cutthroat → You.');assert.deepEqual(v.names,['Bandit Cutthroat','You']);
v=d('roll','11 slashing damage (3 + 5 +3).');assert.equal(v.type,'damage');assert.equal(v.amount,11);assert.equal(v.damageType,'slashing');
v=d('roll','1d4 [1] + 1 = 2 Slashing damage. 2 damage recorded: 0 absorbed by temporary HP, 2 HP lost.');assert.equal(v.type,'hurt');assert.equal(v.amount,2);assert.equal(v.damageType,'slashing');assert.equal(v.math,'1d4 [1] + 1 = 2');
v=d('roll','Healing draught: 4 + 1 + 2; restored 7 HP. It uses your turn in this demo.');assert.equal(v.type,'heal');assert.equal(v.amount,7);
v=d('action','Round 2 begins.');assert.equal(v.round,2);assert.equal(d('action','Your turn.').type,'turn');assert.equal(d('action','Opening attack.').type,'opening');
v=d('effect','Kara Vell: 12 → 5 HP.');assert.equal(v.type,'hp');assert.equal(v.from,12);assert.equal(v.to,5);
assert.equal(d('effect','Spent 1 level 1 spell slot.').type,'note');
assert.equal(d('narration','The road is quiet.').type,'text');assert.equal(d('action','The threat is defeated.').type,'text');
assert.equal(damageIcon('fire'),'flame');assert.equal(damageIcon('unknown'),'sword');
// No engine line may throw, whatever it says.
for(const text of ['',':','d20','d20 [] = vs AC','Round x begins.','→ HP','0 HP lost','restored HP'])for(const kind of ['roll','initiative','effect','action','narration'])describeEvent({kind,text});
// HP during playback: the blow lands, the bar drops; the summary line snaps it exact; it never leaves the turn's range.
const turn=[
 {kind:'player',text:'I attack with my Greatsword.'},{kind:'action',text:'Opening attack.'},
 {kind:'roll',text:'You use Greatsword: d20 [8] (normal) + 3 Strength + 2 proficiency = 13 vs AC 12. Hit.'},{kind:'roll',text:'10 slashing damage (3 + 4 +3).'},
 {kind:'roll',text:'Bandit Cutthroat: d20 [14] (normal) +3 = 17 vs your AC 16. Hit.'},{kind:'roll',text:'1d6 [6] + 1 = 7 Slashing damage. 7 damage recorded: 0 absorbed by temporary HP, 7 HP lost.'},
 {kind:'action',text:'Your turn.'},{kind:'effect',text:'Kara Vell: 12 → 5 HP.'},{kind:'effect',text:'Bandit Cutthroat: 16 → 6 HP.'},{kind:'narration',text:'…'}];
const names={hero:'Kara Vell',foe:'Bandit Cutthroat'},at=n=>JSON.parse(JSON.stringify(shownHp(turn,n,names)));
assert.deepEqual(at(1),{hero:12,foe:16});assert.deepEqual(at(3),{hero:12,foe:16});assert.deepEqual(at(4),{hero:12,foe:6});
assert.deepEqual(at(5),{hero:12,foe:6});assert.deepEqual(at(6),{hero:5,foe:6});assert.deepEqual(at(turn.length),{hero:5,foe:6});
assert.equal(shownHp([{kind:'narration',text:'Nothing happens.'}],1,names),null,'Turns without HP changes leave the bars alone');
const heal=[{kind:'roll',text:'Healing draught: 4 + 1 + 2; restored 7 HP.'},{kind:'effect',text:'Kara Vell: 3 → 10 HP.'}];
assert.equal(shownHp(heal,0,names).hero,3);assert.equal(shownHp(heal,1,names).hero,10);
const over=[{kind:'roll',text:'1d6 [6] + 9 = 15 Slashing damage. 15 damage recorded: 0 absorbed by temporary HP, 15 HP lost.'},{kind:'effect',text:'Kara Vell: 12 → 0 HP.'}];
assert.equal(shownHp(over,1,names).hero,0,'Never below the final value');
console.log('Passed: the story feed reads attacks, spell attacks, saves, checks, initiative, turn order, damage dealt and taken, healing, rounds and HP summaries from real engine lines; unknown lines fall back to text; HP bars follow playback and stay within each turn\'s range.');
