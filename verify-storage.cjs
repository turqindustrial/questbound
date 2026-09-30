const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let stored = null;
let failWrite = false;
const storage = {getItem: async () => stored, setItem: async (key, value) => {if (failWrite) throw new Error('Storage unavailable'); stored = value;}};
function freshModule() {
  const source = fs.readFileSync('characterStorage.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  const rules = 'const catalog='+fs.readFileSync('spellCatalog.json','utf8')+';const progression='+fs.readFileSync('spellProgression.json','utf8')+';\n'+(fs.readFileSync('subclassOptions.js','utf8')+'\n'+fs.readFileSync('spellOptions.js','utf8') + '\n' + fs.readFileSync('equipmentRules.js','utf8') + '\n' + fs.readFileSync('characterRules.js', 'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/export /g, '');
  return vm.runInNewContext(rules + '\n' + source + '\n({loadCharacter, saveCharacter})', {AsyncStorage: storage});
}
(async () => {
  const first = freshModule();
  assert.equal(await first.loadCharacter(), null);
  const hero = {name:'Test hero', race:'Elf', class:'Ranger', level:1};
  await first.saveCharacter(hero);
  assert.equal(JSON.stringify(await freshModule().loadCharacter()), JSON.stringify(hero));
  failWrite = true;
  await assert.rejects(first.saveCharacter({...hero, name:'Changed'}));
  assert.equal(JSON.parse(stored).name, 'Test hero');
  failWrite = false;
  await assert.rejects(first.saveCharacter({...hero, level:0}));
  stored = '{invalid';
  await assert.rejects(first.loadCharacter());
  stored = JSON.stringify({...hero, level: '1'});
  await assert.rejects(first.loadCharacter());
  console.log('Passed: empty storage, save/load across module restart, failed write preserves old save, invalid character and corrupt data rejection.');
})();


