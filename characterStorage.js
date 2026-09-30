import {validPlannedSubclass} from './subclassOptions';
import {spellSelectionError} from './spellOptions';
import { validEquipment } from './equipmentRules';
import { buildError, finalScores, backgrounds } from './characterRules';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'questbound.character.v1';
export function isValidCharacter(value) {
  if(value && !validPlannedSubclass(value)) return false;
  if(value && spellSelectionError(value,false)) return false;
  if (value?.equipment !== undefined && !validEquipment(value)) return false;
  if (value?.schemaVersion === 2 && (buildError(value) || value.rulesVersion !== '2024' || value.originFeat !== backgrounds[value.background]?.feat || JSON.stringify(value.scores) !== JSON.stringify(finalScores(value)))) return false;
  return !!value && ['name', 'race', 'class'].every(key => typeof value[key] === 'string' && value[key].trim().length > 0 && value[key].length <= 60)
    && Number.isInteger(value.level) && value.level >= 1 && value.level <= 20;
}
export async function loadCharacter() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return null;
  const character = JSON.parse(raw);
  if (!isValidCharacter(character)) throw new Error('Invalid saved character');
  return character;
}
export async function saveCharacter(character) {
  if (!isValidCharacter(character)) throw new Error('Invalid character');
  await AsyncStorage.setItem(KEY, JSON.stringify(character));
}


