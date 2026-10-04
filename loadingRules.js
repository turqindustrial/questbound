// How the loading screens roll (StoryLoading.js): a tip every few seconds, round and round; the first-time primer turns
// a page every eleven seconds and starts again after the last; a page turned by hand holds for twenty seconds, then
// the primer rolls on. Pure, so verify-presentation.cjs can check it without React.
export const tipMs=6000,primerMs=11000,primerResumeMs=20000;
// The page `by` steps from `page` in a ring of `count` pages (backwards from the first is the last).
export const cyclePage=(page,by,count)=>count>0?(((page+by)%count)+count)%count:0;
// Whether the primer may turn by itself now: not while a page turned by hand is still being read.
export const autoTurnDue=(now,pausedUntil)=>now>=pausedUntil;
