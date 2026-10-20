const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),http=require('node:http'),os=require('node:os'),path=require('node:path');
// The legal side: the privacy policy, terms and licence notices (legalText.js) say what the code does, are shown in the
// game and on the pairing page, and playable content is limited to what the System Reference Documents license.
// `node verify-legal.cjs --write` rewrites public/privacy.html, public/terms.html, public/permissions.html, PRIVACY.md,
// TERMS.md and PERMISSIONS.md from legalText.js.
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('legalText.js','utf8').replace(/^export (const|function)/gm,'$1')+'\n;this.out={legalUpdated,privacyPolicy,termsOfUse,permissionsAgreement,licences,legalDocuments};',ctx);
const {legalUpdated,privacyPolicy,termsOfUse,permissionsAgreement,licences,legalDocuments}=ctx.out;
const text=doc=>doc.sections.flatMap(s=>[s.heading,...s.paragraphs]).join('\n');
const all=legalDocuments.map(text).join('\n');
// What the words promise is what the code does.
assert.match(legalUpdated,/^\d{1,2} [A-Z][a-z]+ 20\d\d$/);
const sync=fs.readFileSync('account-server.cjs','utf8'),accounts=fs.readFileSync('accounts.cjs','utf8');
// The beta (accountsRequired false in accountRules.js): no accounts are offered and saves stay in the browser
// (cloudRules.js uploads nothing), so the texts describe the guest identity, shared tables and feedback only. Turning
// accounts on needs these texts rewritten for accounts (as before 10 October 2026) in the same change.
assert.ok(/^export const accountsRequired=false;$/m.test(fs.readFileSync('accountRules.js','utf8')),'accounts are on: rewrite legalText.js for accounts (email, password, recovery-code copies) before releasing them');
assert.ok(fs.readFileSync('cloudRules.js','utf8').includes('if(!accountsOffered()){clearTimeout(cloudTimer);cloudPending=null;return;}')&&text(privacyPolicy).includes('your saves stay there: they are not copied to the host\'s computer')&&text(permissionsAgreement).includes('no copies of your saves on the host\'s computer'),'saves stay in the browser, and the texts say so');
for(const doc of [privacyPolicy,termsOfUse,permissionsAgreement])assert.ok(!/Settings → (Your account|Recovery code)|recovery-code cop|verification (email|code|mail)|Sign out all devices|salted hash of your password|delete your account|deleting your account|create an account/i.test(text(doc)),doc.title+' describes no account feature players cannot use');
assert.ok(text(privacyPolicy).includes('no accounts, email addresses, passwords, recovery codes or copies of your own saves')&&text(termsOfUse).includes('No account is needed during the beta'),'the texts say there are no accounts in the beta');
// The guest identity: 90 days from its last use, removed after 60 unseen, the same HttpOnly cookie.
assert.ok(/guestDays=90\b/.test(accounts)&&/guestIdleDays=60\b/.test(accounts)&&text(privacyPolicy).includes('lasts 90 days from the last time it is used')&&text(privacyPolicy).includes('not seen for 60 days is removed')&&text(permissionsAgreement).includes('for 90 days from its last use'),'the guest identity\'s lifetime');
assert.ok(sync.includes('HttpOnly; SameSite=Strict')&&text(privacyPolicy).includes('HttpOnly and SameSite=Strict'),'the guest cookie');
assert.ok(text(privacyPolicy).includes('Campaign invites expire after 7 days')&&text(privacyPolicy).includes('Up to 20 encrypted earlier versions of each shared table'),'shared tables');
assert.ok(fs.readFileSync('Feedback.js','utf8').includes('device:deviceLabel()')&&text(privacyPolicy).includes('description of your device')&&text(privacyPolicy).includes('last two turns')&&text(privacyPolicy).includes('any errors the game showed you')&&fs.readFileSync('feedbackRules.js','utf8').includes('recent:')&&fs.readFileSync('Feedback.js','utf8').includes('Include what happened'),'the policy names what a feedback note carries');
// The label OpenAI gets for phone, tester-link and table turns is the identity's (for a guest, a cut of its random id).
assert.ok(fs.readFileSync('phone-server.cjs','utf8').includes("parsed.guest='account-'+permitted.id")&&fs.readFileSync('account-server.cjs','utf8').includes("guest:'account-'+user.id")&&fs.readFileSync('dm-server.cjs','utf8').includes("'qb-acct-'+guest.slice(8,40)"),'requests carry the identity\'s label');
assert.ok(text(privacyPolicy).includes('pseudonymous label for your browser: a cut of its random guest identifier')&&!text(privacyPolicy).includes('email address, the same on every device'),'the policy describes the label OpenAI gets');
assert.ok(fs.readFileSync('feedbackRules.js','utf8').includes('(g.storyLog??[]).slice(-6)')&&text(privacyPolicy).includes('latest six lines of the story log')&&text(privacyPolicy).includes('hit points, spells and class resources')&&text(privacyPolicy).includes('your experience points'),'the policy lists the story lines, hit points and experience a note carries');
// Anonymous play counts and session ratings (2026-10-13): the texts name what a record carries, the opt-out and the
// retention the servers enforce, and that neither carries words, names or the browser's label.
{const metrics=require('./play-metrics.cjs'),notes=fs.readFileSync('feedback-notes.cjs','utf8'),insight=fs.readFileSync('InsightControls.js','utf8'),counts=fs.readFileSync('playMetrics.js','utf8');
 assert.equal(metrics.metricsRetentionDays,180);assert.ok(text(privacyPolicy).includes('Play counts are kept for 180 days and then deleted')&&text(permissionsAgreement).includes('anonymous play counts (for 180 days)')&&insight.includes('kept by the host for 180 days'),'the counts\' retention');
 assert.ok(insight.includes('Help improve Questbound')&&insight.includes('Share anonymous play counts')&&insight.includes('Ask how a session went')&&text(privacyPolicy).includes('Settings → Help improve Questbound')&&text(permissionsAgreement).includes('unless you turn them off in Settings'),'the opt-out is where the texts say');
 for(const words of ['how long you played','how many turns you took, how many failed and how','where you stopped','the tale opening you chose','whether Easy start was on','how many tales you waited for','phone, tablet or desktop','random counting identifier','not your guest identity','Never what you type, names, your hero or your story','forgets the identifier'])assert.ok(text(privacyPolicy).includes(words),'the policy says the counts carry: '+words);
 assert.ok(counts.includes("if(next.counts===false)next.device=null;")&&counts.includes('agreementStatus().accepted'),'turning the counts off forgets the id; nothing is sent before the agreement');
 assert.ok(notes.includes("guest:null,kind:'session'")&&text(privacyPolicy).includes('no label for your browser')&&text(privacyPolicy).includes('your answer (Great, Good, Okay or Rough)'),'a session rating carries no label and the policy says so');
 assert.ok(text(permissionsAgreement).includes('Anonymous play counts')&&text(permissionsAgreement).includes('session ratings'),'the agreement names the counts and the ratings');}
assert.ok(fs.readFileSync('dm-server.cjs','utf8').includes("recordUsage('turn'")&&text(privacyPolicy).includes('never the words themselves'));
// The content check and table moderation (moderation.cjs, campaigns.cjs, tableMutes.js; the host, 2026-10-13): the
// texts say typed words and table names go to OpenAI's moderation service, what a report carries, the pause, mutes and bans.
{const mod=fs.readFileSync('moderation.cjs','utf8'),camp=fs.readFileSync('campaigns.cjs','utf8');
 assert.ok(mod.includes("MODEL='omni-moderation-latest'")&&text(privacyPolicy).includes("OpenAI's moderation service")&&text(termsOfUse).includes("checked by OpenAI's moderation service")&&text(permissionsAgreement).includes("OpenAI's moderation service checks what you type"),'the moderation check is described');
 assert.ok(camp.includes('return lines.slice(-5);')&&text(privacyPolicy).includes('the last few lines (at most five) the reported player typed'),'what a report carries');
 assert.ok(mod.includes('pauseMs=1200000')&&text(privacyPolicy).includes('pause your use of the Dungeon Master for twenty minutes'),'the pause');
 assert.ok(text(privacyPolicy).includes('the players you muted at each shared table')&&fs.readFileSync('tableMutes.js','utf8').includes("KEY='questbound.mutes.v1'")&&text(privacyPolicy).includes('keeps a keyed hash of that browser')&&text(termsOfUse).includes('close the whole game to your browser'),'mutes and bans');}
// Typefaces come from the host, so no third party sees a page load; the policy no longer names Google Fonts.
for(const file of ['webTheme.js','public/index.html','phone-server.cjs'])assert.ok(!fs.readFileSync(file,'utf8').includes('fonts.googleapis.com'),file+' loads no fonts from Google');
assert.ok(!text(privacyPolicy).includes('Google Fonts')&&fs.existsSync('public/fonts/fonts-v2.css')&&['cinzel','cinzel-decorative','eb-garamond','inter'].every(f=>fs.existsSync('public/fonts/OFL-'+f+'.txt')),'fonts and their licences are in public/fonts');
assert.ok(fs.readFileSync('launch.ps1','utf8').includes('cloudflared')&&text(privacyPolicy).includes('Cloudflare'));
assert.ok(fs.readFileSync('dm-server.cjs','utf8').includes('api.openai.com')&&text(privacyPolicy).includes('OpenAI'));
for(const doc of [privacyPolicy,termsOfUse,permissionsAgreement])assert.ok(text(doc).includes('16'),doc.title+' names the age');
// The limits the texts describe are the ones the servers enforce.
const gateway=fs.readFileSync('phone-server.cjs','utf8');assert.ok(gateway.includes('limiter(requestLimit,600000)')&&text(termsOfUse).includes('fair number of requests')&&text(privacyPolicy).includes('The services count requests and wrong pairing codes.'));
// What the texts name in the game is there: Settings → Move your hero, and Play Together on the title screen.
assert.ok(fs.readFileSync('HomeScreen.js','utf8').includes("'Play Together','Multiplayer'")&&text(privacyPolicy).includes('Leave a shared table under Play Together'));
assert.ok(text(privacyPolicy).includes('Settings → Move your hero')&&fs.readFileSync('SaveTransfer.js','utf8').includes('Move your hero'));
assert.ok(!/\bD&D\b|Dungeons & Dragons/.test(all.replace(/never call the game Dungeons & Dragons or D&D/,'')),'no trademark used as a name');
// Both System Reference Documents are attributed in the exact words their licence asks for.
const notice=text(licences);
assert.ok(notice.includes('This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'));
assert.ok(notice.includes('This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'));
assert.ok(notice.includes('not affiliated with')&&notice.includes('compatible with fifth edition'));
// Playable content is the System Reference Documents' plus the Artificer and the Goblin in the game's own words; subclasses offered before stay valid for old heroes.
const rules={};vm.createContext(rules);
vm.runInContext(['subclassOptions.js','equipmentRules.js','characterRules.js','subclassRules.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n')+'\n;this.out={classes,legacyClasses,species,legacySpecies,subclassOptions,legacySubclassOptions,validPlannedSubclass,buildError};',rules);
const r=rules.out;
assert.deepEqual(JSON.parse(JSON.stringify(r.classes)),['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard']);
assert.deepEqual(JSON.parse(JSON.stringify(r.species)),['Dragonborn','Dwarf','High Elf','Wood Elf','Drow','Gnome','Goblin','Goliath','Half-Elf','Halfling','Human','Orc','Tiefling']);
assert.ok(notice.includes('the Artificer class and its five specialities, three further subclasses for every other class, marked Questbound, and the Goblin species'),'the notice says which options go beyond the SRD');
const srdSubclasses={Barbarian:'Path of the Berserker',Bard:'College of Lore',Cleric:'Life Domain',Druid:'Circle of the Land',Fighter:'Champion',Monk:'Warrior of the Open Hand',Paladin:'Oath of Devotion',Ranger:'Hunter',Rogue:'Thief',Sorcerer:'Draconic Sorcery',Warlock:'Fiend Patron',Wizard:'Evoker'};
// The SRD's own subclass comes first, then three of Questbound's own (subclassRules.js plays them; verify-subclasses.cjs
// checks their names against the books' and their features against the catalog).
for(const [cls,sub] of Object.entries(srdSubclasses)){const keys=Object.keys(r.subclassOptions[cls]);assert.equal(keys[0],sub,cls);assert.equal(keys.length,4,cls+' offers four paths');}
assert.deepEqual(Object.keys(r.subclassOptions.Artificer),['Alchemist','Armorer','Artillerist','Battle Smith','Snarewright']);
{const catalog=JSON.parse(fs.readFileSync('classFeatureCatalog.json','utf8')),srd=new Set(Object.values(srdSubclasses));
 for(const f of catalog.filter(f=>f.subclass))assert.equal(f.source,srd.has(f.subclass)?'SRD 5.2':'Questbound',f.subclass+' '+f.name+' is marked with where it comes from');}
assert.ok(Object.values(JSON.parse(JSON.stringify(r.legacySubclassOptions))).flat().length>=50,'what was offered before is still accepted for saved heroes');
assert.equal(r.validPlannedSubclass({class:'Barbarian',plannedSubclass:'Path of the Zealot'}),true);
assert.equal(r.validPlannedSubclass({class:'Barbarian',plannedSubclass:'Path of the Moon'}),false);
// No unlicensed book named in any of the game's own files: code, servers and prompts, data, pages and documents
// (everything but installed packages, builds and private data). The only exceptions are the lines that tell the
// Dungeon Master, the story writer or a developer what never to use.
{
 const books=new RegExp(['Player.s Handbook','Dungeon Master.s Guide','Monster Manual','Xanathar','Tasha','Volo.s','Mordenkainen','Monsters of the Multiverse','Fizban','Sword Coast','Wildemount','Tal.Dorei','Critical Role','Eberron','Forgotten Realms','Ravnica','Theros','Ravenloft','Strixhaven','Spelljammer','Astral Adventurer','Planescape','Bigby','Book of Many Things','Acquisitions Incorporated','Radiant Citadel','Elemental Evil','Princes of the Apocalypse','Dragonlance','Phandelver','Curse of Strahd','Tomb of Annihilation','Storm King.s Thunder','Out of the Abyss','Tyranny of Dragons','Hoard of the Dragon Queen','Rise of Tiamat','Dragon Heist','Mad Mage','Descent into Avernus','Icewind Dale','Rime of the Frostmaiden','Candlekeep','Witchlight','Ghosts of Saltmarsh','Golden Vault','Vecna','Infinite Staircase','Heroes of Faer','Kwalish','Glory of the Giants','Lost Mine','Dungeon of the Mad Mage','Mythic Odysseys','Van Richten'].map(t=>'\\b'+t+'\\b').join('|'),'i');
 const skip=/^(?:node_modules|dist[\w-]*|\.git|\.expo|project-memory|backups?|\.questbound-.*)$/,exempt=/never use names|is not SRD wording|book-name guard/i,seen=[];
 const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(skip.test(e.name)||(dir==='assets'&&e.name==='art'))continue;const p=dir==='.'?e.name:dir+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(?:js|cjs|mjs|json|md|html)$/.test(e.name))seen.push(p);}};
 walk('.');
 for(const file of seen){if(file==='verify-legal.cjs')continue;const lines=fs.readFileSync(file,'utf8').split('\n');lines.forEach((line,i)=>assert.ok(exempt.test(line)||!books.test(line),file+':'+(i+1)+' names an unlicensed book ('+line.match(books)?.[0]+')'));}
 assert.ok(seen.includes('dm-server.cjs')&&seen.includes('classFeatureCatalog.json')&&seen.includes('public/privacy.html')&&seen.includes('README.md'),'the guard reads servers, data, pages and documents');
}
// The Dungeon Master and the story writer are told to stay in Questbound's own world.
for(const file of ['dm-instructions.cjs','adventure-generator.cjs'])assert.ok(fs.readFileSync(file,'utf8').includes('Never use names, places, gods, organisations, creatures or spells that belong to any publisher'),file);
// The pages are reachable: Settings → About, the title screen, the account form, and the pairing page before pairing.
const app=fs.readFileSync('App.js','utf8'),home=fs.readFileSync('HomeScreen.js','utf8'),gate=fs.readFileSync('phone-server.cjs','utf8');
assert.ok(app.includes("{screen === 'Legal' && <Legal tab={legalTab} onTab={setLegalTab}/>}")&&app.includes("['privacy','Privacy policy','key'],['terms','Terms of use','scroll'],['permissions','Permissions agreement','check'],['licences','Licences and credits','book']"));
assert.ok(home.includes("onLegal?.(tab)")&&home.includes("['privacy','Privacy'],['terms','Terms']"));
assert.ok(fs.readFileSync('AccountSettings.js','utf8').includes('By creating an account you accept the'));
assert.ok(gate.includes('href="/privacy.html"')&&gate.includes('href="/terms.html"')&&gate.includes('href="/permissions.html"')&&gate.includes('/^\\/(privacy|terms|permissions)\\.html$/.test(pathname)'));
// The same words as web pages and as repository documents, kept in step.
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const linkify=s=>escape(s).replace(/https?:\/\/[^\s)"]+/g,url=>'<a href="'+url+'">'+url+'</a>');
const htmlFor=(docs,title)=>{
 const body=docs.map(doc=>'<section><h2>'+escape(doc.title)+'</h2>'+doc.sections.map(s=>{const bullets=s.paragraphs.filter(p=>p.startsWith('- ')),plain=s.paragraphs.filter(p=>!p.startsWith('- '));return '<h3>'+escape(s.heading)+'</h3>'+plain.map(p=>'<p>'+linkify(p)+'</p>').join('')+(bullets.length?'<ul>'+bullets.map(p=>'<li>'+linkify(p.slice(2))+'</li>').join('')+'</ul>':'');}).join('')+'</section>').join('');
 return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Questbound · '+escape(title)+'</title><meta name="robots" content="noindex">\n<style>html{background:#08060a}body{margin:0 auto;max-width:720px;padding:28px 20px 48px;color:#ddd6db;font:16px/1.6 Georgia,"Times New Roman",serif;background:#08060a}h1{font-size:28px;letter-spacing:2px;text-transform:uppercase;color:#e04a5c;margin:0 0 4px}h2{font-size:22px;color:#eadaff;margin:34px 0 6px}h3{font-size:16px;letter-spacing:1px;color:#e04a5c;margin:22px 0 6px}p,li{color:#ddd6db}a{color:#b08cf5}.updated{color:#a99fa7;font-size:14px}nav a{margin-right:14px;font-size:14px;letter-spacing:1px;text-transform:uppercase}</style></head>\n<body><h1>Questbound</h1><p class="updated">Last updated '+escape(legalUpdated)+'</p><nav><a href="/privacy.html">Privacy policy</a><a href="/terms.html">Terms of use</a><a href="/permissions.html">Permissions</a><a href="/">Back to the game</a></nav>'+body+'</body></html>\n';
};
const mdFor=docs=>'# Questbound: '+docs.map(d=>d.title).join(' and ')+'\n\n_Last updated '+legalUpdated+'. The same words are shown in the game under Settings → About. Written in legalText.js; `node verify-legal.cjs --write` regenerates this file._\n\n'+docs.map(doc=>'## '+doc.title+'\n\n'+doc.sections.map(s=>'### '+s.heading+'\n\n'+s.paragraphs.map(p=>p.startsWith('- ')?p:p+'\n').join('\n')).join('\n')).join('\n');
const outputs={'public/privacy.html':htmlFor([privacyPolicy],'Privacy policy'),'public/terms.html':htmlFor([termsOfUse,licences],'Terms of use'),'public/permissions.html':htmlFor([permissionsAgreement],'Permissions agreement'),'PRIVACY.md':mdFor([privacyPolicy]),'TERMS.md':mdFor([termsOfUse,licences]),'PERMISSIONS.md':mdFor([permissionsAgreement])};
if(process.argv.includes('--write')){for(const [file,content] of Object.entries(outputs))fs.writeFileSync(file,content);console.log('Wrote '+Object.keys(outputs).join(', ')+'.');}
// Compared without regard to line endings: .gitattributes keeps these files LF, but a Windows checkout made before
// that holds them with CRLF.
else for(const [file,content] of Object.entries(outputs))assert.equal(fs.existsSync(file)?fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'):'',content,file+' is out of date: run node verify-legal.cjs --write');
// The pages are served to an unpaired browser, so the pairing page's links work.
(async()=>{
 const {createPhoneServer}=require('./phone-server.cjs');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-legal-'));
 try{
  fs.writeFileSync(path.join(tmp,'index.html'),'<!doctype html><title>game</title>');fs.writeFileSync(path.join(tmp,'privacy.html'),outputs['public/privacy.html']);fs.writeFileSync(path.join(tmp,'terms.html'),outputs['public/terms.html']);fs.writeFileSync(path.join(tmp,'permissions.html'),outputs['public/permissions.html']);
  const {server}=createPhoneServer({root:tmp,host:'127.0.0.1',port:0,code:'12345678'});const port=await new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
  const get=p=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port,path:p,headers:{Host:'127.0.0.1:0'}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>resolve({status:res.statusCode,text:t}));}).on('error',reject));
  const privacy=await get('/privacy.html');assert.equal(privacy.status,200);assert.ok(privacy.text.includes('Privacy policy')&&privacy.text.includes('OpenAI'));
  assert.equal((await get('/terms.html')).status,200);assert.equal((await get('/permissions.html')).status,200);assert.equal((await get('/index.html')).status,401,'the game itself still waits for pairing');
  fs.mkdirSync(path.join(tmp,'fonts'));fs.writeFileSync(path.join(tmp,'fonts','fonts-v2.css'),'/* fonts */');assert.equal((await get('/fonts/fonts-v2.css')).status,200,'the pairing page can use the fonts');assert.equal((await get('/fonts/../index.html')).status,401);
  const pairing=await get('/');assert.ok(pairing.text.includes('href="/privacy.html"')&&pairing.text.includes('href="/permissions.html"'));
  await new Promise(r=>server.close(r));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 console.log('Legal: the policy, terms and licences match the code, are attributed as the SRD asks, reach players in the game and before pairing, and new heroes draw only on licensed content.');
})().catch(e=>{console.error(e);process.exit(1);});
