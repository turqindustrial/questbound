const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// A strict stand-in for Web Audio: it rejects the calls real browsers reject (zero exponential targets,
// non-finite times, bad pans, stopping before starting) and counts the nodes each sound builds.
const problems=[];let nodes=0,now=0;
const bad=(msg)=>{problems.push(msg);};
const finite=(v,what)=>{if(!Number.isFinite(v))bad(what+' is not finite: '+v);};
function param(value=0,name='param'){return {value,name,
 setValueAtTime(v,t){finite(v,name+' value');finite(t,name+' time');},linearRampToValueAtTime(v,t){finite(v,name+' ramp');finite(t,name+' ramp time');},
 exponentialRampToValueAtTime(v,t){finite(t,name+' exp time');if(!(v>0))bad(name+' exponential ramp to '+v);},
 setTargetAtTime(v,t,tc){finite(v,name+' target');finite(t,name+' target time');if(!(tc>0))bad(name+' time constant '+tc);},cancelScheduledValues(){},};}
function node(extra={}){nodes++;return {connect(target){if(!target)bad('connect to nothing');return target;},disconnect(){},...extra};}
function source(kind){let started=null;return node({[kind==='osc'?'frequency':'playbackRate']:param(kind==='osc'?440:1,kind),detune:param(0,'detune'),loop:false,buffer:null,type:'sine',onended:null,
 start(t=0,offset=0){finite(t,'start');finite(offset,'offset');started=t;},stop(t){if(t===undefined)return;/* no time = stop now, as in browsers */finite(t,'stop');if(started!==null&&t<started)bad('stop before start');}});}
class FakeContext{
 constructor(){this.sampleRate=48000;this.state='running';this.destination=node();}
 get currentTime(){return now;}
 resume(){return Promise.resolve();}suspend(){return Promise.resolve();}
 createGain(){return node({gain:param(1,'gain')});}
 createOscillator(){return source('osc');}
 createBufferSource(){return source('buffer');}
 createBiquadFilter(){return node({type:'lowpass',frequency:param(350,'filter'),Q:param(1,'Q')});}
 createStereoPanner(){const p=param(0,'pan');const set=p.setValueAtTime;return node({pan:new Proxy(p,{set(obj,key,v){if(key==='value'&&(v<-1||v>1||!Number.isFinite(v)))bad('pan '+v);obj[key]=v;return true;}})});}
 createConvolver(){return node({buffer:null});}
 createDynamicsCompressor(){return node({threshold:param(-24,'threshold'),knee:param(30,'knee'),ratio:param(12,'ratio'),attack:param(.003,'attack'),release:param(.25,'release')});}
 createWaveShaper(){return node({curve:null,oversample:'none'});}
 createDelay(){return node({delayTime:param(0,'delay')});}
 createChannelMerger(){return node();}
 createBuffer(ch,len,sr){if(!(len>0)||!Number.isInteger(len))bad('buffer length '+len);const data=Array.from({length:ch},()=>new Float32Array(len));return {numberOfChannels:ch,length:len,sampleRate:sr,getChannelData:c=>data[c]};}
}
const listeners={},store={};
const context={window:{AudioContext:FakeContext,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}}},document:{addEventListener:(t,fn)=>(listeners[t]??=[]).push(fn),hidden:false},setInterval,clearInterval,setTimeout,clearTimeout,Math,JSON,Float32Array,Array,Set,Map,Number,Promise,Error,Proxy};
context.globalThis=context;
const audio=vm.runInNewContext(fs.readFileSync('audio.js','utf8').replace(/export (const|function)/g,'$1')+'\n({initializeAudio,playSound,setMood,setAmbience,setDanger,setAudio,audioSettings})',context);
const feed=vm.runInNewContext(fs.readFileSync('feedSounds.js','utf8').replace(/export (const|function)/g,'$1')+'\n({eventSounds})');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 audio.initializeAudio();
 (listeners.pointerdown??[]).forEach(fn=>fn({target:{closest:()=>null}}));
 const built=name=>{const before=nodes;audio.playSound(name,0,{speaker:'mara'});return nodes-before;};
 // Every effect and every damage type on both sides builds real sound.
 const effects=['click','send','dice','swing','miss','hit','crit','hurt','heal','fall','victory','defeat','chime','voice','whoosh','page','boot','spell','tick','open','select','round','levelup','arrive'];
 for(const name of effects){now+=3;assert.ok(built(name)>0,name+' makes sound');}
 for(const type of ['slashing','piercing','bludgeoning','fire','cold','poison','necrotic','radiant','lightning','thunder','acid','psychic','force'])for(const side of ['foe','me']){now+=2;assert.ok(built('impact:'+type+':'+side)>0,type+' '+side);}
 const unknown=nodes;audio.playSound('no-such-sound');assert.equal(nodes,unknown,'Unknown sounds are ignored safely');
 // The adaptive score, ambience beds and the low-HP heartbeat all start without errors.
 for(const [mood,amb] of [['menu','menu'],['explore','hearth'],['explore','wild'],['combat','battle'],['explore','cave'],['silence','none']]){now+=20;const before=nodes;audio.setMood(mood);audio.setAmbience(amb);await wait(1600);now+=1;await wait(250);if(mood!=='silence')assert.ok(nodes>before,mood+'/'+amb+' plays');}
 audio.setDanger(.9);await wait(50);audio.setDanger(0);
 // Settings persist and apply; muting silences new sounds.
 audio.setAudio({night:true,master:.5});assert.equal(JSON.parse(store['questbound.audio.v1']).night,true);
 audio.setAudio({muted:true});const muted=nodes;audio.playSound('hit');assert.equal(nodes,muted,'Muted means silent');audio.setAudio({muted:false,night:false,master:.85});
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
 console.log('Passed: '+effects.length+' effects and 26 typed impacts build sound with valid Web Audio calls; menu/explore/combat scores, hearth/wild/battle/cave ambience and the heartbeat start cleanly; settings persist and mute; the story feed maps real engine lines to existing sounds.');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
