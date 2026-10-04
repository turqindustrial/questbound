# Title painting

`questbound-title.jpg` (1536 × 1024) is the backdrop of the title screen and the menus. It was painted on 2026-10-02 by the game's own illustration service (`world-art.cjs`, kind `landscape`) from this description:

> A vast fantasy valley at dusk seen from a high ridge. On the right-hand third of the picture a lone cloaked traveller stands on a rocky outcrop holding a small warm lantern, seen from behind, small against the land. Beyond them a pale road winds down through dark pine woods past a stone bridge over a silver river toward a ruined round tower on a crag, and far snow mountains under towering storm-lit clouds with a break of gold light. The left-hand third of the picture is quiet, dark forested hillside in deep teal shadow with very little detail. Everything runs edge to edge: a full wide panorama with no frame, no vignette border and no empty margins.

The two battle paintings that replaced it later on 2026-10-02 (four heroes against a lich, one wide and one tall) were retired on 2026-10-04 at the host's request, and this painting came back. They remain in the repository's history.

## How it is shown (`App.js`, `HomeScreen.js` `homeLayout`, `webTheme.js`)

- The picture always covers the window (`resizeMode="cover"`; `s.backdrop` sets width and height to 100%). An image loaded from a file carries its own pixel size as its style, and without that the picture once stopped short and left wide windows black on the right.
- Wide screens and a phone on its side (`data-frame=wide`, from `homeLayout(width,height).wide`): the view sits at 50% 42%, the horizon. The left third is dark on purpose: the name and the menu sit there (`atmosphere-home` darkens it a little more). The saved hero is a slim strip in the bottom right corner, below the lantern-bearer's feet (on a 1366 × 768 laptop the strip is at about y 650 to 712, the traveller's feet at about y 562).
- An upright phone (`data-frame=tall`): only a strip of the picture fits, so the view moves to 62% 50%, the tower, the bridge and the peak. The name sits above, the hero strip and the compact menu below (`atmosphere-home-narrow` darkens the bottom for them).
- The painting drifts in only a little (`qb-drift`, scale 1 to 1.05: the host asked for it zoomed out on 2026-10-02) and holds still in the Light atmosphere.

## The serpent

The turning ring around the launch emblem, the story-loading seal and the page's boot card is a serpent biting its tail (an ouroboros: a public-domain motif, drawn in code as Questbound's own): `serpent.js` `serpentMarkup()` draws it with scales, a dorsal ridge, a head with a violet eye and open jaws on the tail tip, in the Red theme's colours. `webTheme.js` repaints it for the chosen theme (`--qb-serpent`, through `themeVariables`/`themedText`) and turns it once every two minutes the way its head faces (`[data-qb=serpent]`); it holds still in the Light atmosphere and with reduced motion. The boot card in `public/index.html` uses the plain silhouette (`serpentMarkup({detail:false})`) as a mask in its own theme colour, written there by `node verify-theme.cjs --write`.

## The app icon

The app icons are the page `icon.html` in this folder: a crimson-foil Q in the title typeface (from `public/fonts`, never from Google) inside a red seal ringed by the serpent, over the darkened valley painting (its tower and peak). `node make-icons.cjs` first writes the serpent from `serpent.js` into icon.html's qb-serpent block, then photographs the page at each size with a headless Chrome or Edge (home screen, manifest, browser tab and the Android adaptive layers). Tiny and monochrome icons leave the serpent out. After changing the icon, raise `?v=N` in the icon links (`public/manifest.json`, `public/index.html`, `fullscreen.js`, the pairing page in `phone-server.cjs`; `?v=3` since 2026-10-04) so installed copies and browser tabs fetch the new one. An iPhone keeps the icon it was added with: remove the home-screen icon and add it again.
