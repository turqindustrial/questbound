import React,{useState,useEffect} from 'react';
import {View,Text} from 'react-native';
import {GameButton,Section} from './ui';
import {accountState,accountsOffered} from './accountRules';
import {campaignCall} from './campaignClient';
import {currentProfile} from './playerStorage';
import {currentMode,setMode} from './theme';
import {colors,fonts} from './theme';
export default function DeveloperDiagnostics(){
 const [open,setOpen]=useState(false),[result,setResult]=useState(''),[busy,setBusy]=useState(false);
 const [alerts,setAlerts]=useState(0);
 useEffect(()=>{if(!['localhost','127.0.0.1','[::1]'].includes(globalThis.location?.hostname)||currentProfile()==='guest'||!accountsOffered())return;let active=true;
  const check=()=>campaignCall('ops-status').then(data=>{if(active)setAlerts(data.alerts.filter(e=>Date.now()-Date.parse(e.at)<600000).length);}).catch(()=>{});
  check();const timer=setInterval(check,60000);return()=>{active=false;clearInterval(timer);};
 },[]);
 const run=async fn=>{setBusy(true);try{setResult(await fn());}catch(e){setResult(e.message);}finally{setBusy(false);}};
 return <View style={{gap:8,marginTop:14}}>
  {alerts>=5&&<Text accessibilityRole="alert" style={{fontFamily:fonts.ui,color:colors.danger}}>Security notice: {alerts} requests were blocked recently. Open developer checks to review them.</Text>}
  <GameButton icon="cog" label={open?'Close developer checks':'Developer checks'} onPress={()=>setOpen(v=>!v)}/>
  {open&&<>
   <Section title="Checks for this release"/>
   <GameButton label="Preview light / dark" onPress={()=>{setMode(currentMode()==='dark'?'light':'dark');setResult('Appearance changed. Check text, fields, dialogs and the game feed.');}}/>
   {/* Account and host checks need a verified account, so they appear only while accounts are offered (accountRules.js). */}
   {accountsOffered()&&<GameButton label="Check account and local save owner" disabled={busy} onPress={()=>run(async()=>{const a=await accountState();const status=await campaignCall('account-status');return a?.id===currentProfile()&&status.id===a.id?'Verified session and local save owner match. No account token is readable by this page.':'Account mismatch: sign out and sign in again before playing.';})}/>}
   <GameButton label="Check campaign memberships" disabled={busy} onPress={()=>run(async()=>{const data=await campaignCall('campaign-list');return data.campaigns.length+' campaign(s) available to this '+(accountsOffered()?'account. Test a second account':'browser. Test a second browser')+', then try its invite.';})}/>
   {accountsOffered()&&<><GameButton label="Read host security alerts" disabled={busy} onPress={()=>run(async()=>{const data=await campaignCall('ops-status');return 'Email: '+(data.mailConfigured?'configured':'not connected')+'\nToday: '+JSON.stringify(data.usage)+'\nRecent alerts: '+(data.alerts.map(a=>a.at+' · '+a.event+' · '+(a.route??'')).join('\n')||'none');})}/>
   <GameButton label="Verify encrypted backups" disabled={busy} onPress={()=>run(async()=>{const data=await campaignCall('ops-verify-backups');return data.checked+' latest backup(s) decrypted and checked. Active saves were not replaced.';})}/></>}
   <Text style={{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20}}>{accountsOffered()?'Test next: expired and wrong email codes; sign out all devices; switch between two accounts; two players sending at once; refresh after a completed attack; all six palettes on a phone. Host checks require a verified account on the desktop. This menu does not grant server permissions.':'Test next: two players sending at once; refresh after a completed attack; all six palettes on a phone. This menu does not grant server permissions.'}</Text>
   {!!result&&<Text selectable accessibilityLiveRegion="polite" style={{fontFamily:fonts.ui,color:colors.text,fontSize:13,lineHeight:20}}>{result}</Text>}
  </>}
 </View>;
}
