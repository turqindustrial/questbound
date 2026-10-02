import React,{useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import Icon from './Icon';
import HeroPortrait from './HeroPortrait';
import {weaponIcon} from './iconPaths';
import {fonts,colors,type,tint} from './theme';
import {combatBasics,signed} from './combatRules';
import {attackOptions,readyLoadout,weapons} from './weaponRules';
import {gearedHero,packOf,arrowsLeft} from './inventoryRules';
import {itemDescription,goldDescription,draughtDescription,defenceText} from './descriptions';
import {playSound} from './audio';
// The Inventory tab: what the hero has equipped (weapon in hand, off hand, armour, bow, focus) around their
// portrait, then everything they carry. Every slot and every item explains itself when tapped, and a carried
// weapon can be taken in hand from here.
const damageOf=w=>w.flat?String(1+w.bonus):(w.count>1?w.count:1)+'d'+w.die+(w.bonus?(w.bonus>0?'+':'−')+Math.abs(w.bonus):'');
const kindIcon={weapon:'sword',ammunition:'bow',treasure:'gem',gear:'bag',quest:'key',potion:'potion'};
const kitIcon=name=>weapons[name]?weaponIcon(name):/Armor|Chain|Robe/.test(name)?'armor':name==='Shield'?'shield':/Focus|Holy Symbol/.test(name)?'spell':/book/i.test(name)?'book':/Lute|Flute|Drum/.test(name)?'lute':/Tools|Kit/.test(name)?'cog':name==='Arrow'||name==='Quiver'?'bow':'bag';
export default function Inventory({hero,game,onWield}){
 const [open,setOpen]=useState(null);
 const geared=gearedHero(hero,game),basics=combatBasics(hero),loadout=readyLoadout(geared),attacks=attackOptions(geared);
 const main=attacks.find(w=>!w.unarmed)??attacks[0],ranged=attacks.find(w=>w.ranged&&w.name!==main?.name)??null;
 const pack=packOf(game,hero),arrows=arrowsLeft(game,hero),draughts=game.potions??0;
 const twoHanded=!!main?.twoHands,offhand=loadout.shield?'Shield':null;
 // Equipment slots: [id, label, icon, name, stat, description].
 const slots=[
  ['main',main?.ranged?'In hand (ranged)':'Main hand',main?(main.unarmed?'fist':weaponIcon(main.name)):'hand',main?main.name:'Empty',main?damageOf(main)+' '+main.type.toLowerCase()+' · '+signed(main.attackBonus)+' to hit':'',main?(main.unarmed?'Your fists, feet and elbows. Everyone can fight unarmed.':itemDescription(main.name,'weapon')):'Nothing in hand.'],
  ['off','Off hand',offhand?'shield':'hand',offhand??(twoHanded?'Both hands on the '+main.name:'Free'),offhand?'+2 armor class':'',offhand?itemDescription('Shield'):twoHanded?'This weapon takes both hands.':'Your other hand is free: for a torch, a door, a spell’s gestures.'],
  ['armor','Armor','armor',loadout.armor??'No armor',basics.ac!==null?'Armor class '+basics.ac:'',(loadout.armor?itemDescription(loadout.armor)+' ':'You wear no armor. ')+(defenceText(hero)?'Your armor class: '+defenceText(hero)+'.':'')+(basics.armorNote?' '+basics.armorNote:'')],
  ...(ranged?[['ranged','Ranged',weaponIcon(ranged.name),ranged.name,damageOf(ranged)+' '+ranged.type.toLowerCase()+' · '+arrows+' arrows',itemDescription(ranged.name,'weapon')]]:[]),
  ...(loadout.focus?[['focus','Focus',/Lute|Flute|Drum/.test(loadout.focus)?'lute':'spell',loadout.focus.replace(/^(Arcane|Druidic) Focus \((.*)\)$/,'$2 focus'),'For your spells',itemDescription(loadout.focus)]]:[]),
 ];
 const shown=slots.find(sl=>sl[0]===open);
 // Everything carried: the starting kit with found weapons folded in, then what was found, bought or given.
 const equipped=new Set([main?.name,offhand,loadout.armor,ranged?.name,loadout.focus].filter(Boolean));
 const kit=(geared.equipment?.items??[]).filter(i=>i.quantity>0&&i.name!=='Arrow').map(i=>({key:'kit:'+i.name,name:i.name,qty:i.quantity,kind:weapons[i.name.includes('(Quarterstaff)')?'Quarterstaff':i.name]?'weapon':'gear',icon:kitIcon(i.name),weapon:weapons[i.name]?i.name:i.name.includes('(Quarterstaff)')?'Quarterstaff':null}));
 const found=pack.items.filter(i=>i.name!=='Arrow'&&!(i.kind==='weapon'&&weapons[i.name])).map(i=>({key:'pack:'+i.name,name:i.name,qty:i.qty,kind:i.kind,icon:kindIcon[i.kind]??'bag',note:i.note,value:i.value}));
 const row=item=>{const on=open===item.key,worn=equipped.has(item.name)||(item.weapon&&equipped.has(item.weapon)),usable=item.weapon&&attacks.some(w=>w.name===item.weapon),inHand=item.weapon&&main?.name===item.weapon;
  return <View key={item.key} style={[s.item,on&&s.itemOn]}>
   <Pressable accessibilityRole="button" accessibilityState={{expanded:on}} accessibilityLabel={item.name+(item.qty>1?', '+item.qty:'')+'. Show what it is'} onPress={()=>setOpen(on?null:item.key)} style={s.itemHead}>
    <View style={[s.itemIcon,worn&&{borderColor:colors.gold}]}><Icon name={item.icon} size={17} color={worn?colors.goldBright:colors.gold}/></View>
    <View style={{flex:1,minWidth:0}}><Text numberOfLines={on?3:1} style={s.itemName}>{item.name}{item.qty>1?<Text style={s.qty}>  ×{item.qty}</Text>:null}</Text>
     <Text numberOfLines={1} style={s.itemTag}>{worn?'Equipped':item.kind==='treasure'&&item.value?'Worth '+item.value+' gold':item.kind==='quest'?'Important':item.kind==='weapon'?'Weapon':item.kind==='ammunition'?'Ammunition':'Carried'}</Text></View>
    <Icon name={on?'close':'info'} size={15} color={colors.muted}/>
   </Pressable>
   {on&&<View style={s.itemBody}><Text style={s.description}>{itemDescription(item.name,item.kind,item.note)}</Text>
    {usable&&!inHand&&!!onWield&&<Pressable accessibilityRole="button" accessibilityLabel={'Fight with the '+item.weapon} onPress={()=>{playSound('select');onWield(item.weapon);setOpen(null);}} dataSet={{qb:'chip'}} style={s.wield}><Icon name={weaponIcon(item.weapon)} size={14} color={colors.gold}/><Text style={s.wieldText}>Take in hand</Text></Pressable>}
    {inHand&&<Text style={s.inHand}>In your hand: your attacks use it first.</Text>}</View>}
  </View>;};
 return <View>
  <View dataSet={{qb:'plate'}} style={s.panel}>
   <View style={s.labelRow}><Icon name="armor" size={14} color={colors.goldMid}/><Text style={s.label}>Equipment</Text></View>
   <View style={s.doll}>
    <HeroPortrait hero={hero} size={84} level={hero.level}/>
    <View style={{flex:1,minWidth:0}}>
     <Text numberOfLines={1} style={s.heroName}>{hero.name}</Text>
     <Text numberOfLines={1} style={s.heroLine}>{hero.species??hero.race} {hero.class}</Text>
     <View style={s.stats}>
      <View style={s.stat}><Icon name="shield" size={13} color={colors.gold}/><Text style={s.statText}>AC {basics.ac??'–'}</Text></View>
      {!!main&&<View style={s.stat}><Icon name="swords" size={13} color={colors.gold}/><Text style={s.statText}>{signed(main.attackBonus)} to hit</Text></View>}
     </View>
    </View>
   </View>
   <View style={s.slots}>{slots.map(([id,label,icon,name,stat])=>{const on=open===id,empty=/^(Empty|Free|No armor)$/.test(name);return <Pressable key={id} accessibilityRole="button" accessibilityState={{expanded:on}} accessibilityLabel={label+': '+name+(stat?', '+stat:'')} onPress={()=>setOpen(on?null:id)} dataSet={{qb:'card',selected:String(on)}} style={[s.slot,on&&s.slotOn]}>
     <View style={[s.slotIcon,empty&&{opacity:.5}]}><Icon name={icon} size={20} color={colors.goldBright}/></View>
     <View style={{flex:1,minWidth:0}}><Text style={s.slotLabel}>{label}</Text><Text numberOfLines={2} style={[s.slotName,empty&&{color:colors.muted}]}>{name}</Text>{!!stat&&<Text numberOfLines={1} style={s.slotStat}>{stat}</Text>}</View>
    </Pressable>;})}</View>
   {!!shown&&<View style={s.slotBody} accessibilityLiveRegion="polite"><Text style={s.description}>{shown[5]}</Text></View>}
  </View>
  <View dataSet={{qb:'plate'}} style={s.panel}>
   <View style={s.labelRow}><Icon name="bag" size={14} color={colors.goldMid}/><Text style={s.label}>Pack</Text></View>
   <View style={s.purse}>
    {[['gold','coin',pack.gold,'gold',goldDescription,colors.coin],['draughts','potion',draughts,draughts===1?'healing draught':'healing draughts',draughtDescription,colors.heal],...(arrows>0||ranged||main?.ranged?[['arrows','bow',arrows,'arrows',itemDescription('Arrow'),colors.gold]]:[])].map(([id,icon,value,unit,text,color])=>{const on=open===id;return <Pressable key={id} accessibilityRole="button" accessibilityState={{expanded:on}} accessibilityLabel={value+' '+unit} onPress={()=>setOpen(on?null:id)} style={[s.purseStat,on&&s.purseOn]}><Icon name={icon} size={16} color={color}/><Text style={s.purseValue}>{value}</Text><Text style={s.purseUnit}>{unit}</Text></Pressable>;})}
   </View>
   {['gold','draughts','arrows'].includes(open)&&<View style={s.slotBody}><Text style={s.description}>{open==='gold'?goldDescription:open==='draughts'?draughtDescription:itemDescription('Arrow')}</Text></View>}
   {kit.map(row)}
   {found.length>0&&<View style={s.foundHead}><Text style={s.foundLabel}>Found along the way</Text><View dataSet={{qb:'rule-right'}} style={s.foundRule}/></View>}
   {found.map(row)}
   {!kit.length&&!found.length&&<Text style={s.empty}>Your pack is empty.</Text>}
  </View>
 </View>;
}
const s=StyleSheet.create({
 panel:{padding:16,marginTop:14,borderWidth:1,borderColor:colors.goldLine,borderRadius:6,gap:10},
 labelRow:{flexDirection:'row',alignItems:'center',gap:8},label:{...type.label},
 doll:{flexDirection:'row',alignItems:'center',gap:16,paddingVertical:4},
 heroName:{fontFamily:fonts.display,fontSize:19,fontWeight:'700',letterSpacing:.8,color:colors.parchment},heroLine:{fontFamily:fonts.ui,fontSize:12.5,color:colors.gold,marginTop:2},
 stats:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:8},stat:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:4,borderRadius:12,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:'rgba(0,0,0,.25)'},statText:{fontFamily:fonts.ui,fontSize:12,fontWeight:'700',color:'#dfcdc5'},
 slots:{flexDirection:'row',flexWrap:'wrap',gap:8},
 slot:{flexGrow:1,flexBasis:260,minWidth:0,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:9,paddingHorizontal:10,minHeight:60,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.28)'),backgroundColor:tint('rgba(25,17,26,.72)')},slotOn:{borderColor:colors.goldBright},
 slotIcon:{width:40,height:40,borderRadius:6,borderWidth:1,borderColor:tint('rgba(224,74,92,.5)'),alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.35)'},
 slotLabel:{fontFamily:fonts.display,fontSize:9.5,fontWeight:'700',letterSpacing:1.6,color:colors.goldMid,textTransform:'uppercase'},
 slotName:{fontFamily:fonts.display,fontSize:14,fontWeight:'700',letterSpacing:.4,color:colors.parchment,marginTop:1},slotStat:{fontFamily:fonts.ui,fontSize:11.5,color:tint('#b8aeb5'),marginTop:1},
 slotBody:{paddingVertical:10,paddingHorizontal:12,borderRadius:6,borderLeftWidth:2,borderColor:colors.gold,backgroundColor:tint('rgba(25,17,26,.6)')},
 description:{fontFamily:fonts.story,fontSize:15.5,lineHeight:23,color:'#ded2cd'},
 purse:{flexDirection:'row',flexWrap:'wrap',gap:8},purseStat:{flexDirection:'row',alignItems:'baseline',gap:6,paddingHorizontal:10,paddingVertical:6,minHeight:36,borderRadius:18,borderWidth:1,borderColor:tint('rgba(178,34,58,.28)'),backgroundColor:'rgba(0,0,0,.25)'},purseOn:{borderColor:colors.goldBright},
 purseValue:{fontFamily:fonts.display,fontSize:16,fontWeight:'800',color:colors.parchment},purseUnit:{fontFamily:fonts.ui,fontSize:12,color:colors.muted},
 item:{borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.16)'),backgroundColor:tint('rgba(25,17,26,.5)')},itemOn:{borderColor:tint('rgba(224,74,92,.6)')},
 itemHead:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,paddingHorizontal:10,minHeight:48},
 itemIcon:{width:32,height:32,borderRadius:16,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.3)'},
 itemName:{fontFamily:fonts.story,fontSize:16,lineHeight:21,color:'#efe7d4'},qty:{fontFamily:fonts.ui,fontSize:12,color:colors.gold,fontWeight:'700'},itemTag:{fontFamily:fonts.ui,fontSize:11,color:colors.muted,letterSpacing:.3},
 itemBody:{paddingHorizontal:12,paddingBottom:12,gap:8},
 wield:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,minHeight:36,paddingHorizontal:14,borderRadius:18,borderWidth:1,borderColor:tint('rgba(178,34,58,.5)'),backgroundColor:tint('rgba(31,24,32,.92)')},wieldText:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:1.3,color:colors.gold,textTransform:'uppercase'},
 inHand:{fontFamily:fonts.ui,fontSize:12,color:colors.goldBright},
 foundHead:{flexDirection:'row',alignItems:'center',gap:10,marginTop:4},foundLabel:{fontFamily:fonts.display,fontSize:10,fontWeight:'700',letterSpacing:1.8,color:colors.goldMid,textTransform:'uppercase'},foundRule:{flex:1,height:1},
 empty:{fontFamily:fonts.story,fontStyle:'italic',fontSize:15,color:colors.muted},
});
