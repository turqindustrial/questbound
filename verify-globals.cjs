const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parse}=require('@babel/parser'),traverse=require('@babel/traverse').default;
// Every client and rules module (.js) names only what it declares, imports, or the platform gives it, and imports only
// names its own modules export (the deployment check of 2026-10-22: f9c0d4f called calmFallback in useDmTurn.js without
// importing it, so every engine move told by the Dungeon Master on a device threw a ReferenceError, while the suite, which
// concatenates the rules into one context, and the web build both passed).
//   node verify-globals.cjs              every .js module of this checkout
//   node verify-globals.cjs file.js …    only those files (their relative imports looked up beside them, else here)
// Names the platform gives a module: ECMAScript's own (Babel's list: Object, Promise, Map, globalThis…) and these few.
// Add one here only for a real platform global; never for a name a module should import. A JSX tag (<Image>, <Text>) is
// never a platform global: a component must be imported or declared, even when the browser has a global of that name.
const platformGlobals=new Set([
 // the browser (react-native-web) and Web APIs
 'window','document','navigator','location','console','localStorage','sessionStorage','setTimeout','clearTimeout',
 'setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','queueMicrotask','fetch','performance',
 'crypto','matchMedia','getComputedStyle','atob','btoa',
 'URL','URLSearchParams','Blob','File','FileReader','Image','Audio','AudioContext','Request','Response','Headers',
 'FormData','TextEncoder','TextDecoder','AbortController','AbortSignal','CompressionStream','DecompressionStream',
 'Element','HTMLElement','Event','CustomEvent','ResizeObserver','MutationObserver','IntersectionObserver',
 'SpeechSynthesisUtterance',
 // React Native, Metro and Expo
 'require','process','__DEV__',
]);
const isPlatform=(name,p)=>platformGlobals.has(name)&&!p?.isJSXIdentifier();
const root=__dirname;
const parseModule=(code,file)=>parse(code,{sourceType:'module',sourceFilename:file,plugins:['jsx'],errorRecovery:false});
// The names a module exports ('default' for a default export), following `export * from`.
const exportCache=new Map();
function exportsOf(file,seen=new Set()){
 if(exportCache.has(file))return exportCache.get(file);
 if(seen.has(file))return new Set();seen.add(file);
 const names=new Set(),ast=parseModule(fs.readFileSync(file,'utf8'),file);
 const bound=pattern=>{
  if(!pattern)return;
  if(pattern.type==='Identifier')names.add(pattern.name);
  else if(pattern.type==='ObjectPattern')for(const p of pattern.properties)bound(p.type==='RestElement'?p.argument:p.value);
  else if(pattern.type==='ArrayPattern')for(const p of pattern.elements)bound(p&&(p.type==='RestElement'?p.argument:p));
  else if(pattern.type==='AssignmentPattern')bound(pattern.left);
 };
 for(const node of ast.program.body){
  if(node.type==='ExportDefaultDeclaration')names.add('default');
  else if(node.type==='ExportNamedDeclaration'){
   const d=node.declaration;
   if(d?.type==='VariableDeclaration')for(const v of d.declarations)bound(v.id);
   else if(d?.id)names.add(d.id.name);
   for(const s of node.specifiers??[])names.add(s.exported.type==='StringLiteral'?s.exported.value:s.exported.name);
  }
  else if(node.type==='ExportAllDeclaration'){
   if(node.exported)names.add(node.exported.name);
   else{const target=resolve(node.source.value,path.dirname(file));if(target)for(const n of exportsOf(target,seen))if(n!=='default')names.add(n);}
  }
 }
 exportCache.set(file,names);return names;
}
// A relative import's file: beside the importer, else in this checkout (a copy scanned from elsewhere).
function resolve(spec,dir){
 for(const base of [dir,root])for(const ext of ['','.js','/index.js']){const f=path.resolve(base,spec+ext);if(/\.js$/.test(f)&&fs.existsSync(f)&&fs.statSync(f).isFile())return f;}
 return null;
}
// Problems in one module's source: free names nobody declared, and named imports their module does not export.
function scan(code,file){
 const problems=[],ast=parseModule(code,file),dir=path.dirname(file);
 traverse(ast,{
  ReferencedIdentifier(p){
   const name=p.node.name;
   if(p.scope.hasBinding(name)||isPlatform(name,p))return;
   // `typeof x` is the safe way to ask whether a global exists.
   if(p.parentPath.isUnaryExpression({operator:'typeof'}))return;
   problems.push(path.basename(file)+':'+p.node.loc.start.line+' '+name+' is not declared, imported or a platform global');
  },
  // An assignment to an undeclared name would make a global by accident.
  AssignmentExpression(p){
   const left=p.node.left;
   if(left.type==='Identifier'&&!p.scope.hasBinding(left.name)&&!isPlatform(left.name))problems.push(path.basename(file)+':'+left.loc.start.line+' '+left.name+' is assigned without being declared');
  },
  ImportDeclaration(p){
   const spec=p.node.source.value;if(!spec.startsWith('.'))return;
   const named=p.node.specifiers.filter(s=>s.type==='ImportSpecifier'||s.type==='ImportDefaultSpecifier');if(!named.length)return;
   const target=resolve(spec,dir);
   if(!target){if(/\.(?:json|png|jpe?g|webp|svg|css)$/i.test(spec)||!/\.\w+$/.test(spec)&&fs.existsSync(path.resolve(dir,spec+'.json')))return;problems.push(path.basename(file)+':'+p.node.loc.start.line+' imports from '+spec+', which is not here');return;}
   const exported=exportsOf(target);
   for(const s of named){
    const name=s.type==='ImportDefaultSpecifier'?'default':s.imported.type==='StringLiteral'?s.imported.value:s.imported.name;
    if(!exported.has(name))problems.push(path.basename(file)+':'+s.loc.start.line+' imports '+(name==='default'?'a default':name)+' from '+spec+', which does not export it');
   }
  },
 });
 return problems;
}
// ---- The check checks itself: an undeclared call, a component used without its import and an import its module lacks
// are all caught; a platform global, a `typeof` probe and what is imported are not ----
{const self=scan(['import {dyingTelling,noSuchName} from \'./calmLines\';','export function told(game){return dyingTelling(game)??calmFallback(game);}',
  'if(typeof window!==\'undefined\'&&typeof webkitThing===\'undefined\')window.x=URL.name;','export const Picture=()=><Image source={new Image()}/>;'].join('\n'),path.join(root,'useDmTurn.js'));
 assert.ok(self.some(p=>/:2 calmFallback is not declared/.test(p)),'an undeclared call is caught: '+self.join('; '));
 assert.ok(self.some(p=>/imports noSuchName from \.\/calmLines, which does not export it/.test(p)),'a name its module lacks is caught: '+self.join('; '));
 assert.ok(self.some(p=>/:4 Image is not declared/.test(p)),'a component used without its import is caught, though the browser has an Image: '+self.join('; '));
 assert.equal(self.length,3,'nothing else is: '+self.join('; '));}
const args=process.argv.slice(2);
const files=args.length?args.map(f=>path.resolve(f)):fs.readdirSync(root).filter(f=>f.endsWith('.js')).sort().map(f=>path.join(root,f));
const problems=files.flatMap(f=>scan(fs.readFileSync(f,'utf8'),f));
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
console.log('Passed: '+files.length+(files.length===1?' module names':' modules name')+' only what they declare, import or the platform gives them, and import only names their own modules export.');
