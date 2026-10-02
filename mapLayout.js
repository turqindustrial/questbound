import {knownPlaceIds,worldLinks,placeCoordinates,placeName,regionOfPlace,currentRegion} from './mapRules';
// Where the places of one region sit on a drawn map of a given size. A sketch, not a survey: each place lies off a
// neighbour in its true direction, at a distance that grows with the log of the miles (so a hut 300 feet away and a
// ruin six miles off both fit), and places that would land on top of each other are nudged apart. Paths that leave
// the region (to another land, or an earlier chapter's country) run to the edge of the sheet as exits.
export function regionLayout(game,w,h,{pad=38,gap=50,region=null}={}){
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
 const clamp=p=>{p.x=Math.max(pad,Math.min(w-pad,p.x));p.y=Math.max(pad,Math.min(h-pad-8,p.y));};
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
export function regionLabels(game,w,h,layout,{here=null,selected=null,charWidth=5.9,lineHeight=15,avoid=[]}={}){
 const {ids,at}=layout,labels={},taken=[...ids.map(id=>({x:at[id].x-16.5,y:at[id].y-16.5,w:33,h:33})),...avoid];
 const overlap=(r,t)=>Math.max(0,Math.min(r.x+r.w,t.x+t.w)-Math.max(r.x,t.x))*Math.max(0,Math.min(r.y+r.h,t.y+t.h)-Math.max(r.y,t.y));
 const covered=r=>taken.reduce((sum,t)=>sum+overlap(r,t),0);
 const order=[...new Set([here,selected,...ids].filter(id=>id&&at[id]))];
 for(const id of order){
  const lines=labelLines(placeName(game,id)),lw=Math.max(...lines.map(l=>l.length))*charWidth+8,lh=lines.length*lineHeight,p=at[id];
  // Below, above, right, left, the four corners, then below and above shifted to either side.
  const options=[{x:p.x-lw/2,y:p.y+18,align:'center'},{x:p.x-lw/2,y:p.y-18-lh,align:'center'},{x:p.x+19,y:p.y-lh/2,align:'left'},{x:p.x-19-lw,y:p.y-lh/2,align:'right'},
   {x:p.x+13,y:p.y+12,align:'left'},{x:p.x-13-lw,y:p.y+12,align:'right'},{x:p.x+13,y:p.y-12-lh,align:'left'},{x:p.x-13-lw,y:p.y-12-lh,align:'right'},
   {x:p.x-4,y:p.y+18,align:'left'},{x:p.x+4-lw,y:p.y+18,align:'right'},{x:p.x-4,y:p.y-18-lh,align:'left'},{x:p.x+4-lw,y:p.y-18-lh,align:'right'}].map(o=>({...o,w:lw,h:lh}));
  const fits=o=>o.x>=10&&o.x+o.w<=w-10&&o.y>=10&&o.y+o.h<=h-10,inside=options.filter(fits);
  const clear=inside.find(o=>covered(o)===0),must=id===here||id===selected;
  // The place you stand in and the one you picked are always named: where the least is covered.
  const best=clear??(must?[...(inside.length?inside:options)].sort((a,b)=>covered(a)-covered(b))[0]:null);
  if(!best)continue;
  labels[id]={...best,lines};taken.push(best);
 }
 return labels;
}
