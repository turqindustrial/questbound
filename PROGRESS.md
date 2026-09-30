
## Map artwork restoration — September 18, 2026
Fixed explicit map image sizing so the full inn, bridge, watchtower and painted paths remain visible. Reduced dark overlay, anchored smaller labels above landmarks, and restored illustrated close-ups in hover/focus/tap details. Web export passed; isolated browser preview visually confirmed all three landmarks, connecting roads and bridge details. Lantern Vaults remains an off-map destination label, without separate artwork.

## Pending spell reply fix — September 18, 2026
DM response schema now requires a cast/deny/clarify ruling whenever a spell awaits adjudication; action selection and repeated cast commands are excluded in that phase. Resolved-result narration permits no additional effects. Server validation rejects missing decisions. Regression tests pass for missing rulings, all three decisions, unchanged cantrip slots, no damage for denial/clarification, and duplicate-effect prevention. Existing DM suites pass. One isolated live Acid Splash request returned a valid cast ruling with engine-owned damage; user save was untouched. Running DM service loads this correction per request; no new key or restart required.
