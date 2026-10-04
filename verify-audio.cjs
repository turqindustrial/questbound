const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// A strict stand-in for Web Audio: it rejects the calls real browsers reject (zero exponential targets,
// non-finite times, bad pans, stopping before starting) and counts the nodes each sound builds. Its clock (`now`)
// moves only when the check moves it, so stalls, crossfades and the scheduler's lookahead can be replayed exactly.
const problems=[];let nodes=0,now=0,lastOptions=null,suspends=0,resumes=0;
const starts=[],sources=[],attacks=[];
const bad=(msg)=>{problems.push(msg);};
const finite=(v,what)=>{if(!Number.isFinite(v))bad(what+' is not finite: '+v);};
function param(value=0,name='param'){const p={value,name,targets:[],zeroAt:null,
 setValueAtTime(v,t){finite(v,name+' value');finite(t,name+' time');p.zeroAt=v===0?t:null;},
 linearRampToValueAtTime(v,t){finite(v,name+' ramp');finite(t,name+' ramp time');if(name==='gain'&&p.zeroAt!==null&&v>0)attacks.push(t-p.zeroAt);p.zeroAt=null;},
 exponentialRampToValueAtTime(v,t){finite(t,name+' exp time');if(!(v>0))bad(name+' exponential ramp to '+v);},
 setTargetAtTime(v,t,tc){finite(v,name+' target');finite(t,name+' target time');if(!(tc>0))bad(name+' time constant '+tc);p.targets.push({v,t});},cancelScheduledValues(){},};return p;}
function node(extra={}){nodes++;const n={outs:[],disconnected:0,connect(target){if(!target)bad('connect to nothing');n.outs.push(target);return target;},disconnect(){n.disconnected++;},...extra};return n;}
function source(kind){let started=null;const s=node({[kind==='osc'?'frequency':'playbackRate']:param(kind==='osc'?440:1,kind),detune:param(0,'detune'),loop:false,buffer:null,type:'sine',onended:null,
 start(t=0,offset=0){finite(t,'start');finite(offset,'offset');started=t;starts.push({t,at:now,source:s});},stop(t){if(t===undefined)return;/* no time = stop now, as in browsers */finite(t,'stop');if(started!==null&&t<started)bad('stop before start');}});sources.push(s);return s;}
class FakeContext{
 constructor(options){lastOptions=options;this.sampleRate=48000;this.state='running';this.destination=node();this.baseLatency=.01;this.outputLatency=.03;}
 get currentTime(){return now;}
 resume(){resumes++;this.state='running';return Promise.resolve();}suspend(){suspends++;this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
 createGain(){return node({gain:param(1,'gain')});}
 createOscillator(){return source('osc');}
 createBufferSource(){return source('buffer');}
 createBiquadFilter(){return node({type:'lowpass',frequency:param(350,'filter'),Q:param(1,'Q')});}
 createStereoPanner(){const p=param(0,'pan');return node({pan:new Proxy(p,{set(obj,key,v){if(key==='value'&&(v<-1||v>1||!Number.isFinite(v)))bad('pan '+v);obj[key]=v;return true;}})});}
 createConvolver(){return node({buffer:null});}
 createDynamicsCompressor(){return node({threshold:param(-24,'threshold'),knee:param(30,'knee'),ratio:param(12,'ratio'),attack:param(.003,'attack'),release:param(.25,'release')});}
 createWaveShaper(){return node({curve:null,oversample:'none'});}
 createDelay(){return node({delayTime:param(0,'delay')});}
 createChannelMerger(){return node();}
 createBuffer(ch,len,sr){if(!(len>0)||!Number.isInteger(len))bad('buffer length '+len);const data=Array.from({length:ch},()=>new Float32Array(len));return {numberOfChannels:ch,length:len,sampleRate:sr,getChannelData:c=>data[c]};}
}
const listeners={},store={};let watchdog=null;
const fire=(type,event={target:{closest:()=>null}})=>(listeners[type]??[]).forEach(fn=>fn(event));
const doc={addEventListener:(t,fn)=>(listeners[t]??=[]).push(fn),hidden:false};
// The three-second watchdog is kept by the check and run by hand, so the frozen test clock does not trip it.
const timerSet=(fn,ms)=>{if(ms===3000){watchdog=fn;return 0;}return setInterval(fn,ms);};
const context={window:{AudioContext:FakeContext,matchMedia:q=>({matches:q.includes('hover:hover')}),localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}}},document:doc,setInterval:timerSet,clearInterval,setTimeout,clearTimeout,Math,JSON,Float32Array,Array,Set,Map,Number,Promise,Error,Proxy};
context.globalThis=context;
const audio=vm.runInNewContext(fs.readFileSync('audio.js','utf8').replace(/export (const|function)/g,'$1')+'\n({initializeAudio,playSound,setMood,setAmbience,setDanger,setAudio,audioSettings,audioHealth,narrating,internals:()=>({out,scheduler,ctx,stats,mood})})',context);
const feed=vm.runInNewContext(fs.readFileSync('feedSounds.js','utf8').replace(/export (const|function)/g,'$1')+'\n({eventSounds})');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 assert.equal(audio.audioSettings().background,true,'a computer (a fine pointer that hovers) keeps playing in the background by default');
 audio.initializeAudio();
 fire('pointerdown');
 // (f) Larger buffers: 'balanced' rides out a busy computer better than 'interactive'.
 assert.equal(lastOptions?.latencyHint,'balanced');
 const built=name=>{const before=nodes;audio.playSound(name,0,{speaker:'mara'});return nodes-before;};
 // Every effect and every damage type on both sides builds real sound.
 const effects=['click','send','dice','swing','miss','hit','crit','hurt','heal','fall','victory','defeat','chime','voice','whoosh','page','boot','spell','tick','open','select','round','levelup','arrive'];
 for(const name of effects){now+=3;assert.ok(built(name)>0,name+' makes sound');}
 for(const type of ['slashing','piercing','bludgeoning','fire','cold','poison','necrotic','radiant','lightning','thunder','acid','psychic','force'])for(const side of ['foe','me']){now+=2;assert.ok(built('impact:'+type+':'+side)>0,type+' '+side);}
 const unknown=nodes;audio.playSound('no-such-sound');assert.equal(nodes,unknown,'Unknown sounds are ignored safely');
 // The adaptive score, ambience beds and the low-HP heartbeat all start without errors.
 for(const [mood,amb] of [['menu','menu'],['explore','hearth'],['haven','hearth'],['explore','wild'],['combat','battle'],['explore','cave'],['silence','none']]){now+=20;const before=nodes;audio.setMood(mood);audio.setAmbience(amb);await wait(1600);now+=1;await wait(250);if(mood!=='silence')assert.ok(nodes>before,mood+'/'+amb+' plays');}
 audio.setDanger(.9);await wait(50);audio.setDanger(0);
 // Settings persist and apply; muting silences new sounds.
 audio.setAudio({night:true,master:.5});assert.equal(JSON.parse(store['questbound.audio.v1']).night,true);
 audio.setAudio({muted:true});const muted=nodes;audio.playSound('hit');assert.equal(nodes,muted,'Muted means silent');audio.setAudio({muted:false,night:false,master:.85});
 const inside=audio.internals;
 // (a) A stall: the page is busy for two seconds and plans nothing. The beats that went by are skipped, nothing
 // is started in the past, and the music carries on from the next beat.
 now+=10;audio.setMood('explore');assert.equal(inside().mood,'explore');
 const first=inside().scheduler;first.tick();
 const skippedBefore=inside().stats.skipped;now+=2.0;const mark=starts.length;first.tick();
 const after=starts.slice(mark);
 assert.ok(after.length>0,'the music carries on after a stall');
 assert.ok(after.every(s=>s.t>=now-0.001),'nothing is started in the past after a stall: '+after.map(s=>(s.t-now).toFixed(3)).join(','));
 assert.ok(inside().stats.skipped>skippedBefore,'missed beats are counted as skipped');
 assert.equal(inside().stats.late,0,'no note had to be pulled forward');
 // (b) A change of scene crossfades: the old mood's fader falls, the new mood starts within a third of a second,
 // and the music bus itself is never pulled to silence by a change of mood.
 const musicTargets=()=>inside().out.music.gain.targets.filter(x=>x.v===0).length;
 const zeroBefore=musicTargets();
 audio.setMood('haven');assert.equal(inside().scheduler,first,'explore to haven waits a moment first');
 await wait(2650);
 const second=inside().scheduler;assert.ok(second&&second!==first&&second.name==='haven','haven takes over after the pause');
 assert.ok(first.moodIn.gain.targets.some(x=>x.v===0),'the old mood fades out');
 const havenStarts=starts.filter(s=>s.at===now&&s.t>=now).map(s=>s.t);
 assert.ok(havenStarts.length&&Math.min(...havenStarts)<=now+.35,'the new mood is heard within a third of a second');
 now+=1;const combatAt=now,combatMark=starts.length;audio.setMood('combat');
 const third=inside().scheduler;assert.equal(third.name,'combat','a fight starts its music at once');
 assert.ok(second.moodIn.gain.targets.some(x=>x.v===0));
 assert.ok(starts.slice(combatMark).some(s=>s.t<=combatAt+.05),'the swell into a fight starts at once, under the fading music');
 audio.setMood('silence');assert.equal(inside().scheduler,null);assert.ok(third.moodIn.gain.targets.some(x=>x.v===0),'silence fades the score out');
 assert.equal(musicTargets(),zeroBefore,'no change of mood pulls the music bus itself to silence');
 // (c) Stepping out of a shelter and straight back changes nothing.
 now+=5;audio.setMood('explore');const steady=inside().scheduler;
 audio.setMood('haven');audio.setMood('explore');await wait(2650);
 assert.equal(inside().scheduler,steady,'a quick flip starts no new music');assert.equal(inside().mood,'explore');
 // (d) Every sound lets go of its nodes when it ends.
 const fresh=sources.length;now+=3;audio.playSound('hit');audio.playSound('crit');steady.tick();
 const made=sources.slice(fresh);assert.ok(made.length>5);
 assert.ok(made.every(s=>typeof s.onended==='function'),'every source has an ending handler');
 const one=made.find(s=>s.outs.length===1);one.onended();assert.ok(one.disconnected>0&&one.outs[0].disconnected>0,'ending disconnects the source and its chain');
 // (e) A hit while the narrator speaks dips the music briefly without ending the narrator's dip.
 audio.narrating(true);const voiceGain=inside().out.musicVoice.gain;const lastVoice=()=>voiceGain.targets.at(-1).v;
 assert.equal(lastVoice(),.4);audio.playSound('impact:slashing:foe');assert.equal(lastVoice(),.4,'the narrator dip holds through a hit');
 assert.ok(inside().out.musicDuck.gain.targets.length>0,'the hit ducks its own stage');audio.narrating(false);assert.equal(lastVoice(),1);
 // (g) Hidden pages: kept playing with the background setting, paused without it, and a stopped context resumes.
 audio.setAudio({background:true});let s0=suspends;doc.hidden=true;fire('visibilitychange');await wait(300);assert.equal(suspends,s0,'background play: no pause when hidden');
 doc.hidden=false;fire('visibilitychange');
 audio.setAudio({background:false});s0=suspends;doc.hidden=true;fire('visibilitychange');await wait(300);assert.equal(suspends,s0+1,'without background play the sound pauses when hidden');
 let r0=resumes;doc.hidden=false;fire('visibilitychange');assert.equal(resumes,r0+1,'and resumes on return');
 inside().ctx.state='interrupted';r0=resumes;fire('pointerdown');assert.equal(resumes,r0+1,'an interrupted context resumes on the next tap');
 audio.setAudio({background:true});
 // The watchdog: a running context whose clock stops is replaced and the music started again.
 const oldCtx=inside().ctx;watchdog();watchdog();
 assert.notEqual(inside().ctx,oldCtx,'a frozen clock rebuilds the sound');assert.equal(inside().stats.rebuilds,1);assert.ok(inside().scheduler?.name==='explore','the mood plays on after a rebuild');
 now+=1;watchdog();now+=1;watchdog();assert.equal(inside().stats.rebuilds,1,'a moving clock is left alone');
 // (h) A minute of each mood, planned four times a second: nothing late, nothing skipped, every score voice eased in.
 const health=audio.audioHealth();
 for(const key of ['state','baseLatency','outputLatency','skipped','late','moodChanges','rebuilds','states','background','muted','music','narrator','mood','voicesLive'])assert.ok(key in health,'audioHealth has '+key);
 for(const mood of ['menu','explore','haven','combat']){
  audio.setMood('silence');audio.setMood(mood);const handle=inside().scheduler,skipped=inside().stats.skipped,made=sources.length;attacks.length=0;
  for(let k=0;k<240;k++){now+=.25;handle.tick();}
  assert.equal(inside().stats.late,0,mood+': no note late');assert.equal(inside().stats.skipped,skipped,mood+': no beat skipped');
  const perMinute=sources.length-made;assert.ok(perMinute>40,mood+' plays ('+perMinute+' sources a minute)');
  assert.ok(Math.min(...attacks)>=.01,mood+': every score voice has an attack of at least a hundredth of a second (shortest '+Math.min(...attacks).toFixed(3)+')');
 }
 // The story feed maps real engine lines onto sounds that exist.
 const lines=[
  [{kind:'roll',text:'You use Greatsword: d20 [15] (normal) + 3 Strength + 2 proficiency = 20 vs AC 13. Hit.'},['dice','swing']],
  [{kind:'roll',text:'11 slashing damage (3 + 5 +3).'},['impact:slashing:foe']],
  [{kind:'roll',text:'Goblin Raider 1: d20 [17] (normal) +3 = 20 vs your AC 16. Hit.'},['dice','swing']],
  [{kind:'roll',text:'1d4 [1] + 1 = 2 Slashing damage. 2 damage recorded: 0 absorbed by temporary HP, 2 HP lost.'},['impact:slashing:me']],
  [{kind:'roll',text:'Fire Bolt: d20 [13, 13] (disadvantage) + 3 Intelligence + 2 proficiency = 18 vs AC 11. Hit; 7 Fire damage (1d10 [7]).'},['spell','impact:fire:foe']],
  [{kind:'roll',text:'Burning Hands: Dexterity save d20 13 + 2 = 15 vs DC 13: success; 6 Fire damage. Damage 3d6 [4, 4, 4] = 12; halved on save.'},['spell','impact:fire:foe']],
  [{kind:'roll',text:'You use Greatsword: d20 [2] (normal) + 3 Strength + 2 proficiency = 7 vs AC 13. Miss.'},['dice','miss']],
  [{kind:'roll',text:'You use Greatsword: d20 [20] (normal) + 3 Strength + 2 proficiency = 25 vs AC 13. Critical hit!'},['dice','crit']],
  [{kind:'roll',text:'Healing draught: 4 + 1 + 2; restored 7 HP. It uses your turn in this demo.'},['heal']],
  [{kind:'initiative',text:'Your initiative: d20 [12] + 1 = 13.'},['dice']],
  [{kind:'action',text:'One of the goblin raiders falls — 2 still standing.'},['fall']],
  [{kind:'action',text:'The threat is defeated. Decide how to pursue your remaining objective.'},['victory']],
  [{kind:'action',text:'You wake at Caravan Camp, carried back from the fight. Rest to recover.'},['defeat']],
  [{kind:'action',text:'You return to Caravan Camp.'},['whoosh']],
  [{kind:'effect',text:'Kestrel Vane: 3 → 12 HP.'},['heal']],
  [{kind:'dialogue',text:'Welcome back.',speakerId:'keeper'},['voice']],
 ];
 for(const [event,expected] of lines){const got=feed.eventSounds(event).map(x=>x[0]);assert.equal(JSON.stringify(got),JSON.stringify(expected),event.text);for(const name of got){now+=2;assert.ok(built(name)>0,name+' exists for: '+event.text);}}
 assert.equal(problems.length,0,'Web Audio misuse:\n'+[...new Set(problems)].slice(0,10).join('\n'));
 console.log('Passed: '+effects.length+' effects and 26 typed impacts build sound with valid Web Audio calls; the scores, ambience and heartbeat start cleanly; settings persist and mute; a two-second stall skips beats instead of bunching them; moods crossfade with no silence (explore and haven after a pause, a quick flip changes nothing); every source lets go of its nodes; the narrator dip survives hits; background play, pausing and resuming follow the setting; a frozen clock is rebuilt; a minute of each mood has nothing late and no attack under a hundredth of a second; the feed maps engine lines to existing sounds.');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
