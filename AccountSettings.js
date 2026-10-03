import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {Section,GameButton,Segmented} from './ui';
import {accountState,registerAccount,signIn,signOut,saveToAccount,loadFromAccount,releaseHold,changePassword,deleteAccount} from './accountRules';
import {fonts,colors,tint} from './theme';
// Settings → Your account: an email and a password that keep the player's hero and adventure on the host's PC.
// Signed out: create an account or sign in. Signed in: when it last saved, loading the saved adventure onto this
// device, signing out, and (under Manage) a new password or deleting the account.
const when=iso=>iso?new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):null;
// The home Wi-Fi link is plain http (the shared link and this PC's own page are not at risk): say so where a password is typed.
export const unencryptedLink=(location=globalThis.location)=>!!location&&location.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname);
export function AccountSettings({onRestore,busy,onChange,onLegal}){
 const [account,setAccount]=useState(undefined),[mode,setMode]=useState('create'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[shown,setShown]=useState(false);
 const [message,setMessage]=useState(''),[working,setWorking]=useState(false),[manage,setManage]=useState(false),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState('');
 const refresh=()=>accountState().then(a=>{setAccount(a);onChange?.(a);return a;}).catch(()=>setAccount(null));
 useEffect(()=>{let live=true;const load=()=>accountState().then(a=>{if(live)setAccount(a);}).catch(()=>{});load();const timer=setInterval(load,10000);return()=>{live=false;clearInterval(timer);};},[]);
 // One thing at a time, with whatever went wrong said plainly.
 const run=async(task,done)=>{if(working)return;setWorking(true);setMessage('');try{await task();if(done)setMessage(done);}catch(e){setMessage(e.message||'That did not work. Try again.');}finally{await refresh();setWorking(false);}};
 const enter=()=>run(async()=>{
  const a=mode==='create'?await registerAccount(email,password):await signIn(email,password);
  setPassword('');setShown(false);
  if(!a.hold){const saved=await saveToAccount().catch(()=>null);setMessage(mode==='create'?(saved?'Account created. Your adventure is saved to it, and will be after every turn.':'Account created. Your adventure will be saved to it as you play.'):'Signed in. Your adventure will be saved to your account as you play.');}
 });
 const loadSaved=()=>run(async()=>{const saved=await loadFromAccount();await onRestore(saved.snapshot);await releaseHold();},'Your saved adventure is loaded on this device. Whoever you were playing here waits under Heroes.');
 const keepThis=()=>run(async()=>{await releaseHold();await saveToAccount();},'Kept. This device\'s adventure is now the one saved to your account.');
 if(account===undefined)return null;
 const field=[st.input,{flexGrow:1}];
 return <View dataSet={{qb:'plate'}} style={st.panel}>
  <Section icon="key" title="Your account" style={{marginTop:0}}/>
  {!account?<>
   <Text style={st.body}>Keep your hero and adventure safe. With an account they are saved on the host's PC after every turn, and signing in on any phone or browser brings them back, even if this one loses its data.</Text>
   <Segmented options={[['create','Create account','quill'],['signin','Sign in','key']]} value={mode} onChange={id=>{setMode(id);setMessage('');}} style={{marginBottom:10}}/>
   <Text style={st.label}>Email</Text>
   <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" inputMode="email" maxLength={254} placeholder="name@example.com" placeholderTextColor={tint('#938890')} accessibilityLabel="Email" style={st.input}/>
   <Text style={st.label}>Password</Text>
   <View style={st.row}>
    <TextInput value={password} onChangeText={setPassword} secureTextEntry={!shown} autoCapitalize="none" autoCorrect={false} autoComplete={mode==='create'?'new-password':'current-password'} maxLength={200} placeholder={mode==='create'?'At least 8 characters':'Your password'} placeholderTextColor={tint('#938890')} accessibilityLabel="Password" onSubmitEditing={enter} style={field}/>
    <Pressable accessibilityRole="button" accessibilityLabel={shown?'Hide password':'Show password'} onPress={()=>setShown(v=>!v)} dataSet={{qb:'chip'}} style={st.show}><Text style={st.showText}>{shown?'Hide':'Show'}</Text></Pressable>
   </View>
   {unencryptedLink()&&<Text style={[st.note,{color:colors.muted,marginTop:0,marginBottom:8}]}>This home Wi-Fi link is not encrypted, so someone else on this Wi-Fi could in principle read what is sent. Use a password you use nowhere else.</Text>}
   <GameButton variant="primary" icon={mode==='create'?'quill':'key'} label={working?'One moment…':mode==='create'?'Create account':'Sign in'} disabled={busy||working} onPress={enter}/>
   {mode==='create'&&!!onLegal&&<Text style={st.note}>By creating an account you accept the <Text accessibilityRole="link" onPress={()=>onLegal('terms')} style={st.link}>terms of use</Text> and the <Text accessibilityRole="link" onPress={()=>onLegal('privacy')} style={st.link}>privacy policy</Text>.</Text>}
   <Text style={st.note}>{mode==='create'?'Your email is only a name to sign in with: nothing is sent to it, and the host\'s PC keeps a scrambled form of it and of your password, never either one itself. Use a password you do not use anywhere else. If you forget it, ask the host to reset it.':'Forgotten your password? Ask the host to reset it; your saved adventure is kept.'}</Text>
  </>:<>
   <View dataSet={{qb:'plate'}} style={st.who}><Text selectable numberOfLines={1} style={st.email}>{account.email}</Text><Text style={st.saved}>{account.hold?'Waiting for your choice':account.savedAt?'Saved '+when(account.savedAt):'Not saved yet'}</Text></View>
   {account.hold?<>
    <Text style={st.body}>Your account already holds an adventure, saved {when(account.savedAt)??'earlier'}. Which one should this device play? Nothing is saved to your account until you choose.</Text>
    <GameButton variant="primary" icon="cloud" label={working?'Loading…':'Load my saved adventure here'} disabled={busy||working} onPress={loadSaved}/>
    <GameButton icon="check" label="Keep this device's adventure instead" disabled={busy||working} onPress={keepThis}/>
    <Text style={st.note}>Loading sets the hero on this device aside under Heroes first. Keeping this device's adventure replaces the one in your account.</Text>
   </>:<>
    <Text style={st.body}>Your hero and adventure are saved to your account a few seconds after every turn. Sign in with the same email on another device to carry on there.</Text>
    <View style={st.buttons}>
     <GameButton icon="cloud" label={working?'One moment…':'Save now'} disabled={busy||working} onPress={()=>run(async()=>{if(!await saveToAccount())throw Error('There is nothing to save yet. Start an adventure first.');},'Saved to your account.')} style={st.half}/>
     <GameButton icon="transfer" label="Load saved adventure" disabled={busy||working||!account.savedAt} onPress={loadSaved} style={st.half}/>
    </View>
   </>}
   <View style={st.buttons}>
    <GameButton icon="back" label="Sign out" disabled={working} onPress={()=>run(async()=>{await signOut();setManage(false);},'Signed out. Your account keeps its saved adventure.')} style={st.half}/>
    <GameButton icon="settings" label={manage?'Close':'Manage account'} disabled={working} onPress={()=>{setManage(v=>!v);setMessage('');}} style={st.half}/>
   </View>
   {manage&&<View style={st.manage}>
    <Text style={st.label}>Change password</Text>
    <TextInput value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" maxLength={200} placeholder="Current password" placeholderTextColor={tint('#938890')} accessibilityLabel="Current password" style={st.input}/>
    <TextInput value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={200} placeholder="New password (at least 8 characters)" placeholderTextColor={tint('#938890')} accessibilityLabel="New password" style={st.input}/>
    <GameButton icon="key" label="Change password" disabled={working||!current||!next} onPress={()=>run(async()=>{await changePassword(current,next);setCurrent('');setNext('');},'Password changed. Other devices are signed out.')}/>
    <Text style={[st.label,{marginTop:16}]}>Delete account</Text>
    <Text style={st.note}>Removes your account and its saved adventure from the host's PC. The adventure on this device stays.</Text>
    <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" maxLength={200} placeholder="Your password, to confirm" placeholderTextColor={tint('#938890')} accessibilityLabel="Password to confirm deleting the account" style={st.input}/>
    <GameButton variant="danger" icon="close" label="Delete my account" disabled={working||!confirm} onPress={()=>run(async()=>{await deleteAccount(confirm);setConfirm('');setManage(false);},'Your account and its saved adventure were deleted.')}/>
   </View>}
  </>}
  {!!message&&<Text accessibilityLiveRegion="polite" style={st.message}>{message}</Text>}
 </View>;
}
const st=StyleSheet.create({
 panel:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginBottom:18},
 body:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:13.5,lineHeight:21,marginBottom:10},
 label:{fontFamily:fonts.display,color:colors.goldMid,fontSize:11,fontWeight:'700',letterSpacing:2,textTransform:'uppercase',marginBottom:6,marginTop:4},
 input:{fontFamily:fonts.ui,fontSize:16,color:'#f5efe1',backgroundColor:tint('rgba(8,5,9,.75)'),borderColor:tint('rgba(178,34,58,.4)'),borderWidth:1,borderRadius:3,paddingHorizontal:14,paddingVertical:11,marginBottom:10,minWidth:0},
 row:{flexDirection:'row',gap:8,alignItems:'flex-start'},
 show:{minHeight:44,minWidth:64,paddingHorizontal:12,borderRadius:3,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(20,15,21,.8)'),alignItems:'center',justifyContent:'center'},
 showText:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:1.4,color:colors.gold,textTransform:'uppercase'},
 note:{fontFamily:fonts.ui,color:colors.faint,fontSize:12,lineHeight:18,marginTop:8},
 link:{color:colors.goldBright,textDecorationLine:'underline'},
 who:{flexDirection:'row',flexWrap:'wrap',alignItems:'baseline',justifyContent:'space-between',gap:8,padding:14,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(31,24,32,.9)'),marginBottom:10},
 email:{flexShrink:1,fontFamily:fonts.ui,fontWeight:'600',fontSize:16,color:colors.goldBright},
 saved:{fontFamily:fonts.ui,fontSize:12,color:colors.muted},
 buttons:{flexDirection:'row',flexWrap:'wrap',gap:8},half:{flexGrow:1,flexBasis:200},
 manage:{marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:tint('rgba(178,34,58,.25)')},
 message:{fontFamily:fonts.ui,color:'#ffd49a',fontSize:13,lineHeight:19,marginTop:10},
});
