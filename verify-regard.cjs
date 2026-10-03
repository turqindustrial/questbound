const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// People take to the hero's species differently: kin, warm, curious, indifferent, wary or scornful, written by the
// story or drawn from who they are. It sets the first impression, sways words aimed at them, is shown to the player
// and the Dungeon Master, and gives way to deeds. Also: who is a woman and who a man, so that portraits are painted
// right (no bearded ladies).
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','worldArtRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,readyHeroes,hostileEncounterGame,newAdventure,adventureStep,commitDmTurn,dmContext,validAdventure,adventureSnapshot,validStory,freshStoryGame,speciesRegard,regardAttitude,regardSway,regardLabel,regardMemory,regardStances,validRegard,speciesPlural,introducePerson,npcScene,attitudeLabel,genderOf,portraitDescription,npcArtSubject,heroArtSubject,npcLore,speciesDetails:typeof speciesDetails==="undefined"?null:speciesDetails})',{AsyncStorage:{}});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const hero=(key,species)=>({...r.readyHero(key),...(species?{species}:{})});
const cleric=r.readyHero('cleric'),hp={current:10,temp:0};
const valid=(g,h=hp,who=cleric)=>r.validAdventure(r.adventureSnapshot(who,JSON.parse(JSON.stringify(g)),h,true),who);
const story=(()=>{const s={...r.hostileEncounterGame(cleric,r.newAdventure(cleric),()=>0).story,id:'regard-1',status:'active'};delete s.openingDialogue;delete s.introId;return s;})();
const game=(who,npcs={})=>({...r.freshStoryGame(who,{...story,npcs:{keeper:{...story.npcs.keeper,...npcs.keeper},mara:{...story.npcs.mara,...npcs.mara}}},r.newAdventure(who)),stage:'inn'});
// ---- Written by the story: each resident has their own view, and it shows from the first moment ----
const written=game(cleric,{keeper:{species:'Human',regard:{stance:'scornful',reason:'Dwarven lenders took her father\'s farm.'}},mara:{species:'Halfling',regard:{stance:'warm',reason:'A dwarf smith once mended his cart for nothing.'}}});
assert.ok(valid(written,null));
same(r.speciesRegard(written,'keeper',cleric),{stance:'scornful',reason:'Dwarven lenders took her father\'s farm.',species:'Dwarf',kind:'dwarves'});
assert.equal(written.npcMemory.keeper.attitude,'unfriendly');assert.equal(written.npcMemory.mara.attitude,'friendly','Two people, two reactions to the same hero');
assert.match(written.npcMemory.keeper.memories[0],/^A dwarf newcomer\. Dwarven lenders/);
assert.equal(r.regardLabel(r.speciesRegard(written,'keeper',cleric)),'Scornful of dwarves');assert.equal(r.regardLabel(r.speciesRegard(written,'mara',cleric)),'Fond of dwarves');
assert.equal(r.attitudeLabel(r.npcScene(written).find(n=>n.id==='keeper')).label,'Wary');
// The Dungeon Master sees it for everyone present.
const ctx=r.dmContext(cleric,written,hp);
same(ctx.nearbyNPCs.map(n=>[n.id,n.regardsYourKind?.stance]),[['keeper','scornful'],['mara','warm']]);assert.equal(ctx.nearbyNPCs[0].regardsYourKind.reason,'Dwarven lenders took her father\'s farm.');
assert.equal(ctx.npcSocialState.find(n=>n.id==='keeper').regardsYourKind,'scornful');assert.equal(ctx.player.species,'Dwarf');
// ---- Drawn from who they are when the story says nothing: kin, and how each kind is commonly met ----
const plain=game(cleric,{keeper:{species:'Dwarf'},mara:{species:'Human'}});
assert.equal(r.speciesRegard(plain,'keeper',cleric).stance,'kin');assert.equal(plain.npcMemory.keeper.attitude,'friendly');assert.equal(r.regardLabel(r.speciesRegard(plain,'keeper',cleric)),'Kin: one of their own');
same(r.speciesRegard(plain,'mara',cleric),r.speciesRegard(plain,'mara',cleric),'The same every time');
// Across many people, a tiefling meets more wariness than a halfling, and nobody scorns a halfling.
const tally=species=>{const who=hero('rogue',species),counts={};for(let i=0;i<300;i++){const g={story:{id:'s'+i,npcs:{keeper:{name:'Person '+i,species:'Human'}}}};const st=r.speciesRegard(g,'keeper',who).stance;counts[st]=(counts[st]??0)+1;}return counts;};
const tiefling=tally('Tiefling'),halfling=tally('Halfling'),human=tally('Human');
assert.ok(tiefling.wary>halfling.wary*2,'Tieflings are met warily: '+JSON.stringify(tiefling));assert.ok((halfling.warm??0)>(tiefling.warm??0));assert.equal(halfling.scornful,undefined);assert.ok((tiefling.scornful??0)>0);
assert.ok(human.indifferent===300,'A human among humans is nothing remarkable');assert.equal(tally('Dwarf').kin,undefined,'These are humans, not dwarves');
for(const stance of Object.keys(tiefling))assert.ok(r.regardStances.includes(stance));
assert.equal(r.speciesPlural('Half-Elf'),'half-elves');assert.equal(r.speciesPlural('Aasimar'),'aasimar folk');assert.equal(r.speciesPlural(''),'strangers');
// ---- It sways words: easier with those who like your kind, harder with those who do not ----
const check=skill=>({type:'ai-check',check:{skill,ability:skill==='Athletics'?'Strength':'Charisma',dc:12,mode:'normal',reason:'Talk the captain round',success:'She relents.',failure:'She will not hear it.',damageCount:0,damageDie:6,damageOn:'none'}});
const talk=(g,npcId,skill='Persuasion')=>r.commitDmTurn(cleric,g,hp,check(skill),{question:'I ask her to let us pass.',narration:'You make your case.',npcId},()=>0.5);
const cold=talk(written,'keeper'),warm=talk(written,'mara'),nobody=talk(written,null),climb=talk(written,'keeper','Athletics');
assert.match(cold.events[0],/ - 3 scornful of dwarves = /);assert.match(warm.events[0],/ \+ 2 warm of dwarves = /);assert.ok(!/dwarves/.test(nobody.events[0]));assert.ok(!/dwarves/.test(climb.events[0]),'Only words are swayed');
const total=e=>Number(e.match(/= (-?\d+) vs DC/)[1]);assert.equal(total(cold.events[0]),total(nobody.events[0])-3);assert.equal(total(warm.events[0]),total(nobody.events[0])+2);
same(r.regardSway(written,'keeper',cleric),{bonus:-3,note:'scornful of dwarves'});
// Deeds outweigh it: once she is won over (or owes a debt, or bears a grudge) her view of dwarves no longer counts.
const won=r.commitDmTurn(cleric,written,hp,null,{question:'I mend her wagon and share my rations.',narration:'She watches, then nods.',relationships:[{npcId:'keeper',change:'grateful',memory:'The dwarf mended my wagon and asked nothing.'}]}).game;
assert.equal(won.npcMemory.keeper.attitude,'friendly');assert.equal(r.regardSway(won,'keeper',cleric).bonus,0);assert.equal(r.regardSway(won,'mara',cleric).bonus,2,'Those who liked dwarves still do');
// ---- People met along the way ----
const sketch={name:'Old Marta Venn',species:'Human',role:'A ferrywoman at the river crossing.',appearance:'A stooped woman in an oilskin cape, with a long beard of river weed caught in her net and a grey braid.',personality:'Dry and patient.',toughness:'common',attitude:'indifferent',foe:'neutral',tie:null,gender:'woman',regard:{stance:'wary',reason:'A dwarf prospector fouled her river.'}};
const met=r.introducePerson(written,sketch,cleric);assert.equal(met.error,undefined);
assert.equal(met.game.people.n1.gender,'woman');same(met.game.people.n1.regard,{stance:'wary',reason:'A dwarf prospector fouled her river.'});assert.equal(met.game.npcMemory?.n1,undefined,'Wary is a manner, not yet a grievance');assert.ok(valid(met.game));
const sour=r.introducePerson(written,{...sketch,name:'Dunmar Kell',gender:'man',regard:{stance:'scornful',reason:'He blames dwarves for the mine collapse.'}},cleric);
assert.equal(sour.game.npcMemory.n1.attitude,'unfriendly');assert.match(sour.game.npcMemory.n1.memories[0],/He blames dwarves/);
const kin=r.introducePerson(written,{...sketch,name:'Thora Stonehand',species:'Dwarf',gender:'woman',regard:undefined},cleric);
assert.equal(kin.game.npcMemory.n1.attitude,'friendly','A dwarf met by a dwarf is kin');assert.equal(kin.game.people.n1.regard,undefined);
const firm=r.introducePerson(written,{...sketch,name:'Captain Ruse',attitude:'hostile',regard:{stance:'warm',reason:'x'}},cleric);assert.equal(firm.game.npcMemory.n1.attitude,'hostile','What the Dungeon Master decided stands');
const junk=r.introducePerson(written,{...sketch,name:'Nell Ash',gender:'giant',regard:{stance:'adoring',reason:5}},cleric);assert.equal(junk.error,undefined);assert.equal(junk.game.people.n1.gender,undefined);assert.equal(junk.game.people.n1.regard,undefined);assert.ok(valid(junk.game));
assert.ok(!valid({...met.game,people:{n1:{...met.game.people.n1,regard:{stance:'adoring',reason:''}}}}));assert.ok(!valid({...met.game,people:{n1:{...met.game.people.n1,gender:'giant'}}}));
assert.ok(!r.validStory({...written.story,npcs:{...written.story.npcs,keeper:{...written.story.npcs.keeper,regard:{stance:'adoring',reason:''}}}}));
// ---- Portraits: a woman is painted as one, whatever her species ----
assert.equal(r.genderOf('A broad-shouldered veteran with a scarred jaw, cropped copper hair and a grin she saves for bad odds.'),'woman');
assert.equal(r.genderOf('A stout dwarf priest; his braided grey beard reaches his belt.'),'man');assert.equal(r.genderOf('A small, quick halfling with bright eyes.'),null);
assert.equal(r.genderOf('He looks stern.','woman'),'woman','What the story says wins');assert.equal(r.genderOf('She looks stern.','other'),null);
const marta=r.npcArtSubject(met.game,'n1');
assert.equal(marta.id,'n1-w');assert.match(marta.description,/^A woman, with a woman's face: smooth cheeks and chin, no beard, no moustache/);assert.ok(!/long beard/.test(marta.description),'A beard written into her description is taken out');assert.match(marta.description,/oilskin cape/);assert.match(marta.description,/grey braid/);
const dunmar=r.npcArtSubject(sour.game,'n1');assert.equal(dunmar.id,'n1');assert.match(dunmar.description,/^A man\. /);assert.match(dunmar.description,/long beard/,'A man keeps his beard');
const dwarfWoman=game(cleric,{keeper:{species:'Dwarf',gender:'woman',appearance:'A broad dwarf with a plaited beard, copper rings in it, and a soot-stained apron.'}});
const smith=r.npcArtSubject(dwarfWoman,'keeper');assert.equal(smith.id,'keeper-w');assert.ok(!/beard/.test(smith.description.replace(/no beard/,'')),'Even a dwarf woman: '+smith.description.slice(0,160));assert.match(smith.description,/soot-stained apron/);
assert.equal(r.portraitDescription('Tall, moustached and stern.','woman').includes('moustached'),false);
// The ready-made heroes: Kara and Ilyra are painted as women, Borin keeps his beard, Pip is left to the painter.
const subjects=Object.fromEntries(r.readyHeroes.map(h=>[h.key,r.heroArtSubject(r.readyHero(h.key))]));
assert.equal(subjects.fighter.id,'hero-w');assert.match(subjects.fighter.description,/no beard/);assert.equal(subjects.wizard.id,'hero-w');
assert.equal(subjects.cleric.id,'hero');assert.match(subjects.cleric.description,/braided grey beard/);assert.equal(subjects.rogue.id,'hero');assert.ok(!/A woman|A man\./.test(subjects.rogue.description));
console.log('Passed: people take to the hero\'s kind in their own ways (written or drawn from who they are), it sets first impressions, sways words until deeds outweigh it, reaches the Dungeon Master and the screen, saves guard it, and women are painted without beards whatever their species.');
