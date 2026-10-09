// Fixed Gmail TLS destination; no player-controlled mail headers, URLs, or SMTP hosts.
const fs=require('node:fs'),path=require('node:path'),tls=require('node:tls'),{execFile}=require('node:child_process');
const fail=()=>Object.assign(Error('Verification mail is unavailable. Ask the host to finish connecting the game email.'),{status:503});
function createMailer({dir=process.env.QUESTBOUND_DATA||__dirname,transport=null}={}){
 const config=()=>{let saved={};try{saved=JSON.parse(fs.readFileSync(path.join(dir,'.questbound-mail.json'),'utf8').replace(/^\uFEFF/,''));}catch{}return {...saved,...(process.env.QUESTBOUND_MAIL_SENDER?{sender:process.env.QUESTBOUND_MAIL_SENDER.trim(),feedback:true}:{})};};
 const configured=()=>!!transport||(/^[a-z0-9._%+-]+@gmail\.com$/i.test(config().sender??'')&&(!!process.env.QUESTBOUND_MAIL_PASSWORD||fs.existsSync(path.join(dir,'.questbound-mail.dpapi'))));
 async function password(){
  if(process.env.QUESTBOUND_MAIL_PASSWORD)return process.env.QUESTBOUND_MAIL_PASSWORD;
  if(process.platform!=='win32')throw fail();
  return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';$s=ConvertTo-SecureString ((Get-Content -Raw -LiteralPath $env:QB_MAIL_FILE).Trim());$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}"],{windowsHide:true,timeout:10000,env:{...process.env,QB_MAIL_FILE:path.join(dir,'.questbound-mail.dpapi')}},(e,out)=>e?reject(fail()):resolve(out.trim())));
 }
 async function send(to,subject,text){
  if(!configured())throw fail();
  if(!/^[^\s<>\r\n@]{1,64}@[^\s<>\r\n@]{1,189}$/.test(to)||/[\r\n]/.test(subject))throw fail();
  if(transport)return transport({to,subject,text});
  const sender=config().sender,secret=(await password()).replace(/\s/g,'');
  await new Promise((resolve,reject)=>{
   const socket=tls.connect({host:'smtp.gmail.com',port:465,servername:'smtp.gmail.com',minVersion:'TLSv1.2',rejectUnauthorized:true});
   let buffer='',step=0,done=false;
   const commands=[['EHLO questbound.local',250],['AUTH PLAIN '+Buffer.from('\0'+sender+'\0'+secret).toString('base64'),235],['MAIL FROM:<'+sender+'>',250],['RCPT TO:<'+to+'>',250],['DATA',354],['From: Questbound <'+sender+'>\r\nTo: <'+to+'>\r\nSubject: '+subject+'\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+Buffer.from(text).toString('base64').match(/.{1,76}/g).join('\r\n')+'\r\n.',250]];
   const finish=e=>{if(done)return;done=true;clearTimeout(deadline);socket.destroy();e?reject(fail()):resolve();};
   const deadline=setTimeout(()=>finish(Error('deadline')),30000);
   socket.setTimeout(15000,()=>finish(Error('timeout')));socket.on('error',finish);socket.on('end',()=>{if(!done)finish(Error('closed'));});
   socket.on('data',chunk=>{buffer+=chunk.toString();if(buffer.length>16384)return finish(Error('response too large'));let i;while((i=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+2);if(!/^\d{3} /.test(line))continue;const expected=step===0?220:commands[step-1][1];if(Number(line.slice(0,3))!==expected)return finish(Error('mail refused'));if(step===commands.length){socket.write('QUIT\r\n');return finish();}socket.write(commands[step++][0]+'\r\n');}});
  });
 }
 return {configured,verification:(email,code)=>send(email,'Verify your Questbound email','Your Questbound verification code is: '+code+'\n\nEnter this code in the game. It expires in 10 minutes and can be used once. If you did not request it, ignore this email. Do not share the code.'),feedback:async text=>{const c=config();if(c.feedback===true)return send(c.sender,'Questbound player feedback',String(text).slice(0,6000));}};
}
module.exports={createMailer};
