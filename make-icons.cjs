// Draws the Questbound app icons (home screen, manifest, browser tab, Android adaptive layers) in the game's colours:
// a crimson-foil Q in a red seal with a violet inner ring, over the darkened title painting. The artwork is the page
// assets/title/icon.html; this photographs it at each size with a headless Chrome or Edge (a throwaway profile).
// Run: node make-icons.cjs        (needs the internet once, for the title typeface; without it the Q falls back to Georgia)
// After changing the icon, raise the version in the icon links (public/manifest.json, public/index.html,
// fullscreen.js, phone-server.cjs: "?v=N") so installed copies and browser tabs fetch the new one.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file=>fs.existsSync(file));
if(!browser){console.error('Chrome or Edge is needed to draw the icons.');process.exit(1);}
const page='file:///'+path.join(__dirname,'assets','title','icon.html').replace(/\\/g,'/');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-icons-'));
// [pixels, file, query]. Maskable and adaptive icons keep the seal inside the safe middle; tiny ones drop the fine rings.
const icons=[
 [1024,'assets/questbound-icon.png','inset=.09'],
 [512,'public/icons/icon-512.png','inset=.09'],
 [192,'public/icons/icon-192.png','inset=.08'],
 [512,'public/icons/maskable-512.png','inset=.19'],
 [180,'public/icons/apple-touch-icon.png','inset=.1'],
 [48,'assets/questbound-favicon.png','inset=.04&simple=1'],
 [1024,'assets/android-icon-background.png','layer=bg'],
 [1024,'assets/android-icon-foreground.png','layer=fg&inset=.22'],
 [1024,'assets/android-icon-monochrome.png','layer=mono&inset=.24&simple=1'],
];
try{
 for(const [pixels,file,query] of icons){
  const out=path.join(__dirname,file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.rmSync(out,{force:true});
  // The window is 512 points wide and the scale makes the pixels. A headless window cannot be narrower than about
  // 500 points and scales under a fifth are rounded up, so a tiny icon is drawn at its real size in the window's
  // top left corner (px=N) and the picture is cut to that corner.
  const tiny=pixels<128,points=tiny?pixels:512,scale=tiny?1:pixels/512;
  const result=spawnSync(browser,['--headless=new','--user-data-dir='+profile,'--no-first-run','--hide-scrollbars','--default-background-color=00000000','--window-size='+points+','+points,'--force-device-scale-factor='+scale,'--virtual-time-budget=8000','--screenshot='+out,page+'?'+query+(tiny?'&px='+pixels:'')],{timeout:60000});
  if(!fs.existsSync(out)){console.error('Could not draw '+file+'. '+String(result.stderr??'').slice(0,300));process.exitCode=1;}
  else console.log(file+' '+pixels+' px');
 }
}finally{try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}
