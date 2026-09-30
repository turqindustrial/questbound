import {EntityText as Text} from './EncounterOverlay';
import {campaignState,earnedGold} from './campaignRules';
import React,{useState} from 'react';
import {View,TextInput,Pressable,StyleSheet} from 'react-native';
import {journalForGame,journalObjective} from './journalRules';
import {GameButton,Ornament} from './ui';
import {fonts,colors,type} from './theme';

export default function CampaignJournal({game,onAddNote,onBack,blocked}) {
  const [note,setNote]=useState(''),[visible,setVisible]=useState(20),[folder,setFolder]=useState('dm');
  const journal=journalForGame(game),entries=[...journal.entries].reverse().filter(e=>folder==='player'?(e.kind==='note'&&!['AI DM conversation','AI spell ruling'].includes(e.title)):!(e.kind==='note'&&!['AI DM conversation','AI spell ruling'].includes(e.title)));
  const button=(label,onPress,disabled=false,variant='secondary')=><GameButton key={label} label={label} onPress={onPress} disabled={disabled} variant={variant}/>;
  const tab=(id,label)=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:folder===id}} onPress={()=>{setFolder(id);setVisible(20);}} dataSet={{qb:folder===id?'btn-primary':'chip'}} style={[s.tab,folder===id&&s.tabActive]}><Text style={[s.tabText,folder===id&&{color:'#2a1a07'}]}>{label}</Text></Pressable>;
  return <View>
    <Text style={s.overline}>Campaign journal · Chapter {journal.chapter}</Text>
    <Text style={s.title}>{game.story?.title??'The Lantern at the Crossroads'}</Text>
    <Ornament style={{marginVertical:12}}/>
    <View dataSet={{qb:'plate'}} style={s.objective}><Text style={s.overline}>✦ Current objective</Text><Text style={s.objectiveText}>{game.story?(game.story.status==='complete'?'Adventure complete. ':'' )+game.story.objective:journalObjective(game.stage,game.map,game.campaign)}</Text></View>
    <Text style={s.caption}>Milestones and confirmed DM rulings stay here even when the combat log gets shorter. Continue and earned level-ups retain this journal. New Adventure starts a separate story and fresh journal. Saving character edits or creating a different character starts a fresh journal.</Text>
    {!game.story&&<Text style={s.text}>Quest earnings: {earnedGold(game)} GP · Missing lens: {campaignState(game).lensQuest}</Text>}
    <View accessibilityRole="tablist" style={s.tabs}>{tab('dm','❦  Dungeon Master notes')}{tab('player','✎  Player notes')}</View>{folder==='player'&&<><Text style={s.heading}>Add your note</Text>
    <TextInput dataSet={{qb:'input'}} accessibilityLabel="Campaign journal note" multiline maxLength={2000} value={note} onChangeText={setNote} placeholder="Remember a clue, a promise, or your next plan…" placeholderTextColor="#7f889c" style={s.input}/>
    {button('Add note',()=>{onAddNote(note);setNote('');},blocked||!note.trim(),'primary')}</>}
    <Text style={s.heading}>{folder==='player'?'Your notes':'Chronicle'} · newest first</Text>
    {!entries.length&&<Text style={s.caption}>Nothing recorded here yet.</Text>}
    {entries.slice(0,visible).map(e=><View key={e.id} dataSet={{qb:'plate'}} style={[s.entry,e.kind==='ruling'&&{borderLeftColor:colors.arcane},e.kind==='quest'&&{borderLeftColor:colors.gold},e.kind==='encounter'&&{borderLeftColor:colors.bloodBright}]}><Text style={s.entryMeta}>Chapter {e.chapter} · {folder==='player'?'Player note':e.kind==='ruling'?'DM ruling':e.kind==='quest'?'Quest':e.kind==='encounter'?'Encounter':'Dungeon Master'}</Text><Text style={s.entryTitle}>{e.title}</Text><Text style={s.text}>{e.text}</Text></View>)}
    {entries.length>visible&&button('Show older entries',()=>setVisible(v=>v+20))}
    {button('‹ Back to adventure',onBack,false,'primary')}
  </View>;
}
const s=StyleSheet.create({overline:{...type.label},title:{fontFamily:fonts.display,color:colors.parchment,fontSize:28,fontWeight:'700',letterSpacing:1,marginTop:6},
 heading:{fontFamily:fonts.display,color:colors.gold,fontSize:15,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase',marginTop:20,marginBottom:10},
 text:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:16.5,lineHeight:26},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:20,marginVertical:10},
 objective:{borderWidth:1,borderColor:colors.goldLine,padding:18,borderRadius:4,gap:8},objectiveText:{fontFamily:fonts.story,fontSize:18,lineHeight:28,color:'#f0e4c6'},
 tabs:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:6},tab:{flexGrow:1,paddingHorizontal:16,paddingVertical:11,minHeight:44,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'rgba(20,25,36,.9)',justifyContent:'center'},tabActive:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},tabText:{fontFamily:fonts.display,color:'#ecdcb8',fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase',textAlign:'center'},
 entry:{padding:18,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.18)',borderLeftWidth:3,borderLeftColor:'rgba(201,164,92,.5)',marginBottom:12},
 entryMeta:{...type.label,fontSize:9,color:colors.muted},entryTitle:{fontFamily:fonts.display,color:colors.parchment,fontSize:17,fontWeight:'700',letterSpacing:.6,marginTop:6,marginBottom:8},
 input:{fontFamily:fonts.story,color:'#f5efe1',fontSize:17,lineHeight:25,padding:16,minHeight:110,borderWidth:1,borderColor:'rgba(201,164,92,.4)',backgroundColor:'rgba(4,6,10,.75)',borderRadius:3,marginVertical:8,textAlignVertical:'top'}});
