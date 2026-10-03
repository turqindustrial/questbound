import {audioSettings,subscribeAudio,narrating} from './audio';
// The narrator: the Dungeon Master's words read aloud after each turn by one of the browser's own English voices
// (the Web Speech API; off by default, Settings → Sound). Nothing leaves the game for it, except that some browser
// voices, marked online or natural, have the browser maker's servers do the speaking; the setting says so.
const synth=()=>{try{return globalThis.speechSynthesis??null;}catch{return null;}};
export const narratorAvailable=()=>!!synth()&&typeof globalThis.SpeechSynthesisUtterance==='function';
// Plain speech from story text: no markdown marks, no stage dashes, nothing a voice would spell out.
export function cleanSpeech(text){
 return String(text??'').replace(/[*_#>`]+/g,'').replace(/[—–]/g,', ').replace(/\.{3,}|…/g,'.').replace(/["“”]/g,'').replace(/\s+/g,' ').trim();
}
// What a recorded turn says aloud: the narration and the spoken lines, in order; rolls and rulings stay on the page.
export function spokenLines(turn){
 return (turn?.events??[]).filter(e=>e&&(e.kind==='narration'||e.kind==='dialogue')&&typeof e.text==='string')
  .map(e=>cleanSpeech(e.kind==='dialogue'&&e.speakerName?e.speakerName+': '+e.text:e.text)).filter(Boolean);
}
// Long utterances stall in some browsers, so each line is spoken a sentence or two at a time.
export function speechChunks(text,max=220){
 const sentences=cleanSpeech(text).match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)??[],out=[];let chunk='';
 for(const s of sentences){const piece=s.trim();if(!piece)continue;if(chunk&&(chunk+' '+piece).length>max){out.push(chunk);chunk=piece;}else chunk=chunk?chunk+' '+piece:piece;}
 if(chunk)out.push(chunk);
 return out.flatMap(c=>c.length<=max*1.5?[c]:hardSplit(c,max));
}
// A single sentence longer than the limit is cut at a space near the limit (or at the limit when there is none).
function hardSplit(text,max){const out=[];let rest=text.trim();while(rest.length>max){let cut=rest.lastIndexOf(' ',max);if(cut<max*0.5)cut=max;out.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();}if(rest)out.push(rest);return out;}
export function englishVoices(list=synth()?.getVoices?.()??[]){return list.filter(v=>/^en([-_]|$)/i.test(v.lang??''));}
// A storyteller's voice: natural voices first, British English before other English, the browser's default as a tie-break.
export function pickVoice(voices,preferred=null){
 if(!voices?.length)return null;
 if(preferred){const chosen=voices.find(v=>v.name===preferred);if(chosen)return chosen;}
 const score=v=>(/natural|neural|premium|enhanced|online/i.test(v.name??'')?4:0)+(/^en[-_]GB/i.test(v.lang??'')?2:/^en/i.test(v.lang??'')?1:0)+(v.default?.5:0);
 return [...voices].sort((a,b)=>score(b)-score(a))[0];
}
let speaking=0,lastSynth=null;
// How the chosen narrator sounds (storyPreferences.js narrators: rate and pitch), set by the app when it changes.
let style={rate:.96,pitch:.92};
export function setNarratorStyle(next){if(next&&Number.isFinite(next.rate)&&Number.isFinite(next.pitch))style={rate:Math.max(.5,Math.min(1.5,next.rate)),pitch:Math.max(.5,Math.min(1.5,next.pitch))};}
export function stopNarrator(){const s=lastSynth??synth();if(s)try{s.cancel();}catch{}if(speaking){speaking=0;try{narrating(false);}catch{}}}
// Speaking never throws into the game: a browser whose speech engine refuses is simply silent.
export function speakLines(lines,{settings=audioSettings(),s=synth(),Utterance=globalThis.SpeechSynthesisUtterance,voices=null}={}){
 try{
  if(!s||typeof Utterance!=='function'||!lines.length)return false;
  lastSynth=s;stopNarrator();
  const voice=pickVoice(englishVoices(voices??s.getVoices?.()??[]),settings.voice??null);
  const chunks=lines.flatMap(line=>speechChunks(line));if(!chunks.length)return false;
  speaking=chunks.length;try{narrating(true);}catch{}
  for(const chunk of chunks){
   const u=new Utterance(chunk);if(voice)u.voice=voice;u.lang=voice?.lang??'en-GB';u.rate=style.rate;u.pitch=style.pitch;u.volume=Math.max(0,Math.min(1,settings.master??1));
   const done=()=>{if(speaking>0&&--speaking===0)try{narrating(false);}catch{}};u.onend=done;u.onerror=done;
   s.speak(u);
  }
  return true;
 }catch{speaking=0;try{narrating(false);}catch{}return false;}
}
// Reads a turn aloud when the narrator is on and sound is not muted.
export function speakTurn(turn,options={}){
 try{const settings=options.settings??audioSettings();if(!settings.narrator||settings.muted)return false;return speakLines(spokenLines(turn),{...options,settings});}catch{return false;}
}
// A sample line, when the narrator voice is turned on or another narrator is chosen (quiet: only if the voice is on).
export function sampleNarrator(line='Welcome, traveller. I will read the Dungeon Master\'s words to you as your tale unfolds.',{quiet=false}={}){
 try{if(quiet){const settings=audioSettings();if(!settings.narrator||settings.muted)return false;}return speakLines([line]);}catch{return false;}
}
// Turning the narrator off, or muting, silences a line already being spoken.
if(typeof globalThis.window!=='undefined')subscribeAudio(settings=>{if(!settings.narrator||settings.muted)stopNarrator();});
