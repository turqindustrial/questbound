// The head of the Dungeon Master's panel (DungeonMaster.js, fill layout): in a conversation the person spoken with (a
// way back, their portrait, role, how they feel about the hero, and Just you two); otherwise the narrator and the
// connection, on screens with room for them.
import React from 'react';
import {View,Text as PlainText} from 'react-native';
import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {npcArtSubject} from './worldArtRules';
import Icon from './Icon';
import {IconButton} from './ui';
import {colors} from './theme';
import {s} from './dmStyles';
export default function DmHeader({person,typing,short,busy,playing,setConversationId,game,compact,attitude,aloneSwitch,snug,teller,statusPill}){
  return person?<View style={[s.fillHeader,typing&&short&&{display:'none'}]}>
      <IconButton icon="back" label="Back to adventure" size={36} disabled={busy||playing} onPress={()=>setConversationId(null)}/>
      <DynamicArt dataSet={{qb:'portrait'}} subject={npcArtSubject(game,person.id)} style={[s.fillPortrait,compact&&{width:44,height:52},short&&{width:34,height:40}]}/>
      <View style={{flex:1,minWidth:0}}><PlainText numberOfLines={1} style={[s.personName,s.fillName,short&&{fontSize:16}]}>{person.name}</PlainText>{!short&&<PlainText numberOfLines={1} style={s.fillRole}>{person.role}{person.trainedAs?' · Level '+person.trainedAs.level+' '+person.trainedAs.class:''}</PlainText>}<View style={s.attitude}><View style={[s.dot,{backgroundColor:attitude.color}]}/><PlainText style={[s.attitudeText,{color:attitude.color}]}>{attitude.label}</PlainText></View></View>
      {aloneSwitch}
    </View>:!short&&!compact&&!snug&&<View style={s.fillHeader}>
      <View style={s.dmMark}><Icon name={teller.icon} size={compact?17:19} color={colors.goldBright}/></View>
      <View style={{flex:1,minWidth:0}}><Text style={s.overline}>YOUR NARRATOR</Text><Text numberOfLines={1} style={[s.heading,s.fillHeading,compact&&{fontSize:16}]}>{teller.name}</Text></View>
      {statusPill}
    </View>;
}
