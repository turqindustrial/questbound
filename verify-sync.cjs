const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createSyncServer}=require('./account-server.cjs'),{rules}=require('./rules-engine.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qb-campaigns-')),r=rules();let release,entered,calls=0;
const fixture=require('./test-fixtures.cjs').fixtures(root,{randomImpl:()=>.65,ask:async()=>{calls++;if(entered)entered();if(release)await release.promise;return {narration:'The strike lands and the company prepares its next move.',actionId:null};}});
let service=createSyncServer(fixture.options);
const plain=x=>JSON.parse(JSON.stringify(x)),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise};};
(async()=>{
 const a=await fixture.user(service.accounts,'alice@example.test'),b=await fixture.user(service.accounts,'bob@example.test');
 const user=a=>({...service.accounts.identity(a.token),active:()=>service.accounts.identity(a.token)}),A=user(a),B=user(b),hero=r.readyHero('fighter');
 const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=> (r.hostileFoes.findIndex(f=>f.key==='bandit')+.5)/r.hostileFoes.length);
 const created=service.campaigns.create(A,{snapshot:r.adventureSnapshot(hero,fight,null,true),name:'Alice',party:true});
 const joined=service.campaigns.join(B,{invite:created.invite,snapshot:fixture.snapshot('wizard'),name:'Bob'}),campaignId=created.campaignId;
 const before=plain(service.campaigns.poll(A,{campaignId}).snapshot),gate=deferred(),started=deferred();release=gate;entered=started.resolve;
 const request={campaignId,question:'I attack with my greatsword.',action:'attack:Greatsword',baseVersion:joined.version,requestId:crypto.randomUUID()};
 const pending=service.campaigns.turn(A,request);await started.promise;
 await assert.rejects(service.campaigns.turn(B,{...request,requestId:crypto.randomUUID()}),e=>e.status===423);
 assert.equal(service.campaigns.poll(A,{campaignId}).version,joined.version,'an unfinished reply cannot alter the world');
 gate.resolve();const result=await pending;release=null;entered=null;
 assert.equal(result.version,joined.version+1);assert.ok(result.snapshot.game.enemyHP<before.game.enemyHP,'server dice commit actual attack damage');
 assert.ok(result.snapshot.game.turnOrder||result.snapshot.game.stage==='victory');
 const bob=service.campaigns.poll(B,{campaignId});assert.equal(r.canonicalParty(bob.snapshot),r.canonicalParty(result.snapshot));
 // Persistence and a lost receipt: retrying after restarting cannot roll or spend twice.
 service=createSyncServer(fixture.options);const retry=await service.campaigns.turn(user(a),request);assert.equal(retry.replayed,true);assert.equal(calls,1);assert.equal(retry.version,result.version);
 const outsider={id:'f'.repeat(64)};assert.throws(()=>service.campaigns.poll(outsider,{campaignId}),e=>e.status===403);
 assert.throws(()=>service.campaigns.invite(user(b),{campaignId}),e=>e.status===403);
 // Wielding and advancement are also authoritative; forged stats and gear are not adopted.
 const base=fixture.snapshot();base.game.levelsOwed=1;
 const growth=service.campaigns.create(user(a),{snapshot:base,name:'Alice'}),g=growth.campaignId;
 assert.throws(()=>service.campaigns.edit(user(a),{campaignId:g,baseVersion:growth.version,kind:'wield',name:'Great'}),e=>e.status===400);
 const wield=service.campaigns.edit(user(a),{campaignId:g,baseVersion:growth.version,kind:'wield',name:'Greatsword'});assert.equal(wield.snapshot.game.wield,'Greatsword');
 const candidate=r.makeCharacter({...hero,level:2,advancementVersion:1});candidate.scores.Strength=99;
 assert.throws(()=>service.campaigns.edit(user(a),{campaignId:g,baseVersion:wield.version,kind:'advance',character:{...candidate,level:20}}),e=>e.status===400);
 const grown=service.campaigns.edit(user(a),{campaignId:g,baseVersion:wield.version,kind:'advance',character:candidate});assert.equal(JSON.parse(grown.snapshot.character).level,2);assert.equal(JSON.parse(grown.snapshot.character).scores.Strength,hero.scores.Strength);
 assert.throws(()=>service.campaigns.edit(user(a),{campaignId:g,baseVersion:grown.version,kind:'advance',character:{...candidate,level:3}}),e=>e.status===400);
 // Restore a historical snapshot into a separate campaign and load it through a restarted service.
 const versions=fixture.operations.backup.list('campaign-'+campaignId),saved=fixture.operations.backup.read('campaign-'+campaignId,versions[0]);
 const restoredId=crypto.randomBytes(16).toString('hex'),restored={...saved,id:restoredId};
 fs.writeFileSync(path.join(root,'table','campaigns',restoredId+'.json'),JSON.stringify(restored));
 const reopened=createSyncServer(fixture.options);assert.equal(r.canonicalParty(reopened.campaigns.poll(user(a),{campaignId:restoredId}).snapshot),r.canonicalParty(result.snapshot));
 // Account deletion during another player's outstanding action cannot resurrect the campaign.
 const waiting=deferred(),begun=deferred();release=waiting;entered=begun.resolve;
 const delayed=service.campaigns.turn(user(b),{campaignId,question:'DM, pause a moment.',direct:true,requestId:crypto.randomUUID(),baseVersion:result.version});await begun.promise;
 await service.accounts.remove(a.token,'lantern-wisp-71');service.campaigns.removeAccount(a.id);waiting.resolve();await assert.rejects(delayed,e=>e.status===404);
 assert.throws(()=>service.campaigns.poll(user(b),{campaignId}),e=>e.status===404);
 console.log('Campaigns: concurrent turns, committed attack damage, shared initiative, restart/retry safety, permissions, weapon/level validation, isolated restore and account deletion during a pending turn.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
