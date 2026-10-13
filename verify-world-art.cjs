const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createArtStore,artKey,artPrompt,validateSubject}=require('./world-art.cjs');
const sample={campaignId:'test-campaign',id:'keeper',kind:'portrait',name:'Orin',description:'An old dwarf potter with silver braids and a burnished copper apron.',setting:'A riverside pottery.'};
const vm=require('node:vm'),syncFs=require('node:fs');
const subjectRules=vm.runInNewContext(['mapRules.js','dungeonRules.js','worldArtRules.js'].map(f=>syncFs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n')+'\n({npcArtSubject,locationArtSubject,creatureArtSubject,placeArtSubject,heroArtSubject})');
const storyGame={stage:'inn',story:{id:'story-alpha',premise:'A snowbound harbor.',locations:{inn:{name:'Harbor Camp',description:'An icy camp.'}},npcs:{keeper:{name:'Orin',appearance:'A dwarf with copper spectacles.',role:'Potter'},mara:{name:'Vessa',appearance:'A dragonborn with silver horns.',role:'Cartographer'}},foe:'Ice crawler',foeAppearance:'A small six-legged translucent crustacean.'}};
assert.match(subjectRules.npcArtSubject(storyGame,'keeper').description,/copper spectacles/);assert.match(subjectRules.npcArtSubject(storyGame,'mara').description,/dragonborn/);assert.notEqual(artKey(subjectRules.npcArtSubject(storyGame,'keeper')),artKey(subjectRules.npcArtSubject(storyGame,'mara')));assert.equal(subjectRules.locationArtSubject(storyGame).name,'Harbor Camp');assert.equal(subjectRules.creatureArtSubject(storyGame),null);assert.match(subjectRules.creatureArtSubject({...storyGame,stage:'combat'}).description,/six-legged/);
// Arrival plates in the story feed reuse the exact scene painting of the place (same key: no second paid image).
assert.equal(artKey(subjectRules.placeArtSubject(storyGame,'Harbor Camp')),artKey(subjectRules.locationArtSubject(storyGame)));
assert.equal(artKey(subjectRules.placeArtSubject({stage:'inn'},'the Crossroads Inn')),artKey(subjectRules.locationArtSubject({stage:'inn'})));
assert.equal(subjectRules.placeArtSubject(storyGame,'Nowhere'),null);
// The player's hero gets one portrait: valid for the art store, distinct per hero, unchanged by levelling up.
const kara={name:'Kara Vell',species:'Human',class:'Fighter',level:1,background:'Soldier',age:'29',description:'A broad-shouldered veteran with a scarred jaw.'};
const karaArt=subjectRules.heroArtSubject(kara);validateSubject(karaArt);assert.equal(karaArt.kind,'portrait');assert.match(karaArt.description,/scarred jaw/);assert.match(karaArt.description,/Human Fighter/);
assert.equal(artKey(subjectRules.heroArtSubject({...kara,level:5})),artKey(karaArt),'Levelling up keeps the portrait');
assert.notEqual(artKey(subjectRules.heroArtSubject({...kara,name:'Pip Thistledown'})),artKey(karaArt));assert.notEqual(artKey(subjectRules.heroArtSubject({...kara,class:'Wizard'})),artKey(karaArt));
assert.equal(subjectRules.heroArtSubject(null),null);validateSubject(subjectRules.heroArtSubject({name:'X'.repeat(300),class:'Rogue',description:'Y'.repeat(4000)}));
const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
const guardian=subjectRules.creatureArtSubject({...storyGame,stage:'combat',dungeon:{active:true,room:2}});
assert.equal(guardian.name,'Stone Sentinel');assert.match(guardian.description,/stone sentinel/i);assert.ok(!guardian.description.includes('crustacean'),'A dungeon guardian must not inherit the unrelated main foe appearance');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'questbound-art-tests-'));
 try{
  let calls=0,releases=[],maximum=0,active=0;
  const store=createArtStore({directory,concurrency:1,fetchImpl:async(url,options)=>{
   assert.equal(url,'https://api.openai.com/v1/responses');const payload=JSON.parse(options.body);assert.equal(payload.store,false);assert.equal(payload.tools.length,1);assert.equal(payload.tools[0].quality,'low');assert.equal(payload.tools[0].output_format,'jpeg');assert.ok(payload.input.includes('Orin')||payload.input.includes('Vessa'));
   calls++;active++;maximum=Math.max(maximum,active);await new Promise(resolve=>releases.push(resolve));active--;return {ok:true,json:async()=>({status:'completed',output:[{type:'image_generation_call',status:'completed',result:Buffer.from([255,216,255,217]).toString('base64')}]})};
  }});
  const other={...sample,id:'mara',name:'Vessa',description:'A young dragonborn cartographer in a moss-green coat, silver horns and a crystal ear cuff.'};
  assert.notEqual(artKey(sample),artKey(other));assert.notEqual(artKey(sample),artKey({...sample,campaignId:'different-story'}));
  const [first,duplicate]=await Promise.all([store.request(sample,{apiKey:'test-only',model:'test-model'}),store.request(sample,{apiKey:'test-only',model:'test-model'})]);assert.equal(first.status,'pending');assert.equal(first.key,duplicate.key);assert.equal(calls,1);
  await store.request(other,{apiKey:'test-only',model:'test-model'});assert.equal(calls,1,'Only one generation runs at a time');
  releases.shift()();let ready;
  for(let i=0;i<100;i++){ready=await store.request(sample,{apiKey:'test-only',model:'test-model'});if(ready.status==='ready')break;await wait();}assert.equal(ready.status,'ready');assert.match(ready.dataUrl,/^data:image\/jpeg;base64,/);
  assert.equal(calls,2);assert.equal(maximum,1);releases.shift()();
  for(let i=0;i<100;i++){if((await store.request(other,{apiKey:'test-only',model:'test-model'})).status==='ready')break;await wait();}
  // With the default of two painters, two illustrations run at once and a third waits.
  let running2=0,peak2=0;const gates2=[];
  const pair=createArtStore({directory,fetchImpl:async()=>{running2++;peak2=Math.max(peak2,running2);await new Promise(resolve=>gates2.push(resolve));running2--;return {ok:true,json:async()=>({status:'completed',output:[{type:'image_generation_call',status:'completed',result:Buffer.from([255,216,255,217]).toString('base64')}]})};}});
  for(const id of ['p1','p2','p3'])await pair.request({...sample,id,campaignId:'parallel'},{apiKey:'test-only',model:'test-model'});
  await wait();assert.equal(running2,2,'Two illustrations paint at once');
  while(gates2.length||running2){gates2.shift()?.();await wait();}assert.equal(peak2,2,'Never more than two at once');
  const restarted=createArtStore({directory,fetchImpl:async()=>{throw Error('Cache should prevent provider calls');}});
  const reloaded=await restarted.request({...sample,description:'A transient expression does not change the character identity.'},{apiKey:'test-only',model:'test-model'});assert.equal(reloaded.dataUrl,ready.dataUrl);
  assert.ok((await fs.readFile(path.join(directory,first.key+'.json'),'utf8')).includes('copper apron'));
  assert.throws(()=>validateSubject({...sample,kind:'../../secret'}));assert.throws(()=>validateSubject({...sample,description:'x'.repeat(1801)}));
  assert.match(artPrompt(other),/dragonborn/);assert.ok(!artPrompt(other).includes('salt-and-pepper'));
  const failed=createArtStore({directory,fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:{message:'private key secret'}})})});
  const third={...sample,id:'blocked'};await failed.request(third,{apiKey:'secret'});await wait();const denied=await failed.request(third,{apiKey:'secret'});
  assert.equal(denied.status,'failed');assert.match(denied.error,/access|verification/);assert.ok(!JSON.stringify(denied).includes('secret'));
  const invalid=createArtStore({directory,fetchImpl:async()=>({ok:true,json:async()=>({data:[{b64_json:'<script>'}]})})});
  const fourth={...sample,id:'invalid'};await invalid.request(fourth,{apiKey:'test'});await wait();assert.equal((await invalid.request(fourth)).status,'failed');
  // A guest past the host's daily allowance gets no new painting (one already made is still shown); OpenAI is told
  // which guest asked (by label), and what each painting cost is handed back to be counted.
  let told=null;const counted=[];
  const guarded=createArtStore({directory,fetchImpl:async(url,options)=>{told=JSON.parse(options.body).safety_identifier??null;return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:50,output_tokens:10},output:[{type:'image_generation_call',status:'completed',result:Buffer.from([255,216,255,217]).toString('base64')}]})};}});
  const refused=await guarded.request({...sample,id:'over-allowance'},{apiKey:'test-only',model:'test-model',mayPaint:()=>false});assert.equal(refused.status,'failed');assert.match(refused.error,/allowance/);
  assert.equal((await guarded.request(sample,{apiKey:'test-only',model:'test-model',mayPaint:()=>false})).status,'ready','a painting already made is still shown');
  await guarded.request({...sample,id:'guest-paint'},{apiKey:'test-only',model:'test-model',safety:{safety_identifier:'qb-guest-abc'},mayPaint:()=>true,onPainted:(usage,imageModel)=>counted.push({usage,imageModel})});
  for(let i=0;i<100&&!counted.length;i++)await wait();
  assert.equal(told,'qb-guest-abc');assert.equal(counted.length,1);assert.equal(counted[0].usage.input_tokens,50);assert.ok(counted[0].imageModel);
  // Memory keeps only the most recent few hundred finished jobs (the paintings themselves are on disk).
  const many=createArtStore({directory,fetchImpl:async()=>{throw Error('never painted');}});
  for(let i=0;i<330;i++)await many.request({...sample,id:'m'+i,campaignId:'many'},{apiKey:'test-only',model:'test-model',mayPaint:()=>false});
  assert.ok(many.size()<=300,'old jobs are let go: '+many.size());
  console.log('Passed: distinct character/campaign identities, one request per subject, background queue, persistent image reuse, subject validation, secret-safe failures, the guests\' allowance, the guest label sent to OpenAI and bounded memory. No paid calls.');
 }finally{const resolved=path.resolve(directory),temp=path.resolve(os.tmpdir())+path.sep;if(!resolved.startsWith(temp)||!path.basename(resolved).startsWith('questbound-art-tests-'))throw Error('Unsafe temporary path');await fs.rm(resolved,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
// ---------- The host's library of ready landscape paintings (place-library.cjs) ----------
// Every place the player arrives at is shown from the library at no cost: matched on kind and terrain, the same
// picture for a place every time, different pictures for two places of one tale while another fits, a painting made
// before the library kept, and painting as before only while the library has nothing for that land yet.
const library=require('./place-library.cjs');
(async()=>{
 const rules=vm.runInNewContext(syncFs.readFileSync('mapRules.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')+'\n({placeKinds,terrains})');
 assert.deepEqual([...library.placeKinds],[...rules.placeKinds],'place-library.cjs keeps mapRules placeKinds');assert.deepEqual([...library.terrains],[...rules.terrains],'place-library.cjs keeps mapRules terrains');
 // The subjects say what to match on, the scene and the arrival plate alike, without changing the art key.
 const snowy={stage:'wild',story:{id:'story-snow',premise:'A frozen pass.',terrain:'snow',locations:{inn:{name:'Frostgate Camp',description:'Tents under the ice wall.',kind:'camp'},bridge:{name:'The Narrows',description:'A gorge road.'},tower:{name:'Hollow Spire',description:'A broken tower.',kind:'ruin'}}},world:{at:'p2',regions:[{id:'r1',name:'The Ember Wastes',terrain:'desert'}],places:[{id:'p1',name:'Rime Lake',description:'A frozen lake.',kind:'water',x:100,y:0,from:'inn'},{id:'p2',name:'Glass Dunes Oasis',description:'Palms by a pool.',kind:'water',x:900000,y:0,from:'p1',region:'r1'}]}};
 const here=subjectRules.locationArtSubject(snowy);assert.equal(here.placeKind,'water');assert.equal(here.terrain,'desert','a place in another land takes that land\'s terrain');
 assert.deepEqual({...subjectRules.placeArtSubject(snowy,'Glass Dunes Oasis')},{...here},'the arrival plate is the scene\'s own subject');
 assert.equal(subjectRules.placeArtSubject(snowy,'Rime Lake').terrain,'snow');
 const camp=subjectRules.placeArtSubject(snowy,'Frostgate Camp');assert.equal(camp.placeKind,'camp');assert.equal(camp.terrain,'snow');
 assert.equal(subjectRules.placeArtSubject(snowy,'The Narrows').placeKind,undefined,'a starting place without a kind is matched by its words on the server');
 const inn=subjectRules.locationArtSubject({stage:'inn'});assert.equal(inn.placeKind,'settlement');assert.equal(inn.terrain,'forest');assert.equal(subjectRules.placeArtSubject({stage:'inn'},'Old Stone Bridge').placeKind,'water');
 const vault=subjectRules.locationArtSubject({stage:'inn',dungeon:{active:true,room:5}});assert.equal(vault.id,'dungeon-5');assert.equal(vault.placeKind,'shrine');assert.equal(vault.terrain,'caverns');
 assert.equal(artKey(here),artKey({campaignId:here.campaignId,kind:here.kind,id:here.id}),'kind and terrain never change the key');
 const checked=validateSubject(here);assert.equal(checked.placeKind,'water');assert.equal(checked.terrain,'desert');
 const odd=validateSubject({...here,placeKind:'../../etc',terrain:'volcano'});assert.ok(!('placeKind' in odd)&&!('terrain' in odd),'unknown kinds and terrains are left out');
 assert.ok(!('placeKind' in validateSubject({...sample,placeKind:'settlement',terrain:'snow'})),'only landscapes carry them');
 // Old clients: the words decide.
 assert.deepEqual({...library.matchOf({id:'p9',name:'Saltreed Fen Ferry',description:'A rope ferry over a reed-choked bog river.',setting:''})},{kind:'water',terrain:'marsh'});
 assert.deepEqual({...library.matchOf({id:'p9',name:'The Ruined Watchtower',description:'Crumbling stone on a snowy ridge.',setting:''})},{kind:'ruin',terrain:'snow'});
 assert.deepEqual({...library.matchOf({id:'inn',name:'The Copper Kettle',description:'Warm and loud.',setting:''})},{kind:'settlement',terrain:'plains'});
 // Choosing: same kind and land; then a related kind in that land; never a stranger's land while the library fills.
 const E=(kind,terrain,n)=>({id:kind+'-'+terrain+'-'+n,kind,terrain,file:kind+'-'+terrain+'-'+n+'.jpg'});
 const shelf=[E('settlement','plains',1),E('settlement','plains',2),E('camp','plains',1),E('ruin','snow',1)];
 const at={campaignId:'tale-1',placeId:'p1'};
 const first=library.choosePicture(shelf,{kind:'settlement',terrain:'plains'},at);assert.equal(first.kind,'settlement');
 assert.equal(library.choosePicture(shelf,{kind:'settlement',terrain:'plains'},at).id,first.id,'the same place always draws the same picture');
 const other=library.choosePicture(shelf,{kind:'settlement',terrain:'plains'},{...at,taken:new Set([first.id])});assert.equal(other.kind,'settlement');assert.notEqual(other.id,first.id,'a second village of the tale gets the other one');
 assert.equal(library.choosePicture(shelf,{kind:'settlement',terrain:'plains'},{...at,taken:new Set(['settlement-plains-1','settlement-plains-2'])}).id,'camp-plains-1','then a related kind in the same land');
 assert.ok(['settlement-plains-1','settlement-plains-2'].includes(library.choosePicture(shelf,{kind:'settlement',terrain:'plains'},{...at,taken:new Set(['settlement-plains-1','settlement-plains-2','camp-plains-1'])}).id),'a repeat only when nothing else fits');
 assert.equal(library.choosePicture(shelf,{kind:'cave',terrain:'plains'},at),null,'nothing fitting in that land yet: painted');
 assert.equal(library.choosePicture(shelf,{kind:'settlement',terrain:'desert'},at),null,'no picture of that land yet: painted');
 const draws=new Set(Array.from({length:20},(_,i)=>library.choosePicture(shelf,{kind:'settlement',terrain:'plains'},{campaignId:'tale-'+i,placeId:'inn'}).id));assert.equal(draws.size,2,'tales share the variants out');
 const full=[];for(const t of library.terrains)for(const k of library.placeKinds)full.push(E(k,t,1));
 assert.ok(library.kindTerrainComplete(full)&&!library.kindTerrainComplete(shelf));
 assert.equal(library.choosePicture(full.filter(e=>!(e.terrain==='desert'&&['cave','lair','ruin','mountain'].includes(e.kind))),{kind:'cave',terrain:'desert'},{...at,complete:true}).kind,'cave','once complete, a lost picture is stood in for by the same kind elsewhere');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'questbound-art-tests-'));
 try{
  const art=path.join(directory,'art'),shelfDir=path.join(directory,'place-art');await fs.mkdir(shelfDir,{recursive:true});
  const jpeg=id=>Buffer.concat([Buffer.from([255,216,255,224]),Buffer.from(id),Buffer.from([255,217])]);
  const stock=async list=>{for(const e of list)await fs.writeFile(path.join(shelfDir,e.file),jpeg(e.id));await fs.writeFile(path.join(shelfDir,'library.json'),JSON.stringify(list.map(e=>({...e,light:'at dawn',name:'x',description:'y'}))));};
  await stock([...shelf,E('water','marsh',1),E('road','marsh',1)]);
  let paid=0,counted=0;const fetchImpl=async()=>{paid++;return {ok:true,json:async()=>({status:'completed',output:[{type:'image_generation_call',status:'completed',result:Buffer.from([255,216,255,217]).toString('base64')}]})};};
  const open=()=>createArtStore({directory:art,libraryDirectory:shelfDir,fetchImpl,placeLibrary:library.createPlaceLibrary({directory:shelfDir,picksDirectory:path.join(art,'place-picks'),refreshMs:0})});
  const store=open(),ask=(subject,options={})=>store.request(subject,{apiKey:'test-only',model:'test-model',mayPaint:()=>false,onPainted:()=>counted++,...options});
  const place=(id,placeKind,terrain,extra={})=>({campaignId:'tale-1',kind:'landscape',id,name:'Place '+id,description:'A place.',setting:'',placeKind,terrain,...extra});
  // Two villages arrive at once: different pictures, at once, unpaid, past the allowance and without a key.
  const [a,b]=await Promise.all([ask(place('inn','settlement','plains')),ask(place('p1','settlement','plains'),{apiKey:null})]);
  assert.equal(a.status,'ready');assert.equal(b.status,'ready');assert.ok(a.library&&b.library);assert.notEqual(a.library,b.library,'two places of one tale, two pictures');
  assert.equal(a.key,artKey(place('inn','settlement','plains')));assert.match(a.dataUrl,/^data:image\/jpeg;base64,/);assert.ok(Buffer.from(a.dataUrl.split(',')[1],'base64').includes(Buffer.from(a.library)),'the library\'s own file');
  const c=await ask(place('p2','settlement','plains'));assert.equal(c.library,'camp-plains-1');
  // An old client (no kind or terrain): the words decide.
  const ferry=await ask({campaignId:'tale-1',kind:'landscape',id:'p3',name:'Saltreed Ferry',description:'A rope ferry over a reed-choked bog.',setting:''});assert.equal(ferry.library,'water-marsh-1');
  assert.equal(paid,0,'no painting for a library picture');assert.equal(counted,0,'no paid usage recorded');
  // Nothing for that land yet: painted as before (and counted).
  const dune=await ask(place('p4','settlement','desert'),{mayPaint:()=>true});assert.equal(dune.status,'pending');
  for(let i=0;i<100&&!counted;i++)await wait();assert.equal(paid,1);assert.equal(counted,1);
  // Portraits and creatures are painted as today.
  await ask({...sample,campaignId:'tale-1',id:'n1'},{mayPaint:()=>true});for(let i=0;i<100&&counted<2;i++)await wait();assert.equal(paid,2);
  // The library's own paintings go to the painter, never answered from the library.
  await ask(place('settlement-plains-3','settlement','plains',{campaignId:library.libraryCampaign}),{mayPaint:()=>true});for(let i=0;i<100&&counted<3;i++)await wait();assert.equal(paid,3);
  // A place painted before the library keeps its painting.
  const old=place('p5','settlement','plains');await fs.writeFile(path.join(art,artKey(old)+'.jpg'),Buffer.from([255,216,255,1,2,217]));
  const kept=await ask(old);assert.equal(kept.status,'ready');assert.ok(!kept.library);assert.equal(kept.dataUrl,'data:image/jpeg;base64,'+Buffer.from([255,216,255,1,2,217]).toString('base64'));
  // A place never changes picture: after a restart, and when the library gains a picture it would have preferred.
  await stock([...shelf,E('water','marsh',1),E('road','marsh',1),...[3,4,5,6,7,8].map(n=>E('settlement','plains',n))]);
  const again=open(),reopened=await again.request(place('p1','settlement','plains'),{apiKey:'test-only'});assert.equal(reopened.library,b.library,'kept across restarts and a growing library');
  assert.equal((await again.request(place('p2','settlement','plains'))).library,'camp-plains-1');
  // A new place in that tale now gets one of the new villages, not a picture already taken.
  const fresh=await again.request(place('p6','settlement','plains'));assert.ok(![a.library,b.library].includes(fresh.library)&&fresh.library.startsWith('settlement-plains-'));
  // A picture that cannot be read is passed over for another.
  const broken=E('ruin','hills',1),spare=E('landmark','hills',1);await stock([broken,spare]);await fs.writeFile(path.join(shelfDir,broken.file),'not a picture');
  assert.equal((await again.request(place('p7','ruin','hills'))).library,'landmark-hills-1');
  // An empty or missing library paints as before.
  await fs.rm(path.join(shelfDir,'library.json'));const before=paid;await again.request(place('p8','ruin','hills'),{apiKey:'test-only',model:'test-model'});for(let i=0;i<100&&paid===before;i++)await wait();assert.equal(paid,before+1);
  // Malformed entries never reach the disk (no paths, no unknown kinds).
  await fs.writeFile(path.join(shelfDir,'library.json'),JSON.stringify([{id:'../x',kind:'ruin',terrain:'hills',file:'../x.jpg'},{id:'ruin-hills-2',kind:'ruin',terrain:'hills',file:'../../secret.jpg'},{id:'ruin-lava-1',kind:'ruin',terrain:'lava',file:'ruin-lava-1.jpg'}]));
  const shelfOnly=library.createPlaceLibrary({directory:shelfDir,picksDirectory:path.join(art,'place-picks'),refreshMs:0});await shelfOnly.refresh();assert.equal(shelfOnly.entries().length,0);
  console.log('Passed: the place-art library: subjects carry kind and terrain without changing keys, matching by kind and land, related kinds, keyword matching for old clients, one picture per place kept across restarts, no repeats within a tale while another fits, no painting or usage for library pictures, painting as before when nothing fits yet, paintings made before kept, unreadable or malformed entries passed over. No paid calls.');
 }finally{const resolved=path.resolve(directory),temp=path.resolve(os.tmpdir())+path.sep;if(!resolved.startsWith(temp)||!path.basename(resolved).startsWith('questbound-art-tests-'))throw Error('Unsafe temporary path');await fs.rm(resolved,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
