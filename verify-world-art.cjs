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
