// Faces painted in play join the people library (2026-10-22, the host's words: "make sure all unique faces painted are
// added to the library of potential faces in the game"). Checks import-painted-faces.cjs on a stand-in data folder:
// a dry run writes nothing; --write copies each unique painted face into .questbound-people/ as a face only (nf001…,
// faces.json) with its species (the nearest common people for an invented people, its name kept as kin; none for
// features no common people has), gender, age, training, role and look and the tale it was painted for, never moving
// or changing the paintings; players' own heroes, the library's own portraits, children and ghosts, women painted
// before the no-beard rule, someone whose gender is not given, a picture already in the library and the same person
// painted twice are left out, each with its reason; a second run adds only what is new, ids carrying on; the Desktop
// copy gets the new files and never loses one; and the game then shows these faces (and never offers them to meet).
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const lib=require('./people-library.cjs'),{importFaces,faceFromRecord,reasons}=require('./import-painted-faces.cjs');
const {artKey}=require('./world-art.cjs');
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const jpeg=id=>Buffer.concat([Buffer.from([255,216,255,224]),Buffer.from(String(id)),Buffer.from([255,217])]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const W='A woman, with a woman\'s face: smooth cheeks and chin, no beard, no moustache, no stubble or facial hair of any kind. ';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qb-face-import-'));
try{
 const data=path.join(tmp,'data'),art=path.join(data,'.questbound-art'),people=path.join(data,'.questbound-people'),desktop=path.join(tmp,'Desktop','Questbound people');
 fs.mkdirSync(art,{recursive:true});fs.mkdirSync(people,{recursive:true});fs.mkdirSync(desktop,{recursive:true});
 // The library as it stands: one person with a portrait; the Desktop copy holds a file of its own.
 fs.writeFileSync(path.join(people,'np001.jpg'),jpeg('np001'));fs.writeFileSync(path.join(people,'library.json'),'[]');fs.writeFileSync(path.join(desktop,'keep-me.txt'),'mine');
 let at=Date.parse('2026-10-01T00:00:00Z');
 const paint=(subject,{bytes=jpeg(subject.campaignId+subject.id),picture=true,kind='portrait'}={})=>{const s={kind,setting:'',name:'Someone',...subject},key=artKey(s);fs.writeFileSync(path.join(art,key+'.json'),JSON.stringify({subject:s,model:'test',createdAt:new Date(at+=3600000).toISOString(),prompt:'x'}));if(picture)fs.writeFileSync(path.join(art,key+'.jpg'),bytes);return key;};
 const keys={
  library:paint({campaignId:lib.peopleCampaign,id:'np001',name:'Library Person',description:'An adult Human woman. '+W+'A tall woman.'}),
  hero:paint({campaignId:'hero-abc123',id:'hero-w',name:'Kara',description:'The player character, an adventurer. '+W+'A lean human fighter.'}),
  child:paint({campaignId:'tale-1',id:'n1',name:'Pip',description:'A man. A thin boy with a reed rod and bare muddy feet.',role:'A boy fishing.'}),
  ghost:paint({campaignId:'tale-1',id:'n2',name:'The Drowned',description:'The ghost of a drowned sailor, translucent and dripping.'}),
  oldWoman:paint({campaignId:'tale-1',id:'keeper',name:'Brinna',description:'Brinna is a stout dwarf in her late fifties. Her beard is braided with copper.'}),
  human:paint({campaignId:'journey-1',id:'resident-veya-w',name:'Veya Noll',description:W+'A sixty-eight-year-old human woman, small and stooped, with white hair in a looped bun.. human. The funeral caller who keeps the mourning cords.',species:'Human',gender:'woman',role:'The funeral caller who keeps the mourning cords.'}),
  moss:paint({campaignId:'journey-2',id:'resident-della-w',name:'Della Hume',description:W+'A 61-year-old mosskin woman, broad and strong, with olive-green skin and rust-red curls.. mosskin. A fish seller.',species:'unknown',gender:'woman'}),
  moth:paint({campaignId:'tale-2',id:'mara',name:'Irix Pell',description:'A 31-year-old Mothkin, lanky, with bronze compound eyes and fine cream antennae. They wear a grey coat.'}),
  bearded:paint({campaignId:'crossroads-v1',id:'keeper',name:'The keeper',description:'Middle-aged human innkeeper, short salt-and-pepper beard, brown hair, kind but firm eyes.'}),
  nobody:paint({campaignId:'tale-3',id:'n4',name:'Neris Vell',description:'A 34-year-old oshari with a lean build and warm brown skin.'}),
  twiceOld:paint({campaignId:'tale-4',id:'mara',name:'Tobin Reed',description:'A man. A slight young halfling man with unruly sandy hair.'}),
  twiceNew:paint({campaignId:'tale-5',id:'mara',name:'Tobin Reed',description:'A man. A slight young halfling man with unruly sandy hair.'}),
  copy:paint({campaignId:'tale-6',id:'n9',name:'Copied Face',description:'A man. A broad human smith.'},{bytes:jpeg('np001')}),
  missing:paint({campaignId:'tale-6',id:'n10',name:'No Picture',description:'A man. A broad human cooper.'},{picture:false}),
  famous:paint({campaignId:'tale-7',id:'n1',name:'Gandalf Brightwater',description:'A man. A 70-year-old human hermit with a long grey beard.'}),
  cleric:paint({campaignId:'tale-8',id:'n3',name:'Sister Wenna',description:W+'A 33-year-old half-elf woman with a shaved head and a sun-disc pendant.',gender:'woman',species:'Half-Elf',trained:'Cleric',role:'A temple priestess.'}),
  numbers:paint({campaignId:'tale-9',id:'keeper-w',name:'Davra Keld',description:W+'A fifty-eight-year-old human woman, broad-shouldered, with iron-gray hair.'}),
 };
 paint({campaignId:'tale-1',id:'wild-wolf',name:'Wolf',description:'A creature: a wolf.'},{kind:'creature'});paint({campaignId:'tale-1',id:'inn',name:'Inn',description:'An inn.'},{kind:'landscape'});
 const originals=Object.fromEntries(fs.readdirSync(art).map(f=>[f,sha(fs.readFileSync(path.join(art,f)))]));
 // ---------- What one painting becomes ----------
 {const read=key=>faceFromRecord(JSON.parse(fs.readFileSync(path.join(art,key+'.json'),'utf8')));
  same(['library','hero','child','child','beard','gender'].map((r,i)=>read([keys.library,keys.hero,keys.child,keys.ghost,keys.oldWoman,keys.nobody][i]).reason),['library','hero','child','child','beard','gender'],'each left out for its reason');
  const veya=read(keys.human).face;same([veya.species,veya.gender,veya.age,veya.class,veya.kin],['Human','woman','old',null,null]);assert.equal(veya.role,'The funeral caller who keeps the mourning cords.');assert.equal(veya.appearance,'A sixty-eight-year-old human woman, small and stooped, with white hair in a looped bun.','the look alone, without the painter\'s opening words or the role');assert.equal(veya.from,'journey-1');
  const della=read(keys.moss).face;same([della.species,della.kin,della.age],['Orc','mosskin','old'],'an invented people: the nearest common people, its own name kept');
  const irix=read(keys.moth).face;same([irix.species,irix.kin,irix.traits,irix.gender],[null,'mothkin',['antennae'],'other'],'features no common people has: no species, shown only to those who share them');
  same([read(keys.bearded).face.gender,read(keys.bearded).face.species],['man','Human'],'a beard and no other word: a man');
  assert.equal(read(keys.famous).face.name,null,'a famous name is not kept');assert.equal(read(keys.cleric).face.class,'Cleric');assert.equal(read(keys.cleric).face.species,'Half-Elf');
  same([read(keys.numbers).face.age,read(keys.numbers).face.species],['middle-aged','Human'],'"fifty-eight-year-old" is a middle-aged woman, not a child');}
 // ---------- A dry run writes nothing ----------
 const dry=importFaces({dataDir:data});
 const reason=Object.fromEntries(dry.left.map(x=>[x.key,x.reason]));
 assert.equal(reason[keys.library],'library');assert.equal(reason[keys.hero],'hero');assert.equal(reason[keys.child],'child');assert.equal(reason[keys.ghost],'child');assert.equal(reason[keys.oldWoman],'beard');assert.equal(reason[keys.nobody],'gender');
 assert.equal(reason[keys.copy],'same','a picture already in the library');assert.equal(reason[keys.missing],'picture');assert.equal(reason[keys.twiceOld],'twice','the same person painted twice: the older left out');assert.equal(reason[keys.twiceNew],undefined,'(the newer kept)');
 same(dry.added.map(f=>f.id),dry.added.map((f,i)=>'nf'+String(i+1).padStart(3,'0')),'ids nf001…');assert.equal(dry.added.length,8);assert.ok(dry.added.every(lib.validFace),'every face is whole');
 same(fs.readdirSync(people).sort(),['library.json','np001.jpg'],'a dry run writes nothing');
 assert.ok(Object.values(reasons).length>=9);
 // ---------- --write, from the command line ----------
 const cli=args=>spawnSync(process.execPath,['import-painted-faces.cjs',...args],{cwd:__dirname,encoding:'utf8',env:{...process.env,QUESTBOUND_DATA:''}});
 let out=cli(['--dir',data]);assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/Would add 8 faces to the library \(nothing written; add --write to add them\)\./);assert.match(out.stdout,/Left out 9: /);assert.match(out.stdout,/2 a child, a ghost, the dead or a creature/);
 assert.match(out.stdout,/By gender: woman \d+, man \d+, other \d+\. By age: young \d+, adult \d+, middle-aged \d+, old \d+\./);
 out=cli([data,'--write','--desktop',desktop]);assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/Added 8 faces/);
 const faces=JSON.parse(fs.readFileSync(path.join(people,'faces.json'),'utf8'));assert.equal(faces.length,8);assert.ok(faces.every(lib.validFace));
 for(const f of faces){assert.equal(sha(fs.readFileSync(path.join(people,f.id+'.jpg'))),f.sha256,'the picture as painted');assert.equal(sha(fs.readFileSync(path.join(art,f.source+'.jpg'))),f.sha256,'from its painting');}
 same(Object.fromEntries(fs.readdirSync(art).map(f=>[f,sha(fs.readFileSync(path.join(art,f)))])),originals,'the paintings are never moved or changed');
 same(fs.readdirSync(desktop).sort(),['faces.json','keep-me.txt',...faces.map(f=>f.id+'.jpg')].sort(),'the Desktop copy gets the new files and keeps its own');
 // ---------- Again: only what is new ----------
 out=cli(['--dir',data,'--write','--desktop',desktop]);assert.match(out.stdout,/Added 0 faces/);assert.match(out.stdout,/8 imported before/);
 const later=paint({campaignId:'tale-10',id:'n1-w',name:'Kessa Lorn',description:W+'A 44-year-old vair woman, lanky and pale-eyed, with dark indigo hair.',species:'unknown',gender:'woman'});
 fs.rmSync(path.join(desktop,'nf001.jpg'));
 out=cli(['--dir',data,'--write','--no-desktop']);assert.match(out.stdout,/Added 1 face /);
 const grown=JSON.parse(fs.readFileSync(path.join(people,'faces.json'),'utf8'));assert.equal(grown.length,9);assert.equal(grown.at(-1).id,'nf009','ids carry on');assert.equal(grown.at(-1).source,later);assert.equal(grown.at(-1).kin,'vair');
 assert.ok(!fs.existsSync(path.join(desktop,'nf009.jpg')),'--no-desktop leaves the Desktop copy alone');
 out=cli(['--dir',data,'--json']);const json=JSON.parse(out.stdout);assert.equal(json.added.length,0);assert.equal(json.write,false);
 // ---------- The game shows them, and never offers them to meet ----------
 (async()=>{
  const shelf=lib.createPeopleLibrary({directory:people,refreshMs:0,picksDirectory:path.join(tmp,'picks')});await shelf.refresh();
  assert.equal(shelf.faces().length,9);assert.equal(shelf.entries().length,0,'faces only are not people');same(await shelf.suited({count:50}),[],'never offered as someone to meet');
  const della=grown.find(f=>f.kin==='mosskin');
  const shown=await shelf.lookAlike({campaignId:'tale-new',kind:'portrait',id:'n1',name:'Moss Woman',description:W+'A 50-year-old mosskin woman with olive-green skin.',setting:'',species:'unknown',kin:'mosskin',gender:'woman'},'key');
  assert.equal(shown.library,della.id,'a mosskin woman in another tale is shown the mosskin face');
  const sameTale=await shelf.lookAlike({campaignId:'journey-2',kind:'portrait',id:'n7',name:'Other',description:W+'A 50-year-old mosskin woman with olive-green skin.',setting:'',species:'unknown',kin:'mosskin',gender:'woman'},'key');
  assert.equal(sameTale.library,della.id,'(only one fits: shown again rather than painted, even in the tale it was painted for)');
  const src=fs.readFileSync(path.join(__dirname,'import-painted-faces.cjs'),'utf8');assert.ok(!/fetch\(|require\('node:https?'\)|unlink|rmSync|rmdirSync/.test(src),'calls no service and deletes nothing');
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log('Import: a dry run writes nothing; --write adds each unique painted face as a face only (species, the nearest common people for an invented people with its name kept, gender, age, training, role, look, the tale it was painted for) with its picture copied, the paintings untouched; heroes, the library\'s own, children and ghosts, women painted before the no-beard rule, no gender, pictures already there and the same person twice left out with their reasons; again only what is new; the Desktop copy kept in step; the game shows them and never offers them to meet.');
 })().catch(e=>{fs.rmSync(tmp,{recursive:true,force:true});console.error(e);process.exit(1);});
}catch(e){fs.rmSync(tmp,{recursive:true,force:true});console.error(e);process.exit(1);}
