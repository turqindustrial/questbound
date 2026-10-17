// The creature library (2026-10-17, the host's words: "we should do the same thing for all creatures as well", as for
// places and people: ready-made pictures, so creatures stop costing paintings). Checks: the catalogue (about 150
// pictures, unique ids, our own words with no other publisher's names, every template of the game covered by its own
// look); matching every creature the live game has met (by kind first, then what sets one apart, then the land); the
// same creature always drawing the same picture, two creatures of one tale two pictures while another fits, kept for
// good; the painter answering creatures from the library with no painting and no usage, a painting made before kept,
// a creature the library has nothing like painted and noted for the host (mechanical only), the library's own
// campaign painted only by the host; the subjects the game sends; host-job tagging; and make-creature-library.cjs
// end to end against a stand-in Dungeon Master. Stand-in providers only: nothing here calls OpenAI.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),http=require('node:http');
const {rulesSource}=require('./rules-files.cjs');
const catalogue=require('./creature-catalogue.cjs'),L=require('./creature-library.cjs'),fixtures=require('./creature-fixtures.cjs');
const {createArtStore,artKey,validateSubject,creatureCampaign}=require('./world-art.cjs');
const r=vm.runInNewContext(rulesSource({extra:['worldArtRules.js']})+'\n({templateKeys,hostileFoes,terrains,readyHero,newAdventure,freshStoryGame,creatureArtSubject,startWildFight,hostileEncounterGame,locationArtSubject})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const jpeg=id=>Buffer.concat([Buffer.from([255,216,255,224]),Buffer.from(String(id)),Buffer.from([255,217])]);
const shown=answer=>Buffer.from(String(answer.dataUrl).split(',')[1]??'','base64').toString('latin1');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qb-creatures-'));
(async()=>{
 try{
  // ---------- The catalogue ----------
  const {entries,pictures}=catalogue;
  assert.ok(pictures.length>=140&&pictures.length<=180,'about 150 pictures: '+pictures.length);assert.ok(entries.length>=120,'kinds: '+entries.length);
  assert.equal(new Set(pictures.map(p=>p.id)).size,pictures.length,'unique picture ids');assert.equal(new Set(entries.map(e=>e.id)).size,entries.length,'unique entry ids');
  for(const e of entries){
   assert.match(e.id,/^[a-z]+(?:-[a-z]+)+$/,'kind-variant ids: '+e.id);assert.ok(catalogue.families.includes(e.family),e.id);assert.ok(catalogue.sizes.includes(e.size),e.id);
   assert.ok(e.terrains.length&&e.terrains.every(t=>catalogue.terrains.includes(t)),e.id+' lands');assert.ok(e.names.length&&e.tags.length,e.id);assert.ok(e.variants.length>=1&&e.variants.length<=2,e.id);
   assert.ok(e.templates.every(t=>r.templateKeys.includes(t)),e.id+' templates');
  }
  for(const p of pictures){assert.match(p.id,/^[a-z]+(?:-[a-z]+)+-[12]$/);const words=p.description.split(/\s+/).length;assert.ok(p.template?words>=20:words>=30&&words<=80,'a 30–60 word painting description: '+p.id+' '+words);assert.ok(!/\b(?:text|letters|caption|label)\b/i.test(p.description),p.id);}
  same(catalogue.terrains,[...r.terrains],'creature-catalogue.cjs keeps mapRules terrains');same(L.templateKeys,[...r.templateKeys],'creature-library.cjs keeps encounterRules templateKeys');
  for(const f of r.hostileFoes){
   assert.equal(catalogue.templateLooks[f.key],f.appearance,'the template\'s own look, word for word: '+f.key);
   const own=pictures.filter(p=>p.template===f.key);assert.equal(own.length,1,'one picture is the '+f.key+' template itself');assert.equal(own[0].description,f.appearance);assert.ok(own[0].templates.includes(f.key));
  }
  // Our own words: no other publisher's creatures, places or people (the SRD's licensed creatures are fine).
  const deny=/\b(?:beholders?|mind ?flayers?|illithids?|displacer|carrion crawlers?|umber hulks?|githyanki|githzerai|kuo-?toa|slaad|slaadi|yuan-?ti|gauth|tiamat|bahamut|strahd|vecna|lolth|orcus|demogorgon|asmodeus|drizzt|elminster|mordenkainen|tasha|bigby|underdark|faer[uû]n|waterdeep|ravenloft|eberron|greyhawk|baldur|neverwinter|wargs?|nazg[uû]l|balrogs?|uruks?|ents|hobbits?|middle-earth|westeros|skaven|nurgle|khorne|tyranids?|draugr|drowners?|leshen|xenomorphs?|cthulhu|shoggoths?|dementors?|dungeons ?& ?dragons|d&d|pathfinder|golarion|warhammer)\b/i;
  for(const e of entries){const text=[e.id,...e.names,...e.tags,e.look,...e.variants.map(v=>v.twist+' '+v.tags.join(' '))].join(' ');assert.ok(!deny.test(text),'own words: '+e.id+' '+(text.match(deny)??[''])[0]);}
  console.log('Catalogue: '+pictures.length+' pictures of '+entries.length+' kinds, unique ids, painting descriptions in our own words, every template of the game covered by its own look.');
  // ---------- Matching every creature the live game has met ----------
  for(const [name,description,template,creatureKind,want] of fixtures){
   const subject={kind:'creature',campaignId:'tale-fixtures',id:'x',name,description,...(template?{template}:{}),...(creatureKind?{creatureKind}:{})};
   const got=L.choosePicture(pictures,subject);
   if(want===null)assert.equal(got,null,name+' is painted: the library has nothing like it');
   else assert.ok(got&&want.some(w=>got.id===w||got.entry===w),name+' should look like '+want.join(' or ')+', got '+(got?.id??'nothing'));
  }
  // The person guard: someone of an invented people is never shown as a monster.
  assert.equal(L.choosePicture(pictures,{kind:'creature',campaignId:'t',id:'f',name:'Vesk',description:'A fifty-year-old woman of the reed people with green skin and a long braid.'}),null);
  assert.equal(L.choosePicture(pictures,{kind:'creature',campaignId:'t',id:'f',name:'Something',description:'Hard to describe.'}),null,'nothing to go on: painted');
  // The kind named first wins: an orc in a wolf pelt is an orc.
  assert.equal(L.choosePicture(pictures,{kind:'creature',campaignId:'t',id:'f',name:'Grall',description:'A scarred orc in a wolf-pelt cloak with a heavy axe.'}).entry,'orc-marauder');
  assert.equal(L.choosePicture(pictures,{kind:'creature',campaignId:'t',id:'f',name:'Ashmaw',description:'A young red dragon coiled on a hoard.'}).entry,'dragon-red');
  assert.equal(L.choosePicture(pictures,{kind:'creature',campaignId:'t',id:'f',name:'The Hollow Choir',description:'A band of hooded cultists in red robes chanting around an altar.'}).entry,'cultist-band');
  console.log('Matching: '+fixtures.length+' creatures the live game has met, each shown as what it is (by kind, then what sets one apart, then the land); invented peoples and creatures with nothing to go on painted.');
  // ---------- Determinism, one picture per creature in a tale, spread across tales ----------
  {const wolf=(id,campaignId='tale-w')=>({kind:'creature',campaignId,id,name:'Grey Wolf',description:'A lean grey wolf with amber eyes.',template:'wolves'});
   const a=L.choosePicture(pictures,wolf('wild-a')),again=L.choosePicture(pictures,wolf('wild-a'));assert.equal(a.id,again.id,'the same creature draws the same picture');
   const b=L.choosePicture(pictures,wolf('wild-b'),{taken:new Set([a.id])});assert.notEqual(b.id,a.id,'two creatures of a tale, two pictures while another fits');assert.equal(b.kind,'wolf');
   const all=new Set(L.fitsFor(pictures,wolf('wild-c')).map(x=>x.picture.id));const c=L.choosePicture(pictures,wolf('wild-c'),{taken:all});assert.ok(all.has(c.id),'a repeat only once every close fit is taken');
   assert.equal(L.choosePicture(pictures,wolf('wild-a','tale-x')).kind,'wolf');}
  // ---------- The painter: library answers free, kept for good, paintings made before kept ----------
  const lib=path.join(tmp,'creatures'),art=path.join(tmp,'art');fs.mkdirSync(lib,{recursive:true});fs.mkdirSync(art,{recursive:true});
  const present=pictures.filter(p=>p.id!=='serpent-sand-1');// one picture not yet painted
  for(const p of present)fs.writeFileSync(path.join(lib,p.id+'.jpg'),jpeg(p.id));
  fs.writeFileSync(path.join(lib,'library.json'),JSON.stringify([...present.map(p=>({id:p.id,file:p.id+'.jpg'})),{id:'../escape',file:'../escape.jpg'},{id:'made-up-1',file:'made-up-1.jpg'}]));
  let paid=0,counted=0;const prompts=[],missed=[];
  const fetchImpl=async(url,options)=>{paid++;prompts.push(JSON.parse(options.body).input);return {ok:true,json:async()=>({status:'completed',output:[{type:'image_generation_call',status:'completed',result:jpeg('painted').toString('base64')}]})};};
  const open=()=>createArtStore({directory:art,fetchImpl,libraryDirectory:path.join(tmp,'no-places'),peopleDirectory:path.join(tmp,'no-people'),creatureLibrary:L.createCreatureLibrary({directory:lib,refreshMs:0,picksDirectory:path.join(art,'creature-picks')})});
  let store=open();const ask=(subject,options={})=>store.request(subject,{apiKey:'test-only',model:'test-model',mayPaint:()=>true,onPainted:()=>counted++,onUnmatched:n=>missed.push(n),...options});
  const waitPaid=async n=>{for(let i=0;i<200&&paid<n;i++)await new Promise(res=>setTimeout(res,10));};
  const creature=(campaignId,id,name,description,extra={})=>({campaignId,kind:'creature',id,name,description:'A creature: '+name+'. '+description,setting:'',...extra});
  const widow=creature('tale-1','wild-grey-widow','Grey Widow','A spider as large as a pony, grey and bristled, with a pale cross on its back and eight milky eyes.',{template:'spider',terrain:'caverns'});
  const first=await ask(widow);assert.equal(first.status,'ready');assert.equal(first.library,'spider-giant-2');assert.equal(first.key,artKey(widow),'answered under the creature\'s own key');assert.ok(shown(first).includes('spider-giant-2'));
  assert.equal(paid,0,'no painting');assert.equal(counted,0,'no usage');
  same((await store.request(widow,{})).library,'spider-giant-2','without a key or an allowance');same((await ask(widow,{mayPaint:()=>false})).library,'spider-giant-2');
  // Two creatures of one tale shown together: two pictures.
  const [w1,w2]=await Promise.all([ask(creature('tale-2','wild-a','Grey Wolf','A lean grey wolf.',{template:'wolves'})),ask(creature('tale-2','wild-b','Grey Wolf Bitch','A lean grey wolf.',{template:'wolves'}))]);
  assert.equal(w1.status,'ready');assert.equal(w2.status,'ready');assert.notEqual(w1.library,w2.library,'two wolves of a tale, two pictures');
  // Kept across a restart, even as the library grows with a better fit.
  const keptBefore=(await ask(creature('tale-3','main-foe','Thirstcoil','A long, low serpent of translucent amber scales that swims through the sand.'))).library;
  store=open();fs.writeFileSync(path.join(lib,'serpent-sand-1.jpg'),jpeg('serpent-sand-1'));fs.writeFileSync(path.join(lib,'library.json'),JSON.stringify(pictures.map(p=>({id:p.id,file:p.id+'.jpg'}))));
  assert.equal((await ask(creature('tale-3','main-foe','Thirstcoil','A long, low serpent of translucent amber scales that swims through the sand.'))).library,keptBefore,'a creature never changes picture');
  assert.equal((await ask(creature('tale-4','main-foe','Thirstcoil','A long, low serpent of translucent amber scales that swims through the sand.'))).library,'serpent-sand-1','a new tale gets the new picture');
  assert.equal((await ask(widow)).library,'spider-giant-2','picks kept after a restart');
  assert.ok(fs.readdirSync(path.join(art,'creature-picks')).length>=3,'picks kept on disk');
  // A template creature is the library's best fit (no shared template painting), a vault guardian too.
  assert.equal((await ask(creature('tale-5','wild-old-tusker','Old Tusker','A huge scarred boar with a broken tusk.',{template:'boar'}))).library.startsWith('boar-wild'),true);
  assert.equal((await ask({campaignId:'crossroads-v1',kind:'creature',id:'guardian-1',name:'Stone Sentinel',description:'Creature: Stone Sentinel. A cracked stone sentinel bars the northern archway.',setting:'',terrain:'caverns'})).library,'sentinel-statue-1');
  assert.equal(paid,0,'still no painting');
  // A creature painted for its tale before keeps that painting.
  const old=creature('tale-6','main-foe','Tarnclaw','A dog-sized marsh crustacean with mismatched pincers.');fs.writeFileSync(path.join(art,artKey(old)+'.jpg'),jpeg('old-painting'));
  const kept=await ask(old);assert.ok(shown(kept).includes('old-painting'));assert.equal(kept.library,undefined,'a painting made before is kept');
  // A foe who is a person of a known species goes to the people library first, never to a monster's picture.
  const before=paid;const queen=await ask(creature('tale-7','main-foe','Morwen','A tall woman in a black coat with a silver chain.',{species:'Human',gender:'woman'}));assert.equal(queen.status,'pending','no look-alike here (no people library): painted');await waitPaid(before+1);
  // A creature the library has nothing like is painted, and noted once for the host, mechanical only.
  await new Promise(res=>setTimeout(res,30));assert.equal(missed.length,0,'a person foe is no creature the library lacks');const odd=creature('tale-8','main-foe','Sovel Aru','A forty-year-old hornkin with a rangy build and blunt horns.',{creatureKind:'hornkin',terrain:'hills'});
  const p0=paid;assert.equal((await ask(odd)).status,'pending');await waitPaid(p0+1);assert.equal(paid,p0+1,'painted as before');await new Promise(res=>setTimeout(res,30));
  assert.equal(missed.length,1,'noted once');same(Object.keys(missed[0]).sort(),['closest','creatureKind','name','terrain']);assert.equal(missed[0].name,'Sovel Aru');assert.equal(missed[0].creatureKind,'hornkin');assert.ok(!JSON.stringify(missed[0]).includes('rangy'),'never the look\'s words');
  await ask(odd);await new Promise(res=>setTimeout(res,30));assert.equal(missed.length,1,'not noted twice');
  // The library's own campaign: painted only by the host, never answered from the library.
  const own={campaignId:L.libraryCampaign,kind:'creature',id:'wolf-grey-2',name:'Grey wolf',description:'A creature: a dark wolf in snow.',setting:''};
  const refused=await ask(own,{host:false});assert.equal(refused.status,'failed');assert.match(refused.error,/Only the host paints the creature library/);
  store=open();const p1=paid;const hosted=await ask(own,{host:true});assert.equal(hosted.status,'pending','the host paints it');await waitPaid(p1+1);assert.equal(paid,p1+1);assert.ok(prompts.at(-1).includes('a dark wolf in snow'));
  // An unreadable picture is passed over for another.
  fs.writeFileSync(path.join(lib,'bear-white-1.jpg'),'not a jpeg');
  const bear=await ask(creature('tale-9','main-foe','Frostback','A great white bear on blue ice.'));assert.equal(bear.status,'ready');assert.notEqual(bear.library,'bear-white-1');
  // Malformed entries are refused: only catalogue ids, never a path.
  assert.ok(!store.creatures.entries().some(e=>e.id.includes('/')||e.id==='made-up-1'));
  // With no library at all, creatures are painted (or shared by template) as before.
  {let n=0;const bare=createArtStore({directory:path.join(tmp,'bare-art'),fetchImpl:async()=>{n++;return {ok:true,json:async()=>({status:'completed',output:[{type:'image_generation_call',status:'completed',result:jpeg('x').toString('base64')}]})};},libraryDirectory:path.join(tmp,'no-places'),peopleDirectory:path.join(tmp,'no-people'),creatureDirectory:path.join(tmp,'no-creatures')});
   const answer=await bare.request(creature('tale-10','wild-x','Frost Fang','A pale wolf.',{template:'wolf'}),{apiKey:'k',model:'m'});assert.equal(answer.status,'pending');for(let i=0;i<100&&!n;i++)await new Promise(res=>setTimeout(res,10));assert.equal(n,1);}
  console.log('Painter: creatures answered from the library with no painting and no usage (no key or allowance needed), the same picture for good (across a restart and a growing library), two of a tale apart, a painting made before kept, a person foe never a monster, nothing alike painted and noted once (mechanical), the library\'s own campaign the host\'s alone, bad pictures and entries passed over.');
  // ---------- The subjects the game sends ----------
  {const v=validateSubject({...widow,terrain:'mud',creatureKind:'salt-shell <burrower>!',template:'spider'});assert.equal(v.terrain,undefined,'unknown lands dropped');assert.equal(v.creatureKind,'salt-shell burrower');assert.equal(v.template,'spider');
   assert.equal(validateSubject({campaignId:'t',kind:'landscape',id:'inn',name:'Inn',description:'An inn.',setting:'',creatureKind:'wolf'}).creatureKind,undefined,'only creatures carry it');
   const {journeyStory}=require('./journey-fixtures.cjs'),hero=r.readyHero('fighter');
   const story={...journeyStory(0),foeSpecies:'salt-shell burrower',foeAppearance:'A low, broad creature with six jointed legs and a domed shell layered in pale salt plates.'};
   const game=r.freshStoryGame(hero,JSON.parse(JSON.stringify(story)),r.newAdventure(hero));
   const foe=r.creatureArtSubject({...game,stage:'combat'});assert.equal(foe.creatureKind,'salt-shell burrower');assert.ok(r.terrains.includes(foe.terrain));assert.equal(foe.id,'main-foe');assert.equal(artKey(foe),artKey({campaignId:foe.campaignId,kind:'creature',id:'main-foe'}),'the key is unchanged');
   const wild=r.startWildFight(game,hero,{template:'spider',name:'Grey Widow',appearance:'A spider as large as a pony, grey and bristled.'},{place:'inn'});const w=r.creatureArtSubject(wild.game);assert.equal(w.template,'spider');assert.ok(r.terrains.includes(w.terrain));
   const skirmish=r.hostileEncounterGame(hero);const s=r.creatureArtSubject({...skirmish,stage:'combat'});assert.ok(r.templateKeys.includes(s.template));assert.ok(s.creatureKind);
   const vault=r.creatureArtSubject({...r.newAdventure(hero),stage:'combat',dungeon:{active:true,room:1}});assert.equal(vault.terrain,'caverns');assert.equal(vault.creatureKind,undefined);
   const answered=await ask(validateSubject(foe));assert.equal(answered.status,'ready');assert.equal(answered.library,'burrower-plated-1','a tale\'s creature foe from the library, by the kind the tale gave it');}
  console.log('Subjects: wild fights say their template and land, a tale\'s foe its kind and land, the vault\'s guardians the caverns; unknown values dropped; no key changes.');
  // ---------- Host jobs ----------
  {const {hostJobOf,recordCreatureMiss}=require('./dm-server.cjs'),{hostJobs,jobOfCampaign,createSpending}=require('./spending.cjs');
   assert.equal(hostJobOf({campaignId:L.libraryCampaign},null),'creature-library');assert.equal(hostJobOf({campaignId:L.libraryCampaign},'a'.repeat(32)),null,'never for a guest');assert.ok(hostJobs.includes('creature-library'));assert.equal(jobOfCampaign(L.libraryCampaign),'creature-library');
   const dir=path.join(tmp,'spend');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'.questbound-usage.jsonl'),JSON.stringify({at:new Date().toISOString(),mode:'art',model:'gpt-6-luna',input:0,cached:0,output:0,images:100,job:'creature-library'})+'\n');
   const sum=createSpending({dir,alerts:{raise:()=>false}}).summary();assert.equal(sum.all,0,'the library\'s paintings never count against a ceiling');assert.ok(sum.hostJobs>2.9);
   const saved=process.env.QUESTBOUND_DATA;process.env.QUESTBOUND_DATA=dir;try{recordCreatureMiss({name:'Sovel Aru',creatureKind:'hornkin',terrain:'hills',closest:{id:'troll-1',score:2}},true,null);recordCreatureMiss({name:'Not live'},false,null);}finally{if(saved===undefined)delete process.env.QUESTBOUND_DATA;else process.env.QUESTBOUND_DATA=saved;}
   const lines=fs.readFileSync(path.join(dir,'.questbound-diagnostics.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));assert.equal(lines.length,1,'live runs only');same(Object.keys(lines[0]).sort(),['art','at','closest','creatureKind','name','terrain']);assert.equal(lines[0].art,'creature-unmatched');
   const report=require('node:child_process').spawnSync(process.execPath,['dm-report.cjs','--dir',dir],{cwd:__dirname,encoding:'utf8'});assert.match(report.stdout,/Creatures painted for want of a library picture: 1/,report.stdout+report.stderr);assert.match(report.stdout,/Sovel Aru/);}
  console.log('Host jobs: the library\'s paintings are tagged creature-library and never count against a ceiling; creatures painted for want of a picture are noted (live, mechanical) and listed by dm-report.');
  // ---------- make-creature-library.cjs against a stand-in Dungeon Master ----------
  {const data=path.join(tmp,'data'),home=path.join(tmp,'home');fs.mkdirSync(path.join(data,'.questbound-art'),{recursive:true});fs.mkdirSync(home);
   const {templateKeys}=require('./make-creature-library.cjs');
   // The game already has two template paintings: the Skirmish's wolf and the shared bandit.
   fs.writeFileSync(path.join(data,'.questbound-art',templateKeys('wolf')[1]+'.jpg'),jpeg('skirmish-wolf'));fs.writeFileSync(path.join(data,'.questbound-art',templateKeys('bandit')[0]+'.jpg'),jpeg('shared-bandit'));
   let mode='ok',asked=0;const pending=new Set(),seen=[];
   const server=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{const b=JSON.parse(body),s=b.context.subject;seen.push({origin:req.headers.origin,campaign:s.campaignId,kind:s.kind,mode:b.context.mode});
    res.setHeader('Content-Type','application/json');
    if(mode==='quota'){res.end(JSON.stringify({status:'failed',key:'k',error:'Image generation reached an API usage limit. Retry later.'}));return;}
    if(!pending.has(s.id)){pending.add(s.id);asked++;res.end(JSON.stringify({status:'pending',key:'k'}));return;}
    res.end(JSON.stringify({status:'ready',key:'k',dataUrl:'data:image/jpeg;base64,'+jpeg('painted-'+s.id).toString('base64')}));});});
   await new Promise(res=>server.listen(0,'127.0.0.1',res));
   const run=args=>new Promise(res=>{const child=require('node:child_process').spawn(process.execPath,['make-creature-library.cjs',...args],{cwd:__dirname,env:{...process.env,QUESTBOUND_DATA:data,USERPROFILE:home,HOME:home,QB_DM_URL:'http://127.0.0.1:'+server.address().port+'/dm',QB_POLL_MS:'5',QB_RETRY_MS:'5'}});let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);child.on('close',code=>res({code,out}));});
   const dir=path.join(data,'.questbound-creatures'),listed=()=>JSON.parse(fs.readFileSync(path.join(dir,'library.json'),'utf8'));
   let out=await run(['--list']);assert.equal(out.code,0,out.out);assert.match(out.out,new RegExp(pictures.length+' pictures in the catalogue'));assert.match(out.out,/2 to copy free/);assert.match(out.out,new RegExp((pictures.length-2)+' to paint \\(about \\$'+((pictures.length-2)*0.03).toFixed(2)));assert.equal(seen.length,0,'--list paints nothing');
   out=await run(['--limit','3']);assert.equal(out.code,0,out.out);let lib1=listed();assert.equal(lib1.length,5,'two copied free and three painted');
   assert.ok(fs.readFileSync(path.join(dir,'wolf-dire-1.jpg')).toString('latin1').includes('skirmish-wolf'),'the Skirmish\'s wolf copied free');assert.ok(fs.readFileSync(path.join(dir,'outlaw-cutthroat-1.jpg')).toString('latin1').includes('shared-bandit'));
   assert.ok(seen.every(s=>s.origin==='http://localhost:8081'&&s.campaign===L.libraryCampaign&&s.kind==='creature'&&s.mode==='art'),'through the host\'s own Dungeon Master, under the library\'s campaign');
   assert.ok(lib1.every(e=>e.file===e.id+'.jpg'&&fs.existsSync(path.join(dir,e.file))));assert.ok(fs.existsSync(path.join(home,'Desktop','Questbound creatures','wolf-dire-1.jpg')),'a copy on the Desktop');
   mode='quota';out=await run([]);assert.equal(out.code,2,'stops cleanly on a quota refusal: '+out.out);assert.match(out.out,/Nothing is lost/);assert.equal(listed().length,5);
   mode='ok';out=await run([]);assert.equal(out.code,0,out.out);assert.equal(listed().length,pictures.length,'resumed to the whole library');assert.equal(asked,pictures.length-2,'each picture painted once, the copied ones never');
   assert.ok(fs.existsSync(path.join(home,'Desktop','Questbound creatures','library.json')));
   // What it made is a library the painter reads.
   const made=L.createCreatureLibrary({directory:dir,refreshMs:0,picksDirectory:path.join(tmp,'made-picks')});await made.refresh();assert.equal(made.entries().length,pictures.length);
   server.close();}
  console.log('make-creature-library.cjs: says what it would cost, copies the game\'s own template paintings free, paints the rest one at a time through the host\'s Dungeon Master under the library\'s campaign, resumable, a Desktop copy, stops cleanly on a quota refusal.');
  // ---------- Revisions ----------
  {const dm=fs.readFileSync(path.join(__dirname,'dm-server.cjs'),'utf8'),literals=[...dm.matchAll(/world-art\.cjs'\)\.revision!==(\d+)/g)].map(m=>Number(m[1]));assert.equal(require('./world-art.cjs').revision,10);assert.ok(literals.length>=3&&literals.every(n=>n===10));assert.equal(L.revision,1);
   assert.match(fs.readFileSync(path.join(__dirname,'world-art.cjs'),'utf8'),/delete require\.cache\[require\.resolve\('\.\/creature-library\.cjs'\)\]/,'world-art loads the creature library afresh');assert.match(fs.readFileSync(path.join(__dirname,'creature-library.cjs'),'utf8'),/delete require\.cache\[require\.resolve\('\.\/creature-catalogue\.cjs'\)\]/);}
  console.log('Passed: the creature library.');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
