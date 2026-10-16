// The host's library of ready-made people (2026-10-16, the host's words: "use the api to generate 1000 completely
// unique npcs for the players to run into so that it doesn't eat up all of my credit as they progress" and "make sure
// to keep in mind every class, race, and gender"). Checks: the plan (1000 people: every species, gender and class
// together once, the rest ordinary folk spread evenly), the host-only 'people-batch' mode and how it tidies what the
// model writes, the people offered to the Dungeon Master where the hero is, an introduction from the library filled in
// whole and kept with its pool id (on a device and at the campaign server), never the same person twice in a game,
// portraits answered from the library with no painting and no usage, and old saves. Stand-in providers only.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),http=require('node:http');
const {rulesSource,readText}=require('./rules-files.cjs');
const lib=require('./people-library.cjs'),writer=require('./people-writer.cjs'),{planPeople}=require('./make-people-library.cjs');
const r=vm.runInNewContext(rulesSource({extra:['worldArtRules.js']})+'\n({species,classes,npcClassList,placeKinds,terrains,readyHero,newAdventure,freshStoryGame,commitDmTurn,dmContext,validAdventure,adventureSnapshot,introducePerson,libraryPeopleMet,libraryPersonId,npcArtSubject,npcLore,joinRegion,validPeople})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
// ---------- The lists are the game's own ----------
same(lib.speciesList,[...r.species],'people-library.cjs keeps characterRules species');
same(lib.classList,[...r.classes],'people-library.cjs keeps characterRules classes');same(lib.classList,[...r.npcClassList],'and npcRules npcClassList');
same(lib.placeKinds,[...r.placeKinds],'people-library.cjs keeps mapRules placeKinds');same(lib.terrains,[...r.terrains],'people-library.cjs keeps mapRules terrains');
// ---------- The plan: 1000 people, every species × gender × class once, the rest ordinary and even ----------
{const plan=planPeople();same(plan,planPeople(),'the plan is always the same');
 assert.equal(plan.length,1000);same(plan.map(s=>s.slot),Array.from({length:1000},(_,i)=>'np'+String(i+1).padStart(4,'0')),'ids np0001…np1000');
 const trained=plan.filter(s=>s.class),ordinary=plan.filter(s=>!s.class);assert.equal(trained.length,507);assert.equal(ordinary.length,493);
 const combos=new Set(trained.map(s=>s.species+'|'+s.gender+'|'+s.class));assert.equal(combos.size,507,'each species, gender and class together exactly once');
 for(const sp of lib.speciesList)for(const g of lib.genderList){for(const c of lib.classList)assert.ok(combos.has(sp+'|'+g+'|'+c));const n=ordinary.filter(s=>s.species===sp&&s.gender===g).length;assert.ok(n===12||n===13,'ordinary people spread evenly: '+sp+' '+g+' '+n);}
 for(const t of lib.terrains){const n=plan.filter(s=>s.terrain===t).length;assert.ok(n>=111&&n<=112,'lands spread evenly');}
 for(const k of lib.placeKinds)assert.ok(plan.some(s=>s.placeKinds.includes(k)),'every kind of place has its people: '+k);
 assert.ok(new Set(ordinary.map(s=>s.roleHint)).size>=30,'ordinary folk of many callings');assert.ok(!plan.some(s=>/\bchild|\bboy\b|\bgirl\b/i.test(s.roleHint)),'no children');
 for(let i=0;i<plan.length;i+=20)assert.ok(writer.validBrief(plan.slice(i,i+20)),'every batch is a brief the mode accepts');
 console.log('Plan: 1000 people, every species, gender and class together once (507), 493 ordinary folk spread evenly over species and gender, every land and kind of place.');}
// A library person as the writer returns them.
const person=(id,extra={})=>({id,name:'Person '+id,gender:'woman',species:'Human',age:'adult',role:'A ferry keeper.',class:null,appearance:'A tall woman with weathered hands, a grey wool coat, a silver ring in one ear and a long scar over her left brow from an old rope burn.',personality:'Slow to speak, quick to laugh.',motive:'Keep the ferry running until her son comes home.',voice:'Calls everyone "cousin".',hook:'She hides a smuggler\'s ledger under the ferry boards.',placeKinds:['water','road'],terrains:['marsh'],toughness:'common',attitude:'friendly',...extra});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qb-people-'));
(async()=>{
 try{
  const server=require('./dm-server.cjs');
  const done=reply=>({ok:true,json:async()=>({status:'completed',usage:{input_tokens:10,output_tokens:10},output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]})});
  // ---------- The people-batch mode: the host only; what the model writes is checked and tidied ----------
  {const brief=planPeople().slice(0,6),calls=[];
   const names=['Brannoc Tessel','Ilvara Moonquill','Drizzt Underbough','Brannoc Hale','Odile Fenwick','Tamsin Coil'];
   const fetchImpl=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);const asked=JSON.parse(body.input).brief;
    return done({people:asked.map((s,i)=>({slot:s.slot,name:names[i],gender:s.gender,species:i===4?(s.species==='Human'?'Dwarf':'Human'):s.species,age:'adult',role:'  A '+s.roleHint+'.  ',class:s.class,appearance:(i===5?'A broad figure with a thick braided beard, a soot-dark apron and a cracked leather cap pulled low over bright grey eyes that miss nothing at all. ':'A lean figure in a patched blue coat, with ink-stained fingers, close-cropped hair and a crooked nose broken long ago in a tavern brawl. ').repeat(i===1?4:1),personality:'Wry and watchful.',motive:'Pay off an old debt.',voice:'Says "mind you" a lot.',hook:'Carries a letter meant for someone long dead.',placeKinds:['road','settlement'],terrains:['marsh','plains'],toughness:'common',attitude:'indifferent'}))});};
   const body={input:'Write these people.',context:{mode:'people-batch',choices:[],brief,avoidNames:['Sefa Ashgrove']}};
   await assert.rejects(server.generate({...body,guest:'a'.repeat(32)},{apiKey:'k',model:'m',fetchImpl}),e=>e.httpStatus===403,'a guest may never write the library');
   await assert.rejects(server.generate({...body,guest:'account-'+'b'.repeat(32)},{apiKey:'k',model:'m',fetchImpl}),e=>e.httpStatus===403);
   assert.equal(calls.length,0,'refused before anything is asked');
   await assert.rejects(server.generate({input:'x',context:{mode:'people-batch',choices:[],brief:[{...brief[0],species:'Beholder'}]}},{apiKey:'k',model:'m',fetchImpl}),e=>e.httpStatus===400,'a brief the script would never send is refused');
   await assert.rejects(server.generate({input:'x',context:{mode:'people-batch',choices:[],brief:planPeople().slice(0,21)}},{apiKey:'k',model:'m',fetchImpl}),e=>e.httpStatus===400,'twenty at most');
   const out=await server.generate(body,{apiKey:'k',model:'m',fetchImpl});
   assert.equal(calls.length,1);const sent=calls[0];assert.equal(sent.text.format.name,'people_batch');assert.equal(sent.text.format.strict,true);assert.equal(sent.reasoning,undefined,'a plain model gets no reasoning field');
   const schema=sent.text.format.schema.properties.people;assert.equal(schema.minItems,6);assert.equal(schema.maxItems,6);same(schema.items.required,Object.keys(schema.items.properties),'every property required');assert.equal(schema.items.additionalProperties,false);
   assert.match(sent.instructions,/a woman never has a beard/i);assert.match(sent.instructions,/never one in context\.avoidNames/);assert.match(JSON.parse(sent.input).avoidNames.join(),/Sefa Ashgrove/);
   const ids=out.people.map(p=>p.id),refused=Object.fromEntries(out.refused.map(x=>[x.slot,x.reason]));
   assert.equal(refused[brief[2].slot],'famous name','a name from someone else\'s world is refused');
   assert.equal(refused[brief[3].slot],'name used','a given name used twice is refused');
   assert.equal(refused[brief[4].slot]??null,'kind','the wrong species is refused');
   assert.ok(ids.includes(brief[0].slot)&&ids.includes(brief[1].slot));
   const long=out.people.find(p=>p.id===brief[1].slot);assert.ok(long.appearance.length<=400&&/\.$/.test(long.appearance),'an overlong look is cut at a sentence');
   assert.equal(out.people.find(p=>p.id===brief[0].slot).role,'A '+brief[0].roleHint+'.','tidied');
   const sixth=out.people.find(p=>p.id===brief[5].slot)??null;if(brief[5].gender==='woman')assert.ok(!sixth||!/beard/i.test(sixth.appearance),'a woman never keeps a beard');
   for(const p of out.people){assert.ok(lib.validPerson(p));assert.equal(p.species,brief.find(s=>s.slot===p.id).species);assert.equal(p.class,brief.find(s=>s.slot===p.id).class);assert.ok(p.placeKinds.includes(brief.find(s=>s.slot===p.id).placeKinds[0])&&p.terrains[0]===brief.find(s=>s.slot===p.id).terrain);}
   // A woman's beard is taken out, whatever the model wrote.
   const w=writer.tidyPeople({people:[{slot:'np0001',...person('np0001',{name:'Gerta Oakhollow',species:'Dwarf',appearance:'A stout dwarf woman with a braided red beard, a leather apron and bright eyes under heavy brows, her hands scarred from years at the forge and the bellows.'})}]},[{slot:'np0001',species:'Dwarf',gender:'woman',class:null,roleHint:'smith',placeKinds:['settlement'],terrain:'hills'}]);
   assert.equal(w.people.length,1);assert.ok(!/beard/i.test(w.people[0].appearance),w.people[0].appearance);
   assert.equal(writer.tidyPeople({people:[{slot:'np0001',...person('np0001',{name:'Sefa Wren'})}]},[{slot:'np0001',species:'Human',gender:'woman',class:null,roleHint:'ferry keeper',placeKinds:['water'],terrain:'marsh'}],['Sefa Ashgrove']).refused[0].reason,'name used','a given name already in the library is refused');
   assert.ok(writer.famous('Gandalf Brightwater')&&writer.famous('Ser Elminster')&&!writer.famous('Tamsin Coil'));
   // Never streamed, never queued behind players, never sent by a gateway.
   const dm=readText('dm-server.cjs');assert.match(dm,/'diagnostics','people-batch'\]\.includes\(body\.context\.mode\)/);assert.match(dm,/if\(!\['art','people-batch'\]\.includes\(body\.context\.mode\)\)\{await acquire/);
   assert.match(readText('phone-server.cjs'),/\['art','adventure','character'\]\.includes\(mode\)/,'the share gateway passes on no other mode');
   console.log('People batch: the host only (guests refused before any request), briefs checked, a strict schema of exactly the slots asked, famous and repeated names and the wrong species refused, looks cut to size, no beard on a woman.');}
  // ---------- The library and the people offered where the hero is ----------
  const dir=path.join(tmp,'people'),art=path.join(tmp,'art');fs.mkdirSync(dir,{recursive:true});
  const stock=[person('np0001'),person('np0002',{name:'Oswin Reedly',gender:'man',appearance:'A stooped old man in a tarred coat, a lantern on a pole, a white beard to his belt and one milky eye that sees more than it should.',age:'old',toughness:'frail'}),person('np0003',{name:'Kestrel Vane',class:'Ranger',placeKinds:['water','wilds']}),person('np0004',{name:'Mirela Tarn',class:'Wizard'}),person('np0005',{name:'Hob Ashgrove',terrains:['desert'],placeKinds:['settlement']}),person('np0006',{name:'Pell Dunmore',placeKinds:['cave'],terrains:['marsh']}),person('np0007',{name:'Ysolde Brack',placeKinds:['water'],terrains:['coast']}),{id:'np0008',name:'Broken'}];
  fs.writeFileSync(path.join(dir,'library.json'),JSON.stringify(stock));
  const shelf=lib.createPeopleLibrary({directory:dir,refreshMs:0});
  {await shelf.refresh();assert.equal(shelf.entries().length,7,'an entry that is not a whole person is left out');
   const four=await shelf.suited({kind:'water',terrain:'marsh',seed:'tale-1:p3'});assert.equal(four.length,4);
   assert.ok(four.every(e=>e.terrains.includes('marsh')),'people of this land first');assert.ok(four.filter(e=>e.class).length<=1,'at most one in four trained');
   same((await shelf.suited({kind:'water',terrain:'marsh',seed:'tale-1:p3'})).map(e=>e.id),four.map(e=>e.id),'the same few at a place');
   const later=await shelf.suited({kind:'water',terrain:'marsh',seed:'tale-1:p3',taken:new Set([four[0].id])});assert.ok(!later.some(e=>e.id===four[0].id),'never anyone met already');
   const desert=await shelf.suited({kind:'settlement',terrain:'desert',seed:'x',count:2});assert.equal(desert[0].id,'np0005');
   const t=lib.toMeet(stock[1]);same(Object.keys(t),['pool','name','species','gender','age','role','look','hook']);assert.ok(t.look.length<=140);
   fs.writeFileSync(path.join(dir,'library.json'),JSON.stringify(stock.slice(0,3)));await shelf.refresh();assert.equal(shelf.entries().length,3,'read again when it changes');
   fs.writeFileSync(path.join(dir,'library.json'),JSON.stringify(stock));await shelf.refresh();
   const empty=lib.createPeopleLibrary({directory:path.join(tmp,'none'),refreshMs:0});same(await empty.suited({kind:'water',terrain:'marsh'}),[],'no library, nobody offered');}
  // ---------- The Dungeon Master is offered them, and one it introduces is filled in whole ----------
  const roster={...lib,people:shelf};
  const quiet={narration:'You reach the ferry.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null,suggestions:[]};
  const context={stage:'wild',story:{id:'tale-1',foe:'Barrow warden'},world:{current:{id:'p3',name:'Heron Ferry',kind:'water'},region:{name:'The Saltreeds',terrain:'marsh'},knownPlaces:[],peopleHere:1,canIntroduce:true,poolTaken:[1]},choices:[],npcSocialState:[{id:'keeper',name:'Reeve Ormund',present:false}]};
  {const calls=[],turn=async(reply,ctx=context)=>{const fetchImpl=async(url,options)=>{calls.push(JSON.parse(options.body));return done(reply);};return server.generate({input:'I look about the landing.',context:JSON.parse(JSON.stringify(ctx))},{apiKey:'k',model:'m',fetchImpl,people:roster});};
   const brief={species:'Human',role:'x.',appearance:'As listed.',personality:'',toughness:'common',attitude:'friendly',foe:'neutral',tie:null,gender:'other',regard:{stance:'curious',reason:'I have never seen your kind up close.'},class:null};
   const out=await turn({...quiet,introduce:{...brief,pool:'np0002',name:'Oswin'},dialogue:[{speakerId:'new',text:'Crossing tonight?'}]});
   const sent=calls[0],offered=JSON.parse(sent.input).context.world?.peopleToMeet;
   assert.ok(Array.isArray(offered)&&offered.length===4,'four people offered where the hero is');assert.ok(!offered.some(p=>p.pool==='np0001'),'never one already met');
   assert.ok(!sent.input.includes('poolTaken'),'the ids already met are the server\'s business, not the model\'s');
   const schema=sent.text.format.schema.properties.introduce;same(schema.properties.pool.enum,[null,...offered.map(p=>p.pool)],'the reply may name only someone offered');assert.ok(schema.required.includes('pool'));same([...schema.required].sort(),Object.keys(schema.properties).sort(),'strict: every property required');same(schema.properties.pool.type,['string','null']);
   assert.match(sent.instructions,/PEOPLE TO MEET: context\.world\.peopleToMeet/);
   assert.equal(out.introduce.pool,'np0002');assert.equal(out.introduce.name,'Oswin Reedly','their own name');assert.match(out.introduce.appearance,/tarred coat/);assert.equal(out.introduce.gender,'man');assert.equal(out.introduce.toughness,'frail');
   assert.match(out.introduce.personality,/Calls everyone "cousin"\./,'their voice goes with them');assert.ok(out.introduce.hook&&out.introduce.motive);assert.equal(out.introduce.attitude,'friendly','how they meet the hero is the Dungeon Master\'s');assert.equal(out.introduce.regard.stance,'curious');
   assert.equal(out.dialogue[0].speakerId,'new');
   // By exact name with no pool id; someone of the model's own; and no library at all.
   const other=offered.find(p=>p.pool!=='np0002'),byName=await turn({...quiet,introduce:{...brief,pool:null,name:other.name}});assert.equal(byName.introduce.pool,other.pool,'introduced by their exact name');assert.equal(byName.introduce.class,stock.find(e=>e.id===other.pool).class);
   const own=await turn({...quiet,introduce:{...brief,pool:null,name:'Tobin Marsh',role:'A boy fishing off the landing.',appearance:'A thin boy with a reed rod and bare muddy feet.'}});assert.equal(own.introduce.pool,undefined);assert.equal(own.introduce.name,'Tobin Marsh');
   const before=calls.length;await server.generate({input:'I look about.',context:JSON.parse(JSON.stringify(context))},{apiKey:'k',model:'m',fetchImpl:async(u,o)=>{calls.push(JSON.parse(o.body));return done(quiet);}});
   assert.ok(!calls[before].input.includes('peopleToMeet'),'no library (a stand-in provider without one): nobody offered');assert.equal(calls[before].text.format.schema.properties.introduce.properties.pool,undefined,'and the schema is as before');
   // Nobody offered when nobody may be met.
   await turn(quiet,{...context,world:{...context.world,canIntroduce:false}});assert.ok(!calls.at(-1).input.includes('peopleToMeet'));
   console.log('Offered: four suited people (this land and kind of place first, one trained at most), never one met already; an introduction by pool id or exact name is filled in whole from the library, attitude and regard left to the Dungeon Master; anyone else as written.');
   // ---------- On the device: kept with its pool id, never twice in a game ----------
   const hero=r.readyHero('fighter'),hp={current:12,temp:0};
   const written={id:'tale-people',title:'The Reed Crown',premise:'A drowned barrow wakes.',opening:'At the market the reeve hands you an order.',objective:'Learn who woke the barrow.',resolution:'Lay it to rest.',secret:'The reeve did.',foe:'Barrow warden',status:'active',
    locations:{inn:{name:'Stillwater Market',description:'A market on stilts.',kind:'settlement'},bridge:{name:'The Drowned Barrow',description:'A sunken mound.',kind:'ruin'},tower:{name:'Saltmarsh Chapel',description:'A leaning chapel.',kind:'shrine'}},
    npcs:{keeper:{name:'Reeve Ormund',role:'The reeve.',motive:'Keep office.',appearance:'A heavy man in a fur robe.',personality:'Brisk.',ties:{other:'acquaintance',foe:'neutral',note:'n'}},mara:{name:'Wren Halloway',role:'A barge guide.',motive:'Find her brother.',appearance:'A lean young woman with a pole.',personality:'Blunt.',ties:{other:'rival',foe:'enemy',note:'n'}}}};
   let game=r.freshStoryGame(hero,JSON.parse(JSON.stringify(written)),r.newAdventure(hero));
   const valid=g=>r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(g)),hp,true),hero);
   assert.ok(valid(game));
   const met=r.commitDmTurn(hero,game,hp,null,{question:'I look about the market.',narration:'An old man with a lantern shuffles up.',dialogue:[{speakerId:'new',text:'Crossing tonight?'}],introduce:out.introduce});
   assert.ok(!met.error,met.error);const id=met.introduced;const stored=met.game.people[id];
   assert.equal(stored.pool,'np0002');assert.equal(stored.name,'Oswin Reedly');assert.ok(stored.hook&&stored.motive);assert.ok(valid(met.game),'a save with a library person is valid');
   same([...r.libraryPeopleMet(met.game)],['np0002']);
   const ctx=r.dmContext(hero,met.game,hp,'x');same([...ctx.world.poolTaken],[2],'the server is told who has been met');
   assert.match(ctx.nearbyNPCs.find(n=>n.id===id).hook??'',/ledger/,'their hook reaches the Dungeon Master while they are here');
   const subject=r.npcArtSubject(met.game,id);assert.equal(subject.pool,'np0002');assert.equal(subject.campaignId,'tale-people');
   // The same library person again in this game is someone new to the game but never a second copy of the library person.
   const twice=r.introducePerson(met.game,{...out.introduce,name:'Oswin Other'},hero);assert.ok(!twice.error);assert.equal(twice.game.people[twice.id].pool,undefined,'nobody from the library twice in a game');
   // A pool id that is not one is never kept; old saves without pool or hook stay valid.
   const odd=r.introducePerson(game,{...out.introduce,pool:'np12'},hero);assert.equal(odd.game.people[odd.id].pool,undefined);
   assert.ok(valid(game)&&!r.validAdventure(r.adventureSnapshot(hero,{...met.game,people:{...met.game.people,[id]:{...stored,pool:'nobody'}}},hp,true),hero),'a bad pool id makes a save invalid');
   assert.equal(r.npcArtSubject(game,'keeper').pool,undefined);
   // Someone met at a place numbered past 99 keeps a valid save (homes p100…p999).
   assert.ok(r.validPeople({...met.game,people:{[id]:{...stored,home:'p120'}}}),'a home past p99 is valid');assert.ok(!r.validPeople({...met.game,people:{[id]:{...stored,home:'p1200'}}}));
   // Carried into the next tale in the region, they keep their pool id (and portrait).
   {const next=r.freshStoryGame(hero,{...JSON.parse(JSON.stringify(written)),id:'tale-people-2',title:'The Second Crown'},r.newAdventure(hero));const joined=r.joinRegion(next,met.game,{sameRegion:true,bearing:'N',miles:5});const kept=Object.values(joined.people??{}).find(p=>p.name.startsWith('Oswin Reedly'));assert.ok(kept,'carried into the next tale');assert.equal(kept.pool,'np0002','with their pool id');assert.ok(kept.hook);assert.ok(r.validPeople(joined));}
   console.log('On the device: the person is kept whole with their pool id, hook and motive; the save is valid (old saves too); the next turn tells the server who was met; never twice in a game; their portrait subject carries the pool id.');
   // ---------- At the campaign server: the same ----------
   const {resolveTurn}=require('./server-turn.cjs'),engine=require('./rules-engine.cjs').rules();
   const snap=JSON.parse(JSON.stringify(r.adventureSnapshot(hero,r.freshStoryGame(hero,JSON.parse(JSON.stringify(written)),r.newAdventure(hero)),hp,true)));
   const asked=[];const table=await resolveTurn(snap,{question:'I look about the market.'},{ask:async b=>{asked.push(b);return {...quiet,narration:'An old man with a lantern shuffles up.',introduce:out.introduce,dialogue:[{speakerId:'new',text:'Crossing tonight?'}]};},randomImpl:()=>0.5});
   const tablePerson=Object.values(table.snapshot.game.people).find(p=>p.pool==='np0002');assert.ok(tablePerson,'the campaign server keeps the library person');assert.ok(engine.validAdventure(table.snapshot,hero));
   await resolveTurn(table.snapshot,{question:'I look around again.'},{ask:async b=>{asked.push(b);return quiet;},randomImpl:()=>0.5});same(asked.at(-1).context.world.poolTaken,[2],'and tells the Dungeon Master who was met');
   console.log('At a shared table: the campaign server keeps the library person and tells the Dungeon Master who was met.');}
  // ---------- Portraits: from the library, free; painted as before only when missing ----------
  {const {createArtStore,artKey,validateSubject}=require('./world-art.cjs');
   const jpeg=id=>Buffer.concat([Buffer.from([255,216,255,224]),Buffer.from(id),Buffer.from([255,217])]);
   fs.writeFileSync(path.join(dir,'np0002.jpg'),jpeg('np0002'));
   let paid=0,counted=0;const fetchImpl=async()=>{paid++;return {ok:true,json:async()=>({status:'completed',output:[{type:'image_generation_call',status:'completed',result:jpeg('painted').toString('base64')}]})};};
   const store=createArtStore({directory:art,fetchImpl,peopleLibrary:lib.createPeopleLibrary({directory:dir,refreshMs:0}),libraryDirectory:path.join(tmp,'no-places')});
   const ask=(subject,options={})=>store.request(subject,{apiKey:'test-only',model:'test-model',mayPaint:()=>false,onPainted:()=>counted++,...options});
   const portrait={campaignId:'tale-people',kind:'portrait',id:'n3',name:'Oswin Reedly',description:'A man. A stooped old man in a tarred coat.',setting:'',pool:'np0002'};
   assert.equal(validateSubject(portrait).pool,'np0002');assert.equal(validateSubject({...portrait,pool:'../x'}).pool,undefined);assert.equal(validateSubject({...portrait,kind:'landscape'}).pool,undefined);
   assert.equal(artKey(validateSubject(portrait)),artKey(validateSubject({...portrait,pool:undefined})),'the pool id never changes the art key');
   const ready=await ask(portrait,{apiKey:null});assert.equal(ready.status,'ready');assert.equal(ready.library,'np0002');assert.ok(Buffer.from(ready.dataUrl.split(',')[1],'base64').includes(Buffer.from('np0002')),'the library\'s own portrait');
   assert.equal(paid,0,'no painting');assert.equal(counted,0,'no paid usage recorded');
   // Missing from the library: painted as before (when the allowance allows).
   const missing=await ask({...portrait,id:'n4',pool:'np0003'},{mayPaint:()=>true});assert.equal(missing.status,'pending');for(let i=0;i<100&&!paid;i++)await new Promise(res=>setTimeout(res,10));assert.equal(paid,1);
   // Painted before (at that key): kept.
   fs.mkdirSync(art,{recursive:true});fs.writeFileSync(path.join(art,artKey(validateSubject({...portrait,id:'n5'}))+'.jpg'),jpeg('older'));const kept=await ask({...portrait,id:'n5'});assert.ok(!kept.library);assert.ok(Buffer.from(kept.dataUrl.split(',')[1],'base64').includes(Buffer.from('older')));
   // The library's own portraits: painted only for the host; a guest's request never paints them.
   const own=lib.portraitSubject(person('np0009',{name:'Hester Quell'}));assert.equal(own.campaignId,lib.peopleCampaign);assert.match(own.description,/no beard/);validateSubject(own);
   const guest=await ask(own,{mayPaint:()=>true});assert.equal(guest.status,'failed');assert.match(guest.error,/Only the host/);
   const before=paid;const host=await store.request(lib.portraitSubject(person('np0010',{name:'Ida Quell'})),{apiKey:'test-only',model:'test-model',host:true});for(let i=0;i<100&&paid===before;i++)await new Promise(res=>setTimeout(res,10));assert.equal(paid,before+1,'the host paints it');assert.ok(['pending','ready'].includes(host.status)||host.status==='failed');
   assert.match(readText('dm-server.cjs'),/safety,mayPaint,host:!guest,/,'the Dungeon Master says whether the host asked');
   console.log('Portraits: a library person is shown with their ready portrait at no cost (no painting, no usage), painted as before only when it is missing; a painting made earlier is kept; only the host paints the library itself.');}
  // ---------- The story writer may cast residents from the library ----------
  {const {generateAdventure,castResidents}=require('./adventure-generator.cjs'),{journeyStory}=require('./journey-fixtures.cjs');
   const cast=[stock[0],stock[1]],calls=[];
   const tale=journeyStory(0);tale.residents[0]={...tale.residents[0],name:'Oswin Reedly',pool:'np0002',appearance:'A tall stranger.'};tale.residents[1]={...tale.residents[1],pool:'np0001'};tale.residents.push({...tale.residents[0],name:'Oswin Reedly',at:'tower'});
   const fetchImpl=async(url,options)=>{calls.push(JSON.parse(options.body));return done(JSON.parse(JSON.stringify(tale)));};
   const got=await generateAdventure({input:'x',context:{mode:'adventure',introId:'easy',easyStart:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl,cast});
   const sent=calls[0],items=sent.text.format.schema.properties.residents.items;same(items.properties.pool.enum,[null,'np0001','np0002']);assert.ok(items.required.includes('pool'),'strict: pool required');
   assert.match(sent.instructions,/READY-MADE PEOPLE: context\.castable/);same(JSON.parse(sent.input).context.castable.map(c=>c.pool),['np0001','np0002']);
   const [oswin,second,third]=[got.story.residents[0],got.story.residents[1],got.story.residents.at(-1)];
   assert.equal(oswin.pool,'np0002');assert.equal(oswin.gender,'man');assert.match(oswin.appearance,/tarred coat/,'the library\'s look, so the ready portrait fits');assert.equal(oswin.role,tale.residents[0].role,'the tale\'s own role');
   assert.equal(second.pool,undefined,'a pool id under another name is dropped');assert.equal(third.pool,undefined,'never cast twice');
   const hero=r.readyHero('fighter'),game=r.freshStoryGame(hero,JSON.parse(JSON.stringify(got.story)),r.newAdventure(hero));
   const seated=Object.entries(game.people).find(([,p])=>p.pool==='np0002');assert.ok(seated&&seated[1].resident,'seated with its pool id');assert.ok(r.validAdventure(r.adventureSnapshot(hero,game,null,true),hero));
   assert.equal(r.npcArtSubject(game,seated[0]).pool,'np0002','its portrait comes from the library');
   // No cast, the next tale in a region, or a dm-server write without a library: as before.
   calls.length=0;const plain=await generateAdventure({input:'x',context:{mode:'adventure',introId:'easy',easyStart:true,choices:[]}},{apiKey:'k',model:'m',fetchImpl});assert.equal(calls[0].text.format.schema.properties.residents.items.properties.pool,undefined);assert.ok(plain.story.residents.every(x=>x.pool===undefined));
   calls.length=0;await generateAdventure({input:'x',context:{mode:'adventure',introId:'easy',easyStart:true,choices:[],continuing:{previousTitle:'Old',newStartBearing:'north'}}},{apiKey:'k',model:'m',fetchImpl,cast}).catch(()=>{});assert.ok(!calls[0].input.includes('castable'),'the next tale in a region casts nobody from the library');
   calls.length=0;await server.generate({input:'Create a fresh adventure.',context:{mode:'adventure',introId:'caravan',choices:[]}},{apiKey:'k',model:'m',fetchImpl,people:roster}).catch(()=>{});assert.ok(JSON.parse(calls[0].input).context.castable.length>=4,'the Dungeon Master offers the writer people from the library');
   calls.length=0;await server.generate({input:'Create a fresh adventure.',context:{mode:'adventure',introId:'caravan',choices:[]}},{apiKey:'k',model:'m',fetchImpl}).catch(()=>{});assert.ok(!calls[0].input.includes('castable'));
   same(castResidents({residents:[{name:'X',pool:'np0009'}]},[]).residents[0].pool,undefined);
   console.log('Story writer: offered a dozen ready-made people for a fresh tale (never the next tale in a region), a resident cast from them keeps the library\'s name, kind, gender, class and look (and so its ready portrait), the tale\'s own role; seated with its pool id.');}
  // ---------- make-people-library.cjs against a stand-in Dungeon Master ----------
  {const data=path.join(tmp,'data');fs.mkdirSync(data,{recursive:true});let batches=0,paintings=0,quota=false;
   const fake=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{const body=JSON.parse(raw),c=body.context,send=(s,d)=>{res.writeHead(s,{'Content-Type':'application/json'});res.end(JSON.stringify(d));};
    if(req.headers.origin!=='http://localhost:8081')return send(403,{error:'Origin'});
    if(c.mode==='people-batch'){batches++;const avoid=new Set((c.avoidNames??[]).map(n=>n.split(' ')[0].toLowerCase()));const out=writer.tidyPeople({people:c.brief.map((s,i)=>({...person(s.slot,{name:'Ka'+[...s.slot.slice(2)].map(d=>'abcdefghij'[d]).join('')+' Holt',gender:s.gender,species:s.species,class:s.class,placeKinds:s.placeKinds,terrains:[s.terrain]}),slot:s.slot,...(i===0&&batches===1?{name:'Gandalf Grey'}:{})}))},c.brief,c.avoidNames);void avoid;return send(200,out);}
    if(c.mode==='art'){if(quota)return send(200,{status:'failed',key:'k',error:'Image generation reached an API usage limit. Retry later.'});paintings++;return send(200,{status:'ready',key:'k',dataUrl:'data:image/jpeg;base64,'+jpegB64});}
    send(400,{error:'mode'});});});
   const jpegB64=Buffer.from([255,216,255,224,1,2,255,217]).toString('base64');
   await new Promise(res=>fake.listen(0,'127.0.0.1',res));const url='http://127.0.0.1:'+fake.address().port+'/dm';
   const run=args=>new Promise(res=>{const {spawn}=require('node:child_process');const p=spawn(process.execPath,['make-people-library.cjs','--no-desktop',...args],{env:{...process.env,QUESTBOUND_DATA:data,QB_DM_URL:url},cwd:__dirname});let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);p.on('close',code=>res({code,out}));});
   let a=await run(['--limit','30']);assert.equal(a.code,0,a.out);let library=JSON.parse(fs.readFileSync(path.join(data,'.questbound-people','library.json'),'utf8'));
   assert.ok(library.length>=29&&library.length<=30,'a limited run writes about that many: '+library.length);assert.ok(fs.existsSync(path.join(data,'.questbound-people','plan.json')));assert.ok(!library.some(p=>/Gandalf/.test(p.name)));
   a=await run(['--limit','15']);library=JSON.parse(fs.readFileSync(path.join(data,'.questbound-people','library.json'),'utf8'));assert.ok(library.length>=44&&library.length<=45,'resumed where it stopped: '+library.length);assert.equal(new Set(library.map(p=>p.id)).size,library.length);
   assert.ok(library.every(lib.validPerson));same(library.map(p=>p.id),[...library.map(p=>p.id)].sort(),'kept in id order');
   a=await run(['--portraits','--limit','5']);assert.equal(a.code,0,a.out);assert.equal(paintings,5);assert.equal(fs.readdirSync(path.join(data,'.questbound-people')).filter(f=>f.endsWith('.jpg')).length,5);assert.match(a.out,/about \$0\.15/);
   a=await run(['--portraits','--limit','3']);assert.equal(paintings,8,'resumed: the painted ones skipped');
   quota=true;a=await run(['--portraits']);assert.equal(a.code,2,'a quota refusal stops cleanly');assert.match(a.out,/Stopped: OpenAI refused the painting for billing, quota or access/);
   quota=false;fs.writeFileSync(path.join(data,'.questbound-total-budget'),'2');fs.writeFileSync(path.join(data,'.questbound-usage.jsonl'),JSON.stringify({at:new Date().toISOString(),mode:'turn',model:'gpt-6-luna',input:0,output:0,images:1})+'\n');
   a=await run(['--portraits']);assert.equal(a.code,0);assert.match(a.out,/would pass the daily ceiling of \$2\.00 less the \$2\.00 kept for players/,'stops before today\'s ceiling');assert.equal(paintings,8);
   a=await run(['--plan']);assert.match(a.out,/Plan written: 1000 people/);
   fake.close();
   console.log('make-people-library.cjs: writes the plan, then the people in batches (refused names asked again), resumable; paints one portrait at a time, resumable; stops cleanly on a quota refusal and before today\'s spending ceiling.');}
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log('Passed: the people library.');
 }catch(e){fs.rmSync(tmp,{recursive:true,force:true});console.error(e);process.exit(1);}
})();
