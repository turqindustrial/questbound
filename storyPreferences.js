// How the Dungeon Master tells violence, chosen per device. Deaths are always described precisely; brutality only
// decides how much blood and gore the telling shows.
const KEY='questbound.story.v1';
export const brutalityLevels=[
 {id:'restrained',label:'Restrained',icon:'shield',description:'Every killing blow and fall is told exactly, but blood and gore stay out of view.'},
 {id:'gritty',label:'Gritty',icon:'swords',description:'Wounds, blood and pain are described plainly, as they are.'},
 {id:'brutal',label:'Brutal',icon:'skull',description:'Unflinching and visceral: gore, broken bone and the physical horror of dying.'},
];
// Who tells the tale: the Dungeon Master's narration and its out-of-character answers, never the rules or the people's
// own words. Each narrator is our own character with a voice for the read-aloud narrator (Settings → Sound).
export const narrators=[
 {id:'chronicler',name:'The Chronicler',short:'Chronicler',icon:'scroll',description:'Calm, vivid and even-handed: the tale told straight.',sample:'The road bends east, and the rain follows you down into the valley.',voice:{rate:.96,pitch:.92}},
 {id:'lamplighter',name:'Wick the Lamplighter',short:'Wick',icon:'flame',description:'An old lamplighter who has outlived a great many heroes. Dry, blunt, darkly funny and hard to impress.',sample:'Another hero with a shiny sword. Let us see how long the shine lasts.',voice:{rate:.9,pitch:.72}},
 {id:'bard',name:'Sable the Bard',short:'Sable',icon:'lute',description:'A travelling bard who loves a grand moment: warm, theatrical, quick to cheer a triumph and quick to mourn a loss.',sample:'A new name for my songs! Step into the light, friend, and let the tale begin.',voice:{rate:1.02,pitch:1.08}},
];
export const narratorOf=id=>narrators.find(n=>n.id===id)??narrators[0];
const defaults={brutality:'gritty',narrator:'chronicler'};
function load(){try{const v=JSON.parse(globalThis.localStorage?.getItem(KEY)??'{}');return {...defaults,...(brutalityLevels.some(l=>l.id===v?.brutality)?{brutality:v.brutality}:{}),...(narrators.some(n=>n.id===v?.narrator)?{narrator:v.narrator}:{})};}catch{return {...defaults};}}
let prefs=load();const listeners=new Set();
export const storyPreferences=()=>({...prefs});
export function subscribeStoryPreferences(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function setStoryPreferences(changes){
 if(changes.brutality&&!brutalityLevels.some(l=>l.id===changes.brutality))return;
 if(changes.narrator&&!narrators.some(n=>n.id===changes.narrator))return;
 prefs={...prefs,...changes};try{globalThis.localStorage?.setItem(KEY,JSON.stringify(prefs));}catch{}
 listeners.forEach(fn=>fn(storyPreferences()));
}
