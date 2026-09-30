import {EntityText as Text} from './EncounterOverlay';
import SkillPanel from './SkillPanel';
import MagicPanel from './MagicPanel';
import {earnedGold,campaignState} from './campaignRules';
import {spellDefense} from './spellRules';
import FeaturePanel from './FeaturePanel';
import {spellLibrary,automaticSpells} from './spellOptions';
import React, {useState} from 'react';
import LoadoutSummary from './LoadoutSummary';
import {View, Text as PlainText, Pressable, StyleSheet} from 'react-native';
import {abilities, modifier} from './characterRules';
import {combatBasics, signed} from './combatRules';
import WeaponAttacks from './WeaponAttacks';
import HealthTracker from './HealthTracker';
import {GameButton,Ornament} from './ui';
import {fonts,colors,type} from './theme';

export default function CharacterSheet({hero, game, onBack, health, setHealth, healthLocked, setGame}) {
  const [tab,setTab]=useState('Overview');
  const [showCalculations,setShowCalculations] = useState(false);
  const stats = combatBasics(hero);
  const tile = (label,value,description) => <View key={label} dataSet={{qb:'plate'}} style={s.tile}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text><Text style={[s.caption,s.center]}>{description}</Text></View>;
  return <View>
    <PlainText style={s.overline}>Character sheet</PlainText>
    <PlainText style={s.name}>{hero.name}</PlainText>
    <Text style={s.subtitle}>Level {hero.level} · {hero.species ?? hero.race} · {hero.class}</Text>
    <Ornament style={{marginVertical:12}}/>
    {!!hero.plannedSubclass && <Text style={s.caption}>{hero.level>=3?'Subclass':'Planned subclass'}: {hero.plannedSubclass}{hero.level<3?' · Unlocks at level 3':''}</Text>}
    {!!hero.background && <Text style={s.gold}>{hero.background} · {hero.originFeat}</Text>}
    <View accessibilityRole="tablist" style={s.grid}>{['Overview','Spells','Skills & Abilities','Inventory'].map(name=><Pressable key={name} accessibilityRole="tab" accessibilityState={{selected:tab===name}} onPress={()=>setTab(name)} dataSet={{qb:tab===name?'btn-primary':'chip'}} style={[s.tab,tab===name&&s.tabActive]}><Text style={[s.tabText,tab===name&&{color:'#2a1a07'}]}>{name}</Text></Pressable>)}</View>
    {tab==='Overview'&&<>
    {stats.available ? <>
      <View style={s.grid}>
        {tile('Maximum HP',stats.hp,'Your hit-point maximum at this level')}
        {tile('Armor class',spellDefense(game,stats.ac).ac ?? '—',spellDefense(game,stats.ac).ac!==stats.ac?'Includes active spell protection':'From your armor and gear')}
        {tile('Initiative',signed(stats.initiative),'Add this to your initiative d20')}
        {tile('Proficiency',signed(stats.proficiency),'Bonus for trained abilities')}
      </View>
      <View style={s.panel}><Text style={s.section}>Starter defense</Text><Text style={s.text}>{stats.defense}</Text><Text style={s.caption}>Assumes the listed armor is worn and any starter shield is wielded. Spell effects and optional fighting styles are not included.</Text>{!!stats.armorNote && <Text style={s.gold}>{stats.armorNote}</Text>}</View>
      <Pressable accessibilityRole="button" accessibilityState={{expanded:showCalculations}} onPress={() => setShowCalculations(!showCalculations)} dataSet={{qb:'btn'}} style={s.secondary}><Text style={s.buttonText}>{showCalculations ? 'Hide calculations' : 'How are these calculated?'}</Text></Pressable>
      {showCalculations && <View style={s.panel}>
        <Text style={s.text}>Maximum HP: {stats.hpFormula} = {stats.hp}</Text>
        <Text style={s.text}>Hit Point Die: {stats.hitDie}</Text>
        <Text style={s.text}>Armor class: {stats.ac === null ? 'Equipment not saved yet.' : `${stats.acFormula}${spellDefense(game,stats.ac).ac!==stats.ac?' + 2 Shield of Faith':''} = ${spellDefense(game,stats.ac).ac}`}</Text>
        <Text style={s.text}>Initiative: {stats.initiativeFormula} = {signed(stats.initiative)}</Text>
        <Text style={s.text}>Proficiency: +{stats.proficiency} at level {hero.level}.</Text>
      </View>}
      <HealthTracker maximum={stats.hp} health={health} setHealth={setHealth} readOnly={true}/>
    </> : <Text style={s.gold}>{stats.reason}</Text>}
    {['age','backstory','connections','ideals','bonds','flaws'].map(key=>hero[key]?<View key={key}><Text style={s.section}>{key.charAt(0).toUpperCase()+key.slice(1)}</Text><Text style={s.text}>{hero[key]}</Text></View>:null)}
    {!!hero.description && <><Text style={s.section}>Appearance & personality</Text><Text style={s.text}>{hero.description}</Text></>}
    </>}
    {tab==='Spells'&&<><MagicPanel hero={hero} game={game}/>{!hero.spells?.length&&<Text style={s.caption}>Granted spells, if any, appear above. Choose prepared spells during character creation or advancement.</Text>}</>}
    {tab==='Skills & Abilities'&&<>
    <SkillPanel hero={hero} game={game} setGame={setGame} locked={healthLocked||game.stage==='combat'||!!game.pendingSpell}/>
    <FeaturePanel hero={hero}/>
    <Text style={s.section}>Ability scores</Text>
    {hero.scores ? <View style={s.grid}>{abilities.map(name => tile(name,hero.scores[name],`Modifier ${signed(modifier(hero.scores[name]))}`))}</View> : <Text style={s.text}>Complete character creation to add your abilities.</Text>}
    </>}
    {tab==='Inventory'&&<>
    <Text style={s.section}>Starting equipment</Text>
    {hero.equipment ? <>
      <LoadoutSummary hero={hero}/>
      {hero.equipment.items.map(item => <View key={item.name} style={s.item}><Text style={[s.text,{flex:1}]}>{item.name}</Text><Text style={s.gold}>×{item.quantity}</Text></View>)}
      <Text style={s.gold}>Starting gold: {hero.equipment.totalGold} GP</Text>
      <Text style={s.caption}>Class kit: {hero.equipment.classGold} GP · Background: {hero.equipment.backgroundGold} GP</Text>
    </> : <Text style={s.text}>Review and save equipment through Character Selection to add your starter kit.</Text>}
    <Text style={s.gold}>Quest earnings: {earnedGold(game)} GP</Text>
    <Text style={s.gold}>Total gold: {(hero.equipment?.totalGold??0)+earnedGold(game)} GP</Text>
    <Text style={s.text}>Healing draughts remaining: {game.potions??0}</Text>
    {campaignState(game).lensQuest==='found'&&<Text style={s.text}>Quest item: signal lens</Text>}
    {game.dungeon?.complete&&<Text style={s.text}>Quest relic: Lantern Heart</Text>}
    <Text style={s.caption}>Describe item use to the DM. Gear changes and shopping are not automated yet.</Text>
    </>}
    <GameButton variant="primary" label="‹ Back to adventure" onPress={onBack} style={{marginTop:24}}/>
  </View>;
}
const s = StyleSheet.create({overline:{...type.label},name:{fontFamily:fonts.display,color:colors.parchment,fontSize:34,fontWeight:'700',letterSpacing:1,marginTop:6,marginBottom:6},subtitle:{fontFamily:fonts.ui,color:colors.gold,fontSize:15,lineHeight:24,letterSpacing:.4},
 gold:{fontFamily:fonts.ui,color:'#dfc18e',fontSize:14,lineHeight:23,marginVertical:8},grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginVertical:16},
 tile:{flexBasis:145,flexGrow:1,padding:16,borderRadius:4,borderWidth:1,borderColor:colors.goldLine,alignItems:'center'},
 label:{...type.label,fontSize:10,textAlign:'center'},value:{fontFamily:fonts.display,color:colors.gold,fontSize:36,fontWeight:'800',marginVertical:6},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginTop:6},center:{textAlign:'center'},
 section:{fontFamily:fonts.display,color:colors.parchment,fontSize:19,fontWeight:'700',letterSpacing:1,marginTop:20,marginBottom:10},
 panel:{padding:16,backgroundColor:'rgba(255,236,190,.03)',borderWidth:1,borderColor:'rgba(201,164,92,.2)',borderRadius:3,marginVertical:10},
 text:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:17,lineHeight:27},
 item:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.15)'},
 tab:{paddingHorizontal:16,paddingVertical:11,minHeight:44,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'rgba(20,25,36,.9)',justifyContent:'center',flexGrow:1},
 tabActive:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},tabText:{fontFamily:fonts.display,color:'#ecdcb8',fontSize:12,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase',textAlign:'center'},
 secondary:{backgroundColor:'#1a202d',borderWidth:1,borderColor:'rgba(201,164,92,.35)',borderRadius:3,padding:14,minHeight:48,marginVertical:8,justifyContent:'center'},
 buttonText:{fontFamily:fonts.display,color:colors.parchment,fontWeight:'700',letterSpacing:1.4,fontSize:13,textTransform:'uppercase',textAlign:'center'}});
