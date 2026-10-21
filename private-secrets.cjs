// Secrets stay on the server. On Windows the file is bound to the service user's account.
const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
// The PowerShell that reads (or first makes) the DPAPI-protected key; its output is the key in base64.
const dpapiScript="$ErrorActionPreference='Stop'; $p=$env:QB_SECRET_PATH; if(!(Test-Path -LiteralPath $p)){ $b=New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $s=ConvertTo-SecureString ([Convert]::ToBase64String($b)) -AsPlainText -Force; $s | ConvertFrom-SecureString | Set-Content -LiteralPath $p }; $s=ConvertTo-SecureString ((Get-Content -Raw -LiteralPath $p).Trim()); $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try{[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}";
const dpapiRun=file=>[['-NoProfile','-NonInteractive','-Command',dpapiScript],{env:{...process.env,QB_SECRET_PATH:file},windowsHide:true,stdio:['ignore','pipe','pipe']}];
function secretKey(file){
 if(process.platform==='win32'){
  // A busy PC can take many seconds just to start PowerShell (2026-10-21: over 15 s, so the first table after a restart
  // failed): wait up to a minute here, and see secretKeyAsync, which the services start at once in the background.
  const [args,options]=dpapiRun(file);return Buffer.from(execFileSync('powershell.exe',args,{...options,timeout:60000}).toString().trim(),'base64');
 }
 try{fs.writeFileSync(file,crypto.randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
 const key=fs.readFileSync(file);if(key.length!==32)throw Error('Invalid private storage key.');return key;
}
function seal(key,value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(JSON.stringify(value),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');}
function unseal(key,value){const bytes=Buffer.from(value,'base64');if(bytes.length<29)throw Error('Invalid encrypted record.');const decipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(-16));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString('utf8'));}
// The same key without blocking: started when a service starts, so the first request that needs it finds it ready.
function secretKeyAsync(file){
 if(process.platform!=='win32')return Promise.resolve().then(()=>secretKey(file));
 const [args,options]=dpapiRun(file);
 return new Promise((resolve,reject)=>require('node:child_process').execFile('powershell.exe',args,{...options,timeout:180000},(error,stdout)=>{if(error)return reject(error);const key=Buffer.from(String(stdout).trim(),'base64');if(key.length!==32)return reject(Error('Invalid private storage key.'));resolve(key);}));
}
module.exports={secretKey,secretKeyAsync,seal,unseal};
