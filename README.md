# Questbound

**A fantasy tabletop adventure with an AI Dungeon Master, for phone and computer.**
Build a hero, roll the dice and play through stories written for you on the spot. Fights, conversations, travel and
level-ups follow fifth-edition rules; the Dungeon Master narrates and voices the people you meet.

Questbound is in **early access (playtest 1)**. Thank you for helping test it.

---

## Playtesters: how to join

You don't install anything. The host runs the game on their PC and sends you a **link** and an **invite code**.

1. Open the link on your phone or computer (any modern browser; headphones recommended).
2. Enter the eight-digit invite code.
3. Tap the title card to begin. Create a hero (or let the Dungeon Master generate one), then choose **New Adventure**.

**How to play**

- A row of actions sits above the message box: your weapon, Dodge, Retreat, Potion, travel and more. Tap one, or type anything you want to do, say or try.
- Tap a person above the message box to talk to them. Tap an underlined name in the story to see their details.
- On a phone, the tabs along the bottom switch between the **Story**, your **Quest**, the **Map** and the **Log**. On a wider screen they sit beside the story.
- ☰ opens the game menu: journal, character sheet, party, settings, full screen and sound.
- Want it to feel like an app? On iPhone: Share → **Add to Home Screen**. On Android: ⋮ → **Add to Home screen**.

Your hero and progress are saved **in your browser, for that link**. If the link stops working, the host's PC is off or
sharing restarted; ask them for the current link and code. To keep your hero across a new link or another device, use
**Settings → Move your hero**: copy a save code and load it on the new link or device. Copying one now and then is a good backup.

### Feedback

Tell the host, or [open an issue](../../issues/new/choose) on this page (a free GitHub account is needed).
Please include your phone or computer model and browser. The [playtest checklist](PLAYTEST.md) lists what we most want tried.

---

## Hosting a playtest (Windows)

You need:

- Windows 10 or 11, kept awake while people play.
- [Node.js LTS](https://nodejs.org).
- An **OpenAI API key** whose project can use the text model you choose (the launcher suggests a default) and image generation. **Your key pays for everyone's play**: each turn is one or two short requests, and each new character, place or creature gets one illustration.
- Cloudflare's free tunnel tool, installed once: `winget install --id Cloudflare.cloudflared -e`

Then:

1. Download this repository (**Code → Download ZIP**, then unzip) or clone it.
2. Double-click **Questbound-Share.cmd**. The first run installs the game's components and builds it (a few minutes).
3. Enter your OpenAI API key when asked. Typing is hidden; you may let Windows remember it, encrypted to your account.
4. The window shows the **playtest link** and **invite code** and copies both to your clipboard. Send them to your testers.

`Questbound.cmd -Stop` stops everything. `Questbound.cmd -ForgetKey` deletes the remembered key.
To play on your own devices only (home Wi-Fi, no internet link), double-click **Questbound.cmd** instead; see [MOBILE-ACCESS.md](MOBILE-ACCESS.md).

**Safety and limits**

- Your API key never leaves your PC. The Dungeon Master, shared table and game server listen only on your PC; testers reach a gateway that serves nothing until a valid invite code is entered.
- Wrong codes are throttled per visitor, and pairing pauses for everyone after 50 wrong codes in an hour.
- An invite lasts 7 days, up to 40 browsers. Each player can make 60 Dungeon Master requests per 10 minutes.
- The link is a random `https://….trycloudflare.com` address. If sharing stops (for example after a reboot), double-click **Questbound-Share.cmd** again for a new link and code and re-send them. While sharing is running, the launcher just shows the current ones.

---

## For developers

```bash
npm ci
```

```bash
npm run web
```

- The whole rules engine is plain JavaScript (`adventureRules.js`, `dmContext.js`, `spellRules.js` and friends). React Native screens are the `*.js` files starting with a capital letter.
- Services: `dm-server.cjs` (AI Dungeon Master, loopback), `sync-server.cjs` (shared table), `desktop-server.cjs` (built game on localhost), `phone-server.cjs` (paired gateway for Wi-Fi or a shared link).
- Checks: every `verify-*.cjs` runs with plain Node and makes no paid calls, for example `node verify-quick-actions.cjs`.
- Rules coverage and known gaps: [RULES-STATUS.md](RULES-STATUS.md) and [RULES-AND-ADJUDICATION.md](RULES-AND-ADJUDICATION.md).

---

## Credits and license

This work includes material from the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Questbound is an independent project, compatible with fifth edition. Fonts: Cinzel, Cinzel Decorative, EB Garamond and Inter (SIL Open Font License), served by Google Fonts.

Questbound's own code, text and artwork are © 2026 turqindustrial, all rights reserved; see [LICENSE](LICENSE). You're welcome to play and test it, but please don't copy or redistribute it.
