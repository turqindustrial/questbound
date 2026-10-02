import React,{useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {fonts,colors,tint} from './theme';
import Icon from './Icon';
import {spellsForClass,spellLimits,automaticSpells,spellLibrary} from './spellOptions';

export default function SpellSelector({form,onChange}) {
  const [search,setSearch]=useState(''),[tab,setTab]=useState('cantrips'),[expanded,setExpanded]=useState(null),[error,setError]=useState('');
  const hero={...form,level:form.level??1},limits=spellLimits(hero),auto=automaticSpells(hero);
  const choices=spellsForClass(form.class,hero.level).filter(s=>!auto.includes(s.id));
  if(!limits)return null;
  const selected=form.spells??[],book=form.spellbook??[];
  const groups=[...(limits.cantrips?[['cantrips','Cantrips',limits.cantrips]]:[]),...(limits.book?[['book','Spellbook',limits.book]]:[]),['prepared','Prepared spells',limits.prepared]];
  const active=groups.some(g=>g[0]===tab)?tab:groups[0][0];
  const count=key=>key==='book'?book.length:choices.filter(s=>selected.includes(s.id) && (key==='cantrips'?s.level===0:s.level>0)).length;
  const maximum=groups.find(g=>g[0]===active)[2];
  const pool=choices.filter(s=>active==='cantrips'?s.level===0:s.level>0 && (active!=='prepared' || !limits.book || book.includes(s.id)));
  const visible=pool.filter(s=>`${s.name} ${s.school}`.toLowerCase().includes(search.toLowerCase()));
  function toggle(spell) {
    const ids=active==='book'?book:selected,has=ids.includes(spell.id);
    if(!has && count(active)>=maximum){setError(`You have selected all ${maximum}. Deselect one to choose another.`);return;}
    const next=has?ids.filter(id=>id!==spell.id):[...ids,spell.id];setError('');
    onChange(active==='book'?{spellbook:next,spells:has?selected.filter(id=>id!==spell.id):selected}:{spells:next});
  }
  return <View>
    <Text style={s.note}>Level {hero.level} {form.class}: choose {limits.cantrips} cantrips and prepare {limits.prepared} spells{limits.book?` from a ${limits.book}-spell book`:''}. Your level is set by the game.</Text>
    {!!auto.length && <Text style={s.note}>Included by your class: {auto.map(id=>spellLibrary.find(s=>s.id===id)?.name??id).join(', ')}. These do not use your selection allowance.</Text>}
    <View style={s.row}>{groups.map(([key,label,max])=><Pressable key={key} accessibilityRole="button" accessibilityState={{selected:active===key}} onPress={()=>{setTab(key);setSearch('');setError('');}} dataSet={{qb:active===key?'seg-on':'chip'}} style={[s.tab,active===key&&s.selected]}><Text style={[s.text,active===key&&{color:colors.goldBright,fontWeight:'700'}]}>{label} <Text style={{color:count(key)>=max?colors.heal:colors.muted}}>{count(key)}/{max}</Text></Text></Pressable>)}</View>
    <TextInput dataSet={{qb:'input'}} accessibilityLabel="Search spells" placeholder="Search by spell name or school" placeholderTextColor={tint('#beb3bb')} value={search} onChangeText={setSearch} style={s.input}/>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Text style={s.note}>{pool.length} eligible choices. {limits.book && active==='prepared'?'Choose your spellbook first, then prepare from it.':''}</Text>
    {visible.map(spell=>{const chosen=(active==='book'?book:selected).includes(spell.id);return <View key={spell.id} style={[s.card,chosen&&s.selected]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Spell: ${spell.name}`} accessibilityState={{selected:chosen}} onPress={()=>toggle(spell)} style={s.select}><View style={s.titleRow}><Icon name={chosen?'check':'spell'} size={15} color={chosen?colors.goldBright:colors.arcane}/><Text style={[s.title,{flex:1}]}>{spell.name}</Text>{chosen&&<Text style={s.chosen}>Selected</Text>}</View><Text style={s.note}>{spell.kind} · {spell.school} · {spell.castingTime}{spell.concentration?' · Concentration':''}{spell.ritual?' · Ritual':''}</Text></Pressable>
      <Text style={s.text}>{spell.description.replace(/[*_]/g,'').split('\n')[0].slice(0,200)}{spell.description.length>200?'…':''}</Text>
      <Text style={s.note}>Cost: {spell.level===0?'No spell slot':`One level ${spell.level} or higher slot`}{spell.ritual?' · Ritual: no slot, 10 extra minutes':''} · {spell.castingTime}. Components: {spell.components}{spell.material?` — ${spell.material}`:''}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${expanded===spell.id?'Hide':'Read'} ${spell.name} details`} onPress={()=>setExpanded(expanded===spell.id?null:spell.id)} style={s.details}><Text style={s.text}>{expanded===spell.id?'Hide details':'Read full spell'}</Text></Pressable>
      {expanded===spell.id && <View><Text style={s.text}>Range: {spell.range} · Duration: {spell.duration}{'\n'}Components: {spell.components}{spell.material?` (${spell.material})`:''}</Text><Text style={s.text}>{spell.description.replace(/[*_]/g,'')}</Text>{!!spell.higherLevel&&<Text style={s.text}>{spell.higherLevel}</Text>}</View>}
    </View>;})}
    {!visible.length && <Text style={s.text}>No spells match this view.</Text>}
  </View>;
}
const s=StyleSheet.create({note:{fontFamily:fonts.ui,color:tint('#c9aab2'),fontSize:13,lineHeight:21,marginVertical:8},text:{fontFamily:fonts.ui,color:tint('#e6e1e5'),fontSize:15,lineHeight:24},row:{flexDirection:'row',flexWrap:'wrap',gap:8},tab:{paddingVertical:10,paddingHorizontal:14,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('#271e29'),borderRadius:22,minHeight:44,justifyContent:'center'},titleRow:{flexDirection:'row',alignItems:'center',gap:8},chosen:{fontFamily:fonts.display,fontSize:10.5,fontWeight:'800',letterSpacing:1.4,color:colors.gold,textTransform:'uppercase'},selected:{backgroundColor:tint('rgba(48,26,78,.92)'),borderColor:colors.gold},input:{fontFamily:fonts.ui,color:'#f5efe1',backgroundColor:tint('rgba(8,5,9,.75)'),fontSize:16,padding:14,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),borderRadius:6,marginTop:16},card:{padding:16,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.25)'),backgroundColor:tint('rgba(24,17,25,.9)'),marginTop:12},title:{fontFamily:fonts.display,color:colors.parchment,fontSize:18,fontWeight:'700',letterSpacing:.6},select:{minHeight:48},details:{paddingVertical:12,minHeight:48},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:10}});
