// Synthetic identities only; no messages or paid provider requests leave these tests.
const path=require('node:path'),crypto=require('node:crypto');
function fixtures(root,extra={}){
 const codes=new Map(),{createOperations}=require('./operations.cjs'),{rules}=require('./rules-engine.cjs');
 const operations=createOperations({dir:root,key:crypto.randomBytes(32),now:extra.now}),r=rules();
 const options={dir:path.join(root,'table'),accountsDir:path.join(root,'accounts'),cloudDir:path.join(root,'cloud'),operations,
  mailer:{configured:()=>true,verification:async(email,code)=>codes.set(email,code)},ask:async()=>({narration:'The room falls quiet.',actionId:null}),...extra};
 async function user(accounts,email='tester@example.test',password='lantern-wisp-71'){
  const pending=await accounts.register(email,password);return accounts.verify(email,pending.challenge,codes.get(email));
 }
 // A hero in a written tale (journey-fixtures.cjs): a shared table plays a tale (campaigns.cjs), never the crossroads
 // adventure a game without a story once was; `{tale:false}` gives a hero with no tale yet.
 const taleGame=(hero,n=0)=>r.freshStoryGame(hero,require('./journey-fixtures.cjs').journeyStory(n),r.newAdventure(hero));
 const snapshot=(type='fighter',{tale=true}={})=>{const hero=r.readyHero(type);return JSON.parse(JSON.stringify(r.adventureSnapshot(hero,tale?taleGame(hero):r.newAdventure(hero),null,true)));};
 return {options,codes,user,snapshot,taleGame,operations};
}
module.exports={fixtures};
