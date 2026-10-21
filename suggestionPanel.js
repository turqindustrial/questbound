// The Suggestions panel on this device (DungeonMaster.js draws it; DmSuggestions.js its strip): open or closed, and the
// sub-tab (say, speak or actions) last chosen. It starts closed and is remembered per device.
export const panelKey='questbound.suggestions.v1';
export const loadPanel=()=>{try{const v=JSON.parse(globalThis.localStorage?.getItem(panelKey)??'null');return {open:v?.open===true,tab:['say','speak','actions'].includes(v?.tab)?v.tab:'say'};}catch{return {open:false,tab:'say'};}};
// Whether the Dungeon Master's lines to say would go unseen here: out of battle they show only while the panel is open
// (round 3 of leaner turns, 2026-10-21, the host: "the lowest possible cost per turn"). A turn sent with the panel
// closed says so (suggest:false) and the reply writes none, as output costs five times input; in battle the Say tab
// shows whatever the reply offers, so the Dungeon Master server asks for them there whatever this says. Opened later,
// the panel offers the game's own stand-ins (greetings.js replyIdeas) until the next turn.
export const suggestionsClosed=()=>!loadPanel().open;
// What a turn's request carries about it: nothing while the panel is open, as before.
export const suggestionsFlag=()=>suggestionsClosed()?{suggest:false}:{};
