const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Colour themes (themeRules.js, theme.js, ThemeControls.js): what each written colour becomes in each theme, that
// every screen colour is wrapped in tint() so a theme can reach it, and that the loading card in public/index.html
// carries the same colours, and that the emblem's tint lands on each theme's colour. `node verify-theme.cjs --write`
// rewrites the loading card's table after a change to the themes.
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('themeRules.js','utf8').replace(/^export (const|function)/gm,'$1')+'\n;this.out={themeChoices,defaultTheme,themeIds,validTheme,rgbToOklch,oklchToRgb,colourFamily,themedRgb,mapColours,writtenColour,themedText,themeSwatches,emblemFilter,filteredRgb};',ctx);
const {themeChoices,defaultTheme,themeIds,validTheme,rgbToOklch,oklchToRgb,colourFamily,themedRgb,mapColours,themedText,themeSwatches,emblemFilter,filteredRgb}=ctx.out;
const plain=value=>JSON.parse(JSON.stringify(value));
// The six choices the host asked for, Red first (the look the game is written in).
assert.deepEqual(plain(themeIds),['red','orange','gold','green','blue','purple']);assert.equal(defaultTheme,'red');
assert.equal(validTheme('green'),'green');assert.equal(validTheme('pink'),'red');assert.equal(validTheme(undefined),'red');
for(const choice of themeChoices)assert.ok(choice.label&&/^[A-Z]/.test(choice.label));
// The sums: there and back again, and nothing leaves what a screen can show.
for(const rgb of [[224,74,92],[8,6,10],[255,255,255],[111,191,142],[176,140,245],[0,0,0]]){const back=plain(oklchToRgb(...rgbToOklch(...rgb)));for(let i=0;i<3;i++)assert.ok(Math.abs(back[i]-rgb[i])<=1,rgb+' -> '+back);}
for(let h=0;h<360;h+=30)for(const rgb of [oklchToRgb(.7,.4,h),oklchToRgb(.2,.3,h)])for(const v of rgb)assert.ok(Number.isInteger(v)&&v>=0&&v<=255);
// Families: the reds are the main colour, the violets the accent, plum near-blacks and greys the neutrals.
assert.equal(colourFamily(224,74,92),'main');assert.equal(colourFamily(178,34,58),'main');assert.equal(colourFamily(124,18,39),'main');assert.equal(colourFamily(255,225,229),'main');
assert.equal(colourFamily(176,140,245),'accent');assert.equal(colourFamily(48,26,78),'accent');assert.equal(colourFamily(140,82,255),'accent');
assert.equal(colourFamily(8,6,10),'neutral');assert.equal(colourFamily(221,214,219),'neutral');assert.equal(colourFamily(39,30,41),'neutral');assert.equal(colourFamily(85,67,87),'neutral');
// What a colour means does not change with the theme: healing, the arcane, blood and danger, warnings, coins, parchment, bone text.
for(const rgb of [[111,191,142],[111,208,196],[200,65,47],[240,106,79],[255,179,172],[200,30,20],[232,199,123],[224,168,96],[237,222,182],[230,223,205],[60,18,14],[0,0,0],[255,255,255]]){
 assert.equal(colourFamily(...rgb),null,rgb.join(','));for(const id of themeIds)assert.deepEqual(plain(themedRgb(...rgb,id)),rgb);
}
// Red is the colours as written; every other theme moves all three families and lands on its own hue.
const sample='border:1px solid rgba(178,34,58,.6);color:#e04a5c;box-shadow:0 0 12px rgba(140,82,255,.25),inset 0 0 0 1px #08060a;background:#6fbf8e';
assert.equal(themedText(sample,'red'),sample);
const hue=rgb=>rgbToOklch(...rgb)[2],near=(a,b,by)=>Math.abs(((a-b+540)%360)-180)<=by;
const wanted={orange:52,gold:88,green:152,blue:252,purple:300};
for(const id of themeIds.filter(id=>id!=='red')){
 const text=themedText(sample,id);
 assert.notEqual(text,sample);assert.ok(text.includes('#6fbf8e'),'healing green stays');assert.ok(/rgba\(\d+,\d+,\d+,\.6\)/.test(text)&&/rgba\(\d+,\d+,\d+,\.25\)/.test(text),'alpha is kept as written');
 assert.ok(!text.includes('#e04a5c')&&!text.includes('178,34,58')&&!text.includes('140,82,255')&&!text.includes('#08060a'));
 assert.ok(near(hue(themedRgb(224,74,92,id)),wanted[id],14),id+' main hue '+hue(themedRgb(224,74,92,id)));
 assert.ok(near(hue(themedRgb(178,34,58,id)),wanted[id],16),id+' line hue');
 // Dark stays dark and light stays light, so every screen keeps its contrast.
 for(const rgb of [[8,6,10],[19,14,21],[39,30,41]])assert.ok(rgbToOklch(...themedRgb(...rgb,id))[0]<.3,id+' background');
 for(const rgb of [[221,214,219],[244,236,238]])assert.ok(rgbToOklch(...themedRgb(...rgb,id))[0]>.85,id+' text');
}
// Readable in every theme (WCAG contrast): the main colour, the accent and body text on the page, and a primary button's lettering on its fill.
const luminance=rgb=>{const [r,g,b]=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*r+.7152*g+.0722*b;};
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05);};
for(const id of themeIds){
 const page=themedRgb(8,6,10,id),panel=themedRgb(30,22,32,id);
 assert.ok(contrast(themedRgb(224,74,92,id),page)>=4.5,id+' main on page '+contrast(themedRgb(224,74,92,id),page).toFixed(2));
 assert.ok(contrast(themedRgb(176,140,245,id),panel)>=4.5,id+' accent on panel');
 assert.ok(contrast(themedRgb(221,214,219,id),panel)>=7,id+' text on panel');
 assert.ok(contrast(themedRgb(255,238,240,id),themedRgb(165,26,51,id))>=4.5,id+' button lettering '+contrast(themedRgb(255,238,240,id),themedRgb(165,26,51,id)).toFixed(2));
}
// The emblem (a painting) is tinted by a filter: Red leaves it as painted, every other theme turns its crimson onto the
// theme's own hue (the filter's sums are the browser's: hue-rotate, saturate, brightness), each to a different colour.
// Gold is metal: the painting's light and shade toned (grayscale, sepia, saturate, a small hue turn, brightness and
// contrast), so every crimson, light or dark, lands on one gold ramp.
assert.equal(emblemFilter('red'),'none');assert.equal(emblemFilter('pink'),'none');
assert.match(emblemFilter('gold'),/^grayscale\(1\) sepia\(1\) saturate\([\d.]+\) hue-rotate\(-?\d+deg\) brightness\([\d.]+\) contrast\([\d.]+\)$/);
{const gold=rgb=>rgbToOklch(...filteredRgb(rgb,emblemFilter('gold')));
 // Highlights warm yellow-gold (not white, not lemon green), the body gold (not amber or orange, not olive), the shadows deep bronze.
 const [lit,litC,litH]=gold([255,170,200]),[mid,midC,midH]=gold([230,40,110]),[deep,deepC,deepH]=gold([90,10,40]);
 assert.ok(lit>=.9&&litC>=.08&&litH>=95&&litH<=112,'gold highlights '+[lit,litC,litH].map(v=>v.toFixed(2)));
 assert.ok(mid>=.6&&midC>=.1&&midH>=72&&midH<=95,'gold body '+[mid,midC,midH].map(v=>v.toFixed(2)));
 assert.ok(deep<=.35&&deepC>=.04&&deepH>=55&&deepH<=80,'gold shadows '+[deep,deepC,deepH].map(v=>v.toFixed(2)));
 assert.deepEqual(plain(filteredRgb([30,200,90],'contrast(0)')),[128,128,128]);assert.deepEqual(plain(filteredRgb([255,0,0],'grayscale(1)')),[54,54,54]);}
{const landed=[];for(const id of themeIds.filter(id=>id!=='red')){const filter=emblemFilter(id);if(id!=='gold')assert.match(filter,/^hue-rotate\(\d+deg\) saturate\([\d.]+\) brightness\([\d.]+\)$/,id);
 for(const rgb of [[230,40,110],[200,30,80]])assert.ok(near(hue(filteredRgb(rgb,filter)),wanted[id],16),id+' emblem '+rgb+' lands at '+hue(filteredRgb(rgb,filter)).toFixed(0));
 assert.ok(rgbToOklch(...filteredRgb([230,40,110],filter))[0]>=.5,id+' emblem stays bright');landed.push(Math.round(hue(filteredRgb([230,40,110],filter))/10));}
 assert.equal(new Set(landed).size,landed.length,'no two themes tint the emblem alike');}
assert.deepEqual(plain(filteredRgb([230,40,110],'none')),[230,40,110]);
// Each theme's dots in Settings show its own colours, and no two themes share a main colour.
const mains=themeIds.map(id=>themeSwatches(id).main);assert.equal(new Set(mains).size,themeIds.length);assert.equal(themeSwatches('red').main,'#e04a5c');assert.equal(themeSwatches('red').accent,'#b08cf5');
for(const id of themeIds)for(const value of Object.values(plain(themeSwatches(id))))assert.match(value,/^#[0-9a-f]{6}$/);
// mapColours hands over each family colour once, with a key that is safe in a style variable's name.
const keys=[];mapColours('a #e04a5c b rgba(178,34,58,.5) c rgba(178,34,58,0.05) d #6fbf8e e #abc f url(#n) g #E04A5C',colour=>{keys.push(colour.key);});
assert.deepEqual(keys,['e04a5c','b2223a-500','b2223a-050','e04a5c']);for(const key of keys)assert.match(key,/^[0-9a-f]{6}(-\d{3})?$/);
// Every family colour written in a screen is inside tint(...), so no theme leaves a stray red or violet behind.
// (Rules files and the map's own art are not screens; webTheme.js wraps its whole style sheet.)
const notScreens=new Set(['mapArt.js','mapLayout.js','iconPaths.js','audio.js','themeRules.js','webTheme.js']);
const pattern=/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g;
const familyOf=m=>{let r,g,b;if(m[1]){const h=m[1].length===3?m[1].split('').map(c=>c+c).join(''):m[1];r=parseInt(h.slice(0,2),16);g=parseInt(h.slice(2,4),16);b=parseInt(h.slice(4,6),16);}else{r=+m[2];g=+m[3];b=+m[4];}return colourFamily(r,g,b);};
const stray=[];let wrapped=0;
for(const file of fs.readdirSync('.').filter(f=>/\.js$/.test(f)&&!/^(verify|qa-)/.test(f)&&!notScreens.has(f)))fs.readFileSync(file,'utf8').split(/\r?\n/).forEach((line,n)=>{
 if(/^\s*(\/\/|\*|\/\*)/.test(line))return;
 for(const m of line.matchAll(pattern)){
  if(!familyOf(m))continue;
  let i=m.index-1;while(i>=0&&!"'\"`".includes(line[i]))i--;
  if(i>=0&&line.slice(Math.max(0,i-5),i)==='tint(')wrapped++;else stray.push(file+':'+(n+1)+' '+m[0]);
 }
});
assert.deepEqual(stray,[],'colours written outside tint(): '+stray.slice(0,12).join('; '));assert.ok(wrapped>400);
const web=fs.readFileSync('webTheme.js','utf8');
assert.ok(web.includes('const css=tint(`')&&web.includes('themedText(flourishMarkup(turn),theme,mode)')&&web.includes("'--qb-emblem-filter':emblemFilter(theme)")&&web.includes('[data-qb=emblem]{position:relative;filter:var(--qb-emblem-filter);}'),'webTheme.js wraps its style sheet and writes its pictures and the emblem filter per theme');
const themeSource=fs.readFileSync('theme.js','utf8');
assert.ok(themeSource.includes("const KEY='questbound.theme.v1'")&&themeSource.includes('export function setTheme')&&themeSource.includes("coin:tint('#e8c77b')"));
// The Theme section is in Settings.
const app=fs.readFileSync('App.js','utf8');assert.ok(app.includes("{screen === 'Settings' && <ThemeSettings/>}")&&app.includes("import {ThemeSettings} from './ThemeControls';"));
const controls=fs.readFileSync('ThemeControls.js','utf8');assert.ok(controls.includes('themeChoices.map')&&controls.includes('setTheme(choice.id)')&&controls.includes('accessibilityRole="radio"'));
// Body text and principal labels remain readable on each light page surface.
const lightLuminance=hex=>{const rgb=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
for(const id of themeIds){const bg=lightLuminance(themedText('#08060a',id,'light'));for(const color of ['#ddd6db','#a99fa7','#e04a5c','#b08cf5','#ffb3ac']){const ink=lightLuminance(themedText(color,id,'light'));assert.ok((Math.max(bg,ink)+.05)/(Math.min(bg,ink)+.05)>=4.5,id+' light '+color);}}
// The loading card (shown before the game script runs) reads the saved theme itself: its colours are written as
// var(--bN, <the Red colour>), and a small script sets the variables from a table that must match themeRules.js.
const pagePath='public/index.html',page=fs.readFileSync(pagePath,'utf8');
const card=[...page.matchAll(/var\(--b(\d+), ([^()]*(?:\([^()]*\))?[^()]*)\)/g)].reduce((list,m)=>{list[+m[1]]=m[2].trim();return list;},[]);
assert.ok(card.length>=9&&card.every(Boolean),'the loading card names its colours --b0, --b1, ... with none missing');
const table=Object.fromEntries(themeIds.flatMap(id=>['dark','light'].map(mode=>[id+':'+mode,card.map(colour=>themedText(colour,id,mode))])));
// The card's emblem takes the same filter as the game's (--bf).
const filters=Object.fromEntries(themeIds.filter(id=>emblemFilter(id)!=='none').map(id=>[id,emblemFilter(id)]));
const script="<script>(function(){try{var p=JSON.parse(localStorage.getItem('questbound.theme.v1')||'{}'),t=p.theme||'red',m=p.mode==='light'?'light':'dark',c="+JSON.stringify(table)+"[t+':'+m],f="+JSON.stringify(filters)+"[t],s=document.documentElement.style;document.documentElement.setAttribute('data-appearance',m);if(c){for(var i=0;i<c.length;i++)s.setProperty('--b'+i,c[i]);}if(f)s.setProperty('--bf',f);}catch(e){}})();</script>";
const block=/(<!-- qb-theme-colours:start[^>]*-->\s*)([\s\S]*?)(\s*<!-- qb-theme-colours:end -->)/,found=page.match(block);
assert.ok(found,'public/index.html has the qb-theme-colours block');
// The loading card shows the emblem picture, tinted like the game's.
assert.ok(page.includes('#qb-boot .emblem { position: absolute; inset: 0; filter: var(--bf, none);')&&page.includes('url(/emblem/seal-ring-v1.webp)')&&page.includes('<div class="seal"><div class="emblem"><i class="ring"></i><i class="core"></i></div></div>')&&!page.includes('qb-serpent'),'the loading card shows the emblem');
if(process.argv.includes('--write')){fs.writeFileSync(pagePath,page.replace(block,(whole,start,old,end)=>start+script+end));console.log('Wrote the loading card colours and emblem filters for '+Object.keys(table).join(', ')+'.');}
else assert.equal(found[2],script,'the loading card colours are out of date: run node verify-theme.cjs --write');
console.log('Themes: '+themeIds.join(', ')+'; '+wrapped+' screen colours follow the theme; loading card in step.');
