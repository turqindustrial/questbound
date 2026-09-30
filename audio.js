// Questbound audio engine: a live-synthesized adaptive score, location ambience and layered effects, mixed like a game.
// Signal flow:
//   music voices -> music bus -> duck -> high-pass -> ┐        hall reverb returns into the music bus
//   ambience     -> ambience bus -> duck ------------> ├-> glue compressor -> limiter -> master -> speakers
//   effects      -> effects bus -------------------> ┘        room reverb returns into the effects bus
// Browsers only allow sound after the player interacts, so the engine wakes on the first tap or key press.
const web=typeof window!=='undefined'&&typeof window.AudioContext!=='undefined';
const KEY='questbound.audio.v1';
const defaults={master:0.85,music:0.6,ambience:0.6,effects:1,muted:false,night:false};
let settings=load(),ctx=null,listeners=new Set();
let out={};                         // master chain nodes
let mood=null,scheduler=null,ambience=null,ambienceKind=null,danger=0,heartbeat=null;
// Voice budget: counts sounds that actually overlap in time. The score yields first so effects are never dropped.
const live=[],MUSIC_VOICES=96,ALL_VOICES=220;
function admit(t,end,bus,priority){
 const now=ctx.currentTime;for(let i=live.length-1;i>=0;i--)if(live[i].end<now)live.splice(i,1);
 const musical=bus===out.music||bus===out.pad||bus===out.amb;let all=0,music=0;
 for(const v of live)if(v.start<end&&v.end>t){all++;if(v.musical)music++;}
 if(!priority&&(all>=ALL_VOICES||(musical&&music>=MUSIC_VOICES)))return false;
 live.push({start:t,end,musical});return true;
}
const cache={noise:null,pluck:new Map()};
function load(){try{const v=JSON.parse(window.localStorage.getItem(KEY));return {...defaults,...(v&&typeof v==='object'?v:{})};}catch{return {...defaults};}}
function persist(){try{window.localStorage.setItem(KEY,JSON.stringify(settings));}catch{}}
export const audioSettings=()=>({...settings});
export function subscribeAudio(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function setAudio(changes){settings={...settings,...changes};persist();applyMix();listeners.forEach(fn=>fn({...settings}));}

// ---------- Mix ----------
function applyMix(){
 if(!ctx)return;const t=ctx.currentTime,o=out;
 o.master.gain.setTargetAtTime(settings.muted?0:settings.master*(settings.night?0.8:1),t,.05);
 o.music.gain.setTargetAtTime(settings.music*0.5,t,.25);
 o.amb.gain.setTargetAtTime(settings.ambience*0.55,t,.25);
 o.sfx.gain.setTargetAtTime(settings.effects*0.9,t,.05);
 // Night mode narrows the dynamic range so quiet narration moments and loud hits sit closer together.
 o.glue.threshold.setTargetAtTime(settings.night?-32:-18,t,.1);o.glue.ratio.setTargetAtTime(settings.night?5:2.5,t,.1);
}
function ensure(){
 if(!web)return false;
 if(!ctx){
  ctx=new window.AudioContext({latencyHint:'interactive'});
  const o=out,g=v=>{const n=ctx.createGain();n.gain.value=v;return n;};
  o.master=g(0);o.limiter=ctx.createDynamicsCompressor();o.glue=ctx.createDynamicsCompressor();
  o.limiter.threshold.value=-2.5;o.limiter.knee.value=0;o.limiter.ratio.value=20;o.limiter.attack.value=.002;o.limiter.release.value=.08;
  o.glue.threshold.value=-18;o.glue.knee.value=8;o.glue.ratio.value=2.5;o.glue.attack.value=.02;o.glue.release.value=.25;
  // Makeup gain after the glue stage (about +4 dB, roughly -20 LUFS for the score), then the limiter, then a soft clipper
  // that is transparent below -2 dBFS and rounds off anything above, so nothing ever hard-clips.
  const makeup=g(1.55),clip=ctx.createWaveShaper(),curve=new Float32Array(2049);
  for(let i=0;i<curve.length;i++){const x=i/1024-1,a=Math.abs(x);curve[i]=a<.8?x:Math.sign(x)*(.8+.2*Math.tanh((a-.8)/.2));}
  clip.curve=curve;clip.oversample='2x';
  o.glue.connect(makeup);makeup.connect(o.limiter);o.limiter.connect(clip);clip.connect(o.master);o.master.connect(ctx.destination);
  // Buses with sidechain-style ducking stages.
  o.music=g(0);o.musicDuck=g(1);o.amb=g(0);o.ambDuck=g(1);o.sfx=g(0);
  const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=32;hp.Q.value=.7;
  o.music.connect(o.musicDuck);o.musicDuck.connect(hp);hp.connect(o.glue);
  o.amb.connect(o.ambDuck);o.ambDuck.connect(o.glue);o.sfx.connect(o.glue);
  // Two reverbs: a long stereo hall for the score and a tighter room for effects.
  o.hall=ctx.createConvolver();o.hall.buffer=impulse(3.4,2.4,.012);const hallReturn=g(.55);o.hall.connect(hallReturn);hallReturn.connect(o.music);
  o.room=ctx.createConvolver();o.room.buffer=impulse(1.3,3.2,.006);const roomReturn=g(.4);o.room.connect(roomReturn);roomReturn.connect(o.sfx);
  o.cave=ctx.createConvolver();o.cave.buffer=impulse(4.5,1.8,.03);const caveReturn=g(.6);o.cave.connect(caveReturn);caveReturn.connect(o.amb);
  // Chorus for the string and choir pads: two slowly modulated short delays widen them in stereo.
  o.pad=g(1);const merger=ctx.createChannelMerger(2);
  [[0,.011,.23],[1,.017,.31]].forEach(([ch,base,rate])=>{const d=ctx.createDelay(.05);d.delayTime.value=base;const lfo=ctx.createOscillator(),depth=g(.0025);lfo.frequency.value=rate;lfo.connect(depth);depth.connect(d.delayTime);lfo.start();o.pad.connect(d);d.connect(merger,0,ch);});
  const dry=g(.7);o.pad.connect(dry);dry.connect(o.music);const wide=g(.5);merger.connect(wide);wide.connect(o.music);const padSend=g(.45);o.pad.connect(padSend);padSend.connect(o.hall);
  applyMix();
 }
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});
 return true;
}
// Stereo impulse: sparse early reflections, then a decorrelated tail that darkens as it decays.
function impulse(seconds,decay,predelay){
 const sr=ctx.sampleRate,len=Math.floor(sr*seconds),buf=ctx.createBuffer(2,len,sr);
 for(let c=0;c<2;c++){
  const d=buf.getChannelData(c),pre=Math.floor(predelay*sr);let lp=0;
  for(let i=0;i<8;i++){const at=pre+Math.floor(Math.random()*.07*sr);if(at<len)d[at]+=(Math.random()*.8+.2)*(Math.random()<.5?-1:1)*.6;}
  for(let i=pre;i<len;i++){const p=(i-pre)/(len-pre),a=.2+.75*p;lp=a*lp+(1-a)*(Math.random()*2-1);d[i]+=lp*Math.pow(1-p,decay)*.9;}
 }
 return buf;
}
const hz=m=>440*Math.pow(2,(m-69)/12);
const human=t=>t+(Math.random()-.5)*.012;
const vary=(v,amount=.04)=>v*(1+(Math.random()*2-1)*amount);
function noiseBuffer(){if(!cache.noise){const len=ctx.sampleRate*2,b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;cache.noise=b;}return cache.noise;}
function pan(node,value){if(!value)return node;const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,value));node.connect(p);return p;}
// A voice: source -> optional filter -> envelope -> pan -> bus, with optional reverb send.
function voice(src,t,{bus,peak=.2,attack=.005,hold=0,release=.3,send=0,reverb=null,filter=null,panTo=0}){
 const env=ctx.createGain();let node=src;
 if(filter){const f=ctx.createBiquadFilter();f.type=filter.type??'lowpass';f.frequency.setValueAtTime(filter.freq,t);if(filter.to)f.frequency.exponentialRampToValueAtTime(filter.to,t+(filter.time??attack+hold+release));f.Q.value=filter.q??.7;node.connect(f);node=f;}
 node.connect(env);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(peak,t+attack);env.gain.setValueAtTime(peak,t+attack+hold);env.gain.exponentialRampToValueAtTime(.0001,t+attack+hold+release);
 const last=pan(env,panTo);last.connect(bus);if(send&&reverb){const s=ctx.createGain();s.gain.value=send;last.connect(s);s.connect(reverb);}
 return t+attack+hold+release+.05;
}
const span=(t,o)=>t+(o.attack??.005)+(o.hold??0)+(o.release??.3)+.05;
function osc(type,freq,t,opts){if(!admit(t,span(t,opts),opts.bus,opts.priority))return;const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);if(opts.glide)o.frequency.exponentialRampToValueAtTime(opts.glide,t+(opts.glideTime??opts.release??.3));if(opts.detune)o.detune.value=opts.detune;const end=voice(o,t,opts);o.start(t);o.stop(end);}
function noise(t,opts){if(!admit(t,span(t,opts),opts.bus,opts.priority))return;const s=ctx.createBufferSource();s.buffer=noiseBuffer();s.loop=true;const end=voice(s,t,opts);s.start(t,Math.random()*1.5);s.stop(end);}
// FM bell: a sine carrier modulated at an inharmonic ratio — celesta, chimes and magic.
function bell(freq,t,opts){if(!admit(t,span(t,opts),opts.bus,opts.priority))return;const car=ctx.createOscillator(),mod=ctx.createOscillator(),depth=ctx.createGain();car.frequency.value=freq;mod.frequency.value=freq*(opts.ratio??3.5);depth.gain.setValueAtTime(freq*(opts.index??2.2),t);depth.gain.exponentialRampToValueAtTime(freq*.05,t+(opts.release??1.5));mod.connect(depth);depth.connect(car.frequency);const end=voice(car,t,opts);car.start(t);mod.start(t);car.stop(end);mod.stop(end);}
// Karplus-Strong plucked string, rendered once per pitch and cached: harp and lute.
function pluckBuffer(midi,bright){
 const key=midi+':'+bright;if(cache.pluck.has(key))return cache.pluck.get(key);
 const sr=ctx.sampleRate,f=hz(midi),N=Math.max(2,Math.round(sr/f)),len=Math.floor(sr*3),buf=ctx.createBuffer(1,len,sr),d=buf.getChannelData(0),line=new Float32Array(N);
 let lp=0;for(let i=0;i<N;i++){lp=lp*.55+(Math.random()*2-1)*.45;line[i]=lp;}   // softened excitation: a finger, not a pick
 const decay=.9985-Math.max(0,midi-60)*.0004,w=bright;let idx=0;
 for(let i=0;i<len;i++){const a=line[idx],b=line[(idx+1)%N];d[i]=a;line[idx]=decay*(w*a+(1-w)*b);idx=(idx+1)%N;}
 for(let i=len-2000;i<len;i++)d[i]*=(len-i)/2000;
 cache.pluck.set(key,buf);return buf;
}
function pluck(midi,t,{bus,peak=.3,panTo=0,bright=.5,send=.5,reverb}){if(!admit(t,t+3,bus,false))return;const s=ctx.createBufferSource();s.buffer=pluckBuffer(midi,bright);s.playbackRate.value=1+(Math.random()-.5)*.002;const env=ctx.createGain();env.gain.value=peak;s.connect(env);const last=pan(env,panTo);last.connect(bus);if(reverb&&send){const g=ctx.createGain();g.gain.value=send;last.connect(g);g.connect(reverb);}s.start(t);}
// Sidechain-style ducking: important moments pull the score and ambience down briefly.
function duck(depth=.5,hold=.25,release=.7){if(!ctx)return;const t=ctx.currentTime;[out.musicDuck,out.ambDuck].forEach(n=>{n.gain.cancelScheduledValues(t);n.gain.setTargetAtTime(depth,t,.02);n.gain.setTargetAtTime(1,t+hold,release/3);});}

// ---------- Instruments for the score ----------
function strings(notes,t,dur,level){notes.forEach((m,i)=>[-7,0,7].forEach(cents=>osc('sawtooth',hz(m),t,{bus:out.pad,peak:level/notes.length/2.2,attack:dur*.3,hold:dur*.45,release:1.6,detune:cents+(Math.random()-.5)*4,filter:{freq:500,to:1400,time:dur*.5,q:.5},panTo:(i/(notes.length-1||1)-.5)*.8})));}
// Formant choir: sawtooth voices through vowel resonances ("ah") — the big cinematic pad.
function choir(notes,t,dur,level){
 notes.forEach((m,i)=>{if(!admit(t,t+dur+2,out.pad,false))return;const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz(m);o.detune.value=(Math.random()-.5)*10;const vib=ctx.createOscillator(),vd=ctx.createGain();vib.frequency.value=4.6+Math.random()*.6;vd.gain.value=hz(m)*.004;vib.connect(vd);vd.connect(o.frequency);
  const sum=ctx.createGain();[[750,6,1],[1150,7,.6],[2600,9,.25]].forEach(([f,q,g])=>{const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f;bp.Q.value=q;const gg=ctx.createGain();gg.gain.value=g;o.connect(bp);bp.connect(gg);gg.connect(sum);});
  const env=ctx.createGain();env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(level/notes.length*2.2,t+dur*.35);env.gain.linearRampToValueAtTime(level/notes.length*1.6,t+dur*.85);env.gain.linearRampToValueAtTime(0,t+dur+1.8);
  sum.connect(env);pan(env,(i/(notes.length-1||1)-.5)*.6).connect(out.pad);o.start(t);vib.start(t);o.stop(t+dur+2);vib.stop(t+dur+2);});
}
function bass(m,t,dur,level){osc('sine',hz(m),t,{bus:out.music,peak:level,attack:.08,hold:dur*.6,release:dur*.5});osc('triangle',hz(m+12),t,{bus:out.music,peak:level*.15,attack:.08,hold:dur*.4,release:dur*.4,filter:{freq:600}});}
function taiko(t,strength=1,panTo=0){const p=vary(1,.03);osc('sine',82*p,t,{bus:out.music,peak:.55*strength,attack:.002,release:.55,glide:44*p,glideTime:.35,send:.25,reverb:out.hall,panTo,priority:true});noise(t,{bus:out.music,peak:.22*strength,attack:.001,release:.18,filter:{freq:900,to:200,time:.18},send:.2,reverb:out.hall,panTo});}
function frame(t,level=.12,panTo=0){noise(t,{bus:out.music,peak:level,attack:.001,release:.09,filter:{type:'bandpass',freq:vary(1800,.1),q:1.4},panTo});osc('sine',vary(190,.05),t,{bus:out.music,peak:level*1.2,attack:.001,release:.12,glide:120});}
function staccato(m,t,level){osc('sawtooth',hz(m),t,{bus:out.music,peak:level,attack:.004,release:.16,filter:{freq:1600,to:400,time:.14},panTo:(Math.random()-.5)*.3});}
function brassStab(notes,t,level=.12,len=.5){notes.forEach((m,i)=>[-6,6].forEach(c=>osc('sawtooth',hz(m),t,{bus:out.music,peak:level/notes.length,attack:.03,hold:len*.4,release:len,detune:c,filter:{freq:500,to:2600,time:.08,q:1},send:.35,reverb:out.hall,panTo:(i-notes.length/2)*.15})));}
function swell(t,dur,level=.12){noise(t,{bus:out.music,peak:level,attack:dur,release:.25,filter:{type:'highpass',freq:3000,to:9000,time:dur},send:.4,reverb:out.hall});}

// ---------- Adaptive score ----------
// Voicings chosen for smooth voice leading. Each mood is a set of layers on a shared beat grid.
const moods={
 menu:{bpm:62,beatsPerChord:8,chords:[[50,57,62,65],[46,53,58,62],[53,57,60,65],[48,55,60,64],[43,50,58,62],[45,52,57,61]],layers:{choir:.09,strings:.07,harp:.6,bass:.14,bells:true}},
 explore:{bpm:70,beatsPerChord:8,chords:[[45,52,57,60],[41,48,53,57],[48,52,55,60],[43,50,55,59]],layers:{strings:.06,lute:.45,bass:.1}},
 combat:{bpm:124,beatsPerChord:8,chords:[[38,45,50,53],[34,41,46,50],[31,38,43,46],[33,40,45,49]],layers:{strings:.05,taiko:true,ostinato:.045,brass:true,bass:.16}},
};
const scale=chord=>[...new Set(chord.map(m=>m%12))];
function startScheduler(name,startAt){
 const m=moods[name];let beat=0,next=startAt??ctx.currentTime+.1;const spb=60/m.bpm,L=m.layers;
 const tick=()=>{if(!ctx||scheduler?.name!==name)return;while(next<ctx.currentTime+.6){
  const i=Math.floor(beat/m.beatsPerChord)%m.chords.length,chord=m.chords[i],onChord=beat%m.beatsPerChord===0,dur=spb*m.beatsPerChord;
  if(onChord){if(L.strings)strings(chord,next,dur,L.strings);if(L.choir&&i%2===0)choir(chord.slice(1),next,dur*2,L.choir);if(L.bass)bass(chord[0]-12,next,dur,L.bass);if(L.brass&&i%2===0)brassStab(chord.slice(1),next,.11,.6);}
  if(L.harp&&Math.random()<L.harp){const tones=chord.slice(1),n=tones[beat%tones.length]+12*(1+Math.floor(Math.random()*2));pluck(n,human(next),{bus:out.music,peak:.22,panTo:(Math.random()-.5)*.9,bright:.52,send:.55,reverb:out.hall});if(Math.random()<.3)pluck(n+(Math.random()<.5?7:12),human(next+spb/2),{bus:out.music,peak:.14,panTo:(Math.random()-.5)*.9,bright:.52,send:.55,reverb:out.hall});}
  if(L.lute&&Math.random()<L.lute){const pcs=scale(chord),root=60+Math.floor(Math.random()*12);const n=root+((pcs.find(p=>p>=root%12)??pcs[0])-(root%12));pluck(n,human(next+(Math.random()<.4?spb/2:0)),{bus:out.music,peak:.2,panTo:(Math.random()-.5)*.5,bright:.62,send:.4,reverb:out.hall});}
  if(L.bells&&beat%16===12)bell(hz(chord[2]+24),human(next),{bus:out.music,peak:.035,attack:.005,release:2.8,send:.7,reverb:out.hall,ratio:3.5,index:1.4,panTo:.3});
  if(L.taiko){const b=beat%8;if(b===0)taiko(next,1,-.1);if(b===3||b===5)taiko(next+spb/2,.6,.15);if(b===6)taiko(next,.8,0);frame(next+spb/2,.07,(Math.random()-.5)*.6);if(beat%32===31)for(let k=0;k<4;k++)taiko(next+k*spb/4,.5+k*.12,(k%2?.2:-.2));if(beat%32===28)swell(next,spb*4,.08);}
  if(L.ostinato){[0,.5].forEach((o,k)=>staccato(chord[0]+(k?12:0),human(next+o*spb),L.ostinato));}
  beat++;next+=spb;}};
 const handle={name,timer:null};scheduler=handle;tick();handle.timer=setInterval(tick,90);return handle;
}
export function setMood(name){
 if(name===mood)return;const from=mood;mood=name;
 if(!ctx)return;
 const t=ctx.currentTime,bus=out.music;
 if(scheduler)clearInterval(scheduler.timer);scheduler=null;
 bus.gain.cancelScheduledValues(t);bus.gain.setTargetAtTime(0,t,.35);
 // Into combat: a rising swell and a downbeat hit; the new score enters under it.
 if(name==='combat'&&from){swell(t,1.1,.14);setTimeout(()=>{if(mood==='combat'&&ctx){taiko(ctx.currentTime,1.2);brassStab([50,57,62],ctx.currentTime,.14,.8);}},1100);}
 setTimeout(()=>{if(mood!==name||!ctx)return;applyMix();if(moods[name])startScheduler(name);},name==='combat'?1100:1400);
}

// ---------- Ambience ----------
// Beds are looping filtered noise with slow movement; details (crackles, drips, gusts, birds) are scheduled at random.
const beds={
 menu:{wind:.08,hearth:.05},hearth:{hearth:.12,room:.05},wild:{wind:.14,birds:true},cave:{cave:.1,drips:true},battle:{wind:.1},
};
function startAmbience(kind){
 const spec=beds[kind];if(!spec)return null;const nodes=[],timers=[],t=ctx.currentTime;
 const bed=(level,filter,lfoRate,panTo)=>{const s=ctx.createBufferSource();s.buffer=noiseBuffer();s.loop=true;const f=ctx.createBiquadFilter();f.type=filter.type;f.frequency.value=filter.freq;f.Q.value=filter.q??.7;const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+3);
  if(lfoRate){const l=ctx.createOscillator(),d=ctx.createGain();l.frequency.value=lfoRate;d.gain.value=filter.freq*.45;l.connect(d);d.connect(f.frequency);l.start();nodes.push(l);}
  s.connect(f);f.connect(g);pan(g,panTo).connect(out.amb);s.start(t,Math.random());nodes.push(s);return g;};
 const gains=[];
 if(spec.wind){gains.push(bed(spec.wind,{type:'bandpass',freq:420,q:.6},.07,-.4));gains.push(bed(spec.wind*.7,{type:'bandpass',freq:700,q:.8},.05,.4));}
 if(spec.hearth){gains.push(bed(spec.hearth*.5,{type:'lowpass',freq:320},0,0));timers.push(setInterval(()=>{if(!ctx)return;const at=ctx.currentTime+Math.random()*.2;for(let k=0,n=1+Math.floor(Math.random()*3);k<n;k++)noise(at+k*.03,{bus:out.amb,peak:vary(spec.hearth*.9,.5),attack:.001,release:.03,filter:{type:'bandpass',freq:vary(2600,.4),q:2},panTo:(Math.random()-.5)*.4});},220));}
 if(spec.room)gains.push(bed(spec.room,{type:'lowpass',freq:180},0,0));
 if(spec.cave){gains.push(bed(spec.cave,{type:'lowpass',freq:140},.03,0));}
 if(spec.drips)timers.push(setInterval(()=>{if(!ctx||Math.random()<.4)return;const f=vary(1800,.35);osc('sine',f,ctx.currentTime,{bus:out.amb,peak:.05,attack:.001,release:.12,glide:f*.55,send:.8,reverb:out.cave,panTo:(Math.random()-.5)*1.4});},1100));
 if(spec.birds)timers.push(setInterval(()=>{if(!ctx||Math.random()<.65)return;const at=ctx.currentTime,base=vary(3200,.2),p=(Math.random()-.5)*1.4;for(let k=0,n=2+Math.floor(Math.random()*4);k<n;k++)osc('sine',base,at+k*.11,{bus:out.amb,peak:.018,attack:.01,release:.07,glide:base*vary(1.35,.1),glideTime:.06,panTo:p});},2600));
 return {kind,stop(){const now=ctx.currentTime;gains.forEach(g=>{g.gain.cancelScheduledValues(now);g.gain.setTargetAtTime(0,now,.8);});timers.forEach(clearInterval);setTimeout(()=>nodes.forEach(n=>{try{n.stop();}catch{}}),4000);}};
}
export function setAmbience(kind){if(kind===ambienceKind)return;ambienceKind=kind;if(!ctx)return;ambience?.stop();ambience=startAmbience(kind);}
// Danger (0..1): at low HP a heartbeat rises under everything.
export function setDanger(level){danger=Math.max(0,Math.min(1,level||0));if(!ctx)return;
 if(danger>.5&&!heartbeat){heartbeat=setInterval(()=>{if(!ctx||danger<=.5)return;const t=ctx.currentTime,v=.15+.25*danger;[0,.24].forEach((o,k)=>osc('sine',k?52:58,t+o,{bus:out.sfx,peak:v*(k?.7:1),attack:.004,release:.22,glide:38,priority:true}));},60000/(62+danger*30));}
 if(danger<=.5&&heartbeat){clearInterval(heartbeat);heartbeat=null;}
}

// ---------- Effects ----------
// Positions: the player's own actions sit slightly left, the opponent's slightly right.
const ME=-.22,FOE=.3;
const ring=(t,base,level,panTo)=>[1,2.76,5.4,8.9].forEach((r,i)=>osc('sine',base*r,t,{bus:out.sfx,peak:level/(i+1),attack:.001,release:.9/(i*.6+1),panTo,send:.35,reverb:out.room}));
const whoosh=(t,panTo,level=.16,fast=false)=>noise(t,{bus:out.sfx,peak:level,attack:fast?.04:.08,release:fast?.1:.16,filter:{type:'bandpass',freq:vary(500),to:vary(2600),time:fast?.12:.2,q:1.6},panTo});
const thud=(t,panTo,level=.45,freq=140)=>{osc('sine',vary(freq,.06),t,{bus:out.sfx,peak:level,attack:.002,release:.22,glide:freq*.35,panTo,priority:true});noise(t,{bus:out.sfx,peak:level*.5,attack:.001,release:.12,filter:{freq:1200,to:250,time:.12},panTo});};
const impacts={
 slashing:(t,p,c)=>{whoosh(t,p,.14,true);thud(t+.06,p,.35);ring(t+.06,vary(640,.08),c?.06:.035,p);noise(t+.06,{bus:out.sfx,peak:.12,attack:.001,release:.08,filter:{type:'highpass',freq:3500},panTo:p});},
 piercing:(t,p)=>{whoosh(t,p,.1,true);thud(t+.05,p,.3,210);noise(t+.05,{bus:out.sfx,peak:.16,attack:.001,release:.05,filter:{type:'bandpass',freq:1600,q:3},panTo:p});},
 bludgeoning:(t,p)=>{whoosh(t,p,.12);thud(t+.08,p,.6,110);noise(t+.08,{bus:out.sfx,peak:.2,attack:.001,release:.18,filter:{freq:700,to:150,time:.18},panTo:p,send:.3,reverb:out.room});},
 fire:(t,p)=>{noise(t,{bus:out.sfx,peak:.2,attack:.05,release:.5,filter:{freq:400,to:3000,time:.3,q:.8},panTo:p,send:.3,reverb:out.room});for(let k=0;k<8;k++)noise(t+.1+Math.random()*.5,{bus:out.sfx,peak:.08,attack:.001,release:.02,filter:{type:'bandpass',freq:vary(3000,.4),q:3},panTo:p+(Math.random()-.5)*.3});thud(t+.1,p,.25,90);},
 cold:(t,p)=>{[2093,2637,3136,4186].forEach((f,i)=>bell(vary(f,.02),t+i*.035,{bus:out.sfx,peak:.07,attack:.002,release:.9,ratio:2.01,index:1.2,panTo:p+(i-1.5)*.1,send:.5,reverb:out.room}));noise(t,{bus:out.sfx,peak:.14,attack:.01,release:.4,filter:{type:'highpass',freq:6000},panTo:p});thud(t+.02,p,.3,170);},
 poison:(t,p)=>{noise(t,{bus:out.sfx,peak:.3,attack:.03,release:.5,filter:{type:'bandpass',freq:4200,to:2000,time:.5,q:2},panTo:p});osc('sawtooth',180,t,{bus:out.sfx,peak:.08,attack:.05,release:.4,glide:120,filter:{freq:600},panTo:p});thud(t+.03,p,.28,150);},
 necrotic:(t,p)=>{osc('sawtooth',70,t,{bus:out.sfx,peak:.26,attack:.08,release:.8,glide:45,filter:{freq:300},panTo:p,send:.4,reverb:out.room});noise(t,{bus:out.sfx,peak:.2,attack:.2,release:.6,filter:{freq:200,to:900,time:.6},panTo:p});thud(t+.05,p,.3,90);},
 force:(t,p)=>{thud(t,p,.45,160);bell(880,t,{bus:out.sfx,peak:.04,release:.6,ratio:1.5,index:3,panTo:p});},
};
impacts.radiant=(t,p)=>{bell(1320,t,{bus:out.sfx,peak:.05,release:1.2,ratio:2,index:1,panTo:p,send:.6,reverb:out.room});thud(t,p,.25,180);};
impacts.lightning=impacts.thunder=(t,p)=>{noise(t,{bus:out.sfx,peak:.3,attack:.001,release:.35,filter:{freq:6000,to:400,time:.3},panTo:p,send:.4,reverb:out.room});thud(t+.02,p,.4,70);};
impacts.acid=impacts.poison;impacts.psychic=impacts.necrotic;
const effects={
 click:t=>{noise(t,{bus:out.sfx,peak:.06,attack:.001,release:.025,filter:{type:'bandpass',freq:vary(2400,.1),q:4}});osc('sine',vary(1250,.03),t,{bus:out.sfx,peak:.035,attack:.001,release:.05,glide:900});},
 send:t=>{for(let k=0;k<5;k++)noise(t+k*.045,{bus:out.sfx,peak:.05,attack:.004,release:.035,filter:{type:'bandpass',freq:vary(4200,.2),q:2.5}});bell(hz(86),t+.22,{bus:out.sfx,peak:.03,release:1.1,ratio:3.5,index:1,send:.5,reverb:out.room});},
 dice:t=>{let at=t,level=.2;for(let i=0;i<8;i++){noise(at,{bus:out.sfx,peak:level,attack:.001,release:.02,filter:{type:'bandpass',freq:vary(3400,.3),q:6},panTo:(Math.random()-.5)*.5});osc('sine',vary(210,.1),at,{bus:out.sfx,peak:level*.5,attack:.001,release:.04});at+=.035+i*i*.006;level*=.8;}noise(at,{bus:out.sfx,peak:.05,attack:.02,release:.12,filter:{type:'bandpass',freq:1800,q:2}});},
 swing:t=>whoosh(t,ME,.14,true),
 miss:t=>{whoosh(t,FOE,.16);noise(t+.12,{bus:out.sfx,peak:.05,attack:.005,release:.1,filter:{freq:500},panTo:FOE});},
 hit:t=>{impacts.slashing(t,FOE,false);duck(.65,.15,.5);},
 crit:t=>{whoosh(t,ME,.18,true);brassStab([62,69,74],t+.05,.12,.4);[1320,1760,2217].forEach((f,i)=>bell(f,t+.08+i*.05,{bus:out.sfx,peak:.035,release:1,ratio:3.5,index:1,send:.5,reverb:out.room}));duck(.5,.3,.7);},
 hurt:t=>{thud(t,ME,.55,95);osc('sawtooth',110,t,{bus:out.sfx,peak:.08,attack:.002,release:.3,glide:55,filter:{freq:500},panTo:ME});duck(.55,.2,.6);},
 heal:t=>{[76,83,88,95,100].forEach((m,i)=>bell(hz(m),t+i*.08,{bus:out.sfx,peak:.03,attack:.01,release:1.4,ratio:2,index:.8,send:.7,reverb:out.room,panTo:(i-2)*.12}));noise(t,{bus:out.sfx,peak:.04,attack:.3,release:.8,filter:{type:'highpass',freq:7000}});},
 fall:t=>{thud(t,FOE,.5,90);noise(t+.12,{bus:out.sfx,peak:.1,attack:.002,release:.25,filter:{type:'bandpass',freq:2600,q:1.5},panTo:FOE});duck(.7,.2,.5);},
 victory:t=>{duck(.3,1.6,1.2);swell(t,.6,.1);[62,66,69,74].forEach((m,i)=>brassStab([m],t+.55+i*.14,.26,.25));brassStab([62,66,69,74],t+1.15,.3,1.8);choir([62,66,69,74],t+1.15,2.2,.15);taiko(t+1.15,1.3);[2349,2960].forEach((f,i)=>bell(f,t+1.2+i*.1,{bus:out.sfx,peak:.03,release:2,ratio:3.5,index:1,send:.7,reverb:out.room}));},
 defeat:t=>{duck(.3,2,1.5);[57,53,50,45].forEach((m,i)=>osc('sawtooth',hz(m),t+i*.5,{bus:out.sfx,peak:.05,attack:.1,hold:.4,release:.8,filter:{freq:700},send:.4,reverb:out.room}));osc('sine',55,t+2,{bus:out.sfx,peak:.4,attack:.002,release:3,send:.5,reverb:out.room,priority:true});bell(110,t+2,{bus:out.sfx,peak:.08,release:3.5,ratio:1.4,index:4,send:.6,reverb:out.room});},
 chime:t=>{bell(hz(86),t,{bus:out.sfx,peak:.03,attack:.004,release:1.4,ratio:3.5,index:1,send:.6,reverb:out.room});bell(hz(93),t+.12,{bus:out.sfx,peak:.022,attack:.004,release:1.6,ratio:3.5,index:1,send:.6,reverb:out.room});},
 voice:(t,o)=>{const base=o?.speaker==='mara'?88:81;bell(hz(base),t,{bus:out.sfx,peak:.022,attack:.004,release:1,ratio:3.01,index:.7,send:.5,reverb:out.room,panTo:o?.speaker==='mara'?.25:-.25});},
 whoosh:t=>{noise(t,{bus:out.sfx,peak:.14,attack:.25,release:.45,filter:{freq:300,to:3600,time:.6,q:.8},send:.35,reverb:out.room});osc('sine',48,t,{bus:out.sfx,peak:.12,attack:.3,release:.5});},
 page:t=>{for(let k=0;k<3;k++)noise(t+k*.06,{bus:out.sfx,peak:.05,attack:.02,release:.08,filter:{type:'bandpass',freq:vary(2800,.3),q:.9}});},
 boot:t=>{duck(.2,2.5,2);osc('sine',38,t,{bus:out.sfx,peak:.55,attack:.01,release:3.2,glide:30,glideTime:2.5,priority:true});noise(t,{bus:out.sfx,peak:.14,attack:1.4,release:.6,filter:{freq:200,to:6000,time:1.8,q:.7},send:.5,reverb:out.room});choir([50,57,62,66,69],t+1.4,3,.12);strings([38,50,57,62],t+1.4,3,.1);[1175,1480,1760,2349].forEach((f,i)=>bell(f,t+1.5+i*.12,{bus:out.sfx,peak:.03,release:2.5,ratio:3.5,index:1,send:.7,reverb:out.room,panTo:(i-1.5)*.25}));taiko(t+1.4,1.3);},
 spell:(t,o)=>{const p=o?.panTo??ME;[0,.05,.1].forEach((d,i)=>bell(vary(1500+i*420,.05),t+d,{bus:out.sfx,peak:.03,release:.7,ratio:2.4,index:2,panTo:p,send:.5,reverb:out.room}));noise(t,{bus:out.sfx,peak:.08,attack:.12,release:.25,filter:{type:'bandpass',freq:1200,to:5000,time:.3,q:2},panTo:p});},
};
// impact:TYPE:target  — a landed blow by damage type, on the opponent (foe) or on you (me).
export function playSound(name,delay=0,options={}){
 if(!ctx||settings.muted)return;
 try{
  const t=ctx.currentTime+.012+delay,[kind,type,target]=name.split(':');
  if(kind==='impact'){const panTo=target==='me'?ME:FOE;(impacts[type]??impacts.bludgeoning)(t,panTo,!!options.crit);duck(target==='me'?.5:.65,.18,.55);if(target==='me')thud(t+.02,ME,.25,80);return;}
  effects[name]?.(t,options);
 }catch{}
}
export function initializeAudio(){
 if(!web||typeof document==='undefined')return;
 const wake=()=>{const fresh=!ctx;if(!ensure())return;if(fresh){
  // iOS unlock: a silent buffer inside the first gesture.
  const s=ctx.createBufferSource();s.buffer=ctx.createBuffer(1,1,22050);s.connect(ctx.destination);s.start(0);
  if(mood&&moods[mood]&&!scheduler){applyMix();startScheduler(mood);}if(ambienceKind)ambience=startAmbience(ambienceKind);if(danger)setDanger(danger);}};
 document.addEventListener('pointerdown',event=>{wake();if(event.target?.closest?.('[role=button],[role=tab],[role=radio],[role=switch]'))playSound('click');},true);
 document.addEventListener('keydown',wake,true);
 document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden)ctx.suspend().catch(()=>{});else ctx.resume().catch(()=>{});});
}
export const audioReady=()=>!!ctx&&ctx.state==='running';
