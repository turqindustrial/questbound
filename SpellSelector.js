import React,{useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {fonts,colors} from './theme';
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
    <View style={s.row}>{groups.map(([key,label,max])=><Pressable key={key} accessibilityRole="button" accessibilityState={{selected:active===key}} onPress={()=>{setTab(key);setSearch('');setError('');}} style={[s.tab,active===key&&s.selected]}><Text style={s.text}>{label} {count(key)}/{max}</Text></Pressable>)}</View>
    <TextInput accessibilityLabel="Search spells" placeholder="Search by spell name or school" placeholderTextColor="#aab3c7" value={search} onChangeText={setSearch} style={s.input}/>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Text style={s.note}>{pool.length} eligible choices. {limits.book && active==='prepared'?'Choose your spellbook first, then prepare from it.':''}</Text>
    {visible.map(spell=>{const chosen=(active==='book'?book:selected).includes(spell.id);return <View key={spell.id} style={[s.card,chosen&&s.selected]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Spell: ${spell.name}`} accessibilityState={{selected:chosen}} onPress={()=>toggle(spell)} style={s.select}><Text style={s.title}>{spell.name}{chosen?' · Selected':''}</Text><Text style={s.note}>{spell.kind} · {spell.school} · {spell.castingTime}{spell.concentration?' · Concentration':''}{spell.ritual?' · Ritual':''}</Text></Pressable>
      <Text style={s.text}>{spell.description.replace(/[*_]/g,'').split('\n')[0].slice(0,200)}{spell.description.length>200?'…':''}</Text>
      <Text style={s.note}>Cost: {spell.level===0?'No spell slot':`One level ${spell.level} or higher slot`}{spell.ritual?' · Ritual: no slot, 10 extra minutes':''} · {spell.castingTime}. Components: {spell.components}{spell.material?` — ${spell.material}`:''}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${expanded===spell.id?'Hide':'Read'} ${spell.name} details`} onPress={()=>setExpanded(expanded===spell.id?null:spell.id)} style={s.details}><Text style={s.text}>{expanded===spell.id?'Hide details':'Read full spell'}</Text></Pressable>
      {expanded===spell.id && <View><Text style={s.text}>Range: {spell.range} · Duration: {spell.duration}{'\n'}Components: {spell.components}{spell.material?` (${spell.material})`:''}</Text><Text style={s.text}>{spell.description.replace(/[*_]/g,'')}</Text>{!!spell.higherLevel&&<Text style={s.text}>{spell.higherLevel}</Text>}</View>}
    </View>;})}
    {!visible.length && <Text style={s.text}>No spells match this view.</Text>}
  </View>;
}
const s=StyleSheet.create({note:{fontFamily:fonts.ui,color:'#d9bd84',fontSize:13,lineHeight:21,marginVertical:8},text:{fontFamily:fonts.ui,color:'#dde1ea',fontSize:15,lineHeight:24},row:{flexDirection:'row',flexWrap:'wrap',gap:8},tab:{padding:12,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'#1a202d',borderRadius:3,minHeight:48,justifyContent:'center'},selected:{backgroundColor:'rgba(58,46,26,.92)',borderColor:colors.gold},input:{fontFamily:fonts.ui,color:'#f5efe1',backgroundColor:'rgba(4,6,10,.75)',fontSize:16,padding:14,borderWidth:1,borderColor:'rgba(201,164,92,.4)',borderRadius:3,marginTop:16},card:{padding:16,borderRadius:4,borderWidth:1,borderColor:'rgba(201,164,92,.25)',backgroundColor:'rgba(14,18,28,.9)',marginTop:12},title:{fontFamily:fonts.display,color:colors.parchment,fontSize:18,fontWeight:'700',letterSpacing:.6},select:{minHeight:48},details:{paddingVertical:12,minHeight:48},error:{fontFamily:fonts.ui,color:colors.danger,marginVertical:10}});
