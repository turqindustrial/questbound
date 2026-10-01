// Reviewed baseline: revised 2024 rules / SRD 5.2. This is runtime grounding,
// not model fine-tuning. Catalog text is licensed with the existing SRD notices.
const spells=require('./spellCatalog.json');
const features=require('./classFeatureCatalog.json');
const actionRules=[
 {name:'Attack',rule:'Use weapon attack rolls versus AC, or the exact Unarmed Strike rules. Extra Attack modifies the Attack action, not arbitrary spells.',implementation:'Only supplied weapon/class action choices. Inn NPC aggression starts an initiative encounter; authored witnesses can defend either side. The engine resolves their turns, attacks, Help and damage.'},
 {name:'Magic',rule:'Use the spell or feature casting time, targets, components, resources and exact effect.',implementation:'castCommand plus spell validation; unimplemented effects need a bounded ruling.'},
 {name:'Dash',rule:'Gain extra movement equal to your Speed for this turn.',implementation:'Tactical speed budgets not implemented; never claim an extra move was recorded.'},
 {name:'Disengage',rule:'Your movement does not provoke Opportunity Attacks for the rest of this turn.',implementation:'Opportunity attacks and tactical movement not implemented.'},
 {name:'Dodge',rule:'Until your next turn, attacks have Disadvantage if you can see the attacker and Dexterity saves have Advantage; ends if Incapacitated or Speed is 0.',implementation:'Prototype dodge choice affects the current foe attack only; full duration/save benefits not implemented.'},
 {name:'Help',rule:'Assist a qualifying ability check or distract a nearby enemy for a qualifying attack; apply the exact requirements.',implementation:'No persistent Help benefit implemented; do not invent Advantage.'},
 {name:'Hide',rule:'Requires appropriate concealment and a Dexterity (Stealth) check under revised rules.',implementation:'Stealth proficiency, concealment and hidden condition not fully implemented.'},
 {name:'Influence',rule:'Determine whether an NPC is willing, unwilling or hesitant; only uncertainty needs a check. Hostile attitudes impose Disadvantage on influence checks; hostility alone is not compulsory combat. Actual attacks start an inn encounter.',implementation:'Recorded attitudes and witness memories; generic checks use recorded skill modifiers and do not erase hostility.'},
 {name:'Ready',rule:'Choose a perceptible trigger and a response using your Reaction; readied spells have additional concentration and slot requirements.',implementation:'Readied actions and reaction triggers are not fully implemented.'},
 {name:'Search',rule:'Use Wisdom and a relevant skill to notice something uncertain.',implementation:'Use scene-specific choices or a generic ability check; do not invent secrets.'},
 {name:'Study',rule:'Use Intelligence and a relevant skill to recall or analyze information.',implementation:'Use scene-specific choices or a generic ability check.'},
 {name:'Utilize',rule:'Interact with an object when its use calls for an action; magic items use their own rules.',implementation:'Only implemented inventory/scene actions change resources.'},
 {name:'Movement',rule:'Movement spends Speed in combat; terrain, conditions, size, reach and opportunity attacks can matter. Travel pace is a separate exploration rule.',implementation:'Known routes (travel choices) and dungeon rooms change position, with distances and times provided. In a written story a new destination is created with discovery (OPEN WORLD) and travelled to at once. No grid simulation.'}
];
const coreRules=[
 'Use revised 2024 rules. A specific spell or feature exception overrides a general rule. Do not substitute 2014 rules or invent missing feature text.',
 'Roll only when the outcome is uncertain and failure matters. Ability checks compare d20 plus applicable modifiers to DC; a natural 20 is not automatic success on an ability check. Advantage and disadvantage cancel; neither stacks. The check engine applies the supplied ability and recorded skill training shown in skillChecks, including Expertise, Bard Jack of All Trades and Rogue Reliable Talent when eligible. Do not invent missing proficiencies or additional feature bonuses.',
 'Cantrips are level 0 and never spend spell slots. They still use their listed casting time and components. A character may expend only one spell slot to cast spells on a turn; this is not a blanket ban on two spells or two cantrips. Reaction spells require their stated trigger and an available reaction.',
 'A spell must be available to the character. A slot of at least the spell level is required unless an explicit feature or ritual allows otherwise. Upcasting changes only what the spell says. Ritual casting adds 10 minutes and uses no slot; access requirements and class exceptions still apply.',
 'Check range, target type, clear path, area, components, armor training, conditions and resources before casting. Self can mean the caster or an area originating from the caster: Burning Hands is a 15-foot cone, not self damage. Unknown positions, targets, material ownership or reaction triggers require clarification.',
 'Verbal components require speech; Somatic components require an available hand. A focus or component pouch replaces only materials without a specified cost and not consumed. Required costly or consumed materials must actually be available. Wearing armor without training prevents spellcasting.',
 'Concentration allows only one effect at a time. Starting another ends the previous effect. Damage requires a Constitution save with DC 10 or half damage rounded down, whichever is higher, capped at 30. Incapacitation or death ends concentration. Do not claim concentration is automatically retained after damage.',
 'Spell attacks and saving throws are different. Use the exact spell text for attack type, save ability, damage dice, damage on a successful save, duration and scaling. Use supplied creature defenses, never a similarly named monster from memory. Temporary HP does not stack and is not healing.',
 'Detect Magic senses the presence of magical effects within 30 feet while concentrating for up to 10 minutes. Seeing an aura requires a subsequent Magic action and a visible creature or object bearing magic; apply the spell text for barriers and school identification. It does not identify every property or automatically reveal invisible creatures.',
 'Rules reference is not proof that a feature is implemented. Only available engine actions and supported ruling fields commit mechanical changes. Explain unsupported effects honestly; never narrate an inventory, condition, multi-target damage or resource change as applied when the engine cannot record it.'
];
function rulesFor(body){
 const c=body.context??{},p=c.player??{},input=String(body.input??'').toLowerCase();
 const available=new Set((c.spellReference??[]).map(s=>s.name));
 const pending=c.pendingSpell?.id;
 const matches=spells.filter(s=>s.id===pending||input.includes(s.name.toLowerCase()));
 // Pending spell always wins the bounded retrieval budget; never truncate its text.
 matches.sort((a,b)=>Number(b.id===pending)-Number(a.id===pending));
 const eligible=features.filter(f=>f.class===p.class&&f.level<=p.level&&(!f.subclass||f.subclass===p.subclass));
 return {edition:'2024 / SRD 5.2',sources:['https://www.dndbeyond.com/sources/dnd/br-2024/spells','https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game'],coreRules,actionRules,
  spells:matches.slice(0,6).map(s=>({...s,availableToCharacter:available.has(s.name),referenceOnly:true})),
  availableFeatures:eligible.map(f=>({name:f.name,level:f.level,subclass:f.subclass,automation:f.automation})),
  featureDetails:eligible.filter(f=>input.includes(f.name.toLowerCase())).slice(0,4),
  limits:'This reference grants no new actions, spells or features. Missing rules require clarification, not invented mechanics. Engine results remain authoritative.'};
}
function validateGroundedReply(context,reply){
 if(context.engineResolved&&[reply.actionId,reply.castCommand,reply.ruling,reply.check,reply.worldEvent].some(v=>v!=null))throw Error('The action is already resolved. The DM cannot apply it twice.');
 const r=reply.ruling;
 if(context.pendingSpell&&!context.engineResolved&&(!r||reply.actionId!=null||reply.castCommand!=null||reply.check!=null))throw Error('The DM must return a cast, deny, or clarify ruling for the pending spell. Nothing was applied.');
 if(r&&r.decision!=='cast'&&['damage','selfDamage','healing','temporaryHP'].some(k=>r[k]!==0))throw Error('A denied or clarified spell cannot apply effects.');
 if(r?.decision==='cast'&&context.pendingSpell?.engineDamage&&r.damage!==0)throw Error('Spell damage must be rolled by the game, not invented by the DM.');
}
module.exports={rulesFor,validateGroundedReply};
