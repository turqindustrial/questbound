const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// The permissions agreement (legalText.js, agreementRules.js, Agreement.js): asked once per browser before the first
// game, again when the legal texts change, recorded in this browser only, and readable in full with the other texts.
const ctx={};vm.createContext(ctx);
vm.runInContext(['legalText.js','agreementRules.js'].map(f=>fs.readFileSync(f,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export (const|function)/gm,'$1')).join('\n')+'\n;this.out={agreementStatus,acceptAgreement,agreementVersion,agreementKey,acceptedOn,permissionsAgreement,legalDocuments,legalUpdated};',ctx);
const {agreementStatus,acceptAgreement,agreementVersion,agreementKey,acceptedOn,permissionsAgreement,legalDocuments,legalUpdated}=ctx.out;
const store=new Map(),storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},plain=v=>JSON.parse(JSON.stringify(v));
assert.equal(agreementVersion,legalUpdated,'a change of the legal texts asks again');
assert.deepEqual(plain(agreementStatus(storage)),{accepted:false,acceptedAt:null,version:null});
assert.deepEqual(plain(agreementStatus(null)),{accepted:false,acceptedAt:null,version:null},'no storage, no agreement');
const record=acceptAgreement(storage,()=>Date.parse('2026-10-03T10:00:00Z'));
assert.equal(record.version,legalUpdated);assert.deepEqual(JSON.parse(store.get(agreementKey)),{version:legalUpdated,at:'2026-10-03T10:00:00.000Z'},'only the version and the date are written down');
assert.deepEqual(plain(agreementStatus(storage)),{accepted:true,acceptedAt:'2026-10-03T10:00:00.000Z',version:legalUpdated});
assert.equal(acceptedOn('2026-10-03T10:00:00.000Z'),'3 October 2026');assert.equal(acceptedOn('nonsense'),'');
store.set(agreementKey,JSON.stringify({version:'1 January 2020',at:'2020-01-01T00:00:00.000Z'}));assert.equal(agreementStatus(storage).accepted,false,'an agreement to older texts does not count');
store.set(agreementKey,'not json');assert.equal(agreementStatus(storage).accepted,false);
const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(agreementStatus(blocked).accepted,false);assert.doesNotThrow(()=>acceptAgreement(blocked));
// Seven short points, each with a first paragraph the dialog can show, in words that match what the code does.
assert.equal(permissionsAgreement.sections.length,7);
for(const s of permissionsAgreement.sections)assert.ok(s.paragraphs[0].length>40&&s.paragraphs[0].length<420,s.heading+' fits the dialog');
const words=permissionsAgreement.sections.flatMap(s=>s.paragraphs).join('\n');
for(const must of ['OpenAI','16 or older','cookie','recovery code','clearing this browser','in memory only'])assert.ok(words.includes(must),'the agreement mentions '+must);
assert.ok(legalDocuments.some(d=>d.id==='permissions'),'readable in full under Settings → About');
// Shown after the launch screen and before anything else, not while the player reads the full texts; accepted with one tap.
const app=fs.readFileSync('App.js','utf8'),dialog=fs.readFileSync('Agreement.js','utf8'),legal=fs.readFileSync('Legal.js','utf8'),home=fs.readFileSync('HomeScreen.js','utf8'),gate=fs.readFileSync('phone-server.cjs','utf8');
assert.ok(app.includes("useState(()=>agreementStatus().accepted)")&&app.includes("visible={launched&&!agreed&&screen!=='Legal'}")&&app.includes('acceptAgreement();setAgreed(true)'));
assert.ok(dialog.includes("onLegal('terms')")&&dialog.includes("onLegal('privacy')")&&dialog.includes("onLegal('permissions')")&&dialog.includes('16 or older')&&dialog.includes("dataSet={{qb:'scrim'}}"));
for(const section of permissionsAgreement.sections)assert.ok(dialog.includes("'"+section.heading.replace(/'/g,"\\'")+"'"),'an icon for '+section.heading);
assert.ok(legal.includes('Accepted in this browser on')&&legal.includes('Not yet accepted in this browser'));
assert.ok(app.includes("['permissions','Permissions agreement','check']")&&home.includes("['permissions','Permissions']"));
assert.ok(gate.includes('href="/permissions.html"')&&fs.existsSync('public/permissions.html')&&fs.existsSync('PERMISSIONS.md'),'the agreement is a page of its own too');
console.log('Permissions agreement: asked once per browser (again when the texts change), recorded as a date and a version only, seven points with icons, and the full text beside the policy and terms.');
