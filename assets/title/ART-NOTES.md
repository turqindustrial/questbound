# Title paintings

Two paintings of the same battle are the backdrop of the title screen and the menus: four heroes against a lich in its lair. Both were painted on 2026-10-02 by the game's own illustration service (a high-quality `title` kind that was switched on in `world-art.cjs` only while they were made, then removed: a paired tester must not be able to ask for costly paintings).

- `questbound-title-wide.jpg` (1536 × 1024): for computers and for a phone held sideways. Painted afresh later on 2026-10-02 after the host saw a third leg on the monk: the monk's pose was spelled out (a flying side kick in profile, exactly two legs, one extended and one bent, two arms) and a line asking for correct anatomy on every figure was added; the best of three candidates was kept.
- `questbound-title-tall.jpg` (1024 × 1536): for a phone held upright.

## What was asked for

Shared by both:

> Four heroes fight it, each wreathed in spell-light of their own colour. A WARLOCK in dark hooded robes hurls crackling neon PURPLE eldritch blasts from an outstretched hand, violet sigils spinning around them. A CLERIC in vestments over mail raises a holy symbol blazing neon YELLOW-ORANGE radiant light, a golden sunburst behind their head. A MONK in simple wraps, mid-air in a flying side kick seen clearly in profile: exactly two legs, one extended straight toward the lich and the other bent beneath, exactly two arms with fists raised, arcs of neon WHITE ki trailing from hands and feet. (The tall painting was made with the earlier, shorter monk sentence: "A MONK in simple wraps leaps in a flying kick, fists and feet trailing arcs of neon WHITE ki.") A PALADIN in heavy plate armour with greatsword and shield burns with neon BLUE divine flame, charging. The LICH is a towering crowned skeletal sorcerer in tattered black robes, eye sockets burning, a phylactery glowing at its chest, unleashing torrents of neon GREEN necrotic lightning and swirling emerald runes. Purple, orange, white and blue light collide with the green in a storm of sparks. The lair is a vast black crypt-cathedral of obsidian pillars, chained braziers, a throne of fused bones, glowing magic circles on a cracked dark floor, drifting embers and smoke. Lit almost entirely by the spell-light: deep black shadows, saturated rim light, vivid neon glow. Monumental scale, dramatic low camera angle, the lich looming huge over the heroes. Every figure has correct anatomy: two arms and two legs each, no extra, missing or merged limbs, no duplicated figures. (The last sentence was added for the second wide painting.)

Wide:

> Wide picture. The lich stands high on its dais right of centre, towering. The four heroes are in the foreground and midground across the lower centre and right, seen from behind and in three-quarter view, attacking toward it. The left third of the picture is darker and quieter (pillars, shadow, green mist, no figures), leaving room for a title. Keep every figure inside the middle band of the height: nothing important in the top or bottom tenth.

Tall:

> Tall picture. The lich looms huge in the upper middle of the picture on its throne of bones beneath the dark vault, arms spread, green lightning pouring down. Below it, in the middle of the picture, the four heroes fight upward toward it in a tight group, seen from behind and in three-quarter view. The top sixth is dark vaulting and green haze (room for a title); the bottom quarter is dark floor with reflected glow and smoke. Every figure stays within the central two-thirds of the width.

## How they are shown (`HomeScreen.js` `titleArt`, `App.js`, `webTheme.js`)

- **Wide screens and a phone on its side** (`data-frame=wide`): the wide painting covers the window (`s.backdrop` sets width and height to 100%; an image loaded from a file carries its own pixel size as its style, and without that the picture once stopped short and left wide windows black on the right). The left third is dark on purpose: the name and the menu sit there. The saved hero is a slim strip in the bottom right corner so it never covers the fighters.
- **A long upright phone** (`data-frame=tall`): the tall painting sits between the name and the menu, from the lich's crown to the heroes' feet. When the screen is a little too short for the full width it is drawn slightly narrower with its sides fading out.
- **A shorter upright phone or tablet** (`data-frame=band`): the wide painting is shown across the width as a band between the name and the menu, so the menu never sits on top of the fight.
- `App.js` passes the numbers from `titleArt(width,height)` to the page as `--qb-title-top`, `--qb-title-size`, `--qb-title-edge` and `--qb-title-fade`; the frame rules in `webTheme.js` do the rest. The compact phone menu is taken to be about 236 pixels high (`menuHeight`): change both together.
- The app icons are the page `icon.html` in this folder: a crimson-foil Q in the title typeface inside a red seal with a violet inner ring, over the darkened middle of the tall painting. `node make-icons.cjs` photographs it at each size with a headless Chrome or Edge (home screen, manifest, browser tab and the Android adaptive layers). After changing the icon, raise `?v=N` in the icon links (`public/manifest.json`, `public/index.html`, `fullscreen.js`, the pairing page in `phone-server.cjs`) so installed copies and browser tabs fetch the new one. An iPhone keeps the icon it was added with: remove the home-screen icon and add it again.
