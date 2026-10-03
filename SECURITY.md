# Security

Questbound runs on the host's own PC and is reached by players over home Wi-Fi or a Cloudflare tunnel. This page says what protects players and the host, what only the host can do, and what remains true however careful the code is. No game is impossible to attack, but each risk below has a guard and a check (`verify-security.cjs` among the 85 `verify-*.cjs` checks).

## What protects players and the host

- **Only the gateway faces the network.** The Dungeon Master (8084), the shared table (8086) and the desktop page (8081) listen on this PC only, and answer only to this PC's own names, so a website the host visits cannot reach them by pointing its address at the PC (DNS rebinding). They also refuse requests from any page but the game's own.
- **Pairing first.** The Wi-Fi link needs the pairing code and the tester link the invite code; nothing but the pairing page, the legal pages, fonts and icons is served before. Wrong codes are throttled per visitor (5 a minute) and for everyone together (50 an hour). A paired browser holds a random cookie that pages cannot read (HttpOnly), that other sites cannot send (SameSite=Strict) and, on the tester link, that only travels over https (Secure). The PC keeps only hashes of these cookies.
- **Locked-down pages.** Every page carries a content security policy: it may run only the game's own scripts (its one inline script is allowed by its exact hash), talk only to the game's own services, never be shown inside another website, and never use the camera, microphone or location. The tester link tells browsers to use https only. Everything players and the Dungeon Master write is shown as text, never run as code, and saves from other players, codes and accounts pass the game's validators before they are loaded.
- **Accounts.** Passwords are stored as salted scrypt hashes and sign-in tokens as hashes. Wrong passwords are throttled per account, per visitor and overall. The passwords guessers try first (`password123`, `qwertyuiop`, the player's own email) are refused.
- **The host's AI bill and API account.** Each paired browser has request limits, and guests together have a daily allowance: **5 US dollars a day, at most 2 of them for any one guest**. The host's own play on this PC is never stopped. Change the amount by writing a number of dollars (or `off`) into `.questbound-guest-budget`; it takes effect at once. `node dm-report.cjs` shows today's spending. Each guest request carries a scrambled label for that browser to OpenAI, so misuse by one player is not taken for the host's own. Only the host can run the AI connection check.
- **Secrets.** The OpenAI key is kept only DPAPI-encrypted (readable by the host's Windows account alone), never in the repository, on a command line or in logs. The provider's error messages, which can echo key fragments, are never shown to players. The public repository holds no keys, codes, saves or logs (`.gitignore`).

## What only the host can do

1. **Set a monthly spending limit for the OpenAI project** in your OpenAI account's billing settings, and use an API key made for Questbound alone. This is the only hard ceiling on what the key can cost, whatever happens to the PC.
2. **Turn on two-step sign-in** for your OpenAI, GitHub and Cloudflare accounts.
3. **Share codes privately.** If an invite code leaks, stop the game and share again (`Questbound.cmd -Stop`, then `Questbound-Share.cmd`): a quick tunnel gets a new link and a new code. For a new Wi-Fi pairing code, delete `.questbound-phone-session.json` before stopping and starting the game. To sign out every paired browser as well, also delete `.questbound-phone-sessions.json` or `.questbound-share-sessions.json`.
4. **Use the Wi-Fi link only on a network you trust.** It is plain http: anyone on the same Wi-Fi could in principle read what is sent. The tester link is encrypted (https) from the player's browser to Cloudflare, whose tunnel carries it on to the PC. The account form says this to Wi-Fi players.
5. **Keep Windows, Node.js and cloudflared up to date.** The game's servers use only Node's built-in modules.
6. **Restart the Dungeon Master once, at a quiet moment,** so it also checks the address it is reached by (until then it already refuses every page but the game's own). End its process (its id is `dm` in `.questbound-logs\pids.json`: `taskkill /PID <id> /T /F`; if you started it with `start-dm.ps1`, press Ctrl+C in its window instead), then run `Questbound.cmd`. With your key remembered it starts the Dungeon Master again without asking and leaves everything else running, the tester link included.

## What remains true

- Anyone with access to the host's PC can read the saves and settings on it (passwords stay hashed). Programs running on the PC can reach its services.
- `npm audit` lists advisories in Expo's build tools (Metro, node-forge, braces). They run only when the game is built on the host's PC, never in the running game; clearing them needs a major Expo upgrade.
- The developer code in the character builder is a convenience gate for testers, not a secret: it changes only the player's own hero.

## Reporting a problem

Please do not post security problems in a public issue. Use GitHub's private vulnerability reporting for the repository if it is turned on, or contact the maintainer, turqindustrial, directly.
