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
export function useShownHp(){const [value,setValue]=useState(shown);useEffect(()=>{setValue(shown);hpListeners.add(setValue);return()=>{hpListeners.delete(setValue);};},[]);return value;}
