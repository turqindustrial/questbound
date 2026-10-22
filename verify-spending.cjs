// What keeps the host from paying for someone else's abuse (2026-10-13, the host's words: "add a rate limiter to the
// website so I don't get financially screwed by some random hacker"): spending.cjs's ceilings (all spending a day, guests
// a day, each guest a day, guests and background writing a month), the pause switch, counts of dear requests per guest,
// the alerts (alerts.cjs, with a stand-in poster), the Dungeon Master's own refusals before any AI call, background
// writing that stops at a ceiling, and refusals whose words the game never mistakes for a busy Dungeon Master.
// No AI is called; clocks and usage logs are made up.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createSpending,words,pausedFile,guestCounts,revision,defaultTotal,defaultMonth,hostJobs,jobOfCampaign}=require('./spending.cjs');
const {createAlerts,discordScript,childEnv,postToDiscord}=require('./alerts.cjs');
const {generate}=require('./dm-server.cjs');
const busy=/Please wait before asking|busy with other players/;
{const client=fs.readFileSync(path.join(__dirname,'dmConnection.js'),'utf8');assert.ok(client.includes('Please wait before asking|busy with other players'),'the busy-retry test this check guards against is still the game\'s');}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-spending-'));
const fresh=name=>{const d=path.join(tmp,name);fs.mkdirSync(d);return d;};
(async()=>{
 // The running Dungeon Master reloads spending.cjs only when its revision differs from dm-server's literal.
 assert.equal(revision,6);assert.match(fs.readFileSync(path.join(__dirname,'dm-server.cjs'),'utf8'),/require\('\.\/spending\.cjs'\)\.revision!==6\)/,'dm-server loads this revision afresh');
 assert.equal(defaultTotal,8);assert.equal(defaultMonth,30);
 for(const w of Object.values(words))assert.doesNotMatch(w,busy,'never retried by the game as a busy Dungeon Master: '+w);

 // ---- The daily ceiling on ALL spending: the host's own play counts towards it, but only guests and background stop ----
 {const dir=fresh('total'),log=path.join(dir,'.questbound-usage.jsonl'),raised=[];let clock=new Date(2026,9,13,12).getTime();
  const spend=createSpending({dir,now:()=>clock,alerts:{raise:(kind,text,o)=>{raised.push({kind,text,key:o?.key});return true;}}});
  const line=entry=>fs.appendFileSync(log,JSON.stringify({at:new Date(clock).toISOString(),mode:'turn',model:'gpt-6-luna',input:0,cached:0,output:0,...entry})+'\n');
  assert.equal(spend.check('g1').ok,true);assert.equal(spend.background().ok,true);
  line({mode:'art',images:200});line({mode:'turn',input:1e6,output:1e6});// the host's own: $6 + $0.60
  assert.equal(spend.check('g1').ok,true,'under the ceiling');
  line({mode:'adventure-ahead',output:3e6});// background: $1.50, so $8.10 in all
  const refused=spend.check('g1');assert.equal(refused.ok,false);assert.equal(refused.error,words.total);assert.equal(refused.status,503);
  assert.equal(spend.check(null).ok,true,'the host\'s own play on this PC is never stopped');
  assert.equal(spend.background().ok,false,'background writing stops at the ceiling');
  assert.equal(spend.mayPaint('g1'),false,'and new paintings for guests');assert.equal(spend.mayPaint(null),true,'the host\'s still paint');
  assert.ok(raised.some(r=>r.kind==='total-ceiling'&&/\$8\.00/.test(r.text)),'the host is told');
  fs.writeFileSync(path.join(dir,'.questbound-total-budget'),'20\n');assert.equal(spend.check('g1').ok,true,'the host raised it (read live)');
  fs.writeFileSync(path.join(dir,'.questbound-total-budget'),'off\n');assert.equal(spend.check('g1').ok,true,'or turned it off');
  fs.writeFileSync(path.join(dir,'.questbound-total-budget'),'8\n');
  clock+=86400000;assert.equal(spend.check('g1').ok,true,'a new day');
  const s=spend.summary();assert.equal(s.total,8);assert.equal(s.paused,false);}

 // ---- Host jobs (the people and place libraries the host builds by hand) never count against any ceiling ----
 // (2026-10-16, the host's words: "don't include the functions that I ask you to do in the limitation of the api usage
 // for the month I'll personally fund all of that outside of the testing")
 {const dir=fresh('jobs'),log=path.join(dir,'.questbound-usage.jsonl'),raised=[];let clock=Date.now();
  const at=()=>new Date(clock).toISOString(),line=entry=>fs.appendFileSync(log,JSON.stringify({at:at(),mode:'turn',model:'gpt-6-luna',input:0,cached:0,output:0,...entry})+'\n');
  assert.deepEqual([...hostJobs],['people-library','place-library','creature-library']);assert.equal(jobOfCampaign('questbound-creature-library-v1'),'creature-library');assert.equal(jobOfCampaign('questbound-people-library-v1'),'people-library');assert.equal(jobOfCampaign('questbound-place-library-v1'),'place-library');assert.equal(jobOfCampaign('tale-1'),null);
  const {hostJobOf}=require('./dm-server.cjs');assert.equal(hostJobOf({campaignId:'questbound-people-library-v1'},null),'people-library');assert.equal(hostJobOf({campaignId:'questbound-place-library-v1'},null),'place-library');assert.equal(hostJobOf({campaignId:'questbound-people-library-v1'},'a'.repeat(32)),null,'never for a guest');assert.equal(hostJobOf({campaignId:'tale-1'},null),null);assert.equal(hostJobOf({campaignId:'questbound-creature-library-v1'},null),'creature-library');assert.equal(hostJobOf({campaignId:'questbound-creature-library-v1'},'b'.repeat(32)),null,'never for a guest');
  const dm=fs.readFileSync(path.join(__dirname,'dm-server.cjs'),'utf8');assert.match(dm,/recordUsage\('people',storyModel,u,live,null,\{job:'people-library'\}\)/,'people batches are tagged');assert.match(dm,/\{images:1,imageModel,job:hostJobOf\(body\.context\.subject,guest\)\}/,'library paintings are tagged');
  // A painting of the place library from before the tag: its art record names the library's campaign.
  const art=path.join(dir,'.questbound-art');fs.mkdirSync(art);const painted=clock-60000;
  fs.writeFileSync(path.join(art,'a.json'),JSON.stringify({subject:{campaignId:'questbound-place-library-v1',kind:'landscape',id:'ruin-hills-1'},createdAt:new Date(painted).toISOString()}));
  fs.writeFileSync(path.join(art,'b.json'),JSON.stringify({subject:{campaignId:'tale-9',kind:'portrait',id:'n1'},createdAt:new Date(painted-30000).toISOString()}));
  fs.appendFileSync(log,JSON.stringify({at:new Date(painted+1500).toISOString(),mode:'art',model:'gpt-6-luna',input:0,cached:0,output:0,images:200})+'\n');// $6: the old place-library painting line
  fs.appendFileSync(log,JSON.stringify({at:new Date(painted-28500).toISOString(),mode:'art',model:'gpt-6-luna',input:0,cached:0,output:0,images:10})+'\n');// $0.30: the host's own painting
  line({mode:'art',images:300,job:'people-library'});line({mode:'people',output:4e6,job:'people-library'});// $9 + $2 of new library work
  line({mode:'art',images:20,job:null});// $0.60: the host's own play, tagged as no job
  line({mode:'art',images:100,job:'people-library',guest:'g'.repeat(32)});// a guest can never make a host job: $3 counted
  const spend=createSpending({dir,now:()=>clock,alerts:{raise:(kind,text)=>{raised.push(kind);return true;}}}),s=spend.summary();
  assert.ok(Math.abs(s.hostJobs-17)<1e-9,'host jobs today, the old place-library line included: '+s.hostJobs);
  assert.ok(Math.abs(s.all-3.9)<1e-9,'and none of them in today\'s spending: '+s.all);assert.ok(Math.abs(s.guests-3)<1e-9);
  assert.equal(spend.check('g1').ok,true,'guests go on although $20 was spent today');assert.equal(spend.background().ok,true);assert.ok(!raised.some(k=>/ceiling/.test(k)),'no ceiling alert');
  assert.equal(s.monthly,3,'nor in the month');
  // A ledger written before host jobs were left out: its inflated day total is not kept.
  const old=fresh('ledger');fs.writeFileSync(path.join(old,'.questbound-spending.json'),JSON.stringify({days:{[require('./spending.cjs').dayOf(clock)]:{all:30,guests:1,background:2}}}));fs.writeFileSync(path.join(old,'.questbound-usage.jsonl'),'');
  const o=createSpending({dir:old,now:()=>clock,alerts:{raise:()=>false}}).summary();assert.equal(o.all,0,'the old day total held host jobs');assert.equal(o.guests,1);assert.equal(o.background,2);
  const report=require('node:child_process').spawnSync(process.execPath,['dm-report.cjs','--dir',dir],{cwd:__dirname,encoding:'utf8'});assert.match(report.stdout,/Host jobs \(you fund these\) today: \$17\.00/,report.stdout+report.stderr);
  console.log('Host jobs: the people library\'s text and portraits and the place library\'s paintings (tagged, or recognised from the art records for lines from before the tag) never count against a ceiling, an allowance or an alert; dm-report shows them apart.');}

 // ---- The monthly ceiling: guests and background writing over the calendar month, kept past a rotated log ----
 {const dir=fresh('month'),log=path.join(dir,'.questbound-usage.jsonl');let clock=new Date(2026,9,1,12).getTime();
  const spend=createSpending({dir,now:()=>clock,alerts:{raise:()=>true}});
  const line=entry=>fs.appendFileSync(log,JSON.stringify({at:new Date(clock).toISOString(),mode:'art',model:'gpt-6-luna',...entry})+'\n');
  // Ten days with $2.40 of guest paintings and $0.60 of background writing each: $30 by the tenth.
  for(let day=0;day<10;day++){for(let i=0;i<4;i++)line({guest:'guest-'+day+'-'+i,images:20});line({mode:'adventure-ahead',output:1.2e6});assert.equal(spend.check('someone').ok,day<9,'day '+(day+1));clock+=86400000;}
  assert.equal(spend.check('someone').error,words.month,'past $30 in a month guests are refused');assert.equal(spend.background().ok,false,'and background writing stops');
  assert.ok(Math.abs(spend.summary().monthly-30)<0.01);
  // The usage log is rotated twice (dm-server keeps one .old): the month is still remembered (.questbound-spending.json).
  spend.summary();fs.renameSync(log,log+'.old');fs.rmSync(log+'.old');line({mode:'turn',input:10});
  const after=createSpending({dir,now:()=>clock,alerts:{raise:()=>true}});assert.equal(after.check('someone').error,words.month,'a rotated log forgets nothing this month');
  assert.ok(!fs.readFileSync(path.join(dir,'.questbound-spending.json'),'utf8').includes('guest-'),'the ledger keeps sums only, never who');
  fs.writeFileSync(path.join(dir,'.questbound-month-budget'),'45\n');assert.equal(after.check('someone').ok,true,'the host raised it');fs.rmSync(path.join(dir,'.questbound-month-budget'));
  clock=new Date(2026,10,1,12).getTime();assert.equal(after.check('someone').ok,true,'a new month');}

 // ---- The pause switch: every guest refused at once, background stopped, the host plays on ----
 {const dir=fresh('pause'),spend=createSpending({dir,alerts:{raise:()=>true}});
  fs.writeFileSync(path.join(dir,pausedFile),'Paused by the host');
  const p=spend.check('g1');assert.equal(p.ok,false);assert.equal(p.error,words.paused);assert.match(p.error,/paused by the host/);
  assert.equal(spend.mayPaint('g1'),false);assert.equal(spend.background().ok,false);assert.equal(spend.check(null).ok,true);assert.equal(spend.summary().paused,true);
  fs.rmSync(path.join(dir,pausedFile));assert.equal(spend.check('g1').ok,true,'resumed');}

 // ---- Dear requests counted per guest: new tales, drafted heroes and paintings ----
 {const dir=fresh('counts');let clock=Date.now();const spend=createSpending({dir,now:()=>clock,alerts:{raise:()=>true}});
  const [[talesAnHour],[,talesADay]]=[guestCounts.tale,guestCounts.tale];assert.equal(talesAnHour[0],6);assert.equal(talesADay[0],20);
  for(let i=0;i<6;i++)assert.equal(spend.allow('g1','tale').ok,true);
  const t=spend.allow('g1','tale');assert.equal(t.ok,false);assert.equal(t.status,429);assert.equal(t.error,words.tale);assert.ok(t.retryAfter>=1);
  assert.equal(spend.allow('g2','tale').ok,true,'another guest has their own');assert.equal(spend.allow(null,'tale').ok,true,'the host is never counted');
  clock+=3600001;for(let i=0;i<6;i++)assert.equal(spend.allow('g1','tale').ok,true);clock+=3600001;for(let i=0;i<6;i++)assert.equal(spend.allow('g1','tale').ok,true);
  clock+=3600001;assert.equal(spend.allow('g1','tale').ok,true,'nineteen');assert.equal(spend.allow('g1','tale').ok,true,'twenty');assert.equal(spend.allow('g1','tale').ok,false,'twenty a day');
  for(let i=0;i<10;i++)assert.equal(spend.allow('g3','hero').ok,true);assert.equal(spend.allow('g3','hero').error,words.hero);
  for(let i=0;i<40;i++)assert.equal(spend.mayPaint('g4'),true);assert.equal(spend.mayPaint('g4'),false,'forty new paintings an hour each');}

 // ---- Alerts: half and nine tenths of the guests' day, once a day each; a kind at most once an hour; Discord only when connected ----
 {const dir=fresh('alerts'),log=path.join(dir,'.questbound-usage.jsonl'),posted=[],audited=[];let clock=new Date(2026,9,13,9).getTime();
  const alerts=createAlerts({dir,now:()=>clock,post:text=>{posted.push(text);},audit:(event,details)=>audited.push({event,...details})});
  const spend=createSpending({dir,now:()=>clock,alerts});
  const line=entry=>fs.appendFileSync(log,JSON.stringify({at:new Date(clock).toISOString(),mode:'art',model:'gpt-6-luna',...entry})+'\n');
  for(let i=0;i<90;i++)line({guest:'g'+(i%9),images:1});// $2.70 of $5
  spend.check('g1');spend.check('g2');
  assert.deepEqual(audited.map(a=>a.route),['guests-50'],'past half: one security event');assert.equal(posted.length,0,'Discord is not connected: the security log only');
  fs.writeFileSync(path.join(dir,'.questbound-discord.dpapi'),'(encrypted)');
  for(let i=0;i<70;i++)line({guest:'g'+(i%9),images:1});// $4.80 of $5
  spend.check('g1');spend.check('g1');clock+=7200000;spend.check('g1');
  assert.deepEqual(audited.map(a=>a.route),['guests-50','guests-90'],'nine tenths, once that day');assert.equal(posted.length,1);assert.match(posted[0],/^Questbound: guests have used 96% of today's \$5\.00 allowance/);
  assert.ok(audited.every(a=>a.event==='spending-alert'&&Object.keys(a).every(k=>['event','route'].includes(k))),'only the kind is recorded');
  assert.equal(alerts.raise('address-flood','one connection was refused 100 times'),true);assert.equal(alerts.raise('address-flood','again'),false,'once an hour');
  clock+=3600001;assert.equal(alerts.raise('address-flood','again'),true,'and again after the hour');
  assert.equal(createAlerts({dir,now:()=>clock,post:()=>{},audit:()=>{}}).raise('address-flood','restarted'),false,'remembered across a restart or reload');
  // The real security log: mechanical fields only.
  const real=createAlerts({dir,now:()=>clock,post:()=>{}});real.raise('total-ceiling','today reached the ceiling');
  const row=JSON.parse(fs.readFileSync(path.join(dir,'.questbound-security.jsonl'),'utf8').trim().split('\n').pop());assert.deepEqual(Object.keys(row).sort(),['at','event','route']);assert.equal(row.route,'total-ceiling');}

 // ---- Discord posting: the webhook is read and decrypted by a PowerShell child, never on a command line ----
 assert.match(discordScript,/\[Console\]::In\.ReadToEnd\(\)/,'the message arrives on stdin');assert.match(discordScript,/allowed_mentions = @\{ parse = @\(\) \}/,'mentions disabled');
 assert.match(discordScript,/ConvertTo-SecureString/);assert.match(discordScript,/discord\|discordapp/,'only a Discord webhook is posted to');
 {process.env.OPENAI_API_KEY_FOR_TEST='sk-not-real';const env=childEnv({QB_DISCORD_FILE:'x'});assert.equal(env.OPENAI_API_KEY_FOR_TEST,undefined,'no key reaches the child');assert.equal(env.OPENAI_API_KEY,undefined);delete process.env.OPENAI_API_KEY_FOR_TEST;}
 {let spawned=null;const fakeSpawn=(cmd,args,options)=>{spawned={cmd,args,options};const {EventEmitter}=require('node:events'),child=new EventEmitter();child.stdin={written:'',on(){},end(t){this.written=t;setImmediate(()=>child.emit('exit',0));}};child.kill=()=>{};spawned.child=child;return child;};
  const file=path.join(tmp,'hook.dpapi');fs.writeFileSync(file,'(encrypted)');
  const code=await postToDiscord('Spending reached @everyone',{file,spawn:fakeSpawn,detach:false});
  if(process.platform==='win32'){assert.equal(code,0);assert.equal(spawned.cmd,'powershell.exe');assert.ok(!spawned.args.join(' ').includes('discord.com'),'no webhook on the command line');assert.ok(spawned.args.includes('-EncodedCommand'));assert.equal(spawned.options.env.QB_DISCORD_FILE,file);assert.match(spawned.child.stdin.written,/@​everyone/);}
  else assert.equal(code,null,'only on Windows, where DPAPI can unlock the file');
  assert.equal(await postToDiscord('x',{file:file+'.missing',spawn:fakeSpawn,detach:false}),null,'not connected: nothing runs');}
 if(process.platform==='win32'){
  // The real child unlocks a DPAPI file made by this Windows user, refuses anything but a Discord webhook (exit 2), and posts nothing.
  const file=path.join(tmp,'not-discord.dpapi'),ps=require('node:child_process').spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"ConvertTo-SecureString 'https://example.invalid/not-a-webhook' -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $env:QB_OUT -Encoding ASCII"],{env:{...process.env,QB_OUT:file},encoding:'utf8',timeout:60000});
  if(ps.status===0)assert.equal(await postToDiscord('A test line',{file,detach:false}),2,'decrypted and refused: not a Discord webhook');
 }

 // ---- The Dungeon Master refuses before any AI call: paused, past a ceiling, too many tales, what the game never sends ----
 {let asked=0;const never=async()=>{asked++;throw Error('never asked');};const keys={apiKey:'k',model:'gpt-6-luna',fetchImpl:never};
  const guest='account-'+'cd'.repeat(32),turn={input:'I look around.',guest,context:{choices:[]}};
  const stub=(verdict,counts={ok:true})=>({check:()=>verdict,allow:()=>counts,background:()=>({ok:true})});
  await assert.rejects(generate(turn,{...keys,spending:stub({ok:false,status:503,error:words.paused})}),e=>e.httpStatus===503&&e.message===words.paused);
  await assert.rejects(generate(turn,{...keys,spending:stub({ok:false,status:503,error:words.total})}),e=>e.httpStatus===503&&e.message===words.total);
  await assert.rejects(generate({...turn,input:'Create a fresh adventure.',context:{choices:[],mode:'adventure',introId:'crown'}},{...keys,spending:stub({ok:true},{ok:false,status:429,error:words.tale})}),e=>e.httpStatus===429&&e.message===words.tale);
  await assert.rejects(generate({...turn,context:{choices:[],mode:'character'}},{...keys,spending:stub({ok:true},{ok:false,status:429,error:words.hero})}),e=>e.httpStatus===429);
  // Asked about a painting while paused: no new painting (the picture store is told no), and nothing is asked of the AI.
  let painted=null;const subject={kind:'portrait',campaignId:'verify-spending',id:'p-'+Date.now(),name:'Ada',description:'A tall archer.',setting:''};
  const art=await generate({input:'Paint.',guest,context:{choices:[],mode:'art',subject}},{...keys,spending:{check:()=>({ok:true}),mayPaint:g=>{painted=g;return false;}}});
  assert.equal(painted,guest);assert.equal(art.status,'failed');
  for(const context of [{choices:[],mode:'cheap-trick'},{choices:[],mode:'adventure',introId:'idea',idea:'x'.repeat(301)}])
   await assert.rejects(generate({...turn,context},{...keys,spending:stub({ok:true})}),e=>e.httpStatus===400,'refused: '+JSON.stringify(context).slice(0,60));
  await assert.rejects(generate({...turn,input:'x'.repeat(1001)},{...keys,spending:stub({ok:true})}),e=>e.httpStatus===400);
  assert.equal(asked,0,'nothing reached the AI');}

 // ---- Background writing (the library of ready journeys) stops at a ceiling ----
 {const ok=async()=>({ok:true,json:async()=>({status:'completed',usage:{},output:[{content:[{type:'output_text',text:'{}'}]}]})});
  const keys={apiKey:'k',model:'gpt-6-luna',fetchImpl:ok},host={input:'I look around.',context:{choices:[]}};
  let topped=[];const library={list:()=>[],start:()=>null,any:()=>null,topUp:(write)=>{topped.push(write);return true;}};
  await generate(host,{...keys,library,spending:{check:()=>({ok:true}),background:()=>({ok:false,reason:'total'})}}).catch(()=>{});
  assert.equal(topped.length,0,'past a ceiling no background journey is started');
  let open=true;
  await generate(host,{...keys,library,spending:{check:()=>({ok:true}),background:()=>({ok:open})}}).catch(()=>{});
  assert.equal(topped.length,1,'below it the library is kept full');
  // A ceiling reached while the library writes: the next journey is refused, so the library pauses.
  open=false;await assert.rejects(Promise.resolve().then(()=>topped.at(-1)({})),/Spending ceiling/,'the host background writer stops');}

 fs.rmSync(tmp,{recursive:true,force:true});
 console.log('Spending: a daily ceiling on all AI spending and a monthly one for guests and background writing (kept past a rotated log), the pause switch, new tales, heroes and paintings counted per guest, alerts at half and nine tenths of the guests\' day and at each ceiling (security log; Discord only when connected, through a PowerShell child that never puts the webhook on a command line), the Dungeon Master refusing before any AI call, background writing that stops at a ceiling, and refusals the game never mistakes for a busy Dungeon Master.');
})().catch(e=>{console.error(e);try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}process.exit(1);});
