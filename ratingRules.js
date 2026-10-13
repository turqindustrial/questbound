// "How was that session?" (the host's request of 2026-10-13: "a one-tap 'how was that session?' prompt at a natural
// stopping point"). When to ask, and the fixed answers and chips. SessionRating.js draws the card; App.js decides the
// moment; feedback-notes.cjs keeps the answer (its lists must match these: verify-metrics.cjs checks).
//
// Asked only at a natural stopping point (a chapter finished, the tale complete, a long rest after a good while, the
// hero's death, or leaving the play screen for the title after a quarter of an hour), never in a fight, while dying,
// while a tale is written or a turn order stands; never more than once a day; never in a device's first twenty minutes
// of play; and after a "Not now" not again for a week (a month after two in a row). Settings → Help improve Questbound
// turns it off.
export const ratingAnswers=['great','good','okay','rough'];
export const ratingAnswerLabels={great:'Great',good:'Good',okay:'Okay',rough:'Rough'};
export const ratingMoments=['chapter','tale','rest','death','leave'];
export const ratingBest=['story','fights','people','places','surprises','pace'];
export const ratingWrong=['slow','errors','confusing','too-hard','too-easy','dull'];
export const ratingChipLabels={story:'The story',fights:'The fights',people:'The people',places:'Exploring',surprises:'Surprises',pace:'The pace',slow:'Slow replies',errors:'Errors',confusing:'Confusing','too-hard':'Too hard','too-easy':'Too easy',dull:'Dull stretches'};
// Seconds of play this session before each moment may ask.
export const ratingMinimums={chapter:600,tale:600,death:300,rest:1800,leave:900};
const RATING_DAY=86400000;
export const ratingFirstPlay=1200,ratingGap=20*3600000,ratingAfterAnswer=2*RATING_DAY,ratingAfterDismiss=7*RATING_DAY,ratingAfterDismissals=30*RATING_DAY;
// The stopping point one change of the game reached, or null. Only within one tale (a loaded save or a new tale is no
// stopping point).
export function ratingMomentOf(before,after){
 if(!before?.story||!after?.story||before.story.title!==after.story.title)return null;
 if(after.stage==='dead'&&before.stage!=='dead')return 'death';
 if(after.story.status==='complete'&&before.story.status!=='complete')return 'tale';
 if((after.story.chapter??0)>(before.story.chapter??0))return 'chapter';
 const last=before.storyLog?.at?.(-1)?.id??0;
 if((after.storyLog??[]).some(e=>e?.id>last&&e.kind==='rest'&&/^Took a long rest/.test(e.text??'')))return 'rest';
 return null;
}
// Whether the card may be shown now. record: {asked, answered, dismissed, dismissals} (times in ms).
export function mayAskRating({ask=true,record={},moment,sessionSeconds=0,deviceSeconds=0,now=Date.now(),blocked=false}={}){
 if(!ask||blocked||!ratingMoments.includes(moment))return false;
 if(deviceSeconds<ratingFirstPlay||sessionSeconds<ratingMinimums[moment])return false;
 const r=record&&typeof record==='object'?record:{};
 if(Number.isFinite(r.asked)&&now-r.asked<ratingGap)return false;
 if(Number.isFinite(r.answered)&&now-r.answered<ratingAfterAnswer)return false;
 if(Number.isFinite(r.dismissed)&&now-r.dismissed<((r.dismissals??0)>=2?ratingAfterDismissals:ratingAfterDismiss))return false;
 return true;
}
