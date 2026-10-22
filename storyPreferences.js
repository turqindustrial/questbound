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
// How much is told each turn (the host, 2026-10-22: "adding a "not so wordy" mode for players to be able to make that
// choice on their own. it seemed a bit daunting the last time I played"): the full telling, or the essentials in a few
// short sentences. It reaches the Dungeon Master as this turn's note (dm-instructions.cjs lengthNote) and the game's
// own tellings of routine moves pick their shorter lines (fightLines.js, calmLines.js). Never a rule or a fact.
export const tellingLengths=[
 {id:'full',label:'Full tale',description:'Each turn is told in a few vivid sentences, and people say their piece.'},
 {id:'brief',label:'Not so wordy',description:'Just the essentials: a line or three of story each turn, and people keep it short.'},
];
export const briefTelling=prefs=>prefs?.length==='brief';
// autoShield: whether the game casts Shield for the hero when it turns a hit into a miss (Settings → Story → Rules).
// easyStart: whether a new tale begins with the hero's orders in hand (a clear first errand from someone in charge),
// whatever the opening; on unless the player turns it off (the New Adventure screen). The Skirmish ignores it.
const defaults={brutality:'gritty',narrator:'chronicler',autoShield:true,easyStart:true,length:'full'};
function load(){try{const v=JSON.parse(globalThis.localStorage?.getItem(KEY)??'{}');return {...defaults,...(brutalityLevels.some(l=>l.id===v?.brutality)?{brutality:v.brutality}:{}),...(narrators.some(n=>n.id===v?.narrator)?{narrator:v.narrator}:{}),...(typeof v?.autoShield==='boolean'?{autoShield:v.autoShield}:{}),...(typeof v?.easyStart==='boolean'?{easyStart:v.easyStart}:{}),...(tellingLengths.some(l=>l.id===v?.length)?{length:v.length}:{})};}catch{return {...defaults};}}
let prefs=load();const listeners=new Set();
export const storyPreferences=()=>({...prefs});
export function subscribeStoryPreferences(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function setStoryPreferences(changes){
 if(changes.brutality&&!brutalityLevels.some(l=>l.id===changes.brutality))return;
 if(changes.narrator&&!narrators.some(n=>n.id===changes.narrator))return;
 if(changes.autoShield!==undefined&&typeof changes.autoShield!=='boolean')return;
 if(changes.easyStart!==undefined&&typeof changes.easyStart!=='boolean')return;
 if(changes.length!==undefined&&!tellingLengths.some(l=>l.id===changes.length))return;
 prefs={...prefs,...changes};try{globalThis.localStorage?.setItem(KEY,JSON.stringify(prefs));}catch{}
 listeners.forEach(fn=>fn(storyPreferences()));
}
// The hero as the rules see them on this device: the player's choices about reactions travel with every action.
export const rulesHero=(hero,prefs=storyPreferences())=>hero&&prefs.autoShield===false?{...hero,autoShield:false}:hero;
// Which opening a new tale is asked for and whether it is an easy start (Easy start on, any opening but the Skirmish).
// Let fate decide with Easy start on is Easy to get into: the same tale of the writer's choosing with orders in hand,
// stocked ahead so it starts in seconds. The next tale in a region is always asked for as Let fate decide.
export function taleStart({selected,continuing=false,easyStart=true}){
 const easy=easyStart!==false&&(continuing||selected!=='hostile');
 return {introId:continuing?'surprise':easy&&selected==='surprise'?'easy':selected,easyStart:easy};
}
