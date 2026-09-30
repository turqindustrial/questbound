# Desktop and phone access

Both links use the same Questbound build. Phone support means a mobile browser, not a separately installed native iPhone or Android app.

## Start everything

Double-click **Questbound.cmd** in the Questbound folder. It starts, or reuses if already running:

| Service | Address | Notes |
| --- | --- | --- |
| Private AI Dungeon Master | localhost:8084 | Asks for your OpenAI key the first time; you can let it remember the key, encrypted to your Windows account. |
| Shared table | localhost:8086 | Keeps the adventure that several devices play together. |
| Desktop game | http://localhost:8081/ | Serves the finished build (use `-Dev` for the live-reloading dev server). |
| Phone access | the LAN link it prints | Prints the Phone link and an eight-digit pairing code. |

It rebuilds the game when the source is newer than the last build, and it issues a fresh pairing code when the old one has less than two hours left. Everything keeps running after you close the window.

- `Questbound.cmd -Stop` stops everything the launcher started.
- `Questbound.cmd -ForgetKey` deletes the remembered key.
- `Questbound.cmd -InstallStartup` starts Questbound in the background when you sign in to Windows (needs a remembered key). Undo it with `-RemoveStartup`.
- Logs are in `.questbound-logs\`.

## Share with playtesters over the internet

Double-click **Questbound-Share.cmd** (or run `Questbound.cmd -Share`). It starts everything above plus a secure Cloudflare link, then shows a **playtest link** and an **invite code** and copies them to your clipboard. Send both to your testers; they need nothing installed.

- Needs Cloudflare's free tunnel tool once: `winget install --id Cloudflare.cloudflared -e`. No account required.
- The link is a random `https://….trycloudflare.com` address. It lasts until sharing stops (for example after a reboot); run Questbound-Share.cmd again for a new link and code. While sharing runs, the launcher just shows the current ones.
- The invite code lasts 7 days and admits up to 40 browsers. Testers' play uses your OpenAI key; each player is limited to 60 Dungeon Master requests per 10 minutes, and up to 3 replies are written at once (others wait their turn).
- Only the paired gateway is reachable from the internet. The Dungeon Master, shared table, desktop game and your key stay on this PC.
- Browser saves belong to one web address. When the link changes, testers can move their hero with **Settings → Move your hero** (copy a save code on the old link, load it on the new one); otherwise they start a new hero.

## Phones

- Connect the phone and PC to the same Wi-Fi. Open the Phone link and enter the pairing code. Pairing lasts 24 hours; run the launcher again for a new code.
- If Windows asks for network access, allow it on your trusted private network. Guest Wi-Fi may isolate devices from each other.

## Saves and the shared table

- Each browser keeps its own save until it joins the **shared table** under Multiplayer.
- Joining loads the table's adventure and character on that device (its own save is backed up first and can be restored from the Multiplayer screen). If the table is empty, your adventure starts it; **Start the table with my adventure** replaces what the table was playing.
- Everyone at the table sees turns as they happen and can send actions. While one player is taking a turn, the others wait. If two changes collide, the table keeps the first and tells the other player.
- Use the table on your own phone and PC to continue one adventure on either device.

## Full screen

- **Computer and Android:** tap ⛶ Full screen at the top right, or press F on a keyboard (Esc leaves). Settings → Display can make the game go full screen on your first tap each visit.
- **iPhone and iPad:** browsers there don't allow web pages to go full screen. Tap ⛶ for instructions: in Safari, Share → Add to Home Screen. Questbound then opens from its gold Q icon with no browser bars. The Home Screen version needs pairing once with the current code.
- **Android:** Chrome's menu → Add to Home screen (or Install app) also opens Questbound full screen.

## Screen layout

- Questbound opens on a title card; one tap (or any key) begins. That tap is also what lets the browser start sound.
- In an adventure the game fills the window like a console game, and the page itself never scrolls. A slim bar at the top shows your hero, level and HP; ☰ opens the game menu (Journal, Character, Party, Settings, Full screen, Mute, Main menu).
- **Phone or tablet upright:** the story takes the whole screen with the message box pinned above a tab bar: **Story**, **Quest**, **Map** and **Log**. In combat, the foe's HP strip sits above the story; tap it to see everyone's HP.
- **Computer, or a phone or tablet on its side:** quest, map and log sit in a side column next to the story. Turning a phone mid-turn doesn't interrupt the turn.
- The story is one continuous chronicle. It follows the newest turn; scroll up to reread earlier turns.

## One-tap actions

- A row of actions sits above the message box, taken from what the rules allow right now. In a fight: your main weapon (gold), **Dodge**, **Retreat** and **Potion**, with other weapons further along. Elsewhere: travel to each place you can reach and **Rest**. Swipe the row on a phone for more.
- A tap sends the action to the Dungeon Master, the rules roll it, and the turn plays out like a typed one. You can still type anything.
- Spellcasters get **Cast…**, which starts "I cast " in the message box so you can name the spell and target.
- On the map, places you can reach have a **Travel** button.
- After a victory, a gold **Level up** action appears first in the row.

## Sound

Music, ambience and effects are composed live on the device and mixed through a studio-style chain (compression, reverb for halls and caves, and a limiter so nothing clips).

- The score follows the game: a quiet theme on the title screens, an exploration theme on the road, and drums and brass when combat starts. Music and background sound dip briefly under hits, victories and defeats so those land clearly.
- Each place has its own background: a crackling hearth at the inn and back at camp after a fight, wind and birds on the road, dripping echoes in dungeons, and wind under the combat music. A heartbeat starts when you're below 30% HP.
- Hits are shaped by damage type (fire, cold, lightning and so on) and placed in stereo: the foe's side on the right, yours on the left. Headphones are recommended.
- Use ♪ (top right) or Settings → Sound for Master, Music, Ambience and Effects levels, and Mute. **Night mode** evens out loud hits and quiet moments for late-night play or small speakers. Your choices are remembered on each device.
