import {characterDraftContext,validateCharacterDraft} from './characterDraft';
import {findDmEndpoint,askDm} from './dmConnection';
import {subclassOptions} from './subclassOptions';
import SpellSelector from './SpellSelector';
import {spellsForClass,spellSelectionError} from './spellOptions';
import { equipmentFor, instruments } from './equipmentRules';
import LoadoutSummary from './LoadoutSummary';
import StoryLoading from './StoryLoading';
import React, {useState} from 'react';
import {View, Text, TextInput, Pressable, StyleSheet, Modal} from 'react-native';
import {fonts,colors,type} from './theme';
import {Crest} from './ui';
import Icon from './Icon';
import {classIcons} from './iconPaths';
import {playSound} from './audio';
import {abilities, standardArray, species, classes, backgrounds, finalScores, modifier, buildError} from './characterRules';
import {speciesDetails, classDetails, backgroundDescriptions, abilityDescriptions} from './characterOptions';

const basePages = [
  {title: 'Name & appearance', intro: 'Start with the person you want to play. Give them a name, then describe any appearance, personality, or story details you have in mind. You can return and change these before saving.'},
  {title: 'Choose your species', intro: 'Species describes your character’s ancestry and natural traits. It does not decide your personality or limit your class. In our 2024 game, ability-score bonuses come from your background.'},
  {title: 'Choose your class', intro: 'Class is your adventuring training: how you handle danger, use magic, or help the party. Choose the style you want to play. The suggested abilities are guidance for the ability-score page.'},
  {title: 'Choose your subclass', intro: 'A subclass is a specialized path within your class. New heroes begin at level 1; subclass features unlock at level 3. You can save a future direction now or decide later. This choice does not add abilities or spells yet.'},
  {title: 'Choose your background', intro: 'Background describes life before adventuring. It supplies the three abilities you can improve and a starting talent called an Origin feat. Any background can be paired with any class.'},
  {title: 'Shape your abilities', intro: 'These six scores describe your character’s strengths. Assign each starting number once, then apply your background increases. The modifier is the number added to relevant dice rolls.'},
  {title: 'Your starting equipment', intro: 'Your class provides a ready-made starter kit. Review what you will carry, then continue. Background equipment uses the 50 GP option for this simple starting setup.'},
  {title: 'Choose your first spells', intro: 'Choose the magic your character brings into the adventure. Cantrips do not use spell slots. Prepared spells use limited slots. Read each spell to understand its effect, range, and requirements.'},
  {title: 'Review your character', intro: 'Check your choices before saving. Use Edit to revisit a page. New characters start at level 1 and level up by winning their battles.'},
];
export default function CharacterBuilder({form, setForm, onSave, saving, blocked, saveError, hasSavedCharacter, onPageChange}) {
  const spellOptions=spellsForClass(form.class);
  const isCaster=spellOptions.length>0;
  const pages=isCaster?basePages:basePages.filter((_,index)=>index!==7);
  const reviewPage=pages.length-1;
  const [page, setPage] = useState(0);
  const [pageError, setPageError] = useState('');
  const [generating,setGenerating]=useState(false),[idea,setIdea]=useState('');
  async function generateHero(){if(generating)return;setGenerating(true);setPageError('');try{
    let repair='';
    for(let attempt=0;attempt<2;attempt++){
      const endpoint=await findDmEndpoint();
      const {ok,body:result}=await askDm(endpoint,{input:idea.trim()||'Surprise me with a complete hero.',context:{...characterDraftContext(),validationFeedback:repair}});
      if(!ok)throw Error(result.error||'Generation failed.');
      try{const draft=validateCharacterDraft(result.draft);setForm(draft);setPage(0);return;}catch(e){repair=e.message;if(attempt===1)throw e;}
    }
  }catch(e){setPageError(e.message);}finally{setGenerating(false);}}

  const change = patch => {setPageError(''); setForm(previous => ({...previous, ...patch}));};
  const go = next => {setPageError(''); setPage(next); onPageChange?.();};
  const scores = finalScores(form);
  const bg = backgrounds[form.background];
  function next() {
    const errors = [!form.name.trim() ? 'Enter your character’s name to continue.' : '', !species.includes(form.species) ? 'Choose a species to continue.' : '', !classes.includes(form.class) ? 'Choose a class to continue.' : '', '', !bg ? 'Choose a background to continue.' : '', buildError(form), '', spellSelectionError(form)];
    if (errors[page]) {setPageError(errors[page]); return;}
    go(page + 1);
  }
  const action = (label, onPress, secondary = false, disabled = false, icon = null) => <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} dataSet={{qb:secondary?'btn':'btn-primary'}} style={({pressed}) => [s.action, secondary && s.secondary, (disabled || pressed) && {opacity: 0.6}]}><View style={s.actionRow}>{!!icon&&<Icon name={icon} size={16} color={secondary?colors.gold:'#2a1a07'}/>}<Text style={[s.actionText,!secondary&&{color:'#2a1a07'}]}>{label}</Text></View></Pressable>;
  function optionCards(label, options, value, onSelect, details) {
    return <View style={s.cards}>{options.map(option => {
      const detail = details[option];
      const chosen = value === option, crest = label==='Class' ? classIcons[option] : label==='Background' ? 'scroll' : label==='Subclass' ? 'star' : null;
      return <Pressable key={option} accessibilityRole="button" accessibilityLabel={`${label}: ${option}`} accessibilityState={{selected: chosen}} onPress={() => {if(!chosen)playSound('select');onSelect(option);}} dataSet={{qb:'card',selected:String(chosen)}} style={({pressed}) => [s.option, chosen && s.selected, pressed && {opacity: 0.85}]}>
        <View style={s.cardTitle}>{!!crest&&<Crest icon={crest} size={40}/>}<Text style={[s.optionTitle,{flex:1}]}>{option === 'Dark Elf' ? 'Dark Elf (Drow)' : option}</Text>{chosen && <View style={s.check}><Icon name="check" size={14} color="#1a0f05" strokeWidth={2.4}/></View>}</View>
        <Text style={s.text}>{detail.description}</Text>
        {!!detail.ability && <Text style={s.detail}>Key abilities: {detail.ability}</Text>}
        {!!detail.note && value === option && <Text style={s.detail}>{detail.note}</Text>}
      </Pressable>;
    })}</View>;
  }
  function choices(label, options, value, onSelect) {
    return <View><Text style={s.label}>{label}</Text><View style={s.row}>{options.map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`${label}: ${option}`} accessibilityState={{selected: value === option}} onPress={() => onSelect(option)} dataSet={{qb:value === option?'seg-on':'chip'}} style={[s.chip, value === option && s.selected]}><Text style={[s.text, value === option && {color:colors.goldBright,fontWeight:'700'}]}>{option}</Text></Pressable>)}</View></View>;
  }
  function scoreList() {
    return <View style={s.scoreGrid}>{abilities.map(name => <View key={name} dataSet={{qb:'plate'}} style={s.scoreTile}><Text style={s.scoreLabel}>{name}</Text><Text style={s.score}>{scores[name]}</Text><View style={s.modPill}><Text style={s.modText}>{modifier(scores[name]) >= 0 ? '+' : ''}{modifier(scores[name])}</Text></View></View>)}</View>;
  }
  const gear = classes.includes(form.class) ? equipmentFor(form) : null;
  function equipmentList() {
    if (!gear) return null;
    return <View>
      <Text style={s.label}>{form.class} starter kit</Text>
      <Text style={s.intro}>{gear.summary}</Text>
      <LoadoutSummary hero={{...form,equipment:gear}}/>
      {gear.items.map(item => <View key={item.name} style={s.reviewRow}><Text style={[s.text,{flex:1}]}>{item.name}</Text><Text style={s.selectedText}>×{item.quantity}</Text></View>)}
      <Text style={s.note}>Class kit gold: {gear.classGold} GP{'\n'}{form.background} background: {gear.backgroundGold} GP{'\n'}Starting total: {gear.totalGold} GP</Text>
    </View>;
  }
  function reviewRow(label, value, target) {
    return <View style={s.reviewRow}><View style={{flex:1}}><Text style={s.detail}>{label}</Text><Text style={s.optionTitle}>{value}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} onPress={() => go(target)} style={s.chip}><Text style={s.text}>Edit</Text></Pressable></View>;
  }
  return <View>
    <Modal transparent visible={generating} animationType="fade"><StoryLoading hero={idea}/></Modal>
    <View style={s.stepRow}><Text style={s.progress}>Step {page + 1} of {pages.length}</Text>{page < reviewPage && <Text style={s.nextHint}>Next: {pages[page+1].title}</Text>}</View>
    <View style={s.progressTrack}>{pages.map((item, i) => <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={'Step '+(i+1)+': '+item.title} disabled={i >= page} onPress={() => go(i)} style={s.progressHit}><View dataSet={{qb:i < page ? 'bar-gold' : undefined}} style={[s.progressSegment, i < page && {backgroundColor:'#d8b879'}, i === page && s.progressNow]}/></Pressable>)}</View>
    <Text accessibilityRole="header" style={s.heading}>{pages[page].title}</Text>
    <Text style={s.intro}>{pages[page].intro}</Text>
    {page === 0 && <>
      <Text style={s.label}>Let the Dungeon Master create your hero</Text>
      <Text style={s.detail}>Describe any species, class or features you want, or leave it open. The DM fills in identity, age, abilities, spells, starter equipment, and backstory. Review the draft before saving.</Text>
      <TextInput accessibilityLabel="Character generation preferences" value={idea} onChangeText={setIdea} maxLength={1000} multiline style={s.input} placeholder="A curious goblin artificer with a mysterious mentor…" placeholderTextColor="#a7adbd"/>
      {action(generating?'Creating your hero…':'Generate complete character',generateHero,false,generating||saving,generating?'quill':'spell')}

      <Text style={s.label}>Character name</Text><TextInput accessibilityLabel="Character name" style={s.input} value={form.name} onChangeText={name => change({name})} maxLength={60} placeholder="What should your companions call you?" placeholderTextColor="#a7adbd"/>
      <Text style={s.label}>Appearance & personality (optional)</Text><TextInput accessibilityLabel="Appearance and personality" multiline style={[s.input, {minHeight:120,textAlignVertical:'top'}]} value={form.description ?? ''} onChangeText={description => change({description})} maxLength={1500} placeholder="A green-skinned inventor with copper goggles and an endless list of questions…" placeholderTextColor="#a7adbd"/>
      {['age','backstory'].map(key=><View key={key}><Text style={s.label}>{key.charAt(0).toUpperCase()+key.slice(1)}</Text><TextInput accessibilityLabel={'Character '+key} value={form[key]??''} onChangeText={value=>change({[key]:value})} maxLength={key==='age'?60:2000} multiline={key!=='age'} editable={!generating} style={[s.input,key!=='age'&&{minHeight:80}]} /></View>)}
    </>}
    {page === 1 && optionCards('Species', species, form.species, value => change({species:value}), speciesDetails)}
    {page === 2 && optionCards('Class', classes, form.class, value => change(value===form.class ? {} : {class:value,level:1,advancements:[],arcanum:{},spells:[],spellbook:[],plannedSubclass:''}), classDetails)}
    {page === 3 && <>
      <Text style={s.note}>Planned subclass · Unlocks at level 3</Text>
      {!!form.plannedSubclass && !Object.hasOwn(subclassOptions[form.class]??{},form.plannedSubclass) && <Text style={s.note}>Saved path: {form.plannedSubclass}. You may keep it or choose one of the four paths below.</Text>}
      {choices('Subclass decision', ['Decide later'], form.plannedSubclass ? '' : 'Decide later', () => change({plannedSubclass:''}))}
      {optionCards('Subclass', Object.keys(subclassOptions[form.class]??{}), form.plannedSubclass??'', value=>change({plannedSubclass:value}), Object.fromEntries(Object.entries(subclassOptions[form.class]??{}).map(([name,description])=>[name,{description}])))}
      <Text style={s.detail}>Four community favorites, ordered by a March 2026 player poll. Powers unlock at level 3.</Text>
    </>}
    {page === 4 && <>
      <Text style={s.detail}>16 backgrounds · Select one to see its ability choices and starting feat.</Text>
      {optionCards('Background', Object.keys(backgrounds).sort(), form.background, value => {if(value !== form.background) change({background:value,plusTwo:'',plusOne:''});}, Object.fromEntries(Object.entries(backgrounds).map(([name, value]) => [name, {description:backgroundDescriptions[name], note:`Ability choices: ${value.abilities.join(', ')}. Origin feat: ${value.feat}.`}])))}
    </>}
    {page === 5 && <>
      <Text style={s.note}>Starting scores: 15, 14, 13, 12, 10, 8. Selecting a number already in use swaps those two scores.</Text>
      {classDetails[form.class] && <Text style={s.detail}>{form.class} key abilities: {classDetails[form.class].ability}.</Text>}
      {abilities.map((name, i) => <View key={name} style={s.abilityBlock}>
        <Text style={s.text}>{abilityDescriptions[name]}</Text>
        {choices(name, standardArray, form.baseScores[i], value => {const next = [...form.baseScores]; const other = next.indexOf(value); [next[i],next[other]] = [next[other],next[i]]; change({baseScores:next});})}
      </View>)}
      {bg && <>
        <Text style={s.label}>{form.background} increases</Text>
        <Text style={s.text}>Eligible abilities: {bg.abilities.join(', ')}.</Text>
        {choices('Bonus pattern', ['+2 and +1', '+1 to all three'], form.bonusMode === 'split' ? '+2 and +1' : '+1 to all three', value => change({bonusMode:value === '+2 and +1' ? 'split' : 'three'}))}
        {form.bonusMode === 'split' && <>{choices('+2 ability', bg.abilities, form.plusTwo, plusTwo => change({plusTwo,plusOne:plusTwo === form.plusOne ? '' : form.plusOne}))}{choices('+1 ability', bg.abilities.filter(a => a !== form.plusTwo), form.plusOne, plusOne => change({plusOne}))}</>}
      </>}
      <Text style={s.label}>Your final scores</Text>{scoreList()}
    </>}
    {page === 6 && <>
      {form.class === 'Fighter' && choices('Fighter kit', ['Melee','Ranged'], form.fighterKit === 'ranged' ? 'Ranged' : 'Melee', value => change({fighterKit:value.toLowerCase()}))}
      {['Bard','Monk'].includes(form.class) && <>{choices('Starter instrument', instruments, form.instrument ?? 'Flute', instrument => change({instrument}))}<Text style={s.detail}>A small starter selection. Detailed tool and instrument proficiencies will be handled with class features.</Text></>}
      {equipmentList()}
      <Text style={s.detail}>Packs contain your travel supplies. Armor and shields in your kit are equipped when your adventure starts; your other weapons and tools remain available in your inventory.</Text>
    </>}
    {isCaster && page === 7 && <SpellSelector form={form} onChange={change}/>}
    {page === reviewPage && <>
      {reviewRow('Name', form.name, 0)}
      {!!form.description && <Text style={s.intro}>{form.description}</Text>}{['age','backstory'].map(key=>form[key]?<View key={key}><Text style={s.label}>{key.charAt(0).toUpperCase()+key.slice(1)}</Text><Text style={s.text}>{form[key]}</Text></View>:null)}
      {reviewRow('Species', form.species === 'Dark Elf' ? 'Dark Elf (Drow)' : form.species, 1)}
      {reviewRow('Class', form.class, 2)}
      {reviewRow('Planned subclass', form.plannedSubclass || 'Decide at level 3', 3)}
      {reviewRow('Background', form.background, 4)}
      <Text style={s.note}>Origin feat: {bg?.feat}</Text>
      {reviewRow('Abilities', 'Final scores and modifiers', 5)}{scoreList()}{reviewRow('Equipment', 'Starter kit and gold', 6)}{equipmentList()}
      {isCaster && reviewRow('Spells',spellOptions.filter(spell=>form.spells?.includes(spell.id)).map(spell=>spell.name).join(', ') || 'None selected',7)}
      <Text style={s.note}>This saves your identity, abilities, starting gear and chosen spells. Everything stays on your character sheet, where you can review it during play.</Text>
      {hasSavedCharacter && <Text style={s.note}>One character slot: saving replaces the character currently saved on this device.</Text>}
      {!!saveError && <Text accessibilityRole="alert" style={s.error}>{saveError}</Text>}
    </>}
    {!!pageError && <Text accessibilityRole="alert" style={s.error}>{pageError}</Text>}
    <View style={s.navigation}>
      {page < reviewPage ? action(`Next: ${pages[page+1].title}`, next,false,generating,'forward') : action(saving ? 'Saving…' : 'Save character', onSave, false, saving || blocked, 'check')}
      {page > 0 && action('Previous step', () => go(page - 1), true, saving, 'back')}
    </View>
    <Text style={s.footnote}>Selections stay here while you move between pages. Save on the review page to keep them after closing the app.</Text>
  </View>;
}
const s = StyleSheet.create({
  stepRow:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10,marginBottom:10,flexWrap:'wrap'},
  progress:{...type.label},nextHint:{fontFamily:fonts.ui,fontSize:11.5,color:colors.faint},
  progressTrack:{flexDirection:'row',gap:5,marginBottom:24},progressHit:{flex:1,paddingVertical:6},progressSegment:{height:4,borderRadius:2,backgroundColor:'rgba(201,164,92,.18)'},
  progressNow:{backgroundColor:'rgba(232,199,123,.55)',height:6,marginTop:-1,borderWidth:1,borderColor:'rgba(255,240,196,.8)'},
  heading:{fontFamily:fonts.display,color:colors.parchment,fontSize:30,fontWeight:'700',letterSpacing:1,marginBottom:12},intro:{fontFamily:fonts.story,color:'#e2d8c0',fontSize:18,lineHeight:28,marginBottom:20},
  label:{fontFamily:fonts.display,color:colors.gold,fontSize:14,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase',marginTop:20,marginBottom:10},cards:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:16},
  option:{flexGrow:1,flexBasis:300,padding:16,backgroundColor:'rgba(20,25,37,.92)',borderWidth:1,borderColor:'rgba(201,164,92,.25)',borderRadius:6},selected:{borderColor:colors.gold,backgroundColor:'rgba(58,46,26,.92)'},
  cardTitle:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10},optionTitle:{fontFamily:fonts.display,color:colors.parchment,fontSize:19,fontWeight:'700',letterSpacing:.6},selectedText:{fontFamily:fonts.display,color:colors.gold,fontSize:12,fontWeight:'800',letterSpacing:1.4},
  check:{width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:colors.gold,borderWidth:1,borderColor:'#fff0c4'},
  text:{fontFamily:fonts.ui,color:'#dde1ea',fontSize:15,lineHeight:24},detail:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:21,marginTop:6},note:{fontFamily:fonts.ui,color:'#d9bd84',fontSize:14,lineHeight:23,marginVertical:12},
  input:{fontFamily:fonts.story,color:'#f5efe1',backgroundColor:'rgba(4,6,10,.75)',borderWidth:1,borderColor:'rgba(201,164,92,.4)',borderRadius:4,padding:14,fontSize:17},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingVertical:10,paddingHorizontal:14,minWidth:48,minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:'#1a202d',borderWidth:1,borderColor:'rgba(201,164,92,.35)',borderRadius:22},
  abilityBlock:{marginVertical:10,paddingBottom:16,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.15)'},scoreGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginVertical:16},
  scoreTile:{flexGrow:1,flexBasis:100,borderWidth:1,borderColor:colors.goldLine,paddingVertical:12,paddingHorizontal:8,borderRadius:6,alignItems:'center'},
  scoreLabel:{fontFamily:fonts.display,fontSize:10,fontWeight:'700',letterSpacing:1.6,color:colors.goldMid,textTransform:'uppercase'},
  score:{fontFamily:fonts.display,fontSize:34,color:colors.goldBright,fontWeight:'800',marginVertical:2},
  modPill:{paddingHorizontal:10,paddingVertical:2,borderRadius:10,borderWidth:1,borderColor:'rgba(232,199,123,.5)',backgroundColor:'rgba(58,46,26,.6)'},modText:{fontFamily:fonts.ui,fontSize:12.5,fontWeight:'700',color:colors.gold},
  reviewRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'rgba(201,164,92,.15)'},
  navigation:{gap:10,marginTop:28},action:{padding:16,minHeight:52,backgroundColor:'#d9ae5f',borderWidth:1,borderColor:'#fff0c4',borderRadius:4,justifyContent:'center'},secondary:{backgroundColor:'#1a202d',borderColor:'rgba(201,164,92,.35)'},
  actionRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
  actionText:{fontFamily:fonts.display,color:colors.parchment,fontSize:14,fontWeight:'800',letterSpacing:1.8,textTransform:'uppercase',textAlign:'center'},error:{fontFamily:fonts.ui,color:colors.danger,fontSize:15,lineHeight:23,marginTop:16},footnote:{fontFamily:fonts.ui,color:colors.faint,fontSize:12,lineHeight:19,marginTop:16},
});