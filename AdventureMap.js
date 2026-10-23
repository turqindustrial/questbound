import {EntityText as Text} from './EncounterOverlay';
import DynamicArt from './DynamicArt';
import {locationArtSubject} from './worldArtRules';
import React,{useState,useEffect,useRef,useMemo} from 'react';
import {View,Image,Pressable,Platform,StyleSheet,Modal,ScrollView,useWindowDimensions} from 'react-native';
import {mapPlaces,mapState,mapLocation,mapRoute,knownPlaceIds,placeCoordinates,placeName,placeDescription,worldPlace,worldPlaces,worldLinks,travelRoute,distanceText,durationText,placeIcons,mapRegions,regionOfPlace,currentRegion,beyondWords,beyondBarred} from './mapRules';
import {fonts,colors,type,tint} from './theme';
import Icon from './Icon';
import {WrapRow} from './ui';
import {Text as PlainText} from 'react-native';
import {regionLayout,regionLabels,landCities,cityLayout,landsLayout,landsSheetScale,placeKindOf} from './mapLayout';
import {npcIdsOf,npcLore,metPerson,npcWhereabouts} from './npcRules';
import {regionMapSvg,exitLabelBoxes,landsMapSvg} from './mapArt';
const web=Platform.OS==='web';
const landscape=require('./assets/map/crossroads-landscape.jpg');
const centers={inn:{x:0.14,y:0.60},bridge:{x:0.80,y:0.66},tower:{x:0.80,y:0.015},dungeon:{x:0.78,y:0.90}};
const artCenters={inn:{x:0.14,y:0.73},bridge:{x:0.80,y:0.78},tower:{x:0.80,y:0.11}};
export default function AdventureMap({game,travelTo=[],onTravel,beyond=[],onBeyond}){
 const [width,setWidth]=useState(280),[hovered,setHovered]=useState(null),[focused,setFocused]=useState(null),[pinned,setPinned]=useState(null);
 const map=mapState(game),location=mapLocation(game),active=hovered??focused??pinned,w=Math.min(width,640),h=w*8/7;
 const place=active?mapPlaces[active]:null,route=active?mapRoute(location,active):null;
 if(game.story)return <RegionMap game={game} travelTo={travelTo} onTravel={onTravel} beyond={beyond} onBeyond={onBeyond}/>;
 return <View dataSet={{qb:'plate'}} style={s.panel} onLayout={e=>setWidth(Math.max(180,e.nativeEvent.layout.width-24))}>
  <Text style={s.eyebrow}>THE LANTERN ROAD</Text><Text style={s.heading}>The Crossroads</Text>
  <Text style={s.caption}>At {mapPlaces[location].name} · Hover, focus, or tap a name to explore.</Text>
  <View style={[s.frame,{width:w,height:h}]}>
   {/* Explicit dimensions prevent React Native Web's intrinsic image size from cropping landmarks and roads. */}
   <Image source={landscape} resizeMode="stretch" style={{position:'absolute',left:0,top:0,width:w,height:h}} accessibilityLabel="Painted crossroads: inn, stone bridge and ruined watchtower connected by walking paths"/>
   <View style={[StyleSheet.absoluteFillObject,{pointerEvents:'none'},Platform.OS==='web'?{backgroundImage:tint('linear-gradient(180deg, rgba(16,8,17,.18) 0%, transparent 20%, transparent 85%, rgba(16,8,17,.35) 100%)')}:{backgroundColor:tint('rgba(16,8,17,.04)')}]}/>
   <Text style={s.north}>↑ N</Text>
   {Object.entries(centers).map(([id,point])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={mapPlaces[id].name+' — show location details'} accessibilityState={{expanded:active===id}} onHoverIn={()=>setHovered(id)} onHoverOut={()=>setHovered(null)} onFocus={()=>setFocused(id)} onBlur={()=>setFocused(null)} onPress={()=>setPinned(pinned===id?null:id)} style={[s.marker,{left:Math.max(4,Math.min(w-124,w*point.x-60)),top:h*point.y}]}>
    <Text style={[s.mapLabel,active===id&&{color:tint('#fff8db')}]}>{mapPlaces[id].name}</Text>
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
// Three views zoom out one from the other (2026-10-23, the host: "we can have it zoom out to show all areas around, or
// zoom in to focus on different areas in the city ... make it possible for the map to zoom out even further once the
// player leaves the initial map"): a City (a settlement and its quarters drawn to scale, mapLayout.js landCities), the
// Whole land (the region sheet) and All lands (every land the hero knows, once there is more than one). − at a sheet's
// widest steps out to the next view. Every journey is the same move the map always sent (onTravel with a place id).
const coreIcons={inn:'home',bridge:'swords',tower:'tower'},coreKinds={inn:'start',bridge:'danger',tower:'high'};
const placeIconOf=(game,id)=>worldPlace(game,id)?placeIcons[worldPlace(game,id).kind]??'compass':id==='inn'?'home':placeIcons[game.story?.locations?.[id]?.kind]??coreIcons[id]??'compass';
const kindWords={settlement:'Town',camp:'Camp',road:'Road',forest:'Forest',wilds:'Wilds',mountain:'Mountains',water:'Waterside',ruin:'Ruin',cave:'Cave',shrine:'Shrine',landmark:'Landmark',lair:'Lair',castle:'Stronghold'};
const terrainWords={plains:'Plains',forest:'Forest',hills:'Hills',mountains:'Mountains',coast:'Coast',marsh:'Marsh',desert:'Desert',snow:'Snowfields',caverns:'Caverns'};
const kindWord=(game,id)=>{const k=placeKindOf(game,id);return k?kindWords[k]??k[0].toUpperCase()+k.slice(1):null;};
// Who lives at a place, as far as the hero knows: people met (or residents of a place the hero has been to) whose home
// it is, alive and not travelling with the hero.
const livesAt=(game,id)=>npcIdsOf(game).filter(n=>!game.people?.[n]?.hidden&&game.npcFate?.[n]!=='dead'&&metPerson(game,n)&&npcWhereabouts(game,n)===id).map(n=>npcLore(game,n)?.name).filter(Boolean);
// A description in brief: its first sentence, at most 160 characters.
const brief=text=>{const t=String(text??'').trim(),first=t.match(/^.*?[.!?](?=\s|$)/)?.[0]??t;return first.length>160?first.slice(0,157).replace(/\s+\S*$/,'')+'…':first;};
const zooms=[1,1.6,2.4];
const shortMiles=feet=>distanceText(feet).replace(' miles',' mi');
// The frame every sheet sits in: the sheet scrolls inside it when zoomed, + and − sit in its corner (− at the widest
// view steps out to the wider map when there is one), and the compass button brings the hero back into view. A focus
// (a district picked on a city sheet) is zoomed in to and centred.
function MapFrame({w,h,W,H,zoom,setZoom,levels,label,focusAt,homeAt,resetKey,focusKey,focusZoom=0,upLabel,onUp,children}){
 // Zoomed, the buttons move to a strip of their own at the sheet's right, so they never cover a place or a name.
 const scroller=useRef(null),seen=useRef(focusKey),latest=useRef(null),zoomed=W>w+1||H>h+1,vw=zoomed?w-48:w;
 latest.current={focusAt,homeAt};
 const scroll=(p,smooth)=>{p=p??{x:W/2,y:H/2};scroller.current?.scrollTo?.({left:Math.max(0,p.x-vw/2),top:Math.max(0,p.y-h/2),behavior:smooth?'smooth':'auto'});};
 useEffect(()=>{scroll(latest.current.focusAt,false);},[zoom,w,h,resetKey]);
 useEffect(()=>{if(seen.current===focusKey)return;seen.current=focusKey;if(focusKey==null)return;if(zoom<focusZoom)setZoom(focusZoom);else scroll(latest.current.focusAt,true);},[focusKey]);
 const out=zoom===0&&!!onUp;
 const tool=(label,text,onPress,disabled)=><Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} dataSet={{qb:'map-tool',tip:label}} style={[s.tool,disabled&&{opacity:.45}]}>{typeof text==='string'?<PlainText style={s.toolText}>{text}</PlainText>:text}</Pressable>;
 return <View dataSet={{qb:'map-frame'}} accessibilityLabel={label} style={[s.region,{width:w,height:h}]}>
  <View ref={scroller} dataSet={{qb:'map-scroll',zoomed:String(zoomed)}} style={{width:vw,height:h}}>
   <View style={{width:W,height:H}}>{children}</View>
  </View>
  {zoomed&&<View style={s.gutter}/>}
  <View style={[s.tools,zoomed&&{right:5}]}>
   {tool('Zoom in','+',()=>setZoom(v=>Math.min(levels.length-1,v+1)),zoom===levels.length-1)}
   {tool(out?upLabel:'Zoom out','−',out?onUp:()=>setZoom(v=>Math.max(0,v-1)),zoom===0&&!onUp)}
   {zoomed&&tool('Centre on where you are',<Icon name="compass" size={17} color={tint('#3b2a17')}/>,()=>scroll(latest.current.homeAt,true),false)}
  </View>
 </View>;
}
// A marker's tap target and, on the web, the tap target over its name (the name itself is drawn in the sheet).
function MarkerTaps({game,id,p,label,selected,onSelect,here,size=44,name}){
 const on=selected===id,isHere=id===here,title=name??placeName(game,id);
 return <>
  <Pressable accessibilityRole="button" accessibilityLabel={title+(isHere?', you are here':'')} accessibilityState={{selected:on}} onPress={()=>onSelect(on?null:id)} style={[s.node,{left:p.x-size/2,top:p.y-size/2,width:size,height:size}]}>{!web&&<View style={[s.nodeDot,isHere&&s.nodeHere]}><Icon name={placeIconOf(game,id)} size={16} color={isHere?'#f8e9c4':'#3b2a17'}/></View>}</Pressable>
  {!!label&&(web?<Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={()=>onSelect(on?null:id)} style={{position:'absolute',left:label.x,top:label.y,width:label.w,height:label.h}}/>
   :<PlainText onPress={()=>onSelect(on?null:id)} numberOfLines={2} style={[s.nodeLabel,{left:label.x,top:label.y,width:label.w,textAlign:label.align}]}>{title}</PlainText>)}
 </>;
}
const cornerOf=(W,H)=>({x:W-52,y:H-98,w:52,h:98}),titleBox=(H,W,title)=>({x:8,y:H-30,w:Math.min(W-70,title.length*8.2+14),h:24});
function RegionSheet({game,w,h,selected,onSelect,region,onRegion,onUp,upLabel}){
 const [zoom,setZoom]=useState(0);
 const z=zooms[zoom],W=Math.round(w*z),H=Math.round(h*z);
 const here=mapLocation(game),visited=new Set(mapState(game).visited),regions=mapRegions(game),land=regions.find(r=>r.id===region)??regions[0];
 const layout=regionLayout(game,W,H,{region:land.id,keepOut:zoom===0?[cornerOf(W,H)]:[]}),{ids,at,links,exits}=layout;
 // Roads out are named after the land they lead to.
 const exitNames=Object.fromEntries(exits.map(e=>[e.to,(regions.find(r=>r.id===e.region)??regions[0]).name])),exitBoxes=exitLabelBoxes(exits,exitNames,W,H);
 // At full view the corner under the zoom buttons and the map's title are kept clear of names.
 const avoid=[...(zoom===0?[cornerOf(W,H)]:[]),titleBox(H,W,land.name),...exitBoxes.map(e=>({x:e.lx-2,y:e.ly-2,w:e.tw+4,h:16}))];
 const labels=regionLabels(game,W,H,layout,{here,selected,avoid});
 const distances=Object.fromEntries(links.map(([a,b])=>{const p=placeCoordinates(game,a),q=placeCoordinates(game,b);return [a+'-'+b,p&&q?shortMiles(Math.round(Math.hypot(p.x-q.x,p.y-q.y))):null];}));
 const svg=web?regionMapSvg({w:W,h:H,seed:(game.story?.id??'region')+':'+land.id,terrain:land.terrain,ids,at,links,exits,exitNames,labels,here,visited,selected,distances,avoid:avoid.slice(0,zoom===0?1:0),
  kinds:Object.fromEntries(ids.map(id=>[id,placeKindOf(game,id)??coreKinds[id]??'wilds'])),icons:Object.fromEntries(ids.map(id=>[id,placeIconOf(game,id)])),
  lairs:new Set(ids.filter(id=>!!worldPlace(game,id)?.threat)),cleared:new Set(ids.filter(id=>!!worldPlace(game,id)?.cleared)),title:land.name}):null;
 // Zooming keeps the hero's place in the middle of the frame (or the middle of a sheet the hero is not on).
 return <MapFrame w={w} h={h} W={W} H={H} zoom={zoom} setZoom={setZoom} levels={zooms} label={'Map of '+land.name+': '+ids.length+' known places'} focusAt={at[here]} homeAt={at[here]} resetKey={here+':'+land.id} onUp={onUp} upLabel={upLabel}>
  {web?React.createElement('svg',{viewBox:'0 0 '+W+' '+H,width:W,height:H,'aria-hidden':true,focusable:'false',style:{position:'absolute',left:0,top:0,display:'block',pointerEvents:'none'},dangerouslySetInnerHTML:{__html:svg}})
   :<View style={[StyleSheet.absoluteFill,{backgroundColor:'#dcc694'}]}/>}
  {!!at[here]&&<View dataSet={{qb:'map-here'}} style={[s.herePulse,{left:at[here].x-15,top:at[here].y-15}]}/>}
  {ids.map(id=><MarkerTaps key={id} game={game} id={id} p={at[id]} label={labels[id]} selected={selected} onSelect={onSelect} here={here}/>)}
  {/* A road out of this region: tap where it leaves the sheet to turn to that land's map. */}
  {exitBoxes.map(e=><Pressable key={'exit:'+e.from+':'+e.to} accessibilityRole="button" accessibilityLabel={'Show the map of '+exitNames[e.to]} onPress={()=>onRegion?.(e.region)} style={{position:'absolute',left:Math.min(e.lx,e.x-22),top:Math.min(e.ly,e.y-22),width:Math.max(e.lx+e.tw,e.x+22)-Math.min(e.lx,e.x-22),height:Math.max(e.ly+18,e.y+22)-Math.min(e.ly,e.y-22)}}/>)}
 </MapFrame>;
}
// A city drawn to scale (its names a size smaller than a land's): its districts where they truly lie, the roads between them, a scale bar, and what lies outside
// it at the edge with a pointer. It opens at the least zoom that names every district, and a district tapped is zoomed
// in to and centred, its card below.
function citySheet(game,city,W,H,{here,selected,cornered}){
 const layout=cityLayout(game,city,W,H,{keepOut:cornered?[cornerOf(W,H)]:[]}),outside=Object.fromEntries(layout.outside.map(o=>[o.id,o]));
 const all={ids:[...layout.ids,...layout.outside.map(o=>o.id)],at:{...layout.at,...Object.fromEntries(layout.outside.map(o=>[o.id,{x:o.x,y:o.y}]))}};
 const avoid=[...(cornered?[cornerOf(W,H)]:[]),titleBox(H,W,city.name),{x:10,y:8,w:Math.max(layout.bar.px,layout.bar.text.length*5.4)+16,h:30}];
 const labels=regionLabels(game,W,H,all,{here,selected,avoid,charWidth:5.46,lineHeight:13.9,nameOf:id=>outside[id]?placeName(game,id)+' · '+shortMiles(outside[id].feet):placeName(game,id)});
 return {layout,all,labels,avoid};
}
function CitySheet({game,city,w,h:base,selected,onSelect,onUp}){
 const here=mapLocation(game),visited=new Set(mapState(game).visited),regions=mapRegions(game),land=regions.find(r=>r.id===city.region)??regions[0];
 // The sheet is made taller (up to twice its height: the page scrolls, not the sheet) until every district is named;
 // only when that is not enough does it open zoomed in.
 const plan=useMemo(()=>{const named=(W,H,cornered)=>{const {layout,labels}=citySheet(game,city,W,H,{here,selected:null,cornered});return layout.ids.every(id=>labels[id]);};
  for(const k of [1,1.2,1.4,1.6,1.8,2]){const H=Math.round(base*k);if(named(w,H,true))return {h:H,start:0};}
  for(let i=1;i<zooms.length;i++)if(named(Math.round(w*zooms[i]),Math.round(base*zooms[i]),false))return {h:base,start:i};
  return {h:base,start:zooms.length-1};},[w,base,city.id,city.ids.join(),game.story?.id]);
 const h=plan.h,[zoom,setZoom]=useState(plan.start);
 const z=zooms[zoom],W=Math.round(w*z),H=Math.round(h*z),cornered=W<=w+1&&H<=h+1;
 const {layout,all,labels,avoid}=citySheet(game,city,W,H,{here,selected,cornered}),{ids,at,links}=layout;
 const distances=Object.fromEntries(links.map(([a,b])=>{const p=placeCoordinates(game,a),q=placeCoordinates(game,b);return [a+'-'+b,p&&q?shortMiles(Math.round(Math.hypot(p.x-q.x,p.y-q.y))):null];}));
 const svg=web?regionMapSvg({w:W,h:H,seed:(game.story?.id??'region')+':city:'+city.id,terrain:land.terrain,ids,at,links,labels,here,visited,selected,distances,avoid:cornered?avoid.slice(0,1):[],city:true,nameSize:12.5,bar:layout.bar,outside:layout.outside,
  kinds:Object.fromEntries(ids.map(id=>[id,placeKindOf(game,id)??coreKinds[id]??'settlement'])),icons:Object.fromEntries(all.ids.map(id=>[id,placeIconOf(game,id)])),
  lairs:new Set(ids.filter(id=>!!worldPlace(game,id)?.threat)),cleared:new Set(ids.filter(id=>!!worldPlace(game,id)?.cleared)),title:city.name}):null;
 const focus=all.at[selected]??all.at[here]??null;
 return <MapFrame w={w} h={h} W={W} H={H} zoom={zoom} setZoom={setZoom} levels={zooms} label={'City map of '+city.name+': '+ids.length+' places in the city, '+layout.outside.length+' outside it'} focusAt={focus} homeAt={all.at[here]} resetKey={here+':'+city.id} focusKey={selected} focusZoom={1} onUp={onUp} upLabel="Show the whole land">
  {web?React.createElement('svg',{viewBox:'0 0 '+W+' '+H,width:W,height:H,'aria-hidden':true,focusable:'false',style:{position:'absolute',left:0,top:0,display:'block',pointerEvents:'none'},dangerouslySetInnerHTML:{__html:svg}})
   :<View style={[StyleSheet.absoluteFill,{backgroundColor:'#dcc694'}]}/>}
  {!!all.at[here]&&<View dataSet={{qb:'map-here'}} style={[s.herePulse,{left:all.at[here].x-15,top:all.at[here].y-15}]}/>}
  {all.ids.map(id=><MarkerTaps key={id} game={game} id={id} p={all.at[id]} label={labels[id]} selected={selected} onSelect={onSelect} here={here} size={layout.at[id]?44:38}/>)}
 </MapFrame>;
}
// Every land the hero knows on one sheet. With many lands the sheet starts larger than its frame (and scrolls), so every
// land keeps a mark and a tap of its own; tapping one shows the way back to it and its own map.
function LandsSheet({game,w,h,selected,onSelect}){
 const regions=mapRegions(game),visited=new Set(mapState(game).visited),here=mapLocation(game);
 const count=useMemo(()=>new Set(knownPlaceIds(game).map(id=>regionOfPlace(game,id))).size,[game]);
 const base=landsSheetScale(count,w,h),levels=[base,Math.round(base*16)/10,Math.round(base*24)/10];
 const [zoom,setZoom]=useState(0);
 const z=levels[zoom],W=Math.round(w*z),H=Math.round(h*z),cornered=W<=w+1&&H<=h+1;
 const layout=landsLayout(game,W,H,{keepOut:cornered?[cornerOf(W,H)]:[]}),{ids,at,roads,radius}=layout,nameOf=id=>(regions.find(r=>r.id===id)??regions[0]).name;
 const avoid=[...(cornered?[cornerOf(W,H)]:[]),titleBox(H,W,'All lands')];
 const labels=regionLabels(game,W,H,layout,{here:layout.here,selected,avoid,nameOf,marker:2*radius+6,reach:radius+5});
 const seen=new Set(knownPlaceIds(game).filter(id=>visited.has(id)||id===here).map(id=>regionOfPlace(game,id)));
 const svg=web?landsMapSvg({w:W,h:H,seed:game.story?.id??'lands',ids,at,roads,labels,terrains:Object.fromEntries(ids.map(id=>[id,(regions.find(r=>r.id===id)??regions[0]).terrain])),here:layout.here,visited:seen,selected,radius,title:'All lands'}):null;
 return <MapFrame w={w} h={h} W={W} H={H} zoom={zoom} setZoom={setZoom} levels={levels} label={'Map of all lands: '+ids.length+' lands'} focusAt={at[selected]??at[layout.here]} homeAt={at[layout.here]} resetKey={layout.here}>
  {web?React.createElement('svg',{viewBox:'0 0 '+W+' '+H,width:W,height:H,'aria-hidden':true,focusable:'false',style:{position:'absolute',left:0,top:0,display:'block',pointerEvents:'none'},dangerouslySetInnerHTML:{__html:svg}})
   :<View style={[StyleSheet.absoluteFill,{backgroundColor:'#dcc694'}]}/>}
  {ids.map(id=><MarkerTaps key={id} game={game} id={id} p={at[id]} label={labels[id]} selected={selected} onSelect={onSelect} here={layout.here} name={nameOf(id)}/>)}
 </MapFrame>;
}
// Beyond the edge of the map: a compass of the ways out of the land the hero stands in. A direction is picked first and
// then confirmed (the road takes days), and the game opens a new land out there (mapRules.js goBeyond). While the tale
// bars the road out (beyondBarred), the card says so: whoever watches it must be fought on arrival.
const roseRows=[['NW','N','NE'],['W',null,'E'],['SW','S','SE']];
function BeyondCard({land,beyond,onBeyond,close,barred=false}){
 const [aim,setAim]=useState(null),ok=b=>beyond.includes(b);
 return <View dataSet={{qb:'card'}} style={s.pickCard} accessibilityLabel={'Beyond the map of '+land}>
  <View style={s.rose}>{roseRows.map((row,i)=><View key={i} style={s.roseRow}>{row.map(b=>b?<Pressable key={b} accessibilityRole="button" accessibilityLabel={'Beyond the map to the '+beyondWords[b]} accessibilityState={{selected:aim===b,disabled:!ok(b)}} disabled={!ok(b)} onPress={()=>setAim(aim===b?null:b)} dataSet={{qb:aim===b?'seg-on':'chip'}} style={[s.roseCell,aim===b&&s.roseOn,!ok(b)&&{opacity:.35}]}><PlainText style={[s.roseText,aim===b&&{color:colors.goldBright}]}>{b}</PlainText></Pressable>:<View key="centre" style={s.roseCentre}><Icon name="compass" size={16} color={colors.goldMid}/></View>)}</View>)}</View>
  <View style={{flex:1,minWidth:0}}>
   <Text style={s.detailName}>Beyond the map</Text>
   <PlainText style={s.beyondText}>{(aim?'Leave '+land+' by the road '+beyondWords[aim]+': days on the road, to a land not yet on any map.':'Pick a way out of '+land+' to find a new land past the edge. Lands you leave stay on your map, and you can always travel back.')+(barred?' The road out is watched while this tale’s trouble lasts: you will have to fight your way through.':'')}</PlainText>
   {!!aim&&<Pressable accessibilityRole="button" accessibilityLabel={'Set out '+beyondWords[aim]+', beyond the map'} onPress={()=>{onBeyond(aim);setAim(null);close?.();}} dataSet={{qb:'chip'}} style={[s.travel,{alignSelf:'flex-start',marginTop:8}]}><View style={s.travelRow}><Icon name="travel" size={14} color={colors.gold}/><PlainText style={s.travelText}>Set out</PlainText></View></Pressable>}
  </View>
 </View>;
}
function RegionMap({game,travelTo,onTravel,beyond=[],onBeyond}){
 const [width,setWidth]=useState(300),[selected,setSelected]=useState(null),[open,setOpen]=useState(false);
 const {width:winW,height:winH}=useWindowDimensions();
 const map=mapState(game),here=mapLocation(game),ids=knownPlaceIds(game),visited=new Set(map.visited);
 // Which region's sheet is showing: the one the hero is in, until another is picked (and again once they move on).
 // Which view: the city the hero stands in when there is one, else the whole land, until the player picks another.
 const regions=mapRegions(game),home=currentRegion(game),[turned,setTurned]=useState(null),[view,setView]=useState(null),[cityPick,setCityPick]=useState(null),[landPick,setLandPick]=useState(null);
 useEffect(()=>{setTurned(null);setView(null);setCityPick(null);setLandPick(null);},[home,game.story?.id]);
 const shown=regions.find(r=>r.id===turned)??regions.find(r=>r.id===home)??regions[0],sheetIds=ids.filter(id=>regionOfPlace(game,id)===shown.id);
 const cities=useMemo(()=>landCities(game,shown.id),[game,shown.id]),myCity=cities.find(c=>c.ids.includes(here))??null;
 const city=cities.find(c=>c.id===cityPick)??myCity??cities[0]??null;
 const landIds=useMemo(()=>[...new Set(ids.map(id=>regionOfPlace(game,id)))],[game]),manyLands=landIds.length>1;
 const mode=view==='lands'&&manyLands?'lands':view==='city'&&city?'city':view==null&&myCity?'city':'land';
 const setMode=m=>{setView(m);setSelected(null);setLandPick(null);};
 const turnTo=id=>{setTurned(id);setSelected(null);setView('land');setCityPick(null);setLandPick(null);};
 const openCity=c=>{setView('city');setCityPick(c.id);};
 // Over the sheet: where the hero stands (on their own land's sheet), the city, or every land.
 const count=sheetIds.length+(sheetIds.length===1?' place':' places'),seenLands=landIds.filter(r=>ids.some(id=>regionOfPlace(game,id)===r&&(visited.has(id)||id===here))).length;
 const sheetTitle=mode==='lands'?landIds.length+' lands · '+seenLands+' visited':mode==='city'?shown.name+' · city of '+city.ids.length+' places':shown.id===home?shown.name+' · '+count:'Another land · '+count;
 const sheetHeading=mode==='lands'?'All lands':mode==='city'?city.name:shown.id===home?placeName(game,here):shown.name;
 // The sheet is as wide as its panel and nearly square on a phone, where the Map tab has the height for it.
 const w=Math.max(230,Math.min(width,760)),h=Math.round(Math.max(250,Math.min(560,w*(w<480?.95:.68))));
 // The full map leaves room for its heading, the views and the row of lands, even on a phone held sideways; whatever
 // is picked scrolls under it. On a short screen the views and lands sit beside the heading, so the sheet keeps its height.
 const shortWin=winH<480&&winW>=600;
 const views=[manyLands&&['lands','All lands','compass'],['land','Whole land','map'],city&&['city',cities.length>1?'Cities':'City','home']].filter(Boolean);
 const rows=(views.length>1&&!shortWin?44:0)+(((mode==='land'&&regions.length>1)||(mode==='city'&&cities.length>1))&&!shortWin?46:0);
 const bigW=Math.max(260,Math.min(winW-28,1180)),bigH=Math.max(150,Math.min(winH-(winW<600?210:shortWin?112:150)-rows,Math.round(bigW*.8)));
 const routeTo=id=>id===here?null:travelRoute(game,here,id);
 // What waits at a found place: a lair's creature, a risk, or a place you have cleared.
 const dangerNote=id=>{const w=worldPlace(game,id);if(!w)return null;if(w.cleared)return 'Cleared';if(w.threat)return 'Lair of '+w.threat.name;if(w.danger==='risky')return 'Something may lurk here';return null;};
 const canGo=id=>id!==here&&!!onTravel&&travelTo.includes(id);
 const pick=selected&&ids.includes(selected)?selected:null,pickRoute=pick?routeTo(pick):null,pickCity=mode==='land'&&pick?cities.find(c=>c.ids.includes(pick)):null;
 const listed=mode==='city'?[...city.ids,...city.outside.map(o=>o.id)]:sheetIds;
 const places=[...listed].sort((a,b)=>(a===here?-1:b===here?1:(routeTo(a)?.feet??0)-(routeTo(b)?.feet??0)));
 // The regions the hero knows, as a row of sheets to turn to (shown once there is more than one).
 // One line of lands; when they do not fit, a More chip shows the rest (nothing scrolls sideways; opened, at most four
 // lines, then it scrolls up and down). Lands travelled are never forgotten, so there may be many: the land the hero is
 // in comes first, then the one on show, the home land, and the rest by the last time the hero was there.
 const tabOrder=[...new Map([home,shown.id,'home',...regions.map((r,i)=>({r,i})).sort((a,b)=>(b.r.last??-1)-(a.r.last??-1)||a.i-b.i).map(({r})=>r.id)].map(id=>[id,regions.find(r=>r.id===id)]).filter(([,r])=>r)).values()];
 const regionTabs=(inline=false)=>mode==='land'&&regions.length>1&&<WrapRow rows={1} openRows={4} rowHeight={36} gap={6} resetKey={shown.id} label="Lands" accessibilityRole="tablist" style={[s.regionBar,inline&&s.regionInline]}>{tabOrder.map(r=>{const on=r.id===shown.id;return <Pressable key={r.id} accessibilityRole="tab" accessibilityState={{selected:on}} accessibilityLabel={'Map of '+r.name+(r.id===home?', where you are':'')} onPress={()=>turnTo(r.id)} dataSet={{qb:on?'seg-on':'chip'}} style={[s.regionTab,on&&s.regionTabOn]}>{r.id===home&&<View style={s.regionDot}/>}<PlainText numberOfLines={1} style={[s.regionTabText,on&&{color:colors.goldBright}]}>{r.name}</PlainText></Pressable>;})}</WrapRow>;
 // Two towns in one land: a row of cities to choose between.
 const cityTabs=(inline=false)=>mode==='city'&&cities.length>1&&<WrapRow rows={1} openRows={3} rowHeight={36} gap={6} resetKey={city.id} label="Cities" accessibilityRole="tablist" style={[s.regionBar,inline&&s.regionInline]}>{cities.map(c=>{const on=c.id===city.id;return <Pressable key={c.id} accessibilityRole="tab" accessibilityState={{selected:on}} accessibilityLabel={'City map of '+c.name+(c===myCity?', where you are':'')} onPress={()=>{setCityPick(c.id);setSelected(null);}} dataSet={{qb:on?'seg-on':'chip'}} style={[s.regionTab,on&&s.regionTabOn]}>{c===myCity&&<View style={s.regionDot}/>}<PlainText numberOfLines={1} style={[s.regionTabText,on&&{color:colors.goldBright}]}>{c.name}</PlainText></Pressable>;})}</WrapRow>;
 // The views, widest first: All lands, the Whole land, the City.
 const viewTabs=(inline=false)=>views.length>1&&<View accessibilityRole="tablist" accessibilityLabel="Map views" style={[s.viewRow,inline&&s.viewInline]}>{views.map(([id,label,icon])=>{const on=mode===id;return <Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:on}} accessibilityLabel={id==='lands'?'Show all lands':id==='land'?'Show the whole land':'Show the city of '+city.name} onPress={()=>setMode(id)} dataSet={{qb:on?'seg-on':'chip'}} style={[s.viewTab,on&&s.regionTabOn]}><Icon name={icon} size={14} color={on?colors.goldBright:colors.gold}/><PlainText numberOfLines={1} style={[s.regionTabText,on&&{color:colors.goldBright}]}>{label}</PlainText></Pressable>;})}</View>;
 const fighting=game.stage==='combat'||!!game.npcCombat?.active;
 const sheet=(sw,sh)=>mode==='lands'?<LandsSheet key={'lands:'+sw+'x'+sh} game={game} w={sw} h={sh} selected={landPick} onSelect={setLandPick}/>
  :mode==='city'?<CitySheet key={'city:'+city.id+':'+sw+'x'+sh} game={game} city={city} w={sw} h={sh} selected={pick} onSelect={setSelected} onUp={()=>setMode('land')}/>
  :<RegionSheet key={'land:'+sw+'x'+sh} game={game} w={sw} h={sh} selected={pick} onSelect={setSelected} region={shown.id} onRegion={turnTo} onUp={manyLands?()=>setMode('lands'):null} upLabel="Show all lands"/>;
 // The ways off the edge of the land the hero stands in, on that land's own sheet and with all lands.
 const beyondCard=close=>mode!=='city'&&shown.id===home&&!!onBeyond&&beyond.length>0&&<BeyondCard land={shown.name} beyond={beyond} onBeyond={onBeyond} close={close} barred={beyondBarred(game)}/>;
 const travelChip=(id,close,label='Travel')=><Pressable accessibilityRole="button" accessibilityLabel={'Travel to '+placeName(game,id)} onPress={()=>{onTravel(id);setSelected(null);setLandPick(null);close?.();}} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="travel" size={14} color={colors.gold}/><PlainText style={s.travelText}>{label}</PlainText></View></Pressable>;
 const pickCard=close=>{
  if(mode==='lands'){
   const land=landPick&&regions.find(r=>r.id===landPick);if(!land)return null;
   const placesThere=ids.filter(id=>regionOfPlace(game,id)===land.id),been=placesThere.some(id=>visited.has(id)||id===here);
   const roads=placesThere.map(id=>({id,route:id===here?{feet:0,minutes:0}:routeTo(id)})).filter(o=>o.route).sort((a,b)=>a.route.feet-b.route.feet),nearest=roads[0]??null,go=roads.find(o=>canGo(o.id))??null;
   return <View dataSet={{qb:'card'}} style={s.pickCard} accessibilityLiveRegion="polite">
    <View style={s.cardInfo}>
     <Text style={s.detailName}>{land.name}</Text>
     <Text style={[s.distance,land.id===home&&{color:colors.goldBright}]}>{[terrainWords[land.terrain],placesThere.length+(placesThere.length===1?' place':' places'),land.id===home?'You are here':been?'Visited':'Heard of, not yet reached'].filter(Boolean).join('  ·  ')}</Text>
     {land.id!==home&&<Text style={s.detailText}>{nearest?'The nearest place there, '+placeName(game,nearest.id)+', is '+distanceText(nearest.route.feet)+' away: '+durationText(nearest.route.minutes)+' on the road.':'No road you know leads there yet.'}</Text>}
     <View style={s.cardActions}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Show the map of '+land.name} onPress={()=>turnTo(land.id)} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="map" size={14} color={colors.gold}/><PlainText style={s.travelText}>Its map</PlainText></View></Pressable>
      {land.id!==home&&!!go&&travelChip(go.id,close,'Travel to '+placeName(game,go.id))}
     </View>
    </View>
   </View>;
  }
  if(!pick)return null;
  const people=livesAt(game,pick),kind=kindWord(game,pick),outside=mode==='city'&&!city.ids.includes(pick);
  return <View dataSet={{qb:'card'}} style={s.pickCard} accessibilityLiveRegion="polite">
   <View style={s.cardInfo}>
    <Text style={s.detailName}>{placeName(game,pick)}</Text>
    {!!kind&&<PlainText style={s.kindText}>{kind+(outside?' · outside the city':mode==='city'?' · in the city':'')}</PlainText>}
    <Text style={[s.distance,pick===here&&{color:colors.goldBright}]}>{pick===here?'You are here':pickRoute?distanceText(pickRoute.feet)+' · '+durationText(pickRoute.minutes)+' on foot':'No known path'}{pick!==here?(visited.has(pick)?'  ·  Visited':'  ·  Not yet visited'):''}</Text>
    <Text style={s.detailText}>{mode==='city'?brief(placeDescription(game,pick)):placeDescription(game,pick)}</Text>
    {!!people.length&&<PlainText style={s.feature}>Lives here: {people.join(', ')}</PlainText>}
    {!!dangerNote(pick)&&<PlainText style={[s.danger,worldPlace(game,pick)?.cleared&&{color:colors.heal}]}>{dangerNote(pick)}</PlainText>}
    {!!worldPlace(game,pick)?.feature&&<PlainText style={s.feature}>Notable: {worldPlace(game,pick).feature}</PlainText>}
    {!!pickCity&&<View style={s.cardActions}><Pressable accessibilityRole="button" accessibilityLabel={'Show the city of '+pickCity.name} onPress={()=>openCity(pickCity)} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="home" size={14} color={colors.gold}/><PlainText style={s.travelText}>City view</PlainText></View></Pressable></View>}
   </View>
   {canGo(pick)&&travelChip(pick,close)}
  </View>;
 };
 // The heading: on the panel the eyebrow and where you are; in the full map one line each (on a short screen the views
 // and the row of lands sit beside it).
 const head=()=><View style={s.headRow}>
  <View style={{flex:1,minWidth:0}}><View style={s.eyebrowRow}><Icon name="map" size={14} color={colors.goldMid}/><PlainText numberOfLines={2} style={[s.eyebrow,{flexShrink:1}]}>{sheetTitle}</PlainText></View><Text style={s.heading}>{sheetHeading}</Text></View>
  <Pressable accessibilityRole="button" accessibilityLabel="Open the map full screen" onPress={()=>setOpen(true)} dataSet={{qb:'chip'}} style={s.expand}><Icon name="expand" size={15} color={colors.gold}/><PlainText style={s.travelText}>Full map</PlainText></Pressable>
 </View>;
 const bigHead=()=><View style={[s.headRow,shortWin&&{alignItems:'center'}]}><View style={{flex:1,minWidth:0}}>{!shortWin&&<PlainText numberOfLines={1} style={s.eyebrow}>{sheetTitle}</PlainText>}<PlainText numberOfLines={1} style={[s.heading,{marginTop:2},shortWin&&{fontSize:18}]}>{sheetHeading}</PlainText></View>
  {shortWin&&viewTabs(true)}
  {shortWin&&(regionTabs(true)||cityTabs(true))}
  <Pressable accessibilityRole="button" accessibilityLabel="Close the map" onPress={()=>setOpen(false)} dataSet={{qb:'chip'}} style={s.expand}><Icon name="close" size={15} color={colors.gold}/><PlainText style={s.travelText}>Close</PlainText></Pressable></View>;
 const caption=fighting?'Finish or flee the fight before travelling.':game.stage==='dying'?'You cannot travel while dying.':game.stage==='dead'?'Your journey has ended.'
  :mode==='city'?'Tap a district for a closer look and the way there; places outside the city are marked at the edge of the sheet. Zoom out for the whole land.'
  :mode==='lands'?'Every land you know, with the roads between them. Tap a land for the way back to it, or to open its own map.'
  :'Tap a place, or tell the Dungeon Master where you want to go: a direction, a landmark on the horizon, somewhere you heard about, or past the edge of the map. New places appear on this map as you find them.';
 const landRows=mode==='lands'&&tabOrder.filter(r=>landIds.includes(r.id)).map(r=>{const isHere=r.id===home,placesThere=ids.filter(id=>regionOfPlace(game,id)===r.id),been=placesThere.some(id=>visited.has(id)),near=isHere?null:placesThere.map(routeTo).filter(Boolean).sort((a,b)=>a.feet-b.feet)[0];
  return <View key={r.id} dataSet={{qb:'card',selected:String(isHere)}} style={[s.place,isHere&&s.placeHere]}>
   <Pressable accessibilityRole="button" accessibilityLabel={r.name+' — about this land'} onPress={()=>setLandPick(landPick===r.id?null:r.id)} style={s.placeInfo}><View style={[s.placeIcon,isHere&&{borderColor:colors.gold}]}><Icon name="map" size={18} color={isHere?colors.goldBright:colors.gold}/></View><View style={{flex:1,minWidth:0}}><Text style={s.detailName}>{r.name}</Text><Text style={[s.distance,isHere&&{color:colors.goldBright}]}>{isHere?'You are here':near?distanceText(near.feet)+' · '+durationText(near.minutes)+' on the road':'No known road'}{'  ·  '+placesThere.length+(placesThere.length===1?' place':' places')}{!isHere&&!been?'  ·  Not yet reached':''}</Text></View></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={'Show the map of '+r.name} onPress={()=>turnTo(r.id)} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="map" size={14} color={colors.gold}/><PlainText style={s.travelText}>Map</PlainText></View></Pressable>
  </View>;});
 return <View dataSet={{qb:'plate'}} style={s.panel} onLayout={e=>setWidth(Math.max(230,e.nativeEvent.layout.width-36))}>
  {head()}
  {viewTabs()}
  {regionTabs()}
  {cityTabs()}
  {sheet(w,h)}
  <Modal transparent visible={open} animationType="fade" onRequestClose={()=>setOpen(false)}>
   <View dataSet={{qb:'scrim'}} style={s.scrim}>
    <View dataSet={{qb:'sheet'}} style={[s.bigSheet,{width:bigW+24}]} accessibilityViewIsModal>
     {bigHead()}
     {!shortWin&&viewTabs()}
     {!shortWin&&regionTabs()}
     {!shortWin&&cityTabs()}
     <ScrollView style={s.bigScroll} contentContainerStyle={s.bigBody}>
      {open&&sheet(bigW,bigH)}
      {pickCard(()=>setOpen(false))}
      {beyondCard(()=>setOpen(false))}
     </ScrollView>
    </View>
   </View>
  </Modal>
  {!open&&pickCard()}
  {!open&&beyondCard()}
  <Text style={s.caption}>{caption}</Text>
  {mode==='lands'?<View style={s.places}>{landRows}</View>
  :<View style={s.places}>{places.map(id=>{const isHere=id===here,route=routeTo(id),go=canGo(id),out=mode==='city'&&!city.ids.includes(id);return <View key={id} dataSet={{qb:'card',selected:String(isHere)}} style={[s.place,isHere&&s.placeHere]}>
   <Pressable accessibilityRole="button" accessibilityLabel={placeName(game,id)+' — location details'} onPress={()=>setSelected(pick===id?null:id)} style={s.placeInfo}><View style={[s.placeIcon,isHere&&{borderColor:colors.gold}]}><Icon name={placeIconOf(game,id)} size={18} color={isHere?colors.goldBright:colors.gold}/></View><View style={{flex:1,minWidth:0}}><Text style={s.detailName}>{placeName(game,id)}</Text><Text style={[s.distance,isHere&&{color:colors.goldBright}]}>{isHere?'You are here':route?distanceText(route.feet)+' · '+durationText(route.minutes)+' walk':'No known path'}{visited.has(id)&&!isHere?'  ·  Visited':''}{out?'  ·  Outside the city':''}</Text></View></Pressable>
   {go&&<Pressable accessibilityRole="button" accessibilityLabel={'Travel to '+placeName(game,id)} onPress={()=>onTravel(id)} dataSet={{qb:'chip'}} style={s.travel}><View style={s.travelRow}><Icon name="travel" size={14} color={colors.gold}/><PlainText style={s.travelText}>Travel</PlainText></View></Pressable>}
  </View>;})}</View>}
 </View>;
}
const s=StyleSheet.create({
 region:{alignSelf:'center',marginTop:12,borderRadius:4,overflow:'hidden',borderWidth:1,borderColor:tint('rgba(224,74,92,.55)'),backgroundColor:'#dcc694'},
 headRow:{flexDirection:'row',alignItems:'flex-end',gap:10},expand:{flexDirection:'row',alignItems:'center',gap:6,minHeight:38,paddingHorizontal:12,borderRadius:19,borderWidth:1,borderColor:tint('rgba(178,34,58,.5)'),backgroundColor:tint('rgba(31,24,32,.92)'),justifyContent:'center'},
 herePulse:{position:'absolute',width:30,height:30,borderRadius:15,pointerEvents:'none'},
 bigScroll:{flexGrow:0,flexShrink:1},bigBody:{gap:4},
 regionBar:{flexGrow:0,flexShrink:0,marginTop:10},regionInline:{marginTop:0,flexShrink:1,maxWidth:'40%'},regionTab:{flexDirection:'row',alignItems:'center',gap:6,height:36,maxWidth:230,paddingHorizontal:12,borderRadius:18,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(31,24,32,.92)')},regionTabOn:{borderColor:colors.goldBright,backgroundColor:tint('rgba(48,26,78,.92)')},
 // The views: three chips that wrap rather than run off a narrow phone, each at least 36 pixels tall to tap.
 viewRow:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:10},viewInline:{marginTop:0,flexWrap:'nowrap',flexShrink:0},viewTab:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,minHeight:36,maxWidth:'100%',paddingHorizontal:12,borderRadius:18,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(31,24,32,.92)')},
 regionTabText:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:.9,color:colors.gold,flexShrink:1},regionDot:{width:7,height:7,borderRadius:4,backgroundColor:'#c8412f'},
 tools:{position:'absolute',right:8,bottom:8,gap:6},gutter:{position:'absolute',right:0,top:0,bottom:0,width:48,backgroundColor:'#d3bb88',borderLeftWidth:1,borderLeftColor:'rgba(59,42,23,.45)'},
 rose:{gap:4},roseRow:{flexDirection:'row',gap:4},roseCell:{width:38,height:36,borderRadius:18,borderWidth:1,borderColor:tint('rgba(178,34,58,.35)'),backgroundColor:tint('rgba(31,24,32,.92)'),alignItems:'center',justifyContent:'center'},roseOn:{borderColor:colors.goldBright,backgroundColor:tint('rgba(48,26,78,.92)')},roseCentre:{width:38,height:36,alignItems:'center',justifyContent:'center'},roseText:{fontFamily:fonts.display,fontSize:11,fontWeight:'700',letterSpacing:.6,color:colors.gold},beyondText:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:19,marginTop:4},tool:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'rgba(59,42,23,.6)',alignItems:'center',justifyContent:'center',backgroundColor:'#eddeb6'},toolText:{fontFamily:fonts.display,fontSize:20,lineHeight:24,fontWeight:'800',color:tint('#3b2a17')},
 scrim:{flex:1,backgroundColor:tint('rgba(5,3,5,.82)'),alignItems:'center',justifyContent:'center',padding:8},bigSheet:{maxWidth:'100%',maxHeight:'100%',padding:12,borderRadius:6,borderWidth:1,borderColor:colors.goldLine,backgroundColor:tint('rgba(22,16,23,.98)'),gap:4},
 compassMark:{position:'absolute',top:8,right:10,fontFamily:fonts.display,fontSize:11,letterSpacing:1.5,color:'rgba(233,223,192,.7)'},
 path:{position:'absolute',height:2,borderRadius:1,backgroundColor:tint('rgba(224,74,92,.75)')},
 node:{position:'absolute',width:44,height:44,alignItems:'center',justifyContent:'center'},
 nodeDot:{width:30,height:30,borderRadius:15,borderWidth:1.5,borderColor:'#3b2a17',backgroundColor:'#f1e4bf',alignItems:'center',justifyContent:'center'},
 nodeHere:{backgroundColor:'#8f2c1c',borderColor:'#4a160c'},
 nodeLabel:{position:'absolute',fontFamily:fonts.display,fontSize:10.5,lineHeight:14,fontWeight:'700',letterSpacing:.4,color:tint('#3b2a17')},
 danger:{fontFamily:fonts.ui,fontSize:12,fontWeight:'700',color:colors.bloodBright,marginTop:6,letterSpacing:.3},feature:{fontFamily:fonts.story,fontStyle:'italic',fontSize:14.5,lineHeight:21,color:tint('#d0c5c0'),marginTop:4},
 kindText:{fontFamily:fonts.ui,fontSize:11.5,fontWeight:'700',letterSpacing:.8,textTransform:'uppercase',color:colors.goldMid,marginTop:3},
 // A card's words take the room; on a narrow phone its Travel button drops below them rather than squeeze them.
 cardInfo:{flexGrow:1,flexShrink:1,flexBasis:200,minWidth:0},cardActions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},
 lairMark:{position:'absolute',top:3,right:3,width:10,height:10,borderRadius:5,backgroundColor:colors.bloodBright,borderWidth:1.5,borderColor:'#1a0a08'},
 pickCard:{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start',gap:10,marginTop:12,padding:12,borderRadius:6,borderWidth:1,borderColor:tint('rgba(224,74,92,.45)'),backgroundColor:tint('rgba(20,13,21,.9)')},
 panel:{backgroundColor:tint('rgba(20,15,21,.8)'),borderColor:colors.goldLine,borderWidth:1,borderRadius:6,padding:18,marginVertical:14},eyebrowRow:{flexDirection:'row',alignItems:'center',gap:8},placeIcon:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:tint('rgba(178,34,58,.4)'),alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.25)'},travelRow:{flexDirection:'row',alignItems:'center',gap:6},eyebrow:{...type.label},heading:{fontFamily:fonts.display,fontWeight:'700',letterSpacing:1,color:colors.parchment,fontSize:22,marginTop:6},caption:{fontFamily:fonts.ui,color:colors.muted,fontSize:13,lineHeight:20,marginVertical:10},frame:{alignSelf:'center',borderRadius:3,overflow:'hidden',backgroundColor:'rgba(23,46,50,.68)',borderWidth:1,borderColor:colors.goldLine},
 places:{gap:8,marginTop:4},place:{flexDirection:'row',gap:10,alignItems:'center',padding:12,paddingRight:10,borderRadius:6,borderWidth:1,borderColor:tint('rgba(178,34,58,.25)')},placeInfo:{flex:1,minWidth:0,flexDirection:'row',gap:12,alignItems:'center'},
 travel:{minHeight:40,maxWidth:'100%',paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:tint('rgba(178,34,58,.5)'),backgroundColor:tint('rgba(31,24,32,.92)'),justifyContent:'center'},travelText:{fontFamily:fonts.display,color:colors.gold,fontSize:11,fontWeight:'700',letterSpacing:1.3,textTransform:'uppercase',flexShrink:1},placeHere:{borderColor:colors.gold},placeGlyph:{fontSize:22,color:colors.gold,width:28,textAlign:'center',marginTop:2},north:{position:'absolute',top:15,left:16,color:tint('#e9dfc0'),fontSize:13},marker:{position:'absolute',width:120,minHeight:44,justifyContent:'center',alignItems:'center'},mapLabel:{textAlign:'center',fontFamily:'Palatino Linotype, Book Antiqua, Georgia, serif',fontWeight:'600',fontStyle:'italic',fontSize:12,color:tint('#f5e3b6'),...Platform.select({web:{textShadow:'1px 2px 5px #05090b'},default:{textShadowColor:'#05090b',textShadowRadius:5,textShadowOffset:{width:1,height:2}}}),backgroundColor:'rgba(9,17,20,.48)',borderRadius:4,paddingVertical:3,paddingHorizontal:6},here:{fontSize:8,letterSpacing:1,color:tint('#e9c87e'),marginTop:3},details:{position:'absolute',left:12,right:12,top:42,padding:12,borderRadius:10,borderWidth:1,borderColor:'#7d765f',backgroundColor:tint('rgba(20,13,21,.96)')},detailName:{color:colors.parchment,fontSize:16,fontWeight:'700',letterSpacing:.6,fontFamily:fonts.display},detailText:{fontFamily:fonts.story,color:tint('#d9d3c3'),fontSize:15.5,lineHeight:23,marginTop:6},distance:{fontFamily:fonts.ui,color:tint('#c0626f'),fontSize:11.5,marginTop:5,letterSpacing:.3},close:{color:tint('#e9dfc0'),fontSize:22,paddingHorizontal:10},clue:{color:tint('#dfddb2'),fontSize:12,marginTop:4}});
