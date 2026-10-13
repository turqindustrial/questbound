// Player accounts: an email and a password that keep a player's hero and adventure on the host's PC, so signing in on
// another phone or browser (or after this one loses its data) brings them back.
//
// What is kept, in .questbound-accounts/ (git-ignored):
//   <id>.json       the password as a salted scrypt hash, and hashes of the sign-in tokens handed to that player's devices
//   <id>.save.json  their latest hero and adventure
// <id> is a hash of the email address: the address itself is never written down, so the folder holds no list of who
// plays. A short-lived code sent by the configured game mailbox verifies ownership. A forgotten password is reset by the host (see the commands at the end of this file).
// Wrong passwords are counted per account, per caller and overall, and further tries are refused for a while.
//
// Guests (while accounts are not required: accountsRequired in accountRules.js): a browser without a session is given an
// anonymous guest identity, kept in guests/<id>.json: a random id, the hash of its sign-in token and when it was last
// seen. No email, no password, no saved adventure. Guests never count against the email account limit; they have their
// own (guestLimit), and a guest not seen for guestIdleDays is removed (onGuestRemoved lets campaigns forget them).
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const fail=(status,message)=>Object.assign(Error(message),{status});
const normalEmail=email=>typeof email==='string'?email.trim().toLowerCase():'';
const validEmail=email=>email.length<=254&&/^[^\s@]{1,64}@[^\s@.]{1,63}(\.[^\s@.]{1,63})+$/.test(email);
const validPassword=password=>typeof password==='string'&&password.length>=8&&password.length<=200;
// Passwords that guessers try first are refused: the most common ones, one character repeated, a run of keys or
// digits, the game's own name, and the player's email or the name before its @.
const commonPasswords=new Set(['password','password1','password12','password123','password1234','passw0rd','p@ssw0rd','p@ssword','12345678','123456789','1234567890','0123456789','87654321','987654321','11111111','00000000','12341234','11223344','123123123','qwertyui','qwertyuiop','qwerty12','qwerty123','qwerty1234','1q2w3e4r','1q2w3e4r5t','1qaz2wsx','zaq12wsx','asdfghjk','asdfghjkl','zxcvbnm1','abc12345','abcd1234','abcdefgh','iloveyou','iloveyou1','sunshine','sunshine1','princess','princess1','football','football1','baseball','basketball','welcome1','welcome123','letmein1','letmein123','trustno1','superman','starwars','dragon12','dragon123','monkey12','master12','shadow12','michael1','jennifer','computer','whatever','internet','corvette','mustang1','charlie1','liverpool','chelsea1','pokemon1','minecraft','fortnite','changeme','default1','admin123','administrator','dungeons','dungeonsanddragons','dragons1']);
function weakPassword(password,email=''){
 const p=String(password).normalize('NFKC').toLowerCase(),local=String(email).split('@')[0];
 return commonPasswords.has(p)||/^(.)\1+$/.test(p)||'01234567890123456789'.includes(p)||'98765432109876543210'.includes(p)||'abcdefghijklmnopqrstuvwxyz'.includes(p)||/questbound/.test(p)||(!!email&&p===email)||(local.length>=4&&p.includes(local));
}
const accountId=email=>crypto.createHash('sha256').update('questbound-account-v1:'+email).digest('hex');
const digest=token=>crypto.createHash('sha256').update(String(token)).digest('hex');
const hashPassword=(password,salt)=>new Promise((resolve,reject)=>crypto.scrypt(password.normalize('NFKC'),salt,64,{N:32768,r:8,p:1,maxmem:96*1024*1024},(error,key)=>error?reject(error):resolve(key)));
function createAccounts({dir=path.join(__dirname,'.questbound-accounts'),limit=500,tokenDays=7,idleHours=12,tokensEach=8,now=Date.now,validSnapshot=()=>true,mailer=require('./mailer.cjs').createMailer(),requireVerification=true,backup=null,audit=()=>{},allowGuests=false,guestLimit=5000,guestDays=90,guestIdleDays=60,onGuestRemoved=()=>{}}={}){
 const guestDir=path.join(dir,'guests');
 const file=id=>path.join(dir,id+'.json'),saveFile=id=>path.join(dir,id+'.save.json'),guestFile=id=>path.join(guestDir,id+'.json');
 const readFrom=where=>{try{const record=JSON.parse(fs.readFileSync(where,'utf8'));return record&&record.v===1?record:null;}catch{return null;}};
 const read=id=>{const record=readFrom(file(id));return record&&!record.guest?record:null;};
 const readGuest=id=>{const record=readFrom(guestFile(id));return record?.guest===true?record:null;};
 const write=(id,record)=>{const where=record?.guest?guestFile(id):file(id);fs.mkdirSync(path.dirname(where),{recursive:true});const tmp=where+'.tmp';fs.writeFileSync(tmp,JSON.stringify(record));fs.renameSync(tmp,where);};
 const listIn=where=>{try{return fs.readdirSync(where).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).map(f=>f.slice(0,64));}catch{return [];}};
 const ids=()=>listIn(dir),guestIds=()=>listIn(guestDir);
 // Which account (or guest) a sign-in token belongs to (kept in memory, rebuilt from the records at start).
 const owners=new Map();
 for(const id of ids()){const record=read(id);for(const [key,until] of Object.entries(record?.tokens??{}))if(until>now())owners.set(key,id);}
 for(const id of guestIds()){const record=readGuest(id);for(const [key,until] of Object.entries(record?.tokens??{}))if(until>now())owners.set(key,id);}
 const failures=new Map(),overall=[];
 const recent=(key,span)=>{
  if(!failures.has(key)&&failures.size>=2048){for(const [k,list] of failures)if(!list.length||list.at(-1)<=now()-900000)failures.delete(k);if(failures.size>=2048)return Array(12).fill(now());}
  const list=(failures.get(key)??[]).filter(t=>t>now()-span);failures.set(key,list);return list;
 };
 const blocked=(id,client)=>recent('a:'+id,900000).length>=5||recent('c:'+client,900000).length>=12||overall.filter(t=>t>now()-3600000).length>=200;
 const missed=(id,client)=>{recent('a:'+id,900000).push(now());recent('c:'+client,900000).push(now());overall.push(now());if(overall.length>400)overall.splice(0,overall.length-400);};
 const issue=(id,record)=>{
  const token=crypto.randomBytes(32).toString('hex'),tokens=Object.fromEntries(Object.entries(record.tokens??{}).filter(([,until])=>until>now()).sort((a,b)=>b[1]-a[1]).slice(0,tokensEach-1));
  for(const key of Object.keys(record.tokens??{}))if(!(key in tokens))owners.delete(key);
  tokens[digest(token)]=now()+tokenDays*86400000;record.tokens=tokens;record.seen=Object.fromEntries(Object.keys(tokens).map(k=>[k,k===digest(token)?now():record.seen?.[k]??now()]));write(id,record);owners.set(digest(token),id);return token;
 };
 const savedAt=id=>{try{return JSON.parse(fs.readFileSync(saveFile(id),'utf8')).savedAt??null;}catch{return null;}};
 const matches=async(record,password)=>{const key=await hashPassword(String(password),Buffer.from(record.salt,'hex')),stored=Buffer.from(record.hash,'hex');return key.length===stored.length&&crypto.timingSafeEqual(key,stored);};
 const signedIn=token=>{
  const key=typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?digest(token):null,id=key?owners.get(key):null,record=id?read(id)??readGuest(id):null;
  if(!record||!((record.tokens?.[key]??0)>now())){if(key)owners.delete(key);throw fail(401,'You are signed out. Sign in again to keep saving to your account.');}
  // A guest: never verified and no idle expiry; the token lasts guestDays from its last use (renewed once a day).
  // While accounts are required (allowGuests false) a guest record is not an identity at all.
  if(record.guest){
   if(!allowGuests)throw fail(401,'Sign in with your account to play.');
   let renewed=false;if(!(record.seen?.[key]>now()-86400000)){record.seen={...record.seen,[key]:now()};record.tokens[key]=now()+guestDays*86400000;write(id,record);renewed=true;}
   return {id,record,key,guest:true,renewed};
  }
  if(requireVerification&&!record.verifiedAt)throw fail(401,'Sign in again and verify your email to access this account.');
  if(!(record.seen?.[key]>now()-idleHours*3600000)){delete record.tokens[key];owners.delete(key);write(id,record);throw fail(401,'Your session expired after inactivity. Sign in again.');}
  if(now()-record.seen[key]>60000){record.seen[key]=now();write(id,record);}
  return {id,record,key};
 };
 // What only an email account may do: keep a saved adventure, change its password, sign out everywhere, be deleted.
 const member=token=>{const who=signedIn(token);if(who.guest)throw fail(403,'Create an account or sign in to use this.');return who;};
 // Guests not seen for guestIdleDays (or whose token ran out) are removed: at most once an hour, or at once when the
 // guest store is full.
 let pruned=0;
 function pruneGuests(force=false){
  if(!force&&now()-pruned<3600000)return 0;pruned=now();let removed=0;
  for(const id of guestIds()){
   const record=readGuest(id),seen=Math.max(0,...Object.values(record?.seen??{})),alive=Object.values(record?.tokens??{}).some(until=>until>now());
   if(record&&alive&&seen>now()-guestIdleDays*86400000)continue;
   for(const key of Object.keys(record?.tokens??{}))owners.delete(key);fs.rmSync(guestFile(id),{force:true});removed++;
   try{onGuestRemoved(id);}catch{}audit('guest-removed',{account:id});
  }
  return removed;
 }
 // Serialize operations on an account: an old sign-in must not restore a password
 // or token that another request just revoked. Bound queued password-hash work too.
 const locks=new Map();let pending=0;
 const ordered=(id,work)=>{
  if(pending>=24)return Promise.reject(fail(429,'Account service is busy. Try again shortly.'));
  pending++;
  const task=(locks.get(id)??Promise.resolve()).then(work);
  const settled=task.catch(()=>{}).finally(()=>{pending--;if(locks.get(id)===settled)locks.delete(id);});
  locks.set(id,settled);return task;
 };
 const unchanged=(id,record)=>{if(JSON.stringify(read(id))!==JSON.stringify(record))throw fail(409,'Your account changed during this request. Try again.');};
 const pendingFile=id=>path.join(dir,id+'.pending.json');
 const readPending=id=>{try{return JSON.parse(fs.readFileSync(pendingFile(id),'utf8'));}catch{return null;}};
 const challenge=async(email,record,candidate=null)=>{
  if(!mailer.configured())throw fail(503,'Email verification is not connected yet. Ask the host to connect the game mailbox.');
  const id=accountId(email),old=readPending(id);
  if(old?.sentAt>now()-60000)throw fail(429,'Wait one minute before requesting another email.');
  if(old?.day===new Date(now()).toISOString().slice(0,10)&&old.sent>=5)throw fail(429,'Verification email limit reached. Try again tomorrow.');
  fs.mkdirSync(dir,{recursive:true});
  const pendingFiles=fs.readdirSync(dir).filter(f=>/^[a-f0-9]{64}\.pending\.json$/.test(f));
  for(const f of pendingFiles){const p=path.join(dir,f);if(fs.statSync(p).mtimeMs<now()-86400000)fs.rmSync(p,{force:true});}
  if(!old&&pendingFiles.length>=limit)throw fail(429,'Verification is busy. Try again later.');
  const code=String(crypto.randomInt(10000000,100000000)),ticket=crypto.randomBytes(32).toString('hex'),day=new Date(now()).toISOString().slice(0,10);
  const p={ticket:digest(ticket),code:digest(code),expires:now()+600000,attempts:0,sentAt:now(),day,sent:old?.day===day?(old.sent??0)+1:1,version:digest(JSON.stringify(record)),candidate};
  fs.writeFileSync(pendingFile(id),JSON.stringify(p),{mode:0o600});
  try{await mailer.verification(email,code);}catch{audit('mail-failed',{account:id});throw fail(503,'The verification email could not be sent. Try again in one minute.');}
  audit('verification-sent',{account:id});return {verificationRequired:true,email,challenge:ticket,expiresIn:600};
 };
 const sessionResult=(id,record,email)=>({token:issue(id,record),id,email,verified:true,savedAt:savedAt(id)});
 const actions={
  async register(email,password,client='this-pc',recoveryCode='',termsVersion=null){
   email=normalEmail(email);
   if(!validEmail(email))throw fail(400,'Enter a full email address, like name@example.com.');
   if(!validPassword(password))throw fail(400,'Choose a password of at least 8 characters.');
   if(weakPassword(password,email))throw fail(400,'That password is one guessers try first. Choose one that is harder to guess.');
   const id=accountId(email),existing=read(id);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes and try again.');
   if(existing&&!existing.reset){missed(id,client);throw fail(409,'There is already an account with that email. Sign in instead.');}
   if(existing?.reset){
    const supplied=typeof recoveryCode==='string'&&/^[a-f0-9]{48}$/i.test(recoveryCode)?digest(recoveryCode.toLowerCase()):null;
    if(!supplied||!existing.resetHash||!(existing.resetUntil>now())||!crypto.timingSafeEqual(Buffer.from(supplied,'hex'),Buffer.from(existing.resetHash,'hex'))){missed(id,client);throw fail(401,'Ask the host for a fresh recovery code to reset this account.');}
   }
   if(!existing&&ids().length>=limit)throw fail(429,'This game has all the accounts it can hold. Ask the host.');
   const salt=crypto.randomBytes(16),record={v:1,created:existing?.created??new Date(now()).toISOString(),salt:salt.toString('hex'),hash:(await hashPassword(password,salt)).toString('hex'),tokens:{},termsAccepted:termsVersion,termsAcceptedAt:new Date(now()).toISOString()};
   unchanged(id,existing);
   if(!existing&&ids().length>=limit)throw fail(429,'This game has all the accounts it can hold. Ask the host.');
   if(requireVerification)return challenge(email,existing,record);
   record.verifiedAt=new Date(now()).toISOString();return sessionResult(id,record,email);
  },
  async login(email,password,client='this-pc',termsVersion=null){
   email=normalEmail(email);const id=accountId(email);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes and try again.');
   const record=validEmail(email)?read(id):null;
   // An unknown address takes as long to refuse as a wrong password, and is refused in the same words.
   const right=record&&!record.reset&&typeof password==='string'&&password.length<=200?await matches(record,password):(await hashPassword(String(password??'').slice(0,200)||'x',Buffer.alloc(16)),false);
   if(!right){missed(id,client);throw fail(401,record?.reset?'This account\'s password was reset by the host. Use Recover account with the private recovery code from the host.':'That email and password do not match.');}
   unchanged(id,record);
   failures.delete('a:'+id);
   if(termsVersion){record.termsAccepted=termsVersion;record.termsAcceptedAt=new Date(now()).toISOString();write(id,record);}
   if(requireVerification&&!record.verifiedAt)return challenge(email,record);
   return sessionResult(id,record,email);
  },
  async verify(email,ticket,code,client='this-pc'){
   email=normalEmail(email);const id=accountId(email),p=readPending(id);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes.');
   if(!p||p.expires<=now()||p.attempts>=5||typeof ticket!=='string'||!crypto.timingSafeEqual(Buffer.from(p.ticket,'hex'),Buffer.from(digest(ticket),'hex')))throw fail(401,'Verification expired. Sign in or create the account again to request a new code.');
   p.attempts++;fs.writeFileSync(pendingFile(id),JSON.stringify(p));
   if(typeof code!=='string'||!/^[0-9]{8}$/.test(code)||!crypto.timingSafeEqual(Buffer.from(p.code,'hex'),Buffer.from(digest(code),'hex'))){missed(id,client);audit('verification-denied',{account:id});throw fail(400,'That verification code is not correct.');}
   const current=read(id);if(digest(JSON.stringify(current))!==p.version)throw fail(409,'Your account changed. Request a fresh verification code.');
   if(!current&&ids().length>=limit)throw fail(429,'Account storage is full. Ask the host.');
   const record=p.candidate??current;if(!record)throw fail(401,'Request a new verification code.');
   for(const key of Object.keys(current?.tokens??{}))owners.delete(key);
   record.tokens={};record.verifiedAt=new Date(now()).toISOString();
   const result=sessionResult(id,record,email);fs.rmSync(pendingFile(id),{force:true});audit('email-verified',{account:id});return result;
  },
  async save(token,snapshot){
   const {id}=member(token);if(!validSnapshot(snapshot))throw fail(400,'That adventure could not be saved.');
   fs.mkdirSync(dir,{recursive:true});const at=new Date(now()).toISOString(),tmp=saveFile(id)+'.tmp';backup?.put('account-'+id,{savedAt:at,snapshot});fs.writeFileSync(tmp,JSON.stringify({savedAt:at,snapshot}));fs.renameSync(tmp,saveFile(id));
   return {saved:true,savedAt:at};
  },
  async load(token){
   const {id}=member(token);
   try{return JSON.parse(fs.readFileSync(saveFile(id),'utf8'));}catch{throw fail(404,'Your account has no saved adventure yet.');}
  },
  async status(token){const {id,guest}=signedIn(token);return guest?{signedIn:false,guest:true,id,verified:false,savedAt:null}:{signedIn:true,id,verified:true,savedAt:savedAt(id)};},
  identity(token){const {id,record,guest,renewed}=signedIn(token);return guest?{id,verified:false,guest:true,...(renewed?{renewed:true}:{})}:{id,verified:!!record.verifiedAt};},
  // A browser without a session is given an anonymous guest identity (only while guests are allowed).
  async guest(){
   if(!allowGuests)throw fail(403,'Sign in with your account to play.');
   pruneGuests();if(guestIds().length>=guestLimit)pruneGuests(true);
   if(guestIds().length>=guestLimit)throw fail(429,'This game has all the guests it can hold. Ask the host.');
   const id=crypto.randomBytes(32).toString('hex'),token=crypto.randomBytes(32).toString('hex'),key=digest(token);
   write(id,{v:1,guest:true,created:new Date(now()).toISOString(),tokens:{[key]:now()+guestDays*86400000},seen:{[key]:now()}});owners.set(key,id);
   audit('guest-created',{account:id});return {token,id,guest:true};
  },
  pruneGuests:(force=true)=>pruneGuests(force),
  guestCount:()=>guestIds().length,
  async logoutAll(token){const {id,record}=member(token);for(const key of Object.keys(record.tokens??{}))owners.delete(key);record.tokens={};record.seen={};write(id,record);audit('sessions-revoked',{account:id});return {signedOut:true};},
  async logout(token){
   try{const {id,record,key,guest}=signedIn(token);if(guest)return {signedOut:true};delete record.tokens[key];write(id,record);owners.delete(key);}catch{}
   return {signedOut:true};
  },
  // A new password signs every other device out.
  async changePassword(token,current,next,client='this-pc'){
   const {id,record,key}=member(token);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes and try again.');
   if(typeof current!=='string'||current.length>200||!await matches(record,current)){missed(id,client);throw fail(401,'Your current password is not right.');}
   if(!validPassword(next))throw fail(400,'Choose a new password of at least 8 characters.');
   if(weakPassword(next))throw fail(400,'That password is one guessers try first. Choose one that is harder to guess.');
   const salt=crypto.randomBytes(16),hash=(await hashPassword(next,salt)).toString('hex');unchanged(id,record);
   for(const other of Object.keys(record.tokens))if(other!==key)owners.delete(other);
   write(id,{...record,salt:salt.toString('hex'),hash,tokens:{[key]:record.tokens[key]}});
   return {changed:true};
  },
  // Deleting an account removes its password, its sign-ins and its saved adventure from the host's PC.
  async remove(token,password,client='this-pc'){
   const {id,record}=member(token);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes and try again.');
   if(typeof password!=='string'||password.length>200||!await matches(record,password)){missed(id,client);throw fail(401,'That password is not right. Nothing was deleted.');}
   unchanged(id,record);
   for(const key of Object.keys(record.tokens??{}))owners.delete(key);
   fs.rmSync(file(id),{force:true});fs.rmSync(saveFile(id),{force:true});fs.rmSync(pendingFile(id),{force:true});backup?.remove('account-'+id);
   return {removed:true};
  },
  // For the host: how many accounts there are, resetting a forgotten password (the saved adventure is kept and the
  // player uses a private, expiring recovery code after the host verifies ownership), and removing an account outright.
  count:()=>ids().length,
  // Every account and guest id (for the host's ban command, which finds an id by its label).
  knownIds:()=>[...ids(),...guestIds()],
  resetPassword(email){const id=accountId(normalEmail(email)),record=read(id);if(!record)return false;const code=crypto.randomBytes(24).toString('hex');for(const key of Object.keys(record.tokens??{}))owners.delete(key);write(id,{v:1,created:record.created,reset:true,resetHash:digest(code),resetUntil:now()+3600000,tokens:{}});return code;},
  removeByEmail(email){const id=accountId(normalEmail(email)),record=read(id);if(!record)return false;for(const key of Object.keys(record.tokens??{}))owners.delete(key);fs.rmSync(file(id),{force:true});fs.rmSync(saveFile(id),{force:true});fs.rmSync(pendingFile(id),{force:true});backup?.remove('account-'+id);return true;},
 };
 const api={...actions};
 for(const name of ['register','login','verify','resetPassword','removeByEmail'])api[name]=(...args)=>ordered(accountId(normalEmail(args[0])),()=>actions[name](...args));
 for(const name of ['save','load','status','logout','logoutAll','changePassword','remove'])api[name]=(...args)=>ordered(owners.get(digest(args[0]))??'unknown-token',()=>actions[name](...args));
 return api;
}
// Host commands (run on the PC that hosts the game; the table service must be restarted to notice a reset at once):
//   node accounts.cjs count
//   node accounts.cjs reset-password someone@example.com     verify the owner, then privately give them the one-use recovery code
//   node accounts.cjs remove someone@example.com             deletes the account and its saved adventure
//   node accounts.cjs ban <who> [note]                     keeps a player out of the whole game (bans.cjs): the Dungeon
//   node accounts.cjs unban <who>                          Master, every shared table and feedback. <who> is the mod-…
//   node accounts.cjs bans                                 label a report or the security log gives, or a guest or
//                                                          account id (account-<id>, qb-acct-…, or 12+ hex characters).
// Bans are read by the running account service whenever the file changes: no restart is needed.
function findIdentity(who,known){
 const {moderationLabel}=require('./bans.cjs'),w=String(who??'').trim().toLowerCase();
 if(/^mod-[a-f0-9]{20}$/.test(w))return known.filter(id=>moderationLabel(id)===w);
 const hex=w.replace(/^(?:account-|qb-acct-)/,'');
 if(/^[a-f0-9]{12,64}$/.test(hex)){const found=known.filter(id=>id.startsWith(hex));return found.length||hex.length!==64?found:[hex];}
 return [];
}
if(require.main===module){(async()=>{
 const [command,email]=process.argv.slice(2),accounts=createAccounts();
 if(['ban','unban','bans'].includes(command)){
  const {createBans}=require('./bans.cjs'),bans=createBans(),{createOperations}=require('./operations.cjs');
  const audit=(event,label)=>{try{createOperations().audit(event,{account:label});}catch{}};
  if(command==='bans'){const list=bans.list();console.log(list.length?list.map(b=>b.label+'  since '+b.at+(b.note?'  '+b.note:'')).join('\n'):'Nobody is banned.');return;}
  if(!email){console.log('Usage: node accounts.cjs '+command+' <mod-label | guest or account id>');return;}
  if(command==='unban'){const found=findIdentity(email,accounts.knownIds());const label=(found.length===1?bans.unban(found[0]):null)??bans.unban(String(email).trim().toLowerCase());if(label)audit('host-unban',label);console.log(label?'Unbanned '+label+'.':'No ban matches that.');return;}
  const found=findIdentity(email,accounts.knownIds());
  if(found.length!==1){console.log(found.length?'That matches more than one player; give more of the id.':'No guest or account matches that. Copy the mod-… label from the report or the security log.');process.exitCode=1;return;}
  const label=bans.ban(found[0],{note:process.argv.slice(4).join(' ')});audit('host-ban',label);
  console.log('Banned '+label+': the Dungeon Master, shared tables and feedback now refuse that browser. Undo with: node accounts.cjs unban '+label);
  return;
 }
 if(command==='count')console.log(accounts.count()+' account'+(accounts.count()===1?'':'s')+'.');
 else if(command==='reset-password'&&email){const code=await accounts.resetPassword(email);console.log(code?'Private recovery code (one use, expires in one hour): '+code+'\nGive it only to the verified account owner. They choose Recover account in Settings. Their saved adventure is kept.':'No account uses that email.');}
 else if(command==='remove'&&email)console.log(await accounts.removeByEmail(email)?'Account and saved adventure removed.':'No account uses that email.');
 else console.log('Usage: node accounts.cjs count | reset-password <email> | remove <email> | ban <who> [note] | unban <who> | bans');
})().catch(()=>{console.error('The account command could not be completed.');process.exitCode=1;});}
module.exports={createAccounts,normalEmail,validEmail,validPassword,weakPassword,findIdentity};
