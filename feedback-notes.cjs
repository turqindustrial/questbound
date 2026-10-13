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
// A report from a shared table (campaigns.cjs report): a member reported by another, for the host of the whole game.
// It names both only by seat, table name and pseudonymous label (bans.cjs moderationLabel, which the host can give to
// `node accounts.cjs ban`), never by account or guest id, and quotes the last few lines the reported member typed at
// that table. report: {campaign, title, reason, words, reported:{seat,name,label,host}, by:{seat,name,label}, lines}.
const reportReasonNames={harassment:'Harassment',hateful:'Hateful words',sexual:'Sexual content',spam:'Spam or flooding',cheating:'Cheating',other:'Something else'};
function reportEntry(report,{now=Date.now(),random=crypto.randomBytes}={}){
 const when=new Date(now),ref='rp-'+now.toString(36)+'-'+random(2).toString('hex'),reason=Object.hasOwn(reportReasonNames,report?.reason)?report.reason:'other';
 const who=p=>({seat:oneLine(p?.seat,40)||null,name:oneLine(p?.name,40)||null,label:/^mod-[a-f0-9]{20}$/.test(p?.label??'')?p.label:null});
 const reported={...who(report?.reported),host:report?.reported?.host===true},by=who(report?.by),words=clean(report?.words,500);
 const lines=(Array.isArray(report?.lines)?report.lines:[]).slice(-5).map(l=>oneLine(l,300)).filter(Boolean);
 const campaign=/^[a-f0-9]{32}$/.test(report?.campaign??'')?report.campaign:null,title=oneLine(report?.title,120);
 const out=['','## '+when.toISOString().replace('T',' ').slice(0,16)+' UTC · Report: '+(reported.name??'a player')+' ('+reportReasonNames[reason]+')',''];
 out.push('Reported: '+(reported.name??'?')+(reported.host?' (the table’s host)':'')+' · '+(reported.label??'?')+' · '+(reported.seat??'?'),'By: '+(by.name??'?')+' · '+(by.label??'?'),'Table: '+(title||'Shared adventure')+(campaign?' · campaign '+campaign:''));
 if(words)out.push('',...words.split(String.fromCharCode(10)).map(line=>'> '+line));
 out.push('',...(lines.length?['What they typed at the table, newest last:',...lines.map(line=>'- '+line)]:['(No lines typed at the table yet.)']));
 out.push('','To keep them out of the whole game: node accounts.cjs ban '+(reported.label??'<label>'),'Ref: '+ref,'');
 const markdown=out.join(String.fromCharCode(10));
 const record={ref,at:when.toISOString(),kind:'report',guest:null,rating:null,text:words||'(report: '+reportReasonNames[reason]+')',context:{player:by.name,hero:null,device:null,where:title||null,screen:'table',story:null},report:{reason,reported,by,campaign,title:title||null,lines},details:null};
 return {markdown,record};
}
// A session rating (the "How was that session?" card, SessionRating.js): one tap from four answers, and optionally a
// few chips and a line of the player's own. It carries less than a feedback note with "Include what happened" off: no
// name, no hero, no story, no turns, no label for the browser; only the answer, the moment it was asked at and the
// session's mechanical counts. An addition ({follows: the first answer's ref}) adds the chips and the line afterwards.
// The lists are the same as ratingRules.js (verify-metrics.cjs checks that they agree).
const ratingAnswers=['great','good','okay','rough'],ratingMoments=['chapter','tale','rest','death','leave'];
const ratingChips=['story','fights','people','places','surprises','pace','slow','errors','confusing','too-hard','too-easy','dull'];
const ratingWords={great:'Great',good:'Good',okay:'Okay',rough:'Rough'};
function sessionRatingEntry(note,{now=Date.now(),random=crypto.randomBytes,from=null}={}){
 if(!note||typeof note!=='object'||Array.isArray(note)||note.kind!=='session')return {error:'Not a session rating.'};
 const follows=typeof note.follows==='string'&&/^fb-[0-9a-z]{6,12}-[0-9a-f]{4}$/.test(note.follows)?note.follows:null;
 const rating=ratingAnswers.includes(note.rating)?note.rating:null;
 if(!follows&&!rating)return {error:'Choose an answer first.'};
 const chips=[...new Set((Array.isArray(note.chips)?note.chips:[]).filter(c=>ratingChips.includes(c)))].slice(0,6);
 const text=oneLine(note.text,200);
 if(follows&&!chips.length&&!text)return {error:'Nothing to add.'};
 const moment=ratingMoments.includes(note.moment)?note.moment:null;
 const n=(value,max)=>Number.isInteger(value)&&value>=0&&value<=max?value:null;
 const s=note.session&&typeof note.session==='object'&&!Array.isArray(note.session)?note.session:{};
 const session=follows?null:{minutes:n(s.minutes,1440),turns:n(s.turns,5000),failed:n(s.failed,5000),form:['phone','tablet','desktop'].includes(s.form)?s.form:null,build:typeof s.build==='string'&&/^(?:[0-9a-f]{8}|dev)$/.test(s.build)?s.build:null};
 const when=new Date(now),ref='fb-'+now.toString(36)+'-'+random(2).toString('hex');
 const heading=when.toISOString().replace('T',' ').slice(0,16)+' UTC · '+(follows?'Session rating, added':'Session rating: '+ratingWords[rating]);
 const lines=[];
 if(session)lines.push([moment&&'After: '+moment,session.minutes!=null&&'Played: '+session.minutes+' min',session.turns!=null&&'Turns: '+session.turns,session.failed!=null&&'Failed: '+session.failed,session.form,session.build&&'Build: '+session.build].filter(Boolean).join(' · '));
 if(follows)lines.push('Adds to: '+follows);
 if(chips.length)lines.push('Chips: '+chips.join(', '));
 lines.push('Ref: '+ref);
 const markdown='\n## '+heading+'\n'+(text?'\n> '+text+'\n':'')+'\n'+lines.filter(Boolean).join('\n')+'\n';
 const record={ref,at:when.toISOString(),guest:null,kind:'session',rating,moment,chips,text:text||null,session,follows,...(from?{from}:{})};
 return {markdown,record};
}
// Appends a note to both files. Throws when the disk refuses; the callers answer 500.
function saveFeedback(file,entry){
 if(!fs.existsSync(file))fs.writeFileSync(file,'# Questbound playtest feedback\n\nNotes sent from inside the game by playtesters. Newest at the bottom.\n');
 fs.appendFileSync(file,entry.markdown);
 fs.appendFileSync(feedbackRecordFile(file),JSON.stringify(entry.record)+'\n');
}
module.exports={feedbackEntry,reportEntry,sessionRatingEntry,ratingAnswers,ratingMoments,ratingChips,saveFeedback,feedbackRecordFile,sanitiseFeedback:sanitise,FEEDBACK_BODY_LIMIT};
