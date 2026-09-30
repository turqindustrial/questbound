import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import React,{useState} from 'react';
import {View,Image,Pressable,Platform,StyleSheet} from 'react-native';
import {mapPlaces,mapState,mapLocation,mapRoute} from './mapRules';
import {fonts,colors,type} from './theme';
const landscape=require('./assets/map/crossroads-landscape.png');
const centers={inn:{x:0.14,y:0.60},bridge:{x:0.80,y:0.66},tower:{x:0.80,y:0.015},dungeon:{x:0.78,y:0.90}};
const artCenters={inn:{x:0.14,y:0.73},bridge:{x:0.80,y:0.78},tower:{x:0.80,y:0.11}};
export default function AdventureMap({game,travelTo=[],onTravel}){
 const [width,setWidth]=useState(280),[hovered,setHovered]=useState(null),[focused,setFocused]=useState(null),[pinned,setPinned]=useState(null);
 const map=mapState(game),location=mapLocation(game),active=hovered??focused??pinned,w=Math.min(width,640),h=w*8/7;
 const place=active?mapPlaces[active]:null,route=active?mapRoute(location,active):null;
 if(game.story)return <View dataSet={{qb:'plate'}} style={s.panel}><Text style={s.eyebrow}>◈  YOUR REGION</Text><Text style={s.heading}>Places you can travel</Text><DynamicArt subject={locationArtSubject(game)} statusOnly style={{width:'100%',minHeight:64,marginTop:12}}/><Text style={s.caption}>You are at {game.story.locations[location==='dungeon'?'bridge':location]?.name}. {onTravel&&travelTo.length?'Tap Travel to set out, or tell the Dungeon Master where you want to go.':game.stage==='combat'?'Finish or flee the fight before travelling.':'Tell the Dungeon Master where you want to go.'}</Text><View style={s.places}>{Object.entries(game.story.locations).map(([id,p])=>{const here=location===id,route=mapRoute(location,id),go=!here&&!!onTravel&&travelTo.includes(id);return <View key={id} dataSet={{qb:'card',selected:String(here)}} style={[s.place,here&&s.placeHere]}><Pressable accessibilityRole="button" accessibilityLabel={p.name+' — location details'} onHoverIn={()=>setHovered(id)} onHoverOut={()=>setHovered(null)} onFocus={()=>setFocused(id)} onBlur={()=>setFocused(null)} onPress={()=>setPinned(pinned===id?null:id)} style={s.placeInfo}><Text style={s.placeGlyph}>{id==='inn'?'⌂':id==='bridge'?'⚔':'♜'}</Text><View style={{flex:1}}><Text style={s.detailName}>{p.name}</Text><Text style={s.distance}>{here?'◆ You are here':route?.feet.toLocaleString()+' ft · '+route?.minutes+' min walk'}{map.visited.includes(id)&&!here?'  ·  Visited':''}</Text>{active===id&&<Text style={s.detailText}>{p.description}</Text>}</View></Pressable>{go&&<Pressable accessibilityRole="button" accessibilityLabel={'Travel to '+p.name} onPress={()=>onTravel(id)} dataSet={{qb:'chip'}} style={s.travel}><Text style={s.travelText}>Travel ›</Text></Pressable>}</View>;})}</View></View>;
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
const s=StyleSheet.create({panel:{backgroundColor:'rgba(12,16,24,.8)',borderColor:colors.goldLine,borderWidth:1,borderRadius:4,padding:18,marginVertical:18},eyebrow:{...type.label},heading:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,color:colors.parchment,fontSize:22,marginTop:6},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20,marginVertical:10},frame:{alignSelf:'center',borderRadius:3,overflow:'hidden',backgroundColor:'rgba(23,46,50,.68)',borderWidth:1,borderColor:colors.goldLine},
 places:{gap:8,marginTop:4},place:{flexDirection:'row',gap:10,alignItems:'center',padding:14,paddingRight:10,borderRadius:3,borderWidth:1,borderColor:'rgba(201,164,92,.25)'},placeInfo:{flex:1,flexDirection:'row',gap:14,alignItems:'flex-start'},
 travel:{minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:'rgba(201,164,92,.5)',backgroundColor:'rgba(20,25,36,.92)',justifyContent:'center'},travelText:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.3,textTransform:'uppercase'},placeHere:{borderColor:colors.gold},placeGlyph:{fontSize:22,color:colors.gold,width:28,textAlign:'center',marginTop:2},north:{position:'absolute',top:15,left:16,color:'#e9dfc0',fontSize:13},marker:{position:'absolute',width:120,minHeight:44,justifyContent:'center',alignItems:'center'},mapLabel:{textAlign:'center',fontFamily:'Palatino Linotype, Book Antiqua, Georgia, serif',fontWeight:'600',fontStyle:'italic',fontSize:12,color:'#f5e3b6',...Platform.select({web:{textShadow:'1px 2px 5px #05090b'},default:{textShadowColor:'#05090b',textShadowRadius:5,textShadowOffset:{width:1,height:2}}}),backgroundColor:'rgba(9,17,20,.48)',borderRadius:4,paddingVertical:3,paddingHorizontal:6},here:{fontSize:8,letterSpacing:1,color:'#e9c87e',marginTop:3},details:{position:'absolute',left:12,right:12,top:42,padding:12,borderRadius:10,borderWidth:1,borderColor:'#7d765f',backgroundColor:'rgba(9,19,25,.96)'},detailName:{color:colors.parchment,fontSize:16,fontWeight:'700',letterSpacing:.6,fontFamily:fonts.display},detailText:{fontFamily:fonts.story,color:'#d9d3c3',fontSize:15.5,lineHeight:23,marginTop:6},distance:{fontFamily:fonts.ui,color:'#d2b780',fontSize:11.5,marginTop:5,letterSpacing:.3},close:{color:'#e9dfc0',fontSize:22,paddingHorizontal:10},clue:{color:'#dfddb2',fontSize:12,marginTop:4}});
