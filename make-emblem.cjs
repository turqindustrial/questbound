// Prepares the Questbound emblem (the host's own art, assets/title/questbound-seal-source.webp, supplied 2026-10-10) for
// the game: the dark background becomes transparency (colour to alpha, so the art looks the same on the game's own dark
// backdrop) and the picture is split into the layers the title screen animates (webTheme.js [data-qb=emblem]):
//   public/emblem/ring-v2.webp   the serpent ring with its west, east and south stars, which turns
//   public/emblem/core-v2.webp   the Q, its dagger (the whole blade, also where it crosses the ring), the inner circle
//                                with its sun, moons and dots, which stays still
//   public/emblem/ring-glow-v2.webp, core-glow-v2.webp   small blurred copies for the breathing glow
//   public/emblem/seal-v1.webp   a small whole emblem for the top bar's mark
//   public/emblem/seal-ring-v1.webp, seal-core-v1.webp   small ring and core layers, so the boot card and the pairing
//                                page turn the ring too without waiting for the big layers
//   assets/title/questbound-emblem.webp   the whole emblem, for the app icons (assets/title/icon.html) and native builds
// Under the blade the ring layer is filled with the serpent's own scales from a little further round the ring (a whole
// number of scale rows away), so nothing of the blade turns with the ring.
// Run: node make-emblem.cjs   (draws with a headless Chrome or Edge, a throwaway profile; no internet needed)
// Raise the -vN in the file names (and in webTheme.js, public/index.html and phone-server.cjs) when the pictures change:
// the servers let browsers keep files that are not content-hashed only until they ask again.
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file=>fs.existsSync(file));
if(!browser){console.error('Chrome or Edge is needed to draw the emblem.');process.exit(1);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const source=path.join(__dirname,'assets','title','questbound-seal-source.webp');
const outputs={'ring':'public/emblem/ring-v2.webp','core':'public/emblem/core-v2.webp','ringGlow':'public/emblem/ring-glow-v2.webp','coreGlow':'public/emblem/core-glow-v2.webp','seal':'public/emblem/seal-v1.webp','sealRing':'public/emblem/seal-ring-v1.webp','sealCore':'public/emblem/seal-core-v1.webp','whole':'assets/title/questbound-emblem.webp'};

// Everything below runs in the page. Measurements are in the source picture's pixels (1254 x 1212).
function draw(){
 // The ring's centre and the square cut around it (half its side): the serpent's outer edge is 520 from the centre,
 // its inner edge 451, the dragon's head and the south star reach 612.
 const C={x:622,y:588},H=630,N=1024,k=N/(2*H),B=[20,1,15];
 const canvas=(n=N)=>{const c=document.createElement('canvas');c.width=c.height=n;return c;};
 const src=canvas(),sg=src.getContext('2d');sg.fillStyle='rgb('+B+')';sg.fillRect(0,0,N,N);sg.imageSmoothingQuality='high';
 sg.drawImage(img,N/2-C.x*k,N/2-C.y*k,img.width*k,img.height*k);
 const S=sg.getImageData(0,0,N,N).data;
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const angle=(x,y)=>(Math.atan2(y-C.y,x-C.x)*180/Math.PI+360)%360,gap=(a,b)=>Math.abs(((a-b+540)%360)-180);
 // What turns with the ring: everything beyond the inner circle, and the parts of the stars and the dragon's jaw that
 // reach in across it: [angle, half-width near the ring, further in, furthest in, how far in].
 const reaches=[[180.5,5.5,3.6,3.6,356],[359.4,5.5,3.6,3.6,356],[89.6,7.5,5.5,3.2,352],[270.7,6.2,6.2,6.2,399]];
 function ringShare(x,y){
  // (The lower right sun's eastern ray reaches 440 from the centre, so the still part reaches a little further there.)
  const r=Math.hypot(x-C.x,y-C.y),a=angle(x,y),sun=gap(a,31.5)<3;let m=sun?smooth(443,449,r):smooth(437,445,r);
  for(const [at,near,mid,far,inner] of reaches){const w=r>=425?near:r>=400?mid:far;m=Math.max(m,(1-smooth(w-.6,w+.6,gap(a,at)))*smooth(inner,inner+4,r));}
  return m;
 }
 // The dagger's blade, a long triangle from the Q's tail to its point at (1077, 1038): its upper edge runs along
 // y = x - 39 and its lower edge along y = 499.5 + x/2 (both found from the picture). It is taken with its dark outline
 // (7 and 9 pixels wide), and off the serpent's body with its soft glow (14 pixels more, inside and outside the ring),
 // so nothing of it, not even a faint streak of glow, turns with the ring. Nearer the Q than x = 870 it lies inside the
 // still part anyway. bladeEdge is how far inside that shape a point lies (negative outside).
 function bladeEdge(x,y){
  const r=Math.hypot(x-C.x,y-C.y),out=14*Math.max(smooth(521,531,r),1-smooth(444,452,r));
  const upper=(y-(x-39))/Math.SQRT2+7.5+out,lower=((499.5+x/2)-y)/1.118+9.5+out,point=3.5+out-((x-1077)*.811+(y-1038)*.585),hilt=x-870;
  return Math.min(upper,lower,point,hilt);
 }
 const bladeShare=(x,y)=>Math.max(0,Math.min(1,bladeEdge(x,y)+.5));
 // Where the blade lies over the serpent the still part keeps the picture exactly as it is, outline and all (a shadow
 // darker than the background cannot be made of transparency).
 const overSerpent=r=>smooth(440,447,r)*(1-smooth(522,530,r));
 // Colour to alpha: how far each pixel stands out from the background, and the colour that, laid over the
 // background at that strength, gives the pixel back.
 const pixel=(data,i)=>{const p=[data[i],data[i+1],data[i+2]];let a=0;for(let c=0;c<3;c++)a=Math.max(a,(p[c]-B[c])/(255-B[c]));
  if(a<=0)return [0,0,0,0];const f=p.map((v,c)=>Math.max(0,Math.min(255,B[c]+(v-B[c])/a)));return [...f,Math.max(0,Math.min(1,(a-.03)/.97))];};
 const sample=(u,v)=>{u=Math.max(0,Math.min(N-1.001,u));v=Math.max(0,Math.min(N-1.001,v));const x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0,out=[0,0,0];
  for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){const i=((y0+dy)*N+x0+dx)*4;for(let c=0;c<3;c++)out[c]+=S[i+c]*w;}return out;};
 const toSource=(u,v)=>[C.x+(u+.5-N/2)/k,C.y+(v+.5-N/2)/k];
 // Under the blade the ring layer is filled from further round the ring. The scale rows repeat about every 7.1 degrees
 // but the painting is drawn by hand, so the copy is lined up by measurement: of the turns 9 to 32 degrees either way,
 // and of small steps in or out, the one whose scales match the serpent best just beside the blade (where both can be
 // seen) is taken, first coarsely and then finely. The copy is blended in over 8 pixels outside the blade's outline,
 // so where it meets the painting there is no edge to catch the eye as the ring turns.
 const toCanvas=(x,y)=>[(x-C.x)*k+N/2-.5,(y-C.y)*k+N/2-.5];
 const moved=(x,y,turn,step)=>{const r=Math.hypot(x-C.x,y-C.y),t=Math.atan2(y-C.y,x-C.x)+turn*Math.PI/180,r2=r+step;return [C.x+r2*Math.cos(t),C.y+r2*Math.sin(t)];};
 const beside=[];
 for(let v=0;v<N;v+=1)for(let u=0;u<N;u+=1){const [x,y]=toSource(u,v),r=Math.hypot(x-C.x,y-C.y);if(r<458||r>514||gap(angle(x,y),46)>15)continue;
  const e=bladeEdge(x,y);if(e>-10||e<-60)continue;beside.push([x,y,...sample(u,v)]);}
 function mismatch(turn,step){let sum=0;for(const [x,y,R,G,Bl] of beside){const [mx,my]=moved(x,y,turn,step),[mu,mv]=toCanvas(mx,my),p=sample(mu,mv);sum+=(p[0]-R)**2+(p[1]-G)**2+(p[2]-Bl)**2;}return sum/beside.length;}
 let best={turn:14.2,step:0,score:Infinity};
 for(let turn=-32;turn<=32;turn+=.5){if(Math.abs(turn)<9)continue;for(let step=-6;step<=6;step+=1){const score=mismatch(turn,step);if(score<best.score)best={turn,step,score};}}
 const coarse=best;
 for(let turn=coarse.turn-.5;turn<=coarse.turn+.5;turn+=.05)for(let step=coarse.step-1;step<=coarse.step+1;step+=.25){const score=mismatch(turn,step);if(score<best.score)best={turn,step,score};}
 const fill=(x,y)=>{const [mx,my]=moved(x,y,best.turn,best.step),[mu,mv]=toCanvas(mx,my),rgb=sample(mu,mv),[r2,g2,b2,a2]=pixel(rgb,0);return [r2,g2,b2,a2*ringShare(mx,my)];};
 const ring=new ImageData(N,N),core=new ImageData(N,N),whole=new ImageData(N,N);
 for(let v=0;v<N;v++)for(let u=0;u<N;u++){
  const i=(v*N+u)*4,[x,y]=toSource(u,v),r=Math.hypot(x-C.x,y-C.y),fade=1-smooth(614,629,r);
  const [R,G,Bl,a]=pixel(S,i),m=ringShare(x,y),e=m>0?bladeEdge(x,y):-99,b=Math.max(0,Math.min(1,e+.5)),w=smooth(-8,.5,e);
  let pr=[R*a*m,G*a*m,Bl*a*m],pa=a*m;
  if(w>0){const [r2,g2,b2,a2]=fill(x,y);pr=pr.map((p,c)=>p*(1-w)+[r2,g2,b2][c]*a2*w);pa=pa*(1-w)+a2*w;}
  pa*=fade;const cm=a*Math.max(1-m,b),o=b*overSerpent(r),ca=o+cm*(1-o);
  if(pa>0){ring.data[i]=pr[0]*fade/pa;ring.data[i+1]=pr[1]*fade/pa;ring.data[i+2]=pr[2]*fade/pa;ring.data[i+3]=Math.round(pa*255);}
  if(ca>0){for(let c=0;c<3;c++)core.data[i+c]=(S[i+c]*o+[R,G,Bl][c]*cm*(1-o))/ca;core.data[i+3]=Math.round(ca*255);}
  if(a*fade>0){whole.data[i]=R;whole.data[i+1]=G;whole.data[i+2]=Bl;whole.data[i+3]=Math.round(a*fade*255);}
 }
 const put=data=>{const c=canvas();c.getContext('2d').putImageData(data,0,0);return c;};
 const ringC=put(ring),coreC=put(core),wholeC=put(whole);
 const scaled=(from,n,blur)=>{const c=canvas(n),g=c.getContext('2d');g.imageSmoothingQuality='high';if(blur)g.filter='blur('+blur+'px)';g.drawImage(from,0,0,n,n);return c;};
 const webp=(c,q)=>c.toDataURL('image/webp',q);
 return {fill:best,ring:webp(ringC,.84),core:webp(coreC,.86),ringGlow:webp(scaled(ringC,256,5),.8),coreGlow:webp(scaled(coreC,256,4),.8),seal:webp(scaled(wholeC,264),.88),sealRing:webp(scaled(ringC,360),.86),sealCore:webp(scaled(coreC,360),.88),whole:webp(scaled(wholeC,900),.76)};
}

(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-emblem-'));
 const chrome=spawn(browser,['--headless=new','--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
 try{
  let port;for(let i=0;i<100&&!port;i++){try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];}catch{await sleep(200);}}
  if(!port)throw Error('the browser did not start');
  let page;for(let i=0;i<50&&!page;i++){try{page=(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');}catch{}if(!page)await sleep(200);}
  const ws=await new Promise((res,rej)=>{const w=new WebSocket(page.webSocketDebuggerUrl);w.onopen=()=>res(w);w.onerror=rej;});
  const waiting=new Map();let id=0;ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&waiting.has(d.id)){waiting.get(d.id)(d);waiting.delete(d.id);}};
  const send=(method,params)=>new Promise(res=>{const n=++id;waiting.set(n,res);ws.send(JSON.stringify({id:n,method,params}));});
  const data='data:image/webp;base64,'+fs.readFileSync(source).toString('base64');
  const reply=await send('Runtime.evaluate',{expression:'(async()=>{const img=new Image();img.src='+JSON.stringify(data)+';await img.decode();return ('+draw+')();})()',awaitPromise:true,returnByValue:true});
  if(reply.error||reply.result.exceptionDetails)throw Error(JSON.stringify(reply.error??reply.result.exceptionDetails).slice(0,600));
  const {turn,step}=reply.result.result.value.fill;console.log('Under the blade: scales from '+turn.toFixed(2)+' degrees round, '+step.toFixed(2)+' px '+(step<0?'in':'out'));
  for(const [key,file] of Object.entries(outputs)){const out=path.join(__dirname,file);fs.mkdirSync(path.dirname(out),{recursive:true});
   const bytes=Buffer.from(reply.result.result.value[key].split(',')[1],'base64');fs.writeFileSync(out,bytes);console.log(file+' '+Math.round(bytes.length/1024)+' KB');}
  ws.close();
 }finally{chrome.kill();await sleep(500);try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
