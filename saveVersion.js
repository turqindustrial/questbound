// The save format this build writes (SAVES.md). Every new hero (makeCharacter) and every adventure snapshot
// (adventureSnapshot) carries it as `saveVersion`; a save without one is format 0, everything written from the first
// playtest build (30 September 2026) to 13 October 2026. saveMigrations.js upgrades older formats once, on load.
// Raise it only together with a new step in saveMigrations.js (and a fixture in save-fixtures/).
export const currentSaveVersion=1;
