const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
// The drawn region map: every known place gets a spot inside the sheet, places never sit on top of each other, the
// place the hero stands in is always named, names stay clear of markers and of each other, and the same region
// always draws the same sheet.
const files=['mapRules.js','iconPaths.js','mapLayout.js','mapArt.js'];
const source=files.map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n');
const r=vm.runInNewContext(source+'\n({regionLayout,regionLabels,labelLines,seededRandom,regionMapSvg,knownPlaceIds,placeKinds,bearings,placeIcons})');
const kinds=r.placeKinds,dirs=Object.keys(r.bearings);
// A region grown the way play grows it: each new place found from a known one, at a bearing and distance.
function region(count,seed){
 const random=r.seededRandom('test:'+seed),coords={inn:{x:0,y:0},bridge:{x:900,y:0},tower:{x:900,y:1200}},places=[];
 for(let i=1;i<=count;i++){
  const known=Object.keys(coords),from=known[Math.floor(random()*known.length)],[dx,dy]=r.bearings[dirs[Math.floor(random()*dirs.length)]],feet=Math.round((0.1+random()*random()*11.9)*5280);
  const p={id:'p'+i,name:['Burned Hut','Greywater Tarn','Cairn of the Nine','Thornwood Deep','Saltmarsh Ferry & Inn','Widow’s <Tooth>'][i%6]+' '+i,description:'A place found while exploring.',kind:kinds[i%kinds.length],x:Math.round(coords[from].x+dx*feet),y:Math.round(coords[from].y+dy*feet),from};
  coords[p.id]={x:p.x,y:p.y};places.push(p);
 }
 return {stage:'inn',story:{id:'story-'+seed,locations:{inn:{name:'Caravan Camp'},bridge:{name:'Overgrown Roadside'},tower:{name:'Lookout Rock'}}},world:{places,at:null},map:{visited:['inn','bridge'],accepted:true,clue:false,peaceful:false,minutes:0}};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
for(const [count,w,h,closest] of [[0,340,323,49],[4,340,323,49],[12,340,323,49],[12,760,517,49],[27,340,323,30],[27,816,775,49],[27,1180,680,49]])for(let seed=1;seed<=6;seed++){
 const game=region(count,seed),layout=r.regionLayout(game,w,h),ids=r.knownPlaceIds(game),label=count+' places at '+w+'×'+h+' (seed '+seed+')';
 assert.equal(layout.ids.length,ids.length);assert.equal(layout.links.length,3+count);
 for(const id of ids){const p=layout.at[id];assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),label);assert.ok(p.x>=37&&p.x<=w-37&&p.y>=37&&p.y<=h-37,label+': '+id+' inside the sheet '+JSON.stringify(p));}
 let nearest=Infinity;for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)nearest=Math.min(nearest,distance(layout.at[ids[i]],layout.at[ids[j]]));
 assert.ok(nearest>=closest,label+': markers '+Math.round(nearest)+' apart');
 assert.equal(JSON.stringify(r.regionLayout(game,w,h)),JSON.stringify(layout),label+': the same every time');
 {const corner={x:w-52,y:h-98,w:52,h:98},K=r.regionLayout(game,w,h,{keepOut:[corner]});for(const id of ids){const p=K.at[id];assert.ok(!(p.x>corner.x-21.9&&p.y>corner.y-21.9),label+': no place under the zoom buttons');}}
 // Names: the hero's place and a picked place are always named; no name covers a marker or another name.
 const here=ids[ids.length-1],picked=ids[Math.floor(ids.length/2)],labels=r.regionLabels(game,w,h,layout,{here,selected:picked});
 assert.ok(labels[here],label+': you are here is named');assert.ok(labels[picked],label+': the picked place is named');
 const boxes=Object.entries(labels),markers=ids.map(id=>({x:layout.at[id].x-14,y:layout.at[id].y-14,w:28,h:28}));
 for(const [id,box] of boxes){
  assert.ok(box.lines.length>=1&&box.lines.length<=2);
  if(id===here||id===picked)continue;
  assert.ok(box.x>=10&&box.x+box.w<=w-10&&box.y>=10&&box.y+box.h<=h-10,label+': '+id+' name inside the sheet');
  assert.ok(!markers.some(m=>overlap(box,m)),label+': '+id+' name clear of markers');
  for(const [other,b] of boxes)if(other!==id&&other!==here&&other!==picked)assert.ok(!overlap(box,b),label+': names '+id+' and '+other+' apart');
 }
 // A new region names every place; a small one nearly all; a crowded phone sheet names what fits (zoom shows the rest).
 if(count===0)assert.equal(boxes.length,ids.length,label+': the starting three are all named');
 if(count===4)assert.ok(boxes.length>=5,label+': most of a small region is named ('+boxes.length+')');
 if(w>=760)assert.ok(boxes.length>=ids.length*.7,label+': a big sheet names most places ('+boxes.length+')');
 // The sheet itself.
 const iconFor=id=>({inn:'home',bridge:'swords',tower:'tower'}[id]??r.placeIcons[game.world.places.find(p=>p.id===id)?.kind]??'compass');
 const args={w,h,seed:game.story.id,ids,at:layout.at,links:layout.links,labels,here,visited:new Set(['inn','bridge']),selected:picked,kinds:Object.fromEntries(ids.map(id=>[id,game.world.places.find(p=>p.id===id)?.kind??'start'])),icons:Object.fromEntries(ids.map(id=>[id,iconFor(id)])),lairs:new Set(ids.slice(3,4)),cleared:new Set(ids.slice(4,5)),distances:Object.fromEntries(layout.links.map(([a,b])=>[a+'-'+b,'1.2 mi'])),title:'Lands about Caravan Camp'};
 const svg=r.regionMapSvg(args);
 assert.ok(svg.length>2000);assert.ok(!/NaN|undefined|Infinity/.test(svg),label+': clean numbers');assert.equal(r.regionMapSvg(args),svg,label+': the same sheet every time');
 assert.equal((svg.match(/<circle r="14.5"/g)??[]).length,ids.length,label+': a marker for every place');
 assert.equal((svg.match(/stroke-dasharray="(5 4|2 5)"/g)??[]).length,layout.links.length,label+': a path for every link');
 assert.ok(svg.includes('LANDS ABOUT CARAVAN CAMP'));assert.ok(!/<Tooth>/.test(svg),'Names are escaped');
 if(labels.p5)assert.ok(svg.includes('&lt;Tooth&gt;'));
}
// Long names break into two balanced lines; short ones stay whole.
assert.deepEqual([...r.labelLines('Caravan Camp')],['Caravan Camp']);assert.deepEqual([...r.labelLines('Burned Shepherd’s Hut by the Tarn')],['Burned Shepherd’s','Hut by the Tarn']);assert.deepEqual([...r.labelLines('Supercalifragilisticexpialidocious')],['Supercalifragilisticexpialidocious']);
// The random stream is repeatable and well spread.
const a=r.seededRandom('x'),b=r.seededRandom('x'),c=r.seededRandom('y');const run=f=>Array.from({length:200},f);const xs=run(a);
assert.deepEqual(run(b),xs);assert.notDeepEqual(run(c),xs);assert.ok(xs.every(v=>v>=0&&v<1));assert.ok(Math.abs(xs.reduce((s,v)=>s+v,0)/200-.5)<.08);
// ---- Cities (2026-10-23): a settlement and the town's own places within a mile and a half of it, at least three ----
{
 const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
 const {rulesSource}=require('./rules-files.cjs'),path=require('path'),{execFileSync}=require('child_process');
 const q=vm.runInNewContext(rulesSource({extra:['mapLayout.js','mapArt.js']})+'\n({readyHero,newAdventure,hostileEncounterGame,freshStoryGame,landCities,cityOf,cityLayout,landsLayout,landsGap,landsSheetScale,landsMapSvg,regionLabels,regionMapSvg,placeName,placeCoordinates,knownPlaceIds,regionOfPlace,cityReach,scaleBar})',{AsyncStorage:{}});
 const kara=q.readyHero('fighter'),base={...q.hostileEncounterGame(kara,q.newAdventure(kara),()=>0).story,status:'active'};
 for(const k of ['openingDialogue','geography','introId','region','terrain'])delete base[k];
 // A besieged city in a gorge, laid out as the written tale "The Siege of Dunscaur" lays out Dunscaur (its directions,
 // miles and kinds; the names here are our own): the market terrace it starts in, five quarters within half a mile, a
 // keep on the dam to the north, and the besiegers' camp below the walls.
 const siege=(story,id='siege-1')=>q.freshStoryGame(kara,{...base,...story,id},q.newAdventure(kara));
 const gorge={region:'The Gorge City',terrain:'mountains',layout:{bridge:{bearing:'S',miles:.8},tower:{bearing:'N',miles:.5,from:'inn'}},
  locations:{inn:{name:'Market Terrace',description:'The broad market terrace behind the walls, ringed by tall stone houses.',kind:'settlement'},bridge:{name:'The Besiegers’ Camp',description:'Rows of tents and siege sheds on the gorge floor below the walls.',kind:'camp'},tower:{name:'The Dam Keep',description:'A squat old fortress along the top of the dam above the city.',kind:'water'}},
  landmarks:[['The Low Gate','road','S',.25,'inn'],['The Stone Arch','landmark','E',.4,'inn'],['The Old Workings','cave','W',.3,'inn'],['The Burnt Terraces','ruin','SW',.35,'inn'],['The Wind Shrine','shrine','N',.4,'tower']].map(([name,kind,bearing,miles,from])=>({name,kind,bearing,miles,from,description:'A part of the city: '+name.toLowerCase()+', with its own lanes.',danger:'safe',feature:''}))};
 const cityGames=[['our gorge city',siege(gorge)]];
 // The real tale, when this PC has it (never in the repository: a tale's words stay on the host's shelf).
 const shelves=[process.env.QUESTBOUND_DATA,process.cwd()];
 try{shelves.push(path.dirname(path.resolve(execFileSync('git',['rev-parse','--git-common-dir'],{encoding:'utf8'}).trim())));}catch{}
 for(const dir of shelves.filter(Boolean)){const file=path.join(dir,'.questbound-written','siege-of-dunscaur.json');if(fs.existsSync(file)){const tale=JSON.parse(fs.readFileSync(file,'utf8'));cityGames.push(['The Siege of Dunscaur',siege(tale.story,'dunscaur-check')]);break;}}
 for(const [label,game] of cityGames){
  const cities=q.landCities(game,'home');
  assert.equal(cities.length,1,label+': one city');const city=cities[0];
  assert.equal(city.id,'inn',label+': the city grows round the starting settlement');
  same([...city.ids],['inn','tower','p1','p2','p3','p4','p5'],label+': the terrace, the keep on the dam and the five quarters');
  same(city.outside.map(o=>o.id),['bridge'],label+': the camp lies outside the city');
  assert.equal(city.outside[0].via,'inn',label+': joined to the city by its road');assert.ok(city.outside[0].feet>2000&&city.outside[0].feet<3500,label+': about half a mile beyond the walls');
  assert.equal(q.cityOf(game,'p3')?.id,'inn');assert.equal(q.cityOf(game,'bridge'),null,label+': the camp is in no city');
  assert.equal(JSON.stringify(q.landCities(game,'home')),JSON.stringify(cities),label+': the same every time');
  for(const [w,h] of [[256,250],[300,285],[340,323],[760,517],[1180,680]]){
   const at=label+' at '+w+'×'+h,L=q.cityLayout(game,city,w,h);
   assert.ok(!/NaN|Infinity|null/.test(JSON.stringify([L.at,L.outside,L.scale,L.bar])),at+': clean numbers');
   for(const id of city.ids){const p=L.at[id];assert.ok(p.x>=46&&p.x<=w-46&&p.y>=46&&p.y<=h-46,at+': '+id+' on the sheet');}
   let nearest=Infinity;for(let i=0;i<city.ids.length;i++)for(let j=i+1;j<city.ids.length;j++)nearest=Math.min(nearest,distance(L.at[city.ids[i]],L.at[city.ids[j]]));
   assert.ok(nearest>=40,at+': districts apart ('+Math.round(nearest)+')');
   // Drawn to scale, north up: the keep north of the terrace, the gate south, the arch east, the old workings west.
   const A=L.at;assert.ok(A.tower.y<A.inn.y&&A.p1.y>A.inn.y&&A.p2.x>A.inn.x&&A.p3.x<A.inn.x&&A.p5.y<A.tower.y,at+': true directions');
   if(w>=760){const feet=(a,b)=>{const p=q.placeCoordinates(game,a),s=q.placeCoordinates(game,b);return Math.hypot(p.x-s.x,p.y-s.y);};
    for(const [a,b] of [['inn','tower'],['inn','p2'],['tower','p5']])assert.ok(Math.abs(distance(A[a],A[b])/(feet(a,b)*L.scale)-1)<.06,at+': linear scale '+a+'–'+b);}
   const camp=L.outside[0];assert.ok(camp.edge&&camp.side==='S'&&Math.abs(camp.y-(h-38))<.6&&camp.x>=20&&camp.x<=w-20,at+': the camp at the south edge '+JSON.stringify(camp));
   assert.ok(L.bar.px>=20&&L.bar.px<=110&&typeof L.bar.text==='string',at+': a scale bar');
   assert.equal(JSON.stringify(q.cityLayout(game,city,w,h)),JSON.stringify(L),at+': the same every time');
   {const corner={x:w-52,y:h-98,w:52,h:98},K=q.cityLayout(game,city,w,h,{keepOut:[corner]});for(const p of [...Object.values(K.at),...K.outside])assert.ok(!(p.x>corner.x-21.9&&p.y>corner.y-21.9),at+': nothing under the zoom buttons '+JSON.stringify(p));}
   // Names: every district named at a panel's size or larger (smaller sheets grow or zoom, AdventureMap.js), never on
   // top of each other or of a marker.
   const all={ids:[...L.ids,...L.outside.map(o=>o.id)],at:{...L.at,...Object.fromEntries(L.outside.map(o=>[o.id,o]))}},labels=q.regionLabels(game,w,h,all,{here:'inn',charWidth:5.46,lineHeight:13.9,avoid:[{x:w-52,y:h-98,w:52,h:98}]});
   if(w>=340)assert.ok(city.ids.every(id=>labels[id]),at+': every district named');
   const boxes=Object.entries(labels);for(const [id,box] of boxes){if(id==='inn')continue;assert.ok(!all.ids.some(m=>overlap(box,{x:all.at[m].x-14,y:all.at[m].y-14,w:28,h:28})),at+': '+id+' clear of markers');for(const [o,b] of boxes)if(o!==id&&o!=='inn')assert.ok(!overlap(box,b),at+': names apart');}
   const svg=q.regionMapSvg({w,h,seed:'city',terrain:'mountains',ids:L.ids,at:L.at,links:L.links,labels,kinds:{},icons:{},here:'inn',outside:L.outside,city:true,bar:L.bar,nameSize:12.5,title:'Market Terrace'});
   assert.ok(!/NaN|undefined|Infinity/.test(svg),at+': a clean city sheet');assert.equal((svg.match(/<circle r="10.5"/g)??[]).length,L.outside.length,at+': a pointer for each place outside');
   assert.ok(svg.includes('>'+L.bar.text+'</text>'),at+': the scale bar is drawn');
  }
 }
 // Made-up lands: places of given kinds at given miles east and north of the start, each found from `from`.
 const land=(start,places,{region=null}={})=>({stage:'inn',story:{id:'cities-'+places.length+start,locations:{inn:{name:'Start',description:'Where it began.',kind:start},bridge:{name:'Far Bridge',description:'A bridge.',kind:'road'},tower:{name:'Far Tower',description:'A tower.',kind:'ruin'}},geography:{at:{inn:{x:0,y:0},bridge:{x:52800,y:0},tower:{x:52800,y:26400}},links:[['inn','bridge'],['bridge','tower']]}},
  world:{at:null,places:places.map(([kind,e,n,from],i)=>({id:'p'+(i+1),name:'Place '+(i+1),description:'A place.',kind,x:Math.round(e*5280),y:Math.round(n*5280),from,...(region?{region}:{})}))},map:{visited:['inn'],accepted:true,clue:false,peaceful:false,minutes:0}});
 // In the wilds there is no city: woods, camps and wild country never make one, however close together.
 assert.equal(q.landCities(land('camp',[['forest',.3,0,'inn'],['wilds',0,.4,'inn'],['camp',.2,.2,'inn'],['lair',-.3,0,'inn']]),'home').length,0,'no city in the wilds');
 assert.equal(q.landCities(land('settlement',[['road',.3,0,'inn'],['forest',0,.4,'inn']]),'home').length,0,'a hamlet with one more place is no city');
 // Two towns eight miles apart are two cities; each place counts in one only; a lair beside one lies outside it.
 const two=land('settlement',[['road',.3,0,'inn'],['shrine',0,.5,'inn'],['settlement',8,0,'bridge'],['ruin',8.4,.2,'p3'],['water',7.8,-.3,'p3'],['lair',8,1,'p3']]);
 const pair=q.landCities(two,'home');
 same(pair.map(c=>[c.id,[...c.ids]]),[['inn',['inn','p1','p2']],['p3',['p3','p4','p5']]],'two cities in one land');
 same(pair[1].outside.map(o=>[o.id,o.via]),[['p6','p3'],['bridge','p3']],'the lair beside the second town and the bridge it was found from lie outside it');
 // A town whose places run on past the reach: those within it are the city, the rest are pointed to.
 const split=land('settlement',[['road',.5,0,'inn'],['landmark',1.2,.2,'p1'],['shrine',2.1,0,'p2'],['ruin',-.6,.1,'inn'],['settlement',.9,-.6,'inn']]);
 const one=q.landCities(split,'home');
 assert.equal(one.length,1,'one city: a second settlement within reach is one of its quarters');same([...one[0].ids],['inn','p1','p2','p4','p5'],'what lies within a mile and a half');
 same(one[0].outside.map(o=>[o.id,o.via]),[['p3','p2'],['bridge','inn']],'the shrine past the reach is pointed to along its road, as is the far bridge');
 // A city is where the most is: the bigger town claims the places they share.
 const rival=land('settlement',[['settlement',1.4,0,'inn'],['road',1.6,.2,'p1'],['ruin',1.8,-.2,'p1'],['shrine',1.2,.3,'p1']]);
 same(q.landCities(rival,'home').map(c=>c.id),['p1'],'the town with more quarters round it is the city');
 // Cities of another land are worked out for that land's sheet.
 const away=land('camp',[['wilds',5,5,'inn'],['settlement',30,30,'p1'],['road',30.2,30,'p2'],['ruin',30,30.3,'p2']].map((p,i)=>p));
 away.world.places.forEach((p,i)=>{if(i>0)p.region='r1';});away.world.regions=[{id:'r1',name:'The Far Reach',terrain:'hills'}];
 assert.equal(q.landCities(away,'home').length,0);same(q.landCities(away,'r1').map(c=>[...c.ids]),[['p2','p3','p4']],'a city in another land');
 // Pointers at the edge never sit on each other, whatever their number.
 const crowd=land('settlement',[['road',.2,0,'inn'],['ruin',0,.2,'inn'],...Array.from({length:8},(_,i)=>['camp',2*Math.cos(i*.3),-2-0.1*i,'inn'])]);
 const c0=q.landCities(crowd,'home')[0];assert.equal(c0.outside.length,8);
 for(const [w,h] of [[256,250],[340,323],[760,517]]){const L=q.cityLayout(crowd,c0,w,h);
  for(let i=0;i<L.outside.length;i++){const p=L.outside[i];assert.ok(p.x>=20&&p.x<=w-20&&p.y>=20&&p.y<=h-38,'a pointer on the sheet');for(let j=i+1;j<L.outside.length;j++)assert.ok(distance(p,L.outside[j])>=30,w+': pointers apart ('+Math.round(distance(p,L.outside[j]))+')');}}
 // ---- All lands: every land a mark, roads between them with their miles ----
 const lands=(count,seed)=>{
  const random=r.seededRandom('lands:'+seed),places=[],regions=[];
  for(let i=1;i<count;i++){
   const from=i===1?'inn':'p'+(1+Math.floor(random()*(i-1))),origin=from==='inn'?{x:0,y:0}:places.find(p=>p.id===from),angle=random()*Math.PI*2,miles=15+random()*285;
   regions.push({id:'r'+i,name:['The Ashmere Downs','Brynwood','The Calder Hills','Dunreach','The Eldmark Peaks','Falstrand Coast'][i%6]+' '+i,terrain:['plains','forest','hills','mountains','coast','marsh','desert','snow','caverns'][i%9]});
   places.push({id:'p'+i,name:'Arrival '+i,description:'Where the road arrived.',kind:'road',x:Math.round(origin.x+Math.cos(angle)*miles*5280),y:Math.round(origin.y+Math.sin(angle)*miles*5280),from,region:'r'+i});
  }
  return {stage:count>1?'wild':'inn',story:{id:'lands-'+seed,region:'The Home Vale',terrain:'plains',locations:{inn:{name:'Hearth',description:'Home.',kind:'settlement'},bridge:{name:'Ford',description:'A ford.',kind:'road'},tower:{name:'Tor',description:'A tor.',kind:'ruin'}},geography:{at:{inn:{x:0,y:0},bridge:{x:3000,y:0},tower:{x:0,y:3000}},links:[['inn','bridge'],['inn','tower']]}},
   world:{at:count>1?'p'+(count-1):null,places,regions},map:{visited:['inn',...places.filter((p,i)=>i%2===0).map(p=>p.id)],accepted:true,clue:false,peaceful:false,minutes:0}};
 };
 for(const count of [1,2,30,60])for(const [w,h] of [[256,250],[300,285],[340,323],[760,517],[1180,680]])for(const seed of [1,2]){
  const game=lands(count,seed),z=q.landsSheetScale(count,w,h),W=Math.round(w*z),H=Math.round(h*z),L=q.landsLayout(game,W,H),at=count+' lands at '+w+'×'+h+' (zoom '+z+', seed '+seed+')';
  assert.equal(L.ids.length,count,at+': every land');assert.equal(L.ids[0],'home');assert.equal(L.here,count>1?'r'+(count-1):'home',at+': where the hero is');
  assert.equal(L.roads.length,count-1,at+': a road for each way between lands');assert.ok(L.roads.every(x=>x.miles>=14&&x.miles<=300.5),at+': roads keep their miles');
  assert.ok(!/NaN|Infinity|null/.test(JSON.stringify(L)),at+': clean numbers');
  for(const id of L.ids){const p=L.at[id];assert.ok(p.x>=40&&p.x<=W-40&&p.y>=40&&p.y<=H-66,at+': '+id+' on the sheet');}
  assert.ok(L.gap>=46||count===1,at+': room for a tap each ('+L.gap+')');
  let nearest=Infinity;for(let i=0;i<L.ids.length;i++)for(let j=i+1;j<L.ids.length;j++)nearest=Math.min(nearest,distance(L.at[L.ids[i]],L.at[L.ids[j]]));
  assert.ok(nearest>=Math.min(L.gap,46)-1,at+': lands apart ('+Math.round(nearest)+' of '+L.gap+')');
  assert.equal(JSON.stringify(q.landsLayout(game,W,H)),JSON.stringify(L),at+': the same every time');
  {const corner={x:W-52,y:H-98,w:52,h:98},K=q.landsLayout(game,W,H,{keepOut:[corner]});for(const p of Object.values(K.at))assert.ok(!(p.x>corner.x-21.9&&p.y>corner.y-21.9),at+': no land under the zoom buttons');}
  const names=Object.fromEntries([{id:'home',name:'The Home Vale'},...game.world.regions].map(x=>[x.id,x.name])),labels=q.regionLabels(game,W,H,L,{here:L.here,nameOf:id=>names[id],marker:2*L.radius+6,reach:L.radius+5,avoid:[{x:W-52,y:H-98,w:52,h:98}]});
  assert.ok(labels[L.here],at+': the land you are in is named');if(count<=2)assert.equal(Object.keys(labels).length,count,at+': a few lands are all named');
  const boxes=Object.entries(labels);for(const [id,box] of boxes){if(id===L.here)continue;assert.ok(box.x>=10&&box.x+box.w<=W-10&&box.y>=10&&box.y+box.h<=H-10,at+': name on the sheet');assert.ok(!L.ids.some(m=>overlap(box,{x:L.at[m].x-L.radius,y:L.at[m].y-L.radius,w:2*L.radius,h:2*L.radius})),at+': '+id+' name clear of the lands');for(const [o,b] of boxes)if(o!==id&&o!==L.here)assert.ok(!overlap(box,b),at+': names apart');}
  const svg=q.landsMapSvg({w:W,h:H,seed:'lands',ids:L.ids,at:L.at,roads:L.roads,labels,terrains:Object.fromEntries([['home','plains'],...game.world.regions.map(x=>[x.id,x.terrain])]),here:L.here,visited:new Set(['home']),radius:L.radius,title:'All lands'});
  assert.ok(!/NaN|undefined|Infinity/.test(svg),at+': a clean sheet');assert.equal(q.landsMapSvg({w:W,h:H,seed:'lands',ids:L.ids,at:L.at,roads:L.roads,labels,terrains:{},here:L.here,radius:L.radius}).length>1000,true);
  assert.equal((svg.match(/<path data-land=/g)??[]).length,count,at+': a patch for every land');
 }
 assert.equal(q.landsSheetScale(1,340,323),1);assert.equal(q.landsSheetScale(2,340,323),1);assert.ok(q.landsSheetScale(60,300,285)>1.5,'sixty lands on a phone: a larger sheet that scrolls');
 same(q.scaleBar(.1),{px:100,text:'1,000 ft',feet:1000});assert.equal(q.scaleBar(.02).text,'1 mile');
}
console.log('Passed: regions of 3 to 30 places lay out inside the sheet with markers apart (at phone, panel and full-screen sizes), the same every time; the hero\'s place and the picked place are always named, other names clear markers and each other; the drawn sheet has a marker for every place, a path for every link, escaped names and no stray numbers. Cities: the gorge city laid out as The Siege of Dunscaur lays out Dunscaur (and the tale itself when this PC has it) is one city of seven places with the besiegers’ camp outside it, no city in the wilds, two towns are two cities, places past the reach are pointed to; drawn to scale with true directions, every district named and apart, pointers at the edge apart, the same every time. All lands: 1, 2, 30 and 60 lands lie on the sheet apart (a larger sheet when there are many), roads keep their miles, names apart, a clean drawing.');
