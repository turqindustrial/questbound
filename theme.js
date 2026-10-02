import {Platform} from 'react-native';
import {defaultTheme,validTheme,mapColours,writtenColour,themedText} from './themeRules';
// Shared visual language: a dark theme in the player's colour (Settings → Theme; dark red on black with purple accents
// unless they choose another), engraved display type and storybook serif narration.
//
// Colours are written once, as the Red theme, and wrapped in tint(): on the web each becomes a style variable
// (`var(--qb-e04a5c)`) whose value follows the chosen theme, so a change of theme repaints everything at once with no
// reload. themeRules.js works out what each written colour becomes. Write new screen colours as tint('#e04a5c') or
// tint('0 0 12px rgba(178,34,58,.5)'); a colour that carries a meaning (healing green, arcane teal, the red-orange
// of blood and danger, amber warnings, coin gold) is left as it is by tint() and may be written plain.
//
// The colour names below are from the first look (candlelit gold on ink) and are kept so every screen still reads the
// same tokens: `gold` is the theme's main colour (key text, icons, edges), `goldMid` its accent (small labels, marks),
// `goldBright` the pale accent of whatever is selected or lit, `goldDeep`/`goldLine`/`goldFaint` the dark main colour
// of rules and borders. Real gold (coins) is `coin`.
const web=Platform.OS==='web';
const KEY='questbound.theme.v1';
function load(){try{return validTheme(JSON.parse(globalThis.localStorage?.getItem(KEY)??'{}')?.theme);}catch{return defaultTheme;}}
let current=load(),queued=false;
const listeners=new Set(),written=new Map(),extras=[];
// One style rule holds every colour variable; it is rewritten when the theme changes or a new colour is first used.
function paint(){
 queued=false;if(typeof document==='undefined')return;
 let sheet=document.getElementById('questbound-colours');
 if(!sheet){sheet=document.createElement('style');sheet.id='questbound-colours';document.head.appendChild(sheet);}
 let rules='';for(const [key,colour] of written)rules+='--qb-'+key+':'+writtenColour(colour,current)+';';
 for(const extra of extras)for(const [name,value] of Object.entries(extra(current)))rules+=name+':'+value+';';
 sheet.textContent=':root{'+rules+'}';document.documentElement.setAttribute('data-theme',current);
}
const schedule=()=>{if(queued)return;queued=true;(globalThis.queueMicrotask??(run=>Promise.resolve().then(run)))(paint);};
// A colour, or any text holding colours (a shadow, a gradient, a whole style sheet), ready to follow the theme.
export function tint(text){
 if(!web)return themedText(text,current);
 return mapColours(text,colour=>{if(!written.has(colour.key)){written.set(colour.key,colour);schedule();}return 'var(--qb-'+colour.key+')';});
}
// Style variables that are more than a colour (pictures written as text): `make(themeId)` returns {'--name': value}.
export function themeVariables(make){extras.push(make);schedule();}
export const currentTheme=()=>current;
export function subscribeTheme(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function setTheme(id){
 const next=validTheme(id);if(next===current)return;
 current=next;try{globalThis.localStorage?.setItem(KEY,JSON.stringify({theme:current}));}catch{}
 paint();listeners.forEach(listener=>listener(current));
}
export const fonts={
 logo:web?'"Cinzel Decorative", "Cinzel", Georgia, serif':'Georgia',
 display:web?'"Cinzel", "Trajan Pro", Georgia, serif':'Georgia',
 story:web?'"EB Garamond", Garamond, Georgia, serif':'Georgia',
 ui:web?'"Inter", "Segoe UI", system-ui, sans-serif':undefined,
};
export const colors={
 ink:tint('#08060a'),ink2:tint('#130e15'),ink3:tint('#1f1821'),
 gold:tint('#e04a5c'),goldBright:tint('#eadaff'),goldMid:tint('#b08cf5'),goldDeep:tint('#7d1b2e'),goldLine:tint('rgba(178,34,58,.6)'),goldFaint:tint('rgba(178,34,58,.24)'),
 accent:tint('#b08cf5'),accentDeep:tint('#5b34a8'),coin:'#e8c77b',
 parchment:tint('#f4ecee'),text:tint('#ddd6db'),muted:tint('#a99fa7'),faint:tint('#7a707a'),
 blood:'#c8412f',bloodBright:'#f06a4f',heal:'#6fbf8e',arcane:'#6fd0c4',danger:'#ffb3ac',
};
export const type={
 eyebrow:{fontFamily:fonts.display,fontSize:11,letterSpacing:3.2,color:colors.goldMid,textTransform:'uppercase'},
 heading:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:1,color:colors.parchment},
 subheading:{fontFamily:fonts.display,fontSize:16,fontWeight:'600',letterSpacing:1.2,color:colors.gold},
 story:{fontFamily:fonts.story,fontSize:19,lineHeight:30,color:tint('#ece4e2')},
 body:{fontFamily:fonts.ui,fontSize:15,lineHeight:24,color:colors.text},
 caption:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:19,color:colors.muted},
 label:{fontFamily:fonts.display,fontSize:10,letterSpacing:2,color:colors.goldMid,textTransform:'uppercase'},
};
