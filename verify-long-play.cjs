// A very long game stays well inside every size limit. The journal used to gain one record of the Dungeon Master's
// words every turn without end, so a long shared table would have met the 2,000,000-character snapshot limit after
// some 1,000 to 1,500 turns; now it keeps the newest records (journalRules.js journalLimits) while the story so far
// keeps everything (memoryRules.js). Here one hero plays 5,000 turns of a single tale (the worst case: a new tale
// starts a new journal) with long replies, spoken lines, facts to remember, world news, journeys, rests and notes,
// and every 500 turns: the save is valid and well under the snapshot limit, the request to the Dungeon Master well
// under its 64,000 bytes, the journal within its limits with the tale's opening first, and a shared table of four
// heroes with forty receipts well under the campaign file's limit. Sizes level off rather than grow. An old save
// holding a journal past the limits is still accepted and is trimmed at its next entry, ids renumbered.
const assert=require('node:assert/strict'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs'),{journeyStory}=require('./journey-fixtures.cjs');
const r=vm.runInNewContext(rulesSource()+'\n;({readyHero,newAdventure,freshStoryGame,settleTurn,adventureSnapshot,validAdventure,isValidCharacter,dmContext,quickActions,addJournalNote,journalLimits,journalTalk,validJournal,appendJournal,startParty,joinParty,partyView,conversationPeople})',{AsyncStorage:{},console});
const TURNS=5000,LIMITS={snapshot:2000000,request:64000};
const hero=r.readyHero('fighter');let game=r.freshStoryGame(hero,journeyStory(0),r.newAdventure(hero)),health=null;
const opening=game.journal.entries[0].text;
const prose='The rain comes in sideways off the marsh and the lanterns of the market sway on their poles while the reeve counts his debts aloud. ';
// Long replies: every other turn a long telling, else three long spoken lines by whoever is there to speak.
const reply=(i,here)=>i%2||!here.length?{narration:prose.repeat(14).slice(0,1500),dialogue:[]}:{narration:prose.slice(0,200),dialogue:[0,1,2].map(k=>({speakerId:here[k%here.length],text:prose.repeat(5).slice(0,560)}))};
const sizes=[];let moves=0;
const measure=i=>{
 const snap=r.adventureSnapshot(hero,game,health,true),chars=JSON.stringify(snap).length;
 assert.ok(r.validAdventure(JSON.parse(JSON.stringify(snap)),hero),'turn '+i+': a valid save');
 const said='I ask the reeve about the ferryman and the letter. '.repeat(20).slice(0,1000),ctx=r.dmContext(hero,game,health,said);
 const request=Buffer.byteLength(JSON.stringify({input:said,context:{...ctx,storyPreferences:{brutality:'gritty',narrator:'chronicler'},conversationWith:null,conversationParticipants:r.conversationPeople(game).map(n=>({id:n.id,name:n.name,role:n.role,attitude:n.attitude}))}}));
 const j=game.journal;assert.ok(r.validJournal(j),'turn '+i+': a valid journal');
 assert.ok(j.entries.length<=r.journalLimits.entries&&j.entries.filter(r.journalTalk).length<=r.journalLimits.talk,'turn '+i+': the journal within its limits');
 assert.equal(j.entries[0].text,opening,'turn '+i+': the tale\'s opening stays first');
 sizes.push({i,chars,request,journal:JSON.stringify(j).length});
};
const t0=Date.now();
for(let i=1;i<=TURNS;i++){
 const here=r.conversationPeople(game).map(n=>n.id);
 const conversation={question:('I ask the reeve about the mill, the letter and the ferryman, turn '+i+'.').padEnd(160,' '),npcId:here[0]??null,relationships:[],...reply(i,here),
  remember:[{text:'The reeve owes the ferryman '+i+' silver for the crossing on the night of the flood.',about:['keeper'],settles:null},{text:'Mara saw a light on the barrow on night '+i+' and told nobody but the hero.',about:['mara'],settles:null}],
  ...(i%5===0?{worldEvent:('Word spreads through the market about what happened on day '+i+'. ').repeat(6).slice(0,400)}:{})};
 let s=r.settleTurn({hero,game,health,action:null,conversation,random:()=>.5});
 assert.ok(!s.error,'turn '+i+': '+s.error);game=s.result.game;health=s.result.health??health;
 // Journeys, rests and notes along the way.
 // Journeys among the tale's places (a fight on the way is fought to its end), and long rests.
 const step=(chip,roll)=>{const t=r.settleTurn({hero,game,health,action:chip.action,random:()=>roll});if(t.error)return false;game=t.result.game;health=t.result.health??health;moves++;return true;};
 if(i%25===0){const chips=r.quickActions(hero,game,health)??[],want=['travel-inn','travel-bridge','travel-tower','long-rest'][(i/25)%4],chip=chips.find(c=>c.key===want)??chips.find(c=>/^travel-(inn|bridge|tower)$/.test(c.key??''));if(chip)step(chip,.5);}
 for(let k=0;k<30&&game.stage==='combat';k++){const chip=(r.quickActions(hero,game,health)??[]).find(c=>/^attack:|^end-turn$|^death-save$/.test(c.key??''));if(!chip||!step(chip,.95))break;}
 assert.ok(!['dying','dead'].includes(game.stage),'turn '+i+': the hero still stands ('+game.stage+')');
 if(i%200===0)game=r.addJournalNote(game,('A note to myself on day '+i+': trust nobody at the ferry. ').repeat(30).slice(0,1990));
 if(i%500===0)measure(i);
}
const took=Date.now()-t0,last=sizes.at(-1),half=sizes.find(s=>s.i===TURNS/2);
assert.ok(moves>=100,'journeys and rests were taken along the way: '+moves);
assert.ok(sizes.every(s=>s.chars<LIMITS.snapshot/4),'the save stays under a quarter of the snapshot limit: '+sizes.map(s=>s.chars).join(', '));
assert.ok(sizes.every(s=>s.request<LIMITS.request*0.75),'the request stays under three quarters of its limit: '+sizes.map(s=>s.request).join(', '));
assert.ok(last.chars<=half.chars*1.1&&last.journal<=half.journal*1.1,'sizes level off: '+half.chars+' at turn '+half.i+', '+last.chars+' at turn '+last.i);
// A shared table of four heroes after the same 5,000 turns: the campaign file with forty receipts.
{let table=r.startParty(r.adventureSnapshot(hero,game,health,true),'seat-0000000000000001','Brenna');
 for(const [n,key] of [[2,'wizard'],[3,'cleric'],[4,'rogue']]){const other=r.readyHero(key)??r.readyHero('fighter'),own=r.adventureSnapshot(other,r.newAdventure(other),null,true);const joined=r.joinParty(table,'seat-000000000000000'+n,{...own,name:'Hero '+n});assert.ok(!joined.error,joined.error);table=joined.snapshot;}
 const view=r.partyView(table,'seat-0000000000000002'),mine=JSON.parse(view.character);assert.ok(r.isValidCharacter(mine)&&r.validAdventure(view,mine),'the long table is valid for every hero');
 const file={id:'0'.repeat(32),owner:'a'.repeat(64),members:Object.fromEntries([1,2,3,4].map(n=>[String(n).repeat(64),{name:'Hero '+n,role:n===1?'owner':'player',seat:'seat-000000000000000'+n}])),inviteHash:'f'.repeat(64),inviteUntil:Date.now(),version:5000,updatedAt:new Date().toISOString(),updatedBy:'Brenna',snapshot:table,receipts:Array.from({length:40},(_,k)=>({id:'r'.repeat(16)+k,by:'seat-0000000000000001',version:4960+k}))};
 const chars=JSON.stringify(file).length;assert.ok(JSON.stringify(table).length<LIMITS.snapshot/3&&chars<LIMITS.snapshot/3,'the campaign file of a 5,000-turn table is well under the limit: '+chars);
 sizes.table=chars;}
// An old save with a journal far past the limits is still accepted, and trimmed at its next entry.
{let j={version:1,chapter:1,nextId:1,entries:[]};j=r.appendJournal(j,'quest','A new beginning','Where it began.');
 const old={...j,entries:[...j.entries,...Array.from({length:1499},(_,k)=>({id:k+2,chapter:1,kind:k%10?'note':'quest',title:k%10?'AI DM conversation':'Journey',text:'Line '+k}))],nextId:1501};
 assert.ok(r.validJournal(old),'a journal from before the limits is accepted as it is');
 const next=r.appendJournal(old,'note','Player note','Still here.');
 assert.ok(r.validJournal(next)&&next.entries.length<=r.journalLimits.entries&&next.entries[0].title==='A new beginning'&&next.entries.at(-1).text==='Still here.'&&next.entries.at(-1).id===next.entries.length,'trimmed at its next entry, newest kept, renumbered');
 const talk=next.entries.filter(r.journalTalk),oldTalk=old.entries.filter(r.journalTalk);
 assert.ok(talk.length>0&&talk.length<=r.journalLimits.talk&&talk.at(-1).text===oldTalk.at(-1).text,'the newest records of the Dungeon Master\'s words are kept, and they go first when the journal is full');
 assert.ok(next.entries.filter(e=>e.kind==='quest').length>talk.length,'milestones outlast the records of words');}
console.log('Long play: '+TURNS+' turns in '+(took/1000).toFixed(1)+' s; the save levels off at '+Math.round(last.chars/1000)+' kB (limit '+LIMITS.snapshot/1000+' kB), the journal at '+Math.round(last.journal/1000)+' kB, the largest request '+Math.round(Math.max(...sizes.map(s=>s.request))/1000)+' kB (limit 64 kB), a four-hero table\'s campaign file '+Math.round(sizes.table/1000)+' kB; an old journal past the limits is trimmed at its next entry.');
