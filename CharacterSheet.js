import {EntityText as Text} from './EncounterOverlay';
import SkillPanel from './SkillPanel';
import MagicPanel from './MagicPanel';
import {campaignState} from './campaignRules';
import {packOf} from './inventoryRules';
import {spellDefense} from './spellRules';
import FeaturePanel from './FeaturePanel';
import React, {useState} from 'react';
import LoadoutSummary from './LoadoutSummary';
import {View, Text as PlainText, Pressable, StyleSheet, useWindowDimensions} from 'react-native';
import {abilities, modifier} from './characterRules';
import {combatBasics, signed} from './combatRules';
import HealthTracker from './HealthTracker';
import {GameButton,Crest,Segmented,Section,StatBar} from './ui';
import Icon from './Icon';
import {classIcons} from './iconPaths';
import HeroPortrait from './HeroPortrait';
import {fonts,colors,type} from './theme';

export default function CharacterSheet({hero, game, onBack, health, setHealth, healthLocked, setGame}) {
  const [tab,setTab]=useState('Overview');
  const [showCalculations,setShowCalculations] = useState(false);
  const stats = combatBasics(hero);
  const hp=health?.current??stats.hp;
  const {width}=useWindowDimensions(),narrow=width<520,longest=Math.max(6,...String(hero.name).split(/\s+/).map(w=>w.length));
  const nameSize=Math.max(18,Math.min(28,Math.floor((width-150)/(longest*.7))));
  const tile = (label,value,description,icon) => <View key={label} dataSet={{qb:'plate'}} style={s.tile}><View style={s.tileHead}>{!!icon&&<Icon name={icon} size={14} color={colors.goldMid}/>}<PlainText style={s.label}>{label}</PlainText></View><PlainText style={s.value}>{value}</PlainText><Text style={[s.caption,s.center]}>{description}</Text></View>;
  return <View>
    <View style={[s.header,narrow&&{gap:14}]}>
      <HeroPortrait hero={hero} size={narrow?56:72} level={hero.level}/>
      <View style={{flex:1,minWidth:0}}>
        <PlainText style={s.overline}>Character sheet</PlainText>
        {/* On a phone the name is set a size that lets its longest word fit the line. */}
        <PlainText numberOfLines={2} style={[s.name,narrow&&{fontSize:nameSize,lineHeight:Math.round(nameSize*1.2)}]}>{hero.name}</PlainText>
        <Text style={s.subtitle}>Level {hero.level} · {hero.species ?? hero.race} · {hero.class}</Text>
        {!!hero.background && <View style={s.tags}><View style={s.tag}><Icon name="scroll" size={12} color={colors.gold}/><Text style={s.tagText}>{hero.background}</Text></View>{!!hero.originFeat&&<View style={s.tag}><Icon name="star" size={12} color={colors.gold}/><Text style={s.tagText}>{hero.originFeat}</Text></View>}</View>}
      </View>
    </View>
    {stats.available&&<View style={s.hpBlock}><Icon name="heart" size={16} color={hp/Math.max(1,stats.hp)<=.3?colors.bloodBright:colors.heal}/><View style={{flex:1}}><StatBar value={hp} maximum={stats.hp} height={10}/></View><PlainText style={s.hpText}>{hp}<PlainText style={s.hpMax}> / {stats.hp} HP</PlainText></PlainText></View>}
    {!!hero.plannedSubclass && <Text style={s.caption}>{hero.level>=3?'Subclass':'Planned subclass'}: {hero.plannedSubclass}{hero.level<3?' · Unlocks at level 3':''}</Text>}
    <Segmented value={tab} onChange={setTab} options={[['Overview','Overview','sheet'],['Spells','Spells','spell'],['Skills & Abilities','Skills','star'],['Inventory','Inventory','bag']]}/>
    {tab==='Overview'&&<>
    {stats.available ? <>
      <View style={s.grid}>
        {tile('Maximum HP',stats.hp,'Your hit-point maximum at this level','heart')}
        {tile('Armor class',spellDefense(game,stats.ac).ac ?? '—',spellDefense(game,stats.ac).ac!==stats.ac?'Includes active spell protection':'From your armor and gear','shield')}
        {tile('Initiative',signed(stats.initiative),'Add this to your initiative d20','bolt')}
        {tile('Proficiency',signed(stats.proficiency),'Bonus for trained abilities','star')}
      </View>
      <View dataSet={{qb:'plate'}} style={s.panel}><Section icon="shield" title="Defense" style={{marginTop:0}}/><Text style={s.text}>{stats.defense}</Text><Text style={s.caption}>With your armor worn and any shield on your arm. A protective spell in effect is counted in the armor class above.</Text>{!!stats.armorNote && <Text style={s.gold}>{stats.armorNote}</Text>}</View>
      <GameButton icon="info" label={showCalculations ? 'Hide calculations' : 'How are these calculated?'} onPress={() => setShowCalculations(!showCalculations)}/>
      {showCalculations && <View dataSet={{qb:'plate'}} style={s.panel}>
        <Text style={s.text}>Maximum HP: {stats.hpFormula} = {stats.hp}</Text>
        <Text style={s.text}>Hit Point Die: {stats.hitDie}</Text>
        <Text style={s.text}>Armor class: {stats.ac === null ? 'Equipment not saved yet.' : `${stats.acFormula}${spellDefense(game,stats.ac).ac!==stats.ac?' + 2 Shield of Faith':''} = ${spellDefense(game,stats.ac).ac}`}</Text>
        <Text style={s.text}>Initiative: {stats.initiativeFormula} = {signed(stats.initiative)}</Text>
        <Text style={s.text}>Proficiency: +{stats.proficiency} at level {hero.level}.</Text>
      </View>}
      <HealthTracker maximum={stats.hp} health={health} setHealth={setHealth} readOnly={true}/>
    </> : <Text style={s.gold}>{stats.reason}</Text>}
    {['age','backstory','connections','ideals','bonds','flaws'].map(key=>hero[key]?<View key={key}><Section title={key.charAt(0).toUpperCase()+key.slice(1)}/><Text style={s.text}>{hero[key]}</Text></View>:null)}
    {!!hero.description && <><Section title="Appearance & personality"/><Text style={s.text}>{hero.description}</Text></>}
    </>}
    {tab==='Spells'&&<><MagicPanel hero={hero} game={game}/>{!hero.spells?.length&&<Text style={s.caption}>No spells chosen. Heroes who cast pick their spells when they are made and again as they gain levels; spells granted by a feature are listed above.</Text>}</>}
    {tab==='Skills & Abilities'&&<>
    <Section icon="star" title="Ability scores" style={{marginTop:4}}/>
    {hero.scores ? <View style={s.grid}>{abilities.map(name => <View key={name} dataSet={{qb:'plate'}} accessibilityLabel={name+' '+hero.scores[name]} style={s.ability}><PlainText numberOfLines={1} style={s.label}>{narrow?name.slice(0,3):name}</PlainText><PlainText style={s.abilityValue}>{hero.scores[name]}</PlainText><View style={s.modPill}><PlainText style={s.modText}>{signed(modifier(hero.scores[name]))}</PlainText></View></View>)}</View> : <Text style={s.text}>Complete character creation to add your abilities.</Text>}
    <SkillPanel hero={hero} game={game} setGame={setGame} locked={healthLocked||game.stage==='combat'||!!game.pendingSpell}/>
    <FeaturePanel hero={hero}/>
    </>}
    {tab==='Inventory'&&<>
    <Section icon="bag" title="Starting equipment" style={{marginTop:4}}/>
    {hero.equipment ? <>
      <LoadoutSummary hero={hero}/>
      {hero.equipment.items.map(item => <View key={item.name} style={s.item}><Icon name="bag" size={14} color={colors.goldMid}/><Text style={[s.text,{flex:1}]}>{item.name}</Text><PlainText style={s.qty}>×{item.quantity}</PlainText></View>)}
    </> : <Text style={s.text}>Review and save equipment through Character Selection to add your starter kit.</Text>}
    <View style={s.purse}>
      <View style={s.purseCell}><Icon name="coin" size={18} color={colors.gold}/><View><PlainText style={s.label}>Gold now</PlainText><PlainText style={s.purseValue}>{packOf(game,hero).gold} GP</PlainText></View></View>
      <View style={s.purseCell}><Icon name="potion" size={18} color={colors.heal}/><View><PlainText style={s.label}>Healing draughts</PlainText><PlainText style={s.purseValue}>{game.potions??0}</PlainText></View></View>
    </View>
    <Text style={s.caption}>Starting gold {hero.equipment?.totalGold??0} GP (class kit {hero.equipment?.classGold??0}, background {hero.equipment?.backgroundGold??0}).</Text>
    {campaignState(game).lensQuest==='found'&&<View style={s.item}><Icon name="gem" size={14} color={colors.gold}/><Text style={s.text}>Quest item: signal lens</Text></View>}
    {game.dungeon?.complete&&<View style={s.item}><Icon name="gem" size={14} color={colors.gold}/><Text style={s.text}>Quest relic: Lantern Heart</Text></View>}
    <Text style={s.caption}>This is the kit your hero set out with. What you find, buy, sell and take in hand along the way is under Inventory in the adventure.</Text>
    </>}
    <GameButton variant="primary" icon="back" label="Back to adventure" onPress={onBack} style={{marginTop:24}}/>
  </View>;
}
const s = StyleSheet.create({overline:{...type.label},name:{fontFamily:fonts.display,color:colors.parchment,fontSize:32,lineHeight:38,fontWeight:'700',letterSpacing:1,marginTop:4},subtitle:{fontFamily:fonts.ui,color:colors.gold,fontSize:14.5,lineHeight:22,letterSpacing:.4},
 header:{flexDirection:'row',alignItems:'center',gap:20,marginBottom:14},
 tags:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8},tag:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:3,borderRadius:12,borderWidth:1,borderColor:'rgba(201,164,92,.3)',backgroundColor:'rgba(0,0,0,.2)'},tagText:{fontFamily:fonts.ui,fontSize:12,color:'#e2d6bb'},
 hpBlock:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:6,borderWidth:1,borderColor:'rgba(111,191,142,.3)',backgroundColor:'rgba(10,20,16,.45)',marginBottom:4},
 hpText:{fontFamily:fonts.display,fontSize:18,fontWeight:'800',color:colors.parchment,fontVariant:['tabular-nums']},hpMax:{fontSize:12,color:colors.muted,fontWeight:'400'},
 gold:{fontFamily:fonts.ui,color:'#dfc18e',fontSize:14,lineHeight:23,marginVertical:8},grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginVertical:12},
 tile:{flexBasis:145,flexGrow:1,padding:16,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,alignItems:'center'},tileHead:{flexDirection:'row',alignItems:'center',gap:6},
 label:{...type.label,fontSize:10,textAlign:'center'},value:{fontFamily:fonts.display,color:colors.goldBright,fontSize:36,fontWeight:'800',marginVertical:4},
 ability:{flexBasis:96,flexGrow:1,paddingVertical:12,paddingHorizontal:8,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,alignItems:'center'},
 abilityValue:{fontFamily:fonts.display,color:colors.goldBright,fontSize:30,fontWeight:'800',marginVertical:2},
 modPill:{paddingHorizontal:10,paddingVertical:2,borderRadius:10,borderWidth:1,borderColor:'rgba(232,199,123,.5)',backgroundColor:'rgba(58,46,26,.6)'},modText:{fontFamily:fonts.ui,fontSize:12.5,fontWeight:'700',color:colors.gold},
 caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19,marginTop:6},center:{textAlign:'center'},
 panel:{padding:16,borderWidth:1,borderColor:'rgba(201,164,92,.22)',borderRadius:6,marginVertical:10},
 text:{fontFamily:fonts.story,color:'#e6dfcd',fontSize:17,lineHeight:27},
 item:{flexDirection:'row',gap:10,alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.15)'},qty:{fontFamily:fonts.display,fontSize:14,fontWeight:'700',color:colors.gold},
 purse:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:16},purseCell:{flexGrow:1,flexBasis:160,flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:6,borderWidth:1,borderColor:'rgba(201,164,92,.28)',backgroundColor:'rgba(0,0,0,.2)'},
 purseValue:{fontFamily:fonts.display,fontSize:20,fontWeight:'800',color:colors.parchment,marginTop:2},
});
