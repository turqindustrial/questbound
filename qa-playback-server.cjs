// Isolated visual QA only. Never loaded by the game or its live DM service.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),r=require('./verify-dm-integration.cjs');
const root=path.resolve('dist-playback');
const hero={name:'Playback Tester',race:'Human',species:'Human',class:'Wizard',level:1,scores:{Strength:10,Dexterity:14,Constitution:14,Intelligence:16,Wisdom:12,Charisma:10},spells:['detect-magic','burning-hands','acid-splash']};hero.equipment=r.equipmentFor(hero);
const game=r.newAdventure(hero);const fixture={hero,adventure:r.adventureSnapshot(hero,game,{current:8,temp:2},true)};
const script=`
 const fixture=${JSON.stringify(fixture)};
 if(location.pathname==='/fixture'){
 localStorage.setItem('questbound.character.v1',JSON.stringify(fixture.hero));
 localStorage.setItem('questbound.adventure.v1',JSON.stringify(fixture.adventure));
 history.replaceState(null,'','/');
 }
 const originalFetch=window.fetch.bind(window);
 window.fetch=async (url,options)=>{
 if(['http://localhost:8084/','http://localhost:8083/'].some(endpoint=>String(url).startsWith(endpoint))){
 if(String(url).endsWith('/health'))return new Response(JSON.stringify({ready:true,actionProtocol:3}));
 const body=JSON.parse(options.body),c=body.context;
 if(c.mode==='adventure'){
 const intro=${JSON.stringify(require('./adventureIntros.json'))}.find(i=>i.id===c.introId);
 const story={id:'qa-'+Date.now(),title:intro.title+' — QA',premise:intro.setting,opening:intro.arrival+'. '+intro.conflict,objective:'Investigate the first conflict.',resolution:'Find evidence and resolve the dispute.',secret:'A misplaced message caused the dispute.',foe:'Briar sentinel',status:'active',locations:{inn:{name:'Arrival Camp',description:intro.setting},bridge:{name:'Old Waterworks',description:'A creature guards the entrance.'},tower:{name:'Archive',description:'A clue waits inside.'}},npcs:{keeper:{name:'Ivo',role:'Local caretaker',motive:'Keep the settlement safe.'},mara:{name:'Sera',role:'Traveling healer',motive:'Find the missing supplies.'}}};
 return new Response(JSON.stringify({story}));
 }
 return new Response(JSON.stringify({narration:c.engineResolved?'The turn has resolved. '+c.engineResolved.slice(-2).join(' '):(c.conversationWith?.name??'The keeper')+': “The roads have been strange lately. What would you like to know?”',actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null}));
 }
 return originalFetch(url,options);
 };
 `;
http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),candidate=path.resolve(root,'.'+pathname);
 if(candidate!==root&&!candidate.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const file=fs.existsSync(candidate)&&fs.statSync(candidate).isFile()?candidate:path.join(root,'index.html');
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.png':'image/png','.ico':'image/x-icon'})[path.extname(file)]??'application/octet-stream');
 if(path.extname(file)==='.html')res.end(fs.readFileSync(file,'utf8').replace('<head>','<head><script>'+script+'</script>'));
 else fs.createReadStream(file).pipe(res);
}).listen(8086,'127.0.0.1',()=>console.log('Isolated visual QA at http://localhost:8086/fixture. Mock DM replies only; no paid calls.'));
