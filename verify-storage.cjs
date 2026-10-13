const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
let stored = null;
let failWrite = false;
const storage = {getItem: async () => stored, setItem: async (key, value) => {if (failWrite) throw new Error('Storage unavailable'); stored = value;}};
// The hero's storage with the whole rules behind it (an older hero is upgraded on load: saveMigrations.js).
const {rulesSource} = require('./rules-files.cjs');
function freshModule() {
  return vm.runInNewContext(rulesSource() + '\n({loadCharacter, saveCharacter, currentSaveVersion})', {AsyncStorage: storage, console});
}
(async () => {
  const first = freshModule();
  assert.equal(await first.loadCharacter(), null);
  const hero = {name:'Test hero', race:'Elf', class:'Ranger', level:1};
  await first.saveCharacter(hero);
  // A hero from before save formats were numbered comes back in the current format, and is kept that way.
  const upgraded = {...hero, saveVersion: first.currentSaveVersion};
  assert.equal(JSON.stringify(await freshModule().loadCharacter()), JSON.stringify(upgraded));
  assert.equal(stored, JSON.stringify(upgraded));
  assert.equal(JSON.stringify(await freshModule().loadCharacter()), JSON.stringify(upgraded));
  failWrite = true;
  await assert.rejects(first.saveCharacter({...hero, name:'Changed'}));
  assert.equal(JSON.parse(stored).name, 'Test hero');
  failWrite = false;
  await assert.rejects(first.saveCharacter({...hero, level:0}));
  stored = '{invalid';
  await assert.rejects(first.loadCharacter());
  stored = JSON.stringify({...hero, level: '1'});
  await assert.rejects(first.loadCharacter());
  console.log('Passed: empty storage, save/load across module restart (an older hero upgraded once and kept), failed write preserves old save, invalid character and corrupt data rejection.');
})();


