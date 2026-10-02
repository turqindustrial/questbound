import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import React,{useState,useEffect,useRef} from 'react';
import {View,Image,Pressable,Platform,StyleSheet,Modal,useWindowDimensions} from 'react-native';
import {mapPlaces,mapState,mapLocation,mapRoute,knownPlaceIds,placeCoordinates,placeName,placeDescription,worldPlace,worldPlaces,worldLinks,travelRoute,distanceText,durationText,placeIcons} from './mapRules';
import {fonts,colors,type} from './theme';
import Icon from './Icon';
import {Text as PlainText} from 'react-native';
import {regionLayout,regionLabels} from './mapLayout';
import {regionMapSvg} from './mapArt';
const web=Platform.OS==='web';
const landscape=require('./assets/map/crossroads-landscape.jpg');
const centers={inn:{x:0.14,y:0.60},bridge:{x:0.80,y:0.66},tower:{x:0.80,y:0.015},dungeon:{x:0.78,y:0.90}};
const artCenters={inn:{x:0.14,y:0.73},bridge:{x:0.80,y:0.78},tower:{x:0.80,y:0.11}};
export default function AdventureMap({game,travelTo=[],onTravel}){
 const [width,setWidth]=useState(280),[hovered,setHovered]=useState(null),[focused,setFocused]=useState(null),[pinned,setPinned]=useState(null);
 const map=mapState(game),location=mapLocation(game),active=hovered??focused??pinned,w=Math.min(width,640),h=w*8/7;
 const place=active?mapPlaces[active]:null,route=active?mapRoute(location,active):null;
 if(game.story)return <RegionMap game={game} travelTo={travelTo} onTravel={onTravel}/>;
 return <View dataSet={{qb:'plate'}} style={s.panel} onLayout={e=>setWidth(Math.max(180,e.nativeEvent.layout.width-24))}>
  <Text style={s.eyebrow}>THE LANTERN ROAD</Text><Text style={s.heading}>The Crossroads</Text>
  <Text style={s.caption}>At {mapPlaces[location].name} · Hover, focus, or tap a name to explore.</Text>
  <View style={[s.frame,{width:w,height:h}]}>
   {/* Explicit dimensions prevent React Native Web's intrinsic image size from cropping landmarks and roads. */}
   <Image source={landscape} resizeMode="stretch" style={{position:'absolute',left:0,top:0,width:w,height:h}} accessibilityLabel="Painted crossroads: inn, stone bridge and ruined watchtower connected by walking paths"/>
   <View style={[StyleSheet.absoluteFillObject,{pointerEvents:'none'},Platform.OS==='web'?{backgroundImage:'linear-gradient(180deg, rgba(5,13,20,.18) 0%, transparent 20%, transparent 85%, rgba(5,13,20,.35) 100%)'}:{backgroundColor:'rgba(5,13,20,.04)'}]}/>
   <Text style={s.north}>↑ N</Text>
   {Object.entries(centers).map(([id,point])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={mapPlaces[id].name+' — show location details'} accessibilityState={{expanded:active===id}} onHoverIn={()=>setHovered(id)} onHoverOut={()=>setHovered(null)} onFocus={()=>setFocused(id)} onBlur={()=>setFocused(null)} onPress={()=>setPinned(pinned===id?null:id)} style={[s.marker,{left:Math.max(4,Math.min(w-124,w*point.x-60)),top:h*point.y}]}>
    <Text style={[s.mapLabel,active===id&&{color:'#fff8db'}]}>{mapPlaces[id].name}</Text>
    {location===id&&<Text style={s.here}>◆ YOU ARE HERE</Text>}
   </Pressable>)}
   {place&&<View style={[s.details,{pointerEvents:'none',top:active==='tower'?h*.25:12}]} accessibilityLiveRegion="polite">
    {artCenters[active]&&<View style={{width:96,height:76,overflow:'hidden',borderRadius:7,marginBottom:8}}>
     <Image source={landscape} resizeMode="stretch" accessibilityLabel={'Illustration of '+place.name} style={{position:'absolute',width:420,height:480,left:48-artCenters[active].x*420,top:38-artCenters[active].y*480}}/>
    </View>}
    <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={s.detailName}>{place.name}</Text></View>
    <Text style={s.detailText}>{place.description}</Text>
    <Text style={s.distance}>{active===location?'Your current location':route.feet.toLocaleString()+' ft · '+route.minutes+' min walk'} · {map.visited.includes(active)?'Visited':'Unexplored'}</Text>
    {active==='dungeon'&&<Text style={s.detailText}>Entrance beyond the restored bridge.</Text>}
   </View>}
  </View>
  <DynamicArt subject={locationArtSubject(game)} statusOnly style={{width:'100%',minHeight:64,marginTop:14}}/>
  <Text style={s.caption}>Describe your destination to the Dungeon Master.</Text>
  {map.clue&&<Text style={s.clue}>Known signal: low, high, low.</Text>}
 </View>;
}
// A written story's region, drawn as a map: every known place, the paths between them, and where the hero stands
// (mapLayout.js places them, mapArt.js draws the sheet). Tap a place for its details; Travel sets out through the
// Dungeon Master. The sheet can be zoomed and opened full screen once there are many places.
const coreIcons={inn:'home',bridge:'swords',tower:'tower'},coreKinds={inn:'start',bridge:'danger',tower:'high'};
const zooms=[1,1.6,2.4];
function RegionSheet({game,w,h,selected,onSelect}){
 const [zoom,setZoom]=useState(0),scroller=useRef(null);
 const z=zooms[zoom],W=Math.round(w*z),H=Math.round(h*z);
 const here=mapLocation(game),visited=new Set(mapState(game).visited);
 // At full view the corner under the zoom buttons and the map's title are kept clear of names.
 const avoid=zoom===0?[{x:W-52,y:H-98,w:52,h:98},{x:8,y:H-30,w:220,h:24}]:[{x:8,y:H-30,w:220,h:24}];
 const layout=regionLayout(game,W,H),{ids,at,links}=layout,labels=regionLabels(game,W,H,layout,{here,selected,avoid});
 const iconFor=id=>coreIcons[id]??placeIcons[worldPlace(game,id)?.kind]??'compass';
 const short=feet=>distanceText(feet).replace(' miles',' mi');
 const distances=Object.fromEntries(links.map(([a,b])=>{const p=placeCoordinates(game,a),q=placeCoordinates(game,b);return [a+'-'+b,p&&q?short(Math.round(Math.hypot(p.x-q.x,p.y-q.y))):null];}));
 const svg=web?regionMapSvg({w:W,h:H,seed:game.story?.id??'region',ids,at,links,labels,here,visited,selected,distances,avoid:avoid.slice(0,zoom===0?1:0),
  kinds:Object.fromEntries(ids.map(id=>[id,coreKinds[id]??worldPlace(game,id)?.kind??'wilds'])),icons:Object.fromEntries(ids.map(iconFor).map((icon,i)=>[ids[i],icon])),
  lairs:new Set(ids.filter(id=>!!worldPlace(game,id)?.threat)),cleared:new Set(ids.filter(id=>!!worldPlace(game,id)?.cleared)),title:'Lands about '+placeName(game,'inn')}):null;
 // Zooming keeps the hero's place in the middle of the frame.
 const centre=smooth=>{const p=at[here]??{x:W/2,y:H/2};scroller.current?.scrollTo?.({left:Math.max(0,p.x-w/2),top:Math.max(0,p.y-h/2),behavior:smooth?'smooth':'auto'});};
 useEffect(()=>{centre(false);},[zoom,w,h,here]);
 const tool=(label,text,onPress,disabled)=><Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} dataSet={{qb:'map-tool'}} style={[s.tool,disabled&&{opacity:.45}]}>{typeof text==='string'?<PlainText style={s.toolText}>{text}</PlainText>:text}</Pressable>;
 return <View dataSet={{qb:'map-frame'}} accessibilityLabel={'Map of '+ids.length+' known places'} style={[s.region,{width:w,height:h}]}>
  <View ref={scroller} dataSet={{qb:'map-scroll',zoomed:String(zoom>0)}} style={{width:w,height:h}}>
   <View style={{width:W,height:H}}>
    {web?React.createElement('svg',{viewBox:'0 0 '+W+' '+H,width:W,height:H,'aria-hidden':true,focusable:'false',style:{position:'absolute',left:0,top:0,display:'block',pointerEvents:'none'},dangerouslySetInnerHTML:{__html:svg}})
     :<View style={[StyleSheet.absoluteFill,{backgroundColor:'#dcc694'}]}/>}
    {!!at[here]&&<View dataSet={{qb:'map-here'}} style={[s.herePulse,{left:at[here].x-15,top:at[here].y-15}]}/>}
    {ids.map(id=>{const p=at[id],isHere=id===here,on=selected===id,label=labels[id];
     return <React.Fragment key={id}>
      <Pressable accessibilityRole="button" accessibilityLabel={placeName(game,id)+(isHere?', you are here':'')} accessibilityState={{selected:on}} onPress={()=>onSelect(on?null:id)} style={[s.node,{left:p.x-22,top:p.y-22}]}>{!web&&<View style={[s.nodeDot,isHere&&s.nodeHere]}><Icon name={iconFor(id)} size={16} color={isHere?'#f8e9c4':'#3b2a17'}/></View>}</Pressable>
      {!!label&&(web?<Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={()=>onSelect(on?null:id)} style={{position:'absolute',left:label.x,top:label.y,width:label.w,height:label.h}}/>
       :<PlainText onPress={()=>onSelect(on?null:id)} numberOfLines={2} style={[s.nodeLabel,{left:label.x,top:label.y,width:label.w,textAlign:label.align}]}>{placeName(game,id)}</PlainText>)}
     </React.Fragment>;})}
   </View>
  </View>
  <View style={s.tools}>
   {tool('Zoom in','+',()=>setZoom(v=>Math.min(zooms.length-1,v+1)),zoom===zooms.length-1)}
   {tool('Zoom out','−',()=>setZoom(v=>Math.max(0,v-1)),zoom===0)}
   {zoom>0&&tool('Centre on where you are',<Icon name="compass" size={17} color="#3b2a17"/>,()=>centre(true),false)}
  </View>
 </View>;
}
function RegionMap({game,travelTo,onTravel}){
 const [width,setWidth]=useState(300),[selected,setSelected]=useState(null),[open,setOpen]=useState(false);
 const {width:winW,height:winH}=useWindowDimensions();
 const map=mapState(game),here=mapLocation(game),ids=knownPlaceIds(game),visited=new Set(map.visited);
 // The sheet is as wide as its panel and nearly square on a phone, where the Map tab has the height for it.
 const w=Math.max(230,Math.min(width,760)),h=Math.round(Math.max(250,Math.min(560,w*(w<480?.95:.68))));
 const bigW=Math.max(260,Math.min(winW-28,1180)),bigH=Math.max(240,Math.min(winH-(winW<600?210:170),Math.round(bigW*.8)));
 const routeTo=id=>id===here?null:travelRoute(game,here,id);
 const iconFor=id=>coreIcons[id]??placeIcons[worldPlace(game,id)?.kind]??'compass';
 // What waits at a found place: a lair's creature, a risk, or a place you have cleared.
 const dangerNote=id=>{const w=worldPlace(game,id);if(!w)return null;if(w.cleared)return 'Cleared';if(w.threat)return 'Lair of '+w.threat.name;if(w.danger==='risky')return 'Something may lurk here';return null;};
 const pick=selected&&ids.includes(selected)?selected:null,pickRoute=pick?routeTo(pick):null,canGo=id=>id!==here&&!!onTravel&&travelTo.includes(id);
 const places=[...ids].sort((a,b)=>(a===here?-1:b===here?1:(routeTo(a)?.feet??0)-(routeTo(b)?.feet??0)));
 const fighting=game.stage==='combat'||!!game.npcCombat?.active;
 const pickCard=close=>pick&&<View dataSet={{qb:'card'}} style={s.pickCard} accessibilityLiveRegion="polite">
   <View style={{flex:1,minWidth:0}}>
    <Text style={s.detailName}>{placeName(game,pick)}</Text>
    <Text style={[s.distance,pick===here&&{color:colors.goldBright}]}>{pick===here?'You are here':pickRoute?distanceText(pickRoute.feet)+' · '+durationText(pickRoute.minutes)+' on foot':'No known path'}{pick!==here?(visited.has(pick)?'  ·  Visited':'  ·  Not yet visited'):''}</Text>
    <Text style={s.detailText}>{placeDescription(game,pick)}</Text>
    {!!dangerNote(pick)&&<PlainText style={[s.danger,worldPlace(game,pick)?.cleared&&{color:colors.heal}]}>{dangerNote(pick)}</PlainText>}
    {!!worldPlace(game,pick)?.feature&&<PlainText style={s.feature}>Notable: {worldPlace(game,pick).feature}</PlainText>}
   </View>
   {canGo(pick)&&<Pressable accessibilityRole="button" accessibilityLabel={'Travel to '+placeName(game,pick)} onPress={()=>{onTravel(pick);setSelected(null);close?.();}} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="travel" size={14} color={colors.gold}/><PlainText style={s.travelText}>Travel</PlainText></View></Pressable>}
  </View>;
 return <View dataSet={{qb:'plate'}} style={s.panel} onLayout={e=>setWidth(Math.max(230,e.nativeEvent.layout.width-36))}>
  <View style={s.headRow}>
   <View style={{flex:1,minWidth:0}}><View style={s.eyebrowRow}><Icon name="map" size={14} color={colors.goldMid}/><PlainText style={s.eyebrow}>Your region · {ids.length} places</PlainText></View><Text style={s.heading}>{placeName(game,here)}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Open the map full screen" onPress={()=>setOpen(true)} dataSet={{qb:'chip'}} style={s.expand}><Icon name="expand" size={15} color={colors.gold}/><PlainText style={s.travelText}>Full map</PlainText></Pressable>
  </View>
  <RegionSheet game={game} w={w} h={h} selected={pick} onSelect={setSelected}/>
  <Modal transparent visible={open} animationType="fade" onRequestClose={()=>setOpen(false)}>
   <View dataSet={{qb:'scrim'}} style={s.scrim}>
    <View dataSet={{qb:'sheet'}} style={[s.bigSheet,{width:bigW+24}]} accessibilityViewIsModal>
     <View style={s.headRow}><View style={{flex:1,minWidth:0}}><PlainText style={s.eyebrow}>Your region · {ids.length} places</PlainText><PlainText numberOfLines={1} style={[s.heading,{marginTop:2}]}>{placeName(game,here)}</PlainText></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close the map" onPress={()=>setOpen(false)} dataSet={{qb:'chip'}} style={s.expand}><Icon name="close" size={15} color={colors.gold}/><PlainText style={s.travelText}>Close</PlainText></Pressable></View>
     {open&&<RegionSheet game={game} w={bigW} h={bigH} selected={pick} onSelect={setSelected}/>}
     {pickCard(()=>setOpen(false))}
    </View>
   </View>
  </Modal>
  {!open&&pickCard()}
  <Text style={s.caption}>{fighting?'Finish or flee the fight before travelling.':game.stage==='dying'?'You cannot travel while dying.':game.stage==='dead'?'Your journey has ended.':'Tap a place, or tell the Dungeon Master where you want to go: a direction, a landmark on the horizon, somewhere you heard about. New places appear on this map as you find them.'}</Text>
  <View style={s.places}>{places.map(id=>{const isHere=id===here,route=routeTo(id),go=canGo(id);return <View key={id} dataSet={{qb:'card',selected:String(isHere)}} style={[s.place,isHere&&s.placeHere]}>
   <Pressable accessibilityRole="button" accessibilityLabel={placeName(game,id)+' — location details'} onPress={()=>setSelected(pick===id?null:id)} style={s.placeInfo}><View style={[s.placeIcon,isHere&&{borderColor:colors.gold}]}><Icon name={iconFor(id)} size={18} color={isHere?colors.goldBright:colors.gold}/></View><View style={{flex:1}}><Text style={s.detailName}>{placeName(game,id)}</Text><Text style={[s.distance,isHere&&{color:colors.goldBright}]}>{isHere?'You are here':route?distanceText(route.feet)+' · '+durationText(route.minutes)+' walk':'No known path'}{visited.has(id)&&!isHere?'  ·  Visited':''}</Text></View></Pressable>
   {go&&<Pressable accessibilityRole="button" accessibilityLabel={'Travel to '+placeName(game,id)} onPress={()=>onTravel(id)} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="travel" size={14} color={colors.gold}/><PlainText style={s.travelText}>Travel</PlainText></View></Pressable>}
  </View>;})}</View>
 </View>;
}
const s=StyleSheet.create({
 region:{alignSelf:'center',marginTop:12,borderRadius:4,overflow:'hidden',borderWidth:1,borderColor:'rgba(232,199,123,.55)',backgroundColor:'#dcc694'},
 headRow:{flexDirection:'row',alignItems:'flex-end',gap:10},expand:{flexDirection:'row',alignItems:'center',gap:6,minHeight:38,paddingHorizontal:12,borderRadius:19,borderWidth:1,borderColor:'rgba(201,164,92,.5)',backgroundColor:'rgba(20,25,36,.92)',justifyContent:'center'},
 herePulse:{position:'absolute',width:30,height:30,borderRadius:15,pointerEvents:'none'},
 tools:{position:'absolute',right:8,bottom:8,gap:6},tool:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'rgba(59,42,23,.6)',alignItems:'center',justifyContent:'center',backgroundColor:'#eddeb6'},toolText:{fontFamily:fonts.display,fontSize:20,lineHeight:24,fontWeight:'800',color:'#3b2a17'},
 scrim:{flex:1,backgroundColor:'rgba(2,3,6,.82)',alignItems:'center',justifyContent:'center',padding:8},bigSheet:{maxWidth:'100%',maxHeight:'100%',padding:12,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:'rgba(13,17,26,.98)',gap:4},
 compassMark:{position:'absolute',top:8,right:10,fontFamily:fonts.display,fontSize:11,letterSpacing:1.5,color:'rgba(233,223,192,.7)'},
 path:{position:'absolute',height:2,borderRadius:1,backgroundColor:'rgba(232,199,123,.75)'},
 node:{position:'absolute',width:44,height:44,alignItems:'center',justifyContent:'center'},
 nodeDot:{width:30,height:30,borderRadius:15,borderWidth:1.5,borderColor:'#3b2a17',backgroundColor:'#f1e4bf',alignItems:'center',justifyContent:'center'},
 nodeHere:{backgroundColor:'#8f2c1c',borderColor:'#4a160c'},
 nodeLabel:{position:'absolute',fontFamily:fonts.display,fontSize:10.5,lineHeight:14,fontWeight:'700',letterSpacing:.4,color:'#3b2a17'},
 danger:{fontFamily:fonts.ui,fontSize:12,fontWeight:'700',color:colors.bloodBright,marginTop:6,letterSpacing:.3},feature:{fontFamily:fonts.story,fontStyle:'italic',fontSize:14.5,lineHeight:21,color:'#d8cfb8',marginTop:4},
 lairMark:{position:'absolute',top:3,right:3,width:10,height:10,borderRadius:5,backgroundColor:colors.bloodBright,borderWidth:1.5,borderColor:'#1a0a08'},
 pickCard:{flexDirection:'row',alignItems:'flex-start',gap:10,marginTop:12,padding:12,borderRadius:6,borderWidth:1,borderColor:'rgba(232,199,123,.45)',backgroundColor:'rgba(9,19,25,.9)'},
 panel:{backgroundColor:'rgba(12,16,24,.8)',borderColor:colors.goldLine,borderWidth:1,borderRadius:6,padding:18,marginVertical:14},eyebrowRow:{flexDirection:'row',alignItems:'center',gap:8},placeIcon:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'rgba(201,164,92,.4)',alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.25)'},travelRow:{flexDirection:'row',alignItems:'center',gap:6},eyebrow:{...type.label},heading:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,color:colors.parchment,fontSize:22,marginTop:6},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20,marginVertical:10},frame:{alignSelf:'center',borderRadius:3,overflow:'hidden',backgroundColor:'rgba(23,46,50,.68)',borderWidth:1,borderColor:colors.goldLine},
 places:{gap:8,marginTop:4},place:{flexDirection:'row',gap:10,alignItems:'center',padding:12,paddingRight:10,borderRadius:6,borderWidth:1,borderColor:'rgba(201,164,92,.25)'},placeInfo:{flex:1,flexDirection:'row',gap:12,alignItems:'center'},
 travel:{minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:'rgba(201,164,92,.5)',backgroundColor:'rgba(20,25,36,.92)',justifyContent:'center'},travelText:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.3,textTransform:'uppercase'},placeHere:{borderColor:colors.gold},placeGlyph:{fontSize:22,color:colors.gold,width:28,textAlign:'center',marginTop:2},north:{position:'absolute',top:15,left:16,color:'#e9dfc0',fontSize:13},marker:{position:'absolute',width:120,minHeight:44,justifyContent:'center',alignItems:'center'},mapLabel:{textAlign:'center',fontFamily:'Palatino Linotype, Book Antiqua, Georgia, serif',fontWeight:'600',fontStyle:'italic',fontSize:12,color:'#f5e3b6',...Platform.select({web:{textShadow:'1px 2px 5px #05090b'},default:{textShadowColor:'#05090b',textShadowRadius:5,textShadowOffset:{width:1,height:2}}}),backgroundColor:'rgba(9,17,20,.48)',borderRadius:4,paddingVertical:3,paddingHorizontal:6},here:{fontSize:8,letterSpacing:1,color:'#e9c87e',marginTop:3},details:{position:'absolute',left:12,right:12,top:42,padding:12,borderRadius:10,borderWidth:1,borderColor:'#7d765f',backgroundColor:'rgba(9,19,25,.96)'},detailName:{color:colors.parchment,fontSize:16,fontWeight:'700',letterSpacing:.6,fontFamily:fonts.display},detailText:{fontFamily:fonts.story,color:'#d9d3c3',fontSize:15.5,lineHeight:23,marginTop:6},distance:{fontFamily:fonts.ui,color:'#d2b780',fontSize:11.5,marginTop:5,letterSpacing:.3},close:{color:'#e9dfc0',fontSize:22,paddingHorizontal:10},clue:{color:'#dfddb2',fontSize:12,marginTop:4}});
