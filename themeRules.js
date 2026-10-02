// Colour themes. The game's colours are written once, as the Red theme (dark red on black with purple accents), and
// every other theme is worked out from them: each written colour belongs to a family (the main colour, the accent, or
// the near-black and near-white neutrals) and a theme says where each family goes. Colours that carry a meaning
// (healing green, arcane teal, the red-orange of blood and danger, amber warnings, coin gold, the parchment maps)
// belong to no family and are the same in every theme.
// The sums are done in OKLCH (lightness, chroma, hue), where turning the hue keeps a colour as light as it looked.
export const themeChoices=[
 {id:'red',label:'Red',swatch:'#e04a5c',accentSwatch:'#b08cf5'},
 {id:'orange',label:'Orange',main:{hue:52,chroma:.95,lift:.09},accent:{hue:88,chroma:.6,lift:.1},neutral:{hue:55,chroma:1}},
 {id:'gold',label:'Gold',main:{hue:88,chroma:.62,lift:.19},accent:{hue:62,chroma:.6,lift:.08},neutral:{hue:265,chroma:1.5}},
 {id:'green',label:'Green',main:{hue:152,chroma:.82,lift:.12},accent:{hue:92,chroma:.55,lift:.1},neutral:{hue:165,chroma:1.1}},
 {id:'blue',label:'Blue',main:{hue:252,chroma:.82,lift:.06},accent:{hue:300,chroma:.9,lift:0},neutral:{hue:262,chroma:1.5}},
 {id:'purple',label:'Purple',main:{hue:300,chroma:.95,lift:.05},accent:{hue:8,chroma:.8,lift:.04},neutral:{hue:300,chroma:1.1}},
];
export const defaultTheme='red';
export const themeIds=themeChoices.map(choice=>choice.id);
export const validTheme=id=>themeIds.includes(id)?id:defaultTheme;
const toLinear=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
const fromLinear=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
export function rgbToOklch(r,g,b){
 const lr=toLinear(r),lg=toLinear(g),lb=toLinear(b);
 const l=Math.cbrt(.4122214708*lr+.5363325363*lg+.0514459929*lb),m=Math.cbrt(.2119034982*lr+.6806995451*lg+.1073969566*lb),s=Math.cbrt(.0883024619*lr+.2817188376*lg+.6299787005*lb);
 const L=.2104542553*l+.793617785*m-.0040720468*s,A=1.9779984951*l-2.428592205*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.808675766*s;
 return [L,Math.hypot(A,B),(Math.atan2(B,A)*180/Math.PI+360)%360];
}
function oklchToLinear(L,C,h){
 const A=C*Math.cos(h*Math.PI/180),B=C*Math.sin(h*Math.PI/180);
 const l=Math.pow(L+.3963377774*A+.2158037573*B,3),m=Math.pow(L-.1055613458*A-.0638541728*B,3),s=Math.pow(L-.0894841775*A-1.291485548*B,3);
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
}
// Back to a colour a screen can show: chroma is given up, a little at a time, until it fits.
export function oklchToRgb(L,C,h){
 L=Math.max(0,Math.min(1,L));
 const fits=rgb=>rgb.every(v=>v>=-.0005&&v<=1.0005);
 let rgb=oklchToLinear(L,C,h);
 if(!fits(rgb)){let low=0,high=C;for(let i=0;i<18;i++){const mid=(low+high)/2;if(fits(oklchToLinear(L,mid,h)))low=mid;else high=mid;}rgb=oklchToLinear(L,low,h);}
 return rgb.map(v=>Math.round(Math.max(0,Math.min(1,fromLinear(Math.max(0,Math.min(1,v)))))*255));
}
// Written colours that look like a family colour but carry a meaning, so they stay as written: the pale red of error
// text and the reds of wounds.
const kept=new Set(['255,179,172','200,30,20','120,20,14','20,4,4']);
// Which family a written colour belongs to: 'main' (the reds), 'accent' (the violets), 'neutral' (the plum-tinted
// near-blacks, greys and near-whites) or null (it means something, or it is another colour altogether: warm bone
// text, wound reds, greens, teals, ambers and the map's parchment all stay as written).
export function colourFamily(r,g,b){
 if(kept.has(r+','+g+','+b))return null;
 const [,C,h]=rgbToOklch(r,g,b);
 if(C<.004)return null;
 if(h>=345||h<=21.5)return C<.032?'neutral':'main';
 if(h>=268&&h<=314)return C<.045?'neutral':'accent';
 if(h>314&&h<345)return C<.07?'neutral':null;
 return null;
}
const smooth=(low,high,x)=>{const t=Math.max(0,Math.min(1,(x-low)/(high-low)));return t*t*(3-2*t);};
// A written colour in a theme, as [r,g,b]. The Red theme is the colours as written.
export function themedRgb(r,g,b,themeId){
 const theme=themeChoices.find(choice=>choice.id===themeId);
 if(!theme||!theme.main)return [r,g,b];
 const family=colourFamily(r,g,b);
 if(!family)return [r,g,b];
 const [L,C,h]=rgbToOklch(r,g,b);
 if(family==='neutral')return oklchToRgb(L,C*theme.neutral.chroma,theme.neutral.hue);
 const to=theme[family],centre=family==='main'?16:298,offset=((h-centre+540)%360)-180;
 return oklchToRgb(Math.min(.985,L+to.lift*smooth(.42,.72,L)),C*to.chroma,(to.hue+offset*.6+360)%360);
}
const colourPattern=/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;
const hexOf=(r,g,b)=>[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
// Every family colour written in a piece of text (a single colour, a shadow, a whole style sheet) is handed to
// `replace(colour)`, where colour is {key, r, g, b, alpha, hex}; what it returns is written in its place.
export function mapColours(text,replace){
 return String(text).replace(colourPattern,(whole,hex,r,g,b,alpha)=>{
  if(hex){const full=hex.length===3?hex.split('').map(c=>c+c).join(''):hex;r=parseInt(full.slice(0,2),16);g=parseInt(full.slice(2,4),16);b=parseInt(full.slice(4,6),16);}
  else{r=+r;g=+g;b=+b;}
  if(r>255||g>255||b>255||!colourFamily(r,g,b))return whole;
  const a=alpha===undefined?1:Math.max(0,Math.min(1,Number(alpha)));
  return replace({key:hexOf(r,g,b)+(a<1?'-'+String(Math.round(a*1000)).padStart(3,'0'):''),r,g,b,alpha:a,hex:!!hex,alphaText:alpha})??whole;
 });
}
// The same colour written out for a theme, in the form it was written in.
export function writtenColour(colour,themeId){
 const [r,g,b]=themedRgb(colour.r,colour.g,colour.b,themeId);
 return colour.alpha<1||!colour.hex?(colour.alphaText===undefined?'rgb('+r+','+g+','+b+')':'rgba('+r+','+g+','+b+','+colour.alphaText+')'):'#'+hexOf(r,g,b);
}
// A piece of text with every family colour written out for a theme (used where a style variable cannot reach: inside
// pictures written as text, and on devices without style variables).
export const themedText=(text,themeId)=>themeId===defaultTheme?String(text):mapColours(text,colour=>writtenColour(colour,themeId));
// The colour dots shown for a theme in Settings: its main colour and its accent.
export function themeSwatches(themeId){
 const show=(r,g,b)=>'#'+hexOf(...themedRgb(r,g,b,themeId));
 return {main:show(224,74,92),accent:show(176,140,245),deep:show(124,18,39)};
}
