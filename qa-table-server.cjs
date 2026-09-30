// Disposable two-browser shared-table QA. Never connects to the live table or AI.
const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createSyncServer}=require('./sync-server.cjs'),r=require('./verify-dm-integration.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-sync-ui-')),root=path.resolve('dist-phone');
const table=createSyncServer({dir});
const hero={name:'Shared Table Tester',race:'Human',species:'Human',class:'Fighter',level:1,background:'Soldier',scores:{Strength:16,Dexterity:14,Constitution:14,Intelligence:10,Wisdom:12,Charisma:10},spells:[]};
hero.equipment=r.equipmentFor(hero);
const adventure=r.adventureSnapshot(hero,r.newAdventure(hero),{current:r.combatBasics(hero).hp,temp:0},true);
const fixture=`if(location.pathname==='/fixture'){localStorage.setItem('questbound.character.v1',${JSON.stringify(JSON.stringify(hero))});localStorage.setItem('questbound.adventure.v1',${JSON.stringify(JSON.stringify(adventure))});localStorage.removeItem('questbound.table.v1');history.replaceState(null,'','/');}`;
const servers=[];
table.server.listen(0,'127.0.0.1',()=>{
 const tablePort=table.server.address().port;
 for(const port of [8090,8091]){
  const server=http.createServer(async(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(pathname.startsWith('/api/sync/')){
    const upstream=http.request({hostname:'127.0.0.1',port:tablePort,path:pathname.replace('/api/sync',''),method:req.method,headers:{'Content-Type':'application/json',Origin:'http://localhost:8081'}},reply=>{res.writeHead(reply.statusCode,{'Content-Type':'application/json'});reply.pipe(res);});
    upstream.on('error',()=>res.writeHead(502).end());req.pipe(upstream);return;
   }
   if(pathname==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ready:true,actionProtocol:3}));return;}
   if(pathname==='/api/dm'){
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw);res.setHeader('Content-Type','application/json');
    if(body.context?.mode==='art'){
     const cache=path.resolve('.questbound-art'),image=fs.readdirSync(cache).find(name=>name.endsWith('.jpg'));
     res.end(JSON.stringify({status:'ready',key:'test-art',dataUrl:'data:image/jpeg;base64,'+fs.readFileSync(path.join(cache,image)).toString('base64')}));return;
    }
    res.end(JSON.stringify({narration:'The table records your action.',actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,dialogue:[],recruitment:[]}));return;
   }
   let file=path.resolve(root,'.'+pathname);
   if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
   if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
   const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'})[ext]??'application/octet-stream');
   if(ext==='.html')res.end(fs.readFileSync(file,'utf8').replace('<head>','<head><script>'+fixture+'</script>'));else fs.createReadStream(file).pipe(res);
  });
  server.listen(port,'127.0.0.1',()=>console.log('Isolated table QA: http://localhost:'+port+'/fixture'));servers.push(server);
 }
});
process.on('SIGINT',()=>{for(const server of servers)server.close();table.server.close();process.exit(0);});
