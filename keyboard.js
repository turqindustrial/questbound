// Keyboard shortcuts stay out of the way while the player is typing or a dialog is on screen. A closed dialog can
// linger in the page for a moment as it fades (invisible and click-through), so a dialog only counts when it is the
// thing actually under its own centre.
export function shortcutsBlocked(doc=globalThis.document){
 if(!doc)return true;
 const el=doc.activeElement;
 if(el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable))return true;
 return [...doc.querySelectorAll('[aria-modal=true]')].some(dialog=>{
  const r=dialog.getBoundingClientRect();if(r.width<2||r.height<2)return false;
  const hit=doc.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!hit&&dialog.contains(hit);
 });
}
