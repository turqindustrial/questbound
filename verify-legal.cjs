const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),http=require('node:http'),os=require('node:os'),path=require('node:path');
// The legal side: the privacy policy, terms and licence notices (legalText.js) say what the code does, are shown in the
// game and on the pairing page, and playable content is limited to what the System Reference Documents license.
// `node verify-legal.cjs --write` rewrites public/privacy.html, public/terms.html, PRIVACY.md and TERMS.md from legalText.js.
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('legalText.js','utf8').replace(/^export (const|function)/gm,'$1')+'\n;this.out={legalUpdated,privacyPolicy,termsOfUse,licences,legalDocuments};',ctx);
const {legalUpdated,privacyPolicy,termsOfUse,licences,legalDocuments}=ctx.out;
const text=doc=>doc.sections.flatMap(s=>[s.heading,...s.paragraphs]).join('\n');
const all=legalDocuments.map(text).join('\n');
// What the words promise is what the code does.
assert.match(legalUpdated,/^\d{1,2} [A-Z][a-z]+ 20\d\d$/);
const sync=fs.readFileSync('sync-server.cjs','utf8'),accounts=fs.readFileSync('accounts.cjs','utf8');
assert.ok(sync.includes('cloudLimit=200')&&text(privacyPolicy).includes('200 most recent'),'recovery-code copies kept: 200');
assert.ok(accounts.includes('tokenDays=180')&&text(privacyPolicy).includes('180 days'),'sign-ins last 180 days');
assert.ok(accounts.includes("crypto.scrypt(")&&text(privacyPolicy).includes('salted hash of your password'));
assert.ok(accounts.includes("createHash('sha256').update('questbound-account-v1:'+email)")&&text(privacyPolicy).includes('hash of your email address'));
assert.ok(fs.readFileSync('Feedback.js','utf8').includes('device:deviceLabel()')&&text(privacyPolicy).includes('description of your device'));
assert.ok(fs.readFileSync('dm-server.cjs','utf8').includes("recordUsage('turn'")&&text(privacyPolicy).includes('never the words themselves'));
assert.ok(fs.readFileSync('webTheme.js','utf8').includes('fonts.googleapis.com')&&text(privacyPolicy).includes('Google Fonts'));
assert.ok(fs.readFileSync('launch.ps1','utf8').includes('cloudflared')&&text(privacyPolicy).includes('Cloudflare'));
assert.ok(fs.readFileSync('dm-server.cjs','utf8').includes('api.openai.com')&&text(privacyPolicy).includes('OpenAI'));
for(const doc of [privacyPolicy,termsOfUse])assert.ok(text(doc).includes('16'),doc.title+' names the age');
assert.ok(text(privacyPolicy).includes('Settings → Your account → Manage account')&&fs.readFileSync('AccountSettings.js','utf8').includes("'Manage account'"));
assert.ok(text(privacyPolicy).includes('Settings → Recovery code')&&fs.readFileSync('CloudSaveSettings.js','utf8').includes('title="Recovery code"'));
assert.ok(text(privacyPolicy).includes('Settings → Move your hero')&&fs.readFileSync('SaveTransfer.js','utf8').includes('Move your hero'));
assert.ok(!/\bD&D\b|Dungeons & Dragons/.test(all.replace(/never call the game Dungeons & Dragons or D&D/,'')),'no trademark used as a name');
// Both System Reference Documents are attributed in the exact words their licence asks for.
const notice=text(licences);
assert.ok(notice.includes('This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'));
assert.ok(notice.includes('This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'));
assert.ok(notice.includes('not affiliated with')&&notice.includes('compatible with fifth edition'));
// Playable content is the System Reference Documents' plus the Artificer and the Goblin in the game's own words; subclasses offered before stay valid for old heroes.
const rules={};vm.createContext(rules);
vm.runInContext(['subclassOptions.js','equipmentRules.js','characterRules.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^\s*import .*;\r?\n/gm,'').replace(/export /g,'')).join('\n')+'\n;this.out={classes,legacyClasses,species,legacySpecies,subclassOptions,legacySubclassOptions,validPlannedSubclass,buildError};',rules);
const r=rules.out;
assert.deepEqual(JSON.parse(JSON.stringify(r.classes)),['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard']);
assert.deepEqual(JSON.parse(JSON.stringify(r.species)),['Dragonborn','Dwarf','Elf','Dark Elf','Gnome','Goblin','Goliath','Half-Elf','Halfling','Human','Orc','Tiefling']);
assert.ok(notice.includes('the Artificer class, its four specialities and the Goblin species'),'the notice says which options go beyond the SRD');
const srdSubclasses={Barbarian:'Path of the Berserker',Bard:'College of Lore',Cleric:'Life Domain',Druid:'Circle of the Land',Fighter:'Champion',Monk:'Warrior of the Open Hand',Paladin:'Oath of Devotion',Ranger:'Hunter',Rogue:'Thief',Sorcerer:'Draconic Sorcery',Warlock:'Fiend Patron',Wizard:'Evoker'};
for(const [cls,sub] of Object.entries(srdSubclasses))assert.deepEqual(Object.keys(r.subclassOptions[cls]),[sub],cls);
assert.deepEqual(Object.keys(r.subclassOptions.Artificer),['Alchemist','Armorer','Artillerist','Battle Smith']);
assert.ok(Object.values(JSON.parse(JSON.stringify(r.legacySubclassOptions))).flat().length>=50,'what was offered before is still accepted for saved heroes');
assert.equal(r.validPlannedSubclass({class:'Barbarian',plannedSubclass:'Path of the Zealot'}),true);
assert.equal(r.validPlannedSubclass({class:'Barbarian',plannedSubclass:'Path of the Moon'}),false);
// No wording from unlicensed books in the game's own files.
for(const file of fs.readdirSync('.').filter(f=>/\.js$/.test(f))){const source=fs.readFileSync(file,'utf8');assert.ok(!/Monsters of the Multiverse|Player.s Handbook|Xanathar|Tasha.s Cauldron|Eberron|Forgotten Realms/.test(source),file+' names no unlicensed book');}
// The Dungeon Master and the story writer are told to stay in Questbound's own world.
for(const file of ['dm-server.cjs','adventure-generator.cjs'])assert.ok(fs.readFileSync(file,'utf8').includes('Never use names, places, gods, organisations, creatures or spells that belong to any publisher'),file);
// The pages are reachable: Settings → About, the title screen, the account form, and the pairing page before pairing.
const app=fs.readFileSync('App.js','utf8'),home=fs.readFileSync('HomeScreen.js','utf8'),gate=fs.readFileSync('phone-server.cjs','utf8');
assert.ok(app.includes("{screen === 'Legal' && <Legal tab={legalTab} onTab={setLegalTab}/>}")&&app.includes("['privacy','Privacy policy','key'],['terms','Terms of use','scroll'],['licences','Licences and credits','book']"));
assert.ok(home.includes("onLegal?.(tab)")&&home.includes("['privacy','Privacy'],['terms','Terms']"));
assert.ok(fs.readFileSync('AccountSettings.js','utf8').includes('By creating an account you accept the'));
assert.ok(gate.includes('href="/privacy.html"')&&gate.includes('href="/terms.html"')&&gate.includes('/^\\/(privacy|terms)\\.html$/.test(pathname)'));
// The same words as web pages and as repository documents, kept in step.
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const linkify=s=>escape(s).replace(/https?:\/\/[^\s)"]+/g,url=>'<a href="'+url+'">'+url+'</a>');
const htmlFor=(docs,title)=>{
 const body=docs.map(doc=>'<section><h2>'+escape(doc.title)+'</h2>'+doc.sections.map(s=>{const bullets=s.paragraphs.filter(p=>p.startsWith('- ')),plain=s.paragraphs.filter(p=>!p.startsWith('- '));return '<h3>'+escape(s.heading)+'</h3>'+plain.map(p=>'<p>'+linkify(p)+'</p>').join('')+(bullets.length?'<ul>'+bullets.map(p=>'<li>'+linkify(p.slice(2))+'</li>').join('')+'</ul>':'');}).join('')+'</section>').join('');
 return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Questbound · '+escape(title)+'</title><meta name="robots" content="noindex">\n<style>html{background:#08060a}body{margin:0 auto;max-width:720px;padding:28px 20px 48px;color:#ddd6db;font:16px/1.6 Georgia,"Times New Roman",serif;background:#08060a}h1{font-size:28px;letter-spacing:2px;text-transform:uppercase;color:#e04a5c;margin:0 0 4px}h2{font-size:22px;color:#eadaff;margin:34px 0 6px}h3{font-size:16px;letter-spacing:1px;color:#e04a5c;margin:22px 0 6px}p,li{color:#ddd6db}a{color:#b08cf5}.updated{color:#a99fa7;font-size:14px}nav a{margin-right:14px;font-size:14px;letter-spacing:1px;text-transform:uppercase}</style></head>\n<body><h1>Questbound</h1><p class="updated">Last updated '+escape(legalUpdated)+'</p><nav><a href="/privacy.html">Privacy policy</a><a href="/terms.html">Terms of use</a><a href="/">Back to the game</a></nav>'+body+'</body></html>\n';
};
const mdFor=docs=>'# Questbound: '+docs.map(d=>d.title).join(' and ')+'\n\n_Last updated '+legalUpdated+'. The same words are shown in the game under Settings → About. Written in legalText.js; `node verify-legal.cjs --write` regenerates this file._\n\n'+docs.map(doc=>'## '+doc.title+'\n\n'+doc.sections.map(s=>'### '+s.heading+'\n\n'+s.paragraphs.map(p=>p.startsWith('- ')?p:p+'\n').join('\n')).join('\n')).join('\n');
const outputs={'public/privacy.html':htmlFor([privacyPolicy],'Privacy policy'),'public/terms.html':htmlFor([termsOfUse,licences],'Terms of use'),'PRIVACY.md':mdFor([privacyPolicy]),'TERMS.md':mdFor([termsOfUse,licences])};
if(process.argv.includes('--write')){for(const [file,content] of Object.entries(outputs))fs.writeFileSync(file,content);console.log('Wrote '+Object.keys(outputs).join(', ')+'.');}
else for(const [file,content] of Object.entries(outputs))assert.equal(fs.existsSync(file)?fs.readFileSync(file,'utf8'):'',content,file+' is out of date: run node verify-legal.cjs --write');
// The pages are served to an unpaired browser, so the pairing page's links work.
(async()=>{
 const {createPhoneServer}=require('./phone-server.cjs');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'questbound-legal-'));
 try{
  fs.writeFileSync(path.join(tmp,'index.html'),'<!doctype html><title>game</title>');fs.writeFileSync(path.join(tmp,'privacy.html'),outputs['public/privacy.html']);fs.writeFileSync(path.join(tmp,'terms.html'),outputs['public/terms.html']);
  const {server}=createPhoneServer({root:tmp,host:'127.0.0.1',port:0,code:'12345678'});const port=await new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
  const get=p=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port,path:p,headers:{Host:'127.0.0.1:0'}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>resolve({status:res.statusCode,text:t}));}).on('error',reject));
  const privacy=await get('/privacy.html');assert.equal(privacy.status,200);assert.ok(privacy.text.includes('Privacy policy')&&privacy.text.includes('OpenAI'));
  assert.equal((await get('/terms.html')).status,200);assert.equal((await get('/index.html')).status,401,'the game itself still waits for pairing');
  const pairing=await get('/');assert.ok(pairing.text.includes('href="/privacy.html"'));
  await new Promise(r=>server.close(r));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 console.log('Legal: the policy, terms and licences match the code, are attributed as the SRD asks, reach players in the game and before pairing, and new heroes draw only on licensed content.');
})().catch(e=>{console.error(e);process.exit(1);});
