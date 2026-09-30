# Questbound: rules execution and DM judgment

Reviewed September 18, 2026 against the revised official Basic Rules and the local SRD 5.2 class reference.

## Why a rules reference is not a complete game engine

Questbound began as a small starter adventure. Its engine has explicit code for selected mechanics. Supplying 339 spell descriptions to a model does not implement their targets, areas, conditions, ongoing effects, resource accounting or interactions. Subclass descriptions likewise do not implement every feature. Missing automation is unfinished app development, not a D&D requirement for human arithmetic.

The intended sequence is: interpret player intent → select a supported action → validate requirements → roll and calculate in code → commit game state → narrate the committed result. Current previews reuse the exact dice sequence on commit. Failed requests apply nothing. Unsupported actions must be identified explicitly rather than narrated as completed mechanics.

## What requires judgment?

| Question | Responsibility |
| --- | --- |
| Is the attempt possible, uncertain and consequential enough to need a roll? | DM judgment based on the scene. |
| Which ability/skill applies, what is the DC, and do circumstances justify advantage? | DM judgment constrained by specific rules. |
| Is an NPC willing, unwilling or hesitant? What does it know or care about? | DM judgment grounded in persistent memories, knowledge and relationships. |
| Does an illusion fool this observer? How does an improvised plan affect the environment? | Interpret the precise spell/rule and established world facts. Do not invent mechanical powers. |
| What happens with open-ended magic such as a nonstandard Wish? | Explicit adjudication of the effect and consequences within the spell's limits. |
| Which house rules, tone, fairness limits and campaign changes are acceptable? | The human players/campaign owner decide; the AI follows those choices. |
| Which dice, proficiency, damage, saves, costs and timers apply once the action is defined? | Deterministic game rules and validated recorded character data. No human calculation should be necessary. |

The AI can serve as the DM for most interpretive decisions. Human review is appropriate for ambiguous or disputed rulings and campaign preferences, not every spell. A ruling must specify a supported state change before the game reports it as applied.

## Damage and successful attacks

Weapon attacks compare the attack roll to AC. A hit rolls the weapon's damage dice plus the relevant ability modifier; critical hits double damage dice, not the modifier. Spell attacks use the spell's own damage formula; do not automatically add spellcasting ability to damage. Saving-throw spells use their stated save and successful-save effect.

A hit can legitimately deal zero damage: immunity or a damage penalty can reduce it to zero. Non-damaging effects and the grapple/shove options of an Unarmed Strike also should not be turned into invented damage. Show hit/miss, rolled damage, modifiers, defense adjustments and final HP changes separately. Never report a hit as applied based only on generated prose.

## Implemented in this pass

- Smaller map names, expanded artwork with atmospheric shading, and location descriptions/distances shown on hover, keyboard focus or tap. Removed the repeated location cards below the map.
- Skill choice controls inside Character Sheet → Skills & Abilities, saved with the adventure without replacing the character save.
- Recorded skill proficiency, Expertise, Bard Jack of All Trades, Rogue Reliable Talent and Wizard Scholar eligibility. Choice pools for the twelve SRD classes; verified background pairs for Acolyte, Criminal, Sage, Soldier, and Farmer (also evidenced by the official Bobby pregenerated sheet).
- AI check plans name a skill or specify a plain ability check. Code calculates the modifier; the AI cannot supply a bonus number. Roll details appear in the adventure log.
- Resolved check narration uses the actual roll. Conversation-only replies are labeled as having no mechanical changes. Supported actions that resolve to a no-op are rejected.

## Still missing

Complete feat/species/subclass bonuses, tool training and tool/skill interactions, replacement proficiencies for all duplicate grants, extra skills from feats/species, all sixteen background mappings, and the final published Artificer skill choices are not complete. Existing heroes need their class/expertise choices recorded in the sheet; choices are never guessed from their biography. Skill selection is currently available at the inn.

Multi-creature initiative, tactical positions and speed budgets, opportunity attacks, all conditions, all spell areas/targets/effects and many class actions remain partial or absent. Generic checks must not substitute for these systems. Fixed scripted adventure checks have their existing calculations; the new skill-aware planner covers conversational checks. This document is a coverage statement, not a claim that all D&D rules have been implemented.

## Official references

- [Playing the Game: D20 Tests, Proficiency, Damage Rolls](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game)
- [Rules Glossary: Influence, actions and conditions](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary)
- [Character Classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes)
- [Character Origins](https://www.dndbeyond.com/sources/dnd/br-2024/character-origins)
- [Official Bobby character sheet](https://media.dndbeyond.com/compendium-images/soee/downloads/bobby-character-sheet.pdf)
- [Spellcasting](https://www.dndbeyond.com/sources/dnd/br-2024/spells)

Use published revised rules when verifying final behavior; playtest material and forum posts are not substitutes for the published rules.
