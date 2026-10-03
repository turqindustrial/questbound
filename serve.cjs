// One process for a hosted Questbound (a cloud machine or container): the Dungeon Master and the table service on
// loopback, the gateway on the port the host gives it, and everything the services keep under one data folder.
// Players open the gateway's https address and enter the invite code, exactly as on the tester link. On a PC at home,
// use the launcher (Questbound.cmd) instead. Settings come from the environment:
//   PORT                        the port to listen on (8080)
//   QUESTBOUND_PUBLIC_ORIGIN    the https address players open, e.g. https://play.example.com (required)
//   QUESTBOUND_DATA             the data folder (/data in the container): accounts, saves, sessions, art, logs
//   QUESTBOUND_INVITE_CODE      eight digits; else one is made once and kept in the data folder
//   OPENAI_API_KEY, OPENAI_MODEL, OPENAI_STORY_MODEL (and the other QUESTBOUND_* settings dm-server.cjs reads)
//   QUESTBOUND_MAX_PLAYERS (500), QUESTBOUND_TURNS_PER_PLAYER (60 per 10 min), QUESTBOUND_TURNS_IN_ALL (1200)
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const number=(value,fallback)=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:fallback;};
async function startHosted({dataDir=process.env.QUESTBOUND_DATA||path.join(__dirname,'.questbound-data'),port=number(process.env.PORT,8080),publicOrigin=process.env.QUESTBOUND_PUBLIC_ORIGIN||null,inviteCode=process.env.QUESTBOUND_INVITE_CODE||null,root=path.join(__dirname,'dist-phone'),bind='0.0.0.0',dmPort=0,syncPort=0,dm={},log=console.log}={}){
 if(!publicOrigin)throw Error('Set QUESTBOUND_PUBLIC_ORIGIN to the https address players will open (for example https://play.example.com).');
 if(!fs.existsSync(path.join(root,'index.html')))throw Error('Build the game first: npx expo export --platform web --output-dir dist-phone');
 fs.mkdirSync(dataDir,{recursive:true});process.env.QUESTBOUND_DATA=dataDir;
 const {createServer}=require('./dm-server.cjs'),{createSyncServer}=require('./sync-server.cjs'),{createPhoneServer}=require('./phone-server.cjs');
 const listen=(server,at,host)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(at,host,()=>resolve(server.address().port));});
 // `dm` holds the Dungeon Master's own options (its provider fetch among them); the gateway reaches loopback with the real fetch.
 const dungeonMaster=createServer({...dm}),table=createSyncServer({dir:path.join(dataDir,'table'),cloudDir:path.join(dataDir,'cloud'),accountsDir:path.join(dataDir,'accounts')}).server;
 const dmAt=await listen(dungeonMaster,dmPort,'127.0.0.1'),syncAt=await listen(table,syncPort,'127.0.0.1');
 // The invite code: the host's, else made once and kept in the data folder so a restart never changes it.
 const codeFile=path.join(dataDir,'invite-code.txt');let code=/^\d{8}$/.test(inviteCode??'')?inviteCode:null;
 if(!code)try{const saved=fs.readFileSync(codeFile,'utf8').trim();if(/^\d{8}$/.test(saved))code=saved;}catch{}
 if(!code){code=String(crypto.randomInt(10000000,100000000));fs.writeFileSync(codeFile,code+'\n');}
 const gateway=createPhoneServer({root,host:bind,port,publicOrigin,code,expiresAt:Date.now()+365*86400000,sessionHours:24*60,maxSessions:number(process.env.QUESTBOUND_MAX_PLAYERS,500),dmLimit:number(process.env.QUESTBOUND_TURNS_PER_PLAYER,60),dmTotal:number(process.env.QUESTBOUND_TURNS_IN_ALL,1200),sessionStore:path.join(dataDir,'sessions.json'),feedbackFile:path.join(dataDir,'feedback.md'),backends:['http://127.0.0.1:'+dmAt],syncBackend:'http://127.0.0.1:'+syncAt,trustProxy:true});
 const at=await listen(gateway.server,port,bind);
 log('Questbound is hosted at '+publicOrigin+' (port '+at+'). Invite code: '+code+'. Data in '+dataDir+'.');
 const close=()=>Promise.all([gateway.server,table,dungeonMaster].map(s=>new Promise(resolve=>s.close(resolve))));
 return {gateway:gateway.server,table,dungeonMaster,info:{...gateway.info,port:at,dataDir,dmPort:dmAt,syncPort:syncAt,inviteCode:code},close};
}
if(require.main===module){
 startHosted().then(({close})=>{for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{close().then(()=>process.exit(0));});}).catch(e=>{console.error(e.message);process.exit(1);});
}
module.exports={startHosted};
