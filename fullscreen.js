// Full screen for the web build. Desktop and Android browsers use the Fullscreen API.
// iPhone browsers do not allow it for web pages, so there the game is added to the Home Screen and opens full screen from there.
const KEY='questbound.display.v1';
const doc=()=>typeof document!=='undefined'?document:null;
function load(){try{return {autoFullscreen:false,...JSON.parse(globalThis.localStorage?.getItem(KEY)??'{}')};}catch{return {autoFullscreen:false};}}
let prefs=load();const listeners=new Set();
const notify=()=>listeners.forEach(fn=>fn(displayState()));
export function displayState(){return {fullscreen:isFullscreen(),supported:fullscreenSupported(),installed:isInstalled(),ios:isIOS(),autoFullscreen:prefs.autoFullscreen};}
export function subscribeDisplay(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function setDisplayPrefs(changes){prefs={...prefs,...changes};try{globalThis.localStorage?.setItem(KEY,JSON.stringify(prefs));}catch{}notify();}
export function fullscreenSupported(){const d=doc();if(!d)return false;const el=d.documentElement;return !!(el.requestFullscreen||el.webkitRequestFullscreen)&&(d.fullscreenEnabled??d.webkitFullscreenEnabled??false)!==false;}
export function isFullscreen(){const d=doc();return !!(d&&(d.fullscreenElement||d.webkitFullscreenElement));}
export function isInstalled(){try{return globalThis.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches||globalThis.navigator?.standalone===true;}catch{return false;}}
export function isIOS(){const n=globalThis.navigator;return !!n&&(/iPad|iPhone|iPod/.test(n.userAgent)||(n.platform==='MacIntel'&&n.maxTouchPoints>1));}
// Must run inside a tap or key press: browsers only grant full screen in response to the player.
export async function enterFullscreen(){
 const el=doc()?.documentElement;if(!el||isFullscreen())return true;
 try{if(el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();}catch{return false;}
 // Games feel best locked to the orientation the player is holding; unsupported browsers simply ignore this.
 try{await globalThis.screen?.orientation?.lock?.(globalThis.screen.orientation.type);}catch{}
 return isFullscreen();
}
export async function exitFullscreen(){const d=doc();if(!d||!isFullscreen())return;try{if(d.exitFullscreen)await d.exitFullscreen();else d.webkitExitFullscreen?.();}catch{}}
export const toggleFullscreen=()=>isFullscreen()?exitFullscreen():enterFullscreen();
export function initializeFullscreen(){
 const d=doc();if(!d)return;
 // Home-screen and install support: manifest, Apple web-app tags and the icon.
 const head=d.head,add=(tag,attrs)=>{const el=d.createElement(tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));head.appendChild(el);};
 if(!d.querySelector('link[rel="manifest"]'))add('link',{rel:'manifest',href:'/manifest.json'});
 add('meta',{name:'apple-mobile-web-app-capable',content:'yes'});add('meta',{name:'mobile-web-app-capable',content:'yes'});
 add('meta',{name:'apple-mobile-web-app-status-bar-style',content:'black-translucent'});add('meta',{name:'apple-mobile-web-app-title',content:'Questbound'});
 add('link',{rel:'apple-touch-icon',href:'/icons/apple-touch-icon.png'});
 ['fullscreenchange','webkitfullscreenchange'].forEach(e=>d.addEventListener(e,notify));
 // Optional: enter full screen on the first tap of each visit.
 const auto=event=>{if(!prefs.autoFullscreen||isFullscreen()||isInstalled()||!fullscreenSupported())return;if(event.type==='keydown'&&['Escape','f','F'].includes(event.key))return;enterFullscreen();};
 d.addEventListener('pointerup',auto,true);d.addEventListener('keydown',auto,true);
 // F toggles full screen when not typing.
 d.addEventListener('keydown',event=>{const t=event.target;if(event.key!=='f'&&event.key!=='F')return;if(event.ctrlKey||event.metaKey||event.altKey||t?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(t?.tagName))return;if(fullscreenSupported()){event.preventDefault();toggleFullscreen();}});
}
