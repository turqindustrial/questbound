# Saves and their formats

Questbound keeps every save any tester-reachable build ever wrote playable. The first playtest build (commit
235726f, 30 September 2026) already went out on a share link, so that is the whole history: nothing is dropped.

## Where saves live

- **In the browser** (per account profile, `playerStorage.js`): the hero (`questbound.character.v1`), the adventure
  (`questbound.adventure.v1`: `{version:1, saveVersion, character, game, health, chosen}`, where `character` is the
  hero as text), the roster of heroes set aside and the graveyard (`rosterRules.js`).
- **Save codes** (Settings → Move your hero, `saveCodes.js`): the same two keys, carried as text.
- **Shared tables** on the host's computer (`campaigns.cjs`): an adventure snapshot, with a party's heroes inside it.
- Account and recovery-code copies (switched off during the beta) hold the same snapshot.

## Formats

| `saveVersion` | Written by | Notes |
|---|---|---|
| none (format 0) | every build from 235726f (30 September 2026) to 13 October 2026 | many shapes over those two weeks: the checks accept all of them |
| 1 | builds from 13 October 2026 | heroes (`makeCharacter`) and snapshots (`adventureSnapshot`) carry `saveVersion` |

The current number is `currentSaveVersion` in `saveVersion.js`.

## Upgrading, once, on load

`saveMigrations.js` (`upgradeCharacter`, `upgradeAdventure`) brings an older save to the current format the first time
this build reads it, and the upgraded save is written back:

- the device: `loadCharacter` and `loadAdventure` (a load cut short between the two writes still finds the adventure:
  `sameHeroText` compares heroes as upgraded), and a hero brought back from the roster (`restoreEntry`);
- the campaign server: a table when it is read, and a hero brought to a table (create, join).

A save code, a restored copy or a table adopted from the server is upgraded the next time the game loads it.
An upgraded copy that would not pass the save checks is never used: the save then plays as it was. Every old shape
still passes the validators, so nothing depends on the upgrade having run.

Format 0 → 1:

- **Hero**: a subclass planned under a name since changed takes its new name (Warrior of the Hidden Step → Warrior
  of the Quiet Step). An old `Elf` or `Dark Elf` stays as written (portraits are painted from the species as written;
  `heroSpecies` reads it as a High Elf, Wood Elf or Drow).
- **Solo adventure**: a level owed on the road, or a main foe beaten and its level not yet taken, becomes experience
  points (the same amount `heroXp` reads); companions from before classes get theirs, out of a fight.
- **Any adventure**: the story so far is folded into the memory (`withMemory`); a grudge from before weights gets the
  weight its words give it.
- **Shared table**: every seated hero as above; party heroes keep their old experience fields until their next award
  (`withExperience` upgrades each member then), because old parties counted a won fight differently for each hero.

Other one-time upgrades that live where their data does: saves from before accounts move into the guest profile when
first read (`playerStorage.js`), the feedback name likewise (`feedbackRules.js`), tables from before seats are seated
when read (`campaigns.cjs`), and graves written with the hero's sheet lose it when the graveyard is read
(`rosterRules.js`).

## The support policy

- Keep loading every save format any tester-reachable build ever wrote.
- From 13 October 2026 every save carries its format, and is upgraded once, on load, in `saveMigrations.js`.
- A format may be retired no earlier than **six months after the last build that wrote it**, and never before the
  full launch. Format 0 was last written on 13 October 2026, so it can be retired on 13 April 2027 at the earliest.
- Retiring a format means the validators may stop accepting it and the lazy readers that only it needs may go
  (`heroXp`'s levels owed and old victory, `legacySpecies`, `renamedSubclasses`, the companion-class effect in
  `Adventure.js` and `server-turn.cjs`, `grudgeWeight`'s reading of words, the memory built from an old story log). The
  steps in `saveMigrations.js` stay as long as any format they read is supported.

## Adding a format

1. Raise `currentSaveVersion` in `saveVersion.js` and add the step to `saveMigrations.js` (pure; the same save in
   gives the same save out; exact, so the upgraded save is the same game).
2. Keep the validators accepting every older shape.
3. Add the build to `builds` in `make-save-fixtures.cjs` and run `node make-save-fixtures.cjs <commit>`: it takes that
   commit's own files out of git, makes heroes, adventures, a roster entry, a save code and a shared table with that
   build's own rules, and writes `save-fixtures/<date>-<commit>.json`.
4. `node verify-saves.cjs` loads every fixture as written, upgrades it through the device's own load and the campaign
   server, checks that it means the same game, and plays a turn from the upgraded save and from the save as it was.
