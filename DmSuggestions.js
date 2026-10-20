// The Suggestions strip of the Dungeon Master's panel (DungeonMaster.js keeps what is in view and the number keys):
// out of battle one Suggestions switch over Say, Speak and Actions; in battle the action buttons with an Actions | Say
// pair; the chips themselves (actions, people, ongoing effects, things to say) and the rows they wrap in.
import React from 'react';
import {View,Text as PlainText,Pressable} from 'react-native';
import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {npcArtSubject} from './worldArtRules';
import Icon from './Icon';
import {KeyHint,WrapRow} from './ui';
import {chipLayout} from './fitRules';
import {colors,tint} from './theme';
import {playSound} from './audio';
import {s} from './dmStyles';
// A suggestion is a short thing to say in the hero's own voice; a tap writes it into the box (it never sends). The
// suggestions wrap onto a second line rather than scrolling sideways.
export const ideaChipsFor=({ideaLines,ideasDisabled,fillIdea,short,chipH,compact,showIdeas})=>ideaLines.map((text,i)=><Pressable key={'idea:'+text} accessibilityRole="button" accessibilityLabel={'Suggestion: '+text} accessibilityState={{disabled:ideasDisabled}} disabled={ideasDisabled} onPress={()=>fillIdea(text)} onHoverIn={()=>!ideasDisabled&&playSound('tick')} dataSet={{qb:'chip',keepfocus:'true'}} style={[s.ideaChip,short&&{minHeight:0,height:chipH,paddingVertical:0},ideasDisabled&&{opacity:.45}]}><Icon name="quill" size={13} color={colors.goldMid}/><PlainText numberOfLines={short?1:2} style={[s.ideaText,short&&{fontSize:14}]}>{text}</PlainText>{!compact&&showIdeas&&i<9&&<KeyHint>{i+1}</KeyHint>}</Pressable>);
export default function SuggestionsBar({visible,compact,chipH,pressable,actionsDisabled,runAction,game,spellsOpen,attackOpen,tight,actions,setGuide,effects,speakList,person,busy,playing,engage,dead,people,battle,waitRow,viewWidth,viewHeight,fit,lastTurnId,castSpell,shownTab,ideaLines,ideasDisabled,fillIdea,short,showIdeas,setTab,panel,speakQuick,calmQuick,savePanel,direct,calmTabs}){
  const hintOf=a=>{const i=visible.indexOf(a);return !compact&&i>=0&&i<9?i+1:null;};
  const actionChip=a=>{
    // A heading in the Attack… or Cast… picker (Melee, Ranged, Cantrips, Level 2): a small label, not a button.
    if(a.heading)return <View key={a.key} dataSet={{qb:'action-heading'}} style={[s.actionHeading,{height:chipH}]}><PlainText style={[s.actionHeadingText,a.quiet&&{color:colors.faint},a.strong&&s.actionHeadingStrong]}>{a.heading}</PlainText></View>;
    const i=pressable.indexOf(a),lead=a.primary&&!a.prefill,hint=hintOf(a);return <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.casts?.length>1?a.label+': choose a slot':a.key==='cast-back'?'Back to your spells (choosing a slot for '+a.label+')':a.key==='cast'?'Cast a spell: start typing it':a.prefill?a.label+': start the sentence, then name the target':a.question??a.label} accessibilityState={{disabled:actionsDisabled}} disabled={actionsDisabled} onPress={()=>runAction(a)} onHoverIn={()=>!actionsDisabled&&playSound('tick')} dataSet={{qb:lead?'btn-primary':'chip',pulse:lead&&i===0&&game.stage==='combat'&&!actionsDisabled&&!spellsOpen&&!attackOpen?'on':'off'}} style={[s.action,tight&&s.actionTight,lead&&s.actionPrimary,actionsDisabled&&{opacity:.45}]}>
    <Icon name={a.icon??'star'} size={tight?14:16} color={lead?tint('#ffeef0'):colors.gold}/>
    <PlainText numberOfLines={1} style={[s.actionText,tight&&s.actionTextTight,lead&&s.actionPrimaryText]}>{a.label}</PlainText>
    {!!a.detail&&<PlainText numberOfLines={1} style={[s.actionDetail,{flexShrink:0}]}>{a.detail}</PlainText>}
    {a.casts?.length>1&&<Icon name="forward" size={12} color={colors.goldMid}/>}
    {!!hint&&<KeyHint dark={lead}>{hint}</KeyHint>}
  </Pressable>;};
  const actionChips=actions.map(actionChip);
  // The guide: what every action (or spell) in the row does, one tap away.
  if(actions.length)actionChips.push(<Pressable key="guide" accessibilityRole="button" accessibilityLabel={spellsOpen?'What these spells do':'What these actions do'} onPress={()=>{playSound('open');setGuide(true);}} dataSet={{qb:'chip'}} style={[s.action,tight&&s.actionTight,{paddingHorizontal:11}]}><Icon name="info" size={tight?14:16} color={colors.gold}/></Pressable>);
  const effectChips=effects.map(line=><View key={'effect:'+line} style={[s.effectChip,{height:chipH-4}]}><Icon name="spell" size={13} color={colors.arcane}/><Text numberOfLines={1} style={s.effectChipText}>{line}</Text></View>);
  const personChip=n=>{const a=speakList.find(x=>x.person===n.id),hint=a?hintOf(a):null;return <Pressable key={'person:'+n.id} accessibilityRole="button" accessibilityLabel={(person?'Address ':'Speak with ')+n.name} disabled={busy||playing} onPress={()=>engage(n.id)} dataSet={{qb:'chip'}} style={[s.personChip,{height:chipH}]}><DynamicArt dataSet={{qb:'avatar'}} subject={npcArtSubject(game,n.id)} style={[s.chipAvatar,tight&&s.chipAvatarTight]} compact/><PlainText numberOfLines={1} style={[s.chipName,tight&&{fontSize:13}]}>{n.name}</PlainText><View style={s.chipSpeak}><Icon name="speak" size={13} color={colors.gold}/>{!tight&&<PlainText style={s.chipAction}>{person?'Address':'Speak'}</PlainText>}</View>{!!hint&&<KeyHint>{hint}</KeyHint>}</Pressable>;};
  const peopleChips=(dead?[]:people.filter(n=>n.id!==person?.id)).map(personChip);
  const extraChips=[...effectChips,...(battle?peopleChips:[])];
  const picker=spellsOpen||attackOpen||!!waitRow;
  const {rows:chipRows,openRows}=chipLayout(viewWidth,viewHeight,{picker});
  const row=(chips,rows,key)=>chips.length>0&&<WrapRow key={key} rows={rows} openRows={openRows} rowHeight={chipH} gap={fit.gap} resetKey={lastTurnId+':'+spellsOpen+':'+attackOpen+':'+castSpell+':'+shownTab} label={key==='say'||key==='ideas'?'Suggestions':'Quick actions'} dataSet={{qb:'actions'}} style={s.actionBar}>{chips}</WrapRow>;
  const ideaChips=ideaChipsFor({ideaLines,ideasDisabled,fillIdea,short,chipH,compact,showIdeas});
  const ideaRow=<View dataSet={{qb:'actions'}} accessibilityLabel="Suggestions" style={[s.actionBar,s.ideaWrap]}>{ideaChips}</View>;
  // In battle: Actions | Say. A short screen (a phone on its side) has one row of chips: the two tabs would fill it, so
  // a single small switch (a quill and the count, or the way back to the actions) stands before the row, and the
  // suggestions sit in the same height-limited row as the actions (one line each, the rest behind More), so the
  // message box always stays in view. The switch is outside the row so the first chip leads its own line.
  const tabButton=(id,label,count)=>{const on=id==='say'?showIdeas:!showIdeas;return <Pressable key={'tab:'+id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected:on}} onPress={()=>{if(on)return;playSound('click');setTab(id);}} dataSet={{qb:on?'seg-on':'chip',keepfocus:'true'}} style={[s.tab,on&&s.tabOn]}><PlainText style={[s.tabText,on&&s.tabTextOn]}>{label}</PlainText>{!on&&count>0&&<View style={s.tabCount}><PlainText style={s.tabCountText}>{count}</PlainText></View>}</Pressable>;};
  const tabButtons=ideaLines.length>0?[...(actions.length?[tabButton('actions','Actions',0)]:[]),tabButton('say','Say',ideaLines.length)]:[];
  const tabStrip=tabButtons.length>0&&<View accessibilityRole="tablist" style={s.tabs}>{tabButtons}</View>;
  const tabSwitch=tabButtons.length>1?[<Pressable key="tab:switch" accessibilityRole="tab" accessibilityLabel={showIdeas?'Actions':'Say ('+ideaLines.length+')'} accessibilityState={{selected:showIdeas}} onPress={()=>{playSound('click');setTab(showIdeas?'actions':'say');}} dataSet={{qb:showIdeas?'seg-on':'chip',keepfocus:'true',tab:'switch'}} style={[s.tab,{height:chipH,paddingHorizontal:9},showIdeas&&s.tabOn]}>{showIdeas?<><Icon name="back" size={13} color={colors.goldBright}/><PlainText style={[s.tabText,s.tabTextOn]}>Actions</PlainText></>:<><Icon name="quill" size={14} color={colors.goldMid}/><View style={s.tabCount}><PlainText style={s.tabCountText}>{ideaLines.length}</PlainText></View></>}</Pressable>]:[];
  const shortRow=showIdeas?row([...ideaChips,...extraChips],chipRows,'ideas'):row([...actionChips,...extraChips],chipRows,'all');
  const battleBar=short?(tabSwitch.length?<View style={s.switchRow}><View style={s.switchCell}>{tabSwitch}</View><View style={{flex:1,minWidth:0}}>{shortRow}</View></View>:shortRow):<>{row(extraChips,1,'extra')}{tabStrip}{showIdeas?ideaRow:row(actionChips,chipRows,'actions')}</>;
  // Out of battle: one Suggestions switch above the message box (closed unless the player keeps it open) that opens
  // onto Say, Speak and Actions. A dot on the closed switch says something new waits there (loot, an offer, a level).
  const fresh=!panel.open&&(speakQuick.length>0||calmQuick.some(a=>a.primary));
  const suggestToggle=<Pressable key="suggest" accessibilityRole="button" accessibilityState={{expanded:panel.open}} accessibilityLabel={panel.open?'Hide suggestions':'Suggestions: things to say, people to speak with, and actions'+(fresh?' (something new)':'')} onPress={()=>{playSound('click');savePanel({...panel,open:!panel.open});}} dataSet={{qb:panel.open?'seg-on':'chip',keepfocus:'true',suggest:'toggle'}} style={[s.tab,short&&{height:chipH,minHeight:0},panel.open&&s.tabOn]}>
    {panel.open&&(compact||short)?<Icon name="close" size={14} color={colors.goldBright}/>:<><Icon name="star" size={14} color={panel.open?colors.goldBright:colors.goldMid}/><PlainText style={[s.tabText,panel.open&&s.tabTextOn]}>Suggestions</PlainText>{panel.open&&<Icon name="close" size={12} color={colors.goldBright}/>}</>}
    {fresh&&<View dataSet={{qb:'fresh'}} style={s.freshDot}/>}
  </Pressable>;
  // The narrowest phones (under 360 wide) leave the counts off so the switch and the three tabs keep to one line.
  const narrowTabs=viewWidth<360;
  const subTab=([id,label,count])=>{const on=id===shownTab;return <Pressable key={'sub:'+id} accessibilityRole="tab" accessibilityLabel={label+(count?' ('+count+')':'')} accessibilityState={{selected:on}} onPress={()=>{if(on)return;playSound('click');savePanel({...panel,tab:id});}} dataSet={{qb:on?'seg-on':'chip',keepfocus:'true',suggest:id}} style={[s.tab,short&&{height:chipH,minHeight:0,paddingHorizontal:9},narrowTabs&&{paddingHorizontal:10},on&&s.tabOn]}>{short?<Icon name={{say:'quill',speak:'speak',actions:'compass'}[id]} size={15} color={on?colors.goldBright:colors.gold}/>:<PlainText style={[s.tabText,on&&s.tabTextOn]}>{label}</PlainText>}{!on&&!short&&!narrowTabs&&count>0&&<View style={s.tabCount}><PlainText style={s.tabCountText}>{count}</PlainText></View>}</Pressable>;};
  const quiet=text=><View key="quiet" style={[s.quietRow,short&&{height:chipH,minHeight:0}]}><PlainText numberOfLines={short?1:2} style={s.quietText}>{text}</PlainText></View>;
  const calmContent=!panel.open?null:shownTab==='say'?(ideaLines.length?(short?row(ideaChips,chipRows,'say'):ideaRow):quiet(direct?'Out of character: say what you need to the Dungeon Master.':'Nothing to suggest just now. Type what you say or do, in your own words.'))
    :shownTab==='speak'?(speakList.length?row([...peopleChips,...speakQuick.map(actionChip)],chipRows,'speak'):quiet('No one here to speak with. Type what you do, or travel somewhere new.'))
    :(actionChips.length||effectChips.length?row([...actionChips,...effectChips],chipRows,'actions'):quiet('Nothing to tap just now. Type what you do.'));
  const calmBar=calmTabs.every(t=>!t[2])&&!panel.open&&!effects.length?null:short?<View style={s.switchRow}><View accessibilityRole="tablist" style={[s.switchCell,s.subTabs]}>{suggestToggle}{panel.open&&!(picker&&shownTab==='actions')&&calmTabs.map(subTab)}</View><View style={{flex:1,minWidth:0}}>{calmContent}</View></View>
    :<View style={s.suggestPanel}><View accessibilityRole="tablist" style={s.tabs}>{suggestToggle}{panel.open&&calmTabs.map(subTab)}</View>{calmContent}</View>;
  const actionBar=battle?battleBar:calmBar;
  return actionBar;
}
