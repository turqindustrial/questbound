// Fetches the game's typefaces from Google Fonts once and writes them to public/fonts/ with a stylesheet, so players'
// browsers load them from the host and never from Google. The typefaces are under the SIL Open Font License 1.1;
// each family's licence file is saved beside the fonts. Run again only to change the families or weights.
// Usage: node fetch-fonts.cjs
const fs=require('node:fs'),path=require('node:path');
const families=[
 ['Cinzel Decorative','cinzeldecorative','Cinzel+Decorative:wght@700;900'],
 ['Cinzel','cinzel','Cinzel:wght@400;500;600;700;800'],
 ['EB Garamond','ebgaramond','EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500'],
 ['Inter','inter','Inter:wght@400;500;600;700'],
];
const subsets=new Set(['latin','latin-ext']);
const dir=path.join(__dirname,'public','fonts');
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 // A modern browser's user agent gets woff2 files split by writing system.
 const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'};
 const faces=[];let bytes=0;
 for(const [family,repo,query] of families){
  const css=await (await fetch('https://fonts.googleapis.com/css2?family='+query+'&display=swap',{headers})).text();
  const blocks=[...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([\s\S]*?)\}/g)];
  for(const [,subset,body] of blocks){
   if(!subsets.has(subset))continue;
   const get=name=>body.match(new RegExp(name+':\\s*([^;]+);'))?.[1]?.trim();
   const style=get('font-style'),weight=get('font-weight'),range=get('unicode-range'),url=body.match(/url\(([^)]+)\)/)?.[1];
   if(!url||!weight||!style||!range)throw Error('unexpected css for '+family);
   const file=slug(family)+'-'+weight+(style==='italic'?'-italic':'')+'-'+subset+'.woff2';
   const data=Buffer.from(await (await fetch(url,{headers})).arrayBuffer());
   fs.writeFileSync(path.join(dir,file),data);bytes+=data.length;
   faces.push({family,style,weight,range,file,subset});
   console.log(file+' '+Math.round(data.length/1024)+' KB');
  }
  const licence=await (await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/'+repo+'/OFL.txt')).text();
  if(!/SIL OPEN FONT LICENSE/i.test(licence))throw Error('no licence text for '+family);
  fs.writeFileSync(path.join(dir,'OFL-'+slug(family)+'.txt'),licence);
 }
 const sheet='/* Questbound\'s typefaces, served from this host. Cinzel, Cinzel Decorative, EB Garamond and Inter are licensed under the\n   SIL Open Font License 1.1 (see the OFL-*.txt files beside this one). Written by fetch-fonts.cjs. */\n'+
  faces.map(f=>'@font-face{font-family:"'+f.family+'";font-style:'+f.style+';font-weight:'+f.weight+';font-display:swap;src:url(/fonts/'+f.file+') format("woff2");unicode-range:'+f.range+';}').join('\n')+'\n';
 fs.writeFileSync(path.join(dir,'fonts.css'),sheet);
 console.log(faces.length+' font files, '+Math.round(bytes/1024)+' KB in all, and fonts.css written to public/fonts/.');
})().catch(e=>{console.error(e);process.exit(1);});
