import {blankBuild,buildError,classes,species,backgrounds,makeCharacter} from './characterRules';
import {spellsForClass,spellLimits,spellSelectionError,automaticSpells} from './spellOptions';
import {validPlannedSubclass,subclassOptions} from './subclassOptions';
import {equipmentFor,loadoutFor} from './equipmentRules';
export function characterDraftContext(){return {mode:'character',choices:[],species,backgrounds,classes:classes.map(name=>({name,starterKits:(name==='Fighter'?['melee','ranged']:['standard']).map(kit=>{const hero={class:name,fighterKit:kit,instrument:'Flute'};hero.equipment=equipmentFor(hero);return {kit,items:hero.equipment.items,classGold:hero.equipment.classGold,loadout:loadoutFor(hero)};}),subclasses:Object.keys(subclassOptions[name]??{}),limits:spellLimits({class:name,level:1}),granted:automaticSpells({class:name,level:1}),spells:spellsForClass(name,1).map(s=>({id:s.id,name:s.name,level:s.level}))}))};}
export function validateCharacterDraft(draft){
 if(!draft||typeof draft!=='object')throw Error('The DM did not return a character. Try again.');
 const form={...blankBuild(),...draft,level:1,advancements:[],arcanum:{},bonusMode:'split',spellSelectionVersion:2};
 for(const key of ['age','backstory'])if(typeof form[key]!=='string'||!form[key].trim()||form[key].length>2000)throw Error('The generated '+key+' is incomplete. Try again.');
 const error=buildError(form)||spellSelectionError(form)||(!validPlannedSubclass(form)?'Invalid subclass.':'')||(!classes.includes(form.class)||!species.includes(form.species)?'Choose a class and species the game offers.':'')||(form.plannedSubclass&&!Object.hasOwn(subclassOptions[form.class]??{},form.plannedSubclass)?'Choose a subclass the game offers.':'');if(error)throw Error(error+' Generate again or adjust the draft.');
 return makeCharacter(form);
}
