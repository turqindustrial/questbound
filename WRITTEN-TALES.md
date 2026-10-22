# Written tales: the format

This is the authoritative format of a **written tale**: a tale written by hand (by a writer agent or a person), checked,
and put on the permanent **Written tales** shelf, grouped Short, Medium and Long. A writer authors from this document
and the brief of their tale (its catalogue entry and its line of the name register, given with it). The format, its
validators (`stagingRules.js`) and the checker (`check-written-tale.cjs`) were frozen first so that writing could
begin; the engine that plays the staging (`seatStaging`, `withBeats`, the same file) and the shelf that serves tales
(`written-shelf.cjs`, with the New Adventure screen's Written tales) have landed since (section 17).

- **Format version:** `"format": 1`, staging `"v": 1`.
- **Where tales live:** one file per tale, `.questbound-written/<slug>.json` (git-ignored; under `QUESTBOUND_DATA` when
  hosted; a copy in the host's Desktop folder "Questbound written tales"). Drafts live anywhere (the build workflow uses
  `C:/Users/itsbr/qb-work/tales/drafts/<slug>.json`).
- **In the repository:** only this document, `stagingRules.js` (the validators and vocabularies), `check-written-tale.cjs`
  (the checker), `verify-written-format.cjs` (its test) and `written-fixture.json` (a small example tale that never goes on
  the shelf). The repository is public: a real tale is never committed, because every twist would be readable.
- **The worked example** is `written-fixture.json`: a complete two-chapter Short tale that passes the checker. Read it
  beside this document.

Contents: [The file](#1-the-file) · [The story](#2-the-story) · [Names](#3-names) · [The staging](#4-the-staging) ·
[Conditions](#5-conditions) · [Effects](#6-effects) · [The walkthrough](#7-the-walkthrough) · [Tiers](#8-the-tiers) ·
[Text rules](#9-text-rules) · [Pictures](#10-pictures-cost-nothing) · [Craft rules](#11-the-craft-rules) ·
[Rubrics](#12-the-rubrics) · [The checker](#13-the-checker) · [game.pace](#14-gamepace-runtime-state-for-reference) ·
[Worked example](#15-a-short-worked-example) · [Decisions and the catalogue](#16-decided-while-freezing-it-and-the-catalogue) ·
[For the runtime](#17-for-the-runtime-the-next-step)

---

## 1. The file

A tale file is one JSON object. Every key below is required unless it says *optional*. Any other key is an error.

| Key | Value | Meaning |
|---|---|---|
| `format` | `1` | This format. |
| `id` | a lower-case UUID, `8-4-4-4-12` hex digits | Fixed for ever, the same in every edition. Each copy a player starts is tagged with it (its art id is `journey-<id>`, so its places and people are painted once for everyone). Make one with `node -e "console.log(crypto.randomUUID())"`. |
| `slug` | 3–28 characters: `a-z`, `0-9`, `-` | The tale's short name. The file on the shelf is `<slug>.json`. Play counts call the tale `w-<slug>`. |
| `edition` | whole number from 1 | Raised on every revision. Copies already started keep the edition they began with. |
| `order` | whole number 0–9999 | Its place on the shelf (lower first). Never "newest first". |
| `listed` | `true` or `false` | Whether the shelf shows it. |
| `addedAt` | `"YYYY-MM-DD"` | The day it went on the shelf ("New" for 14 days after). |
| `length` | `"short"`, `"medium"` or `"long"` | Its tier (section 8). |
| `minutes` | `[low, high]` | How long it takes, low below high. Short: multiples of 10 within 30–60. Medium: multiples of 30 within 120–240. Long: multiples of 30 within 360–1200. |
| `difficulty` | `"gentle"`, `"steady"` or `"hard"` | Gentle: single creatures, a boss with no minions. Steady: one pack or ally fight, a boss with one minion. Hard: packs, a boss with two minions; the clock also ticks on long rests (`staging.ticks.rest`, which the checker requires). The card never mentions luck. |
| `party` | `"any"` or `"together"` | `any`: "Solo or up to four heroes". `together`: "Best with 2–4 heroes" (set pieces with parallel objectives). |
| `levels` | `[lowest, highest]`, 1–20 | The hero levels it is written for. The checker seats heroes at the lowest, middle and highest. |
| `firstTale` | `true` (*optional*) | The one "Start here" tale on the shelf: a gentle Short. |
| `notes` | *optional*, 0–3 lower-case words or short phrases, ≤20 characters each | Content notes on the card: `["undead", "drowning", "grief"]`. |
| `shape` | `{"engine": slug, "twist": slug, "endings": [1–4 slugs]}` | The variety grid (section 8.2). Slugs are lower-case words joined by hyphens. Never shown to players. |
| `pitch` | `{"hook", "blurb", "mood", "special"}` | What the card says (below). |
| `story` | object (section 2) | The tale itself. |
| `walkthrough` | object (section 7) | For the checker only; never served. |

**The pitch** (never the twist, never an errand, never past what chapter 1 reveals):

| Key | Limit | What it is |
|---|---|---|
| `hook` | ≤140, a full sentence | A person, a problem and a clock. |
| `blurb` | ≤300, full sentences | The premise and the hero's place in it. |
| `mood` | ≤40 | Two or three words ("Dread · one night"). Never "mystery" unless it is one. |
| `special` | ≤160, a full sentence | The one thing no other tale has. |

The card also shows the length badge ("SHORT · ABOUT 40 MIN"), the difficulty, the party line and "2 chapters · 3
endings" (counts, never chapter titles). The cover is the starting place's picture (section 10).

---

## 2. The story

`story` holds exactly the fields below. **The game sets these, so never write them:** `id`, `status`, `written`,
`libraryId`, `artId`, `foeStats` (the foe's numbers come from the hero's level), `errand` (written tales have none: chapter
1 is their first step), `introId`, `geography` (write `layout`), `chapter`, `pitch` (it sits at the top of the file) and
`regard` on anyone (the game works out each person's view of the hero's kind once it knows the hero).

All lengths are in characters. **Every text that is prose ends on a full sentence** (`.`, `!` or `?`, a closing quotation
mark may follow; never `…`). Names, titles, labels and kinds are not prose.

### 2.1 The tale

| Key | Limit | Meaning in play |
|---|---|---|
| `title` | ≤100 | The tale's name. |
| `premise` | ≤800 | The situation, for the Dungeon Master (it becomes the tale's first world fact). |
| `opening` | **≤450** | The cold open, told as the first scene. Already mid-incident, 3–4 sentences, ending on a demand or a question (section 9). |
| `objective` | ≤400 | The aim of the whole tale. |
| `resolution` | ≤600 | What success looks like (conditions, not an outcome). |
| `secret` | **≤600** | The hidden truth. The Dungeon Master sees it; players never do. |
| `foe` | ≤80 | The antagonist's name only. The boss, met at the stronghold (`locations.bridge`). |
| `foeSpecies` | ≤80 | What the foe is. One of the thirteen common peoples (section 10) gives a free face; anything else must fit the creature library. |
| `foeAppearance` | 10–600 | How the foe looks: public, no spoilers, no numbers. |
| `foeDamageType` | `Slashing`, `Piercing`, `Bludgeoning`, `Cold`, `Fire`, `Poison` or `Necrotic` | What the foe's blows do, to match its look. |
| `foeVoice` | ≤300 | How the foe speaks, with one sample line in quotation marks. The Dungeon Master speaks as the foe in this voice. |
| `hoard` | `{"item", "name" ≤60, "note" ≤160}` | The one remarkable thing the foe carries, given to whoever beats it. `item` is one of: `weapon+1`, `weapon+2`, `weapon+3`, `armor+1`, `armor+2`, `shield+1`, `shield+2`, `shield+3`, `cloak-of-protection`, `ring-of-protection`, `stone-of-good-luck`, `bracers-of-defense`, `gauntlets-of-ogre-power`, `headband-of-intellect`, `boots-of-elvenkind`, `cloak-of-elvenkind`, `eyes-of-the-eagle`, `wand-of-the-war-mage+1`, `wand-of-the-war-mage+2`, `wand-of-the-war-mage+3`, `wand-of-magic-missiles`, `periapt-of-wound-closure`. Uncommon items are given at any level, rare from level 5 (`weapon+2`, `armor+1`, `shield+2`, `ring-of-protection`, `bracers-of-defense`, `wand-of-the-war-mage+2`), very rare from level 11 (`weapon+3`, `armor+2`, `shield+3`, `wand-of-the-war-mage+3`); a hero too low, or one it does not suit, is given another item instead. `name` is our own; `note` is one sentence on how it looks. |
| `region` | ≤60 | The land's name (not the title). |
| `terrain` | `plains`, `forest`, `hills`, `mountains`, `coast`, `marsh`, `desert`, `snow` or `caverns` | The land's kind. It chooses the pictures. |

### 2.2 The land

| Key | Value | Meaning in play |
|---|---|---|
| `locations.inn` | `{"name" ≤80, "description" 10–500, "kind"}` | **The cold-open place** where the tale starts (any kind: a landing, a square, a coach road). Its kind and the terrain make the cover. |
| `locations.bridge` | same | **The antagonist's stronghold.** "Confront &lt;foe&gt;" is offered here from chapter `confrontFrom` on. Never the place of a set piece. |
| `locations.tower` | same | **The midpoint place** (never a records house). |
| `layout` | `{"bridge": {"bearing", "miles"}, "tower": {"bearing", "miles", "from": "inn"\|"bridge"}}` | Where the stronghold and the midpoint lie: bearing `N`, `NE`, `E`, `SE`, `S`, `SW`, `W` or `NW`; miles 0.1–8 (`bridge` from the start, `tower` from `from`). Each copy turns the bearings a little at random. |
| `landmarks` | list (tier counts, section 8), each `{"name" 2–60, "description" 10–300, "kind", "bearing", "miles" 0.1–12, "from": "inn"\|"bridge"\|"tower", "danger": "safe"\|"risky", "feature" 3–200 *optional*}` | Further places on the map from the start, unvisited. Set pieces happen here (section 4). `risky` means something may lurk there on a first visit. `kind` is any place kind but `lair`. |
| `lands` | *optional*, at most 2, each `{"name" 2–60, "terrain", "bearing", "miles" 15–300, "place": {"name" 2–60, "description" 10–300, "kind"}, "rumour" 3–200 *optional*}` | Countries beyond this one, each with one known place days away by road. Never the tale's own region. Short tales have none. |

Place kinds: `settlement`, `camp`, `road`, `forest`, `wilds`, `mountain`, `water`, `ruin`, `cave`, `shrine`, `landmark`,
`lair` (the last only for the three locations).

### 2.3 The chapters and leads

| Key | Value | Meaning in play |
|---|---|---|
| `chapters` | 2–6 (tier counts), each `{"title" ≤80, "goal" ≤300, "turn" **≤200**}` | `goal`: what the player must do now, an action at a place, naming it. `turn`: the chapter's **truth**, what finding it reveals; the Dungeon Master reads it while the chapter is under way and tells it when the chapter's find holds. Exactly one staging chapter goes with each (section 4). |
| `leads` | *optional*, at most 4 (tier counts), each `{"title" ≤80, "hook" ≤300}` | Side errands heard of early. Their ids are given by position: the first is `l1`, then `l2`... Written with no `id`. A lead closed by its staging condition pays experience once; ticked by hand it is a note. |

### 2.4 The cast

| Slot | Meaning |
|---|---|
| `npcs.keeper` | **The first person who demands something of the hero.** |
| `npcs.mara` | **A companion in waiting with an agenda of their own**: the one most likely to join the hero. |
| `residents` | Everyone else, by where they live. `noticed: false` hides someone until found. |

**The main foe is never also keeper, mara or a resident.** Before the fight the foe is narrated (story.foe,
foeAppearance, foeVoice) and brought on by beats.

`npcs.keeper` and `npcs.mara`, each:

| Key | Limit |
|---|---|
| `name` | 2–60 |
| `species` | ≤80; one of the thirteen common peoples unless cast from the library (section 10) |
| `gender` | `woman`, `man` or `other` (a woman never has facial hair) |
| `role` | 3–300: who they are here |
| `motive` | ≤400: what they want, now |
| `appearance` | 10–600: public look, no spoilers |
| `personality` | 10–300: how they speak and act |
| `ties` | `{"other": tie, "foe": foe tie, "note" ≤200}`: how they regard each other and the foe |
| `class` | `null` or a class they are truly trained in: `Artificer`, `Barbarian`, `Bard`, `Cleric`, `Druid`, `Fighter`, `Monk`, `Paladin`, `Ranger`, `Rogue`, `Sorcerer`, `Warlock`, `Wizard` |
| `pool` | *optional*: a people-library id (`np042`) when cast from the library (section 3.4) |

Ties: `family`, `beloved`, `close friend`, `friend`, `ally`, `acquaintance`, `rival`, `enemy`. Foe ties: `kin`,
`beloved`, `ally`, `neutral`, `enemy`.

`residents` (at most 12), each:

| Key | Limit |
|---|---|
| `name` | 2–60 |
| `species` | ≤60; one of the thirteen common peoples unless cast from the library |
| `gender` | `woman`, `man` or `other` |
| `role` | 3–200 |
| `appearance` | 10–400 |
| `personality` | ≤200 |
| `motive` | ≤300 |
| `toughness` | `frail` (children, the old, the sick), `common` or `tough` (guards, soldiers, hardened folk) |
| `attitude` | `unfriendly`, `indifferent` or `friendly`: how they take to a stranger |
| `at` | **the exact name of the place they live**: a location, a landmark or a far place |
| `noticed` | `true` (in plain sight) or `false` (found only by searching or asking; never at the start) |
| `foe` | a foe tie (above) |
| `tie` | `null` or `{"to": a name (keeper, mara or another resident), "kind": a tie}` |
| `class` | `null` or a class (above) |
| `pool` | *optional*: a people-library id |

**Seating:** the start holds at most 2 residents, any other place at most 3. A resident whose `at` names no place is
seated at the start, and dropped when the start is full: the checker refuses both.

### 2.5 The first scene

| Key | Value | Meaning in play |
|---|---|---|
| `introduction` | `{"you" ≤100, "place" ≤100, "trouble" ≤150, "people" ≤150, "first" ≤120}` (half the usual limits) | The plain card before the opening: who the hero is here, where (place and land by name), what is happening, who is in front of them (by name), what they could do first. A written tale's card shows `place`, `trouble` and `first`; the Dungeon Master reads all five. Never the secret. The hero is only "you": no name, species, class or past. |
| `openingDialogue` | 1–2 lines, each `{"speakerId", "text" ≤300}` | Spoken as the opening plays, by different speakers saying different kinds of thing (a plea, a warning, an order). `speakerId` is `keeper`, `mara` or `residentN`: the Nth resident (1-based), who must live at the start. Spoken words only. |

---

## 3. Names

### 3.1 Exact names

Conditions, effects, `at`, `staging.places` and the walkthrough name places and people by their **exact names**. Case,
extra spaces and a leading "The" do not matter (`"the lower stage"` is `"The Lower Stage"`); anything else does. The game
resolves a name against the seated game: a place to `inn`, `bridge`, `tower` or a map place (`p1`...), a person to
`keeper`, `mara` or someone of the tale (`n1`...), hidden people included. The foe is not a person of the tale: refer to
it with `{"foe": ...}`.

### 3.2 Unique

- Within a tale: every place name differs from every other, every person's name from every other, every creature's
  name from every other; no person, place, land or the foe shares a name with something of another sort; the region
  is not a place's name.
- Across the shelf (`--shelf`): no place, land, region, title, foe or person's full name is used by another tale; no
  **name part** of a person or the foe is used by a person of another tale. A name part is a word of three letters or
  more, titles left out (the, of, old, young, brother, sister, mother, father, ma, pa, nan, gran, granny, grandmother,
  grandfather, dame, sir, lady, lord, duchess, duke, captain, sergeant, marshal, elder, squire, jarl, princess, prince,
  queen, king, councillor, factor, harbour-master, lord-protector, lord-general, master, mistress, goodwife, goodman,
  widow, doctor).
- Not a part of a ready-made hero's name: Kara, Vell, Pip, Thistledown, Ilyra, Dawnmere, Borin, Emberhand.
- The name register (your brief) reserves names for each catalogue tale: use your tale's own, never another's.

### 3.3 Avoid and deny lists

- **Avoid list** (overused or clashing): no name contains the whole word Pell, Noll, Rusk, Tallow, Edda, Mara, Sorn,
  Voss, Vell, Venn, Vale, Tern or Ysolde; no place or land name contains "glass"; the words "reeve" and "crossroads"
  appear nowhere in the tale.
- **Deny list:** Questbound is its own world. No name, place, god, organisation, creature or spell of another
  publisher, game, book or film appears anywhere in the tale; the checker carries the list. No proper name (people,
  places, lands, region, title, creatures, items) uses a subclass or feature name of another book (the checker's list,
  kept in step with `verify-subclasses.cjs`); such ordinary words stay free in prose and in chapter and ending titles.

### 3.4 People from the library

A person may be cast from the host's people library (`.questbound-people/library.json`): give them `pool` (the id) and
write the library's **exact name, species and gender** (errors otherwise), its class (or `null` when it has none) and its
appearance word for word (warnings otherwise: the portrait shows the library's look). Their role, motive, personality,
ties and home are the tale's own. A library person is cast once in a tale and once on the shelf.

A person not from the library never has a library person's full name; sharing one name part with a library person is a
warning (the Dungeon Master may bring that person into play later).

---

## 4. The staging

`story.staging` is the tale's plan for the engine. It is one object:

```jsonc
{
  "v": 1,
  "length": "short",                 // short | medium | long: the file's length
  "quiet": 3, "drift": 8,            // optional: quiet moves before the clock acts (1-10), and a pressure step every
                                     // `drift` chapter moves regardless (4-30). Defaults: short 3/8, medium 4/10, long 5/12
  "ticks": {"rest": false, "days": 1},  // optional: what else ticks the clock (below). A hard tale has "rest": true
  "confrontFrom": 2,                 // optional: the chapter (1-based) from which "Confront <foe>" is offered; default the last
  "noBeyond": true,                  // optional: no "beyond the map" journeys before the last chapter (keep true for short and medium)
  "firstSay": ["≤110", "≤110", "≤110"],                          // exactly 3 things the player might say first
  "stakes": [ {"id": "s1", "name": "≤60", "state": "≤80"} ],     // 0-4; ids s1-s4
  "places": { "<exact place name>": {"colour": ["≤140"]} },     // 0-12 places; 1-3 lines each
  "chapters": [ /* exactly one for each story chapter, in order (4.1) */ ],
  "leads": [ {"id": "l1", "opens": 1, "done": {"reach": "..."}} ],   // optional, 0-4
  "boss": { "if": null, "objective": "≤160", "minions": [ /* 0-2 creatures */ ],
            "bloodied": {"kind": "call", "tell": "≤160", "line": "≤160"},
            "deadline": {"turns": 3, "tell": "≤160", "then": {}}, "hold": {"rounds": 3, "tell": "≤160", "then": {}} },  // optional, every key optional
                                     // (bloodied may add "ally": one creature that answers a "call")
  "endings": [ /* 2-4, the last with no "if" (4.3) */ ]
}
```

| Key | Meaning in play |
|---|---|
| `firstSay` | On the opening turn the Suggestions bar offers these three lines (a tap fills the message box). A decision under pressure, three different ways in. |
| `ticks` | Besides drift and quiet, what moves the clock. `rest`: a long rest owes a pressure step (default false; **a hard tale sets it true**, because its card says the clock ticks on long rests; any tale may, as a tale of "rests are the resource" does). `days`: 0, 1 or 2 steps owed for each day of the tale's time that passes, on the road or resting (default 1; 2 for a tale whose clock is "dusk and noon"). |
| `stakes` | Named people or places whose state the tale changes. Shown on the Quest tab ("At stake: Kettle Camp: holding on.") and to the Dungeon Master. `name` is a name; `state` a few words, lower case, no full stop. Changed by `{"stake": ...}`. |
| `places` | Game-told arrival lines: when the game tells a journey itself, a line of the place's `colour` replaces "You arrive at X without incident." Keys are exact place names. |
| `leads` | For a story lead (by id): `opens`, the chapter from which it is open (default 1), and `done`, the condition that closes it (paid once). A lead with no entry closes only when the Dungeon Master says so (a warning). |
| `boss.if` | "Confront <foe>" is offered (from `confrontFrom`) only while this holds: a foe met "only if you raced", "only once the deed is out". `null` or left out: always. |
| `boss.objective` | What the boss fight is for ("keep him from the fuse"); the Dungeon Master reads it in the fight. |
| `boss.minions` | Up to two creatures at the foe's side when it is confronted, each `{"template", "name" ≤60, "appearance" ≤400}`. They stand beside it as the fight with it begins, from level 2 (a pack is one of its kind, the orc a goblin below level 3; only `bandit`, `wolf`, `goblin`, `skeleton`, `boar`, `spider` and `orc` can stand beside it), each a creature four levels below the hero (never below level 1) at three fifths of its kind's hit points (more at a table: the side's scaling); the foe gives up a fifth of its own hit points for each, and its turn at half (a rage, a call) some more (`storyBossStats`), so foe and minions are one fight. They scatter once the foe falls; a hero who runs meets them again with the foe, unless they were all beaten (then the foe comes alone). |
| `boss.bloodied` | What the foe does once, the first time it is at half its hit points or less: `call` (help arrives: `ally`, one creature `{"template", "name", "appearance"}` (optional, `call` only; without it the first minion comes again), from level 2, in a free place beside the foe), `flee` (it breaks away: the fight is over, the foe has at least seven tenths of its hit points when met again (it binds its wounds) and its minions go with it; the hero goes after it with Approach at its stronghold, and it does not break away again) or `rage` (one more blow a turn). Its `tell` is the next telling, in the fight (the move that bloodies it already goes to the Dungeon Master); `line` when the game tells it. |
| `boss.deadline`, `boss.hold` | As a set piece's (4.1): win within `turns`, or hold out `rounds` before the foe can be beaten. The foe's own effects never `advance` or `end` (the foe beaten is how its chapter closes). |

**Ids.** Every id is a lower-case letter, then up to 23 letters, digits or hyphens. Beat, complication, pressure-step,
choice and ending ids are unique across the whole tale. Option ids are unique within their choice. Stake ids are `s1`
to `s4`, each once. Lead ids are the story's (`l1` for its first lead).

### 4.1 A chapter

```jsonc
{
  "where": "≤200",       // where and how this chapter's truth (its turn) is found: two or more ways in
  "agenda": "≤160",      // what the foe (or its face) is doing now, on screen or by its traces
  "found": { "any": [ /* 1-6 conditions: the routes to the truth */ ],
             "item": {"name": "≤60", "note": "≤160"} },        // optional: given to the hero when the chapter closes
  "opening": {"tell": "≤240", "line": "≤160", "then": {}},     // chapters 2 and later only, optional
  "then": {},                                                   // optional: effects when the chapter closes
  "beats": [ {"id": "b1", "when": {/* condition */}, "if": null, "tell": "≤240", "line": "≤160", "then": {}} ],  // 0-4
  "complications": [ {"id": "x1", "if": null, "tell": "≤160", "line": "≤160", "then": {}} ],                // 0-3
  "pressure": [ {"id": "p1", "if": null, "tell": "≤200", "sign": "≤120", "line": "≤160", "then": {},
                 "spared": {"tell": "≤200", "line": "≤160", "sign": "≤120"}} ],                             // 2-4 (tier); "if" and "spared" optional
  "fight": { "at": "<landmark or far place>",
             "threat": {"template", "name": "≤60", "appearance": "≤400", "ally": null},
             "objective": "≤160",
             "fromLevel": 3, "otherwise": {"template", "name", "appearance", "ally": null},   // optional
             "deadline": {"turns": 3, "tell": "≤160", "then": {}},                            // optional
             "hold": {"rounds": 3, "tell": "≤160", "then": {}} },                             // optional
  "choice": { "id": "c1", "opens": null, "ask": "≤200",
              "options": [ {"id": "hide", "label": "≤80", "say": "≤110", "if": null, "when": null, "then": {}} ],   // 2-4 (tier)
              "late": "hide" }                                                                                     // optional
}
```

| Part | Meaning in play |
|---|---|
| `where`, `agenda` | Read by the Dungeon Master while the chapter is under way (with the chapter's `turn`, its truth). Never shown to players. |
| `found` | **What closes the chapter.** When any route holds, the engine closes it: the truth is told as the turn's beat (at whatever cost the dice set), `found.item` is given, the chapter's `then` and its choice's `late` apply, the next chapter's fight is armed and its `opening` is told. In the last chapter the find completes the tale and the engine picks the ending. At least two routes, at least one mechanical, talk standing alone only as 5.2 says. |
| `found.item` | Given **however the chapter closes** (its find, the clock's last step, or the Dungeon Master's story-advance), so a later `{"carry"}` of it is safe. |
| `opening` | Chapters 2+: told as the chapter begins (`tell` to the Dungeon Master, `line` when the game tells it itself). Its `then` applies as the chapter begins. |
| `then` | Effects when the chapter closes, however it closes. No `advance` or `end` here. They count from the next chapter's opening. |
| `beats` | Authored moments **of this chapter**. When nothing else is due, the first unfired beat whose `when` (and `if`, when given) holds fires: its `then` applies and the Dungeon Master tells `tell` in the next reply that goes to it. One beat is due at a time; none fire in a fight (they wait). A beat whose chapter closes before it fires is dropped. **The find comes first**: a beat whose `when` is one of the chapter's own routes never fires (the checker refuses it): give that moment to the next chapter (where the hero stands counts as reached as it opens) or to the chapter's `then`. |
| `complications` | Fired only when play goes quiet (`quiet` quiet moves), before the next pressure step; one with an `if` only while it holds (else the next is tried). |
| `pressure` | **The antagonist's clock.** A step fires when a tick is owed (a long rest when `ticks.rest`, each day of the tale's time per `ticks.days`, a `{"clock": 1}`), every `drift` chapter moves, or when play goes quiet. It applies `then`, and its `sign` becomes the Quest tab's "Out of sight" line. A step with an `if` happens only while it holds; otherwise it is **spared**: the clock still moves, its `then` does not apply, and `spared` is told instead (its `sign`, when given, is shown). **The last step always happens (no `if`) and always closes the chapter: `{"advance": true}`** (the truth told at a cost), **and in the last chapter it ends the tale: `{"end": "late"}`.** So a chapter can never stall for ever. (The engine also closes a chapter whose steps have all fired, whatever they say.) |
| `fight` | The chapter's **set piece**: when the chapter begins, the place `at` becomes a lair held by `threat` (a fight on arrival). `at` is a landmark or a far place, never inn, bridge or tower. `objective` is what the fight is for (the Dungeon Master reads it in the fight). Chapter 1's fight is 0.1–0.3 mile from the start. `fromLevel`: the set piece is armed only for heroes of that level or more (at a table, the table's level); below it `otherwise` is armed instead (or nothing). Chapter 1's set piece needs `otherwise` when its `fromLevel` is above the tale's lowest level. `deadline`: the fight's rounds are counted (a round is the hero's turn and the foe's; at a table, the turn order's round); once `turns` have passed and the fight is not won, its `tell` is told in the fight and its `then` applies at once, except `advance` or `end`, which close the chapter (or end the tale) as soon as the fight is over, however it ended. `hold`: its `tell` is told as the fight begins; until `rounds` rounds have passed the creature cannot be brought below 1 hit point, and then its `then` applies (the same rule for `advance` and `end`). A deadline or hold fires once, even if the hero runs and comes back. |
| A second set piece | Medium and Long chapters have one or two set pieces: the second is an `arm` in a beat, a complication or a pressure step. |
| `choice` | **A turning point.** Opens when `opens` holds (`null`: as the chapter begins) and nothing else is due, and **stays open** until it is decided or the chapter closes; the Dungeon Master puts `ask` to the player inside the scene. While it is open (out of fights) Say offers each option's `say` line. Choices are never buttons: the player types, and the Dungeon Master records the option only when the player's words or deeds clearly choose it. Each option: `label` (what the player commits to, ≤80, no full stop), `say` (≤110, a full sentence in the player's voice), `if` (`null` or a condition: the option can be chosen only while it holds, as "settle: needs the deed exposed and the foe bloodied"), `when` (`null` or a condition: the engine settles the option itself when it holds), `then` (effects; every option should cost something). `late`: the option applied if the chapter closes undecided (optional: without it, no option is recorded); it has no `if`, and no `advance` or `end` in its `then` (the chapter is closing already). |

**A creature** (`fight.threat`, `fight.otherwise`, `arm`, `boss.minions`) is `{"template", "name" ≤60, "appearance" ≤400}`,
and a threat may add `"ally": null` or one creature `{"template", "name", "appearance"}` at its side.

| Template | What it is (stats only) |
|---|---|
| `bandit` | one armed person |
| `wolf` | one great wolf |
| `goblin` | a band of three |
| `skeleton` | one of the restless dead, bones |
| `boar` | one great boar |
| `spider` | one giant spider |
| `zombies` | a band of two of the walking dead |
| `orc` | one towering brute (use it only for a single named sellsword; playable peoples are never villains by kind) |
| `wolves` | a pack of two |

Templates are stats only: the creature's **name and look decide its picture**, kind words first (name what it is: a wolf,
a spider, a scorpion, the drowned dead). Below level 3 the game swaps `zombies` for a `skeleton`, `wolves` for a `wolf`
and the `orc` for `goblin`s. An ally is one of `bandit`, `wolf`, `goblin` (the band), `skeleton`, `boar`, `spider` or
`orc`, never the same template as the threat it stands beside **nor the one that threat becomes below level 3** (a
skeleton beside zombies, a wolf beside wolves, goblins beside the orc: it would be dropped); it comes only from level 2
(the `orc` from level 3).

### 4.2 Text that the game tells and the Dungeon Master tells

Every beat, complication, pressure step and opening has a `tell` and a `line` (a spared step its `spared`):
- `tell` is for the Dungeon Master: it is the STORY BEAT of the next reply, told after the results of the player's move,
  through the people present or what the hero finds. Concrete; it starts no fight and moves nobody the game has not moved.
- `line` is **voice-neutral**: the game tells it itself when the Dungeon Master cannot be reached, beside any of the three
  narrators. Plain, one sentence, no flourish.
- `sign` (pressure steps) is what the world shows of the clock, shown on the Quest tab: "A lantern moves where no boat should be."

### 4.3 Endings

```jsonc
"endings": [
  {"id": "crossing", "title": "≤60", "if": {/* condition */}, "text": "≤600"},
  {"id": "dawn", "title": "≤60", "text": "≤600"}                // the last: no "if", the default
]
```

When the tale completes, the engine takes **the first ending whose `if` holds**, else the last (the default, which has
no `if`; every other ending has one). So an ending whose `if` can hold only when an earlier one's does is never chosen
(the checker refuses it): put the narrower ending first. An ending whose `if` always holds (someone met at the start, a
level every hero has) leaves every ending after it unchosen, and one that can never hold (two options of one choice,
slain and subdued) is never chosen: both are refused. The Dungeon Master tells `text` as the tale's last scene; the
feed shows "Ending: <title>." and the device records it. 2–4 endings (tier counts), different in kind, never worse
versions of each other; a tale that ended late (the clock's last step) has the flag `late`, and the late ending is a
full ending.

### 4.4 A turn, in order

What the engine does after every move (the runtime's `withBeats`; written here so authors know what comes first):
1. **Told.** The beat the last request carried (by its id) is marked told, whether the Dungeon Master told it or the
   game told its `line`.
2. **Counters** (`game.pace`, section 14): the chapter's moves, quiet moves, who spoke, and what happened (events: an
   arrival, a fight won, a search, a check, a long rest) for the chapter.
3. **A chapter closed outside** (the Dungeon Master's story-advance): closed as below.
4. **Found.** A route that holds closes the chapter (or completes the tale). It replaces a beat that is due but untold.
5. **Beats.** If nothing is due, the first beat whose `when` and `if` hold fires.
6. **Choice.** An option whose `when` (and `if`) holds is settled; otherwise the choice opens when `opens` holds and
   nothing is due.
7. **Clock.** Only if nothing is due, out of a fight: an owed tick, drift or quiet fires the next complication or step
   (at most one a turn; two turns at least between clock beats).

**One thing is due at a time:** `{"kind", "id"}`. When a beat or a step closes the chapter or ends the tale, the due
thing is the chapter's truth (`turn`) or the ending, with the id of what closed it, and the Dungeon Master tells that
step's `tell` first, then the truth or the ending. Whatever else would fire waits for its turn: **events count for the
whole chapter**, so nothing loses its moment while it waits.

---

## 5. Conditions

A condition is **an object with exactly one key**, read from what the engine keeps (never from the Dungeon Master's
words). They nest at most 4 deep; `any` and `all` hold 1–8 conditions; one condition holds at most 12 plain conditions
in all.

| Condition | Exact shape | True when |
|---|---|---|
| reach | `{"reach": "<place>"}` | The hero has arrived there **since the chapter began** (or stood there as it began). |
| at | `{"at": "<place>"}` | The hero is there now. |
| clear | `{"clear": "<place>"}` | The place's threat is beaten (a set piece or an `arm` there; anything else can never hold, so the checker refuses it). Arming a place again makes it uncleared until it is beaten again. |
| won | `{"won": "<place>"}` | A fight at that place has ended in victory since the chapter began. |
| searched | `{"searched": "<place>"}` | The hero has searched the fallen there (the Loot move) since the chapter began. |
| checked | `{"checked": "<place>"}` | A world check (the Dungeon Master's check), passed **or failed**, has been resolved while the hero stood there since the chapter began: a failure finds the truth at a cost. |
| spoke | `{"spoke": {"who": "<person>", "times": 2}}` | The person spoke in `times` (1–6, default 2) Dungeon-Master-told turns this chapter. |
| met | `{"met": "<person>"}` | The hero has met them (keeper, mara and everyone at the start are met at once; a hidden person once found). |
| with | `{"with": {"who": "<person>", "at": "<place>"}}` | The person follows the hero (`at` optional: with the hero at that place). |
| fate | `{"fate": {"who": "<person>", "is": "alive"}}` | `is`: `alive` (not dead), `dead`, `down` (alive but knocked out or at no hit points), `following` or `hostile` (their attitude). |
| foe | `{"foe": "beaten"}` | The main foe is `slain`, `subdued`, `beaten` (slain or subdued), `fought` (hurt in a fight, or beaten) or `bloodied` (at half its hit points or less, or beaten). |
| carry | `{"carry": "<item name>"}` | The pack holds an item of that name (from `give`, `found.item` or the hoard; anything else only the Dungeon Master can hand over: a warning). |
| mark | `{"mark": {"<choice id>": "<option id>"}}` | That option of that choice was made. |
| flag | `{"flag": "<flag>"}` | The flag is set (by a `flag` effect, or `late`). |
| told | `{"told": "<beat id>"}` | That beat, complication or pressure step has been told (a spared step is not). |
| step | `{"step": 2}` | That many pressure steps (1–4) have fired in this chapter. |
| rest | `{"rest": true}` | A long rest has been taken since the chapter began. |
| days | `{"days": 2}` | That many days (1–30) of the tale's time since the chapter began. |
| level | `{"level": 3}` | The hero is that level or more (at a table, the table's level). |
| any | `{"any": [ ... ]}` | Any of them. |
| all | `{"all": [ ... ]}` | All of them. |
| not | `{"not": { ... }}` | It does not hold. |

**Events** (`reach`, `won`, `searched`, `checked`, `rest`) are kept for the chapter (`game.pace.seen`), so a beat, a
choice or a route that has to wait its turn never loses its moment; they start again with each chapter. In an ending's
`if` (read when the tale closes) they count only the last chapter: `clear`, `foe` or a flag say more (a warning).

A condition using a kind a build does not know never holds on that build (section 14).

### 5.1 Where conditions go

`found.any` (routes), a beat's `when` and `if`, a complication's and a pressure step's `if`, a choice's `opens`, an
option's `if` and `when`, a lead's `done`, `boss.if`, an ending's `if`.

### 5.2 Rules for `found`

- At least **two routes**, never the same route twice.
- At least one **mechanical** route: `reach`, `at`, `clear`, `won`, `searched`, `checked`, `carry`, `with`, or `foe` slain,
  subdued or beaten (an `all` counts when every part is mechanical; an `any` when one is).
- **Talk:** a route of talk alone (`{"spoke": ...}` standing alone, or as one way of an `any`) needs `times` of 2 or
  more, beside another route that is mechanical; the truth is then found from a person. In an `all`, talk stands only
  beside something done: every other part is mechanical (`{"all": [{"clear": "The Lower Stage"}, {"spoke": {"who":
  "Dickon Barrow"}}]}`). Talk with someone who is with the hero from the start (keeper, mara, a resident of the start)
  is a warning: two exchanges with them close the chapter before its set piece.
- **Never at once:** no route holds already as its chapter opens (chapter 1 is read against every seated hero: the start
  is reached, everyone there is met, everyone is alive, no flag is set).
- **Never impossible:** no route needs two things that cannot hold together (two options of one choice, the foe slain
  and subdued, someone dead and alive, a condition and its `not`), nor what comes only later: a beat, a choice or a
  flag of a later chapter, an item given only as this chapter closes (its own `found.item`) or later, a place armed only
  later, a `step` the clock never reaches (the last step closes the chapter), a level above the tale's.
- **Beats never wait for each other:** a beat (or a step's or complication's `if`) waiting for a telling that waits for
  it never fires.
- **`clear` of a place armed in an earlier chapter** may hold already: arm it again as this chapter opens (its fight,
  an `arm` in its `opening`, or in the last chapter's `then`), or use `won`.
- No truth behind a single roll: `checked` counts a failed check too.
- A `foe` route before `confrontFrom` can never hold; one after `confrontFrom` may hold as its chapter opens (a warning).

---

## 6. Effects

A `then` is an object of effects, **each kind at most once**. All effects are idempotent (a beat fires once) and each
writes at most one story-log line.

| Effect | Exact shape | What the engine does |
|---|---|---|
| bring | `{"bring": "<person>"}` | The person comes to the hero: present, no longer hidden, met. **A resident** (keeper and mara stay at the start unless they follow the hero: the checker refuses them). |
| send | `{"send": {"who": "<person>", "to": "<place>"}}` | The resident goes to live elsewhere (taken, fled): any place of the tale, the three starting places included. Not keeper or mara. |
| arm | `{"arm": {"at": "<place>", "template", "name" ≤60, "appearance" ≤400, "ally": null, "fromLevel"?, "otherwise"?}}` | The place becomes a lair, armed for the hero's next arrival (the level rules of 4.1 apply), and uncleared until it is beaten. Never where the hero is fighting. `at` is a landmark or far place. A place is armed at most once a chapter. |
| place | `{"place": {"at": "<place>", "description" ≤300, "danger": "safe"\|"risky"}}` | A landmark or a far place changes (burned, flooded). Give `description`, `danger` or both. Never the three starting places. |
| stake | `{"stake": {"s1": "≤80"}}` | One or more stakes change; a feed card. |
| give | `{"give": {"name" ≤60, "note" ≤160}}` | The hero receives a quest item. |
| attitude | `{"attitude": {"who": "<person>", "to": "unfriendly", "memory" ≤160}}` | Someone's view of the hero shifts, with a memory in their words. `to`: `hostile`, `unfriendly`, `indifferent`, `friendly` or `devoted`. |
| offer | `{"offer": "<person>"}` | A "Take X along" offer. It is made when the person is with the hero, and **waits until they are** (until they join or the tale ends), so it never lapses because the hero is elsewhere. |
| fact | `{"fact": "≤200"}` | A world fact the Dungeon Master keeps. |
| lead | `{"lead": {"open": "l1"}}` or `{"lead": {"close": "l1"}}` | A lead is opened, or closed (paid once). |
| flag | `{"flag": "<flag>"}` | Sets a flag (an id; at most 24 flags in a tale; `late` is reserved). |
| decide | `{"decide": {"<choice id>": "<option id>"}}` | Records a choice the player let lapse. |
| clock | `{"clock": 1}` or `{"clock": -1}` | `1`: the next pressure step is owed now ("pressure +1 now": it fires as soon as nothing else is due). `-1`: the next step that would fire is held back once ("the clock stops one step"). |
| advance | `{"advance": true}` | Closes the chapter now: its truth becomes the due beat, told at a cost. |
| end | `{"end": "late"}` | In the last chapter only: the tale completes with the flag `late`. |
| boss | `{"boss": {"minions": false}}` or `{"boss": {"hurt": true}}` | The boss loses its minions (they leave its side now, and never stand beside it), or comes to the fight hurt (a quarter of its hit points gone when the fight with it first begins). |

**Where `advance` and `end` may go:** a beat, a complication, a pressure step, a fight's deadline or hold, or a choice's
option. `advance` only outside the last chapter, `end` only in it. Never in a chapter's own `then` or an `opening`'s.

**When effects count:** an effect in a chapter's `opening` counts from that chapter's opening; one in a chapter's own
`then` from the next chapter's opening; any other from the moment it fires in its own chapter.

---

## 7. The walkthrough

`walkthrough` is read by the checker only. It scripts the authored path (`golden`) and a path to every other ending.
The checker checks its shape and names, then plays them through the game's rules (`written-walk.cjs`, check 5) with
seeded dice and scripted Dungeon Master replies, and also plays a **passive** player (only talks, rests and
wanders) and a **violent** one (kills each resident the tale names), which need no script.

```jsonc
"walkthrough": {
  "golden": {"ending": "<ending id>", "steps": [ /* 1-400 steps */ ]},
  "endings": { "<every other ending id>": [ /* steps */ ] }
}
```

A step is an object with **exactly one** of these keys (`say` may add `speakers`):

| Step | Shape | The move |
|---|---|---|
| go | `{"go": "<place>"}` | Travel to a known place. |
| say | `{"say": "≤300", "speakers": ["<person>"]}` | A turn of talk told by the Dungeon Master; `speakers` (up to 4, optional) are the people who answer. |
| fight | `{"fight": true}` | Fight what holds this place until it is beaten. |
| confront | `{"confront": "slay"}` | Confront the foe at the stronghold and fight to the end: `slay` or `subdue`. |
| attack | `{"attack": {"who": "<person>", "to": "kill"}}` | Fight a person of the tale here to the end: `kill` or `subdue` (a brawl). |
| search | `{"search": true}` | Search the fallen here. |
| check | `{"check": "pass"}` | A world check here: `pass` or `fail`. |
| rest | `{"rest": "long"}` | `short` or `long`. |
| choose | `{"choose": {"<choice id>": "<option id>"}}` | The player's words clearly choose that option; the Dungeon Master records it. |
| join | `{"join": "<person>"}` | Someone joins the hero. |
| find | `{"find": "<person>"}` | The player searches or asks, and the Dungeon Master brings a hidden person into the scene. |
| advance | `{"advance": true}` | The Dungeon Master closes the chapter (story-advance). |
| lead | `{"lead": "l1"}` | The Dungeon Master closes a lead (lead-done). |
| wait | `{"wait": 10}` or `{"wait": {"moves": 10, "talk": true}}` | That many quiet moves (1–200) in which nothing happens: moves of talk (`talk`: true, half a quiet move each) or not (the default). |

The golden path stays within the tier's moves (section 8).

---

## 8. The tiers

### 8.1 Budgets

Pace is 60–80 seconds a move on average. The checker refuses a tale outside the bold rows; the others are warnings or
checked once the engine lands.

| | **Short** | **Medium** | **Long** |
|---|---|---|---|
| On the card | SHORT · ABOUT 40 MIN | MEDIUM · 2–3 HOURS | LONG · 8 HOURS OR MORE |
| `minutes` | **30–60, multiples of 10** | **120–240, multiples of 30** | **360–1200, multiples of 30** |
| Moves (golden path) | 25–45 | 100–180 | 300–450 |
| **Chapters** | **2** | **3–4** | **5–6** |
| Fights, boss included (set pieces + armed places + the boss) | 3–4 | 6–8 | 12 or more |
| Set pieces | 1 a chapter, plus the opening fight | 1–2 a chapter | 2 a chapter |
| **Landmarks** | **2–4, all within a mile of the start** | **4–5** | **6** |
| **Far lands** | **none** | **0–1** (only if the road is the adventure) | **1–2** |
| **Named people** (keeper, mara, residents) | **4–7** | **6–9** | **9–12** |
| **Pressure steps a chapter** | **3** | **3–4** | **4** |
| Quiet moves before the clock acts (`quiet`, default) | 3 | 4 | 5 |
| **`quiet` at most** | **5** | **6** | **7** |
| A pressure step every N chapter moves (`drift`, default) | 8 | 10 | 12 |
| **Longest a stalled chapter lasts** (its steps × `drift`) | **24 moves** | **40** | **48** |
| **Choices** | **1–2** | **2–3** | **3–4** |
| **Options a choice** | **2–3** | **2–3** | **2–4** |
| **The staging's size** (its JSON) | **16,000 characters** | **32,000** | **48,000** |
| **Endings** | **2–4** | **3–4** | **3–4** |
| **Leads** | **0–1** | **2** | **3–4** |
| A new hero ends near level | 2–3 | 4–5 | 6–8 |
| At a table of 3–4 heroes | about ×1.5 time | same | same |

Also always: **chapter 1 has a set piece 0.1–0.3 mile from the start** (the first fight by minute 3), `firstSay` has
exactly three lines, `staging.length` is the file's `length`, and a hard tale's clock ticks on long rests
(`"ticks": {"rest": true}`). A Medium or Long tale's clock is planned per chapter (section 16).

### 8.2 Variety (the shelf)

`shape` places a tale on the variety grid. In one tier no two tales share an `engine`, a `twist`, or the same set of
`endings`; on the whole shelf a `twist` appears at most twice. Each tale's cover (its starting place's kind and the
terrain) is its own. Use these slugs for the catalogue tales:

| Tale | engine | twist | endings |
|---|---|---|---|
| S1 The Last Ferry | `one-night-siege` | `victim-started-it` | `battle`, `mercy` |
| S2 Noon at Cresset Cross | `deadline-rescue` | `condemned-used-you` | `exposure`, `bargain` |
| S3 Marrow's Masked Night | `crew-heist` | `decoy-and-betrayer` | `caper` |
| S4 The Lamp for the Ninth Shaft | `rescue-delve` | `dead-want-justice` | `justice`, `rest`, `sealed` |
| S5 The Last Coach over Grimfell | `survival-journey` | `rescuer-is-killer` | `warrant`, `mercy` |
| S6 The Prize Pig of Wending Fair | `comic-escort` | `victim-did-it` | `comic` |
| M1 Nine at Lakemarch | `tournament-whodunit` | `victim-was-in-on-it` | `trial`, `law`, `hush` |
| M2 The Witness in White | `escort-pursuit` | `peace-is-confession` | `truth`, `flight`, `sold` |
| M3 The Weather-Seller's Bell | `rival-race` | `patron-caused-it` | `sink`, `share`, `sell` |
| M4 Six Days to Brackenfold | `prepare-and-defend` | `land-was-stolen` | `battle`, `bargain` |
| M5 The Caravan Without Shadows | `bargain-mystery` | `broker-sold-them` | `price-paid` |
| L1 The Winter That Would Not Break | `expedition-war` | `ally-is-her-son` | `sacrifice`, `mercy` |
| L2 The Name-Broker | `noir-pursuit` | `you-were-his-collector` | `restore`, `keep`, `inherit` |
| L3 Three Passes, Two Queens | `succession-war` | `pretender-is-honest` | `crown`, `council`, `tyranny` |

None of them has a keeper-orders-you errand, a records house, an archive trip or a hearing, or "the trusted guide
secretly helped the foe". A trusted person is the villain only in S5, the man in charge only in S4.

---

## 9. Text rules

- **The opening** is at most 450 characters, already mid-incident, and **ends on a demand or a question**: its last
  sentence ends with `?` or `!` (a closing quotation mark may follow), or is someone's words in quotation marks, or turns
  to the hero ("you", "your").
- **Reading before the first move** is at most **900 characters**: the introduction's `place`, `trouble` and `first`, the
  opening, and the opening lines, counted together.
- **What the game tells** (every `tell`, `line`, `sign` and `colour`) has **no digits** and **no rule talk**, and nor
  does anything the player reads or the Dungeon Master is handed from the staging (`firstSay`, `say`, `ask`, `label`,
  stake states, ending titles and texts, memories, facts, notes, objectives). Rule talk is a rule word **in its rule
  sense**: HP, DC, XP, hit points, saving throw, armour class, spell slot, experience points, bonus action, proficiency
  bonus; and phrases such as "your turn", "next round", "each turn", "rounds of combat", "a Wisdom check", "the check
  fails", "level up", "your level", "third-level", "deals fire damage", "points of damage", "with advantage", "advantage
  on", "your roll", "a natural roll", "rolls for initiative", "initiative order". Ordinary English stays free: "round the
  fire", "turn back", "a turn in the road", "at every turn", "level ground", "the lower levels", "the cart rolls out",
  "keep it in check", "storm damage", "to his advantage", "took the initiative". Rule talk elsewhere in the tale is a
  warning. Numbers in other prose are spelled out (a warning otherwise; ids such as `b2` are not prose).
- **Overused words**, each at most once in the whole tale: ledger, archive, hearing, record, tally (any form).
- **Every prose text ends on a full sentence** (section 2).
- **Voice:** `line` and `sign` sit beside any narrator (The Chronicler, Wick the Lamplighter, Sable the Bard): plain, no
  jokes, no flourish. `tell` gives the Dungeon Master something concrete to perform.
- **For players 16 and over:** horror by restraint; deaths told plainly.

---

## 10. Pictures cost nothing

A written tale is illustrated entirely from the host's libraries, for free:

- **The cover** is the starting place's picture: its `kind` in the tale's `terrain`. No two tales on the shelf share
  that pair.
- **Every place** has a picture of its kind (or a related kind) in its land (the place-art library covers every kind in
  every terrain).
- **Every creature** (set-piece threats and their allies, armed places and theirs, the boss's minions, and the foe when it
  is not of a common people) must fit the creature library: name what it is in its name or look.
- **Every person** not cast from the library is of one of the **thirteen common peoples**, written exactly: `Human`,
  `Dwarf`, `High Elf`, `Wood Elf`, `Drow`, `Half-Elf`, `Halfling`, `Gnome`, `Goblin`, `Goliath`, `Orc`, `Tiefling`,
  `Dragonborn`. They are shown with a look-alike's face. A child or one of the dead is painted once for the shelf (a
  warning: not free).

---

## 11. The craft rules

1. **The cold open is in motion.** At most 450 characters, already mid-incident, ending on a demand. A real decision on
   turn 1, a fight by minute 3.
2. **The hero's stake needs no class and no past.** The hero is named, accused, owed, forged into debt, recognised,
   mistaken for someone, or the one chosen. Never "the hired hand".
3. **The antagonist** has a face and a voice (`foeVoice`), a concrete want right now, and a plan whose steps are the
   clock; it is present in every chapter, in person by narration, through a lieutenant, or by an unmistakable act
   (`agenda`). At most a fifth of the shelf has a sympathetic foe.
4. **Every chapter** has a place, an opposition, a person who wants something, a truth and a cost. Its goal is an action
   at a place. Its truth comes two ways (`where`) and never behind a single roll. Its set piece has a complication in the
   place itself: rising water, a bell, a crowd, a burning rope.
5. **Reversals:** Short at chapter 1's end; Medium in the middle chapter; Long at the midpoint and late. No twist kind
   more than twice on the shelf.
6. **The cast:** 4–12 named people (the tier's range). Each wants something from the hero now, and two wants pull against
   each other. One person can join the hero, with an agenda of their own. The opening lines each say a different kind of
   thing.
7. **Choices:** every option costs something, changes the game (an attitude, a person, a fight, the clock, the ending)
   and has a `say` line.
8. **Endings:** 2–4 that differ in kind, never worse versions of each other. The late ending is a full ending.
9. **Words:** Questbound's own world; SRD 5.2 rules only; 16+. Horror by restraint; deaths told plainly. No rule words
   or numbers in prose. No paperwork plots. Playable peoples are never villains by kind. Most people come from the
   thirteen common peoples (free faces).

What the engine cannot play is never promised as mechanics: anything else the tale needs is told by the Dungeon Master.

---

## 12. The rubrics

Two critics score a tale after it passes the checker: 0–2 for each item, 20 points each. A tale passes when the checker
exits 0, each critic scores at least 16 and no item scores 0.

**Critic A, engagement:**
1. The opening is in motion and personal.
2. The first decision comes by turn 1 and the first fight by minute 3.
3. The antagonist is on screen in chapter 1 and acts in every chapter.
4. Each clock step changes something the player will feel.
5. Each chapter has a set piece or a hard choice, preferably both.
6. Each truth is found at a place, from a person or in a fight, two ways.
7. The reversal is fair: clued at least one chapter earlier, and it recasts something seen.
8. Every option costs something.
9. The endings differ in kind.
10. The passive and violent players still get a story.

**Critic B, fit:**
1. Our own world, with no echo of another publisher.
2. SRD 5.2 only; nothing the engine cannot play is promised as mechanics.
3. Tier budgets are met.
4. Names are unique and avoid the avoid list.
5. Variety on the shelf: no engine, twist kind or ending kind in its tier twice.
6. Reading load and card fields are within limits.
7. The 16+ tone is right, horror by restraint.
8. Creatures and peoples are used fairly.
9. The pitch sells the premise, never the twist or an errand.
10. It plays at a table: choices make sense for several heroes, and "Best with 2–4" is set where it should be.

Each critic writes:

```json
{"slug": "last-ferry", "rubric": "A", "scores": [{"item": 1, "score": 2, "why": "≤200", "fix": "≤300"}], "total": 18, "pass": true}
```

---

## 13. The checker

Run it in a checkout or worktree of the build branch (never the live checkout). It calls no AI, opens no port and only
reads the libraries:

```
node check-written-tale.cjs <tale.json> [--json] [--people <dir>] [--creatures <dir>] [--places <dir>] [--shelf <dir>]
```

The folders default to the live data folders (`.questbound-people`, `.questbound-creatures`, `.questbound-place-art`,
`.questbound-written`) under `QUESTBOUND_DATA`, the checkout, or the main checkout of its git repository (so a worktree
finds them). A missing people, creature or place library fails the check; a missing shelf is a warning (names are then
checked within the tale only). `--json` prints the report as JSON (`ok`, `errors`, `warnings`, `todo`, `checks`,
`seated`, `readingLoad`, `stagingSize`, `pools`, `libraries`). **Exit 0 when the tale passes** (warnings allowed: read them), **1 when it
fails** or cannot be checked. Each error names the path of the field (`story.staging.chapters[0].found`) and what to do.

| Check | What it checks |
|---|---|
| 1 Shape and limits | Every key known and every field within its limit (the written-tale limits included); nothing the game sets is written; the staging sound (`stagingProblems` with unknown keys reported); every prose text ends on a full sentence. |
| 2 Seating | The ready-made Fighter, Rogue, Wizard and Cleric at the lowest, middle and highest level, and parties of 2 and 4 at the lowest and highest (`partyInTale`): the tale seats and makes a valid adventure every time; every resident lives where `at` says; the opening lines, landmarks and lands are all kept; tidying changed nothing written. |
| 3 Names | Every name the staging uses resolves; names unique in the tale and across the shelf; the avoid and deny lists; the ready-made heroes' names; people cast from the library. |
| 4 Structure | Finds (5.2: two different routes, one mechanical, talk as 5.2 says; no route that holds as its chapter opens, chapter 1's read against every seated hero; none that can never hold in its chapter; `clear` of a place armed earlier only when armed again); beats and choices that never get their turn (a beat or a choice's `opens` that is one of its chapter's routes; a condition that can never hold there, two things that cannot hold together among them; beats waiting for their own or each other's telling; an option settled as the chapter opens); leads that hold at once or never; endings never chosen (behind an earlier one, or after one that always holds) or never holding; the clock (each chapter's steps × `drift` within the tier's stall bound, `quiet` within its limit, a hard tale's `ticks.rest`); the staging's size; the tier's budgets; chapter 1's fight (and its `otherwise` when it waits for a level); set pieces and `arm` off the three starting places, a place armed at most once a chapter; `place` never at a starting place; `bring` and `send` never keeper or mara; `clear` and `won` only where something is fought; `firstSay`; difficulty (warnings); the shelf's ids, Start here tale and variety. |
| 5 Walkthroughs | The walkthrough's shape and names; then the golden path, every ending's path, a passive player and a violent one played through the rules (`written-walk.cjs`: settleTurn, the staging engine, a device's own way of telling moves and carrying beats, seeded dice, scripted Dungeon Master replies), by the ready-made Fighter at the tale's lowest level taking each level as it comes. Errors: a path that does not reach its ending, a golden path past the tier's moves (fights included), a passive player's chapter the clock does not close near the stall bound, a violent player who cannot finish. Warnings: a path that only some dice reach (seeds 1 to 3), a golden path under the tier's moves, a violent player who dies each time. A step `choose` is said again (up to eight times) while something else is due; a fight lost is fought again after a rest (up to four tries). `--walk <golden\|passive\|violent\|ending id>` prints one walk move by move. |
| 6 Pictures | Section 10. |
| 7 Text | Section 9: the opening, the reading load, digits and rule talk in what the game tells (errors), rule talk in what the player reads from the staging (errors) and elsewhere (warnings), overused words. |
| 8 Balance | Each chapter's set piece (by its level rules) and the foe (its minions, its turn at half, its hold) for the ready-made Fighter, Rogue, Wizard and Cleric at the tale's lowest, middle and highest level, alone and with one more hero, 40 fights a cell with seeded dice (`tale-balance.cjs`; `node balance-check.cjs --tale <file>` prints the table; `--balance N`, `--no-balance`). Warnings against the targets (provisional): fights won (gentle 90%, steady 80%, hard 70%); the foe alone costs 50–80% of hit points with 5–15% falls and under 3% deaths. Error: the ready-made Fighter alone at the tale's lowest level wins a fight less than half the time or dies in one fight in five or more (lighten it). |
| 9 Experience | The levels the golden path gives (the walk takes each as it comes): Short 1–2, Medium 3–4, Long 5–7 (a new hero ends near 2–3, 4–5, 6–8); outside that, a warning. |

The loop: the writer writes; the checker runs (fix and run again, up to 5 times); both critics score; pass, or revise from
both reports (up to 3 critic rounds), then escalate to the main session.

---

## 14. game.pace (runtime state, for reference)

Writers never write this. The engine keeps where a written tale stands in `game.pace`: world state, shared at a table,
never a hero field, never carried into the next tale. `validPace(pace, game)` (stagingRules.js) checks it inside
`validAdventure`; it is valid only with a staged story.

```jsonc
"pace": {"v": 1, "ch": 0, "turns": 0, "quiet": 0, "quietMax": 0, "since": 0, "day": 0, "step": 0, "owed": 0, "held": 0,
         "due": null,                 // or {"kind", "id"?}: turn, opening, beat, complication, pressure, choice, ending, deadline, hold, bloodied
         "told": [], "fired": [],     // ids (a beat, complication, step, choice or ending; "found:1", "opening:2"...), at most 400 each
         "seen": [],                  // the chapter's events: "reach:p3", "won:p3", "searched:p3", "checked:inn", "rest"; at most 400
         "marks": {}, "flags": [],    // choice id -> option id; the tale's flags, "late" with them (at most 25)
         "stakes": {}, "spoke": {},   // stake id -> its state now; person id -> DM-told turns they spoke in this chapter
         "offers": [], "leads": [],   // people offered who were not with the hero yet; leads opened by an effect
         "sign": null, "fight": null, "ending": null, "clockAt": 0}
```

| Key | What it is |
|---|---|
| `v` | The pace's version (1). |
| `ch` | The chapter under way (0-based, as `story.chapter`). |
| `turns` | Moves made in this chapter out of a fight (a fight's rounds are no stall; it starts again with each chapter). Drift owes a step each time it reaches a multiple of `drift`. |
| `quiet`, `quietMax` | Quiet since something last happened, in half moves (a move of talk adds 1, any other quiet move 2), and the most it has reached this chapter. Something happening sets it to 0: a story-log line other than a rest or a return, a beat told, a stake changed, a choice made, a fight begun or ended. |
| `since`, `day` | The tale's clock (map minutes) when the chapter began, and the day (minutes ÷ 1440) last counted for `ticks.days`. |
| `step` | Pressure steps fired in this chapter. |
| `owed` | Steps owed (by rests, days and `{"clock": 1}`), never more than the steps left in the chapter: a road of twelve days owes no more than the chapter has. |
| `held` | Steps to hold back (`{"clock": -1}`). |
| `due` | The one thing to be told next: `{"kind", "id"}` (4.4). |
| `told`, `fired` | What has been told, and what has fired (told or not). A request carries the id of the beat it asks to be told; that id is marked told when the reply (or the game's own `line`) is given, never whatever is due after the move, so nothing is told twice. |
| `seen` | The chapter's events (5), kept only for places the staging names. |
| `marks`, `flags`, `stakes` | Choices made, flags set, stakes changed. |
| `spoke` | Who spoke in Dungeon-Master-told turns this chapter, and how often. |
| `offers` | People an `offer` named who were not with the hero when it fired: offered as soon as they are. |
| `leads` | Leads an effect opened. |
| `sign` | The latest pressure sign (the Quest tab's "Out of sight"). |
| `fight` | The staged fight under way (the chapter's set piece or the foe; any other fight has none): `{"turns", "src", "due", "close"}`, all whole numbers. `turns`: its rounds so far; `src`: 1 the foe, 0 the set piece; `due`: what the fight has to tell now (1 its deadline, 2 its hold, 3 the foe bloodied; 0 nothing), told in the fight and cleared when a request carried it; `close`: a deadline's (1) or hold's (2) `advance` or `end` owed once the fight is over (then only `turns`, `src` and `close` stay until it applies). `null` out of a staged fight. |
| `ending` | The ending taken. |
| `clockAt` | `turns` when the clock last acted, so two clock beats are at least two moves apart (added with the runtime; a pace without it is read as 0). |

**Every build accepts the tales and saves of later builds.** A later version only adds kinds and keys: it never changes
what an existing kind or key means, never removes a pace key and never changes an id's shape. So the validators on
every device and on the campaign server (`validStaging`, `validPace`) check structure and size only: a condition of a
kind the build does not know never holds there, an effect of an unknown kind does nothing, an unknown due kind means
nothing is due, and staging `v` and pace `v` may be any whole number from 1; their lists are sized for the largest tale
any build accepts (a staging is at most 64,000 characters of JSON). The authoring checker alone (`stagingProblems(story,
{strict: true})`) checks the whole vocabulary and every limit of this document.

---

## 15. A short worked example

`written-fixture.json` is the whole tale; these are its bones. **The Kettle Camp Wolves** (Short, gentle, levels 1–3): a
woodcutters' camp in Ollerby Wood where wolves walk in each night.

- **Places:** inn = Kettle Camp (camp, the cover: camp in forest); bridge = The Split Oak (the poacher's lean-to); tower =
  The Old Sawpit; landmarks The Log Slide (0.2 mile, the first fight), Fernmoot Spring, The Deer-Park Wall.
- **Cast:** keeper Mabry Thorne (the camp boss, who demands the sack back); mara Linnet Spey (a forager, offered as a
  companion when chapter 1 closes: the offer waits until she is with the hero); residents Dob Harker and Hester Gale at
  the start, Brother Selwyn Ashe at the spring, Nim Corley hidden in the sawpit. The foe, Corran Stell, is none of them.
- **Chapter 1, "The Log Slide":** the set piece is a wolf at The Log Slide. The find has three routes: reach the Old
  Sawpit; search the Log Slide; or clear it **and** speak twice with Dob Harker. Beat `b1` fires when the slide is
  cleared (the offal trail). The clock: carts loaded, the meal-store rope cut, then the pack rushes the camp and the
  chapter closes at a cost (`{"advance": true}`).
- **Chapter 2, "The Split Oak":** its opening tells the trail running on; beat `b2` brings Nim when the sawpit has been
  reached (a hero whose chapter 1 closed there stands there as chapter 2 opens, so it fires on the next quiet turn); the
  choice `stell` opens once the oak is reached and stays open (`bargain` or `refuse`, `late: "refuse"`); the clock arms
  The Deer-Park Wall with a boar, loads the carts, and at dawn ends the tale late (`{"end": "late"}`). The find: the foe
  beaten, or the oak reached **and** the bargain struck (the arrival is kept for the chapter, so the bargain may come on
  any later turn).
- **Endings:** "A Hunter's Terms" (`{"mark": {"stell": "bargain"}}`), "The Camp Holds" (the foe beaten and not late),
  "The Carts Roll Out" (the default).

```jsonc
{"id": "b1", "when": {"clear": "The Log Slide"}, "if": null,
 "tell": "At the foot of the slide, beside the torn sack, lies a strip of deer offal, fresh and carefully placed, and another beyond it, leading away toward the Old Sawpit.",
 "line": "Fresh offal lies at the foot of the slide, and more of it leads away toward the Old Sawpit.",
 "then": {"stake": {"s2": "saved, mostly"}}}
```

Check it: `node check-written-tale.cjs written-fixture.json` (it warns that its file name is not its slug: it never goes on
the shelf).

---

## 16. Decided while freezing it, and the catalogue

Where the build specification was open or contradicted itself, the format decides:

- **Long rests and the clock.** The card's promise wins: a long rest ticks the clock only when `ticks.rest` is true,
  which every hard tale sets (the checker requires it) and any tale may set. A day of the tale's time owes `ticks.days`
  steps (default 1).
- **Medium and Long clocks are planned per chapter.** A catalogue clock of 6 or 8 steps across a tale is a list of events:
  put each in the chapter it belongs to, fill every chapter to its tier's count of steps with steps of its own, and the
  last step of each chapter closes it (the last chapter's ends the tale late). A "step per long rest" tale sets
  `ticks.rest`; "two steps a day" sets `ticks.days` to 2.
- **"Clock −1", "pressure +1 now", "the clock stops one step"** are `{"clock": 1}` and `{"clock": -1}`.
- **"Unless …" steps** are a pressure step's `if` with its `spared` telling; **"needs …" options** an option's `if`;
  **"from level N, else …"** a set piece's `fromLevel` and `otherwise` (or a beat's `{"level": n}`); **"only if …" bosses**
  `boss.if`; **a bloodied foe** `{"foe": "bloodied"}`; **"survive N rounds"** a `hold`; **a boss objective or fuse**
  `boss.objective` and `boss.deadline`.
- **At most four endings and four options** (a Long tale's choice may have four; Short and Medium three).
- **Talk** may stand alone as a route with two exchanges or more (5.2), as the specification's own S1 does.
- **Events count for the chapter** (`reach`, `won`, `searched`, `checked`, `rest`), and `{"at"}` is "here now".
- **Arming a place again** makes it uncleared; a place is armed at most once a chapter.
- **An offer waits** until the person is with the hero.
- **Keeper and mara are never moved** by `bring` or `send`: the person who is taken, found or sent is a resident.

The catalogue entries of the build specification need these changes as written (the checker reports each):
- **S4** lists five endings: at most four, so fold two of them into one.
- **S5** "Pip Saddler" shares "Pip" with the ready-made rogue: rename her. Its mara is moved by a `send`, which keeper
  and mara never are: make the person who is sent a resident, and give the mara slot to someone else.
- **S6** "Human (cursed)" is not a common people: write `Human` (the curse is told, not a species).
- **S1 and S6** as specified break the gentle definition (packs, a minion, an ally): a warning.
- **The talk routes** of the catalogue ("spoke with … twice") stand as written, with `times` 2; one with keeper, mara or
  someone living at the start is a warning (S1, S4, S5, M1, M3).
- **Beats that are their chapter's own route** (one each in S1 and S4 as specified) never fire: give their effects to the
  chapter's `then` or the next chapter's beats.
- **Writers' briefs.** A writer authors from this document and their tale's brief: its catalogue entry and its line of
  the name register (the build specification's 4.2 and 4.3–4.5), given with this document; names reserved for another
  tale are never used.

---

## 17. For the runtime

What the engine and the shelf must do before any written tale is served, so this format holds in play. The engine's part
landed on 2026-10-22 (`stagingRules.js` seatStaging, withBeats, stagedPreview, taleNow, endingOf, stagingChoices,
writtenCheck; the Dungeon Master's side in dmSceneRules.js and dm-server.cjs; `verify-staging.cjs`), and the shelf the
same day (`written-shelf.cjs`: a file is served only when its own fields are sound and its copy passes `writtenCheck`,
checked once per file time and size, read again within 30 s of a change, never retired, starts counted in `plays.json`;
the listing gives cards only; a start is a copy with its own id, `libraryId`, `artId:'journey-'+id` and `written`;
`verify-written-tales.cjs`). As built:
- **Which beat a reply told.** Each request names the beat its scene carries (`beatSent`: none on a scene cue, out of
  character or for a spell awaiting its ruling, none in a fight); a device and the campaign server record those keys in
  the turn's conversation (`beats`, or `beatTold` for the game's own `line` when the Dungeon Master cannot answer), and
  withBeats marks exactly those told: before the move (the beat due before it) and after it (the beat this very move
  brought due, when the request was built from the staged preview).
- **Not in a fight.** Nothing fires, opens or ticks in a fight; what is due waits, and is not carried, until it ends. The
  chapter's moves (`turns`, drift, the clock's two-move gap) count only moves out of a fight.
- **Rests and the tale's time.** A rest does not move the map's clock, so `days` and `ticks.days` count the road only; a
  long rest owes a step only with `ticks.rest`.
- **Choices.** A choice made applies its option's `then` once; `decide` and `late` apply theirs too and are told "Left
  to fate: <label>." (the story log and the feed), a choice made "You chose: <label>.". A written tale offers no
  `story-complete`: it ends where the engine finds it ends (the DM's `story-advance` still closes a chapter, as below).
- **Leads.** A lead whose `opens` is a later chapter is not told to the Dungeon Master (nor offered as `lead-done`) before
  it, unless an effect opened it.
- **The fight shape** (the same day, `withFightShape` after every step, `verify-fight-shape.cjs`): the foe of a written
  tale is its own stat block (`storyBossStats`: sized by level, by the hero's class when met alone, and by its shape:
  minions and a rage or a call take from its hit points; a second blow a turn only against those who stand in front),
  minions stand beside it from level 2 as creatures three levels below the hero, it turns once at half its hit points,
  holds and deadlines count the fight's rounds (`pace.fight`), and a fight's own due thing is told in the fight. See the
  tables of 4 and 14 for what each key does; check 8 measures it.
Kept from the format's own list:
- **The Dungeon Master never reads the staging.** `storyWorld` (dmSceneRules.js) and `sceneFor` (dm-server.cjs) leave
  `staging` and `written` out of `context.story` (the request is refused past 64,000 bytes, and a long staging alone is
  up to 48,000 characters), and verify-dm-trim measures a full-size staged Long tale (done). A story a table's host posts
  still keeps no staging or shelf tag: written tales come by their journey id, from the shelf.
- **The shelf checks the tidied copy.** `writtenCheck` validates the copy `freshStoryGame` makes (lead ids are given when
  the story is tidied), and runs the checker's name resolution and placement checks (every name resolves, no `arm` or
  `place` at the three starting places, no `bring` or `send` of keeper or mara).
- **`withBeats` and `beatHolds` are total.** Every input `validStaging` and `validPace` accept, and anything else, gives a
  result and never throws; verify-written-format fuzzes `beatHolds` and the validators, and the engine's own check fuzzes
  `withBeats` the same way. An unknown template, a name that resolves to nothing, an `arm` at a starting place or where
  the hero is fighting: the engine skips that effect.
