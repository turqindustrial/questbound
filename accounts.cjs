// Player accounts: an email and a password that keep a player's hero and adventure on the host's PC, so signing in on
// another phone or browser (or after this one loses its data) brings them back.
//
// What is kept, in .questbound-accounts/ (git-ignored):
//   <id>.json       the password as a salted scrypt hash, and hashes of the sign-in tokens handed to that player's devices
//   <id>.save.json  their latest hero and adventure
// <id> is a hash of the email address: the address itself is never written down, so the folder holds no list of who
// plays. There is no email service, so nothing is ever sent to the address and it is not verified: it is a name to
// sign in with. A forgotten password is reset by the host (see the commands at the end of this file).
// Wrong passwords are counted per account, per caller and overall, and further tries are refused for a while.
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
function createAccounts({dir=path.join(__dirname,'.questbound-accounts'),limit=500,tokenDays=180,tokensEach=8,now=Date.now,validSnapshot=()=>true}={}){
 const file=id=>path.join(dir,id+'.json'),saveFile=id=>path.join(dir,id+'.save.json');
 const read=id=>{try{const record=JSON.parse(fs.readFileSync(file(id),'utf8'));return record&&record.v===1?record:null;}catch{return null;}};
 const write=(id,record)=>{fs.mkdirSync(dir,{recursive:true});const tmp=file(id)+'.tmp';fs.writeFileSync(tmp,JSON.stringify(record));fs.renameSync(tmp,file(id));};
 const ids=()=>{try{return fs.readdirSync(dir).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).map(f=>f.slice(0,64));}catch{return [];}};
 // Which account a sign-in token belongs to (kept in memory, rebuilt from the records at start).
 const owners=new Map();
 for(const id of ids()){const record=read(id);for(const [key,until] of Object.entries(record?.tokens??{}))if(until>now())owners.set(key,id);}
 const failures=new Map(),overall=[];
 const recent=(key,span)=>{const list=(failures.get(key)??[]).filter(t=>t>now()-span);failures.set(key,list);return list;};
 const blocked=(id,client)=>recent('a:'+id,900000).length>=5||recent('c:'+client,900000).length>=12||overall.filter(t=>t>now()-3600000).length>=200;
 const missed=(id,client)=>{recent('a:'+id,900000).push(now());recent('c:'+client,900000).push(now());overall.push(now());if(overall.length>400)overall.splice(0,overall.length-400);};
 const issue=(id,record)=>{
  const token=crypto.randomBytes(32).toString('hex'),tokens=Object.fromEntries(Object.entries(record.tokens??{}).filter(([,until])=>until>now()).sort((a,b)=>b[1]-a[1]).slice(0,tokensEach-1));
  for(const key of Object.keys(record.tokens??{}))if(!(key in tokens))owners.delete(key);
  tokens[digest(token)]=now()+tokenDays*86400000;record.tokens=tokens;write(id,record);owners.set(digest(token),id);return token;
 };
 const savedAt=id=>{try{return JSON.parse(fs.readFileSync(saveFile(id),'utf8')).savedAt??null;}catch{return null;}};
 const matches=async(record,password)=>{const key=await hashPassword(String(password),Buffer.from(record.salt,'hex')),stored=Buffer.from(record.hash,'hex');return key.length===stored.length&&crypto.timingSafeEqual(key,stored);};
 const signedIn=token=>{
  const key=typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?digest(token):null,id=key?owners.get(key):null,record=id?read(id):null;
  if(!record||!((record.tokens?.[key]??0)>now())){if(key)owners.delete(key);throw fail(401,'You are signed out. Sign in again to keep saving to your account.');}
  return {id,record,key};
 };
 return {
  async register(email,password,client='this-pc'){
   email=normalEmail(email);
   if(!validEmail(email))throw fail(400,'Enter a full email address, like name@example.com.');
   if(!validPassword(password))throw fail(400,'Choose a password of at least 8 characters.');
   if(weakPassword(password,email))throw fail(400,'That password is one guessers try first. Choose one that is harder to guess.');
   const id=accountId(email),existing=read(id);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes and try again.');
   if(existing&&!existing.reset){missed(id,client);throw fail(409,'There is already an account with that email. Sign in instead.');}
   if(!existing&&ids().length>=limit)throw fail(429,'This game has all the accounts it can hold. Ask the host.');
   const salt=crypto.randomBytes(16),record={v:1,created:existing?.created??new Date(now()).toISOString(),salt:salt.toString('hex'),hash:(await hashPassword(password,salt)).toString('hex'),tokens:{}};
   return {token:issue(id,record),email,savedAt:savedAt(id)};
  },
  async login(email,password,client='this-pc'){
   email=normalEmail(email);const id=accountId(email);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes and try again.');
   const record=validEmail(email)?read(id):null;
   // An unknown address takes as long to refuse as a wrong password, and is refused in the same words.
   const right=record&&!record.reset&&typeof password==='string'&&password.length<=200?await matches(record,password):(await hashPassword(String(password??'').slice(0,200)||'x',Buffer.alloc(16)),false);
   if(!right){missed(id,client);throw fail(401,record?.reset?'This account\'s password was reset by the host. Create the account again with the same email to choose a new password; your saved adventure is kept.':'That email and password do not match.');}
   failures.delete('a:'+id);
   return {token:issue(id,record),email,savedAt:savedAt(id)};
  },
  async save(token,snapshot){
   const {id}=signedIn(token);if(!validSnapshot(snapshot))throw fail(400,'That adventure could not be saved.');
   fs.mkdirSync(dir,{recursive:true});const at=new Date(now()).toISOString(),tmp=saveFile(id)+'.tmp';fs.writeFileSync(tmp,JSON.stringify({savedAt:at,snapshot}));fs.renameSync(tmp,saveFile(id));
   return {saved:true,savedAt:at};
  },
  async load(token){
   const {id}=signedIn(token);
   try{return JSON.parse(fs.readFileSync(saveFile(id),'utf8'));}catch{throw fail(404,'Your account has no saved adventure yet.');}
  },
  async status(token){const {id}=signedIn(token);return {signedIn:true,savedAt:savedAt(id)};},
  async logout(token){
   try{const {id,record,key}=signedIn(token);delete record.tokens[key];write(id,record);owners.delete(key);}catch{}
   return {signedOut:true};
  },
  // A new password signs every other device out.
  async changePassword(token,current,next,client='this-pc'){
   const {id,record,key}=signedIn(token);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes and try again.');
   if(typeof current!=='string'||current.length>200||!await matches(record,current)){missed(id,client);throw fail(401,'Your current password is not right.');}
   if(!validPassword(next))throw fail(400,'Choose a new password of at least 8 characters.');
   if(weakPassword(next))throw fail(400,'That password is one guessers try first. Choose one that is harder to guess.');
   const salt=crypto.randomBytes(16);for(const other of Object.keys(record.tokens))if(other!==key)owners.delete(other);
   write(id,{...record,salt:salt.toString('hex'),hash:(await hashPassword(next,salt)).toString('hex'),tokens:{[key]:record.tokens[key]}});
   return {changed:true};
  },
  // Deleting an account removes its password, its sign-ins and its saved adventure from the host's PC.
  async remove(token,password,client='this-pc'){
   const {id,record}=signedIn(token);
   if(blocked(id,client))throw fail(429,'Too many tries. Wait a few minutes and try again.');
   if(typeof password!=='string'||password.length>200||!await matches(record,password)){missed(id,client);throw fail(401,'That password is not right. Nothing was deleted.');}
   for(const key of Object.keys(record.tokens??{}))owners.delete(key);
   fs.rmSync(file(id),{force:true});fs.rmSync(saveFile(id),{force:true});
   return {removed:true};
  },
  // For the host: how many accounts there are, resetting a forgotten password (the saved adventure is kept and the
  // player creates the account again with the same email), and removing an account outright.
  count:()=>ids().length,
  resetPassword(email){const id=accountId(normalEmail(email)),record=read(id);if(!record)return false;for(const key of Object.keys(record.tokens??{}))owners.delete(key);write(id,{v:1,created:record.created,reset:true,tokens:{}});return true;},
  removeByEmail(email){const id=accountId(normalEmail(email));if(!read(id))return false;fs.rmSync(file(id),{force:true});fs.rmSync(saveFile(id),{force:true});return true;},
 };
}
// Host commands (run on the PC that hosts the game; the table service must be restarted to notice a reset at once):
//   node accounts.cjs count
//   node accounts.cjs reset-password someone@example.com     the player then creates the account again, same email, new password
//   node accounts.cjs remove someone@example.com             deletes the account and its saved adventure
if(require.main===module){
 const [command,email]=process.argv.slice(2),accounts=createAccounts();
 if(command==='count')console.log(accounts.count()+' account'+(accounts.count()===1?'':'s')+'.');
 else if(command==='reset-password'&&email)console.log(accounts.resetPassword(email)?'Password reset. Ask the player to create their account again with the same email; their saved adventure is kept. Restart the game\'s services (Questbound.cmd) so signed-in devices are signed out at once.':'No account uses that email.');
 else if(command==='remove'&&email)console.log(accounts.removeByEmail(email)?'Account and saved adventure removed.':'No account uses that email.');
 else console.log('Usage: node accounts.cjs count | reset-password <email> | remove <email>');
}
module.exports={createAccounts,normalEmail,validEmail,validPassword,weakPassword};
