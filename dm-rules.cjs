// Reviewed baseline: revised 2024 rules / SRD 5.2. This is runtime grounding,
// not model fine-tuning. Catalog text is licensed with the existing SRD notices.
const spells=require('./spellCatalog.json');
// The running Dungeon Master reloads this file on every request; the catalog is reloaded with it, so new feature text
// (subclasses) is live without a restart.
delete require.cache[require.resolve('./classFeatureCatalog.json')];
const features=require('./classFeatureCatalog.json');
// The shared rules reference in the standing prompt (said briefly on 2026-10-21; attacks, magic, movement and readied
// actions are covered by the instructions themselves: dm-instructions.cjs ATTACKS, HOW TO ACT and TURNS).
const actionRules=[
 'Dodge: the game spends the action and attacks on the player have disadvantage until their next turn (the Dexterity save benefit is not played).',
 'Help: aids a check or distracts an enemy for an attack; no lasting benefit, never invented advantage.',
 'Hide: concealment and a Dexterity (Stealth) check; not fully played.',
 'Influence: only uncertainty needs a check; hostility gives disadvantage but forces no fight; a check never erases hostility.',
 'Search, Study: Wisdom or Intelligence with a fitting skill when uncertain; never invent secrets.',
 'Utilize: an object whose use takes an action; magic items by their own rules; only inventory and scene actions change resources.'
];
const coreRules=[
 'Revised 2024 rules: a specific spell or feature beats a general rule; never 2014 rules or invented feature text.',
 'Roll only when the outcome is uncertain and failure matters; a natural 20 is not automatic success on an ability check; advantage and disadvantage cancel, never stack; the engine adds every bonus (invent none).',
 'Cantrips are level 0: no slot, but casting time and components apply. Only one spell slot a turn (two spells are not banned as such). A reaction spell needs its trigger and an unused reaction.',
 'A spell must be available to the caster, with a slot of at least its level unless a feature or ritual allows otherwise; upcasting changes only what the spell says; a ritual adds 10 minutes and needs no slot.',
 'Before casting check range, target, clear path, area, components, armor training, conditions and resources (self may be an area: Burning Hands, a 15-foot cone); unknown positions, targets, materials or triggers need clarification.',
 'Verbal components need speech, somatic a free hand; a focus replaces only free, unconsumed materials (costly or consumed ones must be owned); armor without training prevents casting.',
 'Concentration: one effect, a new one ends the old; damage forces a Constitution save (DC 10 or half the damage, at most 30); incapacitation or death ends it; never assume it kept.',
 'Spell attacks and saves differ: follow the spell text and the supplied defenses, never a monster from memory; temporary HP does not stack and is not healing.',
 'Detect Magic: magic within 30 feet while concentrating (10 minutes); an aura needs a later Magic action and a visible bearer; it identifies nothing and reveals no invisible creatures.',
 'Rules text proves nothing implemented: only game actions and ruling fields change state; say so of unsupported effects, never narrating an unrecorded item, condition, multi-target damage or resource change.'
];
// Whether lower-cased words name something as a whole word or phrase.
const namedIn=(input,name)=>{const n=String(name??'').toLowerCase();if(!n)return false;let at=input.indexOf(n);while(at>=0){const before=input[at-1],after=input[at+n.length];if(!/[a-z0-9]/.test(before??'')&&!/[a-z0-9]/.test(after??''))return true;at=input.indexOf(n,at+1);}return false;};
function rulesFor(body){
 const c=body.context??{},p=c.player??{},input=String(body.input??'').toLowerCase();
 const available=new Set((c.spellReference??[]).map(s=>s.name));
 const pending=c.pendingSpell?.id;
 // A name counts only as a whole word ("said" names no Aid, "Halloway" no Hallow), and a spell the hero does not have only
 // when the words speak of casting ("I knock at the door" is not Knock): the reference is for the spell in play.
 const magicTalk=/\b(?:cast|casts|casting|spell|spells|magic|ritual|cantrip|cantrips)\b/.test(input);
 const matches=spells.filter(s=>s.id===pending||(namedIn(input,s.name)&&(available.has(s.name)||magicTalk)));
 // Pending spell always wins the bounded retrieval budget; never truncate its text.
 matches.sort((a,b)=>Number(b.id===pending)-Number(a.id===pending));
 const eligible=features.filter(f=>f.class===p.class&&f.level<=p.level&&(!f.subclass||f.subclass===p.subclass));
 return {edition:'2024 / SRD 5.2',sources:['https://www.dndbeyond.com/sources/dnd/br-2024/spells','https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game'],coreRules,actionRules,
  spells:matches.slice(0,6).map(s=>({...s,availableToCharacter:available.has(s.name),referenceOnly:true})),
  availableFeatures:eligible.map(f=>({name:f.name,level:f.level,subclass:f.subclass,automation:f.automation})),
  featureDetails:eligible.filter(f=>namedIn(input,f.name)).slice(0,4),
  limits:'This reference grants no new actions, spells or features. Missing rules require clarification, not invented mechanics. Engine results remain authoritative.'};
}
// The same reference in three parts, so the provider can cache what never changes (dm-server.cjs, the cache order):
// the rules every turn shares, the features of this hero, and the spells and features this turn's words name.
const standingRules={edition:'2024 / SRD 5.2',coreRules,actionRules,limits:'Grants nothing; missing rules mean clarifying.'};
function heroRules(body){const {availableFeatures}=rulesFor(body);return {availableFeatures};}
function turnRules(body){const {spells,featureDetails}=rulesFor(body);return {spells,featureDetails};}
function validateGroundedReply(context,reply){
 if(context.engineResolved&&[reply.actionId,reply.castCommand,reply.ruling,reply.check,reply.worldEvent].some(v=>v!=null))throw Error('The action is already resolved. The DM cannot apply it twice.');
 // A check in a fight is the turn's action: never once the action is spent, and never in a brawl (the game refuses both).
 if(reply.check!=null&&!context.engineResolved&&context.stage==='combat'&&context.turnResources?.actionUsed)throw Error('The action of the player is already spent this turn: a check cannot be made now. Offer a bonus action or end-turn instead.');
 if(reply.check!=null&&!context.engineResolved&&context.npcCombat?.active)throw Error('A check cannot be made during a fight with people here: use the fight choices.');
 const r=reply.ruling;
 if(context.pendingSpell&&!context.engineResolved&&(!r||reply.actionId!=null||reply.castCommand!=null||reply.check!=null))throw Error('The DM must return a cast, deny, or clarify ruling for the pending spell. Nothing was applied.');
 if(r&&r.decision!=='cast'&&['damage','selfDamage','healing','temporaryHP'].some(k=>r[k]!==0))throw Error('A denied or clarified spell cannot apply effects.');
 if(r?.decision==='cast'&&context.pendingSpell?.engineDamage&&r.damage!==0)throw Error('Spell damage must be rolled by the game, not invented by the DM.');
}
module.exports={rulesFor,standingRules,heroRules,turnRules,validateGroundedReply};
