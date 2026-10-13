const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),r=require('./verify-dm-integration.cjs');
const s=vm.runInNewContext(['mapRules.js','journalRules.js','npcRules.js','relationshipRules.js','lootRules.js','storyRules.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n')+'\n({validStory,freshStoryGame})');
const hero={name:'Story QA',class:'Wizard',species:'Human',level:1,scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:['acid-splash']};hero.equipment=r.equipmentFor(hero);
const story={id:'test-story',title:'The Glass Orchard',premise:'The harvest remembers a vanished storm.',opening:'An orchard worker asks you to examine singing fruit.',objective:'Discover why the trees are singing.',resolution:'Find the buried bell and persuade the workers to silence it.',secret:'A storm bell lies under the roots.',foe:'Briar sentinel',status:'active',locations:{inn:{name:'Harvest Camp',description:'A warm camp.'},bridge:{name:'Glass Orchard',description:'Ringing branches surround a sentinel.'},tower:{name:'Buried Belfry',description:'Broken steps descend beneath the roots.'}},npcs:{keeper:{name:'Ivo',role:'Orchard worker',motive:'Protect the harvest.'},mara:{name:'Sera',role:'Bell mender',motive:'Recover her missing bell.'}}};
let game=s.freshStoryGame(hero,story,r.newAdventure(hero));
assert.ok(r.validAdventure(r.adventureSnapshot(hero,game,null,true),hero));
// The foe's hoard (a magic item from the catalogue, named by the writer) is tidied, or dropped when it is not sound.
{const kept=s.freshStoryGame(hero,{...story,id:'hoard-kept',hoard:{item:'cloak-of-protection',name:'  Mantle of Ash ',note:'A grey cloak that smells of woodsmoke.'}},r.newAdventure(hero));
 assert.equal(JSON.stringify(kept.story.hoard),JSON.stringify({item:'cloak-of-protection',name:'Mantle of Ash',note:'A grey cloak that smells of woodsmoke.'}));assert.ok(r.validAdventure(r.adventureSnapshot(hero,kept,null,true),hero),'a tale with a hoard is a valid save');
 for(const hoard of [{item:'amulet-of-health',name:'Amulet',note:'Not ours.'},{item:'potion-greater-healing',name:'Red Vial',note:'A draught.'},{item:'ring-of-protection',name:'',note:'No name.'},'a sword'])assert.equal(s.freshStoryGame(hero,{...story,id:'hoard-dropped',hoard},r.newAdventure(hero)).story.hoard,undefined,'an unsound hoard is dropped: '+JSON.stringify(hoard));
 assert.ok(!s.validStory({...game.story,hoard:{item:'weapon+1',name:'Edge',note:'Sharp.',extra:1}}),'a hoard is exactly item, name and note');}
const context=r.dmContext(hero,game,null);assert.equal(context.story.title,story.title);assert.equal(context.nearbyNPCs[0].name,'Ivo');assert.ok(!context.choices.some(c=>c.id==='listen'||c.id==='start-lens'));
const travel=r.dmCommand(hero,game,'I travel to Buried Belfry');assert.equal(travel.action.destination,'tower');
let result=r.adventureStep(game,null,hero,travel.action,()=>0);assert.equal(result.game.story.title,story.title);assert.ok(result.game.log[0].includes('Buried Belfry'));assert.ok(r.validAdventure(r.adventureSnapshot(hero,result.game,result.health,true),hero));
assert.ok(r.adventureStep(game,null,hero,'listen').error);
const attack=r.dmCommand(hero,game,'I attack Ivo');assert.equal(attack.action.target,'keeper');
const rest=r.adventureStep(game,null,hero,'long-rest');assert.equal(rest.game.story.title,story.title);assert.equal(rest.game.journal.entries[0].title,story.title);
assert.throws(()=>s.freshStoryGame(hero,{title:'broken'},r.newAdventure(hero)),/incomplete/);
assert.equal(r.validAdventure(r.adventureSnapshot(hero,{...game,story:{...story,locations:null}},null,true),hero),false);
const previous={...game,npcHP:{keeper:0},npcMemory:{},worldFacts:['Old secret'],spellSlotsUsed:[2,0,0,0,0,0,0,0,0]};
const fresh=s.freshStoryGame(hero,{...story,id:'another'},r.newAdventure(hero));assert.equal(fresh.npcHP,undefined);assert.equal(fresh.spellSlotsUsed,undefined);assert.ok(!fresh.worldFacts.includes('Old secret'));assert.equal(previous.npcHP.keeper,0);
(async()=>{
 if(process.argv.includes('--live')){
  const generated=[];
  for(let i=0;i<2;i++){
   const response=await fetch('http://localhost:8084/dm',{method:'POST',headers:{Origin:'http://localhost:8081','Content-Type':'application/json'},body:JSON.stringify({input:'Create a fresh adventure.',context:{mode:'adventure',choices:[],player:{name:hero.name,class:hero.class,level:1},previousStory:generated.at(-1)??null,variation:Date.now()}})});
   const body=await response.json();assert.ok(response.ok,body.error);assert.ok(s.validStory(body.story),JSON.stringify(body.story));generated.push(body.story);
  }
  assert.notEqual(generated[0].id,generated[1].id);assert.notEqual(generated[0].title,generated[1].title);assert.notEqual(generated[0].objective,generated[1].objective);
  fs.writeFileSync('LIVE-STORY-TEST-REPORT.json',JSON.stringify(generated,null,2));console.log('Live new stories:',generated.map(g=>g.title).join(' / '));
 }
 console.log('Passed: new world isolation, validation, saves, story context, named NPC/route commands, legacy quest blocking and rest continuity.');
})().catch(e=>{console.error(e);process.exitCode=1;});

