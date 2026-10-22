# Written tales: the format

This is the authoritative format of a **written tale**: a tale written by hand (by a writer agent or a person), checked,
and put on the permanent **Written tales** shelf, grouped Short, Medium and Long. A writer authors from this document
alone. The engine that plays the staging (`withBeats`, `seatStaging`) and the shelf that serves tales
(`written-shelf.cjs`) come in the next step; the format, its validators (`stagingRules.js`) and the checker
(`check-written-tale.cjs`) are frozen now so that writing can begin.

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
[Worked example](#15-a-short-worked-example)

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
| `difficulty` | `"gentle"`, `"steady"` or `"hard"` | Gentle: single creatures, a boss with no minions. Steady: one pack or ally fight, a boss with one minion. Hard: packs, a boss with two minions; the clock also ticks on long rests. The card never mentions luck. |
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
- The build specification's name register (its section 4.2) reserves names for each catalogue tale: use your tale's own.

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
  "quiet": 3, "drift": 8,            // optional: quiet turns before the clock acts (1-10), and a pressure step every
                                     // `drift` chapter moves regardless (4-30). Defaults: short 3/8, medium 4/10, long 5/12
  "confrontFrom": 2,                 // optional: the chapter (1-based) from which "Confront <foe>" is offered; default the last
  "noBeyond": true,                  // optional: no "beyond the map" journeys before the last chapter (keep true for short and medium)
  "firstSay": ["≤110", "≤110", "≤110"],                          // exactly 3 things the player might say first
  "stakes": [ {"id": "s1", "name": "≤60", "state": "≤80"} ],     // 0-4; ids s1-s4
  "places": { "<exact place name>": {"colour": ["≤140"]} },     // 0-12 places; 1-3 lines each
  "chapters": [ /* exactly one for each story chapter, in order (4.1) */ ],
  "leads": [ {"id": "l1", "opens": 1, "done": {"reach": "..."}} ],   // optional, 0-4
  "boss": { "minions": [ /* 0-2 creatures */ ], "bloodied": {"kind": "call", "tell": "≤160", "line": "≤160"} },  // optional
  "endings": [ /* 2-4, the last with no "if" (4.3) */ ]
}
```

| Key | Meaning in play |
|---|---|
| `firstSay` | On the opening turn the Suggestions bar offers these three lines (a tap fills the message box). A decision under pressure, three different ways in. |
| `stakes` | Named people or places whose state the tale changes. Shown on the Quest tab ("At stake: Kettle Camp: holding on.") and to the Dungeon Master. `name` is a name; `state` a few words, lower case, no full stop. Changed by `{"stake": ...}`. |
| `places` | Game-told arrival lines: when the game tells a journey itself, a line of the place's `colour` replaces "You arrive at X without incident." Keys are exact place names. |
| `leads` | For a story lead (by id): `opens`, the chapter from which it is open (default 1), and `done`, the condition that closes it (paid once). A lead with no entry closes only when the Dungeon Master says so (a warning). |
| `boss.minions` | Up to two creatures at the foe's side when it is confronted, each `{"template", "name" ≤60, "appearance" ≤400}`. Played from the fight-shape step (Phase C); accepted now. |
| `boss.bloodied` | What the foe does once at half its hit points: `call` (help arrives), `flee` (it breaks for a second place) or `rage` (it fights harder). Phase C; accepted now. |

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
  "complications": [ {"id": "x1", "tell": "≤160", "line": "≤160", "then": {}} ],                            // 0-3
  "pressure": [ {"id": "p1", "tell": "≤200", "sign": "≤120", "line": "≤160", "then": {}} ],                 // 2-4 (tier)
  "fight": { "at": "<landmark or far place>",
             "threat": {"template", "name": "≤60", "appearance": "≤400", "ally": null},
             "objective": "≤160",
             "deadline": {"turns": 3, "tell": "≤160", "then": {}} },     // optional; deadline is Phase C, optional
  "choice": { "id": "c1", "opens": null, "ask": "≤200",
              "options": [ {"id": "hide", "label": "≤80", "say": "≤110", "when": null, "then": {}} ],   // 2-3
              "late": "hide" }                                                                          // optional
}
```

| Part | Meaning in play |
|---|---|
| `where`, `agenda` | Read by the Dungeon Master while the chapter is under way (with the chapter's `turn`, its truth). Never shown to players. |
| `found` | **What closes the chapter.** When any route holds, the engine closes it: the truth is told as the turn's beat (at whatever cost the dice set), `found.item` is given, the chapter's `then` and its choice's `late` apply, the next chapter's fight is armed and its `opening` is told. In the last chapter the find completes the tale and the engine picks the ending. At least two routes, at least one mechanical, talk never alone (section 5.2). |
| `opening` | Chapters 2+: told as the chapter begins (`tell` to the Dungeon Master, `line` when the game tells it itself). |
| `then` | Effects when the chapter closes, however it closes. No `advance` or `end` here. |
| `beats` | Authored moments. When nothing else is due, the first unfired beat whose `when` (and `if`, when given) holds fires: its `then` applies and the Dungeon Master tells `tell` in the next reply that goes to it. One beat is due at a time; none fire in a fight. |
| `complications` | Fired only when play goes quiet (`quiet` quiet turns), before the next pressure step. |
| `pressure` | **The antagonist's clock.** A step fires on a long rest or a day on the road, every `drift` chapter moves, or when play goes quiet. It applies `then`, and its `sign` becomes the Quest tab's "Out of sight" line. **The last step always closes the chapter: `{"advance": true}`** (the truth told at a cost), **and in the last chapter it ends the tale: `{"end": "late"}`.** So a chapter can never stall for ever. |
| `fight` | The chapter's **set piece**: when the chapter begins, the place `at` becomes a lair held by `threat` (a fight on arrival). `at` is a landmark or a far place, never inn, bridge or tower. `objective` is what the fight is for (the Dungeon Master reads it in the fight). Chapter 1's fight is 0.1–0.3 mile from the start. `deadline`: Phase C. |
| `choice` | **A turning point.** Opens when `opens` holds (`null`: as the chapter begins) and nothing else is due; the Dungeon Master puts `ask` to the player inside the scene. While it is open (out of fights) Say offers each option's `say` line. Choices are never buttons: the player types, and the Dungeon Master records the option only when the player's words or deeds clearly choose it. An option whose `when` holds is settled by the engine itself. Each option: `label` (what the player commits to, ≤80, no full stop), `say` (≤110, a full sentence in the player's voice), `when` (`null` or a condition), `then` (effects; every option should cost something). `late`: the option applied if the chapter closes undecided (optional: without it, no option is recorded). |

**A creature** (`fight.threat`, `arm`, `boss.minions`) is `{"template", "name" ≤60, "appearance" ≤400}`, and a threat may
add `"ally": null` or one creature `{"template", "name", "appearance"}` at its side.

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
and the `orc` for `goblin`s. An ally is one of `bandit`, `wolf`, `goblin`, `skeleton`, `boar`, `spider` or `orc`, never
the same template as the threat it stands beside; it comes only from level 2 (the `orc` from level 3).

### 4.2 Text that the game tells and the Dungeon Master tells

Every beat, complication, pressure step and opening has a `tell` and a `line`:
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
no `if`; every other ending has one). The Dungeon Master tells `text` as the tale's last scene; the feed shows
"Ending: <title>." and the device records it. 2–4 endings (tier counts), different in kind, never worse versions of each
other; a tale that ended late (the clock's last step) has the flag `late`, and the late ending is a full ending.

---

## 5. Conditions

A condition is **an object with exactly one key**, read from what the engine keeps (never from the Dungeon Master's
words). They nest at most 4 deep; `any` and `all` hold 1–8 conditions.

| Condition | Exact shape | True when |
|---|---|---|
| reach | `{"reach": "<place>"}` | The hero arrives there this turn, or stands there when the chapter begins. |
| clear | `{"clear": "<place>"}` | The place's threat is beaten (a set piece or an `arm` there; anything else can never hold, so the checker refuses it). |
| won | `{"won": "<place>"}` | A fight at that place ended in victory this turn. |
| searched | `{"searched": "<place>"}` | The hero searched the fallen there (the Loot move). |
| checked | `{"checked": "<place>"}` | A world check (the Dungeon Master's check), passed **or failed**, resolved while the hero stands there: a failure finds the truth at a cost. |
| spoke | `{"spoke": {"who": "<person>", "times": 2}}` | The person spoke in `times` (1–6, default 2) Dungeon-Master-told turns this chapter. Never alone (5.2). |
| met | `{"met": "<person>"}` | The hero has met them. |
| with | `{"with": {"who": "<person>", "at": "<place>"}}` | The person follows the hero (`at` optional: with the hero at that place). |
| fate | `{"fate": {"who": "<person>", "is": "alive"}}` | `is`: `alive`, `dead`, `down`, `following` or `hostile` (their attitude). |
| foe | `{"foe": "beaten"}` | The main foe is `slain`, `subdued`, `beaten` (slain or subdued) or `fought` (hurt in a fight). |
| carry | `{"carry": "<item name>"}` | The pack holds an item of that name (from `give`, `found.item` or the hoard; anything else only the Dungeon Master can hand over: a warning). |
| mark | `{"mark": {"<choice id>": "<option id>"}}` | That option of that choice was made. |
| flag | `{"flag": "<flag>"}` | The flag is set (by a `flag` effect, or `late`). |
| told | `{"told": "<beat id>"}` | That beat, complication or pressure step has been told. |
| step | `{"step": 2}` | That many pressure steps (1–4) have fired in this chapter. |
| rest | `{"rest": true}` | A long rest this turn. |
| days | `{"days": 2}` | That many days (1–30) since the chapter began. |
| any | `{"any": [ ... ]}` | Any of them. |
| all | `{"all": [ ... ]}` | All of them. |
| not | `{"not": { ... }}` | It does not hold. |

`won`, `searched`, `checked` and `rest` hold only on the turn they happen: in an ending's `if` (read when the tale
closes) use `clear`, `foe` or a flag instead (a warning).

### 5.1 Where conditions go

`found.any` (routes), a beat's `when` and `if`, a choice's `opens`, an option's `when`, a lead's `done`, an ending's `if`.

### 5.2 Rules for `found`

- At least **two routes**.
- At least one **mechanical** route: `reach`, `clear`, `won`, `searched`, `checked`, `carry`, `with`, or `foe` slain,
  subdued or beaten (an `all` counts when every part is mechanical; an `any` when one is).
- **Talk never stands alone:** no route that `spoke` alone can satisfy; join it to something done
  (`{"all": [{"clear": "The Lower Stage"}, {"spoke": {"who": "Dickon Barrow"}}]}`).
- No truth behind a single roll: `checked` counts a failed check too.
- A `foe` route before `confrontFrom` can never hold (a warning).

---

## 6. Effects

A `then` is an object of effects, **each kind at most once**. All effects are idempotent (a beat fires once) and each
writes at most one story-log line.

| Effect | Exact shape | What the engine does |
|---|---|---|
| bring | `{"bring": "<person>"}` | The person comes to the hero: present, no longer hidden, met. |
| send | `{"send": {"who": "<person>", "to": "<place>"}}` | The person goes elsewhere (taken, fled). |
| arm | `{"arm": {"at": "<place>", "template", "name" ≤60, "appearance" ≤400, "ally": null}}` | The place becomes a lair, armed for the hero's arrival (the level rules of 4.1 apply). Never where the hero is fighting. `at` is a landmark or far place. |
| place | `{"place": {"at": "<place>", "description" ≤300, "danger": "safe"\|"risky"}}` | A place changes (burned, flooded). Give `description`, `danger` or both. |
| stake | `{"stake": {"s1": "≤80"}}` | One or more stakes change; a feed card. |
| give | `{"give": {"name" ≤60, "note" ≤160}}` | The hero receives a quest item. |
| attitude | `{"attitude": {"who": "<person>", "to": "unfriendly", "memory" ≤160}}` | Someone's view of the hero shifts, with a memory in their words. `to`: `hostile`, `unfriendly`, `indifferent`, `friendly` or `devoted`. |
| offer | `{"offer": "<person>"}` | A "Take X along" offer. |
| fact | `{"fact": "≤200"}` | A world fact the Dungeon Master keeps. |
| lead | `{"lead": {"open": "l1"}}` or `{"lead": {"close": "l1"}}` | A lead is opened, or closed (paid once). |
| flag | `{"flag": "<flag>"}` | Sets a flag (an id; at most 24 flags in a tale; `late` is reserved). |
| decide | `{"decide": {"<choice id>": "<option id>"}}` | Records a choice the player let lapse. |
| advance | `{"advance": true}` | Closes the chapter now: its truth becomes the due beat, told at a cost. |
| end | `{"end": "late"}` | In the last chapter only: the tale completes with the flag `late`. |
| boss | `{"boss": {"minions": false}}` or `{"boss": {"hurt": true}}` | The boss loses its minions, or comes to the fight hurt (Phase C). |

**Where `advance` and `end` may go:** a beat, a complication, a pressure step, a fight's deadline or a choice's option.
`advance` only outside the last chapter, `end` only in it. Never in a chapter's own `then` or an `opening`'s.

---

## 7. The walkthrough

`walkthrough` is read by the checker only. It scripts the authored path (`golden`) and a path to every other ending.
Until the staging engine lands the checker checks its shape and names (check 5); then it plays them through the game's
rules with seeded dice and scripted Dungeon Master replies, and also plays a **passive** player (only talks, rests and
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
| search | `{"search": true}` | Search the fallen here. |
| check | `{"check": "pass"}` | A world check here: `pass` or `fail`. |
| rest | `{"rest": "long"}` | `short` or `long`. |
| choose | `{"choose": {"<choice id>": "<option id>"}}` | The player's words clearly choose that option; the Dungeon Master records it. |
| join | `{"join": "<person>"}` | Someone joins the hero. |
| wait | `{"wait": 10}` | That many quiet moves (1–200) in which nothing happens. |

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
| Quiet turns before the clock acts (`quiet`) | 3 | 4 | 5 |
| A pressure step every N chapter moves (`drift`) | 8 | 10 | 12 |
| Longest a stalled chapter lasts | about 24 moves | about 40 | about 48 |
| **Choices** | **1–2** | **2–3** | **3–4** |
| **Endings** | **2–4** | **3–4** | **3–4** |
| **Leads** | **0–1** | **2** | **3–4** |
| A new hero ends near level | 2–3 | 4–5 | 6–8 |
| At a table of 3–4 heroes | about ×1.5 time | same | same |

Also always: **chapter 1 has a set piece 0.1–0.3 mile from the start** (the first fight by minute 3), `firstSay` has
exactly three lines, and `staging.length` is the file's `length`.

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
- **What the game tells** (every `tell`, `line`, `sign` and `colour`) has **no digits** and **no rule words**: HP,
  damage, roll, DC, check, level, levels, XP, slot, turn, round, advantage, disadvantage, initiative, hit point(s),
  saving throw(s), armor/armour class, spell slot(s), experience points. ("The cart rolls out" is fine; "a roll" is not.)
  Numbers in other prose are spelled out (a warning otherwise).
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
`seated`, `readingLoad`, `pools`, `libraries`). **Exit 0 when the tale passes** (warnings allowed: read them), **1 when it
fails** or cannot be checked. Each error names the path of the field (`story.staging.chapters[0].found`) and what to do.

| Check | What it checks |
|---|---|
| 1 Shape and limits | Every key known and every field within its limit (the written-tale limits included); nothing the game sets is written; the staging sound (`stagingProblems` with unknown keys reported); every prose text ends on a full sentence. |
| 2 Seating | The ready-made Fighter, Rogue, Wizard and Cleric at the lowest, middle and highest level, and parties of 2 and 4 at the lowest and highest (`partyInTale`): the tale seats and makes a valid adventure every time; every resident lives where `at` says; the opening lines, landmarks and lands are all kept; tidying changed nothing written. |
| 3 Names | Every name the staging uses resolves; names unique in the tale and across the shelf; the avoid and deny lists; the ready-made heroes' names; people cast from the library. |
| 4 Structure | Finds (two routes, one mechanical, talk never alone); the tier's budgets; chapter 1's fight; set pieces off the three starting places; `clear` and `won` only where something is fought; `firstSay`; difficulty (warnings); the shelf's ids, Start here tale and variety. |
| 5 Walkthroughs | Today the walkthrough's shape and names. **TODO:** golden, passive, violent and every ending played through the rules, once the staging engine lands. |
| 6 Pictures | Section 10. |
| 7 Text | Section 9. |
| 8 Balance | **TODO:** each set piece and the boss for four classes at the tale's levels, solo and with two heroes (gentle 90%, steady 80%, hard 70% won; the boss solo costs 50–80% of hit points with 5–15% falls and under 3% deaths), with `balance-check.cjs --tale`. |
| 9 Experience | **TODO:** the levels gained along the golden path stay within the tier's range. |

The loop: the writer writes; the checker runs (fix and run again, up to 5 times); both critics score; pass, or revise from
both reports (up to 3 critic rounds), then escalate to the main session.

---

## 14. game.pace (runtime state, for reference)

Writers never write this. The engine keeps where a written tale stands in `game.pace`: world state, shared at a table,
never a hero field. `validPace(pace, game)` (stagingRules.js) checks it inside `validAdventure`; it is valid only with a
staged story, and keys it does not know are ignored (a game saved by a later build still loads).

```jsonc
"pace": {"v": 1, "ch": 0, "turns": 0, "quiet": 0, "since": 0, "step": 0, "owed": 0, "day": 0,
         "due": null,               // or {"kind", "id"?}: turn, opening, beat, complication, pressure, choice, ending, deadline, bloodied
         "told": [], "fired": [],   // ids, at most 80 each
         "marks": {}, "flags": [],  // choice id -> option id; at most 24 flags
         "stakes": {}, "spoke": {}, // stake id -> state; person id -> times spoken this chapter
         "sign": null, "fight": null, "ending": null, "quietMax": 0}
```

---

## 15. A short worked example

`written-fixture.json` is the whole tale; these are its bones. **The Kettle Camp Wolves** (Short, gentle, levels 1–3): a
woodcutters' camp in Ollerby Wood where wolves walk in each night.

- **Places:** inn = Kettle Camp (camp, the cover: camp in forest); bridge = The Split Oak (the poacher's lean-to); tower =
  The Old Sawpit; landmarks The Log Slide (0.2 mile, the first fight), Fernmoot Spring, The Deer-Park Wall.
- **Cast:** keeper Mabry Thorne (the camp boss, who demands the sack back); mara Linnet Spey (a forager, offered as a
  companion when chapter 1 closes); residents Dob Harker and Hester Gale at the start, Brother Selwyn Ashe at the spring,
  Nim Corley hidden in the sawpit. The foe, Corran Stell, is none of them.
- **Chapter 1, "The Log Slide":** the set piece is a wolf at The Log Slide. The find has three routes: reach the Old
  Sawpit; search the Log Slide; or clear it **and** speak twice with Dob Harker. Beat `b1` fires when the slide is
  cleared (the offal trail). The clock: carts loaded, the meal-store rope cut, then the pack rushes the camp and the
  chapter closes at a cost (`{"advance": true}`).
- **Chapter 2, "The Split Oak":** its opening tells the trail running on; beat `b2` brings Nim; the choice `stell` opens
  on reaching the oak (`bargain` or `refuse`, `late: "refuse"`); the clock arms The Deer-Park Wall with a boar, loads the
  carts, and at dawn ends the tale late (`{"end": "late"}`). The find: the foe beaten, or the bargain struck at the oak.
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
