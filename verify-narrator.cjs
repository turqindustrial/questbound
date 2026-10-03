const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
// The narrator (narrator.js): the Dungeon Master's words read aloud by the browser's own voices, off by default,
// a sentence or two at a time, silenced by a new turn, by muting or by turning it off.
const ctx={window:{},globalThis:null,console};ctx.globalThis=ctx;vm.createContext(ctx);
const settings={master:.85,music:.6,ambience:.6,effects:1,muted:false,night:false,narrator:false,voice:null};
const audioStub='const audioListeners=new Set();const audioSettings=()=>({...settings});function subscribeAudio(fn){audioListeners.add(fn);return()=>audioListeners.delete(fn);}let ducked=[];function narrating(on){ducked.push(on);}';
vm.runInContext('var settings='+JSON.stringify(settings)+';'+audioStub+'\n'+fs.readFileSync('narrator.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export (const|function)/gm,'$1')+'\n;this.out={cleanSpeech,spokenLines,speechChunks,englishVoices,pickVoice,speakLines,speakTurn,stopNarrator,narratorAvailable,sampleNarrator,audioListeners:audioListeners,set:(c)=>{settings={...settings,...c};audioListeners.forEach(fn=>fn(settings));},ducked:()=>ducked};',ctx);
const n=ctx.out;
// Words fit for a voice.
assert.equal(n.cleanSpeech('*The* door — it **creaks**… "Who goes there?"'),'The door , it creaks. Who goes there?');
same(n.speechChunks('One. Two! Three? Four.',6),['One.','Two!','Three?','Four.']);
same(n.speechChunks('One. Two.',220),['One. Two.']);
same(n.speechChunks('x'.repeat(250),100),['x'.repeat(100),'x'.repeat(100),'x'.repeat(50)],'a sentence longer than the limit is cut, losing nothing');
same(n.speechChunks('word '.repeat(60).trim(),100).map(c=>c.length<=100),Array(3).fill(true),'and cut at spaces when it can');
// What a turn says: narration and spoken lines, never rolls or rulings.
const turn={id:3,events:[{kind:'player',text:'I knock.'},{kind:'roll',text:'d20: 14'},{kind:'narration',text:'The door opens *slowly*.'},{kind:'dialogue',speakerId:'keeper',speakerName:'Old Tam',text:'Who goes there?'},{kind:'effect',text:'Kara: 12 → 10 HP.'}]};
same(n.spokenLines(turn),['The door opens slowly.','Old Tam: Who goes there?']);
same(n.spokenLines(null),[]);
// The voice: natural first, British English before other English, the default as a tie-break; a chosen name wins.
const voices=[{name:'Microsoft Ryan Online (Natural)',lang:'en-GB'},{name:'Google US English',lang:'en-US',default:true},{name:'Amelie',lang:'fr-FR'},{name:'Daniel',lang:'en-GB'}];
assert.equal(n.englishVoices(voices).length,3);
assert.equal(n.pickVoice(n.englishVoices(voices)).name,'Microsoft Ryan Online (Natural)');
assert.equal(n.pickVoice(n.englishVoices(voices),'Daniel').name,'Daniel');
assert.equal(n.pickVoice([{name:'Google US English',lang:'en-US',default:true},{name:'Daniel',lang:'en-GB'}]).name,'Daniel','British before other English when neither is natural');
assert.equal(n.pickVoice([]),null);
// Speaking: nothing unless the narrator is on and sound is not muted; then one utterance per chunk, with the voice.
const spoken=[];let cancelled=0;
const synth={speak:u=>spoken.push(u),cancel:()=>{cancelled++;},getVoices:()=>voices};
function Utterance(text){this.text=text;}
assert.equal(n.speakTurn(turn,{s:synth,Utterance}),false,'off by default');assert.equal(spoken.length,0);
n.set({narrator:true});
assert.equal(n.speakTurn(turn,{s:synth,Utterance}),true);assert.equal(spoken.length,2);assert.equal(spoken[0].text,'The door opens slowly.');assert.equal(spoken[0].voice.name,'Microsoft Ryan Online (Natural)');assert.equal(spoken[0].rate,0.96);
same(n.ducked(),[true],'the score steps back while the narrator speaks');
spoken[0].onend();same(n.ducked(),[true]);spoken[1].onend();same(n.ducked(),[true,false],'and returns when the last line is done');
n.set({muted:true});assert.equal(n.speakTurn(turn,{s:synth,Utterance}),false,'muted means silent');assert.ok(cancelled>=1,'muting silences a line being spoken');
n.set({muted:false});
assert.equal(n.speakTurn({events:[{kind:'roll',text:'d20: 3'}]},{s:synth,Utterance}),false,'nothing to say');
// A new turn, or turning the narrator off, stops the speech.
const before=cancelled;n.speakTurn(turn,{s:synth,Utterance});assert.ok(cancelled>before);
n.set({narrator:false});assert.ok(cancelled>before+1);
assert.equal(n.narratorAvailable(),false,'no voices in this test world');
// The screens: the setting under Sound, the turn read aloud from the play screen, silenced when a new turn is sent or the screen is left.
const controls=fs.readFileSync('AudioControls.js','utf8'),play=fs.readFileSync('Adventure.js','utf8'),audio=fs.readFileSync('audio.js','utf8'),policy=fs.readFileSync('legalText.js','utf8');
assert.ok(controls.includes('label="Narrator voice"')&&controls.includes('browser maker')&&controls.includes('sampleNarrator'));
assert.ok(play.includes('speakTurn(result.turn)')&&play.includes('=>{stopNarrator();const from=')&&play.includes('useEffect(()=>()=>stopNarrator(),[])'));
assert.ok(audio.includes('narrator:false,voice:null')&&audio.includes('export function narrating(on)'));
assert.ok(policy.includes('narrator voice')&&policy.includes('browser maker'),'the privacy policy and the agreement say what the narrator does');
console.log('Narrator: off by default, the turn\'s narration and spoken lines read a sentence or two at a time in a storyteller\'s voice, the score stepping back, silenced by a new turn, muting or the setting.');
