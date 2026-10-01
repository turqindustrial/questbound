import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import React,{useState} from 'react';
import {View,Image,Pressable,Platform,StyleSheet} from 'react-native';
import {mapPlaces,mapState,mapLocation,mapRoute,knownPlaceIds,placeCoordinates,placeName,placeDescription,worldPlace,worldPlaces,worldLinks,travelRoute,distanceText,durationText,placeIcons} from './mapRules';
import {fonts,colors,type} from './theme';
import Icon from './Icon';
import {Text as PlainText} from 'react-native';
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
// A written story's region, drawn: every known place, the paths between them, and where the hero stands.
// Distances are drawn on a square-root scale from the starting place, so three places a few hundred feet apart stay
// readable beside places miles away. Tap a place for its details; Travel sets out through the Dungeon Master.
const coreIcons={inn:'home',bridge:'swords',tower:'tower'};
function RegionMap({game,travelTo,onTravel}){
 const [width,setWidth]=useState(300),[selected,setSelected]=useState(null);
 const map=mapState(game),here=mapLocation(game),ids=knownPlaceIds(game),visited=new Set(map.visited);
 // A schematic, not a survey: the starting three keep their shape, and each found place sits off the place it was
 // found from in its true direction, at a distance that grows with the log of the miles, so near and far both fit.
 const raw={inn:{x:0,y:0},bridge:{x:1,y:0},tower:{x:1,y:1.33}};
 for(const p of worldPlaces(game)){const parent=raw[p.from]??raw.inn,from=placeCoordinates(game,p.from)??{x:0,y:0},dx=p.x-from.x,dy=p.y-from.y,len=Math.hypot(dx,dy)||1,step=1.1+0.6*Math.log2(1+len/5280);raw[p.id]={x:parent.x+dx/len*step,y:parent.y+dy/len*step};}
 // Room is left at the edges for the 120-wide labels beside and below each marker.
 const xs=Object.values(raw).map(p=>p.x),ys=Object.values(raw).map(p=>p.y),w=Math.max(220,Math.min(width,620)),h=Math.round(w*(ids.length>3?.78:.62));
 const spanX=Math.max(1,Math.max(...xs)-Math.min(...xs)),spanY=Math.max(1,Math.max(...ys)-Math.min(...ys)),scale=Math.min((w-116)/spanX,(h-90)/spanY);
 const at=Object.fromEntries(ids.map(id=>[id,{x:(w-spanX*scale)/2+(raw[id].x-Math.min(...xs))*scale,y:(h-14-spanY*scale)/2+(Math.max(...ys)-raw[id].y)*scale}]));
 // Labels go below each marker, or above, right or left, whichever first clears the markers and labels already
 // placed (the current place is labelled first). Sizes are estimated from the name's length.
 const labels={},taken=ids.map(id=>({x:at[id].x-19,y:at[id].y-19,w:38,h:38}));
 const clash=r=>taken.some(t=>r.x<t.x+t.w&&r.x+r.w>t.x&&r.y<t.y+t.h&&r.y+r.h>t.y);
 for(const id of [here,...ids.filter(i=>i!==here)]){
  const name=placeName(game,id),lw=Math.min(112,Math.max(40,name.length*7.4)),lh=name.length*7.4>112?28:15,p=at[id];
  const options=[{x:p.x-lw/2,y:p.y+20,align:'center'},{x:p.x-lw/2,y:p.y-20-lh,align:'center'},{x:p.x+21,y:p.y-lh/2,align:'left'},{x:p.x-21-lw,y:p.y-lh/2,align:'right'}].map(o=>({...o,w:lw,h:lh}));
  const fits=o=>o.x>=2&&o.x+o.w<=w-2&&o.y>=2&&o.y+o.h<=h-2;
  const best=options.find(o=>fits(o)&&!clash(o))??options.find(o=>!clash(o))??options[0];
  labels[id]=best;taken.push(best);
 }
 const routeTo=id=>id===here?null:travelRoute(game,here,id);
 const iconFor=id=>coreIcons[id]??placeIcons[worldPlace(game,id)?.kind]??'compass';
 // What waits at a found place: a lair's creature, a risk, or a place you have cleared.
 const dangerNote=id=>{const w=worldPlace(game,id);if(!w)return null;if(w.cleared)return 'Cleared';if(w.threat)return 'Lair of '+w.threat.name;if(w.danger==='risky')return 'Something may lurk here';return null;};
 const pick=selected&&ids.includes(selected)?selected:null,pickRoute=pick?routeTo(pick):null,canGo=id=>id!==here&&!!onTravel&&travelTo.includes(id);
 const places=[...ids].sort((a,b)=>(a===here?-1:b===here?1:(routeTo(a)?.feet??0)-(routeTo(b)?.feet??0)));
 const fighting=game.stage==='combat'||!!game.npcCombat?.active;
 return <View dataSet={{qb:'plate'}} style={s.panel} onLayout={e=>setWidth(Math.max(220,e.nativeEvent.layout.width-36))}>
  <View style={s.eyebrowRow}><Icon name="map" size={14} color={colors.goldMid}/><PlainText style={s.eyebrow}>Your region</PlainText></View>
  <Text style={s.heading}>{placeName(game,here)}</Text>
  <View accessibilityLabel={'Map of '+ids.length+' known places'} style={[s.region,{width:w,height:h}]}>
   <View dataSet={{qb:'region-paper'}} style={[StyleSheet.absoluteFill,{pointerEvents:'none'}]}/>
   <PlainText style={s.compassMark}>N ↑</PlainText>
   {worldLinks(game).filter(([a,b])=>at[a]&&at[b]).map(([a,b])=>{const p=at[a],q=at[b],len=Math.hypot(q.x-p.x,q.y-p.y),angle=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI,known=visited.has(a)&&visited.has(b);
    return <View key={a+'-'+b} style={[s.path,{left:(p.x+q.x)/2-len/2,top:(p.y+q.y)/2-1,width:len,transform:[{rotate:angle+'deg'}],opacity:known?.8:.4,pointerEvents:'none'}]}/>;})}
   {ids.map(id=>{const p=at[id],isHere=id===here,seen=visited.has(id),on=pick===id,label=labels[id];
    return <React.Fragment key={id}>
     <Pressable accessibilityRole="button" accessibilityLabel={placeName(game,id)+(isHere?', you are here':'')} accessibilityState={{selected:on}} onPress={()=>setSelected(on?null:id)} style={[s.node,{left:p.x-22,top:p.y-22}]}>
      <View dataSet={{qb:isHere?'node-here':undefined}} style={[s.nodeDot,isHere&&s.nodeHere,on&&s.nodeOn,!seen&&!isHere&&{opacity:.65,borderStyle:'dashed'}]}><Icon name={iconFor(id)} size={16} color={isHere?'#2a1a07':colors.gold}/></View>
      {!!worldPlace(game,id)?.threat&&<View style={s.lairMark}/>}
     </Pressable>
     <PlainText onPress={()=>setSelected(on?null:id)} numberOfLines={2} style={[s.nodeLabel,{left:label.x,top:label.y,width:label.w,textAlign:label.align},isHere&&{color:colors.goldBright}]}>{placeName(game,id)}</PlainText>
    </React.Fragment>;})}
  </View>
  {pick&&<View dataSet={{qb:'card'}} style={s.pickCard} accessibilityLiveRegion="polite">
   <View style={{flex:1,minWidth:0}}>
    <Text style={s.detailName}>{placeName(game,pick)}</Text>
    <Text style={[s.distance,pick===here&&{color:colors.goldBright}]}>{pick===here?'You are here':pickRoute?distanceText(pickRoute.feet)+' · '+durationText(pickRoute.minutes)+' on foot':'No known path'}{pick!==here?(visited.has(pick)?'  ·  Visited':'  ·  Not yet visited'):''}</Text>
    <Text style={s.detailText}>{placeDescription(game,pick)}</Text>
    {!!dangerNote(pick)&&<PlainText style={[s.danger,worldPlace(game,pick)?.cleared&&{color:colors.heal}]}>{dangerNote(pick)}</PlainText>}
    {!!worldPlace(game,pick)?.feature&&<PlainText style={s.feature}>Notable: {worldPlace(game,pick).feature}</PlainText>}
   </View>
   {canGo(pick)&&<Pressable accessibilityRole="button" accessibilityLabel={'Travel to '+placeName(game,pick)} onPress={()=>{onTravel(pick);setSelected(null);}} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="travel" size={14} color={colors.gold}/><PlainText style={s.travelText}>Travel</PlainText></View></Pressable>}
  </View>}
  <Text style={s.caption}>{fighting?'Finish or flee the fight before travelling.':game.stage==='dying'?'You cannot travel while dying.':game.stage==='dead'?'Your journey has ended.':'Tap a place, or tell the Dungeon Master where you want to go: a direction, a landmark on the horizon, somewhere you heard about. New places appear on this map as you find them.'}</Text>
  <View style={s.places}>{places.map(id=>{const isHere=id===here,route=routeTo(id),go=canGo(id);return <View key={id} dataSet={{qb:'card',selected:String(isHere)}} style={[s.place,isHere&&s.placeHere]}>
   <Pressable accessibilityRole="button" accessibilityLabel={placeName(game,id)+' — location details'} onPress={()=>setSelected(pick===id?null:id)} style={s.placeInfo}><View style={[s.placeIcon,isHere&&{borderColor:colors.gold}]}><Icon name={iconFor(id)} size={18} color={isHere?colors.goldBright:colors.gold}/></View><View style={{flex:1}}><Text style={s.detailName}>{placeName(game,id)}</Text><Text style={[s.distance,isHere&&{color:colors.goldBright}]}>{isHere?'You are here':route?distanceText(route.feet)+' · '+durationText(route.minutes)+' walk':'No known path'}{visited.has(id)&&!isHere?'  ·  Visited':''}</Text></View></Pressable>
   {go&&<Pressable accessibilityRole="button" accessibilityLabel={'Travel to '+placeName(game,id)} onPress={()=>onTravel(id)} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="travel" size={14} color={colors.gold}/><PlainText style={s.travelText}>Travel</PlainText></View></Pressable>}
  </View>;})}</View>
 </View>;
}
const s=StyleSheet.create({
 region:{alignSelf:'center',marginTop:12,borderRadius:4,overflow:'hidden',borderWidth:1,borderColor:colors.goldLine,backgroundColor:'rgba(22,30,34,.85)'},
 compassMark:{position:'absolute',top:8,right:10,fontFamily:fonts.display,fontSize:11,letterSpacing:1.5,color:'rgba(233,223,192,.7)'},
 path:{position:'absolute',height:2,borderRadius:1,backgroundColor:'rgba(232,199,123,.75)'},
 node:{position:'absolute',width:44,height:44,alignItems:'center',justifyContent:'center'},
 nodeDot:{width:34,height:34,borderRadius:17,borderWidth:1.5,borderColor:'rgba(232,199,123,.75)',backgroundColor:'rgba(12,16,24,.92)',alignItems:'center',justifyContent:'center'},
 nodeHere:{backgroundColor:'#d9ae5f',borderColor:'#fff0c4'},nodeOn:{borderColor:'#fff8db',borderWidth:2},
 nodeLabel:{position:'absolute',fontFamily:fonts.display,fontSize:10.5,lineHeight:14,fontWeight:'700',letterSpacing:.4,color:'#f2e4bf',...Platform.select({web:{textShadow:'0 1px 4px #05090b'},default:{}})},
 danger:{fontFamily:fonts.ui,fontSize:12,fontWeight:'700',color:colors.bloodBright,marginTop:6,letterSpacing:.3},feature:{fontFamily:fonts.story,fontStyle:'italic',fontSize:14.5,lineHeight:21,color:'#d8cfb8',marginTop:4},
 lairMark:{position:'absolute',top:3,right:3,width:10,height:10,borderRadius:5,backgroundColor:colors.bloodBright,borderWidth:1.5,borderColor:'#1a0a08'},
 pickCard:{flexDirection:'row',alignItems:'flex-start',gap:10,marginTop:12,padding:12,borderRadius:6,borderWidth:1,borderColor:'rgba(232,199,123,.45)',backgroundColor:'rgba(9,19,25,.9)'},
 panel:{backgroundColor:'rgba(12,16,24,.8)',borderColor:colors.goldLine,borderWidth:1,borderRadius:6,padding:18,marginVertical:14},eyebrowRow:{flexDirection:'row',alignItems:'center',gap:8},placeIcon:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'rgba(201,164,92,.4)',alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.25)'},travelRow:{flexDirection:'row',alignItems:'center',gap:6},eyebrow:{...type.label},heading:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,color:colors.parchment,fontSize:22,marginTop:6},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20,marginVertical:10},frame:{alignSelf:'center',borderRadius:3,overflow:'hidden',backgroundColor:'rgba(23,46,50,.68)',borderWidth:1,borderColor:colors.goldLine},
 places:{gap:8,marginTop:4},place:{flexDirection:'row',gap:10,alignItems:'center',padding:12,paddingRight:10,borderRadius:6,borderWidth:1,borderColor:'rgba(201,164,92,.25)'},placeInfo:{flex:1,flexDirection:'row',gap:12,alignItems:'center'},
 travel:{minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:'rgba(201,164,92,.5)',backgroundColor:'rgba(20,25,36,.92)',justifyContent:'center'},travelText:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.3,textTransform:'uppercase'},placeHere:{borderColor:colors.gold},placeGlyph:{fontSize:22,color:colors.gold,width:28,textAlign:'center',marginTop:2},north:{position:'absolute',top:15,left:16,color:'#e9dfc0',fontSize:13},marker:{position:'absolute',width:120,minHeight:44,justifyContent:'center',alignItems:'center'},mapLabel:{textAlign:'center',fontFamily:'Palatino Linotype, Book Antiqua, Georgia, serif',fontWeight:'600',fontStyle:'italic',fontSize:12,color:'#f5e3b6',...Platform.select({web:{textShadow:'1px 2px 5px #05090b'},default:{textShadowColor:'#05090b',textShadowRadius:5,textShadowOffset:{width:1,height:2}}}),backgroundColor:'rgba(9,17,20,.48)',borderRadius:4,paddingVertical:3,paddingHorizontal:6},here:{fontSize:8,letterSpacing:1,color:'#e9c87e',marginTop:3},details:{position:'absolute',left:12,right:12,top:42,padding:12,borderRadius:10,borderWidth:1,borderColor:'#7d765f',backgroundColor:'rgba(9,19,25,.96)'},detailName:{color:colors.parchment,fontSize:16,fontWeight:'700',letterSpacing:.6,fontFamily:fonts.display},detailText:{fontFamily:fonts.story,color:'#d9d3c3',fontSize:15.5,lineHeight:23,marginTop:6},distance:{fontFamily:fonts.ui,color:'#d2b780',fontSize:11.5,marginTop:5,letterSpacing:.3},close:{color:'#e9dfc0',fontSize:22,paddingHorizontal:10},clue:{color:'#dfddb2',fontSize:12,marginTop:4}});
