const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Keyboard shortcuts pause while typing or while a dialog is really on screen, but not for a faded, click-through one.
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('keyboard.js','utf8').replace(/^export /gm,'')+';this.shortcutsBlocked=shortcutsBlocked;',ctx);
const {shortcutsBlocked}=ctx;
const node=(tag,inside=[])=>({tagName:tag,contains:x=>x===node||inside.includes(x)});
const make=({active=null,dialogs=[]}={})=>({activeElement:active,querySelectorAll:()=>dialogs.map(d=>d.el),elementFromPoint:()=>dialogs.find(d=>d.onTop)?.hit??null});
assert.equal(shortcutsBlocked(make()),false,'Nothing open: shortcuts work');
assert.equal(shortcutsBlocked(make({active:{tagName:'TEXTAREA'}})),true,'Typing in the message box');
assert.equal(shortcutsBlocked(make({active:{tagName:'INPUT'}})),true,'Typing in a field');
const button={tagName:'DIV'},dialog={getBoundingClientRect:()=>({left:0,top:0,width:400,height:300}),contains:x=>x===button};
assert.equal(shortcutsBlocked(make({dialogs:[{el:dialog,onTop:true,hit:button}]})),true,'A dialog on screen');
assert.equal(shortcutsBlocked(make({dialogs:[{el:dialog,onTop:false}]})),false,'A faded dialog that no longer receives the pointer');
const empty={getBoundingClientRect:()=>({left:0,top:0,width:0,height:0}),contains:()=>true};
assert.equal(shortcutsBlocked(make({dialogs:[{el:empty,onTop:true,hit:button}]})),false,'A collapsed dialog');
assert.equal(shortcutsBlocked(undefined),true,'No document (native): shortcuts off');
console.log('Passed: shortcuts pause while typing and while a dialog is on screen, and resume once a dialog has faded away.');
