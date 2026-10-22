const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rulesSource}=require('./rules-files.cjs');
// A first greeting's agenda shows only a public want, never a secret (greetingAgenda in greetings.js; the deployment check
// of 2026-10-22 found 44 of the 286 library people who then got an agenda giving away a secret, crime or deception:
// "paid to keep quiet", "a judge he once bribed", "then hid it", "a crime from his youth", "she pretends", "a forbidden
// lover", "buried identity", "could expose her", "she admits"). Fixtures first, then every person of the host's people
// library when it is on this PC (read only; skipped when absent). Markers below are a list of their own, so a narrower
// agendaHush in greetings.js fails here too. `node verify-agendas.cjs --list` prints every agenda the library gives.
const r=vm.runInNewContext(rulesSource({extra:['worldArtRules.js']})+'\n({readyHero,newAdventure,hostileEncounterGame,greetingAgenda,agendaHush})',{AsyncStorage:{},weaponIcon:()=>'sword'});
const hero=r.readyHero('fighter');
const fight=r.hostileEncounterGame(hero,r.newAdventure(hero),()=>0),game={...fight,stage:'inn',enemyHP:0,foeFate:'slain'};
// Someone met from the people library, as introducePerson keeps them (pool, motive and hook).
const met=p=>({...game,people:{...(game.people??{}),n1:{name:p.name,role:p.role,motive:p.motive,hook:p.hook,pool:p.id,home:game.world?.at??'inn',appearance:p.appearance??'A plain figure.',species:p.species??'Human',gender:p.gender??'other',personality:p.personality??'Quiet.',toughness:'common',foe:'neutral'}}});
const agendaOf=p=>r.greetingAgenda(met(p),'n1');
// Words a secret, crime, deception, hidden past or a love kept hidden is told in.
const secretMarkers=[/\bsecret/i,/\bhid(?:e|es|den|ing)?\b/i,/\bconceal/i,/\bdisguis/i,/\bpaid to\b/i,/\bkeep (?:it )?quiet\b|\bquiet about\b/i,/\bsuppress/i,/\bbrib/i,
 /\bcrimes?\b|\bcriminal/i,/\bst(?:eal|ole|olen)\b|\btheft\b|\bthie(?:f|ves)\b/i,/\bsmuggl/i,/\bblackmail/i,/\bextort/i,/\bmurder/i,/\bpoison/i,/\bfugitive/i,/\boutlaw/i,
 /\bescap/i,/\bfled\b/i,/\bexile/i,/\bpretend/i,/\blie[sd]?\b|\blying\b/i,/\bfalse\b/i,/\bforg(?:e|ed|ery)\b/i,/\bcounterfeit/i,/\bdeceiv/i,/\binsist/i,/\bclaims?\b/i,
 /\bswears?\b|\bswore\b|\bsworn\b/i,/\bden(?:y|ies|ied)\b/i,/\bidentity\b/i,/\b(?:another|real|true|false|assumed|buried|old) name\b/i,/\bunder another name\b/i,/\bformer (?:life|self|identity|name)\b/i,
 /\bthe past\b|\b(?:his|her|their) past\b/i,/\bforbidden\b/i,/\blovers?\b|\bsweetheart|\baffair\b|\billi?cit\b/i,/\bexpos/i,/\badmit/i,/\bconfess/i,/\breveal/i,
 /\bbetray/i,/\bspy\b|\bspies\b|\bspying\b/i,/\blure[ds]?\b|\bambush/i,/\bguilt/i,/\bshame|\bashamed\b/i,/\bdisgrac/i,/\baccus/i,/\bframed\b/i,/\bblam/i,
 /\bdebts?\b|\bcreditor|\blender|\bloan/i,/\bborrow/i,/\bwager/i,/\bwitness/i,/\bknows?\b|\bknew\b/i,/\bcannot report\b/i,
 /\b(?:before|without|until)\b[^.,;]*\b(?:learn|discover|notice|find out|finds out|realis|realiz|recogni|admit|reveal|expos)/i,
 /\bnobody knows\b|\bno one knows\b/i,/\bhero(?:es)?\b|\badventurers?\b|\bstrangers?\b|\boutsiders?\b/i,/\byou\b/i];
const marked=t=>secretMarkers.filter(m=>m.test(t)).map(m=>String(t.match(m)[0]));
// ---- Fixtures: the deployment check's leaks, as hooks and as motives, say nothing ----
const leaks=['Milly was paid to keep quiet about a cellar beneath an abandoned dairy.','A judge Korrath once bribed is expected at harvest.',
 'Darian found treasure in the old workings, then hid it beneath his own mine.','A crime from his youth left a stolen signet buried beneath the ruin.',
 'Vorga still keeps the family signet she once used to lure her sibling into an ambush.','She pretends the message is a recipe.',
 'Aelthir\'s buried identity is tied to a contested inheritance.','Eirava meets a forbidden lover beside the waterwheel.',
 'Ygvara bears a mark that could expose her as the courier who endangered the caravan.','She admits the letter she has guarded for years names the person who falsified the deed.',
 'They want to keep their old identity buried while earning enough to leave the forest behind.','He wants his marsh ale to become famous enough that nobody asks what he did before brewing.',
 'To keep a secret relationship from being exposed by the powerful people who control their route.','He wants to deliver his current message without being recognized by people from his former life.',
 'She wants to keep her illiteracy undiscovered while learning which graves need tending.','To honor a promise by keeping a hungry marsh creature alive and out of danger.',
 'He wants to repay the stranger who saved his life before the old bargain claims another favor.','They are looking for the grown foundling they once helped smuggle aboard a boat.'];
const fixture={id:'np999',name:'Ilvane Sorrow',role:'Ferry hand'};
for(const t of leaks){
 assert.equal(agendaOf({...fixture,motive:t,hook:'A hook.'}),'','a motive that gives itself away says nothing: '+t);
 assert.equal(agendaOf({...fixture,motive:'',hook:t}),'','a hook is never told: '+t);
 assert.equal(agendaOf({...fixture,motive:'She wants to keep the ferry running through the flood season.',hook:t}).includes(t.slice(0,20)),false,'nothing of the hook beside a public motive');
}
assert.match(agendaOf({...fixture,motive:'She wants to keep the ferry running through the flood season.',hook:leaks[0]}),/^Ilvane (?:is|looks to be) hoping to keep the ferry running through the flood season\.$/,'a public want is told');
for(const t of leaks)assert.ok(r.agendaHush.test(t),'the hush catches '+t);
console.log('Passed: a first greeting\'s agenda is a public want from the motive, never the hook, and nothing when the motive gives a secret away ('+leaks.length+' leaks from the deployment check).');
// ---- The host's people library, when it is here ----
// This checkout's own (or QUESTBOUND_DATA's), else the main checkout's when this is a git worktree (read only).
function libraryFile(){
 if(process.env.QB_PEOPLE_LIBRARY)return process.env.QB_PEOPLE_LIBRARY;
 const here=path.join(process.env.QUESTBOUND_DATA||__dirname,'.questbound-people','library.json');if(fs.existsSync(here))return here;
 try{const dotGit=path.join(__dirname,'.git');if(fs.statSync(dotGit).isFile()){
  const gitDir=path.resolve(__dirname,fs.readFileSync(dotGit,'utf8').match(/^gitdir:\s*(.+)$/m)[1].trim());
  const common=path.resolve(gitDir,fs.existsSync(path.join(gitDir,'commondir'))?fs.readFileSync(path.join(gitDir,'commondir'),'utf8').trim():'.');
  return path.join(path.dirname(common),'.questbound-people','library.json');}}catch{}
 return here;
}
const file=libraryFile();
if(!fs.existsSync(file)){console.log('Skipped: no people library on this PC ('+file+').');return;}
const library=JSON.parse(fs.readFileSync(file,'utf8'));assert.ok(Array.isArray(library)&&library.length>0,'the people library is a list');
const told=[],leaked=[];
for(const p of library){
 const agenda=agendaOf(p);if(!agenda)continue;
 told.push({id:p.id,agenda});
 const want=agenda.match(/^.+? (?:is|looks to be) hoping to (.+)\.$/)?.[1]??'';
 const problems=[];
 if(!want)problems.push('not a want ("… is hoping to …")');
 else if(!String(p.motive).toLowerCase().includes(want.toLowerCase()))problems.push('not from the motive');
 if(r.agendaHush.test(agenda))problems.push('agendaHush: '+agenda.match(r.agendaHush)[0]);
 if(r.agendaHush.test(p.motive))problems.push('motive hushed: '+p.motive.match(r.agendaHush)[0]);
 const m=[...marked(agenda),...marked(p.motive).map(w=>'motive: '+w)];if(m.length)problems.push('markers: '+m.join(', '));
 if(problems.length)leaked.push(p.id+' '+agenda+' ['+problems.join('; ')+']');
}
if(process.argv.includes('--list'))for(const t of told)console.log(t.id+'  '+t.agenda);
assert.deepEqual(leaked,[],'agendas that may give a secret away:\n'+leaked.join('\n'));
console.log('Passed: '+told.length+' of '+library.length+' people in the host\'s people library get a first-meeting agenda, every one a public want from their motive with no secret marker ('+path.relative(__dirname,file)+').');
