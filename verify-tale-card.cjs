const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
// The tale card (taleRules.js, taleCard.js, ShareTale.js): the words and figures a player shares about their hero, worked
// out from the save alone; the picture is painted in the browser and shared or saved from the Log and Quest tabs.
const files=['subclassOptions.js','campaignRules.js','mapRules.js','journalRules.js','spellOptions.js','equipmentRules.js','characterRules.js','combatRules.js','weaponRules.js','masteryRules.js','healthRules.js','spellRules.js','classActions.js','dungeonRules.js','deathRules.js','npcRules.js','relationshipRules.js','encounterRules.js','inventoryRules.js','adventureRules.js','partyRules.js','skillRules.js','storyRules.js','followerRules.js','adventureStorage.js','deedRules.js','characterStorage.js','dmCommands.js','dmContext.js','hostileEncounter.js','iconPaths.js','quickActions.js','pregens.js','sequelRules.js','storyLog.js','taleRules.js'];
const source='const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({readyHero,hostileEncounterGame,newAdventure,appendStoryLog,withDeeds,taleSummary,taleText,wrapWords})',{AsyncStorage:{}});
const kara=r.readyHero('fighter');
// A tale just begun.
let g=r.hostileEncounterGame(kara,r.newAdventure(kara),()=>0);
let s=r.taleSummary(g,kara);
assert.equal(s.name,kara.name);assert.equal(s.heroLine,'Level 1 · '+(kara.species??kara.race)+' · Fighter');assert.equal(s.title,g.story.title);
same(s.lines,[],'the opening line of the log is the tale itself, not an event');same(s.deeds,[]);
same(s.stats,{places:2,people:2,fights:0,won:0,gold:s.stats.gold},'the Skirmish opens with two places seen');assert.ok(Number.isInteger(s.stats.gold));
let text=r.taleText(s);assert.ok(text.startsWith(kara.name+', level 1')&&text.includes('“'+g.story.title+'”')&&text.includes('Played in Questbound'));
assert.ok(!text.includes('The story so far')&&!text.includes('Deeds:'),'nothing to tell yet is left out');
// A tale under way: the last six lines, the deeds, the figures, a chapter.
let log=g.storyLog;for(const [kind,t] of [['fight','Fought the raider at Caravan Camp.'],['victory','Slew the raider.'],['place','Found Gallows Ford.'],['person','Met Harlan Voss, a ferryman.'],['loot','Gained 30 gold.'],['travel','Reached Gallows Ford for the first time.'],['rest','Took a long rest at Gallows Ford.'],['deed','You won Harlan Voss over.']])log=r.appendStoryLog(log,kind,t);
const under=r.withDeeds({...g,stage:'inn',enemyHP:0,storyLog:log,map:{...g.map,visited:['inn','bridge','p1']},story:{...g.story,chapters:[{title:'The Road',goal:'Go.',turn:'x'},{title:'The Ford',goal:'Cross.',turn:'y'}],chapter:1}},kara).game;
s=r.taleSummary(under,kara);
assert.equal(s.lines.length,6);assert.equal(s.lines[0],'Found Gallows Ford.');assert.equal(s.lines.at(-1),'You won Harlan Voss over.');
same(s.deeds.map(d=>d.title),['First Blood']);assert.equal(s.chapter,'Chapter 2 of 2');
same(s.stats,{places:3,people:3,fights:1,won:1,gold:s.stats.gold});
text=r.taleText(s,{origin:'https://play.example'});
assert.ok(text.includes('(chapter 2 of 2)')&&text.includes('The story so far:\n• Found Gallows Ford.')&&text.includes('Deeds: First Blood.')&&text.includes('3 places, 3 people met, 1 of 1 fights won')&&text.endsWith('https://play.example'));
// A finished tale and a fallen hero.
assert.equal(r.taleSummary({...under,story:{...under.story,status:'complete'}},kara).chapter,'The tale is told');
const fallen=r.taleSummary({...under,stage:'dead',death:{cause:'Slain by the raider.',place:'Gallows Ford'}},kara);
assert.equal(fallen.dead,true);assert.equal(fallen.cause,'Slain by the raider.');assert.ok(r.taleText(fallen).includes('Here lies '+kara.name+': Slain by the raider.'));
// Long lines are clipped, and words wrap to a width.
const long=r.taleSummary({...under,storyLog:r.appendStoryLog(log,'loot','Got '+'a very long list of things, '.repeat(8)+'and a hat.')},kara);assert.ok(long.lines.at(-1).length<=110&&long.lines.at(-1).endsWith('…'));
same(r.wrapWords('The quick brown fox jumps over the lazy dog',15),['The quick brown','fox jumps over','the lazy dog']);
same(r.wrapWords('Supercalifragilistic word',5),['Supercalifragilistic','word'],'a word wider than the line still gets a line');
same(r.wrapWords('',10),[]);
// Nothing at all.
assert.equal(r.taleSummary(null,null).name,'A hero');
// The screens: the sheet paints the card with the portrait and scene already painted, and opens from the Log and the Deeds.
const sheet=fs.readFileSync('ShareTale.js','utf8'),card=fs.readFileSync('taleCard.js','utf8'),play=fs.readFileSync('Adventure.js','utf8');
assert.ok(sheet.includes('renderTaleCard(summary,{portrait,scene})')&&sheet.includes('cachedArt(heroArtSubject(hero))')&&sheet.includes('shareTale(blob,card.summary)'));
assert.ok(card.includes("canvas.width=width")&&card.includes("nav.share({files:[file]")&&card.includes("a.download='questbound-tale.png'")&&card.includes('getPropertyValue'),'colours are resolved from the theme variables');
assert.equal((play.match(/setSharing\(true\)/g)||[]).length,2,'the Log header and the Deeds panel both open the sheet');assert.ok(play.includes('<ShareTale visible={sharing}'));
console.log('Tale card: the hero, the tale, the last six lines, the deeds and the figures from the save alone; words that read well; wrapped lines; shared from the Log and the Deeds.');
