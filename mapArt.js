import {iconPaths} from './iconPaths';
import {seededRandom} from './mapLayout';
// The region as a drawn map: aged paper, ink paths that wander between places, little hills, trees, peaks and
// water around each place according to its kind, a compass rose and the names. Returned as SVG markup for the web;
// taps are handled by the screen that shows it.
const ink='#3b2a17',paper='#e6d5ab',red='#8f2c1c';
const n=v=>Math.round(v*10)/10;
const esc=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Small ink drawings, each centred on (x, y) with its foot on the ground line.
const glyphs={
 tree:(x,y,s=1)=>`<path d="M${n(x)} ${n(y-11*s)}l${n(4.6*s)} ${n(8*s)}h${n(-9.2*s)}z" fill="rgba(59,42,23,.32)"/><path d="M${n(x)} ${n(y-3*s)}v${n(3.4*s)}"/>`,
 round:(x,y,s=1)=>`<path d="M${n(x-4.6*s)} ${n(y-4*s)}a${n(4.6*s)} ${n(4.8*s)} 0 1 1 ${n(9.2*s)} 0a${n(4.6*s)} ${n(3*s)} 0 0 1 ${n(-9.2*s)} 0z" fill="rgba(59,42,23,.2)"/><path d="M${n(x)} ${n(y-2.6*s)}v${n(3*s)}"/>`,
 peak:(x,y,s=1)=>`<path d="M${n(x-10*s)} ${n(y)}l${n(7.5*s)} ${n(-14*s)}l${n(3.6*s)} ${n(6*s)}l${n(2.6*s)} ${n(-3.6*s)}l${n(6.3*s)} ${n(11.6*s)}" fill="rgba(230,213,171,.85)"/><path d="M${n(x-2.5*s)} ${n(y-14*s)}l${n(1.6*s)} ${n(5.2*s)}l${n(-2.4*s)} ${n(3.4*s)}M${n(x+3.7*s)} ${n(y-11.6*s)}l${n(.8*s)} ${n(4*s)}" stroke-width=".9"/>`,
 hill:(x,y,s=1)=>`<path d="M${n(x-8*s)} ${n(y)}q${n(8*s)} ${n(-9.5*s)} ${n(16*s)} 0"/><path d="M${n(x+1.5*s)} ${n(y-3.6*s)}l${n(2.4*s)} ${n(2.4*s)}" stroke-width=".8"/>`,
 grass:(x,y,s=1)=>`<path d="M${n(x-3*s)} ${n(y)}l${n(-1.2*s)} ${n(-4*s)}M${n(x)} ${n(y)}v${n(-5*s)}M${n(x+3*s)} ${n(y)}l${n(1.2*s)} ${n(-4*s)}" stroke-width=".9"/>`,
 wave:(x,y,s=1)=>`<path d="M${n(x-9*s)} ${n(y)}q${n(2.25*s)} ${n(-3*s)} ${n(4.5*s)} 0t${n(4.5*s)} 0t${n(4.5*s)} 0t${n(4.5*s)} 0" stroke="#4d7480" stroke-width="1.1"/>`,
 house:(x,y,s=1)=>`<path d="M${n(x-4.5*s)} ${n(y)}v${n(-5*s)}l${n(4.5*s)} ${n(-4*s)}l${n(4.5*s)} ${n(4*s)}v${n(5*s)}z" fill="rgba(230,213,171,.9)"/><path d="M${n(x-1*s)} ${n(y)}v${n(-3*s)}h${n(2*s)}v${n(3*s)}" stroke-width=".8"/>`,
 tent:(x,y,s=1)=>`<path d="M${n(x-6*s)} ${n(y)}l${n(6*s)} ${n(-9.5*s)}l${n(6*s)} ${n(9.5*s)}z" fill="rgba(230,213,171,.9)"/><path d="M${n(x)} ${n(y-9.5*s)}v${n(9.5*s)}" stroke-width=".8"/>`,
 column:(x,y,s=1)=>`<path d="M${n(x-4*s)} ${n(y)}v${n(-9*s)}M${n(x-6*s)} ${n(y-9*s)}h${n(4*s)}M${n(x+3*s)} ${n(y)}v${n(-5.5*s)}l${n(1.6*s)} ${n(-1.4*s)}M${n(x-7*s)} ${n(y)}h${n(13*s)}"/>`,
 stone:(x,y,s=1)=>`<path d="M${n(x-2.2*s)} ${n(y)}v${n(-7*s)}q${n(2.2*s)} ${n(-2.6*s)} ${n(4.4*s)} 0v${n(7*s)}z" fill="rgba(59,42,23,.16)"/>`,
 rock:(x,y,s=1)=>`<path d="M${n(x-10*s)} ${n(y)}q${n(3*s)} ${n(-12*s)} ${n(10*s)} ${n(-12*s)}q${n(7*s)} 0 ${n(10*s)} ${n(12*s)}z" fill="rgba(230,213,171,.85)"/><path d="M${n(x-3.4*s)} ${n(y)}q${n(3.4*s)} ${n(-8*s)} ${n(6.8*s)} 0z" fill="${ink}"/>`,
};
// What surrounds a place of each kind: [drawing, how many].
const scenery={forest:[['tree',5],['round',2]],wilds:[['hill',2],['grass',3]],mountain:[['peak',3]],water:[['wave',4]],ruin:[['column',2],['grass',1]],cave:[['rock',1],['hill',1]],lair:[['rock',1],['stone',1]],
 settlement:[['house',3]],camp:[['tent',2]],shrine:[['stone',3]],landmark:[['stone',1],['hill',1]],road:[['grass',2]],start:[['house',2],['round',1]],danger:[['hill',1],['grass',2]],high:[['peak',1],['column',1]]};
const compass=(x,y)=>`<g transform="translate(${n(x)} ${n(y)})"><circle r="13" fill="rgba(230,213,171,.6)" stroke="${ink}" stroke-width=".8"/><path d="M0 -16L3 -3L16 0L3 3L0 16L-3 3L-16 0L-3 -3Z" fill="${ink}" opacity=".85"/><path d="M0 -16L3 -3L0 0Z" fill="${red}"/><circle r="1.6" fill="${paper}"/><text y="-19" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" font-weight="700" fill="${ink}">N</text></g>`;
export function regionMapSvg({w,h,seed,ids,at,links,labels,kinds,icons,here,visited=new Set(),selected=null,lairs=new Set(),cleared=new Set(),distances={},title='',avoid=[]}){
 const random=seededRandom('region:'+seed),parts=[];
 // Paper: warm in the middle, burnt at the edges, with stains and a grain.
 parts.push(`<defs><radialGradient id="qm-paper" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#eddcb4"/><stop offset=".62" stop-color="#dcc694"/><stop offset="1" stop-color="#b59662"/></radialGradient><radialGradient id="qm-stain" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(120,84,40,.2)"/><stop offset="1" stop-color="rgba(120,84,40,0)"/></radialGradient><radialGradient id="qm-water" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(93,134,148,.42)"/><stop offset="1" stop-color="rgba(93,134,148,0)"/></radialGradient><filter id="qm-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .23  0 0 0 0 .16  0 0 0 0 .08  0 0 0 .5 -.12"/></filter></defs>`);
 parts.push(`<rect width="${w}" height="${h}" fill="url(#qm-paper)"/>`);
 for(let i=0;i<4;i++){const rx=50+random()*90,ry=34+random()*60;parts.push(`<ellipse cx="${n(random()*w)}" cy="${n(random()*h)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#qm-stain)"/>`);}
 parts.push(`<rect width="${w}" height="${h}" filter="url(#qm-grain)" opacity=".55"/>`);
 // Keep-clear areas: markers, names and the compass.
 const blocked=[...ids.map(id=>({x:at[id].x-21,y:at[id].y-21,w:42,h:42})),...Object.values(labels).map(l=>({x:l.x-3,y:l.y-3,w:l.w+6,h:l.h+6})),{x:w-62,y:0,w:62,h:66},...avoid,...(title?[{x:8,y:h-30,w:title.length*8.2+14,h:24}]:[])];
 const hits=(x,y,rw,rh)=>blocked.some(b=>x+rw>b.x&&x-rw<b.x+b.w&&y+rh>b.y&&y-rh<b.y+b.h);
 const free=(x,y,r=9)=>x>12&&x<w-12&&y>16&&y<h-10&&!hits(x,y,r,r);
 // Paths wander a little, as drawn by hand; each remembers its middle for the distance written beside it.
 const curves=links.map(([a,b])=>{const p=at[a],q=at[b],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1,bend=(random()<.5?-1:1)*len*(.07+random()*.08),cx=(p.x+q.x)/2-dy/len*bend,cy=(p.y+q.y)/2+dx/len*bend;
  return {a,b,p,q,cx,cy,len,mx:.25*p.x+.5*cx+.25*q.x,my:.25*p.y+.5*cy+.25*q.y};});
 // A distance is written beside its path only where it covers no marker, name or other distance.
 const written=[];
 for(const c of curves){const text=distances[c.a+'-'+c.b];if(!text||c.len<74)continue;const half=text.length*2.9+3;if(hits(c.mx,c.my,half,7))continue;written.push([c,text]);blocked.push({x:c.mx-half,y:c.my-7,w:half*2,h:14});}
 for(const c of curves)for(const t of [.2,.35,.5,.65,.8]){const u=1-t;blocked.push({x:u*u*c.p.x+2*u*t*c.cx+t*t*c.q.x-7,y:u*u*c.p.y+2*u*t*c.cy+t*t*c.q.y-7,w:14,h:14});}
 // Water lies under everything near a watery place.
 for(const id of ids)if(kinds[id]==='water')parts.push(`<ellipse cx="${n(at[id].x)}" cy="${n(at[id].y+4)}" rx="46" ry="30" fill="url(#qm-water)"/>`);
 // Scenery: first around each place by its kind, then a scattering across the empty country.
 const drawn=[];
 const place=(kind,x,y,s)=>{if(!free(x,y-4,8*s))return false;drawn.push([y,glyphs[kind](x,y,s)]);blocked.push({x:x-8*s,y:y-12*s,w:16*s,h:14*s});return true;};
 for(const id of ids){
  const local=seededRandom('place:'+seed+':'+id),p=at[id];
  for(const [kind,count] of scenery[kinds[id]]??scenery.wilds){let made=0;for(let tries=0;tries<count*7&&made<count;tries++){const angle=local()*Math.PI*2,radius=27+local()*26;if(place(kind,p.x+Math.cos(angle)*radius,p.y+Math.sin(angle)*radius*.8+6,.85+local()*.3))made++;}}
 }
 const wild=['hill','tree','grass','round','hill','tree'];
 for(let i=0,made=0;i<140&&made<Math.round(w*h/5200);i++){if(place(wild[Math.floor(random()*wild.length)],14+random()*(w-28),20+random()*(h-34),.7+random()*.3))made++;}
 parts.push(`<g fill="none" stroke="${ink}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" opacity=".62">${drawn.sort((a,b)=>a[0]-b[0]).map(d=>d[1]).join('')}</g>`);
 // Paths, then the distances written along them where there is room.
 parts.push(`<g fill="none" stroke="${ink}" stroke-linecap="round">${curves.map(c=>`<path d="M${n(c.p.x)} ${n(c.p.y)}Q${n(c.cx)} ${n(c.cy)} ${n(c.q.x)} ${n(c.q.y)}" stroke-width="${visited.has(c.a)&&visited.has(c.b)?1.9:1.4}" stroke-dasharray="${visited.has(c.a)&&visited.has(c.b)?'5 4':'2 5'}" opacity="${visited.has(c.a)&&visited.has(c.b)?.82:.5}"/>`).join('')}</g>`);
 parts.push(`<g font-family="'EB Garamond', Georgia, serif" font-style="italic" font-size="10.5" fill="${ink}" stroke="${paper}" stroke-width="2.6" paint-order="stroke" text-anchor="middle" opacity=".9">${written.map(([c,text])=>`<text x="${n(c.mx)}" y="${n(c.my+3.5)}">${esc(text)}</text>`).join('')}</g>`);
 // Markers: a place you stand in is red; one you have not seen yet is drawn dashed.
 for(const id of ids){
  const p=at[id],isHere=id===here,seen=visited.has(id)||isHere,icon=iconPaths[icons[id]]??iconPaths.compass,color=isHere?'#f8e9c4':ink;
  parts.push(`<g transform="translate(${n(p.x)} ${n(p.y)})">${id===selected?`<circle r="19.5" fill="none" stroke="${ink}" stroke-width="1.3" stroke-dasharray="3 3"/>`:''}${isHere?`<circle r="18.5" fill="none" stroke="${red}" stroke-width="1" opacity=".6"/>`:''}<circle r="14.5" fill="${isHere?red:seen?'#f1e4bf':'#dfcd9f'}" stroke="${isHere?'#4a160c':ink}" stroke-width="1.5"${seen?'':' stroke-dasharray="3 2.6"'}/><g transform="translate(-8.4 -8.4) scale(.7)" fill="none" stroke="${color}" style="color:${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" opacity="${seen?1:.6}">${icon.svg}</g>${lairs.has(id)?`<circle cx="11" cy="-11" r="4.6" fill="${red}" stroke="${paper}" stroke-width="1.4"/>`:cleared.has(id)?`<circle cx="11" cy="-11" r="4.6" fill="#4f7d5a" stroke="${paper}" stroke-width="1.4"/>`:''}</g>`);
 }
 // Names, in a mapmaker's italic hand with the paper showing around the letters.
 parts.push(`<g font-family="'EB Garamond', Georgia, serif" font-style="italic" font-weight="600" font-size="13.5" stroke="${paper}" stroke-width="3.2" paint-order="stroke" stroke-linejoin="round">${Object.entries(labels).map(([id,l])=>{const x=l.align==='center'?l.x+l.w/2:l.align==='left'?l.x+2:l.x+l.w-2,anchor=l.align==='center'?'middle':l.align==='left'?'start':'end';
  return `<text x="${n(x)}" y="${n(l.y+11.5)}" text-anchor="${anchor}" fill="${id===here?red:ink}"${id===here?' font-weight="700"':''}>${l.lines.map((line,i)=>`<tspan x="${n(x)}" dy="${i?15:0}">${esc(line)}</tspan>`).join('')}</text>`;}).join('')}</g>`);
 parts.push(compass(w-32,36));
 if(title)parts.push(`<text x="14" y="${h-14}" font-family="Cinzel, Georgia, serif" font-size="9.5" font-weight="700" letter-spacing="1.6" fill="${ink}" opacity=".72">${esc(title.toUpperCase())}</text>`);
 // A ruled border, as on a printed sheet.
 parts.push(`<rect x="4.5" y="4.5" width="${w-9}" height="${h-9}" fill="none" stroke="${ink}" stroke-width="1.3" opacity=".7"/><rect x="8" y="8" width="${w-16}" height="${h-16}" fill="none" stroke="${ink}" stroke-width=".5" opacity=".55"/>`);
 return parts.join('');
}
