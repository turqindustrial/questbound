// Colour themes. The game's colours are written once, as the Red theme (dark red on black with purple accents), and
// every other theme is worked out from them: each written colour belongs to a family (the main colour, the accent, or
// the near-black and near-white neutrals) and a theme says where each family goes. Colours that carry a meaning
// (healing green, arcane teal, the red-orange of blood and danger, amber warnings, coin gold, the parchment maps)
// belong to no family and are the same in every theme.
// The sums are done in OKLCH (lightness, chroma, hue), where turning the hue keeps a colour as light as it looked.
export const themeChoices=[
 {id:'red',label:'Red',swatch:'#e04a5c',accentSwatch:'#b08cf5',paper:{hue:62,chroma:.017}},
 {id:'orange',label:'Orange',main:{hue:52,chroma:.95,lift:.09},accent:{hue:88,chroma:.6,lift:.1},neutral:{hue:55,chroma:1},paper:{hue:70,chroma:.019},emblem:'hue-rotate(62deg) saturate(0.95) brightness(1.25)'},
 {id:'gold',label:'Gold',main:{hue:88,chroma:.62,lift:.19},accent:{hue:62,chroma:.6,lift:.08},neutral:{hue:265,chroma:1.5},paper:{hue:86,chroma:.021,main:74},emblem:'grayscale(1) sepia(1) saturate(2.4) hue-rotate(-2deg) brightness(1.4) contrast(1.25)'},
 {id:'green',label:'Green',main:{hue:152,chroma:.82,lift:.12},accent:{hue:92,chroma:.55,lift:.1},neutral:{hue:165,chroma:1.1},paper:{hue:112,chroma:.016},emblem:'hue-rotate(181deg) saturate(1.22) brightness(1.25)'},
 {id:'blue',label:'Blue',main:{hue:252,chroma:.82,lift:.06},accent:{hue:300,chroma:.9,lift:0},neutral:{hue:262,chroma:1.5},paper:{hue:240,chroma:.009},emblem:'hue-rotate(223deg) saturate(1.33) brightness(1.17)'},
 {id:'purple',label:'Purple',main:{hue:300,chroma:.95,lift:.05},accent:{hue:8,chroma:.8,lift:.04},neutral:{hue:300,chroma:1.1},paper:{hue:64,chroma:.014},emblem:'hue-rotate(294deg) saturate(0.8) brightness(1.25)'},
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
export function mapColours(text,replace,all=false){
 return String(text).replace(colourPattern,(whole,hex,r,g,b,alpha)=>{
  if(hex){const full=hex.length===3?hex.split('').map(c=>c+c).join(''):hex;r=parseInt(full.slice(0,2),16);g=parseInt(full.slice(2,4),16);b=parseInt(full.slice(4,6),16);}
  else{r=+r;g=+g;b=+b;}
  if(r>255||g>255||b>255||(!all&&!colourFamily(r,g,b)))return whole;
  const a=alpha===undefined?1:Math.max(0,Math.min(1,Number(alpha)));
  return replace({key:hexOf(r,g,b)+(a<1?'-'+String(Math.round(a*1000)).padStart(3,'0'):''),r,g,b,alpha:a,hex:!!hex,alphaText:alpha})??whole;
 });
}
// The same colour written out for a theme, in the form it was written in.
// Light (Settings, Theme, the Dark mode switch off; 2026-10-12, the host: "light mode looks horrible, rework that to
// not be so harsh on the eyes ... I want light mode to actually look good"): the game is still written once, as dark
// Red, and Light works out what each written colour is for from its family and its lightness. Dark surfaces become
// layers of warm paper (the page a soft parchment, raised panels a lighter sheet, never pure white), greys between
// them soft rules, light lettering ink (dark but never black, in the theme's own neutral), the main colour and the
// accent deeper and quieter (never neon), and the primary fill stays deep with cream lettering, as it is in Dark.
// Meanings keep their hue, deepened to read on paper. Black shadows become a soft warm brown at under half their
// strength. Each theme names its paper (`paper`: hue and chroma; Blue's is a cool stone, the rest warm parchment), and
// Gold takes its main colour to bronze (`paper.main`), since a deep yellow reads as olive. `lightPalette` names the
// tones (verify-theme.cjs checks their contrast), and webTheme.js reads them as --ql-* variables for the pieces drawn
// in its style sheet.
export function lightPalette(themeId){
 const theme=themeChoices.find(choice=>choice.id===validTheme(themeId)),paper=theme.paper??{hue:62,chroma:.017};
 const hueOf=rgb=>rgbToOklch(...rgb)[2],main=paper.main??hueOf(themedRgb(224,74,92,theme.id)),accent=hueOf(themedRgb(176,140,245,theme.id)),neutral=hueOf(themedRgb(39,30,41,theme.id));
 const tone=(L,C,h)=>oklchToRgb(L,C,h);
 return {theme:theme.id,hues:{main,accent,neutral,paper:paper.hue},mainShift:paper.main===undefined?0:paper.main-hueOf(themedRgb(224,74,92,theme.id)),paperChroma:paper.chroma,
  page:tone(.936,paper.chroma,paper.hue),panel:tone(.962,paper.chroma*.8,paper.hue),raised:tone(.977,paper.chroma*.6,paper.hue),well:tone(.915,paper.chroma*1.1,paper.hue),
  line:tone(.84,paper.chroma*1.3,paper.hue),ink:tone(.27,.022,neutral),muted:tone(.42,.02,neutral),faint:tone(.5,.018,neutral),
  main:tone(.47,.13,main),mainSoft:tone(.9,.035,main),fill:tone(.47,.135,main),fillTop:tone(.53,.13,main),fillEdge:tone(.39,.11,main),onFill:tone(.985,.012,main),
  accent:tone(.47,.12,accent),accentSoft:tone(.915,.03,accent),accentDeep:tone(.38,.11,accent),
  shadow:tone(.3,.03,paper.hue),blush:tone(.925,.03,32),blood:tone(.5,.15,32),heal:tone(.47,.11,155),arcane:tone(.48,.08,190),coin:tone(.5,.1,78)};
}
const paletteCache=new Map();
const paletteOf=themeId=>{if(!paletteCache.has(themeId))paletteCache.set(themeId,lightPalette(themeId));return paletteCache.get(themeId);};
// The primary fill (#9e1b32), its edge (#f06e80) and its lettering (#ffeef0) are written only for primary buttons and
// badges, so in Light they keep their roles: a deep fill, a deeper edge and cream lettering. The map's brown ink and
// parchment tools sit on the parchment map, which is the same in both appearances.
const lightRoles={'158,27,50':'fill','240,110,128':'fillEdge','255,238,240':'onFill'};
const keptInLight=new Set(['59,42,23','237,222,182','246,235,203','255,255,255']);
function lightRgb(r,g,b,themeId){
 const key=r+','+g+','+b,p=paletteOf(validTheme(themeId));
 if(lightRoles[key])return p[lightRoles[key]];
 if(keptInLight.has(key))return [r,g,b];
 if(r===0&&g===0&&b===0)return p.shadow;
 const family=colourFamily(r,g,b);let [L,C,h]=rgbToOklch(...themedRgb(r,g,b,themeId)),paper=p.hues.paper,ink=p.hues.neutral;
 if(family==='neutral'||(!family&&C<.035)){
  // Surfaces: the darker the written surface, the deeper the paper (the page), the lighter it was, the brighter the sheet.
  if(L<.3){const t=Math.max(-.15,Math.min(1,(L-.128)/.17));return oklchToRgb(.936+t*.042,p.paperChroma*(1-.35*Math.max(0,t)),paper);}
  if(L<.52)return oklchToRgb(.86-(L-.3)*.5,p.paperChroma*1.4,paper);
  return oklchToRgb(Math.max(.24,.25+(.96-L)*.62),Math.min(C,.022)+.004,ink);
 }
 if(family==='main'){
  h+=p.mainShift;
  if(L<.3)return oklchToRgb(.925,.03,h);
  if(L<.56)return oklchToRgb(.52,Math.min(C,.12),h);
  if(L<.85)return oklchToRgb(Math.max(.4,.47-(L-.62)*.25),Math.min(C,.14),h);
  return oklchToRgb(.4,Math.min(C,.12),h);
 }
 if(family==='accent'){
  if(L<.35)return oklchToRgb(.915,.03,h);
  if(L<.6)return oklchToRgb(.5,Math.min(C,.13),h);
  if(L<.85)return oklchToRgb(.47,Math.min(C,.13),h);
  return oklchToRgb(.38,Math.min(C,.12),h);
 }
 // Colours that mean something keep their hue: dark fills (written only as backgrounds on ink) become a pale wash, mid tones are deepened a little to
 // read on paper, and light lettering becomes ink of its own colour.
 if(L<.45)return oklchToRgb(.925,Math.min(C,.04),h);
 if(L<.62)return L<=.5?[r,g,b]:oklchToRgb(.5,Math.min(C,.17),h);
 return oklchToRgb(Math.max(.39,.46-(L-.62)*.2),Math.min(C,.14),h);
}
export function appearanceRgb(r,g,b,themeId,mode='dark'){
 return mode==='light'?lightRgb(r,g,b,themeId):themedRgb(r,g,b,themeId);
}
export function writtenColour(colour,themeId,mode='dark'){
 const [r,g,b]=appearanceRgb(colour.r,colour.g,colour.b,themeId,mode);
 // A black shadow on paper is a soft brown one at under half its strength.
 const alphaText=mode==='light'&&colour.r===0&&colour.g===0&&colour.b===0&&colour.alpha<1?String(+(colour.alpha*.42).toFixed(3)):colour.alphaText;
 return colour.alpha<1||!colour.hex?(alphaText===undefined?'rgb('+r+','+g+','+b+')':'rgba('+r+','+g+','+b+','+alphaText+')'):'#'+hexOf(r,g,b);
}
// A piece of text with every family colour written out for a theme (used where a style variable cannot reach: inside
// pictures written as text, and on devices without style variables).
export const themedText=(text,themeId,mode='dark')=>themeId===defaultTheme&&mode==='dark'?String(text):mapColours(text,colour=>writtenColour(colour,themeId,mode),mode==='light');
// The colour dots shown for a theme in Settings: its main colour and its accent.
export function themeSwatches(themeId){
 const show=(r,g,b)=>'#'+hexOf(...themedRgb(r,g,b,themeId));
 return {main:show(224,74,92),accent:show(176,140,245),deep:show(124,18,39)};
}
// The emblem (the host's painting, make-emblem.cjs) is a picture, so a theme reaches it as a CSS filter on the whole
// emblem (`emblem` in themeChoices): a hue turn, saturation and brightness that bring the painting's crimsons to the
// theme's main colour (verify-theme.cjs checks where they land, with the filters' own sums below). Red is the painting
// as it is; the filter does not change with Light, where the emblem sits on a dark disc of its own.
// Gold is made differently (2026-10-10, the host: "maybe gold is a good idea"): a hue turn left the crimson olive and
// amber, so the painting is first taken to its light and shade (grayscale), toned like old metal (sepia), and that tone
// is deepened and warmed (saturate, a small hue turn) and given its shine (brightness, contrast): pale yellow-gold in
// the highlights, deep bronze in the shadows.
// The page's own background (the ink every screen is drawn on) in a theme and mode: the phone's browser bars take it
// (<meta name=theme-color>, theme.js), so no light bar sits above or below the game.
export const pageBackground=(themeId,mode='dark')=>themedText('#08060a',themeId,mode);
export const emblemFilter=themeId=>themeChoices.find(choice=>choice.id===validTheme(themeId))?.emblem??'none';
// What a CSS filter made of grayscale, sepia, saturate, hue-rotate, brightness and contrast (in the order written, as
// the browser applies them) makes of a colour.
export function filteredRgb([r,g,b],filter){
 const mix=(m,x)=>m.map(row=>Math.max(0,Math.min(1,row[0]*x[0]+row[1]*x[1]+row[2]*x[2])));
 const steps={
  grayscale:(a,x)=>{const k=1-Math.min(1,a);return mix([[.2126+.7874*k,.7152-.7152*k,.0722-.0722*k],[.2126-.2126*k,.7152+.2848*k,.0722-.0722*k],[.2126-.2126*k,.7152-.7152*k,.0722+.9278*k]],x);},
  sepia:(a,x)=>{const k=1-Math.min(1,a);return mix([[.393+.607*k,.769-.769*k,.189-.189*k],[.349-.349*k,.686+.314*k,.168-.168*k],[.272-.272*k,.534-.534*k,.131+.869*k]],x);},
  saturate:(sat,x)=>mix([[.213+.787*sat,.715-.715*sat,.072-.072*sat],[.213-.213*sat,.715+.285*sat,.072-.072*sat],[.213-.213*sat,.715-.715*sat,.072+.928*sat]],x),
  'hue-rotate':(turn,x)=>{const c=Math.cos(turn*Math.PI/180),s=Math.sin(turn*Math.PI/180);
   return mix([[.213+c*.787-s*.213,.715-c*.715-s*.715,.072-c*.072+s*.928],[.213-c*.213+s*.143,.715+c*.285+s*.14,.072-c*.072-s*.283],[.213-c*.213-s*.787,.715-c*.715+s*.715,.072+c*.928+s*.072]],x);},
  brightness:(v,x)=>x.map(c=>Math.max(0,Math.min(1,c*v))),
  contrast:(v,x)=>x.map(c=>Math.max(0,Math.min(1,c*v+.5-.5*v))),
 };
 let x=[r/255,g/255,b/255];
 for(const [,name,value] of String(filter).matchAll(/([a-z-]+)\(([-\d.]+)(?:deg)?\)/g))if(steps[name])x=steps[name](parseFloat(value),x);
 return x.map(v=>Math.round(v*255));
}
