// Game-wide bans, set by the host of the whole game (whoever runs it on their PC), and the pseudonymous label by which
// the host names a player without seeing their account or guest id.
//
// moderationLabel(id) is 'mod-' and 20 hex characters of a keyed hash of a guest or account id: reports from a shared
// table (feedback-report.cjs) and the content check's entries in the security log (moderation.cjs) name players by it,
// and `node accounts.cjs ban mod-…` turns it back into the identity it stands for (by hashing the known ids).
//
// The bans are kept in banned.json beside the accounts (.questbound-accounts/, git-ignored) as hashes of the banned
// ids, each with its label, when it was set and the host's note. The account service reads the file whenever it
// changes, so `node accounts.cjs ban` takes effect without a restart: a banned identity is refused the Dungeon Master
// (the gateway's /usage check), every campaign route and feedback.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const moderationLabel=id=>'mod-'+sha('questbound-mod-v1:'+String(id)).slice(0,20);
const banHash=id=>sha('questbound-ban-v1:'+String(id));
function createBans({dir=path.join(__dirname,'.questbound-accounts'),now=Date.now}={}){
 const file=path.join(dir,'banned.json');
 let cache={stamp:null,bans:{}};
 // Re-read only when the file changed; an unreadable file keeps the bans last read (never quietly lifts them).
 const current=()=>{
  let stat=null;try{stat=fs.statSync(file);}catch{}
  const stamp=stat?stat.mtimeMs+':'+stat.size:'none';if(stamp===cache.stamp)return cache.bans;
  if(!stat){cache={stamp,bans:{}};return cache.bans;}
  try{const record=JSON.parse(fs.readFileSync(file,'utf8'));if(record?.v===1&&record.bans&&typeof record.bans==='object')cache={stamp,bans:record.bans};}catch{}
  return cache.bans;
 };
 const write=bans=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify({v:1,bans},null,1),{mode:0o600});fs.renameSync(file+'.tmp',file);cache.stamp=null;};
 return {
  has:id=>typeof id==='string'&&Object.hasOwn(current(),banHash(id)),
  ban(id,{note=''}={}){const bans={...current()},label=moderationLabel(id);bans[banHash(id)]={label,at:new Date(now()).toISOString(),note:String(note).replace(/[\x00-\x1f]/g,' ').slice(0,200)};write(bans);return label;},
  // By id, or by the label a ban was recorded under (the id may be gone by then).
  unban(who){const bans={...current()};const key=Object.hasOwn(bans,banHash(who))?banHash(who):Object.keys(bans).find(k=>bans[k].label===who);if(!key)return null;const {label}=bans[key];delete bans[key];write(bans);return label;},
  list:()=>Object.values(current()).map(b=>({label:b.label,at:b.at,note:b.note??''})),
 };
}
module.exports={createBans,moderationLabel,banHash};
