import {modifier,proficiencyBonus} from './characterRules';
// Revised SRD 5.2: Playing the Game, Classes, Character Origins.
export const skillAbilities={Acrobatics:'Dexterity','Animal Handling':'Wisdom',Arcana:'Intelligence',Athletics:'Strength',Deception:'Charisma',History:'Intelligence',Insight:'Wisdom',Intimidation:'Charisma',Investigation:'Intelligence',Medicine:'Wisdom',Nature:'Intelligence',Perception:'Wisdom',Performance:'Charisma',Persuasion:'Charisma',Religion:'Intelligence','Sleight of Hand':'Dexterity',Stealth:'Dexterity',Survival:'Wisdom'};
export const backgroundSkills={Acolyte:['Insight','Religion'],Criminal:['Sleight of Hand','Stealth'],Sage:['Arcana','History'],Soldier:['Athletics','Intimidation'],Farmer:['Animal Handling','Nature']};
export const classSkills={
 Barbarian:['Animal Handling','Athletics','Intimidation','Nature','Perception','Survival'],Bard:Object.keys(skillAbilities),
 Cleric:['History','Insight','Medicine','Persuasion','Religion'],Druid:['Animal Handling','Arcana','Insight','Medicine','Nature','Perception','Religion','Survival'],
 Fighter:['Acrobatics','Animal Handling','Athletics','History','Insight','Intimidation','Persuasion','Perception','Survival'],Monk:['Acrobatics','Athletics','History','Insight','Religion','Stealth'],
 Paladin:['Athletics','Insight','Intimidation','Medicine','Persuasion','Religion'],Ranger:['Animal Handling','Athletics','Insight','Investigation','Nature','Perception','Stealth','Survival'],
 Rogue:['Acrobatics','Athletics','Deception','Insight','Intimidation','Investigation','Perception','Persuasion','Sleight of Hand','Stealth'],Sorcerer:['Arcana','Deception','Insight','Intimidation','Persuasion','Religion'],
 Warlock:['Arcana','Deception','History','Intimidation','Investigation','Nature','Religion'],Wizard:['Arcana','History','Insight','Investigation','Medicine','Nature','Religion'],
};
export const classSkillCount=hero=>hero.class==='Rogue'?4:['Bard','Ranger'].includes(hero.class)?3:classSkills[hero.class]?2:0;
export const expertiseCount=hero=>hero.class==='Rogue'?(hero.level>=6?4:2):hero.class==='Bard'?(hero.level>=9?4:hero.level>=2?2:0):hero.class==='Ranger'?(hero.level>=9?3:hero.level>=2?1:0):hero.class==='Wizard'&&hero.level>=2?1:0;
export const expertiseEligible=(hero,skill)=>hero.class!=='Wizard'||['Arcana','History','Investigation','Medicine','Nature','Religion'].includes(skill);
export function trainedSkills(hero,game={}){return [...new Set([...(backgroundSkills[hero.background]??[]),...(hero.skillProficiencies??[]).filter(s=>Object.hasOwn(skillAbilities,s)),...(game.skillTraining?.skills??[])])];}
export function validSkillTraining(value,hero){
 if(value===undefined)return true;
 const validList=v=>Array.isArray(v)&&new Set(v).size===v.length&&v.every(s=>Object.hasOwn(skillAbilities,s));
 return !!value&&validList(value.skills)&&value.skills.length<=classSkillCount(hero)&&value.skills.every(s=>classSkills[hero.class]?.includes(s)&&!backgroundSkills[hero.background]?.includes(s))&&validList(value.expertise)&&value.expertise.length<=expertiseCount(hero)&&value.expertise.every(s=>expertiseEligible(hero,s)&&trainedSkills(hero,{skillTraining:{skills:value.skills}}).includes(s));
}
export function skillCheckBonus(hero,game,ability,skill=null){
 const trained=!!skill&&trainedSkills(hero,game).includes(skill);
 const expert=trained&&(game.skillTraining?.expertise??hero.skillExpertise??[]).includes(skill);
 const pb=proficiencyBonus(hero.level),abilityBonus=modifier(hero.scores[ability]);
 const trainingBonus=expert?2*pb:trained?pb:hero.class==='Bard'&&hero.level>=2&&!!skill?Math.floor(pb/2):0;
 return {ability,skill,abilityBonus,trainingBonus,total:abilityBonus+trainingBonus,trained,expert,reliable:hero.class==='Rogue'&&hero.level>=7&&trained};
}
