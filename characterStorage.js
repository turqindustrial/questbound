import {validPlannedSubclass} from './subclassOptions';
import {spellSelectionError} from './spellOptions';
import { validEquipment } from './equipmentRules';
import { buildError, finalScores, backgrounds, validPortraitChoice } from './characterRules';
import AsyncStorage from './playerStorage';
import {upgradeCharacter} from './saveMigrations';

const KEY = 'questbound.character.v1';
export function isValidCharacter(value) {
  if(value && !validPlannedSubclass(value)) return false;
  if(value && spellSelectionError(value,false)) return false;
  if (value?.equipment !== undefined && !validEquipment(value)) return false;
  // The save format (saveVersion.js): none on a hero from before formats were numbered; a later build's number is
  // accepted too, so a hero survives the game being rolled back.
  // The portrait (characterRules validPortraitChoice): a hero from before has none.
  if (value && !validPortraitChoice(value.portrait)) return false;
  if (value?.saveVersion !== undefined && !(Number.isInteger(value.saveVersion) && value.saveVersion >= 1 && value.saveVersion <= 99)) return false;
  if (value?.schemaVersion === 2 && (buildError(value) || value.rulesVersion !== '2024' || value.originFeat !== backgrounds[value.background]?.feat || JSON.stringify(value.scores) !== JSON.stringify(finalScores(value)))) return false;
  return !!value && ['name', 'race', 'class'].every(key => typeof value[key] === 'string' && value[key].trim().length > 0 && value[key].length <= 60)
    && Number.isInteger(value.level) && value.level >= 1 && value.level <= 20;
}
export async function loadCharacter() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return null;
  const saved = JSON.parse(raw);
  if (!isValidCharacter(saved)) throw new Error('Invalid saved character');
  // An older hero is brought to the current format once, here (saveMigrations.js), and kept that way; the adventure
  // follows in loadAdventure. A copy the checks would refuse is never used: the hero stays as saved.
  const character = upgradeCharacter(saved);
  if (character === saved || !isValidCharacter(character)) return saved;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(character)); } catch {}
  return character;
}
// A hero who died and cannot be brought back leaves the save (App.js lays them to rest).
export async function forgetCharacter() {
  await AsyncStorage.removeItem(KEY);
}
export async function saveCharacter(character) {
  if (!isValidCharacter(character)) throw new Error('Invalid character');
  await AsyncStorage.setItem(KEY, JSON.stringify(character));
}


