import React,{useState} from 'react';
import {View,Text as PlainText,Pressable,StyleSheet} from 'react-native';
import {EntityText as Text} from './EncounterOverlay';
import {npcScene} from './npcRules';
import {manageFollower} from './followerRules';
import {dungeonRooms} from './dungeonRules';
import {npcArtSubject} from './worldArtRules';
import DynamicArt from './DynamicArt';
import {GameButton,Ornament,StatBar} from './ui';
import {fonts,colors,type} from './theme';
export default function Followers({game,setGame,onBack}){
 const [error,setError]=useState(''),followers=Object.entries(game.followers??{}).filter(([,f])=>f.status!=='dismissed'),locked=game.npcCombat?.active||game.stage==='combat'||!!game.pendingSpell;
 function manage(id,action){const result=manageFollower(game,id,action);if(result.error){setError(result.error);return;}setGame(result.game);setError('');}
 const place=id=>id.startsWith('dungeon:')?dungeonRooms[Number(id.split(':')[1])]?.name:game.story?.locations[id]?.name??({inn:'Crossroads Inn',bridge:'Old Stone Bridge',tower:'Abandoned Watchtower'})[id];
 return <View><PlainText style={s.overline}>Your party</PlainText><Text style={s.heading}>Followers</Text><Ornament style={{marginVertical:12}}/><PlainText style={s.note}>Invite people through the Dungeon Master. Their goals, trust, and responsibilities shape whether they will join you.</PlainText>
 {!followers.length&&<View dataSet={{qb:'plate'}} style={s.empty}><PlainText style={s.emptyGlyph}>♞</PlainText><PlainText style={s.body}>No companions yet. Start a conversation and ask someone to join your adventure.</PlainText></View>}
 {followers.map(([id,f])=>{const npc=npcScene(game).find(n=>n.id===id),name=game.story?.npcs[id]?.name??npc.name;return <View key={id} dataSet={{qb:'plate'}} style={s.card}><View style={s.row}><DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,id)} style={s.portrait}/><View style={{flex:1,minWidth:160,gap:6}}><PlainText style={s.name}>{name}</PlainText><PlainText style={s.status}>{f.status==='following'?'◆ Traveling with you':'◇ Waiting at '+place(f.location)}</PlainText><View style={s.hpRow}><PlainText style={s.hpText}>{npc.hp} / {npc.maximumHP} HP{npc.hp===0?' · Downed':''}</PlainText><PlainText style={s.note}>{npc.attitude}</PlainText></View><StatBar value={npc.hp} maximum={npc.maximumHP} height={7}/></View></View><Text style={s.body}>{f.reason}</Text>{!!f.terms&&<Text style={s.note}>Agreement: {f.terms}</Text>}<View style={s.actions}>{[[f.status==='following'?'Wait here':'Resume traveling',f.status==='following'?'wait':'resume'],['Leave the party','dismiss']].map(([label,action])=><GameButton key={action} label={label} variant={action==='dismiss'?'danger':'secondary'} disabled={locked||(action==='resume'&&!npc.present)} onPress={()=>manage(id,action)} style={{flexGrow:1}}/>)}</View></View>;})}
 {locked&&<PlainText style={s.note}>Finish the encounter before changing your party.</PlainText>}{!!error&&<PlainText accessibilityRole="alert" style={s.error}>{error}</PlainText>}
 <GameButton variant="primary" label="‹ Back to adventure" onPress={onBack} style={{marginTop:18}}/></View>;
}
const s=StyleSheet.create({overline:{...type.label},heading:{fontFamily:fonts.display,color:colors.parchment,fontWeight:'700',letterSpacing:1,fontSize:30,marginTop:6},
 card:{padding:20,borderRadius:4,borderWidth:1,borderColor:colors.goldLine,marginVertical:10},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:18,marginBottom:6},portrait:{width:100,height:124,borderRadius:3},
 name:{fontFamily:fonts.display,color:colors.parchment,fontWeight:'700',letterSpacing:.8,fontSize:22},status:{fontFamily:fonts.ui,color:colors.gold,fontSize:13,fontWeight:'600'},
 hpRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'},hpText:{fontFamily:fonts.display,color:colors.parchment,fontSize:14,fontWeight:'700'},
 body:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:16.5,lineHeight:26,marginVertical:8},note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:20,marginBottom:6,textTransform:'none'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8},error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:22},
 empty:{alignItems:'center',padding:26,borderRadius:4,borderWidth:1,borderColor:'rgba(201,164,92,.25)',marginVertical:8},emptyGlyph:{fontSize:34,color:colors.gold,marginBottom:6}});
