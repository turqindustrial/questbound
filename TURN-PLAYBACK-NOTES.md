# Turn playback, conversations, and opening choices — September 29, 2026

The main game remains at http://localhost:8081/. Development changes are in the local questbound project; saved characters and adventures remain in browser storage on their original origin.

## What changed

- Turns now display an ordered record: player intent, initiative, actions, dice and modifiers, damage, consequences, and the final DM narration. Each event appears progressively, with a Show all now control and reduced-motion support. Turns are validated and committed once before playback begins; this is progressive playback of confirmed events, not network streaming of model generation. Leaving or reloading during playback does not roll or apply the action again.
- NPC combat returns explicit chronological events instead of comparing log strings. Round markers distinguish the end of one round from actors who act before the player's next turn. Repeated identical rolls remain visible. Journaling those events also fixes an existing repeated-turn bug that could create empty journal entries and fail save validation.
- Weapon attacks, NPC attacks, spell attacks, and saving-throw spells include their actual rolls and applicable bonuses. Spell damage includes the rolled dice and save adjustment. No extra random draws are made solely for display.
- An ongoing-effects panel exposes recorded concentration, duration counters, temporary HP, target effects, and casting restrictions. New and ended effects, HP changes, and spent spell slots are included in the turn. Narrative world consequences have a separate event label; they are not advertised as implemented numeric effects.
- Conversation view includes a portrait, NPC name and role, attitude, and conversation history. Type a greeting addressed to a nearby NPC or open their conversation card, then use Send to DM as usual. Combat, leaving the scene, and downed NPCs end ordinary dialogue availability. Talking about an attack does not itself leave dialogue. The selected speaker is supplied to the DM.
- New Adventure now leads from Character Selection to Adventure Opening. Choose The Last Caravan, A Bell Beneath the Ice, A Stranger Wearing Your Name, The Garden That Remembers, The Broken Pact, or Let fate decide. Each card explains the setting, first conflict, and arrival. The server selects the corresponding trusted premise and generates new details around it. Existing progress is replaced only after generation, validation, and saving succeed.
- New character saves also go through the opening chooser. Continue preserves the current adventure.

## Persistence and scope

The latest 12 complete turns are saved, with up to 100 bounded events per turn. Earlier journal entries remain in the campaign journal. Old saves without playback remain supported; their most recent DM reply still displays, but old event order is not fabricated. This work does not expand the prototype into a complete D&D combat/spatial/condition engine. Existing engine restrictions still apply.

The initial shared portraits have since been replaced by runtime generation of individual NPC portraits, creature portraits, and location scenes. New adventures supply unique NPC appearances and personalities; existing adventures retain their lore. See WORLD-ART-NOTES.md for the current behavior and verification. The old portrait files remain as unused development assets.

## Verification

All 31 verify-*.cjs scripts passed, including the new verify-playback.cjs. New checks cover initiative ordering, attacks preempted by unconsciousness, repeated turns, damage dice, lingering effects and their end, cantrip slot costs, bounded save/reload, conversation routing, malformed playback rejection, and all six opening prompts. Production web export succeeded.

Browser testing used a separate disposable localhost:8086 fixture with mocked DM responses: NPC portraits and distinct layout, Enter to send, gradual turn reveal, Show all now, ordered combat with real engine rolls, Detect Magic resource/concentration display, reload persistence, opening selection, and fresh-game initialization. The QA helper qa-playback-server.cjs is not imported into the app and does not contact OpenAI.

A separate real request through the existing localhost:8084 DM service returned HTTP 200 and a named Mara conversation with no mechanical action. It did not touch the player's saved game. This confirms live dialogue connectivity, not exhaustive narrative correctness. The main localhost:8081 game was refreshed and Veyra Ashscale's existing adventure and 9/9 HP were verified intact.
