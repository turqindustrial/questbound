// How rows of chips fit the screen without ever scrolling sideways (ui.js WrapRow, DungeonMaster.js). Pure, so
// verify-presentation.cjs can check it without React.
// A short screen (a phone on its side) has one row of actions; a phone or a window of middling height two; a roomy
// screen three. An open Attack… or Cast… picker, or the wait for another hero's turn, gets at least three (two on a short
// screen and on a small phone, whose story would otherwise be squeezed out), so its headings and every weapon or spell
// are a tap or two away.
export function chipLayout(width,height,{picker=false}={}){
 const short=height<520,small=height<620,compact=width<600,snug=height<700,tight=compact||short;
 const base=short?1:(compact||snug)?2:3,rows=picker?(short||small?2:Math.max(base,3)):base;
 // Opened with More, the rows grow only so far on a small screen, then scroll up and down.
 const openRows=short||small?3:height<700?Math.max(rows,4):height<900?Math.max(rows,6):Math.max(rows,8);
 return {rows,openRows,rowHeight:tight?36:40,gap:tight?6:8,tight,short,compact,snug};
}
// The height of `rows` lines of chips, and whether a row's natural height needs the More chip to show the rest.
export const wrapLimit=(rows,rowHeight,gap)=>rows*rowHeight+Math.max(0,rows-1)*gap;
export const wrapOverflows=(natural,limit)=>natural>limit+1;
