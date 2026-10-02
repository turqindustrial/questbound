import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import React,{useState,useEffect,useRef} from 'react';
import {View,Image,Pressable,Platform,StyleSheet,Modal,ScrollView,useWindowDimensions} from 'react-native';
import {mapPlaces,mapState,mapLocation,mapRoute,knownPlaceIds,placeCoordinates,placeName,placeDescription,worldPlace,worldPlaces,worldLinks,travelRoute,distanceText,durationText,placeIcons,mapRegions,regionOfPlace,currentRegion} from './mapRules';
import {fonts,colors,type} from './theme';
import Icon from './Icon';
import {Text as PlainText} from 'react-native';
import {regionLayout,regionLabels} from './mapLayout';
import {regionMapSvg,exitLabelBoxes} from './mapArt';
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
// A written story's country, drawn as maps: one sheet for each region the hero knows (the land the story began in,
// lands reached by far journeys, an earlier chapter's country), every known place on it, the paths between them, the
// roads that lead off to other regions, and where the hero stands (mapLayout.js places them, mapArt.js draws the
// sheet to suit the region's terrain). Tap a place for its details; Travel sets out through the Dungeon Master. A
// sheet can be zoomed and opened full screen once there are many places.
const coreIcons={inn:'home',bridge:'swords',tower:'tower'},coreKinds={inn:'start',bridge:'danger',tower:'high'};
// What a place is: a found place's kind, or (for the three starting places) the kind its story gave it.
export const placeKindOf=(game,id)=>worldPlace(game,id)?.kind??game.story?.locations?.[id]?.kind??null;
const placeIconOf=(game,id)=>worldPlace(game,id)?placeIcons[worldPlace(game,id).kind]??'compass':id==='inn'?'home':placeIcons[game.story?.locations?.[id]?.kind]??coreIcons[id]??'compass';
const zooms=[1,1.6,2.4];
function RegionSheet({game,w,h,selected,onSelect,region,onRegion}){
 const [zoom,setZoom]=useState(0),scroller=useRef(null);
 const z=zooms[zoom],W=Math.round(w*z),H=Math.round(h*z);
 const here=mapLocation(game),visited=new Set(mapState(game).visited),regions=mapRegions(game),land=regions.find(r=>r.id===region)??regions[0];
 const layout=regionLayout(game,W,H,{region:land.id}),{ids,at,links,exits}=layout;
 // Roads out are named after the land they lead to.
 const exitNames=Object.fromEntries(exits.map(e=>[e.to,(regions.find(r=>r.id===e.region)??regions[0]).name])),exitBoxes=exitLabelBoxes(exits,exitNames,W,H);
 // At full view the corner under the zoom buttons and the map's title are kept clear of names.
 const avoid=[...(zoom===0?[{x:W-52,y:H-98,w:52,h:98}]:[]),{x:8,y:H-30,w:Math.min(W-70,land.name.length*8.2+14),h:24},...exitBoxes.map(e=>({x:e.lx-2,y:e.ly-2,w:e.tw+4,h:16}))];
 const labels=regionLabels(game,W,H,layout,{here,selected,avoid});
 const iconFor=id=>placeIconOf(game,id);
 const short=feet=>distanceText(feet).replace(' miles',' mi');
 const distances=Object.fromEntries(links.map(([a,b])=>{const p=placeCoordinates(game,a),q=placeCoordinates(game,b);return [a+'-'+b,p&&q?short(Math.round(Math.hypot(p.x-q.x,p.y-q.y))):null];}));
 const svg=web?regionMapSvg({w:W,h:H,seed:(game.story?.id??'region')+':'+land.id,terrain:land.terrain,ids,at,links,exits,exitNames,labels,here,visited,selected,distances,avoid:avoid.slice(0,zoom===0?1:0),
  kinds:Object.fromEntries(ids.map(id=>[id,placeKindOf(game,id)??coreKinds[id]??'wilds'])),icons:Object.fromEntries(ids.map(iconFor).map((icon,i)=>[ids[i],icon])),
  lairs:new Set(ids.filter(id=>!!worldPlace(game,id)?.threat)),cleared:new Set(ids.filter(id=>!!worldPlace(game,id)?.cleared)),title:land.name}):null;
 // Zooming keeps the hero's place in the middle of the frame (or the middle of a sheet the hero is not on).
 const centre=smooth=>{const p=at[here]??{x:W/2,y:H/2};scroller.current?.scrollTo?.({left:Math.max(0,p.x-w/2),top:Math.max(0,p.y-h/2),behavior:smooth?'smooth':'auto'});};
 useEffect(()=>{centre(false);},[zoom,w,h,here,land.id]);
 const tool=(label,text,onPress,disabled)=><Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} dataSet={{qb:'map-tool'}} style={[s.tool,disabled&&{opacity:.45}]}>{typeof text==='string'?<PlainText style={s.toolText}>{text}</PlainText>:text}</Pressable>;
 return <View dataSet={{qb:'map-frame'}} accessibilityLabel={'Map of '+land.name+': '+ids.length+' known places'} style={[s.region,{width:w,height:h}]}>
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
    {/* A road out of this region: tap where it leaves the sheet to turn to that land's map. */}
    {exitBoxes.map(e=><Pressable key={'exit:'+e.from+':'+e.to} accessibilityRole="button" accessibilityLabel={'Show the map of '+exitNames[e.to]} onPress={()=>onRegion?.(e.region)} style={{position:'absolute',left:Math.min(e.lx,e.x-22),top:Math.min(e.ly,e.y-22),width:Math.max(e.lx+e.tw,e.x+22)-Math.min(e.lx,e.x-22),height:Math.max(e.ly+18,e.y+22)-Math.min(e.ly,e.y-22)}}/>)}
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
 // Which region's sheet is showing: the one the hero is in, until another is picked (and again once they move on).
 const regions=mapRegions(game),home=currentRegion(game),[turned,setTurned]=useState(null);
 useEffect(()=>{setTurned(null);},[home,game.story?.id]);
 const shown=regions.find(r=>r.id===turned)??regions.find(r=>r.id===home)??regions[0],sheetIds=ids.filter(id=>regionOfPlace(game,id)===shown.id);
 const turnTo=id=>{setTurned(id);setSelected(null);};
 // Over the sheet: where the hero stands (on their own land's sheet), or the name of the land being looked at.
 const count=sheetIds.length+(sheetIds.length===1?' place':' places'),sheetTitle=shown.id===home?shown.name+' · '+count:'Another land · '+count,sheetHeading=shown.id===home?placeName(game,here):shown.name;
 // The sheet is as wide as its panel and nearly square on a phone, where the Map tab has the height for it.
 const w=Math.max(230,Math.min(width,760)),h=Math.round(Math.max(250,Math.min(560,w*(w<480?.95:.68))));
 // The full map leaves room for its heading and the row of lands, even on a phone held sideways; whatever is
 // picked scrolls under it.
 // On a short screen the lands sit beside the heading instead of under it, so the sheet keeps its height.
 const shortWin=winH<480&&winW>=600;
 const bigW=Math.max(260,Math.min(winW-28,1180)),bigH=Math.max(150,Math.min(winH-(winW<600?210:shortWin?112:150)-(regions.length>1&&!shortWin?46:0),Math.round(bigW*.8)));
 const routeTo=id=>id===here?null:travelRoute(game,here,id);
 const iconFor=id=>placeIconOf(game,id);
 // What waits at a found place: a lair's creature, a risk, or a place you have cleared.
 const dangerNote=id=>{const w=worldPlace(game,id);if(!w)return null;if(w.cleared)return 'Cleared';if(w.threat)return 'Lair of '+w.threat.name;if(w.danger==='risky')return 'Something may lurk here';return null;};
 const pick=selected&&ids.includes(selected)?selected:null,pickRoute=pick?routeTo(pick):null,canGo=id=>id!==here&&!!onTravel&&travelTo.includes(id);
 const places=[...sheetIds].sort((a,b)=>(a===here?-1:b===here?1:(routeTo(a)?.feet??0)-(routeTo(b)?.feet??0)));
 // The regions the hero knows, as a row of sheets to turn to (shown once there is more than one).
 const regionTabs=(inline=false)=>regions.length>1&&<ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.regionBar,inline&&s.regionInline]} contentContainerStyle={s.regionRow} accessibilityRole="tablist">{regions.map(r=>{const on=r.id===shown.id;return <Pressable key={r.id} accessibilityRole="tab" accessibilityState={{selected:on}} accessibilityLabel={'Map of '+r.name+(r.id===home?', where you are':'')} onPress={()=>turnTo(r.id)} dataSet={{qb:on?'seg-on':'chip'}} style={[s.regionTab,on&&s.regionTabOn]}>{r.id===home&&<View style={s.regionDot}/>}<PlainText numberOfLines={1} style={[s.regionTabText,on&&{color:colors.goldBright}]}>{r.name}</PlainText></Pressable>;})}</ScrollView>;
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
   <View style={{flex:1,minWidth:0}}><View style={s.eyebrowRow}><Icon name="map" size={14} color={colors.goldMid}/><PlainText numberOfLines={2} style={[s.eyebrow,{flexShrink:1}]}>{sheetTitle}</PlainText></View><Text style={s.heading}>{sheetHeading}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Open the map full screen" onPress={()=>setOpen(true)} dataSet={{qb:'chip'}} style={s.expand}><Icon name="expand" size={15} color={colors.gold}/><PlainText style={s.travelText}>Full map</PlainText></Pressable>
  </View>
  {regionTabs()}
  <RegionSheet game={game} w={w} h={h} selected={pick} onSelect={setSelected} region={shown.id} onRegion={turnTo}/>
  <Modal transparent visible={open} animationType="fade" onRequestClose={()=>setOpen(false)}>
   <View dataSet={{qb:'scrim'}} style={s.scrim}>
    <View dataSet={{qb:'sheet'}} style={[s.bigSheet,{width:bigW+24}]} accessibilityViewIsModal>
     <View style={[s.headRow,shortWin&&{alignItems:'center'}]}><View style={{flex:1,minWidth:0}}>{!shortWin&&<PlainText numberOfLines={1} style={s.eyebrow}>{sheetTitle}</PlainText>}<PlainText numberOfLines={1} style={[s.heading,{marginTop:2},shortWin&&{fontSize:18}]}>{sheetHeading}</PlainText></View>
      {shortWin&&regionTabs(true)}
      <Pressable accessibilityRole="button" accessibilityLabel="Close the map" onPress={()=>setOpen(false)} dataSet={{qb:'chip'}} style={s.expand}><Icon name="close" size={15} color={colors.gold}/><PlainText style={s.travelText}>Close</PlainText></Pressable></View>
     {!shortWin&&regionTabs()}
     <ScrollView style={s.bigScroll} contentContainerStyle={s.bigBody}>
      {open&&<RegionSheet game={game} w={bigW} h={bigH} selected={pick} onSelect={setSelected} region={shown.id} onRegion={turnTo}/>}
      {pickCard(()=>setOpen(false))}
     </ScrollView>
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
 bigScroll:{flexGrow:0,flexShrink:1},bigBody:{gap:4},
 regionBar:{flexGrow:0,flexShrink:0,marginTop:10},regionInline:{marginTop:0,flexShrink:1,maxWidth:'50%'},regionRow:{gap:6,paddingRight:8},regionTab:{flexDirection:'row',alignItems:'center',gap:6,minHeight:34,maxWidth:230,paddingHorizontal:12,borderRadius:17,borderWidth:1,borderColor:'rgba(201,164,92,.35)',backgroundColor:'rgba(20,25,36,.92)'},regionTabOn:{borderColor:colors.goldBright,backgroundColor:'rgba(58,46,26,.92)'},
 regionTabText:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:.9,color:colors.gold,flexShrink:1},regionDot:{width:7,height:7,borderRadius:4,backgroundColor:'#c8412f'},
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
