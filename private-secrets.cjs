// Secrets stay on the server. On Windows the file is bound to the service user's account.
const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
function secretKey(file){
 if(process.platform==='win32'){
  const script="$ErrorActionPreference='Stop'; $p=$env:QB_SECRET_PATH; if(!(Test-Path -LiteralPath $p)){ $b=New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $s=ConvertTo-SecureString ([Convert]::ToBase64String($b)) -AsPlainText -Force; $s | ConvertFrom-SecureString | Set-Content -LiteralPath $p }; $s=ConvertTo-SecureString ((Get-Content -Raw -LiteralPath $p).Trim()); $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try{[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}";
  return Buffer.from(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,QB_SECRET_PATH:file},windowsHide:true,timeout:15000,stdio:['ignore','pipe','pipe']}).toString().trim(),'base64');
 }
 try{fs.writeFileSync(file,crypto.randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
 const key=fs.readFileSync(file);if(key.length!==32)throw Error('Invalid private storage key.');return key;
}
function seal(key,value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(JSON.stringify(value),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');}
function unseal(key,value){const bytes=Buffer.from(value,'base64');if(bytes.length<29)throw Error('Invalid encrypted record.');const decipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(-16));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString('utf8'));}
module.exports={secretKey,seal,unseal};
