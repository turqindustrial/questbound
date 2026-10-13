# The next app icon (stored, not in use)

The host asked on 2026-10-10 to "design the new phone icon but keep it stored until the next big update". This folder
holds it. Nothing here is served or referenced by the game: the live icons are still the red emblem made by
`node make-icons.cjs` from `assets/title/icon.html`, at `?v=4`.

The design: the Questbound emblem (the host's painting, `assets/title/questbound-emblem.webp` from `make-emblem.cjs`)
in gold, the Gold theme's treatment (`grayscale(1) sepia(1) saturate(2.4) hue-rotate(-2deg) brightness(1.4)
contrast(1.25)`, a little more contrast at small sizes): pale yellow-gold highlights, deep bronze shadows, on a deep
dark ground with a faint warm glow, cut close to the serpent ring so the Q reads on a home screen and in a browser tab.
iOS rounds the corners itself (the ring stays clear of them); the maskable icon keeps the serpent inside Android's safe
circle (the middle 80%).

The page is `icon.html` here. `node make-icons.cjs --next` photographs it at every size into this folder (and touches
nothing else).

| File | Size | What it is | Where it goes when switched in |
| --- | --- | --- | --- |
| `apple-touch-icon.png` | 180 | iPhone and iPad home screen | `public/icons/apple-touch-icon.png` |
| `icon-192.png` | 192 | manifest icon, Android home screen, browser tab (`<link rel="icon">`) | `public/icons/icon-192.png` |
| `icon-512.png` | 512 | manifest icon, install and splash screens | `public/icons/icon-512.png` |
| `maskable-512.png` | 512 | manifest maskable icon (Android shapes it; the ring sits in the safe circle) | `public/icons/maskable-512.png` |
| `questbound-favicon.png` | 48 | browser tab icon (Expo turns it into `favicon.ico` in the build) | `assets/questbound-favicon.png` |
| `favicon-32.png` | 32 | a 32 px tab icon, for a `<link rel="icon" sizes="32x32">` if one is wanted | optional: `public/icons/favicon-32.png` |
| `questbound-icon.png` | 1024 | the app icon for native builds (`app.json` `icon`) | `assets/questbound-icon.png` |
| `android-icon-background.png` | 1024 | Android adaptive icon, background layer | `assets/android-icon-background.png` |
| `android-icon-foreground.png` | 1024 | Android adaptive icon, foreground layer (the gold emblem, inside the safe zone) | `assets/android-icon-foreground.png` |
| `android-icon-monochrome.png` | 1024 | Android themed (monochrome) icon | `assets/android-icon-monochrome.png` |

## Switching it in (at the next big update)

1. Copy each file above to the path in the last column (the names already match the live ones).
2. Raise the icon version from `?v=4` to `?v=5` everywhere the icons are linked, so installed copies and browser tabs
   fetch the new ones:
   - `public/manifest.json` (the three `icons` entries),
   - `public/index.html` (`<link rel="icon" ...icon-192.png?v=5>` and `<link rel="apple-touch-icon" ...?v=5>`),
   - `fullscreen.js` (the `apple-touch-icon` link it adds),
   - `phone-server.cjs` (the pairing page's icon links); the share gateway must then be restarted.
3. Make it the page `make-icons.cjs` draws by default: copy `icon.html` over `assets/title/icon.html` (change its
   picture path from `../../title/questbound-emblem.webp` to `questbound-emblem.webp`) and give `make-icons.cjs`'s
   main list the insets used for `nextIcons` (the small icons all cut close to the ring), then run `node make-icons.cjs`
   to check it draws the same files.
4. Update `verify-presentation.cjs` (it checks `?v=4` and the live icon list), `assets/title/ART-NOTES.md` and the title
   page bullet in `AGENTS.md`, rebuild `dist-phone` (`npm.cmd run build:web`) and run the checks.
5. An iPhone keeps the icon it was added with: players remove the home-screen icon and add it again.
