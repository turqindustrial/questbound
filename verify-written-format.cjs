// The written-tale format (WRITTEN-TALES.md, stagingRules.js, check-written-tale.cjs; the build specification's Phase
// B, "Freeze the format first"): the fixture tale (written-fixture.json) passes the authoring checker against
// libraries made here (so the check needs none of the host's data), broken variants of it fail for the right reason,
// stories from before stay valid, tidying cuts nothing a writer staged, the validators of game.pace and the written
// tag hold, the name resolver works and is memoised, the vocabularies are the ones the format document describes, and
// the new top-level names are unique among the rules (verify-rules-engine.cjs checks the same for every file).
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const {rulesFiles,helperFiles,rulesSource,readText}=require('./rules-files.cjs'),{journeyStory}=require('./journey-fixtures.cjs');
const {checkTale,subclassNames}=require('./check-written-tale.cjs');
const r=vm.runInNewContext(rulesSource()+'\n;({readyHero,newAdventure,freshStoryGame,tidyStory,validStory,validAdventure,adventureSnapshot,validStaging,stagingProblems,validPace,validWrittenTag,stagingIds,stagingNamesUsed,stagingConditionKinds,stagingEffectKinds,paceDueKinds,stagingMechanical,stagingPacing,writtenLengths,stagingNameKey})',{AsyncStorage:{},console},{timeout:10000});
const fixture=JSON.parse(fs.readFileSync('written-fixture.json','utf8'));
const clone=v=>JSON.parse(JSON.stringify(v));
const kara=r.readyHero('fighter');

// ---------- Libraries made here: every creature picture of the catalogue, every place kind in every land, and a few
// people of the people library's shape (the checker reads only library.json) ----------
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qb-written-format-'));
const dir=name=>{const d=path.join(tmp,name);fs.mkdirSync(d,{recursive:true});return d;};
const {catalogue}=require('./creature-library.cjs'),places=require('./place-library.cjs');
const creatures=dir('creatures'),wolvesOnly=dir('wolves-only'),placeArt=dir('places'),people=dir('people'),emptyShelf=dir('shelf-empty');
fs.writeFileSync(path.join(creatures,'library.json'),JSON.stringify(catalogue.pictures.map(p=>({id:p.id,file:p.id+'.jpg'}))));
fs.writeFileSync(path.join(wolvesOnly,'library.json'),JSON.stringify(catalogue.pictures.filter(p=>p.kind==='wolf').map(p=>({id:p.id,file:p.id+'.jpg'}))));
fs.writeFileSync(path.join(placeArt,'library.json'),JSON.stringify(places.placeKinds.flatMap(k=>places.terrains.map(t=>({id:k+'-'+t+'-1',kind:k,terrain:t,file:k+'-'+t+'-1.jpg'}))).filter(e=>/^[a-z]{3,12}-[a-z]{4,10}-\d{1,2}$/.test(e.id))));
const wenna={id:'np001',name:'Wenna Corbet',gender:'woman',species:'Human',age:'old',role:'Camp cook and keeper of stores',class:null,appearance:'A thin, wiry old woman with flour on her sleeves, a red kerchief over white hair and a ladle she carries like a club.'};
fs.writeFileSync(path.join(people,'library.json'),JSON.stringify([wenna,{id:'np002',name:'Orrick Vantle',gender:'man',species:'Dwarf',age:'adult',role:'A miner',class:'Fighter',appearance:'A broad dwarf with a soot-black beard and a dented helm.'}]));
const libs={people,creatures,places:placeArt,shelf:emptyShelf};
// Every place kind the format uses has a picture in every land here (the checker's own place check is tested with it).
assert.equal(places.kindTerrainComplete(JSON.parse(fs.readFileSync(path.join(placeArt,'library.json'),'utf8'))),true,'the test place library is complete');

// Writes a tale to a fresh folder (under its slug's name unless told) and checks it.
let n=0;
function check(tale,{name,options={}}={}){const d=dir('tale-'+(++n)),file=path.join(d,name??((typeof tale.slug==='string'&&/^[a-z0-9-]{3,28}$/.test(tale.slug)?tale.slug:'bad')+'.json'));fs.writeFileSync(file,JSON.stringify(tale,null,1));return checkTale(file,{...libs,...options});}
const show=rep=>rep.errors.map(e=>'  '+e.check+' '+e.where+': '+e.message).join('\n');

// ---------- 1. The fixture passes, seated for every ready-made hero and party ----------
{
 const rep=check(fixture);
 assert.ok(rep.ok,'the fixture tale passes the checker:\n'+show(rep));
 assert.deepEqual(rep.seated,{heroes:12,parties:4,tried:4},'four ready-made heroes at three levels, parties of 2 and 4 at the lowest and highest');
 assert.equal(rep.warnings.length,0,'no warnings with the test libraries:\n'+rep.warnings.map(w=>w.where+': '+w.message).join('\n'));
 for(const k of [5,8,9])assert.equal(rep.checks[k].status,'todo','check '+k+' waits for the staging engine and says so');
 assert.ok(rep.todo.every(t=>/^TODO\((?:walkthroughs|balance|experience)\)/.test(t.message)),'the TODO hooks are marked');
 assert.ok(rep.readingLoad<=900);
 // Its own file name is a warning off the shelf, an error on it.
 const named=check(fixture,{name:'written-fixture.json'});assert.ok(named.ok&&named.warnings.some(w=>w.where==='slug'),'a draft may have any file name (a warning)');
 const shelved=check(fixture,{name:'wrong.json',options:{shelf:path.join(tmp,'tale-'+(n+1))}});assert.ok(!shelved.ok&&shelved.errors.some(e=>e.where==='slug'),'on the shelf a tale is <slug>.json');
}

// ---------- 2. Broken variants fail, each for its own reason ----------
const st=t=>t.story.staging,ch=(t,i)=>t.story.staging.chapters[i];
// The cook cast from the library as Wenna Corbet (np001), everywhere the tale names her.
const castWenna=t=>{const cast=JSON.parse(JSON.stringify(t).replace(/Hester Gale/g,'Wenna Corbet'));Object.assign(cast.story.residents[1],{pool:'np001',species:'Human',gender:'woman',appearance:wenna.appearance});return cast;};
const variants=[
 ['a story field set by the game',t=>{t.story.errand={title:'x'};},1,/story\.errand/,/no errand/],
 ['foe stats written',t=>{t.story.foeStats={};},1,/story\.foeStats/,/must not be written/],
 ['a people\'s view of the hero written',t=>{t.story.residents[0].regard={stance:'wary',reason:'No.'};},1,/regard/,/must not be written/],
 ['an unknown file key',t=>{t.price=3;},1,/^price$/,/unknown key/],
 ['a bad slug',t=>{t.slug='Kettle Camp';},1,/^slug$/,/lower-case/],
 ['minutes outside the tier',t=>{t.minutes=[30,90];},1,/^minutes$/,/30 to 60/],
 ['a Start here tale that is not gentle',t=>{t.firstTale=true;t.difficulty='hard';},1,/^firstTale$/,/gentle short/],
 ['an opening over 450 characters',t=>{t.story.opening='The wind is cold. '.repeat(26)+'What do you do?';},1,/story\.opening/,/450/],
 ['a chapter turn over 200 characters',t=>{t.story.chapters[0].turn='The trail was laid on purpose. '.repeat(8);},1,/chapters\[0\]\.turn/,/200/],
 ['an introduction field over half its limit',t=>{t.story.introduction.first='Take the lantern and go after the wolf at the Log Slide, just south of the camp, before it drags the sack into the stream.';},1,/introduction\.first/,/120/],
 ['three opening lines',t=>{t.story.openingDialogue.push({speakerId:'keeper',text:'Hurry!'});},1,/openingDialogue/,/1 or 2/],
 ['text cut short',t=>{t.story.premise=t.story.premise.replace(/\.$/,' and so');},1,/story\.premise/,/full sentence/],
 ['staging text cut short',t=>{ch(t,0).agenda='Corran Stell lays offal each dusk…';},1,/chapters\[0\]\.agenda/,/full sentence/],
 ['a misspelt staging key',t=>{ch(t,0).beats[0].whenn=ch(t,0).beats[0].when;},1,/beats\[0\]/,/unknown key "whenn"/],
 ['an unknown condition',t=>{ch(t,0).found.any[0]={arrive:'The Old Sawpit'};},1,/found\.any\[0\]/,/unknown condition "arrive"/],
 ['an unknown effect',t=>{ch(t,0).beats[0].then={teleport:'Kettle Camp'};},1,/then/,/unknown effect "teleport"/],
 ['a condition with two keys',t=>{ch(t,0).found.any[0]={reach:'The Old Sawpit',clear:'The Log Slide'};},1,/found\.any\[0\]/,/exactly one key/],
 ['a last pressure step that does not close the chapter',t=>{ch(t,0).pressure[2].then={};},1,/pressure\[2\]\.then/,/advance/],
 ['the last chapter closing with advance',t=>{ch(t,1).pressure[2].then={advance:true};},1,/chapters\[1\]\.pressure\[2\]/,/end/],
 ['end outside the last chapter',t=>{ch(t,0).pressure[1].then={end:'late'};},1,/chapters\[0\]\.pressure\[1\]\.then\.end/,/last chapter/],
 ['advance in a chapter\'s own then',t=>{ch(t,0).then={advance:true};},1,/chapters\[0\]\.then\.advance/,/may not close/],
 ['a staging chapter missing',t=>{st(t).chapters.pop();},1,/staging\.chapters/,/exactly one entry/],
 ['an opening on the first chapter',t=>{ch(t,0).opening={tell:'It begins.',line:'It begins.'};},1,/chapters\[0\]\.opening/,/first chapter has no opening/],
 ['a mark of an unknown option',t=>{st(t).endings[0].if={mark:{stell:'flee'}};},1,/endings\[0\]\.if\.mark/,/no option "flee"/],
 ['a flag nobody sets',t=>{st(t).endings[1].if={flag:'burned'};},1,/endings\[1\]\.if\.flag/,/no effect sets/],
 ['the late flag set by hand',t=>{ch(t,0).beats[0].then.flag='late';},1,/then\.flag/,/set by \{"end": "late"\} only/],
 ['a told of no beat',t=>{st(t).endings[1].if={told:'b9'};},1,/endings\[1\]\.if\.told/,/no beat/],
 ['a default ending with a condition',t=>{st(t).endings[2].if={foe:'slain'};},1,/endings\[2\]\.if/,/default/],
 ['one ending only',t=>{st(t).endings=[st(t).endings[2]];},1,/staging\.endings/,/2 to 4/],
 ['an id used twice',t=>{ch(t,1).beats[0].id='b1';},1,/beats\[0\]\.id/,/used twice/],
 ['a stake that does not exist',t=>{ch(t,0).beats[0].then={stake:{s3:'gone'}};},1,/then\.stake/,/no stake/],
 ['a lead that does not exist',t=>{st(t).leads[0].id='l2';},1,/leads\[0\]\.id/,/story's leads/],
 ['an ally of the same kind',t=>{ch(t,0).fight.threat.ally={template:'wolf',name:'Another Wolf',appearance:'A second grey wolf with a black muzzle.'};},1,/threat\.ally\.template/,/different kind/],
 ['a pack as an ally',t=>{ch(t,0).fight.threat.ally={template:'wolves',name:'The Pack',appearance:'Two grey wolves running low.'};},1,/threat\.ally\.template/,/single creature/],
 ['four lines of firstSay',t=>{st(t).firstSay.push('Wait.');},1,/firstSay/,/1 to 3/],
 ['a resident living nowhere',t=>{t.story.residents[2].at='The Mill Pond';},2,/residents\[2\]\.at/,/no place/],
 ['a third resident at the start',t=>{t.story.residents[2].at='Kettle Camp';},2,/residents\[2\]/,/at|seated/],
 ['an unnoticed resident at the start',t=>{t.story.residents[1].noticed=false;},2,/residents\[1\]\.noticed/,/nobody at the start/],
 ['an opening line from someone elsewhere',t=>{t.story.openingDialogue[1].speakerId='resident3';},2,/openingDialogue/,/only 1 of 2/],
 ['text the game would tidy',t=>{t.story.chapters[0].title='The  Log Slide';},2,/story\.chapters/,/changed when tidied/],
 ['a name that resolves to nothing',t=>{ch(t,0).found.any[0]={reach:'The Mill Pond'};},3,/found\.any\[0\]\.reach/,/no place of this tale/],
 ['a person who does not exist',t=>{ch(t,1).beats[0].then={bring:'Ada Quill'};},3,/then\.bring/,/no person of this tale/],
 ['two places with one name',t=>{t.story.landmarks[1].name='the log slide';},3,/landmarks\[1\]/,/used twice/],
 ['the foe as a resident',t=>{t.story.residents[3].name='Corran Stell';},3,/story\.foe/,/never also keeper, mara or a resident/],
 ['a name on the avoid list',t=>{t.story.residents[0].name='Dob Venn';},3,/residents\[0\]/,/avoid list/],
 ['a place of glass',t=>{t.story.landmarks[1].name='Fernglass Spring';},3,/landmarks\[1\]/,/glass/],
 ['a name from another book',t=>{t.story.landmarks[1].name='The Grave Spring';},3,/landmarks\[1\]/,/deny list/],
 ['another publisher\'s world',t=>{t.story.premise=t.story.premise.replace('Ollerby Wood, named','Ollerby Wood above the Underdark, named');},3,/^tale$/,/another publisher/],
 ['the word reeve',t=>{t.story.npcs.keeper.role='The camp reeve, who hires the cutters and keeps the camp\'s purse.';},3,/^tale$/,/reeve/],
 ['a ready-made hero\'s name',t=>{t.story.residents[0].name='Dob Thistledown';},3,/residents\[0\]/,/ready-made hero/],
 ['a pool not in the library',t=>{t.story.residents[1].pool='np077';},3,/residents\[1\]\.pool/,/not in the people library/],
 ['a pool under another name',t=>{Object.assign(t.story.residents[1],{pool:'np001'});},3,/residents\[1\]\.name/,/library's name/],
 ['a pool of another gender',t=>{Object.assign(t.story.residents[1],{pool:'np001',name:'Wenna Corbet',gender:'man'});},3,/residents\[1\]\.gender/,/library's gender/],
 ['a library person\'s name without the pool',t=>{t.story.residents[1].name='Wenna Corbet';},3,/residents\[1\]\.name/,/people library: cast them/],
 ['one find route only',t=>{ch(t,0).found.any=[{reach:'The Old Sawpit'}];},4,/chapters\[0\]\.found/,/two routes/],
 ['no mechanical route',t=>{ch(t,0).found.any=[{spoke:{who:'Dob Harker',times:2}},{met:'Hester Gale'}];},4,/chapters\[0\]\.found/,/settles from what happened/],
 ['talk alone as a route',t=>{ch(t,0).found.any.push({spoke:{who:'Dob Harker',times:3}});},4,/found\.any\[3\]/,/talk never stands alone/],
 ['four pressure steps in a short tale',t=>{ch(t,0).pressure.unshift({id:'p0',tell:'The fire burns low.',sign:'The fire is low.',line:'The fire burns low.',then:{}});},4,/chapters\[0\]\.pressure/,/3 to 3/],
 ['two lines of firstSay',t=>{st(t).firstSay.pop();},4,/firstSay/,/exactly three/],
 ['a staging of another length',t=>{st(t).length='medium';},4,/staging\.length/,/match/],
 ['no first fight',t=>{delete ch(t,0).fight;ch(t,0).found.any[2]={all:[{reach:'The Log Slide'},{spoke:{who:'Dob Harker',times:2}}]};ch(t,0).beats[0].when={reach:'The Log Slide'};ch(t,0).found.any[1]={reach:'Fernmoot Spring'};},4,/chapters\[0\]\.fight/,/set piece/],
 ['a first fight too far away',t=>{t.story.landmarks[0].miles=0.8;},4,/chapters\[0\]\.fight\.at/,/0\.1 to 0\.3/],
 ['a fight at a starting place',t=>{ch(t,0).fight.at='The Old Sawpit';},4,/fight\.at/,/never at one of the three starting places/],
 ['a clear where nothing is fought',t=>{ch(t,0).found.any[2]={all:[{clear:'Fernmoot Spring'},{spoke:{who:'Dob Harker',times:2}}]};},4,/clear/,/has no fight/],
 ['a landmark too far for a short tale',t=>{t.story.landmarks[1].miles=1.6;},4,/story\.landmarks/,/within 1 mile/],
 ['a far land in a short tale',t=>{t.story.lands=[{name:'The Saltmeadow',terrain:'coast',bearing:'E',miles:40,place:{name:'Gull Quay',description:'A quay of tarred timber where the fishing boats tie up.',kind:'water'},rumour:'They say the poacher sells his hides there.'}];},4,/story\.lands/,/0 to 0 far lands/],
 ['too many people for a short tale',t=>{for(const k of ['A','B'])t.story.residents.push({...t.story.residents[2],name:'Ossory Fenwick '+k,at:'The Deer-Park Wall'});},4,/story\.residents/,/4 to 7 people/],
 ['a cast who is not of a common people',t=>{t.story.residents[2].species='Moth-Folk';},6,/residents\[2\]\.species/,/thirteen common peoples/],
 ['a digit in what the game tells',t=>{ch(t,0).pressure[0].tell='Wolves howl close among the trees, and 2 of the cutters begin loading their cart.';},7,/pressure\[0\]\.tell/,/digits/],
 ['a rule word in what the game tells',t=>{ch(t,0).pressure[1].line='A wolf circles the camp until the next round of howling.';},7,/pressure\[1\]\.line/,/rule words/],
 ['an opening that asks nothing',t=>{t.story.opening='Night at Kettle Camp, deep in Ollerby Wood. The cook-fire under the great iron kettle is the only light, and a grey wolf has just dragged the last good sack of meal into the dark toward the log slide.';},7,/story\.opening/,/demand or a question/],
 ['too much to read before the first move',t=>{t.story.openingDialogue[0].text='It went down toward the log slide, and I have seen it there before, three nights running, always at the same hour. '.repeat(2).trim();},7,/^story$/,/reading before the first move/],
 ['an overused word',t=>{t.story.premise=t.story.premise.replace('Tonight','The camp ledger is short. Tonight');t.story.secret=t.story.secret.replace('He wants','His ledger says it all. He wants');},7,/^tale$/,/"ledger" appears 2 times/],
 ['a walkthrough without every ending',t=>{delete t.walkthrough.endings.gone;},5,/walkthrough\.endings/,/no path to the ending "gone"/],
 ['a walkthrough step to nowhere',t=>{t.walkthrough.golden.steps[0]={go:'The Mill Pond'};},5,/golden\.steps\[0\]\.go/,/no place/],
 ['a walkthrough step of two kinds',t=>{t.walkthrough.golden.steps[1]={fight:true,search:true};},5,/golden\.steps\[1\]/,/exactly one/],
 ['a walkthrough choice of no option',t=>{t.walkthrough.golden.steps[6]={choose:{stell:'flee'}};},5,/golden\.steps\[6\]\.choose/,/no choice/],
];
for(const [name,mutate,checkNo,where,message] of variants){
 const t=clone(fixture);mutate(t);
 const rep=check(t);
 assert.ok(!rep.ok,name+': the checker should fail it');
 assert.ok(rep.errors.some(e=>e.check===checkNo&&where.test(e.where)&&message.test(e.message)),name+': expected a check '+checkNo+' error at '+where+' saying '+message+', got:\n'+show(rep));
}
// A creature nothing in the creature library fits is painted (costs money): refused.
{const rep=check(fixture,{options:{creatures:wolvesOnly}});assert.ok(!rep.ok&&rep.errors.some(e=>e.check===6&&/pressure\[0\]\.then\.arm/.test(e.where)&&/nothing in the creature library fits "The Old Park Boar"/.test(e.message)),'a boar where the library has only wolves:\n'+show(rep));}
// A hoard too rare for the tale's lowest level is a warning: the game gives a lower hero another item.
{const t=clone(fixture);t.story.hoard.item='ring-of-protection';const rep=check(t);assert.ok(rep.ok&&rep.warnings.some(w=>w.check===4&&w.where==='story.hoard.item'&&/rare: a hero at level 1/.test(w.message)),'a rare hoard in a tale from level 1 warns');}
// A cast from the library keeps its name, species, gender and look: then it passes, and is reported.
{const t=castWenna(clone(fixture));const rep=check(t);assert.ok(rep.ok,'a pool kept as the library has it passes:\n'+show(rep));assert.deepEqual(rep.pools,['np001']);}
// Libraries that are not there make the check fail rather than pass blind.
{const rep=check(fixture,{options:{people:path.join(tmp,'nowhere')}});assert.ok(!rep.ok&&rep.errors.some(e=>e.check===3&&e.where==='--people'),'no people library, no pass');}

// ---------- 3. The shelf: names, pools, cover and variety are the shelf's own ----------
{
 const minimal=(over={})=>({format:1,id:'2f9d6a10-3b7c-4e1a-8c55-90ab12cd34ef',slug:'other-tale',edition:1,order:20,listed:true,addedAt:'2026-10-22',length:'short',difficulty:'steady',party:'any',shape:{engine:'river-heist',twist:'twin-forger',endings:['caper']},
  story:{title:'The Tide-Mill Job',region:'The Saltings',terrain:'coast',foe:'Jessop Varne',locations:{inn:{name:'Tide-Mill Quay',kind:'water'},bridge:{name:'The Sluice House'},tower:{name:'The Grain Loft'}},landmarks:[{name:'The Eel Weir'}],lands:[],npcs:{keeper:{name:'Abel Crossway'},mara:{name:'Senna Rook'}},residents:[{name:'Tamsin Hale'}]},...over});
 const shelfWith=(...tales)=>{const d=dir('shelf-'+(++n));tales.forEach((t,i)=>fs.writeFileSync(path.join(d,t.slug+'.json'),JSON.stringify(t)));return d;};
 const pass=check(fixture,{options:{shelf:shelfWith(minimal())}});assert.ok(pass.ok,'a shelf of other tales:\n'+show(pass));
 const cases=[
  ['a place name already on the shelf',minimal({story:{...minimal().story,landmarks:[{name:'Kettle Camp'}]}}),3,/story\.locations\.inn/,/already a place in other-tale\.json/],
  ['a name part already on the shelf',minimal({story:{...minimal().story,residents:[{name:'Dob Wyck'}]}}),3,/residents\[0\]/,/shares "dob"/],
  ['a pool already cast on the shelf',minimal({story:{...minimal().story,residents:[{name:'Somebody Else',pool:'np001'}]}}),3,/residents\[1\]\.pool/,/already cast/],
  ['the same cover',minimal({story:{...minimal().story,terrain:'forest',locations:{...minimal().story.locations,inn:{name:'Tide-Mill Quay',kind:'camp'}}}}),6,/locations\.inn\.kind/,/cover/],
  ['the same engine in the tier',minimal({shape:{engine:'camp-defence',twist:'other',endings:['x']}}),4,/shape\.engine/,/already the engine/],
  ['the same twist in the tier',minimal({shape:{engine:'other',twist:'baited-pack',endings:['x']}}),4,/shape\.twist/,/already the twist/],
  ['the same kinds of ending in the tier',minimal({shape:{engine:'other',twist:'other',endings:['exodus','battle','bargain']}}),4,/shape\.endings/,/same kinds of ending/],
  ['a second Start here tale',minimal({firstTale:true}),4,/firstTale/,/already the Start here/],
  ['the same id under another slug',minimal({id:fixture.id}),4,/^id$/,/also the id/],
 ];
 for(const [name,other,checkNo,where,message] of cases){
  let t=clone(fixture);if(name==='a second Start here tale')t.firstTale=true;if(name==='a pool already cast on the shelf')t=castWenna(t);
  const rep=check(t,{options:{shelf:shelfWith(other)}});
  assert.ok(rep.errors.some(e=>e.check===checkNo&&where.test(e.where)&&message.test(e.message)),name+': expected a check '+checkNo+' error at '+where+' saying '+message+', got:\n'+show(rep));
 }
 // The tale itself on the shelf (checked again after it went live) is never compared with itself.
 const self=shelfWith(fixture);fs.renameSync(path.join(self,'kettle-camp.json'),path.join(self,'kettle-camp.json'));
 const again=checkTale(path.join(self,'kettle-camp.json'),{...libs,shelf:self});assert.ok(again.ok,'a tale on the shelf passes against its own shelf:\n'+show(again));
}

// ---------- 4. The command line: exit 0 on a pass, 1 on a failure, a report people can read and JSON ----------
{
 const args=['--people',people,'--creatures',creatures,'--places',placeArt,'--shelf',emptyShelf];
 const ok=spawnSync(process.execPath,['check-written-tale.cjs','written-fixture.json',...args],{encoding:'utf8'});
 assert.equal(ok.status,0,ok.stdout+ok.stderr);assert.match(ok.stdout,/PASS/);assert.match(ok.stdout,/5 Walkthroughs \.+ TODO/);
 const json=spawnSync(process.execPath,['check-written-tale.cjs','written-fixture.json','--json',...args],{encoding:'utf8'});
 const parsed=JSON.parse(json.stdout);assert.equal(parsed.ok,true);assert.equal(parsed.checks['2'].status,'pass');
 const t=clone(fixture);ch(t,0).found.any=[{reach:'The Old Sawpit'}];const file=path.join(dir('cli'),'kettle-camp.json');fs.writeFileSync(file,JSON.stringify(t));
 const bad=spawnSync(process.execPath,['check-written-tale.cjs',file,...args],{encoding:'utf8'});
 assert.equal(bad.status,1);assert.match(bad.stdout,/FAIL/);assert.match(bad.stdout,/x story\.staging\.chapters\[0\]\.found: needs at least two routes/);
 assert.equal(spawnSync(process.execPath,['check-written-tale.cjs'],{encoding:'utf8'}).status,1,'no tale named: usage, exit 1');
 assert.equal(spawnSync(process.execPath,['check-written-tale.cjs',path.join(tmp,'missing.json'),...args],{encoding:'utf8'}).status,1,'a tale that cannot be read fails');
}

// ---------- 5. Stories from before stay valid; validStory takes the new fields as the specification says ----------
{
 for(let i=0;i<12;i++){const g=r.freshStoryGame(kara,journeyStory(i),r.newAdventure(kara));assert.ok(r.validStory(g.story)&&r.validAdventure(r.adventureSnapshot(kara,g,null,true),kara),'ready journey '+i+' as before');assert.equal(g.story.staging,undefined);}
 const seated=r.freshStoryGame(kara,{...clone(fixture.story),id:'v-1',status:'active',libraryId:fixture.id,artId:'journey-'+fixture.id,written:{slug:fixture.slug,edition:1,length:'short'}},r.newAdventure(kara));
 const s=seated.story;
 assert.ok(r.validStory(s),'a written tale\'s copy is a valid story');
 assert.equal(r.validStory({...s,staging:undefined}),true,'staging is optional');
 assert.equal(r.validStory({...s,foeVoice:undefined,written:undefined}),true,'so are foeVoice and written');
 assert.equal(r.validStory({...s,staging:{}}),false,'a staging must be sound');
 assert.equal(r.validStory({...s,staging:{...s.staging,chapters:s.staging.chapters.slice(0,1)}}),false,'one staging chapter per story chapter');
 assert.equal(r.validStory({...s,staging:{...s.staging,v:2}}),false,'this build reads staging version 1');
 assert.equal(r.validStory({...s,foeVoice:'x'.repeat(301)}),false,'foeVoice is at most 300 characters');
 assert.equal(r.validStory({...s,foeVoice:'  '}),false);
 for(const w of [{slug:'kettle-camp',edition:1,length:'short'},{slug:'abc',edition:999,length:'long'}])assert.equal(r.validWrittenTag(w),true,JSON.stringify(w));
 for(const w of [null,{},{slug:'Kettle',edition:1,length:'short'},{slug:'kettle-camp',edition:0,length:'short'},{slug:'kettle-camp',edition:1,length:'epic'},{slug:'k',edition:1,length:'short'}])assert.equal(r.validWrittenTag(w),false,JSON.stringify(w));
 assert.equal(r.validStory({...s,written:{slug:'kettle-camp',edition:1}}),false,'a written tag must be whole');
 // An older reader ignores keys it does not know inside the staging (validStaging) but the checker reports them.
 const extra={...s,staging:{...s.staging,later:true,chapters:s.staging.chapters.map(c=>({...c,cue:'x'}))}};
 assert.equal(r.validStaging(extra),true,'unknown staging keys are ignored by the game');
 assert.ok(r.stagingProblems(extra,{strict:true}).some(p=>/unknown key "later"/.test(p))&&r.stagingProblems(extra,{strict:true}).some(p=>/unknown key "cue"/.test(p)),'and reported by the checker');
 // tidyStory keeps a writer's staging and the foe's voice exactly as written (it rebuilds only chapters and leads).
 const written={...clone(fixture.story),id:'t-1',status:'active'},{residents,errand,openingDialogue,...told}=written,tidied=r.tidyStory(clone(told)).story;
 assert.deepEqual(tidied.staging,fixture.story.staging,'tidyStory cuts no staging text');
 assert.equal(tidied.foeVoice,fixture.story.foeVoice,'nor the foe\'s voice');
 const long={...clone(told),staging:{...clone(told.staging),chapters:told.staging.chapters.map(c=>({...c,where:c.where+' '+'More words here. '.repeat(20)}))}};
 assert.deepEqual(r.tidyStory(clone(long)).story.staging,long.staging,'not even text over its limit: the validator refuses it instead of anything cutting it');
 assert.equal(r.validStaging(r.tidyStory(clone(long)).story),false);
}

// ---------- 6. game.pace ----------
{
 const g=r.freshStoryGame(kara,{...clone(fixture.story),id:'p-1',status:'active'},r.newAdventure(kara));
 const pace={v:1,ch:0,turns:0,quiet:0,since:0,step:0,owed:0,day:0,due:null,told:[],fired:[],marks:{},flags:[],stakes:{},spoke:{},sign:null,fight:null,ending:null,quietMax:0};
 assert.equal(r.validPace(pace,g),true,'a fresh pace');
 const busy={...pace,ch:1,turns:31,quiet:4,since:6,step:2,owed:1,day:1,due:{kind:'beat',id:'b2'},told:['b1','p1'],fired:['b1','p1','p2','found:1'],marks:{stell:'refuse'},flags:['bargained','late'],stakes:{s1:'two carts loaded to leave'},spoke:{n1:2,keeper:1},sign:'A hunter\'s lantern was seen slipping away toward the Old Sawpit.',fight:{turns:2},ending:'held',quietMax:6};
 assert.equal(r.validPace(busy,g),true,'a pace part way through');
 assert.equal(r.validPace({...busy,later:{x:1}},g),true,'keys a later build adds are ignored (a rollback still loads)');
 assert.equal(r.validAdventure(r.adventureSnapshot(kara,{...g,pace:busy},null,true),kara),true,'validAdventure takes a sound pace');
 assert.equal(r.validAdventure(r.adventureSnapshot(kara,{...g,pace:{...busy,ch:2}},null,true),kara),false,'and refuses a broken one');
 const broken=[['v',2],['ch',2],['step',5],['owed',21],['due',{kind:'surprise'}],['due',{kind:'beat',id:'B 2'}],['told',['b1','b1']],['fired',Array.from({length:81},(_,i)=>'x'+i)],['marks',{stell:'flee'}],['marks',{nobody:'refuse'}],['flags',Array.from({length:25},(_,i)=>'f'+i)],['stakes',{s3:'gone'}],['stakes',{s1:'x'.repeat(81)}],['spoke',{n999:1}],['sign','x'.repeat(121)],['fight',{}],['ending','nowhere'],['quietMax',-1]];
 for(const [k,v] of broken)assert.equal(r.validPace({...busy,[k]:v},g),false,'pace.'+k+' = '+JSON.stringify(v).slice(0,40));
 for(const k of Object.keys(pace))if(!['due','sign','fight','ending'].includes(k)){const {[k]:gone,...rest}=busy;assert.equal(r.validPace(rest,g),false,'pace.'+k+' is required');}
 const plainGame=r.freshStoryGame(kara,journeyStory(1),r.newAdventure(kara));
 assert.equal(r.validPace(pace,plainGame),false,'a pace goes only with a staged tale');
 assert.equal(r.validAdventure(r.adventureSnapshot(kara,{...plainGame,pace},null,true),kara),false);
 assert.equal(r.paceDueKinds.join(),'turn,opening,beat,complication,pressure,choice,ending,deadline,bloodied');
}

// ---------- 7. Names to ids for a seated game, memoised ----------
{
 const g=r.freshStoryGame(kara,{...clone(fixture.story),id:'n-1',status:'active'},r.newAdventure(kara)),ids=r.stagingIds(g);
 assert.equal(ids.place('Kettle Camp'),'inn');assert.equal(ids.place('the split oak'),'bridge');assert.equal(ids.place('Old Sawpit'),'tower');
 assert.match(ids.place('The Log Slide'),/^p\d+$/);assert.equal(ids.place('THE  DEER-PARK  WALL'),g.world.places.find(p=>p.name==='The Deer-Park Wall').id);
 assert.equal(ids.person('Mabry Thorne'),'keeper');assert.equal(ids.person('Linnet Spey'),'mara');assert.match(ids.person('Nim Corley'),/^n\d+$/,'hidden people resolve too');
 assert.equal(ids.place('The Mill Pond'),null);assert.equal(ids.person('Corran Stell'),null,'the foe is no person of the tale');
 assert.equal(r.stagingNameKey('  The   Log Slide '),'log slide');assert.equal(r.stagingNameKey('Stell’s Quiet Boots'),"stell's quiet boots");
 // Kept while the story, world and people are the same; worked out again when someone new is met.
 const again=r.stagingIds({...g});assert.equal(again.person('Nim Corley'),ids.person('Nim Corley'));
 const met={...g,people:{...g.people,n9:{...g.people.n1,name:'Ada Quill'}}};assert.equal(r.stagingIds(met).person('Ada Quill'),'n9','a new person resolves once met');assert.equal(r.stagingIds(g).person('Ada Quill'),null);
 const used=r.stagingNamesUsed(g.story.staging);
 assert.ok(used.some(u=>u.kind==='place'&&u.name==='The Old Sawpit')&&used.some(u=>u.kind==='person'&&u.name==='Nim Corley')&&used.some(u=>u.kind==='item'&&u.name==='Strip of Deer Hide'),'every kind of name is collected');
 for(const u of used)if(u.kind!=='item')assert.ok(u.kind==='place'?ids.place(u.name):ids.person(u.name),u.path+' resolves');
}

// ---------- 8. The vocabularies are the format document's, and the names are new ----------
{
 const doc=fs.readFileSync('WRITTEN-TALES.md','utf8');
 assert.equal(r.stagingConditionKinds.join(),'reach,clear,won,searched,checked,spoke,met,with,fate,foe,carry,mark,flag,told,step,rest,days,any,all,not');
 assert.equal(r.stagingEffectKinds.join(),'bring,send,arm,place,stake,give,attitude,offer,fact,lead,flag,decide,advance,end,boss');
 for(const k of [...r.stagingConditionKinds,...r.stagingEffectKinds])assert.ok(doc.includes('{"'+k+'":'),'WRITTEN-TALES.md shows the shape of "'+k+'"');
 for(const k of r.stagingMechanical)assert.ok(r.stagingConditionKinds.includes(k));
 assert.deepEqual(JSON.parse(JSON.stringify(r.stagingPacing)),{short:{quiet:3,drift:8},medium:{quiet:4,drift:10},long:{quiet:5,drift:12}},'the tiers\' pacing (SPEC 1.1)');
 assert.ok(doc.includes('node check-written-tale.cjs')&&doc.includes('written-fixture.json'),'the document says how to check a tale');
 // stagingRules.js comes after every file whose functions its runtime reads, and before nothing that reads its values.
 const at=f=>rulesFiles.indexOf(f);
 for(const f of 'storyRules.js experienceRules.js storyLog.js relationshipRules.js followerRules.js mapRules.js'.split(' '))assert.ok(at('stagingRules.js')>at(f),'stagingRules.js is listed after '+f);
 // Its top-level names are its own (verify-rules-engine.cjs checks every file the same way).
 const names=f=>[...readText(f).matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
 const mine=names('stagingRules.js'),others=new Set([...rulesFiles,...helperFiles].filter(f=>f!=='stagingRules.js').flatMap(names));
 for(const name of ['validStaging','validPace','validWrittenTag','stagingIds','stagingProblems','stagingNamesUsed','stagingConditionKinds','stagingEffectKinds'])assert.ok(mine.includes(name),name+' is defined in stagingRules.js');
 assert.deepEqual(mine.filter(x=>others.has(x)),[],'no other rules or helper file defines the same names');
 assert.ok(!/^(?:export\s+)?(?:const|let)\s+\w+\s*=\s*[^;]*\b(?:templateKeys|attitudeLevels)\b/m.test(readText('stagingRules.js')),'nothing at stagingRules.js\'s top level reads another file\'s values');
 // The checker's copy of the deny list is verify-subclasses.cjs's (book-name guard).
 const theirs=readText('verify-subclasses.cjs').match(/const deny=\[([\s\S]*?)\];/)[1].match(/'(?:[^'\\]|\\.)*'|"[^"]*"/g).map(x=>x.slice(1,-1).replace(/\\'/g,"'"));
 assert.deepEqual([...subclassNames].sort(),[...theirs].sort(),'check-written-tale.cjs keeps verify-subclasses.cjs\'s deny list');
}
fs.rmSync(tmp,{recursive:true,force:true});
console.log('Written-tale format: the fixture passes the checker (12 heroes and 4 parties seated), '+variants.length+' broken variants and 9 shelf clashes fail for their own reasons, the command line exits 0 and 1, stories from before stay valid, tidying cuts no staging, game.pace and the written tag validate, names resolve (memoised), and the vocabularies are the document\'s.');
