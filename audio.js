// Questbound audio engine: a live-synthesized adaptive score, location ambience and layered effects, mixed like a game.
// The score is soft by design: string and choir pads, a bowed bass, felted keys and a flute or horn that sings
// composed phrases. Nothing in it is plucked, struck with sticks or ticked out.
// Signal flow:
//   music voices -> mood fader -> music bus -> duck -> narrator dip -> high-pass -> ┐   hall reverb returns into the music bus
//   ambience     -> ambience bus -> duck -> narrator dip --------> ├-> glue compressor -> limiter -> master -> speakers
//   effects      -> effects bus -------------------> ┘        room reverb returns into the effects bus
// Browsers only allow sound after the player interacts, so the engine wakes on the first tap or key press.
// The score is planned well ahead on the sound card's own clock (LOOKAHEAD), so a busy moment on the page (a scene
// loading, a painting decoding) never reaches the speakers; beats the page missed altogether are skipped, never
// played late in a clump. A change of scene crossfades one mood into the next with no silence between them.
const web=typeof window!=='undefined'&&typeof window.AudioContext!=='undefined';
const KEY='questbound.audio.v1';
// On a computer the music goes on while another window is in front (Settings, Sound); a phone falls silent.
const desktopLike=()=>{try{return !!window.matchMedia?.('(hover:hover) and (pointer:fine)').matches;}catch{return false;}};
const defaults={master:0.85,music:0.6,ambience:0.6,effects:1,muted:false,night:false,narrator:false,voice:null};
let settings=load(),ctx=null,listeners=new Set();
let out={};                         // master chain nodes
let mood=null,scheduler=null,ambience=null,ambienceKind=null,danger=0,heartbeat=null,pendingMood=null;
// Where the score's voices go while the scheduler plans them: each mood has its own fader (crossfades), and
// effects that borrow an instrument (a victory chord) go straight to the buses.
let score=null;
const route=kind=>score?.[kind]??out[kind];
const LOOKAHEAD=1.6,TICK_MS=250,WATCHDOG_MS=3000,HIDDEN_LIMIT=15*60000;
// How the sound has been doing on this device, for feedback notes (audioHealth).
const stats={skipped:0,late:0,moodChanges:0,rebuilds:0,states:0};
let pausedByUs=false,hiddenTimer=null;
// Voice budget: counts sounds that actually overlap in time. The score yields first so effects are never dropped.
const live=[],MUSIC_VOICES=96,ALL_VOICES=220;
function admit(t,end,bus,priority){
 const now=ctx.currentTime;for(let i=live.length-1;i>=0;i--)if(live[i].end<now)live.splice(i,1);
 const musical=bus===out.music||bus===out.pad||bus===out.amb||bus?.musical===true;let all=0,music=0;
 for(const v of live)if(v.start<end&&v.end>t){all++;if(v.musical)music++;}
 if(!priority&&(all>=ALL_VOICES||(musical&&music>=MUSIC_VOICES)))return false;
 live.push({start:t,end,musical});return true;
}
// Nothing starts in the past: a note planned for a moment already gone starts now instead (and is counted).
function startAt(t){const min=ctx.currentTime+.01;if(t<min){if(score)stats.late++;return min;}return t;}
// When a sound has finished, its nodes are let go at once instead of waiting for the garbage collector.
function freeWhenDone(sources,nodes){let left=sources.length;const done=()=>{if(--left>0)return;for(const n of [...sources,...nodes])try{n.disconnect();}catch{}};sources.forEach(s=>{s.onended=done;});}
const cache={noise:null};
function load(){try{const v=JSON.parse(window.localStorage.getItem(KEY));return {...defaults,background:desktopLike(),...(v&&typeof v==='object'?v:{})};}catch{return {...defaults,background:desktopLike()};}}
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
  // 'balanced' buffers ride out a busy computer far better than the smallest ('interactive') ones, at the cost of a
  // few hundredths of a second before an effect is heard.
  ctx=new window.AudioContext({latencyHint:'balanced'});
  const c=ctx;stats.baseLatency=c.baseLatency??null;stats.outputLatency=c.outputLatency??null;
  // A context the browser stopped by itself (a phone call, a headset unplugged) starts again as soon as it may.
  c.onstatechange=()=>{if(c!==ctx)return;stats.states++;if(!['running','closed'].includes(c.state)&&!document.hidden&&!pausedByUs)c.resume().catch(()=>{});};
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
  // Buses with sidechain-style ducking stages: one for hits and moments (duck), one for the narrator's voice
  // (narrating), so a blow landing while the narrator speaks does not end the narrator's dip early.
  o.music=g(0);o.musicDuck=g(1);o.musicVoice=g(1);o.amb=g(0);o.ambDuck=g(1);o.ambVoice=g(1);o.sfx=g(0);
  const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=32;hp.Q.value=.7;
  o.music.connect(o.musicDuck);o.musicDuck.connect(o.musicVoice);o.musicVoice.connect(hp);hp.connect(o.glue);
  o.amb.connect(o.ambDuck);o.ambDuck.connect(o.ambVoice);o.ambVoice.connect(o.glue);o.sfx.connect(o.glue);
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
 if(ctx.state==='suspended'||ctx.state==='interrupted'){pausedByUs=false;ctx.resume().catch(()=>{});}
 return true;
}
// Start everything that should be sounding (after waking, or after the context was rebuilt).
function restart(){
 if(mood&&moods[mood]&&!scheduler){applyMix();startScheduler(mood);}
 if(ambienceKind&&!ambience)ambience=startAmbience(ambienceKind);
 if(danger)setDanger(danger);
}
// A context that says it is running but whose clock has stopped (an output device changed under it) is replaced.
let watchedTime=null;
function watchdog(){
 if(!ctx||ctx.state!=='running'||document.hidden){watchedTime=null;return;}
 const t=ctx.currentTime;if(watchedTime!==null&&t===watchedTime){watchedTime=null;rebuild();return;}watchedTime=t;
}
function rebuild(){
 const old=ctx;stats.rebuilds++;
 if(scheduler)clearInterval(scheduler.timer);scheduler=null;
 ambience?.stop(true);ambience=null;if(heartbeat){clearInterval(heartbeat);heartbeat=null;}
 ctx=null;out={};live.length=0;cache.noise=null;
 try{old?.close?.().catch?.(()=>{});}catch{}
 if(ensure())restart();
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
function pan(node,value,nodes){if(!value)return node;const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,value));node.connect(p);nodes?.push(p);return p;}
// A voice: source -> optional filter -> envelope -> pan -> bus, with optional reverb send. Returns when it ends and
// the nodes it made (let go when the source ends).
function voice(src,t,{bus,peak=.2,attack=.005,hold=0,release=.3,send=0,reverb=null,filter=null,panTo=0}){
 const env=ctx.createGain(),nodes=[env];let node=src;
 if(filter){const f=ctx.createBiquadFilter();f.type=filter.type??'lowpass';f.frequency.setValueAtTime(filter.freq,t);if(filter.to)f.frequency.exponentialRampToValueAtTime(filter.to,t+(filter.time??attack+hold+release));f.Q.value=filter.q??.7;node.connect(f);node=f;nodes.push(f);}
 node.connect(env);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(peak,t+attack);env.gain.setValueAtTime(peak,t+attack+hold);env.gain.exponentialRampToValueAtTime(.0001,t+attack+hold+release);
 const last=pan(env,panTo,nodes);last.connect(bus);if(send&&reverb){const s=ctx.createGain();s.gain.value=send;last.connect(s);s.connect(reverb);nodes.push(s);}
 return {end:t+attack+hold+release+.05,nodes};
}
const span=(t,o)=>t+(o.attack??.005)+(o.hold??0)+(o.release??.3)+.05;
function osc(type,freq,t,opts){t=startAt(t);if(!admit(t,span(t,opts),opts.bus,opts.priority))return;const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);if(opts.glide)o.frequency.exponentialRampToValueAtTime(opts.glide,t+(opts.glideTime??opts.release??.3));if(opts.detune)o.detune.value=opts.detune;const {end,nodes}=voice(o,t,opts);freeWhenDone([o],nodes);o.start(t);o.stop(end);}
function noise(t,opts){t=startAt(t);if(!admit(t,span(t,opts),opts.bus,opts.priority))return;const s=ctx.createBufferSource();s.buffer=noiseBuffer();s.loop=true;const {end,nodes}=voice(s,t,opts);freeWhenDone([s],nodes);s.start(t,Math.random()*1.5);s.stop(end);}
// FM bell: a sine carrier modulated at an inharmonic ratio — celesta, chimes and magic.
function bell(freq,t,opts){t=startAt(t);if(!admit(t,span(t,opts),opts.bus,opts.priority))return;const car=ctx.createOscillator(),mod=ctx.createOscillator(),depth=ctx.createGain();car.frequency.value=freq;mod.frequency.value=freq*(opts.ratio??3.5);depth.gain.setValueAtTime(freq*(opts.index??2.2),t);depth.gain.exponentialRampToValueAtTime(freq*.05,t+(opts.release??1.5));mod.connect(depth);depth.connect(car.frequency);const {end,nodes}=voice(car,t,opts);freeWhenDone([car,mod],[depth,...nodes]);car.start(t);mod.start(t);car.stop(end);mod.stop(end);}
// Sidechain-style ducking: important moments pull the score and ambience down briefly.
// While the narrator speaks (narrator.js) the score and ambience step back, and return when it is done. The two
// work on separate gain stages, so neither cuts the other short.
export function narrating(on){if(!ctx)return;const t=ctx.currentTime;[out.musicVoice,out.ambVoice].forEach(n=>{n.gain.cancelScheduledValues(t);n.gain.setTargetAtTime(on?.4:1,t,.35);});}
function duck(depth=.5,hold=.25,release=.7){if(!ctx)return;const t=ctx.currentTime;[out.musicDuck,out.ambDuck].forEach(n=>{n.gain.cancelScheduledValues(t);n.gain.setTargetAtTime(depth,t,.02);n.gain.setTargetAtTime(1,t+hold,release/3);});}

// ---------- Instruments for the score ----------
// Every voice has a soft attack (a hundredth of a second or more), so nothing clicks: the score is pads, bowed and
// blown lines and felted keys, never plucks or sticks.
// A string section: each note is three detuned saws sharing one filter, one envelope and one place in the stereo
// field (a quarter of the nodes three separate voices would need). `attack` lets a chord re-enter part-way through.
function strings(notes,t,dur,level,attack=dur*.3){
 t=startAt(t);const bus=route('pad'),hold=Math.max(0,dur*.75-attack),end=t+attack+hold+1.85;
 notes.forEach((m,i)=>{
  if(!admit(t,end,bus,false))return;
  const f=ctx.createBiquadFilter(),env=ctx.createGain(),nodes=[f,env];f.type='lowpass';f.frequency.setValueAtTime(420,t);f.frequency.exponentialRampToValueAtTime(1150,t+dur*.5);f.Q.value=.5;
  const peak=level/notes.length/2.2;env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(peak,t+attack);env.gain.setValueAtTime(peak,t+attack+hold);env.gain.exponentialRampToValueAtTime(.0001,t+attack+hold+1.8);
  f.connect(env);pan(env,(i/(notes.length-1||1)-.5)*.8,nodes).connect(bus);
  const saws=[-7,0,7].map(cents=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(hz(m),t);o.detune.value=cents+(Math.random()-.5)*4;o.connect(f);return o;});
  freeWhenDone(saws,nodes);saws.forEach(o=>{o.start(t);o.stop(end);});
 });
}
// Formant choir: sawtooth voices through vowel resonances ("ah") — the big cinematic pad.
function choir(notes,t,dur,level){
 t=startAt(t);const bus=route('pad');
 notes.forEach((m,i)=>{if(!admit(t,t+dur+2,bus,false))return;const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=hz(m);o.detune.value=(Math.random()-.5)*10;const vib=ctx.createOscillator(),vd=ctx.createGain(),nodes=[vd];vib.frequency.value=4.6+Math.random()*.6;vd.gain.value=hz(m)*.004;vib.connect(vd);vd.connect(o.frequency);
  const sum=ctx.createGain();nodes.push(sum);[[750,6,1],[1150,7,.6],[2600,9,.25]].forEach(([f,q,g])=>{const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f;bp.Q.value=q;const gg=ctx.createGain();gg.gain.value=g;o.connect(bp);bp.connect(gg);gg.connect(sum);nodes.push(bp,gg);});
  const env=ctx.createGain();nodes.push(env);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(level/notes.length*2.2,t+dur*.35);env.gain.linearRampToValueAtTime(level/notes.length*1.6,t+dur*.85);env.gain.linearRampToValueAtTime(0,t+dur+1.8);
  sum.connect(env);pan(env,(i/(notes.length-1||1)-.5)*.6,nodes).connect(bus);freeWhenDone([o,vib],nodes);o.start(t);vib.start(t);o.stop(t+dur+2);vib.stop(t+dur+2);});
}
// Felted keys: a sine with two quiet upper partials, eased in and left to ring. The broken chords and inner lines.
// The partials share one place in the stereo field.
function keys(m,t,level,panTo=0,ring=2.6){
 t=startAt(t);const f=hz(m),bus=route('music'),hall=route('hall');
 let place=bus,shared=[];if(panTo){const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,panTo));p.connect(bus);place=p;shared=[p];}
 let sounding=0;const partialDone=()=>{if(--sounding<=0)shared.forEach(n=>{try{n.disconnect();}catch{}});};
 const partial=(type,freq,opts)=>{if(!admit(t,span(t,opts),bus,false))return;const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,t);const v=voice(o,t,{...opts,bus:place,panTo:0});sounding++;o.onended=()=>{for(const n of [o,...v.nodes])try{n.disconnect();}catch{}partialDone();};o.start(t);o.stop(v.end);};
 partial('sine',f,{peak:level,attack:.022,hold:.03,release:ring,send:.5,reverb:hall});
 partial('triangle',f*2,{peak:level*.16,attack:.024,release:ring*.45,filter:{freq:1800,to:700,time:ring*.4},send:.4,reverb:hall});
 partial('sine',f*3.005,{peak:level*.035,attack:.022,release:ring*.22});
 if(!sounding){sounding=1;partialDone();}
}
// A held, singing line: a blown tone (flute) or a bowed or brass one (cello, horn), with a breath of vibrato that
// arrives after the note has started. shape: [wave, lowpass, attack, release, breath].
const lines={flute:['sine',2600,.08,.4,.025],cello:['sawtooth',520,.13,.7,0],horn:['sawtooth',880,.07,.5,0]};
function line(kind,m,t,dur,level,panTo=0){
 t=startAt(t);const [wave,cutoff,attack,release,breath]=lines[kind],end=t+dur+release+.05,bus=route('music'),hall=route('hall');
 if(!admit(t,end,bus,false))return;
 const f=hz(m),a=ctx.createOscillator(),b=ctx.createOscillator(),lp=ctx.createBiquadFilter(),env=ctx.createGain(),vib=ctx.createOscillator(),depth=ctx.createGain();
 a.type=wave;b.type=kind==='flute'?'triangle':wave;a.frequency.value=f;b.frequency.value=f;b.detune.value=kind==='flute'?0:6;a.detune.value=kind==='flute'?0:-6;
 vib.frequency.value=4.8+Math.random()*.7;depth.gain.setValueAtTime(0,t);depth.gain.linearRampToValueAtTime(f*(kind==='flute'?.006:.004),t+Math.min(.6,dur*.7));vib.connect(depth);depth.connect(a.frequency);depth.connect(b.frequency);
 lp.type='lowpass';lp.Q.value=.6;lp.frequency.setValueAtTime(cutoff*.55,t);lp.frequency.linearRampToValueAtTime(cutoff,t+attack*2);
 const mix=ctx.createGain();mix.gain.value=kind==='flute'?.3:.5;a.connect(lp);b.connect(mix);mix.connect(lp);lp.connect(env);
 env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(level,t+attack);env.gain.linearRampToValueAtTime(level*.82,t+Math.max(attack+.01,dur));env.gain.linearRampToValueAtTime(0,t+dur+release);
 const nodes=[depth,lp,mix,env],last=pan(env,panTo,nodes);last.connect(bus);const send=ctx.createGain();send.gain.value=.5;last.connect(send);send.connect(hall);nodes.push(send);
 freeWhenDone([a,b,vib],nodes);a.start(t);b.start(t);vib.start(t);a.stop(end);b.stop(end);vib.stop(end);
 if(breath)noise(t,{bus,peak:level*breath,attack:attack,hold:Math.max(0,dur-attack),release:release,filter:{type:'bandpass',freq:Math.min(2800,f*1.5),q:1.4},panTo});
}
// A short bowed note for the battle pulse: eased in over a fiftieth of a second, gone in a fifth.
function bow(m,t,level,panTo=0){[-5,5].forEach(c=>osc('sawtooth',hz(m),t,{bus:route('music'),peak:level/2,attack:.02,hold:.03,release:.2,detune:c,filter:{freq:900,to:380,time:.2,q:.7},panTo}));}
// A deep drum, felt more than struck: its skin is eased in over a hundredth of a second.
function taiko(t,strength=1,panTo=0){const p=vary(1,.03);osc('sine',82*p,t,{bus:route('music'),peak:.5*strength,attack:.012,release:.6,glide:44*p,glideTime:.4,send:.25,reverb:route('hall'),panTo,priority:true});noise(t,{bus:route('music'),peak:.1*strength,attack:.012,release:.2,filter:{freq:520,to:160,time:.2},send:.2,reverb:route('hall'),panTo});}
function brassStab(notes,t,level=.12,len=.5){notes.forEach((m,i)=>[-6,6].forEach(c=>osc('sawtooth',hz(m),t,{bus:route('music'),peak:level/notes.length,attack:.03,hold:len*.4,release:len,detune:c,filter:{freq:500,to:2600,time:.08,q:1},send:.35,reverb:route('hall'),panTo:(i-notes.length/2)*.15})));}
function swell(t,dur,level=.12){noise(t,{bus:route('music'),peak:level,attack:dur,release:.25,filter:{type:'highpass',freq:3000,to:9000,time:dur},send:.4,reverb:route('hall')});}

// ---------- Adaptive score ----------
// Each mood is a slow chord progression (voicings chosen for smooth voice leading), a key, and layers on a shared
// beat grid: a string pad, a bowed bass, felted keys breaking each chord in a fixed figure, and a lead that sings
// written phrases. Phrases are composed when a mood starts (stepwise lines in the key that land on chord tones)
// and come round again (A A B A), so the music has a tune rather than notes at random.
const minor=[0,2,3,5,7,8,10],major=[0,2,4,5,7,9,11],inKey=(root,shape)=>shape.map(s=>(root+s)%12);
const moods={
 menu:{bpm:60,beatsPerChord:8,scale:inKey(2,minor),chords:[[50,57,62,65],[46,53,58,62],[53,57,60,65],[48,55,60,64],[43,50,58,62],[45,52,57,61]],
  layers:{strings:.06,choir:.07,bass:.11,arp:{level:.085,step:1,figure:[0,1,2,3,4,3,2,1],octave:0},lead:{voice:'flute',level:.085,low:69,high:86,every:2},bells:true}},
 explore:{bpm:72,beatsPerChord:8,scale:inKey(9,minor),chords:[[45,52,57,60],[41,48,53,57],[48,52,55,60],[43,50,55,59]],
  layers:{strings:.055,bass:.1,arp:{level:.075,step:1,figure:[0,2,1,2,3,2,1,2],octave:0},lead:{voice:'flute',level:.095,low:69,high:88,every:1}}},
 // Shelter (camp, inn, after a fight): a warm major-key hearth theme.
 haven:{bpm:64,beatsPerChord:8,scale:inKey(2,major),chords:[[50,57,62,66],[47,54,59,62],[43,50,55,59],[45,52,57,61]],
  layers:{strings:.05,bass:.09,arp:{level:.09,step:1,figure:[0,1,2,4,3,2,1,2],octave:0},lead:{voice:'flute',level:.08,low:62,high:81,every:2},bells:true}},
 combat:{bpm:108,beatsPerChord:8,scale:inKey(2,minor),chords:[[38,45,50,53],[34,41,46,50],[31,38,43,46],[33,40,45,49]],
  layers:{strings:.05,choir:.045,bass:.13,pulse:.07,taiko:true,lead:{voice:'horn',level:.085,low:50,high:69,every:1}}},
};
// The notes of a key that fit this chord: where the chord has a note outside the key (a major dominant in a minor
// key), its neighbours give way to it.
function chordScale(scale,chord){const tones=chord.map(m=>m%12),out=new Set(scale);for(const pc of tones)if(!out.has(pc)){out.delete((pc+1)%12);out.delete((pc+11)%12);out.add(pc);}return out;}
// Rhythms for a four-bar phrase: [start beat, length in beats]. Each leaves the last bar to breathe.
const phraseRhythms=[
 [[0,2],[2,1],[3,1],[4,3.5],[8,1.5],[9.5,.5],[10,2],[12,3]],
 [[0,3],[3,1],[4,2],[6,2],[8,3],[11,1],[12,3]],
 [[1,1],[2,2],[4,1],[5,1],[6,2],[9,1],[10,1],[11,1],[12,3]],
 [[0,1.5],[1.5,.5],[2,2],[4,4],[10,1],[11,1],[12,3]],
 [[0,4],[4,2],[6,1],[7,1],[8,4],[12,3]],
];
// A phrase is a contour: steps up and down the scale from a starting height (0..1 of the lead's range).
function composePhrase(){
 const rhythm=phraseRhythms[Math.floor(Math.random()*phraseRhythms.length)],steps=[];let lean=Math.random()<.5?1:-1;
 for(let i=0;i<rhythm.length;i++){const r=Math.random();steps.push(i===0?0:(r<.5?lean:r<.72?-lean:r<.86?2*lean:r<.94?0:-2*lean));if(Math.random()<.3)lean=-lean;}
 return {rhythm,steps,start:.35+Math.random()*.3};
}
// The scheduler plans LOOKAHEAD seconds of music ahead on the sound card's clock, every TICK_MS. When the page was
// too busy to plan in time (a long stall), the beats already gone are skipped silently (the tune keeps its place)
// and the string bed and bass come back in under the next beat, so the music never stops or bunches up.
// Each mood has its own faders (moodIn, padIn, hallIn) so one mood fades out while the next fades in.
function startScheduler(name,from,{intro=false}={}){
 const m=moods[name],begin=from??ctx.currentTime+.15;let beat=0,next=begin,reenter=false;const spb=60/m.bpm,L=m.layers,bpc=m.beatsPerChord,phraseBeats=16;
 const fader=to=>{const g=ctx.createGain();g.musical=true;g.gain.value=0;g.gain.setValueAtTime(0,begin);g.gain.linearRampToValueAtTime(1,begin+1.2);g.connect(to);return g;};
 const handle={name,timer:null,moodIn:fader(out.music),padIn:fader(out.pad),hallIn:fader(out.hall)};
 // The tune: A A B A, with a new B (and now and then a new A) each time round.
 const tune={A:composePhrase(),B:composePhrase(),count:0,height:0,notes:[]};
 // One beat at `time`. audible=false only moves the tune along (a beat the page missed).
 const step=(time,audible)=>{
  const i=Math.floor(beat/bpc)%m.chords.length,chord=m.chords[i],inChord=beat%bpc,dur=spb*bpc;
  if(audible&&inChord===0){
   if(L.strings)strings(chord,time,dur,L.strings);
   if(L.choir&&i%2===0)choir(chord.slice(1),time,dur*2,L.choir);
   if(L.bass){let low=chord[0];while(low>=45)low-=12;if(low<33)low+=12;line('cello',low,time,dur*.9,L.bass);}
  }
  else if(audible&&reenter){
   // Back after a skip, part-way through a chord: the bed and the bass take up the rest of it.
   const left=(bpc-inChord)*spb;
   if(L.strings&&left>.8)strings(chord,time,left,L.strings,.4);
   if(L.choir){const choirLeft=(i%2===0?bpc:0)*spb+left;if(choirLeft>2)choir(chord.slice(1),time,choirLeft,L.choir*.8);}
   if(L.bass&&left>.8){let low=chord[0];while(low>=45)low-=12;if(low<33)low+=12;line('cello',low,time,left*.9,L.bass);}
  }
  if(audible)reenter=false;
  // Felted keys break the chord in one steady figure.
  if(audible&&L.arp){const tones=[chord[1],chord[2],chord[3],chord[1]+12,chord[2]+12],per=Math.round(1/L.arp.step);
   for(let k=0;k<per;k++){const at=Math.round(beat/L.arp.step)+k,tone=tones[L.arp.figure[at%L.arp.figure.length]]+L.arp.octave,accent=at%L.arp.figure.length===0?1:at%2?.62:.8;keys(tone,human(time+k*L.arp.step*spb),L.arp.level*accent,((at%5)-2)*.16);}}
  // The lead sings its phrase, then rests a phrase when the mood asks for room.
  if(L.lead){
   const inPhrase=beat%phraseBeats;
   if(inPhrase===0){
    const round=tune.count++,slot=round%4;
    if(slot===0&&round>0&&Math.random()<.35)tune.A=composePhrase();if(slot===2)tune.B=composePhrase();
    const phrase=slot===2?tune.B:tune.A,singing=round%L.lead.every===0;
    tune.notes=[];
    if(singing){
     // Lay the contour over the key: strong notes are pulled to the chord sounding under them, the last to its root or fifth.
     const ladder=[];for(let p=L.lead.low;p<=L.lead.high;p++)ladder.push(p);
     let rung=Math.round(phrase.start*(ladder.length-1)),turn=1;
     phrase.rhythm.forEach(([start,length],n)=>{
      const under=m.chords[Math.floor((beat+start)/bpc)%m.chords.length],allowed=chordScale(m.scale,under),tones=new Set(under.map(x=>x%12)),final=n===phrase.rhythm.length-1;
      // Near the top or bottom of its range the line turns back.
      let want=rung+phrase.steps[n]*2*turn;if(want<0||want>=ladder.length){turn=-turn;want=rung+phrase.steps[n]*2*turn;}
      const strong=start%2===0||final,fits=p=>final?[under[0]%12,under[1]%12].includes(p%12):strong?tones.has(p%12):allowed.has(p%12);
      const moving=phrase.steps[n]!==0;let best=null;for(let d=0;d<ladder.length&&best===null;d++)for(const q of [want+d,want-d])if(q>=0&&q<ladder.length&&!(moving&&q===rung)&&fits(ladder[q])){best=q;break;}
      rung=best??Math.max(0,Math.min(ladder.length-1,want));
      tune.notes.push({start,length,pitch:ladder[rung]});
     });
    }
   }
   if(audible)for(const note of tune.notes)if(note.start>=inPhrase&&note.start<inPhrase+1)line(L.lead.voice,note.pitch,human(time+(note.start-inPhrase)*spb),note.length*spb*.92,L.lead.level,L.lead.voice==='horn'?-.15:.18);
  }
  if(!audible)return;
  // Into a fight: the first beat lands with a deep drum and a brass call (inside this mood's fader).
  if(intro&&beat===0){taiko(time,1.2);brassStab([50,57,62],time,.12,.8);}
  if(L.bells&&beat%32===16)bell(hz(chord[2]+24),human(time),{bus:route('music'),peak:.02,attack:.05,release:3.2,send:.7,reverb:route('hall'),ratio:3.5,index:1.1,panTo:.3});
  // Battle: low drums on the strong beats and a bowed pulse in quavers underneath (root, root, fifth, root…).
  if(L.taiko){const b=beat%8;if(b===0)taiko(time,1,-.1);if(b===4)taiko(time,.75,.1);if(b===3||b===7)taiko(time+spb/2,.5,.15);if(beat%32===31)for(let k=0;k<3;k++)taiko(time+k*spb/3,.45+k*.15,(k%2?.2:-.2));if(beat%32===28)swell(time,spb*4,.06);}
  if(L.pulse){const root=chord[0]+12;[[0,1],[7,.55]].forEach(([interval,accent],k)=>bow(root+(beat%4===3&&k?5:interval),human(time+k*spb/2),L.pulse*(beat%4===0&&!k?1.25:accent),k?.12:-.12));}
 };
 const tick=()=>{
  if(!ctx||scheduler!==handle)return;
  const now=ctx.currentTime;
  score={music:handle.moodIn,pad:handle.padIn,hall:handle.hallIn};
  try{
   if(next<now+.05){const missed=Math.ceil((now+.05-next)/spb);for(let k=0;k<missed;k++){step(next,false);beat++;next+=spb;}stats.skipped+=missed;reenter=true;}
   while(next<now+LOOKAHEAD){step(next,true);beat++;next+=spb;}
  }finally{score=null;}
 };
 handle.tick=tick;scheduler=handle;tick();handle.timer=setInterval(tick,TICK_MS);return handle;
}
// Hold a fading parameter where it is now, then let it go: the next ramp starts from what is sounding.
function hold(param,t){if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);else{const v=param.value;param.cancelScheduledValues(t);param.setValueAtTime(v,t);}}
// An old mood fades out over a few seconds under the new one; its faders are let go once it is silent.
function retire(handle,t){
 clearInterval(handle.timer);
 const faders=[handle.moodIn,handle.padIn,handle.hallIn];
 faders.forEach(g=>{hold(g.gain,t);g.gain.setTargetAtTime(0,t,.6);});
 setTimeout(()=>faders.forEach(g=>{try{g.disconnect();}catch{}}),25000);
}
// A new mood: the old one fades while the new one starts at once (a fight after a rising swell, on its first drum).
// The music bus itself is left alone (only the volume setting moves it). Wandering between the road and a shelter
// waits a moment first, so a quick step out and back does not change the music at all.
export function setMood(name){
 if(pendingMood){clearTimeout(pendingMood.timer);pendingMood=null;}
 if(name===mood)return;
 const calm=m=>m==='explore'||m==='haven';
 if(ctx&&scheduler&&calm(name)&&calm(mood)){pendingMood={name,timer:setTimeout(()=>{pendingMood=null;changeMood(name);},2500)};return;}
 changeMood(name);
}
function changeMood(name){
 if(name===mood)return;const from=mood;mood=name;stats.moodChanges++;
 if(!ctx)return;
 const t=ctx.currentTime,old=scheduler;scheduler=null;
 if(old)retire(old,t);
 if(!moods[name])return;
 // Into combat: a rising swell, then the new score enters on a downbeat hit.
 if(name==='combat'&&from){swell(t,1.1,.12);startScheduler(name,t+1.1,{intro:true});}
 else startScheduler(name,t+.15);
}

// ---------- Ambience ----------
// Beds are looping filtered noise with slow movement; details (crackles, drips, gusts, birds) are scheduled at random.
const beds={
 menu:{wind:.08,hearth:.05},hearth:{hearth:.12,room:.05},wild:{wind:.14,birds:true},cave:{cave:.1,drips:true},battle:{wind:.1},
};
function startAmbience(kind){
 const spec=beds[kind];if(!spec)return null;const nodes=[],timers=[],t=ctx.currentTime;
 const bed=(level,filter,lfoRate,panTo)=>{const s=ctx.createBufferSource();s.buffer=noiseBuffer();s.loop=true;const f=ctx.createBiquadFilter();f.type=filter.type;f.frequency.value=filter.freq;f.Q.value=filter.q??.7;const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+3);
  const sources=[s],parts=[f,g];if(lfoRate){const l=ctx.createOscillator(),d=ctx.createGain();l.frequency.value=lfoRate;d.gain.value=filter.freq*.45;l.connect(d);d.connect(f.frequency);l.start();nodes.push(l);sources.push(l);parts.push(d);}
  s.connect(f);f.connect(g);pan(g,panTo,parts).connect(out.amb);freeWhenDone(sources,parts);s.start(t,Math.random());nodes.push(s);return g;};
 const gains=[];
 if(spec.wind){gains.push(bed(spec.wind,{type:'bandpass',freq:420,q:.6},.07,-.4));gains.push(bed(spec.wind*.7,{type:'bandpass',freq:700,q:.8},.05,.4));}
 if(spec.hearth){gains.push(bed(spec.hearth*.6,{type:'lowpass',freq:300},.11,0));gains.push(bed(spec.hearth*.2,{type:'bandpass',freq:520,q:.8},.07,.2));
  // A log settles now and then: one soft, low pop, a few seconds apart.
  timers.push(setInterval(()=>{if(!ctx||Math.random()<.55)return;const at=ctx.currentTime+Math.random()*.6;noise(at,{bus:out.amb,peak:vary(spec.hearth*.35,.4),attack:.006,release:.09,filter:{type:'bandpass',freq:vary(1100,.35),q:1.2},panTo:(Math.random()-.5)*.4});},1700));}
 if(spec.room)gains.push(bed(spec.room,{type:'lowpass',freq:180},0,0));
 if(spec.cave){gains.push(bed(spec.cave,{type:'lowpass',freq:140},.03,0));}
 if(spec.drips)timers.push(setInterval(()=>{if(!ctx||Math.random()<.4)return;const f=vary(1800,.35);osc('sine',f,ctx.currentTime,{bus:out.amb,peak:.05,attack:.001,release:.12,glide:f*.55,send:.8,reverb:out.cave,panTo:(Math.random()-.5)*1.4});},1100));
 if(spec.birds)timers.push(setInterval(()=>{if(!ctx||Math.random()<.65)return;const at=ctx.currentTime,base=vary(3200,.2),p=(Math.random()-.5)*1.4;for(let k=0,n=2+Math.floor(Math.random()*4);k<n;k++)osc('sine',base,at+k*.11,{bus:out.amb,peak:.018,attack:.01,release:.07,glide:base*vary(1.35,.1),glideTime:.06,panTo:p});},2600));
 // stop(true): the context is being replaced, so only the timers need stopping.
 return {kind,stop(atOnce=false){timers.forEach(clearInterval);if(atOnce||!ctx)return;const now=ctx.currentTime;gains.forEach(g=>{g.gain.cancelScheduledValues(now);g.gain.setTargetAtTime(0,now,.8);});setTimeout(()=>nodes.forEach(n=>{try{n.stop();}catch{}}),4000);}};
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
 // A press: a soft, low tap (a finger on wood), not a click.
 click:t=>{osc('sine',vary(430,.03),t,{bus:out.sfx,peak:.032,attack:.005,release:.09,glide:300,glideTime:.08});noise(t,{bus:out.sfx,peak:.012,attack:.006,release:.05,filter:{freq:900}});},
 // Sending a turn: a breath of air and one soft note.
 send:t=>{noise(t,{bus:out.sfx,peak:.035,attack:.09,release:.22,filter:{type:'bandpass',freq:900,to:2600,time:.28,q:.8}});osc('sine',hz(81),t+.12,{bus:out.sfx,peak:.03,attack:.015,release:.9,send:.5,reverb:out.room});},
 // A die on felt: a few soft, low knocks that slow as it settles (in step with the tumbling die in the feed).
 dice:t=>{let at=t,level=.11;for(let i=0;i<5;i++){osc('sine',vary(240,.12),at,{bus:out.sfx,peak:level,attack:.004,release:.06,glide:150,glideTime:.05,panTo:(Math.random()-.5)*.4});noise(at,{bus:out.sfx,peak:level*.3,attack:.004,release:.04,filter:{type:'bandpass',freq:vary(1300,.2),q:1.5},panTo:(Math.random()-.5)*.4});at+=.07+i*i*.014;level*=.78;}},
 swing:t=>whoosh(t,ME,.14,true),
 miss:t=>{whoosh(t,FOE,.16);noise(t+.12,{bus:out.sfx,peak:.05,attack:.005,release:.1,filter:{freq:500},panTo:FOE});},
 hit:t=>{impacts.slashing(t,FOE,false);duck(.65,.15,.5);},
 crit:t=>{whoosh(t,ME,.18,true);brassStab([62,69,74],t+.05,.12,.4);[1320,1760,2217].forEach((f,i)=>bell(f,t+.08+i*.05,{bus:out.sfx,peak:.035,release:1,ratio:3.5,index:1,send:.5,reverb:out.room}));duck(.5,.3,.7);},
 hurt:t=>{thud(t,ME,.55,95);osc('sawtooth',110,t,{bus:out.sfx,peak:.08,attack:.002,release:.3,glide:55,filter:{freq:500},panTo:ME});duck(.55,.2,.6);},
 heal:t=>{[76,83,88,95,100].forEach((m,i)=>bell(hz(m),t+i*.08,{bus:out.sfx,peak:.03,attack:.01,release:1.4,ratio:2,index:.8,send:.7,reverb:out.room,panTo:(i-2)*.12}));noise(t,{bus:out.sfx,peak:.04,attack:.3,release:.8,filter:{type:'highpass',freq:7000}});},
 fall:t=>{thud(t,FOE,.5,90);noise(t+.12,{bus:out.sfx,peak:.1,attack:.002,release:.25,filter:{type:'bandpass',freq:2600,q:1.5},panTo:FOE});duck(.7,.2,.5);},
 victory:t=>{duck(.3,1.6,1.2);swell(t,.6,.1);[62,66,69,74].forEach((m,i)=>brassStab([m],t+.55+i*.14,.26,.25));brassStab([62,66,69,74],t+1.15,.3,1.8);choir([62,66,69,74],t+1.15,2.2,.15);taiko(t+1.15,1.3);[2349,2960].forEach((f,i)=>bell(f,t+1.2+i*.1,{bus:out.sfx,peak:.03,release:2,ratio:3.5,index:1,send:.7,reverb:out.room}));},
 // Falling: a body hits the ground and the world goes muffled and far away.
 down:t=>{thud(t,ME,.6,70);duck(.15,2.5,2);osc('sine',hz(33),t+.2,{bus:out.sfx,peak:.3,attack:.4,hold:.6,release:2.4,send:.5,reverb:out.room,priority:true});noise(t+.2,{bus:out.sfx,peak:.05,attack:.6,release:2,filter:{type:'lowpass',freq:400,to:120,time:2}});},
 // Death: three slow tolls of a deep bell under a falling choir.
 death:t=>{duck(.05,6,3);[0,1.6,3.2].forEach(d=>bell(hz(33),t+d,{bus:out.sfx,peak:.14,release:4,ratio:1.4,index:3,send:.7,reverb:out.room,priority:true}));choir([45,48,52],t+.4,4,.1);osc('sine',41,t,{bus:out.sfx,peak:.35,attack:.6,hold:2,release:4,send:.5,reverb:out.room,priority:true});},
 defeat:t=>{duck(.3,2,1.5);[57,53,50,45].forEach((m,i)=>osc('sawtooth',hz(m),t+i*.5,{bus:out.sfx,peak:.05,attack:.1,hold:.4,release:.8,filter:{freq:700},send:.4,reverb:out.room}));osc('sine',55,t+2,{bus:out.sfx,peak:.4,attack:.002,release:3,send:.5,reverb:out.room,priority:true});bell(110,t+2,{bus:out.sfx,peak:.08,release:3.5,ratio:1.4,index:4,send:.6,reverb:out.room});},
 chime:t=>{bell(hz(86),t,{bus:out.sfx,peak:.03,attack:.004,release:1.4,ratio:3.5,index:1,send:.6,reverb:out.room});bell(hz(93),t+.12,{bus:out.sfx,peak:.022,attack:.004,release:1.6,ratio:3.5,index:1,send:.6,reverb:out.room});},
 voice:(t,o)=>{const base=o?.speaker==='mara'?88:81;bell(hz(base),t,{bus:out.sfx,peak:.022,attack:.004,release:1,ratio:3.01,index:.7,send:.5,reverb:out.room,panTo:o?.speaker==='mara'?.25:-.25});},
 whoosh:t=>{noise(t,{bus:out.sfx,peak:.14,attack:.25,release:.45,filter:{freq:300,to:3600,time:.6,q:.8},send:.35,reverb:out.room});osc('sine',48,t,{bus:out.sfx,peak:.12,attack:.3,release:.5});},
 page:t=>{noise(t,{bus:out.sfx,peak:.04,attack:.05,release:.16,filter:{type:'bandpass',freq:1400,to:2600,time:.2,q:.7}});},
 boot:t=>{duck(.2,2.5,2);osc('sine',38,t,{bus:out.sfx,peak:.55,attack:.01,release:3.2,glide:30,glideTime:2.5,priority:true});noise(t,{bus:out.sfx,peak:.14,attack:1.4,release:.6,filter:{freq:200,to:6000,time:1.8,q:.7},send:.5,reverb:out.room});choir([50,57,62,66,69],t+1.4,3,.12);strings([38,50,57,62],t+1.4,3,.1);[1175,1480,1760,2349].forEach((f,i)=>bell(f,t+1.5+i*.12,{bus:out.sfx,peak:.03,release:2.5,ratio:3.5,index:1,send:.7,reverb:out.room,panTo:(i-1.5)*.25}));taiko(t+1.4,1.3);},
 // Interface: a faint tick when the pointer finds a menu entry, a soft lift when a sheet opens, a plucked note on a choice.
 tick:t=>{osc('sine',vary(880,.02),t,{bus:out.sfx,peak:.007,attack:.008,release:.05});},
 open:t=>{noise(t,{bus:out.sfx,peak:.05,attack:.08,release:.22,filter:{type:'bandpass',freq:500,to:2400,time:.25,q:.9}});bell(hz(81),t+.08,{bus:out.sfx,peak:.016,release:.9,ratio:3.5,index:.8,send:.5,reverb:out.room});},
 select:t=>{[[74,0,.05],[81,.08,.035]].forEach(([m,d,v])=>osc('sine',hz(m),t+d,{bus:out.sfx,peak:v,attack:.012,release:.7,send:.45,reverb:out.room}));},
 // Arriving somewhere: a low swell under two soft, open bells, as the place's name appears.
 arrive:t=>{swell(t,.9,.06);osc('sine',hz(38),t,{bus:out.sfx,peak:.14,attack:.4,hold:.4,release:1.6,send:.4,reverb:out.room});[74,81].forEach((m,i)=>bell(hz(m),t+.35+i*.22,{bus:out.sfx,peak:.026,attack:.01,release:2.2,ratio:3.5,index:.8,send:.7,reverb:out.room,panTo:i?.2:-.2}));},
 // A new round: one deep drum and a short brass call.
 round:t=>{taiko(t,1.1);brassStab([50,57,62],t+.02,.1,.45);},
 // Level up: a rising bell run into a brass and choir chord.
 levelup:t=>{duck(.35,1.4,1.2);[62,66,69,74,78,81].forEach((m,i)=>bell(hz(m+12),t+i*.07,{bus:out.sfx,peak:.035,release:1.4,ratio:3.5,index:1,send:.6,reverb:out.room,panTo:(i-2.5)*.14}));brassStab([62,66,69,74],t+.5,.24,1.4);choir([62,66,69,74],t+.5,2,.14);swell(t,.5,.08);},
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
  restart();}};
 document.addEventListener('pointerdown',event=>{wake();if(event.target?.closest?.('[role=button],[role=tab],[role=radio],[role=switch]'))playSound('click');},true);
 document.addEventListener('keydown',wake,true);
 // A hidden page (another tab, a minimised window, or on Windows a window wholly covered by another): with
 // "Keep playing in the background" the music goes on (for up to a quarter of an hour), otherwise it fades and
 // the sound pauses until the player comes back.
 const pause=()=>{if(!ctx||!document.hidden)return;pausedByUs=true;out.master.gain.cancelScheduledValues(ctx.currentTime);out.master.gain.setTargetAtTime(0,ctx.currentTime,.06);setTimeout(()=>{if(pausedByUs&&ctx&&document.hidden)ctx.suspend().catch(()=>{});},250);};
 document.addEventListener('visibilitychange',()=>{
  if(!ctx)return;clearTimeout(hiddenTimer);
  if(document.hidden){if(settings.background)hiddenTimer=setTimeout(pause,HIDDEN_LIMIT);else pause();return;}
  if(pausedByUs||ctx.state!=='running'){pausedByUs=false;ctx.resume().catch(()=>{});}
  applyMix();
 });
 setInterval(watchdog,WATCHDOG_MS);
}
export const audioReady=()=>!!ctx&&ctx.state==='running';
// How the sound is doing on this device, sent with a feedback note so the host can see why music stopped.
export function audioHealth(){
 return {state:ctx?ctx.state:'not started',baseLatency:stats.baseLatency??null,outputLatency:stats.outputLatency??null,skipped:stats.skipped,late:stats.late,moodChanges:stats.moodChanges,rebuilds:stats.rebuilds,states:stats.states,
  background:!!settings.background,muted:!!settings.muted,music:settings.music,narrator:!!settings.narrator,mood,voicesLive:live.length};
}
