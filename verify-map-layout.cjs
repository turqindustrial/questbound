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
console.log('Passed: regions of 3 to 30 places lay out inside the sheet with markers apart (at phone, panel and full-screen sizes), the same every time; the hero\'s place and the picked place are always named, other names clear markers and each other; the drawn sheet has a marker for every place, a path for every link, escaped names and no stray numbers.');
