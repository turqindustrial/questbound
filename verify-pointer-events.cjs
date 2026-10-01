const assert=require('node:assert/strict'),fs=require('node:fs');
// react-native-web only turns pointerEvents 'box-none'/'box-only' into working CSS for StyleSheet.create styles (or the
// pointerEvents prop). Written inline in a style array it becomes invalid CSS, which the browser ignores, so a
// full-screen overlay meant to let taps through blocks the whole game instead (CinematicLayer did exactly this).
function insideStyleSheet(src,at){
 const start=src.lastIndexOf('StyleSheet.create(',at);if(start<0)return false;
 let depth=0;for(let i=start+'StyleSheet.create'.length;i<at;i++){if(src[i]==='(')depth++;else if(src[i]===')'&&--depth===0)return false;}
 return depth>0;
}
const problems=[];
for(const file of fs.readdirSync('.').filter(f=>/\.js$/.test(f))){
 const src=fs.readFileSync(file,'utf8');
 for(const m of src.matchAll(/(['"])box-(none|only)\1/g)){
  const before=src.slice(Math.max(0,m.index-14),m.index);
  if(/pointerEvents=\{?$/.test(before)||insideStyleSheet(src,m.index))continue;
  problems.push(file+':'+(src.slice(0,m.index).split('\n').length)+' uses '+m[0]+' outside StyleSheet.create');
 }
}
assert.deepEqual(problems,[],problems.join('\n'));
// The checker itself: an inline value is caught, a compiled or prop value is allowed.
assert.equal(insideStyleSheet("const s=StyleSheet.create({a:{pointerEvents:'box-none'}});",44),true);
assert.equal(insideStyleSheet("StyleSheet.create({});<View style={[{pointerEvents:'box-none'}]}/>",50),false);
console.log('Pointer events OK: every box-none/box-only is compiled, so click-through layers really let taps through.');
