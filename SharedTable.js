import React,{useState,useEffect} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {GameButton,Ornament,ScreenTitle,Section} from './ui';
import Icon from './Icon';
import HeroPortrait from './HeroPortrait';
import QuickHeroes from './QuickHeroes';
import {localBackup,restoreLocalBackup} from './tableClient';
import MemberActions,{useMutedMembers} from './TableMemberActions';
import {accountsNeeded} from './accountRules';
import {heroSpecies} from './characterRules';
import {fonts,colors,type,tint} from './theme';
// Campaign invites are eight letters and numbers shown as XXXX-XXXX (campaigns.cjs newInvite); a player may type them
// in any case, with or without the dash. A longer code from before is kept as it was typed (it still works until it
// expires).
export function typedInvite(text){
 const raw=String(text??'').trim(),letters=raw.toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(raw.replace(/[\s-]/g,'').length>8)return raw.slice(0,24);
 return letters.length>4?letters.slice(0,4)+'-'+letters.slice(4,8):letters;
}
export const inviteReady=text=>/^[A-Z0-9]{8}$/.test(String(text??'').toUpperCase().replace(/[\s-]+/g,''))||/^[a-zA-Z0-9_-]{16}$/.test(String(text??'').trim());
// The hero a player brings to a table (the host's words, 2026-10-21: "any players joining a game should either pick a
// character from their pre made characters or make a new one for the adventure"): their current hero, one waiting in
// their roster, a ready-made hero, or a new one made in the builder.
function HeroRow({hero,line,chosen,onPress,disabled}){
 return <Pressable accessibilityRole="radio" accessibilityState={{checked:chosen,disabled}} accessibilityLabel={'Bring '+hero.name} disabled={disabled} onPress={onPress} dataSet={{qb:'card',selected:String(chosen),tablehero:'true'}} style={[s.heroRow,chosen&&s.heroRowChosen]}>
  <HeroPortrait hero={hero} size={40} level={hero.level}/>
  <View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.heroName}>{hero.name}</Text><Text numberOfLines={1} style={s.heroLine}>{line}</Text></View>
  {chosen&&<View style={s.check}><Icon name="check" size={14} color={tint('#fff4f5')} strokeWidth={2.4}/></View>}
 </Pressable>;
}
const heroLine=(hero,more)=>['Level '+hero.level+' '+heroSpecies(hero)+' '+hero.class,more].filter(Boolean).join(' · ');
export function HeroChoice({hero,game,roster=[],choice,onChoose,onNewHero,disabled}){
 const [ready,setReady]=useState(false);
 const current=!!hero&&game?.stage!=='dead';
 const living=roster.map(e=>{try{return {entry:e,hero:JSON.parse(e.character)};}catch{return null;}}).filter(Boolean);
 return <View dataSet={{qb:'table-hero-choice'}}>
  {current&&<HeroRow hero={hero} line={heroLine(hero,'your current hero')} chosen={choice?.kind==='current'} disabled={disabled} onPress={()=>onChoose({kind:'current'})}/>}
  {living.map(({entry,hero:h})=><HeroRow key={entry.id} hero={h} line={heroLine(h,entry.summary?.story?'waiting in '+entry.summary.story:'waiting in your roster')} chosen={choice?.kind==='roster'&&choice.entry.id===entry.id} disabled={disabled} onPress={()=>onChoose({kind:'roster',entry})}/>)}
  {choice?.kind==='ready'&&<HeroRow hero={choice.character} line={heroLine(choice.character,'ready-made')} chosen disabled={disabled} onPress={()=>{}}/>}
  <View style={s.heroButtons}>
   <GameButton icon="spell" label={ready?'Hide the ready-made heroes':'A ready-made hero'} disabled={disabled} onPress={()=>setReady(!ready)} style={s.half}/>
   <GameButton icon="quill" label="Make a new hero" disabled={disabled} onPress={onNewHero} style={s.half}/>
  </View>
  {ready&&<QuickHeroes onChoose={character=>{onChoose({kind:'ready',character});setReady(false);}} disabled={disabled}/>}
  {!current&&!living.length&&choice?.kind!=='ready'&&<Text style={s.note}>You have no hero yet: pick a ready-made one or make your own.</Text>}
 </View>;
}
const nameOf=(choice,hero)=>choice?.kind==='current'?hero?.name:choice?.kind==='roster'?(()=>{try{return JSON.parse(choice.entry.character).name;}catch{return null;}})():choice?.kind==='ready'?choice.character.name:null;
export default function SharedTable({table,hero,game,roster=[],busy:saving=false,heroForTable,onNewHero,onChooseTale,onPlay}){
 const [code,setCode]=useState(''),[campaigns,setCampaigns]=useState([]);
 useEffect(()=>{table.listCampaigns().then(r=>setCampaigns(r.campaigns)).catch(()=>{});},[table.joined]);
 const [name,setName]=useState(table.name||hero?.name||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false),[replace,setReplace]=useState(false),backup=localBackup();
 const [choice,setChoice]=useState(()=>hero&&game?.stage!=='dead'?{kind:'current'}:null);
 // The current hero changes (a hero just made in the builder, or brought from the roster): they are the one chosen.
 useEffect(()=>{if(hero&&game?.stage!=='dead'&&choice?.kind!=='ready')setChoice({kind:'current'});},[hero?.name,hero?.level,game?.stage]);
 const run=async fn=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const off=busy||saving,chosenName=nameOf(choice,hero);
 // Every member, here or away; another member's row opens Mute, Report and (for the host) Remove and ban.
 const [open,setOpen]=useState(null),muted=useMutedMembers(table.campaignId),acting=new Set(table.players.filter(p=>p.acting).map(p=>p.id));
 const members=(table.members??table.players).map(m=>({...m,here:m.here??true,acting:acting.has(m.id)}));
 const host=table.role==='owner',dead=!!hero&&game?.stage==='dead'&&!table.needsHero,tale=game?.story&&!table.needsTale?game.story:null;
 const bring=()=>run(async()=>{const snapshot=await heroForTable(choice);await table.bringHero(snapshot);});
 const copy=()=>{try{globalThis.navigator?.clipboard?.writeText(table.invite).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{});}catch{}};
 return <View>
  <ScreenTitle eyebrow="Multiplayer" icon="people" title="The shared table" sub="One adventure, played together from several phones and computers."/>
  <Text style={s.copy}>{accountsNeeded()?'Verified members':'Members'} see the same committed story. The server applies actions and rolls dice; while one player is taking a turn, the others wait. Every player brings a hero of their own: up to four travel together, the foe can strike any of them, and a fallen friend can be revived with a draught.</Text>
  {!!table.notice&&!table.joined&&<Pressable accessibilityRole="alert" onPress={table.clearNotice}><Text style={s.error}>{table.notice}  ✕</Text></Pressable>}
  {table.joined?<>
   <View dataSet={{qb:'plate'}} style={s.status}>
    <View style={s.online}><View style={[s.dot,{backgroundColor:table.online?colors.heal:colors.gold}]}/><Text style={s.label}>{table.online?'Connected':'Reconnecting…'}</Text></View>
    <Text style={s.title}>Seated as {table.name||'Adventurer'}</Text>
    {!!tale&&<Text style={s.taleLine}>Playing {tale.title}</Text>}
    <Text style={s.label}>At the table</Text>
    {members.map(p=>{const me=p.id===table.deviceId,isMuted=muted.some(m=>m.seat===p.id);return <View key={p.id} dataSet={{qb:'table-member'}}>
     <View style={s.player}><View style={[s.seat,p.acting&&{borderColor:colors.gold}]}><Icon name={p.acting?'quill':isMuted?'mute':'sheet'} size={14} color={p.acting?colors.goldBright:colors.gold}/></View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.playerName}>{p.name}{me?' (this device)':''}{p.role==='owner'&&!me?' · host':''}</Text>{p.hero!==undefined&&<Text numberOfLines={1} style={s.playerHero}>{p.hero?'with '+p.hero:'no hero yet'}</Text>}</View><Text style={s.playerState}>{p.acting?'taking a turn…':p.here?'here':'away'}{isMuted?' · muted':''}</Text>
      {!me&&<Pressable accessibilityRole="button" accessibilityState={{expanded:open===p.id}} accessibilityLabel={'Mute, report'+(host?' or remove ':' ')+p.name} dataSet={{qb:'chip'}} onPress={()=>setOpen(open===p.id?null:p.id)} style={[s.more,open===p.id&&{borderColor:colors.goldBright}]}><Icon name={open===p.id?'close':'dots'} size={14} color={colors.gold}/></Pressable>}</View>
     {open===p.id&&!me&&<MemberActions table={table} member={p} onClose={()=>setOpen(null)}/>}
    </View>;})}
    {!members.length&&<Text style={s.copy}>Waiting for the table…</Text>}
    {members.length>1&&<Text style={s.note}>Use the ⋯ beside a player to mute them on this device or report them to the host of the game{host?'; as this table’s host you can also remove and ban them':''}.</Text>}
    {host&&!!table.banned?.length&&<><Text style={s.label}>Kept out of this table</Text>{table.banned.map(b=><View key={b.ref} style={s.player}><View style={s.seat}><Icon name="close" size={14} color={colors.gold}/></View><Text numberOfLines={1} style={s.playerName}>{b.name}</Text><Pressable accessibilityRole="button" accessibilityLabel={'Let '+b.name+' back'} dataSet={{qb:'chip'}} disabled={off} onPress={()=>run(()=>table.unban(b.ref))} style={s.unban}><Text style={s.unbanText}>Let back</Text></Pressable></View>)}<Text style={s.note}>Someone you let back can rejoin with a campaign invite.</Text></>}
   </View>
   {!!table.error&&<Text style={s.error}>{table.error}</Text>}
   {/* A player with no hero of their own here (or whose hero has fallen) brings one to their seat. */}
   {(table.needsHero||dead)&&<View dataSet={{qb:'table-bring'}}>
    <Section icon="sheet" title={dead?'Bring a new hero':'Bring your hero'}/>
    <Text style={s.copy}>{dead?hero.name+' has fallen. Bring another of your heroes to your seat and play on with the party.':'Everyone at this table plays a hero of their own. Choose yours: they join the party at your seat, with what they carry.'}</Text>
    <HeroChoice hero={dead?null:hero} game={game} roster={roster} choice={choice} onChoose={setChoice} onNewHero={onNewHero} disabled={off}/>
    <GameButton variant="primary" icon="people" label={busy?'Bringing your hero…':chosenName?'Bring '+chosenName+' to the table':'Choose your hero first'} disabled={off||!chosenName} onPress={bring}/>
   </View>}
   {/* The table's tale: chosen by its host before anyone is invited, and begun for everyone. */}
   {table.needsTale&&!table.needsHero&&(host?<View dataSet={{qb:'table-tale'}}><Section icon="compass" title="Choose the table’s tale"/><Text style={s.copy}>Pick the tale your table will play: a ready journey starts at once. Then invite your players; each brings a hero of their own.</Text><GameButton variant="primary" icon="compass" label="Choose the tale" disabled={off} onPress={()=>onChooseTale(false)}/></View>
    :<Text style={s.waiting}>The host is choosing the table’s tale. It begins for everyone at once.</Text>)}
   {host&&!table.needsTale&&<>
    {!!table.invite?<View dataSet={{qb:'invite'}} style={s.invite}><Text style={s.label}>Campaign invite</Text><Text selectable accessibilityLabel={'Campaign invite '+table.invite.split('').join(' ')} style={s.code}>{table.invite}</Text><Text style={s.note}>Expires in 7 days. Share it privately with your players: they type it in, in capitals or not.</Text>{!!globalThis.navigator?.clipboard&&<GameButton icon="transfer" label={copied?'Copied':'Copy the invite'} onPress={copy}/>}</View>
     :<GameButton label="Create a new campaign invite" onPress={()=>run(table.newInvite)} disabled={off}/>}
   </>}
   {!table.needsHero&&!table.needsTale&&<GameButton variant="primary" icon="play" label="Play at the table" onPress={onPlay}/>}
   {host&&!table.needsTale&&!table.needsHero&&(tale?.status!=='complete'&&tale?.introId!=='hostile'?(replace?<><Text style={s.note}>Begin a new tale for everyone? {tale?.title??'The tale under way'} ends for the whole table once the new one begins.</Text><GameButton icon="compass" label="Yes, choose a new tale" disabled={off} onPress={()=>{setReplace(false);onChooseTale(true);}}/><GameButton label="Keep playing this tale" disabled={off} onPress={()=>setReplace(false)}/></>:<GameButton icon="compass" label="Begin a new tale for the table" disabled={off} onPress={()=>setReplace(true)}/>)
    :<GameButton variant="primary" icon="compass" label="Choose the table’s next tale" disabled={off} onPress={()=>onChooseTale(false)}/>)}
   <GameButton icon="retreat" label="Leave the table" disabled={off} onPress={()=>run(table.leave)}/>
   <Text style={s.note}>Leaving keeps this device's copy of the adventure. Other players can carry on without you.</Text>
   {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </>:<>
   <Section icon="sheet" title="Take a seat"/>
   {campaigns.map(c=><GameButton key={c.id} label={'Resume '+c.title} disabled={off} onPress={()=>run(()=>table.join(name||hero?.name||'Adventurer',false,{campaignId:c.id}))}/>)}
   <Text style={s.label}>Your name at the table</Text>
   <TextInput dataSet={{qb:'input'}} accessibilityLabel="Your name at the table" value={name} onChangeText={setName} maxLength={40} placeholder="e.g. Sam" placeholderTextColor={tint('#938890')} style={s.input}/>
   <Text style={s.label}>Your hero for this table</Text>
   <HeroChoice hero={hero} game={game} roster={roster} choice={choice} onChoose={setChoice} onNewHero={onNewHero} disabled={off}/>
   <Text style={s.label}>Campaign invite</Text>
   <TextInput dataSet={{qb:'input',invite:'true'}} value={code} onChangeText={text=>setCode(typedInvite(text))} autoCapitalize="characters" autoCorrect={false} autoComplete="off" spellCheck={false} maxLength={24} placeholder="K7Q2-9XMB" placeholderTextColor={tint('#938890')} accessibilityLabel="Campaign invite" style={[s.input,s.codeInput]}/>
   <GameButton variant="primary" icon="people" label={busy?'Joining…':chosenName?'Join the table with '+chosenName:'Choose your hero to join'} disabled={off||!name.trim()||!inviteReady(code)||!chosenName} onPress={()=>run(async()=>{const snapshot=await heroForTable(choice);await table.join(name,false,{code,snapshot});})}/>
   <Text style={s.note}>The host gives you an eight-character invite, like K7Q2-9XMB{accountsNeeded()?', after you sign in and verify your email':''}. You join the party with the hero you chose; your own save is backed up here first.</Text>
   <Section icon="party" title="Or host the table"/>
   <GameButton icon="flag" label={chosenName?'Open a table with '+chosenName:'Choose your hero to host'} disabled={off||!name.trim()||!chosenName} onPress={()=>run(async()=>{const snapshot=await heroForTable(choice);await table.join(name,true,{snapshot});})}/>
   <Text style={s.note}>{chosenName?(choice?.kind==='current'&&game?.story&&game.story.introId!=='hostile'?'Opens a table in '+chosenName+'’s tale, '+game.story.title+'. ':'Opens a table for '+chosenName+'; you choose the tale it plays before you invite anyone. ')+'Each friend who joins brings a hero of their own.':'Choose the hero you will play, then open the table.'}</Text>
   {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </>}
  {!!backup&&!table.joined&&<><Ornament glyph="✦"/><Text style={s.note}>A copy of this device's own adventure from before you joined a table is kept here ({new Date(backup).toLocaleString()}).</Text><GameButton icon="transfer" label="Restore my own adventure" onPress={()=>{restoreLocalBackup();globalThis.location?.reload();}}/></>}
 </View>;
}
const s=StyleSheet.create({copy:{fontFamily:fonts.ui,color:tint('#d4ced2'),lineHeight:23,fontSize:14.5,marginBottom:6},
 label:{...type.label,marginTop:10,marginBottom:6},title:{fontFamily:fonts.display,color:colors.parchment,fontSize:22,fontWeight:'700',letterSpacing:.8},
 taleLine:{fontFamily:fonts.story,fontStyle:'italic',color:tint('#ded1cb'),fontSize:15.5,marginTop:2},
 online:{flexDirection:'row',alignItems:'center',gap:8},seat:{width:30,height:30,borderRadius:15,borderWidth:1,borderColor:tint('rgba(178,34,58,.45)'),alignItems:'center',justifyContent:'center'},
 status:{padding:18,borderRadius:6,borderWidth:1,borderColor:tint('rgba(111,208,196,.4)'),marginBottom:8},player:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderBottomWidth:1,borderBottomColor:tint('rgba(178,34,58,.12)')},
 dot:{width:9,height:9,borderRadius:5},playerName:{fontFamily:fonts.display,color:colors.parchment,fontSize:15,fontWeight:'700'},playerHero:{fontFamily:fonts.ui,color:colors.muted,fontSize:12,marginTop:1},
 more:{width:36,height:34,borderRadius:17,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),alignItems:'center',justifyContent:'center'},
 unban:{minHeight:34,paddingHorizontal:12,borderRadius:17,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),justifyContent:'center'},unbanText:{fontFamily:fonts.ui,fontSize:13,fontWeight:'600',color:colors.gold},playerState:{fontFamily:fonts.ui,color:colors.muted,fontSize:12},
 input:{fontFamily:fonts.story,color:tint('#f5efe1'),backgroundColor:tint('rgba(8,5,9,.75)'),borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),borderRadius:4,padding:14,fontSize:18},
 codeInput:{fontFamily:fonts.ui,fontSize:22,letterSpacing:4,fontWeight:'700'},
 invite:{padding:16,borderRadius:6,borderWidth:1,borderColor:tint('rgba(224,74,92,.45)'),marginVertical:8},
 code:{fontFamily:fonts.ui,fontSize:30,fontWeight:'700',letterSpacing:5,color:colors.goldBright,marginVertical:4},
 heroRow:{flexDirection:'row',alignItems:'center',gap:12,padding:10,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.25)'),backgroundColor:tint('#211822'),marginBottom:8},
 heroRowChosen:{borderColor:colors.gold},heroName:{fontFamily:fonts.display,color:colors.parchment,fontSize:16,fontWeight:'700'},heroLine:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,marginTop:2},
 check:{width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.gold,borderWidth:1,borderColor:tint('#f06e80')},
 heroButtons:{flexDirection:'row',flexWrap:'wrap',gap:8},half:{flexGrow:1,flexBasis:200,minWidth:0},
 waiting:{fontFamily:fonts.story,fontStyle:'italic',color:tint('#ded1cb'),fontSize:16,lineHeight:24,marginVertical:10},
 note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginTop:8},error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:21,marginTop:12}});
