import React,{useEffect,useRef,useState} from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {GameButton} from './ui';
import HeroPortrait from './HeroPortrait';
import {heroArtSubject,heroPaintingSubject,heroPaintingChoice,genderOf} from './worldArtRules';
import {askArt,ensureArt,artIdentity} from './artClient';
import {fonts,colors,tint} from './theme';
// The hero's portrait, chosen by the player (2026-10-17, the host's words: "Free hero portraits by default: offer each
// new hero a matching library face right away, with an optional 'paint my own'"). Shown in the character builder's
// review and on the Character Sheet: the face the hero has now; Another face goes round every ready-made face from the
// host's people library that fits the hero (hero-faces.cjs: species, gender, class, then age and look; never one worn
// by someone in the tale or another hero at the table), and their own painting if they have one; Paint my own paints
// a portrait from the hero's own description, once for each look (refused for a guest past the host's allowance, in
// the allowance's own words). `value` is the hero's portrait choice (characterRules validPortraitChoice), `onChange`
// sets it. With `auto` (the builder), a hero without a choice takes the face the server offers first, and a face that
// no longer fits (a new species) gives way to one that does.
export default function HeroFacePicker({hero,game=null,value,onChange,auto=false,disabled=false}){
 const shown=hero?{...hero,portrait:value}:null;
 const listSubject=heroArtSubject(hero?{...hero,portrait:undefined}:null,game);
 const listKey=listSubject?artIdentity(listSubject):null;
 const [list,setList]=useState({status:'idle',faces:[],own:false,library:null});
 const [painting,setPainting]=useState(false),[paintError,setPaintError]=useState(''),[blocked,setBlocked]=useState(false),[busy,setBusy]=useState(false);
 const live=useRef(true);useEffect(()=>()=>{live.current=false;},[]);
 const valueRef=useRef(value);valueRef.current=value;
 useEffect(()=>{
  if(!listSubject){setList({status:'idle',faces:[],own:false,library:null});return;}
  let current=true;setList(l=>({...l,status:'loading'}));
  askArt(listSubject).then(result=>{
   if(!current||!live.current)return;
   const libraryFace=id=>/^(?:np\d{3}|nf\d{3,4})$/.test(String(id));
   const faces=Array.isArray(result?.faces)?result.faces.filter(libraryFace):[];
   const next={status:result?.status==='ready'||faces.length?'ready':'failed',faces,own:result?.own===true,library:libraryFace(result?.library)?result.library:null,error:result?.status==='failed'?String(result.error??''):''};
   setList(next);
   if(!auto)return;
   const now=valueRef.current;
   // The builder keeps the face the hero is shown, so it is theirs from the start.
   if(!now&&next.library&&!next.own)onChange({library:next.library});
   else if(now?.library&&faces.length&&!faces.includes(now.library))onChange({library:faces[0]});
  }).catch(()=>{if(current&&live.current)setList({status:'failed',faces:[],own:false,library:null,error:''});});
  return()=>{current=false;};
 },[listKey]);
 if(!hero?.name||!hero.class)return <Text style={s.note}>Name your hero and choose a class to see their face.</Text>;
 // The choices Another face goes round: their own painting (if any), then every fitting face.
 const ownChoice=value?.painted?value:list.own?heroPaintingChoice(hero):null;
 const options=[...(ownChoice?['own']:[]),...list.faces];
 const currentOption=value?.painted?'own':value?.library??(list.own?'own':list.library);
 function another(){
  if(!options.length)return;
  const at=options.indexOf(currentOption),next=options[(at+1)%options.length];
  if(next===currentOption)return;
  onChange(next==='own'?ownChoice:{library:next});
 }
 const paintedNow=list.own||(value?.painted&&value.painted===heroPaintingChoice(hero).painted);
 async function paint(){
  const subject=heroPaintingSubject(hero);if(!subject||painting||blocked)return;
  setPainting(true);setPaintError('');
  try{await ensureArt(subject,{retry:true});if(!live.current)return;setList(l=>({...l,own:true}));onChange(heroPaintingChoice(hero));}
  catch(e){if(!live.current)return;const message=e?.message||'The portrait could not be painted. Keep your face and try again later.';setPaintError(message);if(/allowance|paused|budget|ceiling/i.test(message))setBlocked(true);}
  finally{if(live.current)setPainting(false);}
 }
 async function choose(fn){if(busy)return;setBusy(true);try{await fn();}finally{if(live.current)setBusy(false);}}
 const unknownGender=!genderOf(hero.description)&&!genderOf(hero.backstory);
 const status=painting?'Painting your portrait from your description. This takes about a minute; you can carry on meanwhile.':list.status==='loading'?'Finding faces that fit your hero…':list.status==='failed'&&!options.length?(list.error||'Ready-made faces cannot be reached just now. Your hero shows their class crest until they can.'):value?.painted||currentOption==='own'?'Your own portrait, painted from your description.':'A ready-made face chosen to fit your hero. Another face shows the others that fit.';
 return <View dataSet={{qb:'face-picker'}} style={s.wrap}>
  <HeroPortrait hero={shown} game={game} size={96}/>
  <View style={s.side}>
   <Text accessibilityLiveRegion="polite" style={s.note}>{status}</Text>
   {unknownGender&&list.status==='ready'&&<Text style={s.hint}>Say in your description whether your hero is a woman or a man, and the faces will fit.</Text>}
   <View style={s.buttons}>
    <GameButton label={options.length>1?'Another face ('+(Math.max(0,options.indexOf(currentOption))+1)+' of '+options.length+')':'Another face'} icon="forward" disabled={disabled||busy||painting||options.length<2} onPress={()=>choose(another)} accessibilityLabel="Show another face that fits your hero"/>
    {!paintedNow&&<GameButton label={painting?'Painting…':'Paint my own'} icon="quill" disabled={disabled||busy||painting||blocked} onPress={()=>choose(paint)} accessibilityLabel="Paint a portrait from your hero's own description"/>}
   </View>
   {!paintedNow&&!paintError&&<Text style={s.hint}>Paint my own makes one portrait from your hero's description. Change their words later and the painting stays as it is.</Text>}
   {!!paintError&&<Text accessibilityRole="alert" style={s.error}>{paintError}</Text>}
  </View>
 </View>;
}
const s=StyleSheet.create({
 wrap:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:16,marginVertical:8},
 side:{flex:1,minWidth:240,gap:8},
 buttons:{flexDirection:'row',flexWrap:'wrap',gap:8},
 note:{fontFamily:fonts.ui,color:tint('#e6e1e5'),fontSize:14,lineHeight:22},
 hint:{fontFamily:fonts.ui,color:colors.muted,fontSize:12.5,lineHeight:19},
 error:{fontFamily:fonts.ui,color:colors.danger,fontSize:13.5,lineHeight:21},
});
