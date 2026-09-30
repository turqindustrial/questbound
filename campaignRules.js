export const campaignState = game => game?.campaign??{bridgeReward:false,lensQuest:'locked'};
export const localInteractions={
  'ask-rumors':{place:'inn',label:'Ask the keeper about local rumors',title:'Rumors by the hearth',text:'The keeper recalls that the abandoned watchtower once signaled to the bridge. The old watchkeeper left instructions carved beneath the bell.'},
  'share-supper':{place:'inn',label:'Share supper with a stranded traveler',title:'A promise at supper',text:'A traveler named Mara shares her bread and tells you she is waiting to cross with medicine for her village. You promise to keep an eye on the road. This conversation grants no combat bonus.'},
  'secure-ropes':{place:'bridge',label:'Secure the loose bridge handrail · 3 GP',title:'A safer crossing',text:'You fasten the loose guide rope to its stone post. A waiting carter pays you 3 GP for making the approach safer. The lantern quest still needs its own resolution.'},
  'read-logbook':{place:'tower',label:'Read the watchkeeper’s logbook',title:'The last watch',text:'The logbook names the bridge light Ember. It once guided travelers through heavy fog. Its final entry reads: The light remembers its duty, even when it forgets the way home.'}
};
export function interactionOptions(game) {return Object.entries(localInteractions).filter(([id,v])=>v.place===game.stage&&!campaignState(game).interactions?.includes(id)).map(([id,v])=>({id,...v}));}
export const earnedGold = game => (game?.dungeon?.gold??0)+(campaignState(game).bridgeReward?20:0)+(campaignState(game).lensQuest==='complete'?5:0)+(campaignState(game).interactions?.includes('secure-ropes')?3:0);
export function validCampaign(c) {return c===undefined || (!!c && typeof c.bridgeReward==='boolean' && ['locked','active','found','complete'].includes(c.lensQuest) && (c.bridgeReward || c.lensQuest==='locked') && (c.interactions===undefined || (Array.isArray(c.interactions)&&c.interactions.length<=4&&new Set(c.interactions).size===c.interactions.length&&c.interactions.every(id=>Object.hasOwn(localInteractions,id)))));}
export function campaignAction(game,action) {
  const c=campaignState(game);
  if(typeof action==='string'&&Object.hasOwn(localInteractions,action)){
    const option=localInteractions[action];
    if(game.stage!==option.place||c.interactions?.includes(action))return {error:'This interaction is unavailable or already completed.'};
    return {game:{...game,campaign:{...c,interactions:[...(c.interactions??[]),action]}},title:option.title,text:option.text};
  }
  if(action==='claim-reward'){
    if(!['victory','bridge'].includes(game.stage)||game.enemyHP!==0||c.bridgeReward)return {error:'This reward is unavailable or already claimed.'};
    return {game:{...game,campaign:{...c,bridgeReward:true}},title:'The keeper’s thanks',text:'The keeper awards you 20 GP for restoring the bridge. A missing signal lens offers a new task.'};
  }
  if(action==='start-lens'){
    if(!['victory','inn'].includes(game.stage)||!c.bridgeReward||c.lensQuest!=='locked')return {error:'The follow-up quest is not available here.'};
    return {game:{...game,stage:'inn',map:{...game.map,visited:[...new Set([...(game.map?.visited??['inn','bridge']),'inn'])],accepted:true,clue:game.map?.clue??false,peaceful:false,minutes:game.map?.minutes??0},campaign:{...c,lensQuest:'active'}},title:'The missing signal lens',text:'The keeper asks you to recover the old signal lens from the watchtower and bring it back to the inn.'};
  }
  if(action==='find-lens'){
    if(game.stage!=='tower'||c.lensQuest!=='active')return {error:'There is no missing lens to collect here.'};
    return {game:{...game,campaign:{...c,lensQuest:'found'}},title:'Signal lens recovered',text:'You find the amber lens beneath the bell. It is now carried as a quest item; return it to the keeper.'};
  }
  if(action==='deliver-lens'){
    if(game.stage!=='inn'||c.lensQuest!=='found')return {error:'Bring the signal lens to the keeper first.'};
    return {game:{...game,campaign:{...c,lensQuest:'complete'}},title:'A beacon for travelers',text:'You hand over the lens. The keeper lights a steady amber beacon and pays 5 GP. The lens is no longer in your possession.'};
  }
  return null;
}
