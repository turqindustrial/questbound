// Alerts for the host: spending that passes half or most of the guests' daily allowance, a spending ceiling reached,
// or one network address refused again and again (someone hammering the game). Each alert is written to the security
// log (operations.cjs auditTo: the kind only, never who or from where) and, when the host has connected Discord
// (Connect-Discord.cmd: the webhook is DPAPI-encrypted in .questbound-discord.dpapi), posted to that channel as one
// short line, with mentions disabled. A kind is raised at most once an hour (or once a day for the daily thresholds),
// remembered in .questbound-alerts.json so a restart or a reload does not repeat it.
// The webhook can only be unlocked by the same Windows user, so a short PowerShell child reads the file, decrypts it
// and posts; the message reaches it on stdin and the webhook never appears on a command line, in an environment
// variable or in a log. The child is given a trimmed environment (no API key or token reaches it).
// The running Dungeon Master loads this with spending.cjs (it stays loaded with it); the share gateway loads it once.
const revision=1;
const fs=require('node:fs'),path=require('node:path');
const hour=3600000;
const discordScript=`$ErrorActionPreference = 'Stop'
$file = $env:QB_DISCORD_FILE
$text = [Console]::In.ReadToEnd()
if (-not $text.Trim()) { exit 3 }
$sec = (Get-Content -LiteralPath $file -Raw).Trim() | ConvertTo-SecureString
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $hook = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
if ($hook -notmatch '^https://(ptb\\.|canary\\.)?(discord|discordapp)\\.com/api/webhooks/\\d+/[A-Za-z0-9_-]+$') { exit 2 }
$body = @{ content = $text.Trim(); allowed_mentions = @{ parse = @() } } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri $hook -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 15 | Out-Null
exit 0`;
// Only what PowerShell needs to find the user's profile (DPAPI) and the network; never the API key or a token.
const childEnv=extra=>{const keep={};for(const [k,v] of Object.entries(process.env))if(/^(SystemRoot|SystemDrive|windir|PATH|PATHEXT|TEMP|TMP|USERPROFILE|USERNAME|USERDOMAIN|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|ComSpec|PSModulePath|ProgramData|ProgramFiles|ProgramFiles\(x86\)|ProgramW6432|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE|OS)$/i.test(k))keep[k]=v;return {...keep,...extra};};
// Posts one line to the host's Discord channel; resolves to the child's exit code (0 posted, 2 not a Discord webhook,
// 3 nothing to say) or null when it could not run. Never throws.
function postToDiscord(text,{file,spawn=require('node:child_process').spawn,timeout=30000,detach=true}={}){
 return new Promise(resolve=>{
  if(process.platform!=='win32'||!file||!fs.existsSync(file))return resolve(null);
  let child;
  try{child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(discordScript,'utf16le').toString('base64')],{stdio:['pipe','ignore','ignore'],windowsHide:true,env:childEnv({QB_DISCORD_FILE:file})});}
  catch{return resolve(null);}
  const timer=setTimeout(()=>{try{child.kill();}catch{}},timeout);if(detach)timer.unref?.();
  child.on('error',()=>{clearTimeout(timer);resolve(null);});
  child.on('exit',code=>{clearTimeout(timer);resolve(code);});
  child.stdin.on('error',()=>{});child.stdin.end(String(text).replace(/@/g,'@​').slice(0,400));
  if(detach)child.unref?.();
 });
}
function createAlerts({dir=process.env.QUESTBOUND_DATA||__dirname,now=Date.now,post=null,audit=null}={}){
 const stateFile=path.join(dir,'.questbound-alerts.json'),discordFile=path.join(dir,'.questbound-discord.dpapi');
 const read=()=>{try{const s=JSON.parse(fs.readFileSync(stateFile,'utf8'));return s&&typeof s==='object'&&!Array.isArray(s)?s:{};}catch{return {};}};
 const record=audit??((event,details)=>require('./operations.cjs').auditTo(dir,event,details,now));
 const send=post??(text=>postToDiscord(text,{file:discordFile}));
 // Raises `kind` unless it (or `key`, when given) was raised within `every` milliseconds. Returns true when raised.
 function raise(kind,text,{key=kind,every=hour,event='spending-alert'}={}){
  const t=now(),state=read();
  if(Number.isFinite(state[key])&&t-state[key]<Math.max(hour,every))return false;
  state[key]=t;for(const [k,v] of Object.entries(state))if(!Number.isFinite(v)||t-v>3*86400000)delete state[k];
  try{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(stateFile,JSON.stringify(state));}catch{}
  try{record(event,{route:kind});}catch{}
  // Discord only when the host connected it; otherwise the security log is the record.
  if(fs.existsSync(discordFile))try{Promise.resolve(send('Questbound: '+text)).catch(()=>{});}catch{}
  return true;
 }
 return {raise,discordConnected:()=>fs.existsSync(discordFile)};
}
module.exports={revision,createAlerts,postToDiscord,discordScript,childEnv};
