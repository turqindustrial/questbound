import {EntityText as Text} from './EncounterOverlay';
import {campaignState,earnedGold} from './campaignRules';
import React,{useState} from 'react';
import {View,Text as PlainText,TextInput,StyleSheet} from 'react-native';
import {journalForGame,journalObjective} from './journalRules';
import {questState,currentGoal} from './storyRules';
import {GameButton,ScreenTitle,Segmented,Section} from './ui';
import Icon from './Icon';
import {fonts,colors,type,tint} from './theme';
// Stored entry titles are kept as written; the page shows friendlier names.
const shownTitle=title=>({'AI DM conversation':'Conversation','AI spell ruling':'Spell ruling'})[title]??title;
const kinds={ruling:['DM ruling','spell',colors.arcane],quest:['Quest','scroll',colors.gold],encounter:['Encounter','swords',colors.bloodBright],level:['Level gained','star',colors.goldBright]};
export default function CampaignJournal({game,onAddNote,onBack,blocked}) {
  const [note,setNote]=useState(''),[visible,setVisible]=useState(20),[folder,setFolder]=useState('dm');
  const quest=questState(game),journal=journalForGame(game),entries=[...journal.entries].reverse().filter(e=>folder==='player'?(e.kind==='note'&&!['AI DM conversation','AI spell ruling'].includes(e.title)):!(e.kind==='note'&&!['AI DM conversation','AI spell ruling'].includes(e.title)));
  return <View>
    <ScreenTitle eyebrow={quest?.current?'Journal · Chapter '+quest.number+' of '+quest.chapters:'Campaign journal'} icon="journal" title={game.story?.title??'The Lantern at the Crossroads'}/>
    <View dataSet={{qb:'plate'}} style={s.objective}><View style={s.objectiveHead}><Icon name={game.story?.status==='complete'?'star':'compass'} size={15} color={colors.gold}/><PlainText style={s.overline}>{game.story?.status==='complete'?'Adventure complete':quest?.current?quest.current.title:'Current objective'}</PlainText></View><Text style={s.objectiveText}>{game.story?(game.story.status==='complete'?game.story.objective:currentGoal(game)):journalObjective(game.stage,game.map,game.campaign)}</Text></View>
    {!game.story&&<Text style={s.text}>Quest earnings: {earnedGold(game)} GP · Missing lens: {campaignState(game).lensQuest}</Text>}
    <Segmented value={folder} onChange={id=>{setFolder(id);setVisible(20);}} options={[['dm','Dungeon Master','quill'],['player','Your notes','feedback']]}/>
    {folder==='player'&&<>
    <TextInput dataSet={{qb:'input'}} accessibilityLabel="Campaign journal note" multiline maxLength={2000} value={note} onChangeText={setNote} placeholder="Remember a clue, a promise, or your next plan…" placeholderTextColor={tint('#938890')} style={s.input}/>
    <GameButton variant="primary" icon="quill" label="Add note" onPress={()=>{onAddNote(note);setNote('');}} disabled={blocked||!note.trim()}/></>}
    <Section icon={folder==='player'?'feedback':'journal'} title={(folder==='player'?'Your notes':'Chronicle')+' · newest first'}/>
    {!entries.length&&<View style={s.empty}><Icon name="journal" size={26} color={colors.goldMid}/><PlainText style={s.emptyText}>Nothing recorded here yet.</PlainText></View>}
    {entries.slice(0,visible).map(e=>{const [label,icon,tone]=folder==='player'?['Player note','feedback',colors.gold]:kinds[e.kind]??['Dungeon Master','quill',colors.goldMid];return <View key={e.id} dataSet={{qb:'plate'}} style={[s.entry,{borderLeftColor:tone}]}>
      <View style={s.entryHead}><Icon name={icon} size={13} color={tone}/><PlainText style={s.entryMeta}>{label}{journal.chapter>1?' · Tale '+e.chapter:''}</PlainText></View>
      <Text style={s.entryTitle}>{shownTitle(e.title)}</Text><Text style={s.text}>{String(e.text).replace(/^AI DM: /gm,'Dungeon Master: ')}</Text></View>;})}
    {entries.length>visible&&<GameButton icon="forward" label="Show older entries" onPress={()=>setVisible(v=>v+20)}/>}
    <Text style={s.caption}>Milestones and confirmed DM rulings stay here even when the combat log gets shorter. Continue and earned level-ups keep this journal; a new adventure or a new character starts a fresh one.</Text>
    <GameButton variant="primary" icon="back" label="Back to adventure" onPress={onBack}/>
  </View>;
}
const s=StyleSheet.create({overline:{...type.label},
 text:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:16.5,lineHeight:26},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:20,marginVertical:12},
 objective:{borderWidth:1,borderColor:colors.goldLine,padding:18,borderRadius:6,gap:8},objectiveHead:{flexDirection:'row',alignItems:'center',gap:8},objectiveText:{fontFamily:fonts.story,fontSize:18,lineHeight:28,color:'#e6d7d1'},
 entry:{padding:16,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.18)'),borderLeftWidth:3,marginBottom:10},
 entryHead:{flexDirection:'row',alignItems:'center',gap:7},entryMeta:{...type.label,fontSize:9,color:colors.muted},entryTitle:{fontFamily:fonts.display,color:colors.parchment,fontSize:17,fontWeight:'700',letterSpacing:.6,marginTop:6,marginBottom:6},
 empty:{alignItems:'center',gap:8,paddingVertical:24},emptyText:{fontFamily:fonts.story,fontStyle:'italic',fontSize:16,color:colors.muted},
 input:{fontFamily:fonts.story,color:'#f5efe1',fontSize:17,lineHeight:25,padding:16,minHeight:110,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),backgroundColor:tint('rgba(8,5,9,.75)'),borderRadius:6,marginTop:4,textAlignVertical:'top'}});
