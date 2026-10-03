const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// Mixed fights: a creature can come with a different one at its side. The second creature has its own HP and AC,
// attacks every round, can be attacked or targeted with a spell by name (or by its own chip), runs when the leader
// falls, and comes back with a lair's owner if the hero flees.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','storyRules.js','hostileEncounter.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','playbackRules.js','worldArtRules.js','iconPaths.js','quickActions.js','pregens.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,adventureStep,dmCommand,dmContext,dmChoices,quickActions,validAdventure,adventureSnapshot,recordedTurn,livingAllies,startWildFight})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const camp=hero=>{const g={...r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),stage:'inn'};delete g.openingAttackAvailable;return g;};
const kara=r.readyHero('fighter');let hp={current:12,temp:0};
const valid=(hero,g,h)=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),h,true),hero);
const hound={template:'wolf',name:'War Hound',appearance:'A lean, scarred hound in a spiked leather collar.'};
const lair={name:'Cutthroat Hollow',description:'A bandit camp in a ravine, smoke and bones.',kind:'camp',bearing:'E',miles:1,danger:'lair',feature:null,lair:{template:'bandit',name:'Red Maddock',appearance:'A rangy bandit with a red scarf and a notched cutlass.',ally:hound}};
const arrive=r.adventureStep(camp(kara),hp,kara,{type:'discover',place:lair,travel:true},()=>0.5);
assert.equal(arrive.error,undefined);let g=arrive.game;
assert.equal(g.stage,'combat');same(r.livingAllies(g).map(a=>[a.name,a.template,a.hp]),[['War Hound','wolf',g.foeAllies[0].maximum]]);
assert.ok(arrive.events.some(t=>/Red Maddock bursts out at Cutthroat Hollow, a War Hound at its side!/.test(t)));
assert.ok(valid(kara,g,hp),'A fight with two creatures saves');
// ---- Choosing a target ----
assert.ok(r.dmChoices(kara,g).some(c=>c.id==='ally-attack:0:Greatsword'));
const chip=r.quickActions(kara,g).find(a=>a.key==='ally-attack:0:Greatsword');assert.equal(chip.label,'Hit Hound');
same(r.dmCommand(kara,g,'I attack the hound',hp).action,{type:'encounter-attack',weapon:'Greatsword',target:'ally:0'});
same(r.dmCommand(kara,g,'I hit the war hound with my greatsword',hp).action,{type:'encounter-attack',weapon:'Greatsword',target:'ally:0'});
assert.equal(r.dmCommand(kara,g,'I attack Red Maddock',hp).action.target,undefined,'The leader is still the default');
const ctx=r.dmContext(kara,g,hp).encounter;same(ctx.alsoFighting.map(a=>[a.name,a.currentHP]),[['War Hound',g.foeAllies[0].hp]]);
// ---- Hitting the hound ----
const seq=(...v)=>{let i=0;return ()=>v[i++]??0.5;};
const hit=r.adventureStep(g,hp,kara,{type:'encounter-attack',weapon:'Greatsword',target:'ally:0'},seq(0.9,0.1,0.1));
assert.equal(hit.error,undefined);assert.ok(hit.events.some(t=>t.startsWith('You use Greatsword on the War Hound:')));
assert.ok(hit.game.foeAllies[0].hp<g.foeAllies[0].hp);assert.equal(hit.game.enemyHP,g.enemyHP,'The leader is untouched');assert.equal(hit.game.aim,undefined,'The aim lasts one action');
assert.ok(valid(kara,hit.game,hit.health));
const turn=r.recordedTurn(kara,g,hp,hit,{question:'I attack the hound.',narration:'Steel bites.'});
assert.ok(turn.game.playback.at(-1).events.some(e=>e.kind==='effect'&&e.text.startsWith('War Hound: '+g.foeAllies[0].hp+' → ')));
// The hound bites back each round (after the leader).
const round=r.adventureStep({...hit.game},hit.health,kara,'dodge',()=>0.5);
assert.ok(round.events.some(t=>/^War Hound: d20 \[/.test(t)),'The second creature attacks');
// Until it falls.
let fight=hit.game,h=hit.health;
for(let i=0;i<6&&r.livingAllies(fight).length;i++){const s=r.adventureStep(fight,{current:12,temp:0},kara,{type:'encounter-attack',weapon:'Greatsword',target:'ally:0'},()=>0.9);fight=s.game;if(s.events.some(t=>t==='The War Hound is slain.'))break;}
assert.equal(r.livingAllies(fight).length,0);assert.ok(!r.quickActions(kara,fight).some(a=>a.key.startsWith('ally-attack')));
assert.match(r.adventureStep(fight,{current:12,temp:0},kara,{type:'encounter-attack',weapon:'Greatsword',target:'ally:0'},()=>0.5).error,/not in this fight/);
// ---- A spell aimed at it ----
const wizard=r.readyHero('wizard'),whp={current:8,temp:0};
let wg=r.adventureStep(camp(wizard),whp,wizard,{type:'discover',place:lair,travel:true},()=>0.5).game;
const cast=r.dmCommand(wizard,wg,'I cast Fire Bolt at the hound',whp);assert.equal(cast.action.request.aim,'ally:0');
const burnt=r.adventureStep(wg,whp,wizard,cast.action,()=>0.9);assert.equal(burnt.error,undefined);
assert.ok(burnt.game.foeAllies[0].hp<wg.foeAllies[0].hp,'The fire bolt burns the hound');assert.equal(burnt.game.enemyHP,wg.enemyHP);
// ---- The leader falls: the hound runs, the lair is cleared ----
const last=r.adventureStep({...g,enemyHP:1,openingAttackAvailable:false},hp,kara,'attack:Greatsword',()=>0.9);
assert.equal(last.game.stage,'wild');assert.ok(last.events.includes('With its leader down, the War Hound turns and flees.'));assert.equal(last.game.foeAllies,undefined);
assert.equal(last.game.world.places.find(p=>p.name==='Cutthroat Hollow').cleared,true);assert.ok(valid(kara,last.game,last.health));
// ---- Fleeing: both are waiting when you come back ----
const fled=r.adventureStep({...g,openingAttackAvailable:false},hp,kara,'flee',()=>0.5);
const den=fled.game.world.places.find(p=>p.name==='Cutthroat Hollow');same(den.threat.ally,hound);assert.equal(fled.game.foeAllies,undefined);assert.ok(valid(kara,fled.game,fled.health));
const back=r.adventureStep(fled.game,{current:12,temp:0},kara,{type:'travel',destination:den.id},()=>0.5);assert.equal(back.game.foeAllies[0].name,'War Hound');
// ---- Only a different, single creature can be an ally ----
const base=camp(kara);base.world={places:[{id:'p1',name:'Ford',description:'A ford.',kind:'water',x:0,y:5000,from:'inn'}],at:null};
assert.equal(r.startWildFight(base,kara,{...lair.lair,ally:{...hound,template:'bandit'}},{place:'p1'}).game.foeAllies,undefined,'Not the same kind');
assert.equal(r.startWildFight(base,kara,{...lair.lair,ally:{...hound,template:'wolves'}},{place:'p1'}).game.foeAllies,undefined,'Not a pack');
assert.ok(!valid(kara,{...g,foeAllies:[{...g.foeAllies[0],hp:999}]},hp));
// ---- The Dungeon Master server ----
const {generate}=require('./dm-server.cjs');
const reply=extra=>async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,...extra})}]}]})});
const keys={apiKey:'test-only',model:'test-model'},body={input:'I kick the sleeping boar.',context:{choices:[],world:{canDiscover:true,canAmbush:true}}};
(async()=>{
 const sprung=await generate(body,{...keys,fetchImpl:reply({narration:'Two shapes rise.',ambush:{template:'goblin',name:'Snag',appearance:'A one-eyed goblin in a wolfskin hood.',ally:{template:'wolf',name:'Worg',appearance:'A red-eyed worg with a saddle.'}}})});
 assert.equal(sprung.ambush.ally.name,'Worg');
 await assert.rejects(generate(body,{...keys,fetchImpl:reply({narration:'x',ambush:{template:'wolf',name:'Grey',appearance:'A grey wolf with a torn ear.',ally:{template:'wolf',name:'Other',appearance:'Another grey wolf here.'}}})}),/could not use/);
 console.log('Passed: a creature with a different one at its side (own HP, AC, attacks, chip, name and spell targeting, HP lines), the second one flees when the leader falls and returns with a lair owner after you flee; only a single creature of another kind can be an ally, and the DM can send one.');
})().catch(e=>{console.error(e);process.exit(1);});
