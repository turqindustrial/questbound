import React,{useEffect,useState} from 'react';
import {View,Text,Image,Modal,Pressable,ScrollView,StyleSheet,useWindowDimensions} from 'react-native';
import {GameButton} from './ui';
import Icon from './Icon';
import {taleSummary} from './taleRules';
import {renderTaleCard,canvasBlob,shareTale,copyTaleText,canShareFiles} from './taleCard';
import {heroArtSubject,locationArtSubject} from './worldArtRules';
import {cachedArt} from './artClient';
import {playSound} from './audio';
import {fonts,colors,type,tint} from './theme';
// "Share your tale": a card of the hero and their story so far, painted when the sheet opens (with the portrait and
// the scene already painted for the game), shared from a phone or saved with the words copied on a computer.
export default function ShareTale({visible,onClose,hero,game}){
 const {width,height}=useWindowDimensions();
 const [card,setCard]=useState(null),[blob,setBlob]=useState(null),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!visible){setCard(null);setBlob(null);setNote('');return;}
  let alive=true;setBusy(true);
  (async()=>{
   try{
    const summary=taleSummary(game,hero),portrait=cachedArt(heroArtSubject(hero))?.dataUrl??null,scene=cachedArt(locationArtSubject(game))?.dataUrl??null;
    const canvas=await renderTaleCard(summary,{portrait,scene});if(!alive||!canvas)return;
    setCard({summary,url:canvas.toDataURL('image/jpeg',.9)});setBlob(await canvasBlob(canvas));
   }catch{if(alive)setNote('The card could not be painted here.');}
   finally{if(alive)setBusy(false);}
  })();
  return()=>{alive=false;};
 },[visible]);
 const share=async()=>{if(!card)return;playSound('click');const how=await shareTale(blob,card.summary);setNote(how==='shared'?'Shared.':how==='cancelled'?'':'Saved the picture and copied the words.');};
 const copy=async()=>{if(!card)return;playSound('click');setNote(await copyTaleText(card.summary)?'The words are on your clipboard.':'The words could not be copied here.');};
 const sheetWidth=Math.min(440,width-24),preview=Math.min(sheetWidth-36,Math.round((height-290)*0.8));
 return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}><Pressable accessibilityLabel="Close" onPress={onClose} dataSet={{qb:'scrim'}} style={s.scrim}><Pressable onPress={()=>{}} dataSet={{qb:'sheet'}} style={[s.sheet,{width:sheetWidth,maxHeight:height-24}]} accessibilityViewIsModal>
  <ScrollView contentContainerStyle={{gap:12,alignItems:'center'}}>
   <Text style={s.overline}>Your tale</Text><Text style={s.title}>Share your tale</Text>
   <View style={[s.frame,{width:preview,height:Math.round(preview*1.25)}]}>{card?<Image source={{uri:card.url}} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityLabel={'A card of '+card.summary.name+'\'s tale'}/>:<Text style={s.painting}>{busy?'Painting the card…':note||'No card yet.'}</Text>}</View>
   <Text style={s.text}>{canShareFiles()?'Send the card to a friend, or save it and copy the words to post it yourself.':'Save the card as a picture; the words to go with it are copied for you.'}</Text>
   <View style={{alignSelf:'stretch',gap:8}}>
    <GameButton variant="primary" icon="send" label={canShareFiles()?'Share the card':'Save the card'} onPress={share} disabled={!card}/>
    <GameButton icon="scroll" label="Copy the words" onPress={copy} disabled={!card}/>
    <GameButton label="Close" onPress={onClose}/>
   </View>
   {!!note&&<View style={s.noteRow}><Icon name="check" size={14} color={colors.heal}/><Text style={s.note}>{note}</Text></View>}
  </ScrollView>
 </Pressable></Pressable></Modal>;
}
const s=StyleSheet.create({
 scrim:{flex:1,backgroundColor:tint('rgba(5,3,5,.8)'),alignItems:'center',justifyContent:'center',padding:12},
 sheet:{padding:18,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(22,16,23,.98)')},
 overline:{...type.label,textAlign:'center'},title:{fontFamily:fonts.display,fontSize:22,fontWeight:'700',letterSpacing:2,color:colors.parchment,textAlign:'center',textTransform:'uppercase'},
 frame:{borderRadius:4,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('#0b080d'),alignItems:'center',justifyContent:'center',overflow:'hidden'},
 painting:{fontFamily:fonts.story,fontStyle:'italic',fontSize:16,color:colors.muted,textAlign:'center',padding:16},
 text:{fontFamily:fonts.ui,color:tint('#d4ced2'),fontSize:13.5,lineHeight:20,textAlign:'center'},
 noteRow:{flexDirection:'row',alignItems:'center',gap:8},note:{fontFamily:fonts.ui,color:colors.heal,fontSize:13},
});
