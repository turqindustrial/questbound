import {knownPlaceIds,worldLinks,placeCoordinates,placeName,regionOfPlace,currentRegion,worldPlace,mapRegions} from './mapRules';
// Where the places of one region sit on a drawn map of a given size. A sketch, not a survey: each place lies off a
// neighbour in its true direction, at a distance that grows with the log of the miles (so a hut 300 feet away and a
// ruin six miles off both fit), and places that would land on top of each other are nudged apart. Paths that leave
// the region (to another land, or an earlier chapter's country) run to the edge of the sheet as exits.
export function regionLayout(game,w,h,{pad=38,gap=50,region=null,keepOut=[]}={}){
 const shown=region??currentRegion(game),ids=knownPlaceIds(game).filter(id=>regionOfPlace(game,id)===shown),all=worldLinks(game),inside=new Set(ids),raw={};
 const leg=(known,next)=>{const p=placeCoordinates(game,known)??{x:0,y:0},q=placeCoordinates(game,next)??{x:0,y:0},dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1,step=1.1+0.6*Math.log2(1+len/5280);return {x:raw[known].x+dx/len*step,y:raw[known].y+dy/len*step};};
 if(ids.length)raw[ids[0]]={x:0,y:0};
 for(let grew=true;grew;){grew=false;for(const [a,b] of all)for(const [known,next] of [[a,b],[b,a]])if(raw[known]&&!raw[next]&&inside.has(next)){raw[next]=leg(known,next);grew=true;}}
 // A place joined to nothing else on this sheet is still set down in its true direction from the first one.
 for(const id of ids)if(!raw[id])raw[id]=leg(ids[0],id);
 if(!ids.length)return {ids,at:{},links:[],exits:[],region:shown};
 const xs=ids.map(id=>raw[id].x),ys=ids.map(id=>raw[id].y),minX=Math.min(...xs),maxY=Math.max(...ys);
 const realX=Math.max(...xs)-minX,realY=maxY-Math.min(...ys),spanX=Math.max(1,realX),spanY=Math.max(1,realY);
 // Room is left at the edges for labels beside and below the markers. A long, thin country is stretched a little
 // across the sheet (it is a sketch): names need the room more than the map needs true proportions.
 const innerW=Math.max(60,w-2*pad-60),innerH=Math.max(60,h-2*pad-34),scale=Math.min(innerW/spanX,innerH/spanY),scaleX=Math.min(innerW/spanX,scale*1.6),scaleY=Math.min(innerH/spanY,scale*1.6);
 const at=Object.fromEntries(ids.map(id=>[id,{x:(w-realX*scaleX)/2+(raw[id].x-minX)*scaleX,y:(h-10-realY*scaleY)/2+(maxY-raw[id].y)*scaleY}]));
 // Nudge apart whatever sits closer than a marker and its neighbour need; a small region never moves at all.
 const clamp=p=>{p.x=Math.max(pad,Math.min(w-pad,p.x));p.y=Math.max(pad,Math.min(h-pad-8,p.y));keepMarkerClear(p,keepOut);};
 ids.forEach(id=>clamp(at[id]));
 for(let pass=0;pass<80;pass++){
  let moved=false;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const a=at[ids[i]],b=at[ids[j]];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d>=gap)continue;
   if(d<0.01){const angle=(i*7+j*13)%12/12*Math.PI*2;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const push=(gap-d)/2+0.5;a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;clamp(a);clamp(b);moved=true;
  }
  if(!moved)break;
 }
 for(const id of ids){at[id].x=Math.round(at[id].x*10)/10;at[id].y=Math.round(at[id].y*10)/10;}
 // Roads out of this region: from the place they leave, in their true direction, to the edge of the sheet.
 const exits=[];
 for(const [a,b] of all){
  if(inside.has(a)===inside.has(b))continue;
  const from=inside.has(a)?a:b,to=inside.has(a)?b:a,p=placeCoordinates(game,from)??{x:0,y:0},q=placeCoordinates(game,to)??{x:0,y:0};
  let dx=q.x-p.x,dy=-(q.y-p.y);const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
  const o=at[from],edge=16,tx=dx>0?(w-edge-o.x)/dx:dx<0?(edge-o.x)/dx:Infinity,ty=dy>0?(h-edge-o.y)/dy:dy<0?(edge-o.y)/dy:Infinity,t=Math.max(0,Math.min(tx,ty));
  exits.push({from,to,region:regionOfPlace(game,to),x:Math.round((o.x+dx*t)*10)/10,y:Math.round((o.y+dy*t)*10)/10});
 }
 return {ids,at,links:all.filter(([a,b])=>at[a]&&at[b]),exits,region:shown};
}
// A marker never sits under the zoom buttons of a sheet at full view (keepOut: their corner): one that would is moved
// left or up, whichever is nearer, by as much as a tap on it needs.
export function keepMarkerClear(p,keepOut,r=22){for(const k of keepOut)if(p.x>k.x-r&&p.x<k.x+k.w+r&&p.y>k.y-r&&p.y<k.y+k.h+r){if(p.x-(k.x-r)<p.y-(k.y-r))p.x=k.x-r;else p.y=k.y-r;}}
// A name on the map: one line, or two when it is long.
export function labelLines(name,max=17){
 const text=String(name??'').trim();
 if(text.length<=max||!text.includes(' '))return [text];
 const words=text.split(/\s+/);let best=1,score=Infinity;
 for(let i=1;i<words.length;i++){const first=words.slice(0,i).join(' ').length,second=words.slice(i).join(' ').length,s=Math.max(first,second);if(s<score){score=s;best=i;}}
 return [words.slice(0,best).join(' '),words.slice(best).join(' ')];
}
// Labels go below each marker, or above, right or left, whichever first clears the markers and the labels already
// placed (the current place and the chosen one are placed first and always shown). A label with no clear spot is
// left off until the map is zoomed in.
export function regionLabels(game,w,h,layout,{here=null,selected=null,charWidth=5.9,lineHeight=15,avoid=[],nameOf=null,marker=33,reach=18}={}){
 const {ids,at}=layout,labels={},taken=[...ids.map(id=>({x:at[id].x-marker/2,y:at[id].y-marker/2,w:marker,h:marker})),...avoid];
 const overlap=(r,t)=>Math.max(0,Math.min(r.x+r.w,t.x+t.w)-Math.max(r.x,t.x))*Math.max(0,Math.min(r.y+r.h,t.y+t.h)-Math.max(r.y,t.y));
 const covered=r=>taken.reduce((sum,t)=>sum+overlap(r,t),0);
 const order=[...new Set([here,selected,...ids].filter(id=>id&&at[id]))];
 for(const id of order){
  const lines=labelLines(nameOf?nameOf(id):placeName(game,id)),lw=Math.max(...lines.map(l=>l.length))*charWidth+8,lh=lines.length*lineHeight,p=at[id];
  // Below, above, right, left, the four corners, then below and above shifted to either side.
  const R=reach,X=reach-5,Y=reach-6;
  const options=[{x:p.x-lw/2,y:p.y+R,align:'center'},{x:p.x-lw/2,y:p.y-R-lh,align:'center'},{x:p.x+R+1,y:p.y-lh/2,align:'left'},{x:p.x-R-1-lw,y:p.y-lh/2,align:'right'},
   {x:p.x+X,y:p.y+Y,align:'left'},{x:p.x-X-lw,y:p.y+Y,align:'right'},{x:p.x+X,y:p.y-Y-lh,align:'left'},{x:p.x-X-lw,y:p.y-Y-lh,align:'right'},
   {x:p.x-4,y:p.y+R,align:'left'},{x:p.x+4-lw,y:p.y+R,align:'right'},{x:p.x-4,y:p.y-R-lh,align:'left'},{x:p.x+4-lw,y:p.y-R-lh,align:'right'}].map(o=>({...o,w:lw,h:lh}));
  const fits=o=>o.x>=10&&o.x+o.w<=w-10&&o.y>=10&&o.y+o.h<=h-10,inside=options.filter(fits);
  const clear=inside.find(o=>covered(o)===0),must=id===here||id===selected;
  // The place you stand in and the one you picked are always named: where the least is covered.
  const best=clear??(must?[...(inside.length?inside:options)].sort((a,b)=>covered(a)-covered(b))[0]:null);
  if(!best)continue;
  labels[id]={...best,lines};taken.push(best);
 }
 return labels;
}
// ---------- Cities ----------
// A city on the map (2026-10-23, the host: "add the ability for the map to help guide the player around cities"): a
// settlement and the places of its own land within a mile and a half of it that a town is made of (its quarters, gates,
// shrines, ruins, landmarks, waterfronts and old workings), at least three in all. Worked out from the map alone, the
// same on every device: the settlement with the most such places around it is a city first, then the next one not yet
// taken, so two towns in one land are two cities and a place counts in one only. Camps, lairs and the open country
// (forest, wilds, mountain) are never part of a city: they lie outside it (a besiegers' camp under the walls), shown at
// the city sheet's edge with a pointer when a road joins them to the city or they lie within three miles of it.
export const cityReach=1.5*5280,cityLeast=3,cityOutside=8;
export const districtKinds=['settlement','road','water','ruin','cave','shrine','landmark'];
// What a place is: a found place's kind, or (for the three starting places) the kind its story gave it.
export const placeKindOf=(game,id)=>worldPlace(game,id)?.kind??game?.story?.locations?.[id]?.kind??null;
export function landCities(game,region=currentRegion(game)){
 const ids=knownPlaceIds(game).filter(id=>regionOfPlace(game,id)===region&&placeCoordinates(game,id));
 const at=Object.fromEntries(ids.map(id=>[id,placeCoordinates(game,id)])),apart=(a,b)=>Math.hypot(at[a].x-at[b].x,at[a].y-at[b].y);
 const district=id=>districtKinds.includes(placeKindOf(game,id));
 const around=core=>ids.filter(id=>id!==core&&district(id)&&apart(core,id)<=cityReach);
 const cores=ids.map((id,i)=>({id,i})).filter(c=>placeKindOf(game,c.id)==='settlement').map(c=>({...c,n:around(c.id).length})).sort((a,b)=>b.n-a.n||a.i-b.i);
 const claimed=new Set(),cities=[],links=worldLinks(game);
 for(const {id:core} of cores){
  if(claimed.has(core))continue;
  const members=new Set([core,...around(core).filter(id=>!claimed.has(id))]);
  if(members.size<cityLeast)continue;
  for(const id of members)claimed.add(id);
  cities.push({id:core,region,name:placeName(game,core),ids:ids.filter(id=>members.has(id))});
 }
 for(const city of cities){
  const inside=new Set(city.ids),xs=city.ids.map(id=>at[id].x),ys=city.ids.map(id=>at[id].y),joined=new Map();
  city.centre={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
  for(const [a,b] of links){if(inside.has(a)&&!inside.has(b)&&at[b]&&!joined.has(b))joined.set(b,a);else if(inside.has(b)&&!inside.has(a)&&at[a]&&!joined.has(a))joined.set(a,b);}
  const off=id=>Math.hypot(at[id].x-city.centre.x,at[id].y-city.centre.y),walls=id=>Math.round(Math.min(...city.ids.map(m=>apart(m,id))));
  city.outside=ids.filter(id=>!inside.has(id)&&(joined.has(id)||off(id)<=2*cityReach)).sort((a,b)=>off(a)-off(b)||ids.indexOf(a)-ids.indexOf(b)).slice(0,cityOutside).map(id=>({id,via:joined.get(id)??null,feet:walls(id)}));
 }
 return cities;
}
// The city a place is part of, if any.
export const cityOf=(game,id)=>id?landCities(game,regionOfPlace(game,id)).find(c=>c.ids.includes(id))??null:null;
// A scale bar for a sheet drawn to scale: the longest round distance that is no wider than 110 pixels.
const scaleSteps=[[250,'250 ft'],[500,'500 ft'],[1000,'1,000 ft'],[1320,'a quarter mile'],[2640,'half a mile'],[5280,'1 mile'],[10560,'2 miles'],[26400,'5 miles']];
export function scaleBar(pxPerFoot){
 let best=scaleSteps[0];for(const step of scaleSteps)if(step[0]*pxPerFoot<=110)best=step;
 return {px:Math.round(best[0]*pxPerFoot*10)/10,text:best[1],feet:best[0]};
}
// A city drawn to scale (linear, true relative positions, north up), centred on the sheet, a quarter mile across at
// least. Districts that would sit on top of each other are nudged apart only as far as their markers need. Places
// outside the city are set down where they lie when that is on the sheet, else at its edge (`edge`), in their true
// direction from the city's middle, with the angle their pointer faces; pointers never sit on each other.
export function cityLayout(game,city,w,h,{gap=42,foot=18,keepOut=[]}={}){
 const outside=city.outside??[],pad=outside.length?62:46,edge=20,coord=id=>placeCoordinates(game,id)??{x:0,y:0};
 const xs=city.ids.map(id=>coord(id).x),ys=city.ids.map(id=>coord(id).y),least=1320;
 const spanX=Math.max(least,Math.max(...xs)-Math.min(...xs)),spanY=Math.max(least,Math.max(...ys)-Math.min(...ys));
 const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 const innerW=Math.max(40,w-2*pad),innerH=Math.max(40,h-2*pad-foot),scale=Math.min(innerW/spanX,innerH/spanY);
 const mx=w/2,my=(h-foot)/2,project=p=>({x:mx+(p.x-cx)*scale,y:my-(p.y-cy)*scale});
 const ids=city.ids,at=Object.fromEntries(ids.map(id=>[id,project(coord(id))]));
 const clamp=p=>{p.x=Math.max(pad,Math.min(w-pad,p.x));p.y=Math.max(pad,Math.min(h-pad-foot,p.y));keepMarkerClear(p,keepOut);};
 ids.forEach(id=>clamp(at[id]));
 for(let pass=0;pass<80;pass++){
  let moved=false;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const a=at[ids[i]],b=at[ids[j]];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d>=gap)continue;
   if(d<0.01){const angle=(i*7+j*13)%12/12*Math.PI*2;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const push=(gap-d)/2+0.5;a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;clamp(a);clamp(b);moved=true;
  }
  if(!moved)break;
 }
 // Outside: where it lies, or where the line from the city's middle towards it meets the sheet's edge band.
 const box={x0:edge,x1:w-edge,y0:edge,y1:h-edge-foot},deg=(dx,dy)=>Math.round(Math.atan2(dy,dx)*1800/Math.PI)/10;
 const pointers=outside.map(o=>{
  const p=project(coord(o.id)),onSheet=p.x>=pad&&p.x<=w-pad&&p.y>=pad&&p.y<=h-pad-foot&&ids.every(id=>Math.hypot(at[id].x-p.x,at[id].y-p.y)>=gap);
  let dx=p.x-mx,dy=p.y-my;const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
  if(onSheet)return {...o,x:p.x,y:p.y,edge:false,side:null,angle:deg(dx,dy)};
  const tx=dx>0?(box.x1-mx)/dx:dx<0?(box.x0-mx)/dx:Infinity,ty=dy>0?(box.y1-my)/dy:dy<0?(box.y0-my)/dy:Infinity,t=Math.min(tx,ty);
  return {...o,x:mx+dx*t,y:my+dy*t,edge:true,side:tx<ty?(dx>0?'E':'W'):(dy>0?'S':'N'),angle:deg(dx,dy)};
 });
 // Pointers at the edge go round it: each where its line meets the edge, then spread along the edge (round a corner
 // when one side is full) so none sits on another. The edge keeps clear of the scale bar (top left), the compass (top
 // right) and the zoom buttons (bottom right), and of the very corners.
 const runs=[{side:'N',a:{x:Math.min(box.x1,box.x0+150),y:box.y0},b:{x:Math.max(box.x0+150,box.x1-55),y:box.y0}},{side:'E',a:{x:box.x1,y:box.y0+56},b:{x:box.x1,y:Math.max(box.y0+56,box.y1-90)}},
  {side:'S',a:{x:Math.max(box.x0+25,box.x1-42),y:box.y1},b:{x:box.x0+25,y:box.y1}},{side:'W',a:{x:box.x0,y:box.y1-25},b:{x:box.x0,y:box.y0+25}}].map(r=>({...r,len:Math.hypot(r.b.x-r.a.x,r.b.y-r.a.y)}));
 const loop=runs.reduce((s,r)=>s+r.len,0);
 const toLoop=p=>{let best=null,start=0;for(const r of runs){const dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,t=r.len?Math.max(0,Math.min(1,((p.x-r.a.x)*dx+(p.y-r.a.y)*dy)/(r.len*r.len))):0,d=Math.hypot(r.a.x+dx*t-p.x,r.a.y+dy*t-p.y);if(!best||d<best.d)best={d,s:start+t*r.len};start+=r.len;}return best.s;};
 const fromLoop=s=>{s=((s%loop)+loop)%loop;for(const r of runs){if(s<=r.len||r===runs.at(-1)){const t=r.len?Math.min(1,s/r.len):0;return {x:r.a.x+(r.b.x-r.a.x)*t,y:r.a.y+(r.b.y-r.a.y)*t,side:r.side};}s-=r.len;}};
 const rim=pointers.filter(p=>p.edge).map(p=>({p,s:toLoop(p)}));
 if(rim.length>1&&loop>0)for(let pass=0;pass<120;pass++){
  rim.sort((m,n)=>m.s-n.s);let moved=false;
  for(let i=0;i<rim.length;i++){const m=rim[i],k=rim[(i+1)%rim.length],d=((k.s-m.s)%loop+loop)%loop;if(d>=gap||rim.length*gap>loop&&d>=loop/rim.length-.5)continue;const push=(Math.min(gap,loop/rim.length)-d)/2+.25;m.s-=push;k.s+=push;moved=true;}
  if(!moved)break;
 }
 for(const {p,s} of rim)Object.assign(p,fromLoop(s));
 // A pointer on the sheet itself is nudged off the districts and the other pointers, which never move for it.
 for(let pass=0;pass<80;pass++){
  let moved=false;
  for(const a of pointers.filter(p=>!p.edge))for(const b of [...pointers.filter(p=>p!==a),...ids.map(id=>at[id])]){
   let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d>=gap)continue;if(d<0.01){dx=1;dy=0;d=1;}
   a.x=Math.max(pad,Math.min(w-pad,a.x+dx/d*(gap-d+.5)));a.y=Math.max(pad,Math.min(h-pad-foot,a.y+dy/d*(gap-d+.5)));moved=true;
  }
  if(!moved)break;
 }
 const r10=v=>Math.round(v*10)/10;
 for(const id of ids){at[id].x=r10(at[id].x);at[id].y=r10(at[id].y);}
 for(const p of pointers){p.x=r10(p.x);p.y=r10(p.y);}
 return {ids,at,links:worldLinks(game).filter(([a,b])=>at[a]&&at[b]),outside:pointers,scale,bar:scaleBar(scale),region:city.region};
}
// ---------- All lands ----------
// Every land the hero knows as one sheet (2026-10-23, the host: "make it possible for the map to zoom out even further
// once the player leaves the initial map, to make navigation back to previously explored areas possible"): each land a
// mark at its rough place (the middle of its places), joined by the roads between lands. Like a region sheet it is a
// sketch: the home land first, each land set off a neighbour in its true direction at a distance that grows with the log
// of the miles (so a road of 15 miles and one of 300 both fit), then nudged apart. Roads carry their true miles.
export function landsLayout(game,w,h,{pad=40,foot=26,keepOut=[]}={}){
 const byLand=new Map();
 for(const id of knownPlaceIds(game)){const c=placeCoordinates(game,id);if(!c)continue;const r=regionOfPlace(game,id);if(!byLand.has(r))byLand.set(r,[]);byLand.get(r).push(c);}
 const lands=mapRegions(game).filter(r=>byLand.has(r.id)),ids=lands.map(r=>r.id),order=Object.fromEntries(ids.map((id,i)=>[id,i]));
 if(!ids.length)return {ids,at:{},roads:[],gap:0,radius:0,here:null};
 const middle=Object.fromEntries(ids.map(id=>{const ps=byLand.get(id);return [id,{x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length}];}));
 const found=new Map();
 for(const [a,b] of worldLinks(game)){
  const ra=regionOfPlace(game,a),rb=regionOfPlace(game,b),p=placeCoordinates(game,a),q=placeCoordinates(game,b);
  if(ra===rb||!(ra in order)||!(rb in order)||!p||!q)continue;
  const [x,y]=order[ra]<order[rb]?[ra,rb]:[rb,ra],key=x+'|'+y,miles=Math.round(Math.hypot(p.x-q.x,p.y-q.y)/528)/10;
  if(!found.has(key)||found.get(key).miles>miles)found.set(key,{a:x,b:y,miles});
 }
 const roads=[...found.values()].sort((m,n)=>order[m.a]-order[n.a]||order[m.b]-order[n.b]),raw={};
 const leg=(known,next,miles)=>{const p=middle[known],q=middle[next],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1,far=miles??len/5280,step=1+0.7*Math.log2(1+far/10);return {x:raw[known].x+dx/len*step,y:raw[known].y+dy/len*step};};
 raw[ids[0]]={x:0,y:0};
 for(let grew=true;grew;){grew=false;for(const road of roads)for(const [known,next] of [[road.a,road.b],[road.b,road.a]])if(raw[known]&&!raw[next]){raw[next]=leg(known,next,road.miles);grew=true;}}
 for(const id of ids)if(!raw[id])raw[id]=leg(ids[0],id,null);
 const xs=ids.map(id=>raw[id].x),ys=ids.map(id=>raw[id].y),minX=Math.min(...xs),maxY=Math.max(...ys);
 const realX=Math.max(...xs)-minX,realY=maxY-Math.min(...ys),spanX=Math.max(1,realX),spanY=Math.max(1,realY);
 const innerW=Math.max(40,w-2*pad),innerH=Math.max(40,h-2*pad-foot),scale=Math.min(innerW/spanX,innerH/spanY),scaleX=Math.min(innerW/spanX,scale*1.6),scaleY=Math.min(innerH/spanY,scale*1.6);
 const gap=landsGap(ids.length,w,h,{pad,foot}),radius=Math.max(9,Math.min(20,Math.round(gap*.32)));
 const at=Object.fromEntries(ids.map(id=>[id,{x:(w-realX*scaleX)/2+(raw[id].x-minX)*scaleX,y:(h-foot-realY*scaleY)/2+(maxY-raw[id].y)*scaleY}]));
 const clamp=p=>{p.x=Math.max(pad,Math.min(w-pad,p.x));p.y=Math.max(pad,Math.min(h-pad-foot,p.y));keepMarkerClear(p,keepOut);};
 ids.forEach(id=>clamp(at[id]));
 for(let pass=0;pass<200;pass++){
  let moved=false;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const a=at[ids[i]],b=at[ids[j]];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d>=gap)continue;
   if(d<0.01){const angle=(i*7+j*13)%12/12*Math.PI*2;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const push=(gap-d)/2+0.5;a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;clamp(a);clamp(b);moved=true;
  }
  if(!moved)break;
 }
 for(const id of ids){at[id].x=Math.round(at[id].x*10)/10;at[id].y=Math.round(at[id].y*10)/10;}
 return {ids,at,roads,gap,radius,here:currentRegion(game)};
}
// How far apart the lands are kept on a sheet: a share of the room each would have spread evenly, at most 70 pixels.
export function landsGap(count,w,h,{pad=40,foot=26}={}){return Math.max(24,Math.min(70,Math.floor(Math.sqrt(Math.max(1,(w-2*pad)*(h-2*pad-foot))/Math.max(1,count))*.62)));}
// The all-lands sheet grows (and scrolls) when there are many lands, so each keeps a mark and a tap of its own: the
// least zoom, in tenths, at which they are kept at least 46 pixels apart.
export function landsSheetScale(count,w,h){let z=1;while(z<4&&landsGap(count,Math.round(w*z),Math.round(h*z))<46)z=Math.round((z+.1)*10)/10;return z;}
