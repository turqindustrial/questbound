import {useEffect,useState} from 'react';
// Cinematic cues (a hit on you, a critical, a new round, victory, defeat, a level gained) travel from the story feed to
// the overlay layer and the play area through this small hub, so the feed never needs to know who is watching.
const listeners=new Set();let sequence=0;
export function cue(kind,data={}){const event={id:++sequence,kind,...data};for(const fn of [...listeners])try{fn(event);}catch{}}
// Development builds expose the hub so the overlays can be previewed from the browser console.
if(process.env.NODE_ENV!=='production'&&typeof window!=='undefined')window.__questboundCue=cue;
export function useCue(handler){useEffect(()=>{listeners.add(handler);return()=>{listeners.delete(handler);};},[handler]);}
// While a turn plays back, the HP bars follow the story (a blow lands, the bar drops) instead of jumping to the result.
let shown={hero:null,foe:null};const hpListeners=new Set();
export function setShownHp(value){const next=value?{hero:value.hero??null,foe:value.foe??null}:{hero:null,foe:null};if(next.hero===shown.hero&&next.foe===shown.foe)return;shown=next;for(const fn of [...hpListeners])fn(shown);}
// Whether the story feed is playing a turn back now (TurnPlayback.js through useDmTurn.js), so a card that follows a
// turn (App.js: a written tale's completion card) waits until its scene has been played.
let feedPlaying=false;const playListeners=new Set();
export function setFeedPlaying(on){const next=!!on;if(next===feedPlaying)return;feedPlaying=next;for(const fn of [...playListeners])fn(feedPlaying);}
export function useFeedPlaying(){const [value,setValue]=useState(feedPlaying);useEffect(()=>{setValue(feedPlaying);playListeners.add(setValue);return()=>{playListeners.delete(setValue);};},[]);return value;}
export function useShownHp(){const [value,setValue]=useState(shown);useEffect(()=>{setValue(shown);hpListeners.add(setValue);return()=>{hpListeners.delete(setValue);};},[]);return value;}
