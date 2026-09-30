import {isValidCharacter} from './characterStorage';
import {validAdventure} from './adventureStorage';
// A save code carries one hero and their adventure to another browser, device or playtest link (browser saves belong
// to one web address). Format: 'QB2.' + base64 of the gzip-compressed save, or 'QB1.' + plain base64 where a browser
// cannot compress. Codes pass the same checks as a normal save before anything is replaced.
const KEYS={character:'questbound.character.v1',adventure:'questbound.adventure.v1'};
const damaged='That save code is damaged or incomplete. Copy the whole code again.';
const toBase64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);};
const fromBase64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const pipe=async(bytes,stream)=>new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
export async function exportSave(storage=globalThis.localStorage,compress=typeof CompressionStream==='function'){
 const character=storage.getItem(KEYS.character);if(!character)throw Error('There is no saved hero in this browser yet.');
 const bytes=new TextEncoder().encode(JSON.stringify({character,adventure:storage.getItem(KEYS.adventure)}));
 return compress?'QB2.'+toBase64(await pipe(bytes,new CompressionStream('gzip'))):'QB1.'+toBase64(bytes);
}
export async function readSave(code){
 const text=String(code??'').replace(/\s+/g,''),match=text.length<=4000000&&text.match(/^QB([12])\.([A-Za-z0-9+/]+={0,2})$/);
 if(!match)throw Error('That is not a Questbound save code.');
 let bytes;try{bytes=fromBase64(match[2]);}catch{throw Error(damaged);}
 if(match[1]==='2'){if(typeof DecompressionStream!=='function')throw Error('This browser cannot open that save code. Try a current Chrome, Safari, Edge or Firefox.');try{bytes=await pipe(bytes,new DecompressionStream('gzip'));}catch{throw Error(damaged);}}
 let data,hero,adventure=null;
 try{data=JSON.parse(new TextDecoder().decode(bytes));hero=JSON.parse(data.character);if(data.adventure!=null)adventure=JSON.parse(data.adventure);}catch{throw Error(damaged);}
 if(!isValidCharacter(hero))throw Error('The hero in that code did not pass the save checks.');
 if(adventure&&(adventure.character!==data.character||!validAdventure(adventure,hero)))throw Error('The adventure in that code did not pass the save checks.');
 return {hero,character:data.character,adventure:adventure?data.adventure:null};
}
export function applySave(save,storage=globalThis.localStorage){
 storage.setItem(KEYS.character,save.character);
 if(save.adventure)storage.setItem(KEYS.adventure,save.adventure);else storage.removeItem(KEYS.adventure);
}
