import React,{useState} from 'react';
import {View,Text as PlainText,StyleSheet} from 'react-native';
import {EntityText as Text} from './EncounterOverlay';
import {npcScene} from './npcRules';
import {manageFollower} from './followerRules';
import {attitudeLabel} from './relationshipRules';
import {dungeonRooms} from './dungeonRules';
import {npcArtSubject} from './worldArtRules';
import DynamicArt from './DynamicArt';
import {GameButton,StatBar,ScreenTitle} from './ui';
import Icon from './Icon';
import {fonts,colors,type} from './theme';
export default function Followers({game,setGame,onBack}){
 const [error,setError]=useState(''),followers=Object.entries(game.followers??{}).filter(([,f])=>f.status!=='dismissed'),locked=game.npcCombat?.active||game.stage==='combat'||!!game.pendingSpell;
 function manage(id,action){const result=manageFollower(game,id,action);if(result.error){setError(result.error);return;}setGame(result.game);setError('');}
 const place=id=>id.startsWith('dungeon:')?dungeonRooms[Number(id.split(':')[1])]?.name:game.story?.locations[id]?.name??({inn:'Crossroads Inn',bridge:'Old Stone Bridge',tower:'Abandoned Watchtower'})[id];
 return <View><ScreenTitle eyebrow="Your party" icon="party" title="Companions" sub="Invite people through the Dungeon Master. Their goals, trust and responsibilities shape whether they join you."/>
 {!followers.length&&<View dataSet={{qb:'plate'}} style={s.empty}><View style={s.emptyMark}><Icon name="party" size={30} color={colors.gold}/></View><PlainText style={s.emptyTitle}>No companions yet</PlainText><PlainText style={s.body}>Start a conversation and ask someone to join your adventure.</PlainText></View>}
 {followers.map(([id,f])=>{const npc=npcScene(game).find(n=>n.id===id),name=game.story?.npcs[id]?.name??npc.name,following=f.status==='following';return <View key={id} dataSet={{qb:'plate'}} style={s.card}><View style={s.row}><DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,id)} style={s.portrait}/><View style={{flex:1,minWidth:160,gap:6}}><PlainText style={s.name}>{name}</PlainText><View style={s.status}><Icon name={following?'travel':'camp'} size={13} color={colors.gold}/><PlainText style={s.statusText}>{following?'Traveling with you':'Waiting at '+place(f.location)}</PlainText></View><View style={s.hpRow}><PlainText style={s.hpText}>{npc.hp} / {npc.maximumHP} HP{npc.hp===0?' · Downed':''}</PlainText><PlainText style={s.note}>{attitudeLabel(npc).label}</PlainText></View><StatBar value={npc.hp} maximum={npc.maximumHP} height={7}/></View></View><Text style={s.body}>{f.reason}</Text>{!!f.terms&&<Text style={s.note}>Agreement: {f.terms}</Text>}<View style={s.actions}>{[[following?'Wait here':'Resume traveling',following?'wait':'resume',following?'camp':'travel'],['Leave the party','dismiss','close']].map(([label,action,icon])=><GameButton key={action} icon={icon} label={label} variant={action==='dismiss'?'danger':'secondary'} disabled={locked||(action==='resume'&&!npc.present)} onPress={()=>manage(id,action)} style={{flexGrow:1}}/>)}</View></View>;})}
 {locked&&<PlainText style={s.note}>Finish the encounter before changing your party.</PlainText>}{!!error&&<PlainText accessibilityRole="alert" style={s.error}>{error}</PlainText>}
 <GameButton variant="primary" icon="back" label="Back to adventure" onPress={onBack} style={{marginTop:18}}/></View>;
}
const s=StyleSheet.create({
 card:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginVertical:8},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:18,marginBottom:6},portrait:{width:100,height:124,borderRadius:4},
 name:{fontFamily:fonts.display,color:colors.parchment,fontWeight:'700',letterSpacing:.8,fontSize:22},status:{flexDirection:'row',alignItems:'center',gap:6},statusText:{fontFamily:fonts.ui,color:colors.gold,fontSize:13,fontWeight:'600'},
 hpRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'},hpText:{fontFamily:fonts.display,color:colors.parchment,fontSize:14,fontWeight:'700'},
 body:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:16.5,lineHeight:26,marginVertical:8},note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:20,marginBottom:6,textTransform:'none'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8},error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:22},
 empty:{alignItems:'center',padding:28,borderRadius:6,borderWidth:1,borderColor:'rgba(178,34,58,.25)',marginVertical:8,gap:6},
 emptyMark:{width:64,height:64,borderRadius:32,borderWidth:1,borderColor:'rgba(224,74,92,.5)',alignItems:'center',justifyContent:'center',marginBottom:6,backgroundColor:'rgba(48,26,78,.35)'},
 emptyTitle:{fontFamily:fonts.display,fontSize:18,fontWeight:'700',letterSpacing:1,color:colors.parchment},
});
