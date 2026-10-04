import React,{useState} from 'react';
import {View,Text as PlainText,StyleSheet} from 'react-native';
import {EntityText as Text} from './EncounterOverlay';
import {npcScene,npcLore} from './npcRules';
import {manageFollower,acceptOffer,companionGroups,standingOffers,maxFollowing} from './followerRules';
import {attitudeLabel} from './relationshipRules';
import {partyMembers} from './partyRules';
import {npcArtSubject} from './worldArtRules';
import DynamicArt from './DynamicArt';
import {GameButton,StatBar,ScreenTitle} from './ui';
import Icon from './Icon';
import {fonts,colors,tint} from './theme';
// The Companions screen: who travels with the hero, who waits for them somewhere, who offered to come along, the
// allies who stand with them where they live, and (at a shared table) the other players' heroes.
export default function Followers({hero,game,setGame,onBack}){
 const [error,setError]=useState(''),locked=game.npcCombat?.active||game.stage==='combat'||!!game.pendingSpell;
 const groups=companionGroups(game),scene=npcScene(game),offers=standingOffers(game),heroes=partyMembers(game).filter(m=>!m.lead);
 const travelling=groups.travelling.length;
 function apply(result){if(result.error){setError(result.error);return;}setGame(result.game);setError('');}
 const manage=(id,action)=>apply(manageFollower(game,id,action));
 const nameOf=id=>npcLore(game,id)?.name??scene.find(n=>n.id===id)?.name??id;
 const trainedLine=c=>c.trained?'Level '+c.trained.level+' '+c.trained.class:c.role;
 const card=(c,{status,icon,actions=[],body=null})=>{const npc=scene.find(n=>n.id===c.id);return <View key={c.id} dataSet={{qb:'plate'}} style={s.card}>
  <View style={s.row}><DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,c.id)} style={s.portrait}/>
   <View style={s.info}><PlainText style={s.name}>{c.name}</PlainText>{!!trainedLine(c)&&<PlainText numberOfLines={2} style={s.trained}>{trainedLine(c)}</PlainText>}
    <View style={s.status}><Icon name={icon} size={13} color={colors.gold}/><PlainText style={s.statusText}>{status}</PlainText></View>
    <View style={s.hpRow}><PlainText style={s.hpText}>{c.hp} / {c.maximumHP} HP{c.hp===0?' · Downed':''}</PlainText>{!!npc&&<PlainText style={s.note}>{attitudeLabel(npc).label}</PlainText>}</View>
    <StatBar value={c.hp} maximum={c.maximumHP} height={7}/></View></View>
  {body}
  {!!actions.length&&<View style={s.actions}>{actions.map(([label,run,icon,variant='secondary',disabled=false])=><GameButton key={label} icon={icon} label={label} variant={variant} disabled={locked||disabled} onPress={run} style={s.action}/>)}</View>}
 </View>;};
 const agreement=f=><>{!!f?.reason&&<Text style={s.body}>{f.reason}</Text>}{!!f?.terms&&<Text style={s.note}>Agreement: {f.terms}</Text>}</>;
 const nothing=!groups.travelling.length&&!groups.waiting.length&&!groups.allies.length&&!offers.length&&!heroes.length;
 return <View><ScreenTitle eyebrow="Your party" icon="party" title="Companions" sub={'Up to '+maxFollowing+' companions travel with you and follow wherever you go until you tell them otherwise. Allies stand with you where they live.'}/>
 {nothing&&<View dataSet={{qb:'plate'}} style={s.empty}><View style={s.emptyMark}><Icon name="party" size={30} color={colors.gold}/></View><PlainText style={s.emptyTitle}>No companions yet</PlainText><PlainText style={s.emptyBody}>No companions yet. Ask someone to come with you, or take them along when they offer.</PlainText></View>}
 {!!groups.travelling.length&&<PlainText accessibilityRole="header" style={s.section}>Travelling with you</PlainText>}
 {groups.travelling.map(c=>card(c,{status:'Travelling with you',icon:'travel',body:agreement(c.follower),actions:[['Wait here',()=>manage(c.id,'wait'),'camp'],['Part ways',()=>manage(c.id,'dismiss'),'close','danger']]}))}
 {!!groups.waiting.length&&<PlainText accessibilityRole="header" style={s.section}>Waiting</PlainText>}
 {groups.waiting.map(c=>card(c,{status:'Waiting at '+c.place,icon:'camp',body:agreement(c.follower),actions:[c.present?['Rejoin',()=>manage(c.id,'resume'),'travel','secondary',travelling>=maxFollowing]:['Send for them',()=>manage(c.id,'call'),'travel','secondary',travelling>=maxFollowing||c.hp<=0],['Part ways',()=>manage(c.id,'dismiss'),'close','danger']]}))}
 {!!offers.length&&<PlainText accessibilityRole="header" style={s.section}>Offering to come along</PlainText>}
 {offers.map(id=>{const n=scene.find(x=>x.id===id),c={id,name:nameOf(id),role:npcLore(game,id)?.role??null,trained:game.npcClasses?.[id]??null,hp:n.hp,maximumHP:n.maximumHP};return card(c,{status:'Here, and willing to come',icon:'party',body:agreement(game.joinOffers[id]),actions:[['Take them along',()=>apply(acceptOffer(hero,game,id)),'travel','primary',!hero||travelling>=maxFollowing]]});})}
 {!!groups.allies.length&&<PlainText accessibilityRole="header" style={s.section}>Allies</PlainText>}
 {!!groups.allies.length&&<PlainText style={s.note}>Allies stand with you where they live. Ask them to come along to bring them with you.</PlainText>}
 {groups.allies.map(c=>card(c,{status:'At '+c.place,icon:'shield'}))}
 {!!heroes.length&&<PlainText accessibilityRole="header" style={s.section}>Heroes at the table</PlainText>}
 {heroes.map(m=><View key={m.id} dataSet={{qb:'plate'}} style={s.card}><PlainText style={s.name}>{m.name}</PlainText><PlainText style={s.trained}>{['Level '+m.level,m.species,m.heroClass].filter(Boolean).join(' ')}{m.player?' · played by '+m.player:''}</PlainText>{m.hp!=null&&<><PlainText style={s.hpText}>{m.status==='dead'?'Fallen':m.status==='down'?'Down':m.hp+' / '+m.maxHp+' HP'}</PlainText><StatBar value={m.status==='up'?m.hp:0} maximum={m.maxHp??1} height={7}/></>}</View>)}
 {locked&&<PlainText style={s.note}>Finish the encounter before changing your party.</PlainText>}{!!error&&<PlainText accessibilityRole="alert" style={s.error}>{error}</PlainText>}
 <GameButton variant="primary" icon="back" label="Back to adventure" onPress={onBack} style={{marginTop:18}}/></View>;
}
const s=StyleSheet.create({
 card:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,marginVertical:8},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:18,marginBottom:6},portrait:{width:100,height:124,borderRadius:4},
 info:{flexGrow:1,flexShrink:1,flexBasis:160,minWidth:0,gap:6},
 section:{fontFamily:fonts.display,color:colors.gold,fontSize:14,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase',marginTop:14,marginBottom:2},
 name:{fontFamily:fonts.display,color:colors.parchment,fontWeight:'700',letterSpacing:.8,fontSize:22,flexShrink:1},trained:{fontFamily:fonts.ui,color:colors.goldBright,fontSize:13,fontWeight:'600',flexShrink:1},
 status:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},statusText:{fontFamily:fonts.ui,color:colors.gold,fontSize:13,fontWeight:'600',flexShrink:1},
 hpRow:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',alignItems:'baseline',gap:6},hpText:{fontFamily:fonts.display,color:colors.parchment,fontSize:14,fontWeight:'700'},
 body:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:16.5,lineHeight:26,marginVertical:8},note:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:20,marginBottom:6,textTransform:'none'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8},action:{flexGrow:1,flexShrink:1,minWidth:140},error:{fontFamily:fonts.ui,color:colors.danger,fontSize:14,lineHeight:22},
 empty:{alignItems:'center',padding:28,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.25)'),marginVertical:8,gap:6},
 emptyMark:{width:64,height:64,borderRadius:32,borderWidth:1,borderColor:tint('rgba(224,74,92,.5)'),alignItems:'center',justifyContent:'center',marginBottom:6,backgroundColor:tint('rgba(48,26,78,.35)')},
 emptyTitle:{fontFamily:fonts.display,fontSize:18,fontWeight:'700',letterSpacing:1,color:colors.parchment},emptyBody:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:16,lineHeight:24,textAlign:'center'},
});
