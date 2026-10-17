// Portraits and creatures without paying for paintings (2026-10-16, the host's words: "make sure all of those along
// with all of the previously generated images for landscapes are implemented into the game to save API credits").
// Checks: anyone shown with a portrait who is not a player's hero and not from the people library (a tale's keeper and
// mara, its residents, people the Dungeon Master invents, a tale's foe who is a person) gets the face of the library
// person most like them (species and gender, then training, then age, then calling and look), repeatably, one face to
// one person in a tale while another fits, kept for good, never in place of a painting made before, with no painting
// and no usage; heroes, children, ghosts and kinds the library has nobody of are painted as before; a creature of one
// of the game's own kinds is painted once for every tale and player (a Skirmish painting taken over), from the kind's
// own look, never a player's words; a tale's own creature keeps its painting; the Dungeon Master is not offered a
// library person whose face a look-alike already wears; the story writer may cast keeper and mara from the library;
// and a whole tale's people and its foe are shown without a single painting. Stand-in providers only.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {rulesSource,readText}=require('./rules-files.cjs');
const lib=require('./people-library.cjs'),{createArtStore,artKey,validateSubject,creatureTemplates,creatureCampaign,templateSubject,artPrompt}=require('./world-art.cjs');
const r=vm.runInNewContext(rulesSource({extra:['worldArtRules.js']})+'\n({species,classes,templateKeys,readyHero,newAdventure,freshStoryGame,commitDmTurn,validAdventure,adventureSnapshot,validStory,introducePerson,libraryPeopleMet,npcArtSubject,creatureArtSubject,heroArtSubject,heroPaintingSubject,startWildFight,hostileEncounterGame,hostileFoes,joinRegion})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const jpeg=id=>Buffer.concat([Buffer.from([255,216,255,224]),Buffer.from(String(id)),Buffer.from([255,217])]);
const shown=answer=>Buffer.from(String(answer.dataUrl).split(',')[1]??'','base64').toString('latin1');
// A stand-in library: four people of every species and gender (two ordinary, two trained), every age.
const ages=['young','adult','middle-aged','old'],roles=['ferry keeper','miller','herbalist','smith','fisher','scribe','cooper','shepherd'];
const stock=[];
for(const species of lib.speciesList)for(const gender of lib.genderList)for(let k=0;k<4;k++){
 const n=stock.length+1,id='np'+String(n).padStart(3,'0'),cls=k<2?null:lib.classList[(n*7)%lib.classList.length];
 stock.push({id,name:'Person '+'abcdefghijklmnopqrstuvwxyz'[n%26]+'abcdefghijklmnopqrstuvwxyz'[Math.floor(n/26)%26]+' '+id,gender,species,age:ages[(n+k)%4],role:'A '+roles[n%roles.length]+'.',class:cls,appearance:'A '+species.toLowerCase()+' with weathered hands, a grey wool coat and a long scar over one brow, standing easy, number '+n+'.',personality:'Quiet.',motive:'Get by.',voice:'Says little.',hook:'Owes someone a favour, '+id+'.',placeKinds:['settlement'],terrains:['plains'],toughness:'common',attitude:'indifferent'});
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qb-portraits-'));
(async()=>{
 try{
  // ---------- Matching on its own ----------
  same(lib.speciesList,[...r.species],'people-library.cjs keeps characterRules species');same(lib.classList,[...r.classes]);
  assert.equal(lib.speciesOf('A tall half-elf woman'),'Half-Elf');assert.equal(lib.speciesOf('Middle-aged human innkeeper'),'Human');assert.equal(lib.speciesOf('a dark elf'),'Drow');assert.equal(lib.speciesOf('an elven archer'),'Elf');assert.equal(lib.speciesOf('Lizardfolk'),null);
  const of=extra=>lib.lookAlikeOf({kind:'portrait',campaignId:'t',id:'n1',name:'X',description:'A woman, with a woman\'s face. A broad human fishwife with scaled hands.',setting:'',...extra});
  same(of({}).species,['Human']);assert.equal(of({}).gender,'woman');assert.equal(of({species:'Elf'}).species.length,2,'an elf may look like a high or a wood elf');
  assert.equal(of({species:'unknown'}),null,'a kind the library has nobody of is painted');
  assert.equal(of({description:'A thin boy with a reed rod and bare muddy feet.'}),null,'a child is painted');assert.equal(of({role:'A ghost of the old mill.'}),null,'a ghost is painted');
  assert.equal(lib.lookAlikeOf({kind:'creature',campaignId:'t',id:'main-foe',name:'X',description:'A human bandit.',setting:''}),null,'a creature is a person only when it says its species');
  assert.equal(of({description:'An elderly human widow, white-haired.'}).age,'old');assert.equal(of({description:'A young human courier.'}).age,'young');
  {const people=stock,pick=(match,o={})=>lib.choosePortrait(people,{role:new Set(),look:new Set(),age:null,trained:null,gender:'woman',species:['Dwarf'],...match},{campaignId:'tale',personId:'n1',...o});
   const plain=pick({});assert.equal(plain.species,'Dwarf');assert.equal(plain.gender,'woman');assert.equal(plain.class,null,'an ordinary person looks like an ordinary one');
   assert.equal(pick({}).id,plain.id,'the same person draws the same face');
   const cleric=pick({trained:'Cleric'});assert.ok(cleric.class,'a trained person looks like a trained one');
   const clerics=people.filter(e=>e.species==='Dwarf'&&e.gender==='woman'&&e.class);const own=clerics.find(e=>e.class==='Cleric');if(own)assert.equal(cleric.id,own.id,'of their own class first');
   const old=pick({age:'old'}),oldOnes=people.filter(e=>e.species==='Dwarf'&&e.gender==='woman'&&!e.class&&e.age==='old');if(oldOnes.length)assert.equal(old.age,'old','then of their age');
   const second=pick({},{taken:new Set([plain.id])});assert.notEqual(second.id,plain.id,'two people of a tale, two faces');
   const all=new Set(people.filter(e=>e.species==='Dwarf'&&e.gender==='woman').map(e=>e.id));assert.ok(all.has(pick({},{taken:all}).id),'a repeat only once every one of their kind is taken');
   assert.ok(['woman','man','other'].includes(pick({gender:null}).gender),'gender unknown: any of that species');
   assert.equal(lib.choosePortrait(people.filter(e=>e.gender!=='other'),{species:['Gnome'],gender:'other',role:new Set(),look:new Set()}),null,'nobody of that gender: painted, never a face of another');
   const draws=new Set(Array.from({length:30},(_,i)=>pick({},{campaignId:'tale-'+i}).id));assert.ok(draws.size>=2,'tales share the faces out');}
  console.log('Matching: species and gender, then training (their own class first), then age, then calling and look; the same face for the same person, another for the next while one is free; children, ghosts and unknown kinds painted.');
  // ---------- The painter: look-alikes free, kept for good; heroes and paintings made before kept ----------
  const dir=path.join(tmp,'people'),art=path.join(tmp,'art');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(art,{recursive:true});
  for(const e of stock)fs.writeFileSync(path.join(dir,e.id+'.jpg'),jpeg(e.id));
  fs.writeFileSync(path.join(dir,'library.json'),JSON.stringify(stock));
  let paid=0,counted=0;const prompts=[];
  const fetchImpl=async(url,options)=>{paid++;prompts.push(JSON.parse(options.body).input);return {ok:true,json:async()=>({status:'completed',output:[{type:'image_generation_call',status:'completed',result:jpeg('painted').toString('base64')}]})};};
  const open=()=>createArtStore({directory:art,fetchImpl,libraryDirectory:path.join(tmp,'no-places'),creatureDirectory:path.join(tmp,'no-creatures'),peopleLibrary:lib.createPeopleLibrary({directory:dir,refreshMs:0,picksDirectory:path.join(art,'people-picks')})});
  let store=open();const ask=(subject,options={})=>store.request(subject,{apiKey:'test-only',model:'test-model',mayPaint:()=>true,onPainted:()=>counted++,...options});
  const waitPaid=async n=>{for(let i=0;i<200&&paid<n;i++)await new Promise(res=>setTimeout(res,10));};
  const person=(id,extra={})=>({campaignId:'tale-a',kind:'portrait',id,name:'Someone '+id,description:'A woman, with a woman\'s face. A broad fishwife with scaled hands and a red shawl.',setting:'',species:'Human',gender:'woman',role:'A fishwife.',...extra});
  const subject=validateSubject(person('n1',{trained:'Cleric',avoid:['np001','x'],related:'journey-1'}));
  same([subject.species,subject.gender,subject.trained,subject.role,subject.avoid,subject.related],['Human','woman','Cleric','A fishwife.',['np001'],'journey-1'],'only known values are kept');
  assert.equal(artKey(subject),artKey({campaignId:'tale-a',kind:'portrait',id:'n1'}),'none of it changes the art key');
  assert.equal(validateSubject(person('n1',{species:'Lizardfolk'})).species,'unknown');assert.equal(validateSubject({...person('n1'),kind:'landscape'}).species,undefined,'only people carry them');
  const first=await ask(person('n1'),{apiKey:null,mayPaint:()=>false});assert.equal(first.status,'ready');assert.ok(first.library);assert.equal(shown(first).includes(first.library),true,'the library person\'s own portrait');
  const face=stock.find(e=>e.id===first.library);assert.equal(face.species,'Human');assert.equal(face.gender,'woman');assert.equal(face.class,null);
  const others=[];for(let i=2;i<=4;i++)others.push((await ask(person('n'+i))).library);
  assert.equal(new Set([first.library,...others]).size,4,'four Human women of one tale, four faces');
  const fifth=await ask(person('n5'));assert.ok(fifth.library,'a fifth still has a face (a repeat: every one of their kind is taken)');
  assert.equal(paid,0,'no painting');assert.equal(counted,0,'no paid usage recorded');
  store=open();assert.equal((await ask(person('n1'))).library,first.library,'a person never changes face, across restarts');
  const avoided=await ask(person('n6',{campaignId:'tale-b',avoid:[first.library]}));assert.notEqual(avoided.library,first.library,'a library person in the game is never someone else\'s face');
  // A library person shown in a tale is taken; so are the faces of its ready journey's own campaign.
  const pooled=stock.find(e=>e.species==='Dwarf'&&e.gender==='man'&&!e.class);
  await ask({...person('n7',{campaignId:'tale-c',species:'Dwarf',gender:'man',description:'A man. A dwarf.'}),pool:pooled.id});
  const dwarves=[];for(let i=8;i<=9;i++)dwarves.push((await ask(person('n'+i,{campaignId:'tale-c',species:'Dwarf',gender:'man',description:'A man. A dwarf.'}))).library);
  assert.ok(!dwarves.includes(pooled.id),'nobody gets the face of a library person met in the tale');
  same([...await store.people.takenIn(['tale-c'])].sort(),[pooled.id,...dwarves].sort(),'the faces a tale has given');
  const journey=await ask(person('resident-a',{campaignId:'journey-x'}));const copy=await ask(person('n1',{campaignId:'copy-x',related:'journey-x'}));assert.notEqual(copy.library,journey.library,'a copy of a journey avoids the journey\'s own faces');
  // Painted before: kept. Heroes, children and kinds the library has nobody of: painted.
  const old=person('n10',{campaignId:'tale-d'});fs.writeFileSync(path.join(art,artKey(old)+'.jpg'),jpeg('older'));assert.ok(shown(await ask(old)).includes('older'));
  // A hero without a choice is shown a ready-made face (verify-hero-face.cjs); Paint my own paints, once.
  let before=paid;const faced=await ask(r.heroArtSubject(r.readyHero('fighter')));assert.ok(faced.library,'a hero is shown a ready-made face');assert.equal(paid,before,'(free)');
  const hero=r.heroPaintingSubject(r.readyHero('fighter'));assert.equal(hero.species,undefined,'Paint my own carries nothing to match on');assert.equal(hero.face,undefined);
  before=paid;await ask(hero);await waitPaid(before+1);assert.equal(paid,before+1,'the player\'s own hero is painted when they ask');
  before=paid;await ask({...hero,species:'Human',gender:'man'});await new Promise(res=>setTimeout(res,30));assert.equal(paid,before,'(and painted once)');
  before=paid;await ask(person('n11',{campaignId:'tale-d',description:'A thin girl with a reed rod.',role:'A girl fishing.'}));await waitPaid(before+1);assert.equal(paid,before+1,'a child is painted');
  before=paid;await ask(person('n12',{campaignId:'tale-d',species:'Lizardfolk'}));await waitPaid(before+1);assert.equal(paid,before+1,'a kind the library has nobody of is painted');
  // An older client (no species sent): read from the words.
  const words=await ask({campaignId:'tale-e',kind:'portrait',id:'keeper',name:'Hale',description:'A man. Middle-aged dwarf smith with a soot-black beard.',setting:''});assert.equal(stock.find(e=>e.id===words.library).species,'Dwarf');
  // The library's own painter is never answered with a look-alike.
  assert.equal((await ask(lib.portraitSubject(stock[0]),{host:true})).library,undefined);
  console.log('The painter: a look-alike\'s portrait at no cost (no painting, no usage), kept across restarts, never the face of a library person in the tale or of the journey\'s own people; paintings made before kept; heroes, children and unknown kinds painted; older clients matched by their words.');
  // ---------- Creatures of the game's own kinds: painted once for everyone ----------
  {const foes=Object.fromEntries(r.hostileFoes.map(f=>[f.key,{name:f.foe,look:f.appearance}]));same(creatureTemplates,foes,'world-art.cjs keeps hostileEncounter.js hostileFoes (names and looks)');
   same(Object.keys(creatureTemplates).sort(),[...r.templateKeys].sort(),'every template');
   const wolf=(campaignId,extra={})=>({campaignId,kind:'creature',id:'wild-frost-fang',name:'Frost Fang',description:'A creature: Frost Fang. A pale wolf. Paint something rude here.',setting:'',template:'wolf',...extra});
   before=paid;const a=await ask(wolf('tale-1'));assert.equal(a.status,'pending');assert.equal(a.key,artKey(wolf('tale-1')),'answered under the creature\'s own key');await waitPaid(before+1);assert.equal(paid,before+1);
   assert.ok(prompts.at(-1).includes(creatureTemplates.wolf.look)&&!prompts.at(-1).includes('rude'),'painted from the kind\'s own look, never a player\'s words');
   let b;for(let i=0;i<100;i++){b=await ask(wolf('tale-2',{id:'wild-grey-wolf',name:'Grey Wolf'}));if(b.status==='ready')break;await new Promise(res=>setTimeout(res,10));}
   assert.equal(b.status,'ready');assert.equal(paid,before+1,'another tale, another player: the same picture, free');assert.equal(b.key,artKey(wolf('tale-2',{id:'wild-grey-wolf'})));
   // Asked for directly, the shared campaign is painted only from the kind's look; anything else is refused.
   assert.equal(validateSubject(templateSubject('boar')).campaignId,creatureCampaign);await assert.rejects(ask({campaignId:creatureCampaign,kind:'creature',id:'dragon',name:'X',description:'Y',setting:''}));
   before=paid;await ask({campaignId:creatureCampaign,kind:'portrait',id:'boar',name:'X',description:'Something else entirely.',setting:''});await waitPaid(before+1);assert.ok(prompts.at(-1).includes(creatureTemplates.boar.look)&&!prompts.at(-1).includes('Something else'));
   // A Skirmish painting made before is taken over at no cost.
   fs.writeFileSync(path.join(art,artKey({campaignId:'hostile-encounter-wolves',kind:'creature',id:'main-foe'})+'.jpg'),jpeg('skirmish-wolves'));
   before=paid;const pack=await ask({...wolf('tale-3'),template:'wolves',name:'Grey Wolves'});assert.equal(pack.status,'ready');assert.ok(shown(pack).includes('skirmish-wolves'));assert.equal(paid,before);
   // A creature painted for its tale before keeps that painting.
   fs.writeFileSync(path.join(art,artKey(wolf('tale-4'))+'.jpg'),jpeg('own-wolf'));assert.ok(shown(await ask(wolf('tale-4'))).includes('own-wolf'));
   // Bandits are people: the template's own Bandit Cutthroat is shared; a named bandit keeps a painting of their own.
   before=paid;await ask({campaignId:'tale-5',kind:'creature',id:'wild-red-maddock',name:'Red Maddock',description:'A creature: Red Maddock. A rangy bandit with a red scarf.',setting:'',template:'bandit'});await waitPaid(before+1);assert.ok(prompts.at(-1).includes('Red Maddock'),'a named bandit is painted as written');
   before=paid;await ask({campaignId:'tale-6',kind:'creature',id:'wild-bandit-cutthroat',name:'Bandit Cutthroat',description:'A creature: Bandit Cutthroat.',setting:'',template:'bandit'});await waitPaid(before+1);assert.ok(prompts.at(-1).includes(creatureTemplates.bandit.look));
   before=paid;await ask({campaignId:'tale-7',kind:'creature',id:'wild-bandit-cutthroat',name:'Bandit Cutthroat',description:'A creature.',setting:'',template:'bandit'});await new Promise(res=>setTimeout(res,30));assert.equal(paid,before,'the second one is free');
   // A tale's own creature foe is painted for that tale; a foe who is a person gets a look-alike.
   before=paid;await ask({campaignId:'tale-8',kind:'creature',id:'main-foe',name:'Siltjaw',description:'A low six-legged burrower.',setting:''});await waitPaid(before+1);assert.equal(paid,before+1);
   before=paid;const queen=await ask({campaignId:'tale-8',kind:'creature',id:'main-foe-2',name:'Morwen',description:'A tall woman in a black coat.',setting:'',species:'Human',gender:'woman'});assert.equal(queen.status,'ready');assert.equal(stock.find(e=>e.id===queen.library).gender,'woman');assert.equal(paid,before);
   before=paid;await ask({campaignId:'tale-8',kind:'creature',id:'main-foe-3',name:'Warden',description:'A tall corpse in bronze.',setting:'',species:'Undead'});await waitPaid(before+1);assert.equal(paid,before+1,'an undead foe is painted');}
  console.log('Creatures: one painting of each of the game\'s own kinds for every tale and player (from the kind\'s look, never a player\'s words; a Skirmish painting taken over); a named bandit and a tale\'s own creature keep their own paintings; a foe who is a person gets a look-alike.');
  // ---------- What the game sends: subjects carry what to match on, never a different key ----------
  const {journeyStory}=require('./journey-fixtures.cjs'),hero1=r.readyHero('fighter'),hp={current:12,temp:0};
  const story={...journeyStory(0),foeSpecies:'Human',foeAppearance:'A tall woman in a black coat with a silver chain, the warden\'s widow.'};
  let game=r.freshStoryGame(hero1,JSON.parse(JSON.stringify(story)),r.newAdventure(hero1));
  const keeper=r.npcArtSubject(game,'keeper');same([keeper.species,keeper.gender,keeper.role],['Human','man','The reeve, who gives orders here.']);assert.equal(keeper.trained,undefined);
  const residents=Object.keys(game.people);const res=r.npcArtSubject(game,residents[0]);assert.equal(res.species,'Human');assert.equal(res.gender,'woman');
  const foe=r.creatureArtSubject({...game,stage:'combat'});assert.equal(foe.species,'Human');assert.equal(foe.gender,'woman');assert.equal(foe.id,'main-foe');
  const skirmish=r.hostileEncounterGame(hero1);assert.equal(r.creatureArtSubject({...skirmish,stage:'combat'}).template,skirmish.story.id.replace('hostile-encounter-',''),'the Skirmish says which kind its foe is');assert.ok(r.templateKeys.includes(r.creatureArtSubject({...skirmish,stage:'combat'}).template));
  const wild=r.startWildFight(game,hero1,{template:'boar',name:'Old Tusker',appearance:'A huge scarred boar.'},{place:'inn'});assert.equal(r.creatureArtSubject(wild.game).template,'boar');
  // A journey copy: its people go under the journey's art id, and say which campaign is the copy's own.
  const copyGame=r.freshStoryGame(hero1,JSON.parse(JSON.stringify({...story,id:'11111111-2222-4333-8444-555555555555',libraryId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',artId:'journey-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'})),r.newAdventure(hero1));
  const k2=r.npcArtSubject(copyGame,'keeper');assert.equal(k2.campaignId,copyGame.story.artId);assert.equal(k2.related,copyGame.story.id);
  console.log('Subjects: people and a tale\'s person foe say their species, gender, training and calling; template creatures their kind; a journey\'s people its other campaign; no key changes.');
  // ---------- A whole tale shown without a single painting ----------
  {const tale=path.join(tmp,'tale-art');fs.mkdirSync(tale,{recursive:true});
   fs.writeFileSync(path.join(tale,artKey({campaignId:'hostile-encounter-wolf',kind:'creature',id:'main-foe'})+'.jpg'),jpeg('skirmish-wolf'));
   const never=async()=>{throw Error('a painting was asked for');};
   const whole=createArtStore({directory:tale,fetchImpl:never,libraryDirectory:path.join(tmp,'no-places'),creatureDirectory:path.join(tmp,'no-creatures'),peopleLibrary:lib.createPeopleLibrary({directory:dir,refreshMs:0,picksDirectory:path.join(tale,'people-picks')})});
   let g=game;
   const met=r.commitDmTurn(hero1,g,hp,null,{question:'I look about the market.',narration:'A tiefling tinker waves you over.',dialogue:[],introduce:{name:'Vex Ambersail',species:'Tiefling',gender:'other',role:'A travelling tinker.',appearance:'A lean tiefling with curling horns and a coat of a hundred pockets.',personality:'Chatty.',toughness:'common',attitude:'friendly',foe:'neutral',tie:null,class:'Artificer',regard:{stance:'curious',reason:'I have never met your kind.'}}});
   assert.ok(!met.error,met.error);g=met.game;
   const subjects=[r.npcArtSubject(g,'keeper'),r.npcArtSubject(g,'mara'),...Object.keys(g.people).map(id=>r.npcArtSubject(g,id)),r.creatureArtSubject({...g,stage:'combat'})];
   const lair=r.startWildFight(g,hero1,story.errand.threat,{place:'inn'});subjects.push(r.creatureArtSubject(lair.game));
   const answers=[];for(const s of subjects)answers.push(await whole.request(s,{apiKey:'test-only',model:'test-model',mayPaint:()=>true,onPainted:()=>{throw Error('counted');}}));
   assert.ok(answers.every(a=>a.status==='ready'),'every portrait and creature of the tale is shown at once: '+answers.map(a=>a.status).join());
   const faces=answers.slice(0,-1).map(a=>a.library);assert.equal(new Set(faces).size,faces.length,'every person of the tale has a face of their own');
   assert.ok(shown(answers.at(-1)).includes('skirmish-wolf'),'the lair\'s wolf is the wolf every tale sees');
   const vex=Object.keys(g.people).find(id=>g.people[id].name==='Vex Ambersail');assert.equal(stock.find(e=>e.id===answers[2+Object.keys(g.people).indexOf(vex)].library).species,'Tiefling');
   console.log('A whole tale: keeper, mara, '+(subjects.length-5)+' residents, someone the Dungeon Master invented, a foe who is a person and the lair\'s creature, every one shown with no painting, each person a face of their own.');}
  // ---------- The Dungeon Master is not offered a library person whose face is already worn ----------
  {const server=require('./dm-server.cjs'),shelf=lib.createPeopleLibrary({directory:dir,refreshMs:0});
   const context={story:{id:'tale-z'},world:{current:{id:'p3',kind:'settlement'},region:{terrain:'plains'},canIntroduce:true,poolTaken:[]}};
   const plain=await server.peopleToMeetFor(context,{...lib,people:shelf});const worn=[...plain.keys()][0];
   const after=await server.peopleToMeetFor(context,{...lib,people:shelf},new Set([worn]));assert.ok(!after.has(worn),'a face a look-alike wears is not offered');
   same([...await server.portraitsTaken({story:{id:'tale-c',artId:'journey-q'}},{portraits:{takenIn:async ids=>new Set(ids.map(i=>'np-'+i))}})].sort(),['np-journey-q','np-tale-c'],'the tale and its journey both count');
   same([...await server.portraitsTaken({story:{id:'tale-c'}},{})],[],'nothing to read: nothing taken');
   assert.match(readText('dm-server.cjs'),/peopleToMeetFor\(body\.context,roster,roster\?await portraitsTaken\(body\.context,\{live,portraits\}\)/);
   const dm=readText('dm-server.cjs');assert.match(dm,/taken from context\.world\.peopleToMeet when it lists anyone/);assert.match(dm,/take them from this list first/);assert.match(dm,/usually one of the world's common peoples/);assert.match(require('./adventure-generator.cjs').storyInstructions,/most people are of the world's common peoples/);
   console.log('The Dungeon Master: never offered a library person whose face a look-alike of the tale wears, and told to take someone new from the ready-made people first.');}
  // ---------- The story writer may cast keeper and mara from the library ----------
  {const {generateAdventure,castResidents}=require('./adventure-generator.cjs');
   const cast=[stock[0],stock[1],stock[5]],tale=journeyStory(1),calls=[];
   tale.npcs.keeper={...tale.npcs.keeper,name:stock[0].name,pool:stock[0].id};tale.npcs.mara={...tale.npcs.mara,name:stock[1].name,pool:stock[0].id};tale.residents[0]={...tale.residents[0],name:stock[5].name,pool:stock[5].id};
   const done=reply=>({ok:true,json:async()=>({status:'completed',usage:{input_tokens:10,output_tokens:10},output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]})});
   const got=await generateAdventure({input:'x',context:{mode:'adventure',introId:'easy',easyStart:true,ahead:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl:async(u,o)=>{calls.push(JSON.parse(o.body));return done(JSON.parse(JSON.stringify(tale)));},cast});
   const schema=calls[0].text.format.schema.properties.npcs.properties.keeper;same(schema.properties.pool.enum,[null,...cast.map(e=>e.id)]);assert.ok(schema.required.includes('pool'));
   assert.match(calls[0].instructions,/keeper and mara may be cast from them too/);
   assert.equal(got.story.npcs.keeper.pool,stock[0].id);assert.equal(got.story.npcs.keeper.species,stock[0].species);assert.equal(got.story.npcs.keeper.appearance,stock[0].appearance);assert.equal(got.story.npcs.keeper.role,tale.npcs.keeper.role,'the tale\'s own role');
   assert.equal(got.story.npcs.mara.pool,undefined,'never cast twice');assert.equal(got.story.residents[0].pool,stock[5].id);
   const h=r.readyHero('fighter'),g2=r.freshStoryGame(h,JSON.parse(JSON.stringify(got.story)),r.newAdventure(h));
   assert.ok(r.validStory(g2.story)&&r.validAdventure(r.adventureSnapshot(h,g2,null,true),h),'a tale with a cast keeper is valid');assert.ok(!r.validStory({...g2.story,npcs:{...g2.story.npcs,keeper:{...g2.story.npcs.keeper,pool:'../x'}}}));
   assert.ok(r.libraryPeopleMet(g2).includes(stock[0].id),'the keeper counts as met: never offered again');assert.equal(r.npcArtSubject(g2,'keeper').pool,stock[0].id,'and is shown with their own portrait');
   same(castResidents({npcs:{keeper:{name:'Y',pool:'np009'}},residents:[]},[]).npcs.keeper.pool,undefined);
   // Carried into the next tale in the region, the keeper keeps their face.
   const next=r.freshStoryGame(h,{...JSON.parse(JSON.stringify(journeyStory(2))),id:'next-tale'},r.newAdventure(h));const joined=r.joinRegion(next,g2,{sameRegion:true,bearing:'N',miles:5});
   assert.ok(Object.values(joined.people).some(p=>p.pool===stock[0].id),'the old keeper keeps their pool id in the next tale');
   console.log('Story writer: keeper and mara may be cast from the library too (strict schema, never twice, the tale\'s own role); a cast keeper is valid, counts as met and is shown with their own portrait, here and in the next tale.');}
  // ---------- Ready journeys written ahead are offered the library's people too ----------
  assert.match(readText('dm-server.cjs'),/const cast=live\?await castFor\(loadPeople\(\)\):null;\s*return require\('\.\/adventure-generator\.cjs'\)\.generateAdventure\(\{[^\n]*ahead:true[^\n]*,cast,/,'the library writer passes the castable people');
  // ---------- Revisions ----------
  {const dm=readText('dm-server.cjs');assert.equal(lib.revision,2);assert.match(dm,/people-library\.cjs'\)\.revision!==2\)/);assert.equal(require('./world-art.cjs').revision,11);}
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log('Passed: portraits and creatures without paying for paintings.');
 }catch(e){fs.rmSync(tmp,{recursive:true,force:true});console.error(e);process.exit(1);}
})();
// A ready journey's own creature (its errand threat, a lair from its story) is painted once for every copy of the
// journey: the wild fight's subject goes by the journey's artId, as its people do.
{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'worldArtRules.js'),'utf8');
 require('node:assert').ok(/if\(game\.wildFight\)\{const w=game\.wildFight;return \{campaignId:artCampaign\(game,true\)/.test(src),'a wild fight in a ready journey shares its picture across copies');
 console.log('Journey creatures: painted once per ready journey, shared by every player who takes it.');}
