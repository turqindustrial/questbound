# Conversations, companions and presentation

Updated September 29, 2026.

## Player-facing changes

- Scene changes prepare the location illustration and present characters' portraits before applying the action or changing screens. Images are generated through the existing private DM service and decoded before display. Retry keeps the same prepared result and dice; Stay here cancels without applying that result.
- Character popups fit the entire available portrait, preserving heads and edges. No new portrait is needed for this layout change.
- Mouse-wheel scrolling uses the nearest scrollable pane with room, then passes to the page at its boundary. Popup headings and portraits can scroll the popup's contents.
- Conversations include nearby conscious NPCs and companions. Each reply uses the speaker's name. The redundant Story consequence entry is hidden, including old saved entries; world facts remain in DM memory and the journal.
- Players can invite NPCs through the DM. Motives and trust determine agreement, refusal, or an engine-rolled Persuasion check. Hostile NPCs cannot be recruited without resolving the conflict. Followers can travel, wait, resume and leave the party; their status survives reloads.
- “Stab them” uses the current conversation partner, recent surviving combat target, current creature, or sole present NPC. A stab prefers an available piercing melee weapon. The resolved command is reused during commit so the target cannot change between preview and execution. Other paraphrases may be interpreted by the DM using legal choices.
- The standalone Dice Roller spins and bounces before showing its d20 result. Repeated clicks are locked during the roll; reduced-motion preferences shorten it and remove spinning.

## Attack rules corrected

Melee weapon attacks and melee spell attacks do not receive disadvantage merely for being within 5 feet of an enemy. Ranged spell attacks use the recorded distance instead of silently defaulting every target to 5 feet. The adjacent threat must be able to see the attacker and not be incapacitated.

NPC attacks now honor the player's active Blur defense, as creature attacks already did. Dodge and Blur do not stack extra dice. Help advantage cancels disadvantage. The separate Heavy weapon ability requirement remains in place.

Official revised rules references:
- https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game
- https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary
- https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf

## Validation

- All 35 verification scripts passed, including new attack-context and companion regressions. Coverage includes named/short attack equivalence, actual damage, melee/ranged modes, NPC Blur, Dodge/Help cancellation, recruitment checks, follower presence, wait/resume/dismiss, betrayal, saves and legal destination speakers.
- Web production export passed.
- Isolated browser checks passed for animation/result, whole portrait, scrolling over popup headings, story-feed scrolling passing to the page, two named NPC replies, recruitment and follower controls, and a short attack committed against the conversation partner with normal roll mode and actual HP loss.
- Injected image failure/delay verified that cancelling preserved the old location, retry held the old screen until ready, and successful travel committed one turn and brought the follower along.
- One synthetic live request to the existing DM service returned HTTP 200, two valid NPC dialogue entries and a motive-based recruitment check. No user adventure was modified by that request. Browser QA uses mock replies and cached artwork.

## Current limits

This remains the prototype's existing two-NPC social and combat model. Recruitment does not invent adventuring class levels, full follower turns against arbitrary creatures, or additional NPCs. Tactical positions and all D&D conditions are not fully simulated; the DM must respect the supplied engine state. The opening attack before initiative remains the user's chosen house rule.

QA entry point: `qa-companions-server.cjs` serves `dist-companions` on localhost:8086 with disposable saves. It is separate from the user's localhost:8081 game and does not call the paid API.
