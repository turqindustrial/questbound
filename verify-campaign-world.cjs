const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),{execFileSync}=require('child_process');
const {rulesSource}=require('./rules-files.cjs'),W=require('./written-walk.cjs');
// One campaign, many tales (2026-10-23, the host's words: "all areas traveled in a single campaign should be remembered
// so they can be returned to. and NPCs should all have memory of seeing the player before if they have"): every written
// tale on the host's shelf, begun as the next tale of a hero with a large earlier world (thirty lands, a hundred places,
// people met and people never reached, a place whose name reads as one of the new tale's own), joined where the hero
// stands (sequelRules.js joinRegion). The joined game is a valid save; every name the tale's staging uses still resolves
// to the tale's own place or person (stagingIds); every place the hero went to can be walked back to; and the golden
// path of the tale's walkthrough (written-walk.cjs) still reaches its ending wherever it did before.
// Reads the shelf's tales only (QUESTBOUND_DATA, this checkout, then the main checkout); skips when there are none.
// No AI, no network, no ports.
const names=[...new Set([...W.needs,'readyHero','readyHeroes','blankBuild','makeCharacter','subclassOptions','joinRegion','stagingIds','stagingNamesUsed','stagingNameKey','mapLocation','worldPlaces','travelRoute','mapRegions','metPerson','validAdventure','adventureSnapshot','freshStoryGame','newAdventure'])];
const r=vm.runInNewContext(rulesSource()+'\n({'+names.join(',')+'})',{AsyncStorage:{}});
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function shelfDir(){
 const roots=[process.env.QUESTBOUND_DATA,__dirname].filter(Boolean);
 try{let common=execFileSync('git',['-C',__dirname,'rev-parse','--git-common-dir'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000}).trim();if(common){if(!path.isAbsolute(common))common=path.resolve(__dirname,common);roots.push(path.dirname(common));}}catch{}
 for(const root of roots){const dir=path.join(root,'.questbound-written');if(fs.existsSync(dir))return dir;}
 return null;
}
// The ready-made Fighter at any level (as check-written-tale.cjs makes heroes: the developer options).
function fighterAt(level){
 if(level===1)return r.readyHero('fighter');
 const form=r.readyHeroes.find(h=>h.key==='fighter').form,sub=Object.keys(r.subclassOptions[form.class]??{})[0]??'';
 return r.makeCharacter({...r.blankBuild(),...form,level,devLevel:level,advancements:[],plannedSubclass:sub,spells:[],spellbook:[],spellSelectionVersion:2});
}
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'written-fixture.json'),'utf8'));
const copyOf=(tale,id)=>({...JSON.parse(JSON.stringify(tale.story)),id,status:'active',libraryId:tale.id,artId:'journey-'+tale.id,written:{slug:tale.slug,edition:tale.edition??1,length:tale.length}});
// The hero's earlier world: the fixture tale lived, thirty lands beyond it (three places each, the odd ones walked),
// people in them (met in the lands walked, never reached in the others), a place named as one of the new tale's own,
// and the hero standing in the seventh land.
function earlierWorld(hero,clash){
 const base=r.freshStoryGame(hero,copyOf(fixture,'earlier-world'),r.newAdventure(hero)),places=[...r.worldPlaces(base)],regions=[...(base.world?.regions??[])],people={...base.people},memory={...base.npcMemory},visited=[...base.map.visited];
 let n=Math.max(0,...places.map(p=>Number(p.id.slice(1)))),person=Math.max(0,...Object.keys(people).map(k=>Number(k.slice(1))));
 for(let i=1;i<=30;i++){
  const id='r'+(regions.length+1);regions.push({id,name:'The Elder March '+i,terrain:['plains','forest','hills','coast','marsh','snow'][i%6]});let prev='inn';
  for(let k=0;k<3;k++){n++;const pid='p'+n;places.push({id:pid,name:'Waystead '+i+'-'+k,description:'A waystead of the elder marches, '+i+' of them and '+k+' on.',kind:'settlement',x:i*40000+k*3000,y:(i%7)*30000-k*2000,from:prev,region:id,...(k===2&&i%4===0?{danger:'lair',threat:{template:'bandit',name:'Waystead Robber',appearance:'A robber in a stolen coat who keeps the waystead.'}}:{})});prev=pid;if(i%2)visited.push(pid);}
  person++;const nid='n'+person;people[nid]={name:'Elder Marcher '+i,species:'Human',role:'A waystead keeper of the elder marches.',appearance:'A weathered keeper with a lantern and a ledger.',personality:'Slow to trust.',toughness:'common',home:'p'+(n-2),foe:'neutral',gender:i%2?'man':'woman',resident:true,...(i%6===0?{hidden:true}:{})};
  if(i%2)memory[nid]={attitude:'indifferent',response:'Neutral toward the player.',memories:['The traveller stayed a night at the waystead.']};
 }
 n++;places.push({id:'p'+n,name:clash,description:'A place of the earlier tale whose name the new tale also uses.',kind:'landmark',x:9000,y:-9000,from:'inn'});visited.push('p'+n);
 const at=places.filter(p=>p.region==='r'+(regions.length-23)).at(-1).id;
 return {...base,stage:'wild',world:{places,regions,at},people,npcMemory:memory,map:{...base.map,visited:[...new Set([...visited,at])]}};
}
const dir=shelfDir();
const files=dir?fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='plays.json').sort():[];
if(!files.length){console.log('Campaign world: no written tales on this PC (looked for .questbound-written): skipped.');process.exit(0);}
let walked=0,skipped=[];
for(const file of files){
 const tale=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));if(tale.format!==1||!plain(tale.story)||!plain(tale.walkthrough?.golden))continue;
 const lowest=Array.isArray(tale.levels)?tale.levels[0]:1,hero=fighterAt(lowest),bridge=tale.story.locations.bridge.name,clash=/^the /i.test(bridge)?bridge.slice(4):'The '+bridge;
 const earlier=earlierWorld(hero,clash);assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(earlier)),null,true),hero),file+': the earlier world is a valid save');
 const join=g=>r.joinRegion(g,earlier,{sameRegion:true,bearing:'S',miles:5,anchor:r.mapLocation(earlier)});
 const fresh=r.freshStoryGame(hero,copyOf(tale,'campaign-'+tale.slug),r.newAdventure(hero)),joined=join(fresh);
 assert.ok(r.validAdventure(r.adventureSnapshot(hero,JSON.parse(JSON.stringify(joined)),null,true),hero),file+': the joined tale is a valid save');
 // Every name the staging uses resolves as it did before the earlier world came along: to the tale's own.
 const before=r.stagingIds(fresh),after=r.stagingIds(joined);
 for(const u of r.stagingNamesUsed(tale.story.staging))if(u.kind==='place'||u.kind==='person')assert.equal(after[u.kind](u.name),before[u.kind](u.name),file+': '+u.path+' "'+u.name+'" still resolves to the tale\'s own');
 assert.equal(after.place(bridge),'bridge',file+': the tale\'s own '+bridge);
 const keys=[...Object.values(joined.story.locations).map(l=>l.name),...r.worldPlaces(joined).map(p=>p.name)].map(r.stagingNameKey);assert.equal(new Set(keys).size,keys.length,file+': no two places read as one name');
 // Every place the hero went to comes along, joined by road to the new start; people met stay met, and those never
 // reached who come along (their homes among the places only heard of that are kept) are not met.
 assert.equal(joined.map.visited.length,fresh.map.visited.length+earlier.map.visited.length,file+': every place the hero went to comes along');
 for(const id of joined.map.visited)assert.ok(r.travelRoute(joined,'inn',id),file+': a road back to '+id);
 for(let i=1;i<=30;i++){const id=Object.entries(joined.people).find(([,p])=>p.name==='Elder Marcher '+i)?.[0];if(i%2)assert.ok(id,file+': Elder Marcher '+i+', met, comes along');if(id)assert.equal(r.metPerson(joined,id),i%2===1,file+': Elder Marcher '+i+(i%2?' met':' never met'));}
 for(const land of earlier.world.regions)if(r.worldPlaces(earlier).some(p=>p.region===land.id&&earlier.map.visited.includes(p.id)))assert.ok(r.mapRegions(joined).some(x=>x.name===land.name),file+': '+land.name+', a land travelled, is kept');
 // The golden path still reaches its ending (with the dice of seeds 1 to 3, as the checker plays it), wherever it did
 // with no earlier world.
 const steps=tale.walkthrough.golden.steps,ending=tale.walkthrough.golden.ending;
 const walk=prepare=>{for(const seed of [1,2,3]){let res;try{res=W.walkTale({r,story:copyOf(tale,'walk-'+tale.slug),hero,heroAt:fighterAt,steps,mode:'steps',seed,prepare});}catch(e){res={ok:false,error:e.message};}if(res.ok&&res.ending===ending)return {ok:true,seed,res};}return {ok:false};};
 const alone=walk(null);
 if(!alone.ok){skipped.push(tale.slug);continue;}
 const res=walk(join);assert.ok(res.ok,file+': the golden path reaches "'+ending+'" with the earlier world joined');walked++;
}
console.log('Campaign world: '+files.length+' written tales begun as a next tale beside a large earlier world (thirty lands, a hundred places, people met and never reached): valid, every staged name still the tale\'s own, every place visited walked back to, met people met; the golden path still reaches its ending for '+walked+(skipped.length?' (not walked, as it fails alone too: '+skipped.join(', ')+')':'')+'.');
