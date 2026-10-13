// Fetches the game's typefaces from Google Fonts once and writes them to public/fonts/ with a stylesheet, so players'
// browsers load them from the host and never from Google. The typefaces are under the SIL Open Font License 1.1;
// each family's licence file is saved beside the fonts. Run again only to change the families or weights.
// Google serves variable fonts: every weight of a family comes back as the same file. Identical files are kept once
// and named for their lowest weight, and the stylesheet gives that one file the whole range of weights
// (font-weight:400 800), so a browser downloads each face once and the text settles in one step.
// The stylesheet is fonts-v2.css: the first one (fonts.css, one file per weight) was cached for a year by browsers,
// so the name changed with its contents (fonts.css and its per-weight files were kept one release, then removed on
// 13 October 2026). A font file's bytes must never change under the same name, and a stylesheet name is never reused.
// Usage: node fetch-fonts.cjs            (download, then write the files and fonts-v2.css)
//        node fetch-fonts.cjs --local    (no download: write fonts-v2.css again from its own faces, checking each file)
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const families=[
 ['Cinzel Decorative','cinzeldecorative','Cinzel+Decorative:wght@700;900'],
 ['Cinzel','cinzel','Cinzel:wght@400;500;600;700;800'],
 ['EB Garamond','ebgaramond','EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500'],
 ['Inter','inter','Inter:wght@400;500;600;700'],
];
const subsets=new Set(['latin','latin-ext']);
const dir=path.join(__dirname,'public','fonts');
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const fileFor=(family,weight,style,subset)=>slug(family)+'-'+weight+(style==='italic'?'-italic':'')+'-'+subset+'.woff2';
const md5=data=>crypto.createHash('md5').update(data).digest('hex');
// Faces with identical bytes (same family, style and subset) become one face with a weight range.
function merged(faces){
 const groups=new Map();
 for(const f of faces){const key=[f.family,f.style,f.subset,f.hash].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
 return [...groups.values()].map(group=>{
  const weights=group.map(f=>Number(f.weight)).sort((a,b)=>a-b),low=weights[0],high=weights.at(-1);
  const keep=group.find(f=>Number(f.weight)===low);
  return {...keep,weight:low===high?String(low):low+' '+high};
 }).sort((a,b)=>a.family.localeCompare(b.family)||a.style.localeCompare(b.style)||Number(a.weight.split(' ')[0])-Number(b.weight.split(' ')[0])||a.subset.localeCompare(b.subset));
}
function writeSheet(faces){
 const sheet='/* Questbound\'s typefaces, served from this host. Cinzel, Cinzel Decorative, EB Garamond and Inter are licensed under the\n   SIL Open Font License 1.1 (see the OFL-*.txt files beside this one). Written by fetch-fonts.cjs: one file per family,\n   style and writing system, each covering a range of weights. */\n'+
  faces.map(f=>'@font-face{font-family:"'+f.family+'";font-style:'+f.style+';font-weight:'+f.weight+';font-display:swap;src:url(/fonts/'+f.file+') format("woff2");unicode-range:'+f.range+';}').join('\n')+'\n';
 fs.writeFileSync(path.join(dir,'fonts-v2.css'),sheet);
 return sheet;
}
// The faces fonts-v2.css describes, read back with the files they name (already merged: weights may be ranges).
function localFaces(){
 const css=fs.readFileSync(path.join(dir,'fonts-v2.css'),'utf8');
 return [...css.matchAll(/@font-face\{([^}]*)\}/g)].map(([,body])=>{
  const get=name=>body.match(new RegExp(name+':\\s*([^;]+);'))?.[1]?.trim();
  const family=get('font-family').replace(/"/g,''),style=get('font-style'),weight=get('font-weight'),range=get('unicode-range'),file=body.match(/url\(\/fonts\/([^)]+)\)/)[1];
  const subset=/-latin-ext\.woff2$/.test(file)?'latin-ext':'latin';
  return {family,style,weight,range,file,subset,hash:md5(fs.readFileSync(path.join(dir,file)))};
 });
}
module.exports={merged,localFaces};
if(require.main===module)(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 if(process.argv.includes('--local')){const faces=localFaces();writeSheet(faces);console.log(faces.length+' faces written to public/fonts/fonts-v2.css from the files already there.');return;}
 // A modern browser's user agent gets woff2 files split by writing system.
 const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'};
 const faces=[];let bytes=0;const written=new Set();
 for(const [family,repo,query] of families){
  const css=await (await fetch('https://fonts.googleapis.com/css2?family='+query+'&display=swap',{headers})).text();
  const blocks=[...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([\s\S]*?)\}/g)];
  for(const [,subset,body] of blocks){
   if(!subsets.has(subset))continue;
   const get=name=>body.match(new RegExp(name+':\\s*([^;]+);'))?.[1]?.trim();
   const style=get('font-style'),weight=get('font-weight'),range=get('unicode-range'),url=body.match(/url\(([^)]+)\)/)?.[1];
   if(!url||!weight||!style||!range)throw Error('unexpected css for '+family);
   const data=Buffer.from(await (await fetch(url,{headers})).arrayBuffer()),hash=md5(data);
   faces.push({family,style,weight,range,file:fileFor(family,weight,style,subset),subset,hash,data});
  }
  const licence=await (await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/'+repo+'/OFL.txt')).text();
  if(!/SIL OPEN FONT LICENSE/i.test(licence))throw Error('no licence text for '+family);
  fs.writeFileSync(path.join(dir,'OFL-'+slug(family)+'.txt'),licence);
 }
 const kept=merged(faces);
 for(const f of kept){
  const target=path.join(dir,f.file);
  // The gateways let browsers keep a font file for a year: a name that already exists must keep its bytes.
  if(fs.existsSync(target)&&md5(fs.readFileSync(target))!==f.hash)throw Error(f.file+' would change under the same name. Rename it (and fonts-v*.css) first.');
  fs.writeFileSync(target,f.data);bytes+=f.data.length;written.add(f.file);console.log(f.file+' ('+f.weight+') '+Math.round(f.data.length/1024)+' KB');
 }
 writeSheet(kept);
 console.log(written.size+' font files, '+Math.round(bytes/1024)+' KB in all, and fonts-v2.css written to public/fonts/.');
})().catch(e=>{console.error(e);process.exit(1);});
