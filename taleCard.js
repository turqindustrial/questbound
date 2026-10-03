import {wrapWords,taleText} from './taleRules';
import {tint} from './theme';
// Paints the tale card (a 1080×1350 picture of the hero and their story so far) on a canvas, in the player's colours,
// and shares or saves it. Web only: without a document there is no card. The words that go with it are taleText.
// Every colour is written as its Red value inside tint(), like every screen colour; on the web tint() gives a style
// variable, which a canvas cannot use, so the theme's value is read back from the page (resolveColour).
const written={ink:tint('#08060a'),gold:tint('#e04a5c'),goldBright:tint('#eadaff'),goldMid:tint('#b08cf5'),parchment:tint('#f4ecee'),muted:tint('#a99fa7'),line:tint('rgba(178,34,58,.6)'),plum:tint('rgba(48,26,78,.55)'),well:tint('#1b1220'),haze:tint('rgba(140,82,255,.22)'),shade:tint('rgba(8,6,10,.15)'),etch:tint('rgba(255,255,255,.07)')};
export function resolveColour(value,fallback='gray'){
 const m=/^var\((--[a-z0-9-]+)\)$/i.exec(String(value??'').trim());
 if(!m)return value||fallback;
 try{const got=globalThis.getComputedStyle?.(document.documentElement).getPropertyValue(m[1]).trim();return got||fallback;}catch{return fallback;}
}
export function cardPalette(){return Object.fromEntries(Object.entries(written).map(([key,value])=>[key,resolveColour(value)]));}
const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('image'));img.src=src;});
// Draws an image to fill a box, cropping evenly (like object-fit: cover).
function cover(g,img,x,y,w,h){const scale=Math.max(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;g.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
export async function renderTaleCard(summary,{portrait=null,scene=null,palette=cardPalette(),width=1080,height=1350}={}){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const g=canvas.getContext('2d');
 const P=palette,W=width,H=height,cx=W/2;
 try{await Promise.all(['900 44px "Cinzel Decorative"','700 56px Cinzel','italic 400 34px "EB Garamond"','400 26px Inter'].map(f=>document.fonts?.load(f)));}catch{}
 g.fillStyle=P.ink;g.fillRect(0,0,W,H);
 // The scene across the top, fading into the dark; a glow where there is no picture yet.
 if(scene){try{cover(g,await loadImage(scene),0,0,W,560);}catch{scene=null;}}
 const fade=g.createLinearGradient(0,scene?180:0,0,560);fade.addColorStop(0,scene?P.shade:P.plum);fade.addColorStop(1,P.ink);g.fillStyle=fade;g.fillRect(0,0,W,560);
 const glow=g.createRadialGradient(cx,470,10,cx,470,420);glow.addColorStop(0,P.haze);glow.addColorStop(1,'transparent');g.fillStyle=glow;g.fillRect(0,100,W,800);
 // The frame.
 g.strokeStyle=P.line;g.lineWidth=2;g.strokeRect(30,30,W-60,H-60);g.strokeStyle=P.etch;g.lineWidth=1;g.strokeRect(42,42,W-84,H-84);
 // The name of the game sits in a dark band at the top, readable over any scene.
 const band=g.createLinearGradient(0,0,0,240);band.addColorStop(0,P.ink);band.addColorStop(1,'transparent');g.fillStyle=band;g.fillRect(0,0,W,240);
 g.textAlign='center';g.textBaseline='alphabetic';
 try{g.letterSpacing='6px';}catch{}
 g.save();g.shadowColor='rgba(0,0,0,.85)';g.shadowBlur=18;g.shadowOffsetY=2;
 g.fillStyle=P.gold;g.font='900 44px "Cinzel Decorative", Georgia, serif';g.fillText('QUESTBOUND',cx,104);g.restore();
 try{g.letterSpacing='0px';}catch{}
 // The portrait in a medallion.
 const r=118,cy=470;g.save();g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.closePath();g.clip();
 g.fillStyle=P.well;g.fillRect(cx-r,cy-r,r*2,r*2);
 let painted=false;if(portrait){try{cover(g,await loadImage(portrait),cx-r,cy-r,r*2,r*2);painted=true;}catch{}}
 if(!painted){g.fillStyle=P.gold;g.font='700 120px Cinzel, Georgia, serif';g.fillText((summary.name||'Q').trim()[0].toUpperCase(),cx,cy+42);}
 g.restore();
 g.beginPath();g.arc(cx,cy,r+4,0,Math.PI*2);g.strokeStyle=P.gold;g.lineWidth=5;g.stroke();
 g.beginPath();g.arc(cx,cy,r+14,0,Math.PI*2);g.strokeStyle=P.line;g.lineWidth=1.5;g.stroke();
 // Name and standing.
 g.fillStyle=P.parchment;g.font='700 60px Cinzel, Georgia, serif';
 const name=summary.name.length>18?summary.name.slice(0,17).trimEnd()+'…':summary.name;g.fillText(name,cx,672);
 g.fillStyle=P.muted;g.font='500 27px Inter, system-ui, sans-serif';g.fillText(summary.heroLine.toUpperCase().replace(/ · /g,'   ·   '),cx,716);
 // The tale.
 g.fillStyle=P.goldBright;g.font='italic 400 36px "EB Garamond", Georgia, serif';
 const titleLines=wrapWords('“'+summary.title+'”',W-200,t=>g.measureText(t).width).slice(0,2);
 titleLines.forEach((t,i)=>g.fillText(t,cx,784+i*44));
 let y=784+titleLines.length*44;
 if(summary.chapter||summary.dead){g.fillStyle=P.goldMid;g.font='600 22px Cinzel, Georgia, serif';try{g.letterSpacing='4px';}catch{}g.fillText((summary.dead?'HERE LIES '+summary.name.toUpperCase():summary.chapter.toUpperCase()),cx,y+8);try{g.letterSpacing='0px';}catch{}y+=40;}
 // A rule with a lozenge.
 y+=14;g.strokeStyle=P.line;g.lineWidth=1;g.beginPath();g.moveTo(140,y);g.lineTo(cx-18,y);g.moveTo(cx+18,y);g.lineTo(W-140,y);g.stroke();
 g.save();g.translate(cx,y);g.rotate(Math.PI/4);g.fillStyle=P.gold;g.fillRect(-5,-5,10,10);g.restore();y+=46;
 // The story so far, left aligned with marks.
 g.textAlign='left';g.font='400 29px "EB Garamond", Georgia, serif';
 const lines=summary.dead&&summary.cause?[summary.cause,...summary.lines]:summary.lines;
 const room=Math.max(0,Math.floor((H-y-250)/38));let shown=0;
 for(const line of lines.slice(-room)){
  const wrapped=wrapWords(line,W-260,t=>g.measureText(t).width).slice(0,2);
  g.fillStyle=P.gold;g.beginPath();g.arc(118,y-9,4,0,Math.PI*2);g.fill();
  g.fillStyle='#e6dfcd';wrapped.forEach((t,i)=>g.fillText(t,140,y+i*36));y+=36*wrapped.length+6;shown++;
 }
 if(!shown){g.fillStyle=P.muted;g.font='italic 400 29px "EB Garamond", Georgia, serif';g.fillText('The tale has only just begun.',140,y);y+=42;}
 // Deeds, as small chips.
 g.textAlign='center';
 if(summary.deeds.length){
  g.font='700 18px Cinzel, Georgia, serif';const chips=summary.deeds.slice(0,8).map(d=>'✦ '+d.title.toUpperCase());
  const widths=chips.map(c=>g.measureText(c).width+36),rows=[[]];let used=0;
  chips.forEach((c,i)=>{if(used+widths[i]+12>W-200&&rows.at(-1).length){rows.push([]);used=0;}rows.at(-1).push(i);used+=widths[i]+12;});
  let yy=Math.max(y+10,H-250-rows.length*52);
  for(const row of rows){let x=cx-(row.reduce((a,i)=>a+widths[i]+12,-12))/2;for(const i of row){g.fillStyle=P.plum;roundRect(g,x,yy-30,widths[i],42,21);g.fill();g.strokeStyle=P.line;g.lineWidth=1;g.stroke();g.fillStyle=P.parchment;g.fillText(chips[i],x+widths[i]/2,yy-1);x+=widths[i]+12;}yy+=52;}
 }
 // The reckoning.
 const stats=[[summary.stats.places,'PLACES'],[summary.stats.people,'PEOPLE MET'],[summary.stats.won+'/'+summary.stats.fights,'FIGHTS WON'],[summary.stats.gold,'GOLD']];
 const sy=H-150;stats.forEach(([value,label],i)=>{const x=W/8+i*(W/4);g.fillStyle=P.parchment;g.font='700 40px Cinzel, Georgia, serif';g.fillText(String(value),x,sy);g.fillStyle=P.goldMid;g.font='600 15px Inter, system-ui, sans-serif';try{g.letterSpacing='3px';}catch{}g.fillText(label,x,sy+30);try{g.letterSpacing='0px';}catch{}});
 g.fillStyle=P.muted;g.font='400 20px Inter, system-ui, sans-serif';g.fillText('A tale from Questbound · a tabletop adventure with an AI Dungeon Master',cx,H-64);
 return canvas;
}
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
export const canvasBlob=canvas=>new Promise(resolve=>canvas.toBlob(blob=>resolve(blob),'image/png'));
export function canShareFiles(nav=globalThis.navigator){try{return typeof nav?.share==='function'&&typeof nav.canShare==='function'&&nav.canShare({files:[new File([''],'t.png',{type:'image/png'})]});}catch{return false;}}
// Shares the picture with the words where the browser can (phones), else saves the picture and copies the words.
export async function shareTale(blob,summary,{nav=globalThis.navigator,doc=globalThis.document}={}){
 const text=taleText(summary),file=blob?new File([blob],'questbound-tale.png',{type:'image/png'}):null;
 if(file&&canShareFiles(nav)){try{await nav.share({files:[file],title:summary.name+' · Questbound',text});return 'shared';}catch(e){if(e?.name==='AbortError')return 'cancelled';}}
 if(file&&doc){const a=doc.createElement('a');a.href=URL.createObjectURL(blob);a.download='questbound-tale.png';doc.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);}
 try{await nav?.clipboard?.writeText(text);}catch{}
 return 'saved';
}
export async function copyTaleText(summary,nav=globalThis.navigator){try{await nav?.clipboard?.writeText(taleText(summary));return true;}catch{return false;}}
