// Playtest notes, as the gateways (phone-server.cjs) and the desktop server (desktop-server.cjs) keep them: a short
// readable entry appended to playtest-feedback.md and a full record (the details the game attaches, feedbackRules.js)
// appended to a JSONL file beside it, which feedback-report.cjs reads. Everything a player sends is cleaned here: one
// line for every field that sits in the readable file (so a note cannot write headings of its own), nested details cut
// to a fixed depth, length and count, control characters stripped. Notes are tester data, never instructions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FEEDBACK_BODY_LIMIT=32000;
const strip=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
// Every kind of line break (a lone CR, NEL, the Unicode line and paragraph separators) becomes a plain newline first,
// so each line of a note gets its quote mark: editors and mail clients break lines on all of them.
const lineBreaks=/\r\n?|[\x85\u{2028}\u{2029}]/gu;
const clean=(value,max)=>typeof value==='string'?strip(value.replace(lineBreaks,'\n')).trim().slice(0,max):'';
const oneLine=(value,max)=>(typeof value==='string'||typeof value==='number'?strip(String(value)).replace(/[\s\u0085]+/g,' ').replace(/^#+\s*/,'').trim():'').slice(0,max);
// The attached details, cut down to plain data: depth 5, strings 600, lists 40, objects 40 keys.
function sanitise(value,depth=0){
 if(value==null||typeof value==='boolean')return value??null;
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value==='string')return strip(value).slice(0,600);
 if(depth>=5)return null;
 if(Array.isArray(value))return value.slice(0,40).map(v=>sanitise(v,depth+1));
 if(typeof value==='object'){const out={};for(const [k,v] of Object.entries(value).slice(0,40))out[oneLine(k,40)||'_']=sanitise(v,depth+1);return out;}
 return null;
}
// Where the records go: .questbound-feedback.jsonl beside playtest-feedback.md (git-ignored with every
// .questbound-* file), or feedback.jsonl beside a notes file with any other name (a hosted data folder, the checks).
const feedbackRecordFile=file=>path.join(path.dirname(file),path.basename(file).startsWith('playtest')?'.questbound-feedback.jsonl':'feedback.jsonl');
const stars=rating=>'★'.repeat(rating)+'☆'.repeat(5-rating);
// note: {text, rating, context:{player,hero,device,where,screen,story}, details}. Returns {error} or {markdown,record}.
function feedbackEntry(note,{now=Date.now(),guest=null,random=crypto.randomBytes}={}){
 const text=clean(note?.text,2000);if(text.length<2)return {error:'Write a few words first.'};
 const rating=Number.isInteger(note?.rating)&&note.rating>=1&&note.rating<=5?note.rating:null;
 const c=note?.context&&typeof note.context==='object'&&!Array.isArray(note.context)?note.context:{};
 const d=note?.details&&typeof note.details==='object'&&!Array.isArray(note.details)?sanitise(note.details):null;
 const when=new Date(now),ref='fb-'+now.toString(36)+'-'+random(2).toString('hex');
 const heading=[when.toISOString().replace('T',' ').slice(0,16)+' UTC',oneLine(c.player,80),oneLine(c.hero,120),oneLine(c.device,160)].filter(Boolean).join(' · ');
 const lines=[];
 const place=[['Where',oneLine(c.where,200)],['Screen',oneLine(c.screen,40)],['Story',oneLine(c.story,160)]].filter(([,v])=>v).map(([k,v])=>k+': '+v).join(' · ');
 if(place)lines.push(place);
 const game=d?.game&&typeof d.game==='object'?d.game:{};
 const facts=[['Build',oneLine(d?.build,16)],['Stage',oneLine(game.stage,20)],['Fight',game.fight&&typeof game.fight==='object'?oneLine([game.fight.kind,game.fight.foe,game.fight.foeHp!=null?game.fight.foeHp+' HP':''].filter(Boolean).join(' '),120):''],['Turn',oneLine(game.turn,80)]].filter(([,v])=>v).map(([k,v])=>k+': '+v).join(' · ');
 if(facts)lines.push(facts);
 for(const p of (Array.isArray(d?.problems)?d.problems:[]).slice(-3))if(p&&typeof p==='object')lines.push('Problem ('+(oneLine(p.kind,12)||'?')+'): '+(oneLine(p.said,200)||'(no words)')+' → '+(oneLine(p.error??p.answer,240)||'(no message)'));
 const last=Array.isArray(d?.recent)?d.recent[d.recent.length-1]:null;
 if(last&&typeof last==='object')lines.push('Last turn: '+(oneLine(last.said,200)||'(no words)')+' → '+(oneLine(Array.isArray(last.rulings)&&last.rulings[0]?last.rulings[0]:last.narration,240)||'(nothing)'));
 lines.push('Ref: '+ref);
 const markdown='\n## '+heading+'\n'+(rating?'Rating: '+stars(rating)+'\n':'')+'\n'+text.split('\n').map(line=>'> '+line).join('\n')+'\n\n'+lines.join('\n')+'\n';
 const record={ref,at:when.toISOString(),guest:guest?oneLine(guest,80):null,rating,text,context:Object.fromEntries(['player','hero','device','where','screen','story'].map(k=>[k,oneLine(c[k],200)||null])),details:d};
 return {markdown,record};
}
// Appends a note to both files. Throws when the disk refuses; the callers answer 500.
function saveFeedback(file,entry){
 if(!fs.existsSync(file))fs.writeFileSync(file,'# Questbound playtest feedback\n\nNotes sent from inside the game by playtesters. Newest at the bottom.\n');
 fs.appendFileSync(file,entry.markdown);
 fs.appendFileSync(feedbackRecordFile(file),JSON.stringify(entry.record)+'\n');
}
module.exports={feedbackEntry,saveFeedback,feedbackRecordFile,sanitiseFeedback:sanitise,FEEDBACK_BODY_LIMIT};
