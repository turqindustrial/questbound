// Free hero portraits by default (2026-10-17, the host's words: "Free hero portraits by default: offer each new hero a
// matching library face right away, with an optional 'paint my own' for 3¢"). Checks: the portrait choice on the hero
// (none, a library face, their own painting) is validated everywhere a hero is (the builder, saves, save codes, the
// roster, the campaign server) and an old hero without one stays valid; a hero without a choice is shown a fitting
// library face (species, gender, class first, then age and look) with no painting and no usage, the same every time
// and kept for them, never the face of a library person in the game, of another hero at the table or of someone in
// the tale (and the tale's people are then kept off the hero's face); a hero painted before keeps their painting;
// Another face goes round the fitting faces, free; Paint my own paints once, within the host's allowance (a guest
// past it is refused in the allowance's own words), and a painted hero is never painted again by itself; the
// campaign's `portrait` edit; the screens that show and change it. Stand-in library and providers only.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {rulesSource,readText}=require('./rules-files.cjs');
const lib=require('./people-library.cjs'),{createArtStore,artKey,validateSubject}=require('./world-art.cjs'),faces=require('./hero-faces.cjs');
const rules=require('./rules-engine.cjs').rules(),{createCampaigns}=require('./campaigns.cjs');
const r=vm.runInNewContext(rulesSource({extra:['worldArtRules.js','saveCodes.js','rosterRules.js']})+'\n({readyHero,makeCharacter,blankBuild,buildError,isValidCharacter,validPortraitChoice,heroArtSubject,heroPaintingSubject,heroPaintingChoice,heroArtHash,npcArtSubject,newAdventure,freshStoryGame,adventureSnapshot,validAdventure,sameHeroText,exportSave,readSave,setAside,restoreEntry,validRosterEntry,startParty,joinParty,partyView,genderOf})',{AsyncStorage:{},weaponIcon:()=>'sword',TextEncoder,TextDecoder,Blob,Response,CompressionStream,DecompressionStream,btoa,atob});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const jpeg=id=>Buffer.concat([Buffer.from([255,216,255,224]),Buffer.from(String(id)),Buffer.from([255,217])]);
const shown=answer=>Buffer.from(String(answer.dataUrl).split(',')[1]??'','base64').toString('latin1');
// A stand-in library: six people of every species and gender (two ordinary, four trained), every age.
const ages=['young','adult','middle-aged','old'],classes=[null,null,'Fighter','Wizard','Cleric','Rogue'],stock=[];
for(const species of lib.speciesList)for(const gender of lib.genderList)for(let k=0;k<6;k++){
 const n=stock.length+1,id='np'+String(n).padStart(3,'0');
 stock.push({id,name:'Person '+'abcdefghijklmnopqrstuvwxyz'[n%26]+'abcdefghijklmnopqrstuvwxyz'[Math.floor(n/26)%26]+'abcdefghijklmnopqrstuvwxyz'[Math.floor(n/676)%26]+' '+id,gender,species,age:ages[(n+k)%4],role:'A '+(classes[k]?classes[k].toLowerCase()+' for hire':'miller')+'.',class:classes[k],appearance:'A '+species.toLowerCase()+' with weathered hands, a grey wool coat and a long scar over one brow, number '+n+'.',personality:'Quiet.',motive:'Get by.',voice:'Says little.',hook:'Owes someone a favour, '+id+'.',placeKinds:['settlement'],terrains:['plains'],toughness:'common',attitude:'indifferent'});
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qb-hero-face-'));
(async()=>{
 try{
  // ---------- The choice on the hero ----------
  const fighter=r.readyHero('fighter'),rogue=r.readyHero('rogue'),cleric=r.readyHero('cleric');
  for(const ok of [undefined,{library:'np001'},{library:'np300'},{painted:'abc123'},{painted:'16y6pqi-w'}])assert.ok(r.validPortraitChoice(ok),'a portrait choice: '+JSON.stringify(ok));
  for(const bad of [null,'np001',[],{},{library:'np1'},{library:'np0001'},{library:'np001',x:1},{painted:true},{painted:'ABC'},{painted:'a b'},{painted:'x'.repeat(14)},{library:'np001',painted:'abc'}])assert.ok(!r.validPortraitChoice(bad),'refused: '+JSON.stringify(bad));
  assert.ok(r.isValidCharacter(fighter)&&fighter.portrait===undefined,'a hero from before has no portrait choice and stays valid');
  assert.ok(r.isValidCharacter({...fighter,portrait:{library:'np012'}}));assert.ok(!r.isValidCharacter({...fighter,portrait:{library:'np12'}}),'the save checks refuse a bad portrait');
  assert.ok(!rules.isValidCharacter({...fighter,portrait:{painted:true}}),'and so does the campaign server');
  const form={...r.blankBuild(),...fighter,portrait:{library:'np012'}};assert.equal(r.buildError(form),'');same(r.makeCharacter(form).portrait,{library:'np012'},'the builder keeps the choice on the hero');
  assert.match(r.buildError({...form,portrait:{library:'x'}}),/portrait/);
  assert.ok(r.sameHeroText(JSON.stringify({...fighter,portrait:{library:'np012'}}),JSON.stringify(fighter)),'a load cut short between the hero and the adventure writes still finds the adventure');
  assert.ok(!r.sameHeroText(JSON.stringify({...fighter,name:'Other'}),JSON.stringify(fighter)));
  console.log('The choice: none, a library face or the hero\'s own painting, checked by the builder, the saves and the campaign server; heroes from before stay valid.');

  // ---------- The subjects the game asks for ----------
  const old=r.heroArtSubject(fighter);assert.equal(old.face,'default');assert.equal(old.species,'Human');assert.equal(old.gender,'woman');assert.equal(old.trained,'Fighter');
  const paint=r.heroPaintingSubject(fighter);assert.equal(paint.face,undefined);assert.equal(artKey(validateSubject(old)),artKey(validateSubject(paint)),'a hero from before is asked for at the key of their painting (so a painting made before is kept)');
  assert.equal(artKey(validateSubject(paint)),artKey({campaignId:'hero-'+r.heroArtHash(fighter),kind:'portrait',id:'hero-w'}),'the key is the one heroes were always painted under');
  const withFace=r.heroArtSubject({...fighter,portrait:{library:'np007'}});assert.equal(withFace.face,'np007');assert.equal(withFace.id,'face-np007');
  const choice=r.heroPaintingChoice(fighter);same(choice,{painted:r.heroArtHash(fighter)+'-w'});assert.ok(r.validPortraitChoice(choice));
  const own=r.heroArtSubject({...fighter,portrait:choice});assert.equal(own.face,'own');assert.equal(artKey(validateSubject(own)),artKey(validateSubject(paint)),'their own painting is the one Paint my own made');
  const edited={...fighter,description:fighter.description+' Now with a red cloak.',portrait:choice};assert.equal(artKey(validateSubject(r.heroArtSubject(edited))),artKey(validateSubject(paint)),'changing the hero\'s words later keeps the painting (never paints again by itself)');
  assert.equal(r.heroArtSubject({...fighter,level:7}).campaignId,old.campaignId,'levelling up keeps the portrait');
  const client=readText('artClient.js');assert.match(client,/subject\.face\?\[subject\.campaignId,subject\.kind,subject\.id,subject\.face\]/,'the device keeps the default face and the hero\'s own painting apart');
  // With the game: library people of the game and the other heroes' faces are avoided; the tale named.
  const game={...r.newAdventure(fighter),story:{id:'tale-1',artId:'journey-9'},people:{n1:{name:'Ada',pool:'np101'}},party:{lead:'seat-a',members:{'seat-a':{character:JSON.stringify({...fighter,portrait:{library:'np050'}})},'seat-b':{character:JSON.stringify({...rogue,portrait:{library:'np060'}})}}}};
  const atTable=r.heroArtSubject({...fighter,portrait:{library:'np050'}},game);same(atTable.tales,['tale-1','journey-9']);
  const other=r.heroArtSubject(cleric,game);same(other.avoid.sort(),['np050','np060','np101'],'a hero without a choice avoids the people of the game and the faces at the table');
  const mine=r.heroArtSubject({...rogue,portrait:{library:'np060'}},game);assert.equal(mine.avoid,undefined,'(a face subject needs no avoid)');
  const v=validateSubject({...other,face:'default',tales:['tale-1','hero-abc','x'.repeat(200)]});same(v.tales,['tale-1'],'only tales are kept, never another hero\'s campaign');
  assert.equal(validateSubject({...old,face:'bogus'}).face,undefined,'an unknown face is dropped');
  assert.equal(validateSubject({campaignId:'tale-1',kind:'portrait',id:'n1',name:'A',description:'B',setting:'',face:'np001'}).face,undefined,'only a hero asks for a face');
  console.log('Subjects: a hero without a choice asks for the default at their painting\'s key; a face by its own id; their own painting pinned to the look it was painted for; the game\'s people and the table\'s faces avoided.');

  // ---------- The painter: library faces free, paintings kept, Paint my own once ----------
  const dir=path.join(tmp,'people'),art=path.join(tmp,'art');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(art,{recursive:true});
  for(const e of stock)fs.writeFileSync(path.join(dir,e.id+'.jpg'),jpeg(e.id));
  fs.writeFileSync(path.join(dir,'library.json'),JSON.stringify(stock));
  let paid=0,counted=0;
  const fetchImpl=async()=>{paid++;return {ok:true,json:async()=>({status:'completed',output:[{type:'image_generation_call',status:'completed',result:jpeg('painted').toString('base64')}]})};};
  const open=(artDir=art)=>createArtStore({directory:artDir,fetchImpl,libraryDirectory:path.join(tmp,'no-places'),peopleLibrary:lib.createPeopleLibrary({directory:dir,refreshMs:0,picksDirectory:path.join(artDir,'people-picks')})});
  let store=open();const ask=(subject,options={})=>store.request(subject,{apiKey:'test-only',model:'test-model',mayPaint:()=>true,onPainted:()=>counted++,...options});
  const waitPaid=async n=>{for(let i=0;i<200&&paid<n;i++)await new Promise(res=>setTimeout(res,10));};
  const entry=id=>stock.find(e=>e.id===id);
  const first=await ask(r.heroArtSubject(fighter));
  assert.equal(first.status,'ready');assert.ok(first.library,'a hero without a choice is shown a library face');assert.equal(paid,0,'with no painting');assert.equal(counted,0,'and no usage');
  assert.equal(entry(first.library).species,'Human');assert.equal(entry(first.library).gender,'woman');assert.ok(['young','adult'].includes(entry(first.library).age),'a 29-year-old is given a face of about their age');
  {const ageless={...fighter,name:'Ageless',age:undefined},pick=await ask(r.heroArtSubject(ageless));assert.equal(entry(pick.library).class,'Fighter','their own class first');}
  assert.ok(shown(first).includes(first.library),'the library person\'s own portrait');
  assert.ok(first.faces.length>=5&&first.faces[0]===first.library,'every fitting face is offered, the default first');
  assert.ok(first.faces.every(id=>entry(id).species==='Human'&&entry(id).gender==='woman'),'all of the hero\'s species and gender');
  assert.equal(first.own,false);
  assert.equal((await ask(r.heroArtSubject(fighter))).library,first.library,'the same face every time');
  store=open();assert.equal((await ask(r.heroArtSubject(fighter,{people:{n1:{pool:first.library}}}))).library,first.library,'kept for the hero across restarts, even when someone with that face turns up later');
  {const fresh=open(path.join(tmp,'art-elsewhere'));assert.equal((await fresh.request(r.heroArtSubject(fighter),{})).library,first.library,'repeatable: another computer picks the same face for the same hero');}
  const dwarf=await ask(r.heroArtSubject(cleric));assert.equal(entry(dwarf.library).species,'Dwarf');assert.equal(entry(dwarf.library).gender,'man');assert.equal(entry(dwarf.library).class,'Cleric');
  const halfling=await ask(r.heroArtSubject(rogue));assert.equal(entry(halfling.library).species,'Halfling');
  if(!r.genderOf(rogue.description)&&!r.genderOf(rogue.backstory))assert.ok(new Set(halfling.faces.map(id=>entry(id).gender)).size>1,'a hero whose words do not say their gender is offered faces of every gender');
  const oldElf=await ask(r.heroArtSubject({...r.readyHero('wizard'),species:'Elf',race:'Elf',lineage:null,name:'Old Elf'}));assert.ok(['High Elf','Wood Elf'].includes(entry(oldElf.library).species),'an old plain Elf looks like a high or a wood elf');
  // Another face: each fitting face, free.
  for(const id of first.faces.slice(1,4)){const next=await ask(r.heroArtSubject({...fighter,portrait:{library:id}}));assert.equal(next.status,'ready');assert.equal(next.library,id);assert.ok(shown(next).includes(id));}
  assert.equal(paid,0,'cycling faces paints nothing');
  fs.renameSync(path.join(dir,'np002.jpg'),path.join(tmp,'np002.jpg'));
  const gone=await ask(r.heroArtSubject({...fighter,portrait:{library:'np002'}}));assert.equal(gone.status,'failed');assert.equal(paid,0,'a face missing from the library is never painted instead');
  fs.renameSync(path.join(tmp,'np002.jpg'),path.join(dir,'np002.jpg'));
  // A hero painted before keeps their painting (and is offered the faces beside it).
  const painted={...r.readyHero('wizard'),name:'Painted Before'};fs.writeFileSync(path.join(art,artKey(validateSubject(r.heroPaintingSubject(painted)))+'.jpg'),jpeg('older-painting'));
  const kept=await ask(r.heroArtSubject(painted));assert.ok(shown(kept).includes('older-painting'),'a hero painted before keeps their painting');assert.equal(kept.own,true);assert.ok(kept.faces.length>=5);assert.equal(paid,0);
  // Paint my own: painted once, from the hero's own words, within the allowance.
  const newcomer={...fighter,name:'Newcomer'};
  let before=paid;const job=await ask(r.heroPaintingSubject(newcomer));assert.equal(job.status,'pending');await waitPaid(before+1);assert.equal(paid,before+1,'Paint my own paints');
  for(let i=0;i<100;i++){if((await ask(r.heroPaintingSubject(newcomer))).status==='ready')break;await new Promise(res=>setTimeout(res,10));}
  assert.equal(counted,1,'and its cost is counted');
  const mineNow=await ask(r.heroArtSubject({...newcomer,portrait:r.heroPaintingChoice(newcomer)}));assert.ok(shown(mineNow).includes('painted'),'their own painting is shown');assert.equal(mineNow.own,true);
  await ask(r.heroPaintingSubject(newcomer));await new Promise(res=>setTimeout(res,30));assert.equal(paid,before+1,'(once)');
  const later=await ask(r.heroArtSubject({...newcomer,description:'Now quite different.',portrait:r.heroPaintingChoice(newcomer)}));assert.ok(shown(later).includes('painted'));assert.equal(paid,before+1,'a painted hero whose words change keeps the painting and is not painted again');
  const missing=await ask(r.heroArtSubject({...newcomer,portrait:{painted:'zzz9'}}));assert.equal(missing.status,'failed');await new Promise(res=>setTimeout(res,30));assert.equal(paid,before+1,'an own painting that is not on this computer is never painted by itself');
  const guest=await ask(r.heroPaintingSubject({...fighter,name:'Guest Hero'}),{mayPaint:()=>false});assert.equal(guest.status,'failed');assert.match(guest.error,/daily allowance for paintings is used up/,'a guest past the allowance is refused in its own words');assert.equal(paid,before+1);
  const guestFace=await ask(r.heroArtSubject({...fighter,name:'Guest Hero'}),{mayPaint:()=>false,apiKey:null});assert.equal(guestFace.status,'ready','faces need no allowance and no key');
  console.log('The painter: a fitting library face with no painting and no usage, the same every time and kept; Another face free; paintings made before kept; Paint my own painted once within the allowance, never again by itself.');

  // ---------- Two heroes at a table, and the tale's people ----------
  const table={...r.newAdventure(fighter),party:{lead:'seat-b',members:{'seat-a':{character:JSON.stringify({...fighter,portrait:{library:first.library}})},'seat-b':{character:JSON.stringify(fighter)}}}};
  const third={...fighter,name:'Third Blade'},thirdAtTable=r.heroArtSubject(third,table);
  const pickAtTable=await ask(thirdAtTable);assert.notEqual(pickAtTable.library,first.library,'two heroes at one table do not share a face while another fits');assert.ok(!pickAtTable.faces.includes(first.library),'Another face skips the other hero\'s face');
  // A tale whose look-alike already wears a face: the hero is given another; the hero's face is then kept from the tale's people.
  const tale='tale-faces',npc=(id,extra={})=>({campaignId:tale,kind:'portrait',id,name:'Someone '+id,description:'A woman. A human fighter for hire.',setting:'',species:'Human',gender:'woman',trained:'Fighter',...extra});
  const keeper=await ask(npc('keeper'));const hero4={...fighter,name:'Fourth Hand'},taleGame={...r.newAdventure(hero4),story:{id:tale}};
  const fourth=await ask(r.heroArtSubject(hero4,taleGame));assert.notEqual(fourth.library,keeper.library,'a hero is never given the face of someone in the tale while another fits');
  const met=await ask(npc('n5'));assert.notEqual(met.library,fourth.library,'and nobody met in the tale afterwards is given the hero\'s face');
  assert.ok((await store.people.takenIn([tale])).has(fourth.library),'(the hero\'s face is noted in the tale)');
  const journeyGame={...r.newAdventure(hero4),story:{id:'copy-7',artId:'journey-7'}};await ask(r.heroArtSubject({...hero4,portrait:{library:fourth.library}},journeyGame));
  assert.ok(!(await store.people.takenIn(['journey-7'])).has(fourth.library),'a ready journey\'s shared faces are never taken up by one player\'s hero');
  assert.ok((await store.people.takenIn(['copy-7'])).has(fourth.library));
  console.log('Tables and tales: two heroes at a table get two faces; a hero avoids the faces of the tale\'s people, and they avoid the hero\'s.');

  // ---------- Carried with the hero: save codes, the roster, the shared table ----------
  {const hero={...fighter,portrait:{library:'np012'}},adventure=r.adventureSnapshot(hero,r.newAdventure(hero),null,true);
   const storage=(map=>({getItem:k=>map[k]??null,setItem:(k,v)=>{map[k]=v;},removeItem:k=>{delete map[k];}}))({'questbound.character.v1':JSON.stringify(hero),'questbound.adventure.v1':JSON.stringify(adventure)});
   const read=await r.readSave(await r.exportSave(storage));same(read.hero.portrait,{library:'np012'},'a save code carries the portrait');
   storage.setItem('questbound.character.v1',JSON.stringify({...hero,portrait:{library:'bad'}}));storage.removeItem('questbound.adventure.v1');
   await assert.rejects(r.exportSave(storage).then(r.readSave),/did not pass the save checks/,'a code with a bad portrait is refused');
   const aside=r.setAside([],[],hero,r.newAdventure(hero),null,true);assert.ok(r.validRosterEntry(aside.roster[0]));same(r.restoreEntry(aside.roster[0]).hero.portrait,{library:'np012'},'the roster keeps it');}
  {const dirC=fs.mkdtempSync(path.join(os.tmpdir(),'qb-face-table-')),seq=(s=11)=>()=>(s=(s*16807)%2147483647)/2147483647;
   const c=createCampaigns({dir:dirC,ask:async()=>({narration:'On.',actionId:null}),randomImpl:seq()}),A={id:'a'.repeat(64)},B={id:'b'.repeat(64)};
   const snap=hero=>rules.adventureSnapshot(hero,rules.newAdventure(hero),null,true);
   const made=c.create(A,{snapshot:snap(fighter),name:'Al'}),joined=c.join(B,{invite:made.invite,name:'Bo',snapshot:snap(cleric)});
   const edit=(user,version,change)=>c.edit(user,{campaignId:made.campaignId,baseVersion:version,...change});
   const refused=(fn,status,pattern)=>assert.throws(fn,e=>e.status===status&&pattern.test(e.message));
   refused(()=>edit(B,joined.version,{kind:'portrait',portrait:{library:'np1'}}),400,/portrait/);
   const chose=edit(B,joined.version,{kind:'portrait',portrait:{library:'np033'}});same(JSON.parse(chose.snapshot.character).portrait,{library:'np033'},'a player sets their own hero\'s portrait at the table');
   const seen=c.poll(A,{campaignId:made.campaignId});const others=Object.values(seen.snapshot.game.party.members).map(m=>JSON.parse(m.character));
   same(others.find(h=>h.name===cleric.name).portrait,{library:'np033'},'the other players see it');assert.equal(JSON.parse(seen.snapshot.character).portrait,undefined,'and their own hero is untouched');
   const cleared=edit(B,chose.version,{kind:'portrait',portrait:null});assert.equal(JSON.parse(cleared.snapshot.character).portrait,undefined,'none: back to the default');
   const solo=c.create(A,{snapshot:snap(fighter),party:false,name:'Al'}),guestJoin=c.join(B,{invite:solo.invite,name:'Bo'});
   assert.throws(()=>c.edit(B,{campaignId:solo.campaignId,baseVersion:guestJoin.version,kind:'portrait',portrait:{library:'np001'}}),e=>e.status===403,'in a one-hero campaign the host\'s hero\'s face is the host\'s choice');
   fs.rmSync(dirC,{recursive:true,force:true});}
  console.log('Carried: save codes, the roster and the shared table (the portrait edit; every player sees each hero\'s own choice).');

  // ---------- The screens ----------
  const picker=readText('HeroFacePicker.js'),builder=readText('CharacterBuilder.js'),sheet=readText('CharacterSheet.js'),app=['App.js','MenuScreens.js'].map(readText).join(' '),party=readText('PartyPanel.js'),portrait=readText('HeroPortrait.js');
  assert.match(builder,/<HeroFacePicker hero=\{form\} value=\{form\.portrait\} onChange=\{portrait => change\(\{portrait\}\)\} auto/,'the builder\'s review offers the face');
  assert.match(sheet,/<HeroFacePicker hero=\{hero\} game=\{game\} value=\{hero\.portrait\} onChange=\{onPortrait\}\/>/,'and the Character Sheet');
  assert.match(app,/onPortrait=\{choosePortrait\}/);assert.match(app,/table\.edit\(\{kind:'portrait',portrait:portrait\?\?null\}\)/,'at a table the change is the campaign\'s edit');
  assert.match(picker,/'Another face/);assert.match(picker,/'Paint my own'/);assert.match(picker,/ensureArt\(subject,\{retry:true\}\)/);assert.match(picker,/onChange\(heroPaintingChoice\(hero\)\)/,'a painting becomes the choice only once it is ready');
  assert.match(party,/<HeroPortrait hero=\{c\.face\} game=\{game\} size=\{20\}\/>/,'each hero at the table shows their own choice');
  assert.match(portrait,/heroArtSubject\(hero,game\)/);
  for(const file of ['HeroFacePicker.js'])assert.ok(!/#[0-9a-f]{3,8}\b/i.test(readText(file).replace(/tint\('#[0-9a-f]+'\)/gi,'')),'colours in tint()');
  assert.equal(faces.revision,1);assert.equal(require('./world-art.cjs').revision,11);
  console.log('Screens: the builder\'s review and the Character Sheet show the face with Another face and Paint my own; the party cards show each hero\'s own.');
  console.log('Passed: free hero portraits by default, a choice of faces, and Paint my own once.');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
