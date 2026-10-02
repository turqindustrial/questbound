import React,{useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {fonts,colors} from './theme';
import {abilities,advancementLevels,finalScores,buildError,makeCharacter} from './characterRules';
import {subclassOptions} from './subclassOptions';
import {spellLimits,spellSelectionError,spellLibrary} from './spellOptions';
import {combatBasics} from './combatRules';
import SpellSelector from './SpellSelector';
import FeaturePanel from './FeaturePanel';
import {GameButton,Crest,Section} from './ui';
import Icon from './Icon';
import {classIcons} from './iconPaths';
import HeroPortrait from './HeroPortrait';

export default function Advancement({hero,onSave,onCancel,saving,error}) {
  const nextLevel=Math.min(20,hero.level+1);
  const [draft,setDraft]=useState(()=>({...hero,level:nextLevel,advancementVersion:1})),[localError,setLocalError]=useState('');
  const improve=advancementLevels(hero.class).includes(nextLevel);
  const [first,setFirst]=useState(''),[second,setSecond]=useState('');
  const form={...draft,advancements:[...(hero.advancements??[]),...(improve&&first&&second?[{level:nextLevel,abilities:[first,second]}]:[])]};
  const preview={...form,scores:finalScores(form)},stats=combatBasics(preview),before=combatBasics(hero);
  const button=(label,fn,active=false)=><Pressable key={label} accessibilityRole="button" disabled={saving} accessibilityState={{selected:active,disabled:saving}} onPress={fn} dataSet={{qb:active?'seg-on':'chip'}} style={[s.button,active&&s.active]}><View style={s.buttonRow}>{active&&<Icon name="check" size={14} color={colors.goldBright}/>}<Text style={[s.text,active&&{color:colors.goldBright,fontWeight:'700'}]}>{label}</Text></View></Pressable>;
  async function finish(){
    const problem=(improve&&(!first||!second)?'Choose both ability improvements.':'') || (nextLevel>=3&&!form.plannedSubclass?'Choose your subclass.':'') || buildError(form) || spellSelectionError(form);
    if(problem){setLocalError(problem);return;}
    setLocalError('');await onSave(makeCharacter(form));
  }
  return <View>
    <View dataSet={{qb:'plate'}} style={s.levelCard}>
      <HeroPortrait hero={hero} size={64} level={hero.level}/>
      <Icon name="forward" size={22} color={colors.gold}/>
      <View style={s.newLevel}><Text style={s.newLevelLabel}>Level</Text><Text dataSet={{qb:'title',lig:'off'}} style={s.newLevelValue}>{nextLevel}</Text></View>
      <View style={s.gains}>
        <View style={s.gain}><Icon name="heart" size={14} color={colors.heal}/><Text style={s.gainText}>Max HP {before.hp} → <Text style={s.gainUp}>{stats.hp}</Text></Text></View>
        <View style={s.gain}><Icon name="star" size={14} color={colors.gold}/><Text style={s.gainText}>Proficiency +{before.proficiency} → <Text style={s.gainUp}>+{stats.proficiency}</Text></Text></View>
      </View>
    </View>
    <Text style={s.text}>You have earned a new level. Review your choices, then return to your adventure rested. You remain a {hero.class}. Hit points rise by your class’s fixed average.</Text>
    {nextLevel>=3 && (!hero.plannedSubclass || hero.level<3) && <>
      <Text style={s.heading}>Choose your subclass</Text>
      {Object.entries(subclassOptions[hero.class]).map(([name,description])=><View key={name}>{button(name,()=>setDraft({...draft,plannedSubclass:name}),draft.plannedSubclass===name)}<Text style={s.caption}>{description}</Text></View>)}
    </>}
    {improve&&<><Text style={s.heading}>Ability score improvement</Text><Text style={s.caption}>Choose twice: +2 to one ability or +1 to two abilities, up to 20.</Text>{[[first,setFirst],[second,setSecond]].map(([chosen,setChosen],index)=><View key={index}><Text style={s.text}>Improvement {index+1}</Text><View style={s.row}>{abilities.map(a=>button(a,()=>setChosen(a),chosen===a))}</View></View>)}</>}
    {!!spellLimits(form)&&<><Text style={s.heading}>Review your spells</Text><SpellSelector form={form} onChange={patch=>setDraft(previous=>({...previous,...patch}))}/></>}
    {hero.class==='Warlock' && nextLevel>=11 && <>
      <Text style={s.heading}>Mystic Arcanum</Text>
      {[6,7,8,9].filter(level=>nextLevel>=2*level-1).map(level=><View key={level}><Text style={s.caption}>One level {level} spell, once per long rest</Text>{spellLibrary.filter(spell=>spell.level===level&&spell.classes.includes('Warlock')).map(spell=>button(spell.name,()=>setDraft(previous=>({...previous,arcanum:{...previous.arcanum,[level]:spell.id}})),draft.arcanum?.[level]===spell.id))}</View>)}
    </>}
    <FeaturePanel hero={preview}/>
    {!!(error||localError)&&<Text accessibilityRole="alert" style={s.error}>{error||localError}</Text>}
    <GameButton variant="primary" icon="star" label={saving?'Saving…':'Confirm level '+nextLevel} disabled={saving} onPress={finish}/>
    <GameButton icon="back" label="Back to the adventure" disabled={saving} onPress={onCancel}/>
  </View>;
}
const s=StyleSheet.create({levelCard:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:16,padding:18,borderRadius:6,borderWidth:1,borderColor:'rgba(224,74,92,.5)',marginBottom:14},
 newLevel:{alignItems:'center'},newLevelLabel:{fontFamily:fonts.display,fontSize:10,letterSpacing:2.4,color:colors.goldMid,textTransform:'uppercase'},newLevelValue:{fontFamily:fonts.logo,fontSize:48,lineHeight:56,fontWeight:'900',color:colors.gold},
 gains:{flexGrow:1,gap:6,minWidth:180},gain:{flexDirection:'row',alignItems:'center',gap:8},gainText:{fontFamily:fonts.ui,fontSize:14,color:'#e2dde1'},gainUp:{fontWeight:'800',color:colors.goldBright},buttonRow:{flexDirection:'row',alignItems:'center',gap:8},
 heading:{fontFamily:fonts.display,fontSize:20,color:colors.gold,fontWeight:'700',letterSpacing:1.2,marginTop:22,marginBottom:8,textTransform:'uppercase'},text:{fontFamily:fonts.ui,color:'#e6e1e5',fontSize:15,lineHeight:24},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:22,marginVertical:10},button:{backgroundColor:'#271e29',borderColor:'rgba(178,34,58,.35)',borderWidth:1,borderRadius:22,paddingVertical:10,paddingHorizontal:16,minHeight:44,marginTop:8,justifyContent:'center'},active:{borderColor:'rgba(224,74,92,.7)',backgroundColor:'rgba(48,26,78,.92)'},row:{flexDirection:'row',flexWrap:'wrap',gap:8},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:12}});
