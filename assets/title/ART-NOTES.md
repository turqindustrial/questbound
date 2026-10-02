# Title painting

`questbound-title.jpg` (1536 × 1024) is the backdrop of the title screen and the menus. It was painted on 2026-10-02 by the game's own illustration service (`world-art.cjs`, kind `landscape`) from this description:

> A vast fantasy valley at dusk seen from a high ridge. On the right-hand third of the picture a lone cloaked traveller stands on a rocky outcrop holding a small warm lantern, seen from behind, small against the land. Beyond them a pale road winds down through dark pine woods past a stone bridge over a silver river toward a ruined round tower on a crag, and far snow mountains under towering storm-lit clouds with a break of gold light. The left-hand third of the picture is quiet, dark forested hillside in deep teal shadow with very little detail. Everything runs edge to edge: a full wide panorama with no frame, no vignette border and no empty margins.

How it is shown (`App.js`, `webTheme.js`):

- The picture always fills the window (`s.backdrop` sets width and height to 100%). An image loaded from a file carries its own pixel size as its style, and without that the old picture stopped at 1173 pixels and left wide windows black on the right.
- The left third is dark on purpose: the wide title screen puts the name and the menu there.
- On a tall phone screen only a strip of the picture fits, so `data-frame=tall` moves the view to the tower and the mountain.
