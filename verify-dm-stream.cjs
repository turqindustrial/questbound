const assert=require('node:assert/strict'),http=require('node:http');
// The Dungeon Master's telling is held to the game's numbers (a wrong HP figure in narration is softened, a right one
// kept), and a game turn can be streamed: the narration arrives as it is written, then the checked reply.
const server=require(process.env.QB_DM??'./dm-server.cjs'),{checkedHp,partialNarration,generate,createServer}=server;
const ctx={player:{health:{current:9,temp:0}},enemyHP:7,encounter:{currentHP:7,maximum:16},engineResolved:['You use Greatsword: d20 [15] + 5 = 20 vs AC 12. Hit.','11 slashing damage (4 + 4 + 3).']};
const cases=[
 ['The bandit staggers, down to 3 HP.','The bandit staggers, badly hurt.'],
 ['The bandit is down to 7 HP.','The bandit is down to 7 HP.'],
 ['You are left with 4 HP.','You are badly wounded.'],
 ['The wolf (5 HP left) circles you.','The wolf circles you.'],
 ['The wolf (7 HP left) circles you.','The wolf (7 HP left) circles you.'],
 ['A healing draught restores 2d4+2 HP.','A healing draught restores 2d4+2 HP.'],
 ['It drops to 2 HP and howls.','It is badly hurt and howls.'],
 ['The cut leaves him with only 2 hit points remaining.','The cut leaves him with only 2 hit points remaining.'.replace('with only 2 hit points remaining','badly wounded')],
 ['You strike for 11 damage.','You strike for 11 damage.'],
 ['You are back up to 4 HP now.','You are back up now.'],
 ['You sit at 3 HP, shaking.','You sit wounded, shaking.'],
 ['You are at 9 HP.','You are at 9 HP.'],
];
for(const [said,want] of cases)assert.equal(checkedHp(said,ctx),want,said);
// Hit points part-way through a turn are real too: healed from 5 to 11, then struck down to 7.
const mid={player:{health:{current:7,temp:0}},turnStart:{hp:5,max:12},engineResolved:['Second Wind: 5 + 1; restored 6 HP.','1d6 [3] + 1 = 4 Slashing damage. 4 damage recorded: 0 absorbed by temporary HP, 4 HP lost.']};
assert.equal(checkedHp('You regain 6 hit points, leaving you at 11 HP, then the blade leaves you at 7 HP.',mid),'You regain 6 hit points, leaving you at 11 HP, then the blade leaves you at 7 HP.');
assert.equal(checkedHp('You regain 6 hit points, leaving you at 10 HP.',mid),'You regain 6 hit points, leaving you wounded.');
assert.equal(partialNarration('{"narration":"The blade \\"sings\\"\\nand the'),'The blade "sings"\nand the');
assert.equal(partialNarration('{"narr'),'');
// A streamed answer from the AI service: Server-Sent Events carrying the JSON reply in pieces.
const reply={narration:'Steel rings. The bandit, down to 3 HP, backs away.',dialogue:[],recruitment:[],relationships:[],loot:null,introduce:null,actionId:null,castCommand:null,ruling:null,worldEvent:null,check:null,discovery:null,ambush:null};
const json=JSON.stringify(reply),pieces=[];for(let i=0;i<json.length;i+=9)pieces.push(json.slice(i,i+9));
const sse=[...pieces.map(delta=>'event: response.output_text.delta\ndata: '+JSON.stringify({type:'response.output_text.delta',delta})+'\n\n'),'event: response.completed\ndata: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{type:'output_text',text:json}]}]}})+'\n\n'];
let sent=null;const streamFetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:json}]}]}),body:(async function*(){for(const s of sse){yield Buffer.from(s.slice(0,7));yield Buffer.from(s.slice(7));}})()};};
const body={input:'I swing at the bandit.',context:{choices:[],stage:'combat',...ctx}};
(async()=>{
 const seen=[];const out=await generate(body,{apiKey:'k',model:'m',fetchImpl:streamFetch,onNarration:t=>seen.push(t)});
 assert.equal(sent.stream,true);assert.ok(seen.length>=2,'Narration arrives in pieces');assert.ok(seen.every(t=>!/3 HP/.test(t)),'Partial narration is checked too');assert.ok(seen.every((t,i)=>i===0||t.startsWith(seen[i-1].slice(0,10))));
 assert.equal(out.narration,'Steel rings. The bandit, badly hurt, backs away.','The final reply is checked');
 // Without a listener nothing is streamed (older servers call generate this way).
 const plain=await generate(body,{apiKey:'k',model:'m',fetchImpl:async(u,o)=>{sent=JSON.parse(o.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:json}]}]})};}});
 assert.equal(sent.stream,undefined);assert.equal(plain.narration,'Steel rings. The bandit, badly hurt, backs away.');
 // Through the HTTP service: NDJSON lines when asked, plain JSON otherwise.
 const srv=createServer({apiKey:'k',model:'m',fetchImpl:streamFetch});await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const post=payload=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:'/dm',method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:8081'}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type'],data}));});req.on('error',reject);req.end(JSON.stringify(payload));});
 const streamed=await post({...body,stream:true});
 assert.equal(streamed.status,200);assert.match(streamed.type,/ndjson/);
 const lines=streamed.data.trim().split('\n').map(l=>JSON.parse(l));assert.ok(lines.length>=3);assert.ok(lines.slice(0,-1).every(l=>typeof l.narration==='string'));assert.equal(lines.at(-1).reply.narration,'Steel rings. The bandit, badly hurt, backs away.');
 const whole=await post(body);assert.match(whole.type,/application\/json/);assert.equal(JSON.parse(whole.data).narration,'Steel rings. The bandit, badly hurt, backs away.');
 srv.close();
 console.log('Passed: wrong HP figures in the telling are softened and right ones kept, partial narration is read from the streamed reply, and turns stream as NDJSON (or arrive whole when not asked).');
})().catch(e=>{console.error(e);process.exit(1);});
