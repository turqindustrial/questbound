# Cinematic play and encounter inspection — September 29, 2026

The generated image for the current location now fills the game viewport behind the adventure, journal, and character sheet. It stays fixed while content scrolls. Text sits on translucent dark panels; the region panel keeps navigation and location details without repeating the same scene image. Loading and retry controls remain in the region panel if an illustration is unavailable. Existing saved image identities are reused.

## Combat order

Questbound now uses the player's requested house rule: an initiating attack resolves once before initiative. This is a custom rule, not a claim about standard D&D initiative.

For NPC combat, the opening weapon attack or committed harmful spell resolves first. Initiative is then rolled and conscious participants ahead of the player act. The game stops at the player's first normal turn. A player who wins initiative can therefore take that normal turn after the opening strike. Later turns use the saved order without repeating the opening or rerolling initiative. Downed opponents do not act; a miss still starts combat, and an invalid or uncommitted spell does not.

Direct melee attacks against the nearby encounter creature can start combat in the same message. After confronting a creature or dungeon guardian, a first hostile action likewise resolves before initiative. Existing already-started saves continue to work. The earlier simple creature loop remains in place for other actions; this is not a full tactical initiative engine for arbitrary creatures, reactions, or movement.

The private DM receives this house rule in its action contract, along with the engine's ordered results. The engine commits HP, costs, and dice once. Display playback cannot apply them again.

## Inspection and playback

- **Combat HP** opens the current encounter roster, including the player, participating allies and opponents, downed participants, initiative, and temporary HP. These are live committed values, even while the response is playing back.
- Known character and creature names are red, underlined links in narrative text, turn events, the adventure log, journal, and character references. A name opens a read-only sheet with species, class/profile, level, AC, HP, and all six ability scores. Links match complete names and established aliases, not substrings inside unrelated words.
- Sheets reflect the prototype's real mechanical profiles. Current townsfolk use a level-1 commoner profile with +0 ability modifiers and no adventuring class features. Creature levels represent encounter scaling; creature ability scores reflect the saving modifiers used by the current engine. These limitations are stated on the sheets.
- Newly generated adventures include explicit NPC species and foe species/type. Older stories without those fields display **Not recorded**. Existing lore and saves are not rewritten or guessed from an image.
- The response feed has a fixed responsive height. Confirmed events fade in progressively; reduced-motion settings skip the animation. The composer does not move as rows appear. Scrolling back stops following the latest events. **Show all now** remains available. Health/effects and NPC controls sit below the composer so changes there do not push the input around.

## Verification

All 33 `verify-*.cjs` scripts passed. The new `verify-cinematic-combat.cjs` covers opening-before-initiative order, single damage application, later turns and reloads, defeated defenders, invalid weapons, direct creature attacks, cantrip costs, HP/stat-sheet values, and exact name matching. Existing combat/playback expectations were updated for the explicitly requested house rule. Production web export succeeded.

Browser QA used the disposable localhost:8086 fixture with mocked DM replies and previously generated local artwork, without changing the player's localhost:8081 save or making paid test calls. Checks covered full-viewport artwork, translucent text panels, linked NPC sheets, Enter-to-send attacks, opening attack order in the feed, combat HP before/after retaliation, and reload persistence. During a complete follow-up turn, the composer stayed at the same measured position and height. At a 390-pixel viewport, document width and scroll width both measured 390 pixels. The browser viewport was restored afterward.

`qa-cinematic-server.cjs` is an isolated development helper, not imported by the game. The game remains at http://localhost:8081/.
