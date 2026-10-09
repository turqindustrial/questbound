// The last few things that went wrong on this device during play: a move the rules refused, a Dungeon Master reply
// that failed or never came, a save that did not stick, a write the shared table turned down, or a fault the
// Dungeon Master itself admitted out of character. Feedback notes carry them (feedbackRules.js) and the Report chip
// beside an error opens a note about the latest one. Kept in memory and in this tab's sessionStorage only.
import {profileKey,subscribeProfile} from './playerStorage';
const PROBLEM_KEY='questbound.problems.v1',PROBLEM_LIMIT=8,PROBLEM_TEXT=300;
export const problemKinds=['refused','dm','reported','save','table'];
const problemListeners=new Set();
const clampProblemText=value=>value==null?null:String(value).replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,PROBLEM_TEXT)||null;
// Each account profile on a shared browser keeps its own list, so a note never carries another player's turns.
const problemKey=()=>typeof profileKey==='function'?profileKey(PROBLEM_KEY):PROBLEM_KEY;
function readProblems(){
 try{const saved=JSON.parse(globalThis.sessionStorage?.getItem(problemKey())??'[]');return Array.isArray(saved)?saved.filter(p=>p&&typeof p==='object'&&problemKinds.includes(p.kind)).slice(-PROBLEM_LIMIT):[];}catch{return [];}
}
let problems=readProblems(),problemCount=0;
if(typeof subscribeProfile==='function')subscribeProfile(()=>{problems=readProblems();problemListeners.forEach(fn=>{try{fn(problems);}catch{}});});
// Records one problem and returns it. kind is one of problemKinds (anything else counts as 'dm'); every text field
// is cut to 300 characters on one line.
export function noteProblem({kind,said,error,answer,stage,action,spell}={},now=Date.now()){
 const entry={id:'p'+now.toString(36)+'-'+(++problemCount),kind:problemKinds.includes(kind)?kind:'dm',at:new Date(now).toISOString()};
 for(const [key,value] of Object.entries({said,error,answer,stage,action,spell})){const text=clampProblemText(value);if(text)entry[key]=text;}
 problems=[...problems,entry].slice(-PROBLEM_LIMIT);
 try{globalThis.sessionStorage?.setItem(problemKey(),JSON.stringify(problems));}catch{}
 problemListeners.forEach(fn=>{try{fn(problems);}catch{}});
 return entry;
}
export const recentProblems=(count=PROBLEM_LIMIT)=>problems.slice(-count);
export const lastProblem=()=>problems[problems.length-1]??null;
export function subscribeProblems(fn){problemListeners.add(fn);return()=>problemListeners.delete(fn);}
export function clearProblems(){problems=[];try{globalThis.sessionStorage?.removeItem(problemKey());}catch{}problemListeners.forEach(fn=>{try{fn(problems);}catch{}});}
