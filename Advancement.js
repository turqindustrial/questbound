import React,{useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {fonts,colors} from './theme';
import {abilities,advancementLevels,finalScores,buildError,makeCharacter} from './characterRules';
import {subclassOptions} from './subclassOptions';
import {spellLimits,spellSelectionError,spellLibrary} from './spellOptions';
import {combatBasics} from './combatRules';
import SpellSelector from './SpellSelector';
import FeaturePanel from './FeaturePanel';
import {GameButton} from './ui';

export default function Advancement({hero,onSave,onCancel,saving,error}) {
  const nextLevel=Math.min(20,hero.level+1);
  const [draft,setDraft]=useState(()=>({...hero,level:nextLevel,advancementVersion:1})),[localError,setLocalError]=useState('');
  const improve=advancementLevels(hero.class).includes(nextLevel);
  const [first,setFirst]=useState(''),[second,setSecond]=useState('');
  const form={...draft,advancements:[...(hero.advancements??[]),...(improve&&first&&second?[{level:nextLevel,abilities:[first,second]}]:[])]};
  const preview={...form,scores:finalScores(form)},stats=combatBasics(preview),before=combatBasics(hero);
  const button=(label,fn,active=false)=><Pressable key={label} accessibilityRole="button" disabled={saving} accessibilityState={{selected:active,disabled:saving}} onPress={fn} style={[s.button,active&&s.active]}><Text style={s.text}>{label}</Text></Pressable>;
  async function finish(){
    const problem=(improve&&(!first||!second)?'Choose both ability improvements.':'') || (nextLevel>=3&&!form.plannedSubclass?'Choose your subclass.':'') || buildError(form) || spellSelectionError(form);
    if(problem){setLocalError(problem);return;}
    setLocalError('');await onSave(makeCharacter(form));
  }
  return <View>
    <Text style={s.heading}>Your next level · {nextLevel}</Text>
    <Text style={s.text}>Your victory earns a new level. Review your choices, then return to your adventure rested. You remain a {hero.class}.</Text>
    <Text style={s.caption}>Maximum HP: {before.hp} → {stats.hp} · Proficiency: +{before.proficiency} → +{stats.proficiency}. Hit points rise by your class’s fixed average.</Text>
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
    <GameButton variant="primary" label={saving?'Saving…':'✦  Confirm level '+nextLevel} disabled={saving} onPress={finish}/>
    <GameButton label="‹  Back to the adventure" disabled={saving} onPress={onCancel}/>
  </View>;
}
const s=StyleSheet.create({heading:{fontFamily:fonts.display,fontSize:22,color:colors.gold,fontWeight:'700',letterSpacing:1,marginVertical:18},text:{fontFamily:fonts.ui,color:'#dde1ea',fontSize:15,lineHeight:24},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:22,marginVertical:10},button:{backgroundColor:'#1a202d',borderColor:'rgba(201,164,92,.35)',borderWidth:1,borderRadius:3,padding:13,minHeight:48,marginTop:8,justifyContent:'center'},active:{borderColor:colors.gold,backgroundColor:'rgba(58,46,26,.92)'},row:{flexDirection:'row',flexWrap:'wrap',gap:8},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:12}});
