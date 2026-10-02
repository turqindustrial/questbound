import {iconPaths} from './iconPaths';
import {seededRandom} from './mapRules';
// A region as a drawn map: aged paper, ink paths that wander between places, and country drawn to suit the land.
// Every region has a terrain (plains, forest, hills, mountains, coast, marsh, desert, snow, caverns) that sets the
// paper, what grows and stands in the open country, and the great features: a sea along one edge, a river wandering
// across, mountain ranges, woods, pools, cavern walls. Where those lie is drawn from the region's own seed, so no
// two maps look alike and the same region always draws the same way. Returned as SVG markup for the web; taps are
// handled by the screen that shows it.
const ink='#3b2a17',red='#8f2c1c',sea='#7fa3a8';
const n=v=>Math.round(v*10)/10;
const esc=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Small ink drawings, each centred on (x, y) with its foot on the ground line. p is the paper colour.
const glyphs={
 tree:(x,y,s=1)=>`<path d="M${n(x)} ${n(y-11*s)}l${n(4.6*s)} ${n(8*s)}h${n(-9.2*s)}z" fill="rgba(59,42,23,.32)"/><path d="M${n(x)} ${n(y-3*s)}v${n(3.4*s)}"/>`,
 round:(x,y,s=1)=>`<path d="M${n(x-4.6*s)} ${n(y-4*s)}a${n(4.6*s)} ${n(4.8*s)} 0 1 1 ${n(9.2*s)} 0a${n(4.6*s)} ${n(3*s)} 0 0 1 ${n(-9.2*s)} 0z" fill="rgba(59,42,23,.2)"/><path d="M${n(x)} ${n(y-2.6*s)}v${n(3*s)}"/>`,
 peak:(x,y,s=1,p)=>`<path d="M${n(x-10*s)} ${n(y)}l${n(7.5*s)} ${n(-14*s)}l${n(3.6*s)} ${n(6*s)}l${n(2.6*s)} ${n(-3.6*s)}l${n(6.3*s)} ${n(11.6*s)}" fill="${p}"/><path d="M${n(x-2.5*s)} ${n(y-14*s)}l${n(1.6*s)} ${n(5.2*s)}l${n(-2.4*s)} ${n(3.4*s)}M${n(x+3.7*s)} ${n(y-11.6*s)}l${n(.8*s)} ${n(4*s)}" stroke-width=".9"/>`,
 snowpeak:(x,y,s=1)=>`<path d="M${n(x-10*s)} ${n(y)}l${n(7.5*s)} ${n(-14*s)}l${n(3.6*s)} ${n(6*s)}l${n(2.6*s)} ${n(-3.6*s)}l${n(6.3*s)} ${n(11.6*s)}" fill="#f7f5ee"/><path d="M${n(x-5.2*s)} ${n(y-9*s)}l${n(2*s)} ${n(1.6*s)}l${n(1.4*s)} ${n(-1.8*s)}l${n(1.6*s)} ${n(2.2*s)}l${n(1.6*s)} ${n(-1.2*s)}" stroke-width=".8"/>`,
 hill:(x,y,s=1)=>`<path d="M${n(x-8*s)} ${n(y)}q${n(8*s)} ${n(-9.5*s)} ${n(16*s)} 0"/><path d="M${n(x+1.5*s)} ${n(y-3.6*s)}l${n(2.4*s)} ${n(2.4*s)}" stroke-width=".8"/>`,
 grass:(x,y,s=1)=>`<path d="M${n(x-3*s)} ${n(y)}l${n(-1.2*s)} ${n(-4*s)}M${n(x)} ${n(y)}v${n(-5*s)}M${n(x+3*s)} ${n(y)}l${n(1.2*s)} ${n(-4*s)}" stroke-width=".9"/>`,
 wave:(x,y,s=1)=>`<path d="M${n(x-9*s)} ${n(y)}q${n(2.25*s)} ${n(-3*s)} ${n(4.5*s)} 0t${n(4.5*s)} 0t${n(4.5*s)} 0t${n(4.5*s)} 0" stroke="#4d7480" stroke-width="1.1"/>`,
 house:(x,y,s=1,p)=>`<path d="M${n(x-4.5*s)} ${n(y)}v${n(-5*s)}l${n(4.5*s)} ${n(-4*s)}l${n(4.5*s)} ${n(4*s)}v${n(5*s)}z" fill="${p}"/><path d="M${n(x-1*s)} ${n(y)}v${n(-3*s)}h${n(2*s)}v${n(3*s)}" stroke-width=".8"/>`,
 tent:(x,y,s=1,p)=>`<path d="M${n(x-6*s)} ${n(y)}l${n(6*s)} ${n(-9.5*s)}l${n(6*s)} ${n(9.5*s)}z" fill="${p}"/><path d="M${n(x)} ${n(y-9.5*s)}v${n(9.5*s)}" stroke-width=".8"/>`,
 column:(x,y,s=1)=>`<path d="M${n(x-4*s)} ${n(y)}v${n(-9*s)}M${n(x-6*s)} ${n(y-9*s)}h${n(4*s)}M${n(x+3*s)} ${n(y)}v${n(-5.5*s)}l${n(1.6*s)} ${n(-1.4*s)}M${n(x-7*s)} ${n(y)}h${n(13*s)}"/>`,
 stone:(x,y,s=1)=>`<path d="M${n(x-2.2*s)} ${n(y)}v${n(-7*s)}q${n(2.2*s)} ${n(-2.6*s)} ${n(4.4*s)} 0v${n(7*s)}z" fill="rgba(59,42,23,.16)"/>`,
 rock:(x,y,s=1,p)=>`<path d="M${n(x-10*s)} ${n(y)}q${n(3*s)} ${n(-12*s)} ${n(10*s)} ${n(-12*s)}q${n(7*s)} 0 ${n(10*s)} ${n(12*s)}z" fill="${p}"/><path d="M${n(x-3.4*s)} ${n(y)}q${n(3.4*s)} ${n(-8*s)} ${n(6.8*s)} 0z" fill="${ink}"/>`,
 rockpile:(x,y,s=1)=>`<path d="M${n(x-7*s)} ${n(y)}q${n(1*s)} ${n(-5*s)} ${n(5*s)} ${n(-5*s)}q${n(2*s)} ${n(-3*s)} ${n(5*s)} 0q${n(4*s)} 0 ${n(4*s)} ${n(5*s)}z" fill="rgba(59,42,23,.14)"/>`,
 dune:(x,y,s=1)=>`<path d="M${n(x-10*s)} ${n(y)}q${n(5*s)} ${n(-7*s)} ${n(10*s)} ${n(-1.5*s)}q${n(4.5*s)} ${n(-5*s)} ${n(10*s)} ${n(1.5*s)}"/><path d="M${n(x-3*s)} ${n(y+2.4*s)}h.2M${n(x+2*s)} ${n(y+3.2*s)}h.2M${n(x+6*s)} ${n(y+2*s)}h.2" stroke-width="1.3"/>`,
 cactus:(x,y,s=1)=>`<path d="M${n(x)} ${n(y)}v${n(-10*s)}M${n(x)} ${n(y-4*s)}h${n(-3*s)}v${n(-3*s)}M${n(x)} ${n(y-6*s)}h${n(3*s)}v${n(-2.6*s)}" stroke-width="1.5"/>`,
 reed:(x,y,s=1)=>`<path d="M${n(x-2.6*s)} ${n(y)}v${n(-6*s)}M${n(x)} ${n(y)}v${n(-8.5*s)}M${n(x+2.6*s)} ${n(y)}v${n(-5.4*s)}" stroke-width=".8"/><path d="M${n(x-2.6*s)} ${n(y-6*s)}v${n(-2*s)}M${n(x)} ${n(y-8.5*s)}v${n(-2.2*s)}M${n(x+2.6*s)} ${n(y-5.4*s)}v${n(-1.8*s)}" stroke-width="1.9"/>`,
 pool:(x,y,s=1)=>`<ellipse cx="${n(x)}" cy="${n(y-3*s)}" rx="${n(9*s)}" ry="${n(3.8*s)}" fill="rgba(93,134,148,.45)" stroke="#4d7480" stroke-width=".8"/>`,
 pine:(x,y,s=1)=>`<path d="M${n(x)} ${n(y-13*s)}l${n(3.6*s)} ${n(5.4*s)}h${n(-2*s)}l${n(3.6*s)} ${n(5*s)}h${n(-10.4*s)}l${n(3.6*s)} ${n(-5*s)}h${n(-2*s)}z" fill="#f4f1e8"/><path d="M${n(x)} ${n(y-2.6*s)}v${n(3*s)}"/>`,
 drift:(x,y,s=1)=>`<path d="M${n(x-8*s)} ${n(y)}q${n(4*s)} ${n(-4.4*s)} ${n(8*s)} 0t${n(8*s)} 0" stroke="#7d8a94" stroke-width=".9"/>`,
 stalag:(x,y,s=1)=>`<path d="M${n(x-3.4*s)} ${n(y)}l${n(3.4*s)} ${n(-11*s)}l${n(3.4*s)} ${n(11*s)}z" fill="rgba(59,42,23,.3)"/>`,
 crystal:(x,y,s=1)=>`<path d="M${n(x)} ${n(y)}l${n(-3*s)} ${n(-5*s)}l${n(3*s)} ${n(-6.5*s)}l${n(3*s)} ${n(6.5*s)}z" fill="rgba(140,190,200,.6)"/><path d="M${n(x)} ${n(y-11.5*s)}v${n(11.5*s)}" stroke-width=".7"/>`,
};
// What surrounds a place of each kind: [drawing, how many].
const scenery={forest:[['tree',5],['round',2]],wilds:[['hill',2],['grass',3]],mountain:[['peak',3]],water:[['wave',4]],ruin:[['column',2],['grass',1]],cave:[['rock',1],['hill',1]],lair:[['rock',1],['stone',1]],
 settlement:[['house',3]],camp:[['tent',2]],shrine:[['stone',3]],landmark:[['stone',1],['hill',1]],road:[['grass',2]],start:[['house',2],['round',1]],danger:[['hill',1],['grass',2]],high:[['peak',1],['column',1]]};
// Each terrain: paper (centre, middle, edge), what is scattered over open country, and its great features.
export const mapThemes={
 plains:{paper:['#eddcb4','#dcc694','#b59662'],wild:['grass','hill','grass','round','tree','grass'],woods:1,river:.75},
 forest:{paper:['#e7deb0','#d3c78e','#a2955c'],wild:['tree','round','tree','tree','grass','round'],woods:4,river:.6,dense:1.2},
 hills:{paper:['#ecdcb6','#d9c493','#b0925f'],wild:['hill','hill','grass','rockpile','round','hill'],woods:1,river:.5},
 mountains:{paper:['#e9ddc4','#d3c4a2','#a08b6b'],wild:['peak','hill','peak','tree','rockpile','peak'],ranges:2,river:.4},
 coast:{paper:['#eee0bc','#ddcc9e','#b39a68'],wild:['grass','hill','round','dune','grass','tree'],sea:true,woods:1},
 marsh:{paper:['#e3ddb2','#ccc892','#96955c'],wild:['reed','reed','grass','pool','reed','round'],pools:6,river:.8},
 desert:{paper:['#f2e0ae','#e4c986','#be9450'],wild:['dune','dune','rockpile','cactus','dune','dune'],dense:.85},
 snow:{paper:['#f1ede2','#dfdcd2','#a9adab'],wild:['pine','drift','pine','snowpeak','drift','hill'],ranges:1,pools:1,frozen:true},
 caverns:{paper:['#d9cfb8','#b9ab8e','#6d604e'],wild:['stalag','rockpile','stalag','crystal','rock','stalag'],walls:true,pools:2},
};
const compass=(x,y,paper)=>`<g transform="translate(${n(x)} ${n(y)})"><circle r="13" fill="${paper}" fill-opacity=".6" stroke="${ink}" stroke-width=".8"/><path d="M0 -16L3 -3L16 0L3 3L0 16L-3 3L-16 0L-3 -3Z" fill="${ink}" opacity=".85"/><path d="M0 -16L3 -3L0 0Z" fill="${red}"/><circle r="1.6" fill="${paper}"/><text y="-19" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" font-weight="700" fill="${ink}">N</text></g>`;
// Where the name of each road out of the region is written: beside the point where the road meets the edge.
export function exitLabelBoxes(exits,exitNames,w,h){
 return exits.map(e=>{const text='to '+(exitNames[e.to]??'another land'),tw=text.length*5.3+8,right=e.x>w/2,low=e.y>h/2;return {...e,text,tw,lx:Math.max(8,Math.min(w-8-tw,right?e.x-tw-4:e.x+4)),ly:Math.max(12,Math.min(h-22,low?e.y-22:e.y+8))};});
}
// A smooth line through points (quadratic curves through the midpoints).
const through=points=>points.length<2?'':'M'+n(points[0].x)+' '+n(points[0].y)+points.slice(1,-1).map((p,i)=>{const q=points[i+2];return 'Q'+n(p.x)+' '+n(p.y)+' '+n((p.x+q.x)/2)+' '+n((p.y+q.y)/2);}).join('')+'L'+n(points.at(-1).x)+' '+n(points.at(-1).y);
export function regionMapSvg({w,h,seed,terrain='plains',ids,at,links,exits=[],exitNames={},labels,kinds,icons,here,visited=new Set(),selected=null,lairs=new Set(),cleared=new Set(),distances={},title='',avoid=[]}){
 const theme=mapThemes[terrain]??mapThemes.plains,[p0,p1,p2]=theme.paper,paper=p0;
 const random=seededRandom('region:'+seed+':'+terrain),land=seededRandom('land:'+seed+':'+terrain),parts=[];
 // Paper: warm in the middle, burnt at the edges, with stains and a grain.
 parts.push(`<defs><radialGradient id="qm-paper" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="${p0}"/><stop offset=".62" stop-color="${p1}"/><stop offset="1" stop-color="${p2}"/></radialGradient><radialGradient id="qm-stain" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(120,84,40,.2)"/><stop offset="1" stop-color="rgba(120,84,40,0)"/></radialGradient><radialGradient id="qm-water" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(93,134,148,.42)"/><stop offset="1" stop-color="rgba(93,134,148,0)"/></radialGradient><filter id="qm-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .23  0 0 0 0 .16  0 0 0 0 .08  0 0 0 .5 -.12"/></filter></defs>`);
 parts.push(`<rect width="${w}" height="${h}" fill="url(#qm-paper)"/>`);
 for(let i=0;i<4;i++){const rx=50+random()*90,ry=34+random()*60;parts.push(`<ellipse cx="${n(random()*w)}" cy="${n(random()*h)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#qm-stain)"/>`);}
 parts.push(`<rect width="${w}" height="${h}" filter="url(#qm-grain)" opacity=".55"/>`);
 // Keep-clear areas: markers, names, the compass, the title and the roads out.
 const exitLabels=exitLabelBoxes(exits,exitNames,w,h);
 const blocked=[...ids.map(id=>({x:at[id].x-21,y:at[id].y-21,w:42,h:42})),...Object.values(labels).map(l=>({x:l.x-3,y:l.y-3,w:l.w+6,h:l.h+6})),{x:w-62,y:0,w:62,h:66},...avoid,...(title?[{x:8,y:h-30,w:title.length*8.2+14,h:24}]:[]),...exitLabels.map(e=>({x:e.lx-2,y:e.ly-2,w:e.tw+4,h:16}))];
 const hits=(x,y,rw,rh)=>blocked.some(b=>x+rw>b.x&&x-rw<b.x+b.w&&y+rh>b.y&&y-rh<b.y+b.h);
 const free=(x,y,r=9)=>x>12&&x<w-12&&y>16&&y<h-10&&!hits(x,y,r,r);
 const clearance=(x,y)=>Math.min(...ids.map(id=>Math.hypot(at[id].x-x,at[id].y-y)),9999);
 // ---- The great features, under everything else ----
 const under=[];
 // The sea lies along the edge the places keep furthest from, behind a ragged coastline.
 if(theme.sea&&ids.length){
  const margins={N:Math.min(...ids.map(id=>at[id].y)),S:h-Math.max(...ids.map(id=>at[id].y)),W:Math.min(...ids.map(id=>at[id].x)),E:w-Math.max(...ids.map(id=>at[id].x))};
  const side=Object.keys(margins).sort((a,b)=>margins[b]-margins[a]||(land()<.5?-1:1))[0],across=side==='N'||side==='S',span=across?w:h,room=across?h:w;
  const depth=Math.max(16,Math.min(room*.24,margins[side]-36)),points=[];
  for(let i=0,steps=Math.ceil(span/26);i<=steps;i++){const along=i/steps*span,d=depth*(.72+land()*.5)+Math.sin(i*.9+land()*2)*5;points.push(side==='N'?{x:along,y:d}:side==='S'?{x:along,y:h-d}:side==='W'?{x:d,y:along}:{x:w-d,y:along});}
  const close=side==='N'?`L${w} 0L0 0Z`:side==='S'?`L${w} ${h}L0 ${h}Z`:side==='W'?`L0 ${h}L0 0Z`:`L${w} ${h}L${w} 0Z`,shore=through(points);
  under.push(`<path d="${shore}${close}" fill="${sea}" opacity=".5"/><path d="${shore}" fill="none" stroke="${ink}" stroke-width="1.3" opacity=".7"/>`);
  // Lines of surf follow the shore out to sea.
  for(const [off,op] of [[7,.5],[14,.3]]){const moved=points.map(p=>side==='N'?{x:p.x,y:p.y-off}:side==='S'?{x:p.x,y:p.y+off}:side==='W'?{x:p.x-off,y:p.y}:{x:p.x+off,y:p.y});under.push(`<path d="${through(moved)}" fill="none" stroke="#f3ead0" stroke-width="1" opacity="${op}"/>`);}
  blocked.push(side==='N'?{x:0,y:0,w,h:depth*1.25}:side==='S'?{x:0,y:h-depth*1.25,w,h:depth*1.25}:side==='W'?{x:0,y:0,w:depth*1.25,h}:{x:w-depth*1.25,y:0,w:depth*1.25,h});
 }
 // A river wanders from one edge to another, keeping as clear of the places as it can.
 if(theme.river&&land()<theme.river){
  let best=null;
  for(let c=0;c<7;c++){
   const upright=land()<.5,a=upright?{x:w*(.15+land()*.7),y:0}:{x:0,y:h*(.15+land()*.7)},b=upright?{x:w*(.15+land()*.7),y:h}:{x:w,y:h*(.15+land()*.7)},points=[a];
   for(let i=1;i<6;i++){const t=i/6,sway=(land()-.5)*(upright?w:h)*.22;points.push(upright?{x:a.x+(b.x-a.x)*t+sway,y:h*t}:{x:w*t,y:a.y+(b.y-a.y)*t+sway});}
   points.push(b);
   const score=Math.min(...points.map(p=>clearance(p.x,p.y)),...points.slice(1).map((p,i)=>clearance((p.x+points[i].x)/2,(p.y+points[i].y)/2)));
   if(!best||score>best.score)best={points,score};
  }
  if(best.score>26){const d=through(best.points);under.push(`<path d="${d}" fill="none" stroke="${ink}" stroke-width="6.4" stroke-linecap="round" opacity=".5"/><path d="${d}" fill="none" stroke="${theme.frozen?'#dfe9ec':'#9dbcbb'}" stroke-width="4.6" stroke-linecap="round"/>`);
   for(let i=1;i<best.points.length;i++)for(const t of [0,.33,.66]){const p=best.points[i-1],q=best.points[i];blocked.push({x:p.x+(q.x-p.x)*t-9,y:p.y+(q.y-p.y)*t-9,w:18,h:18});}}
 }
 // Cavern walls close in around the sheet.
 if(theme.walls){
  const teeth=[];for(let x=0;x<=w;x+=22){teeth.push(`M${n(x-13)} 0L${n(x)} ${n(10+land()*16)}L${n(x+13)} 0Z`);teeth.push(`M${n(x-13)} ${h}L${n(x)} ${n(h-10-land()*16)}L${n(x+13)} ${h}Z`);}
  for(let y=0;y<=h;y+=22){teeth.push(`M0 ${n(y-13)}L${n(9+land()*14)} ${n(y)}L0 ${n(y+13)}Z`);teeth.push(`M${w} ${n(y-13)}L${n(w-9-land()*14)} ${n(y)}L${w} ${n(y+13)}Z`);}
  under.push(`<path d="${teeth.join('')}" fill="#3b2f24" opacity=".55"/>`);
 }
 parts.push(...under);
 // Paths wander a little, as drawn by hand; each remembers its middle for the distance written beside it.
 const curves=links.map(([a,b])=>{const p=at[a],q=at[b],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1,bend=(random()<.5?-1:1)*len*(.07+random()*.08),cx=(p.x+q.x)/2-dy/len*bend,cy=(p.y+q.y)/2+dx/len*bend;
  return {a,b,p,q,cx,cy,len,mx:.25*p.x+.5*cx+.25*q.x,my:.25*p.y+.5*cy+.25*q.y};});
 // A distance is written beside its path only where it covers no marker, name or other distance.
 const written=[];
 for(const c of curves){const text=distances[c.a+'-'+c.b];if(!text||c.len<74)continue;const half=text.length*2.9+3;if(hits(c.mx,c.my,half,7))continue;written.push([c,text]);blocked.push({x:c.mx-half,y:c.my-7,w:half*2,h:14});}
 for(const c of curves)for(const t of [.2,.35,.5,.65,.8]){const u=1-t;blocked.push({x:u*u*c.p.x+2*u*t*c.cx+t*t*c.q.x-7,y:u*u*c.p.y+2*u*t*c.cy+t*t*c.q.y-7,w:14,h:14});}
 for(const e of exits)for(const t of [.25,.5,.75]){const p=at[e.from];blocked.push({x:p.x+(e.x-p.x)*t-7,y:p.y+(e.y-p.y)*t-7,w:14,h:14});}
 // Water lies under everything near a watery place.
 for(const id of ids)if(kinds[id]==='water')parts.push(`<ellipse cx="${n(at[id].x)}" cy="${n(at[id].y+4)}" rx="46" ry="30" fill="url(#qm-water)"/>`);
 // Scenery: around each place by its kind, then the land's own features, then a scattering across open country.
 const drawn=[];
 const place=(kind,x,y,s)=>{if(!glyphs[kind]||!free(x,y-4,8*s))return false;drawn.push([y,glyphs[kind](x,y,s,paper)]);blocked.push({x:x-8*s,y:y-12*s,w:16*s,h:14*s});return true;};
 for(const id of ids){
  const local=seededRandom('place:'+seed+':'+id),p=at[id];
  for(const [kind,count] of scenery[kinds[id]]??scenery.wilds){let made=0;for(let tries=0;tries<count*7&&made<count;tries++){const angle=local()*Math.PI*2,radius=27+local()*26;if(place(kind,p.x+Math.cos(angle)*radius,p.y+Math.sin(angle)*radius*.8+6,.85+local()*.3))made++;}}
 }
 // Mountain ranges: lines of tall peaks across the open country.
 for(let r=0;r<(theme.ranges??0);r++){
  const a={x:w*(.1+land()*.8),y:h*(.12+land()*.76)},angle=land()*Math.PI,length=Math.min(w,h)*(.45+land()*.4),peak=theme.frozen?'snowpeak':'peak';
  for(let d=-length/2;d<=length/2;d+=17){const wob=(land()-.5)*14;place(peak,a.x+Math.cos(angle)*d-Math.sin(angle)*wob,a.y+Math.sin(angle)*d+Math.cos(angle)*wob,1.15+land()*.5);}
 }
 // Woods: trees gathered into stands.
 for(let c=0;c<(theme.woods??0);c++){
  const cx=w*(.1+land()*.8),cy=h*(.14+land()*.74),spread=26+land()*30,count=9+Math.floor(land()*8);
  for(let i=0;i<count;i++){const angle=land()*Math.PI*2,radius=Math.sqrt(land())*spread;place(land()<.7?'tree':'round',cx+Math.cos(angle)*radius*1.3,cy+Math.sin(angle)*radius*.8,.75+land()*.3);}
 }
 // Pools and meres.
 for(let c=0;c<(theme.pools??0);c++){const x=w*(.1+land()*.8),y=h*(.14+land()*.74),s=theme.frozen?1.8+land():.9+land()*.9;if(place('pool',x,y,s)&&!theme.frozen&&!theme.walls){place('reed',x-11*s,y+2,.9);place('reed',x+12*s,y-1,.8);}}
 const wild=theme.wild,target=Math.round(w*h/5200*(theme.dense??1));
 for(let i=0,made=0;i<160&&made<target;i++){if(place(wild[Math.floor(random()*wild.length)],14+random()*(w-28),20+random()*(h-34),.7+random()*.3))made++;}
 parts.push(`<g fill="none" stroke="${ink}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" opacity=".62">${drawn.sort((a,b)=>a[0]-b[0]).map(d=>d[1]).join('')}</g>`);
 // Paths, then the distances written along them where there is room.
 parts.push(`<g fill="none" stroke="${ink}" stroke-linecap="round">${curves.map(c=>`<path d="M${n(c.p.x)} ${n(c.p.y)}Q${n(c.cx)} ${n(c.cy)} ${n(c.q.x)} ${n(c.q.y)}" stroke-width="${visited.has(c.a)&&visited.has(c.b)?1.9:1.4}" stroke-dasharray="${visited.has(c.a)&&visited.has(c.b)?'5 4':'2 5'}" opacity="${visited.has(c.a)&&visited.has(c.b)?.82:.5}"/>`).join('')}</g>`);
 // Roads out of the region run to the edge of the sheet, with an arrowhead and where they lead.
 if(exitLabels.length){
  parts.push(`<g fill="none" stroke="${ink}" stroke-linecap="round" stroke-width="1.6" stroke-dasharray="7 4" opacity=".75">${exitLabels.map(e=>`<path d="M${n(at[e.from].x)} ${n(at[e.from].y)}L${n(e.x)} ${n(e.y)}"/>`).join('')}</g>`);
  parts.push(`<g fill="${ink}" opacity=".85">${exitLabels.map(e=>{const p=at[e.from],angle=Math.atan2(e.y-p.y,e.x-p.x)*180/Math.PI;return `<path transform="translate(${n(e.x)} ${n(e.y)}) rotate(${n(angle)})" d="M2 0L-7 -4.6L-4.6 0L-7 4.6Z"/>`;}).join('')}</g>`);
  parts.push(`<g font-family="'EB Garamond', Georgia, serif" font-style="italic" font-size="11.5" font-weight="600" fill="${ink}" stroke="${paper}" stroke-width="2.8" paint-order="stroke" stroke-linejoin="round">${exitLabels.map(e=>`<text x="${n(e.lx+4)}" y="${n(e.ly+11)}">${esc(e.text)}</text>`).join('')}</g>`);
 }
 parts.push(`<g font-family="'EB Garamond', Georgia, serif" font-style="italic" font-size="10.5" fill="${ink}" stroke="${paper}" stroke-width="2.6" paint-order="stroke" text-anchor="middle" opacity=".9">${written.map(([c,text])=>`<text x="${n(c.mx)}" y="${n(c.my+3.5)}">${esc(text)}</text>`).join('')}</g>`);
 // Markers: a place you stand in is red; one you have not seen yet is drawn dashed.
 for(const id of ids){
  const p=at[id],isHere=id===here,seen=visited.has(id)||isHere,icon=iconPaths[icons[id]]??iconPaths.compass,color=isHere?'#f8e9c4':ink;
  parts.push(`<g transform="translate(${n(p.x)} ${n(p.y)})">${id===selected?`<circle r="19.5" fill="none" stroke="${ink}" stroke-width="1.3" stroke-dasharray="3 3"/>`:''}${isHere?`<circle r="18.5" fill="none" stroke="${red}" stroke-width="1" opacity=".6"/>`:''}<circle r="14.5" fill="${isHere?red:seen?'#f1e4bf':'#dfcd9f'}" stroke="${isHere?'#4a160c':ink}" stroke-width="1.5"${seen?'':' stroke-dasharray="3 2.6"'}/><g transform="translate(-8.4 -8.4) scale(.7)" fill="none" stroke="${color}" style="color:${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" opacity="${seen?1:.6}">${icon.svg}</g>${lairs.has(id)?`<circle cx="11" cy="-11" r="4.6" fill="${red}" stroke="${paper}" stroke-width="1.4"/>`:cleared.has(id)?`<circle cx="11" cy="-11" r="4.6" fill="#4f7d5a" stroke="${paper}" stroke-width="1.4"/>`:''}</g>`);
 }
 // Names, in a mapmaker's italic hand with the paper showing around the letters.
 parts.push(`<g font-family="'EB Garamond', Georgia, serif" font-style="italic" font-weight="600" font-size="13.5" stroke="${paper}" stroke-width="3.2" paint-order="stroke" stroke-linejoin="round">${Object.entries(labels).map(([id,l])=>{const x=l.align==='center'?l.x+l.w/2:l.align==='left'?l.x+2:l.x+l.w-2,anchor=l.align==='center'?'middle':l.align==='left'?'start':'end';
  return `<text x="${n(x)}" y="${n(l.y+11.5)}" text-anchor="${anchor}" fill="${id===here?red:ink}"${id===here?' font-weight="700"':''}>${l.lines.map((line,i)=>`<tspan x="${n(x)}" dy="${i?15:0}">${esc(line)}</tspan>`).join('')}</text>`;}).join('')}</g>`);
 parts.push(compass(w-32,36,paper));
 if(title)parts.push(`<text x="14" y="${h-14}" font-family="Cinzel, Georgia, serif" font-size="9.5" font-weight="700" letter-spacing="1.6" fill="${ink}" stroke="${paper}" stroke-width="2.4" paint-order="stroke" opacity=".8">${esc(title.toUpperCase())}</text>`);
 // A ruled border, as on a printed sheet.
 parts.push(`<rect x="4.5" y="4.5" width="${w-9}" height="${h-9}" fill="none" stroke="${ink}" stroke-width="1.3" opacity=".7"/><rect x="8" y="8" width="${w-16}" height="${h-16}" fill="none" stroke="${ink}" stroke-width=".5" opacity=".55"/>`);
 return parts.join('');
}
