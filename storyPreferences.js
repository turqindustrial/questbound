// How the Dungeon Master tells violence, chosen per device. Deaths are always described precisely; brutality only
// decides how much blood and gore the telling shows.
const KEY='questbound.story.v1';
export const brutalityLevels=[
 {id:'restrained',label:'Restrained',icon:'shield',description:'Every killing blow and fall is told exactly, but blood and gore stay out of view.'},
 {id:'gritty',label:'Gritty',icon:'swords',description:'Wounds, blood and pain are described plainly, as they are.'},
 {id:'brutal',label:'Brutal',icon:'skull',description:'Unflinching and visceral: gore, broken bone and the physical horror of dying.'},
];
const defaults={brutality:'gritty'};
function load(){try{const v=JSON.parse(globalThis.localStorage?.getItem(KEY)??'{}');return {...defaults,...(brutalityLevels.some(l=>l.id===v?.brutality)?{brutality:v.brutality}:{})};}catch{return {...defaults};}}
let prefs=load();const listeners=new Set();
export const storyPreferences=()=>({...prefs});
export function subscribeStoryPreferences(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function setStoryPreferences(changes){
 if(changes.brutality&&!brutalityLevels.some(l=>l.id===changes.brutality))return;
 prefs={...prefs,...changes};try{globalThis.localStorage?.setItem(KEY,JSON.stringify(prefs));}catch{}
 listeners.forEach(fn=>fn(storyPreferences()));
}
