# From a playtest to a business

_Written 3 October 2026, when the host asked for "a billion-dollar game". This is the honest version: what the code now does toward that, what is still missing, and which of the missing parts only the owner can do._

## Where it stands

Questbound is a complete, playable, legally clean early-access game: an AI Dungeon Master that plays by the rules (second looks, judgment probes at 48 of 48), long written tales with chapters and leads, an open world with maps, people who remember, lethal fights with real dice, pictures and portraits, a shared table, accounts with saves, a phone build, a tester link behind a tunnel, request limits, a privacy policy, terms and a permissions agreement, 86 automated checks. It runs on one Windows PC with the host's own API key.

What the last day added toward a product:

- **Deeds** (`deedRules.js`): twenty lasting marks earned from the story itself (First Blood, Wanderer, Silver Tongue, Storyteller, Legend...), announced as they happen, carried from tale to tale, shown in the Quest tab. The hook that brings players back.
- **Share your tale** (`taleRules.js`, `taleCard.js`, `ShareTale.js`): a painted card of the hero, the last lines of their story, their deeds and their figures, shared from a phone or saved with the words copied. The loop that brings new players in.
- **The narrator voice** (`narrator.js`): the Dungeon Master read aloud by the browser's own voices, off by default. The thing people show their friends.
- **Hosting off the PC** (`serve.cjs`, `Dockerfile`, `DEPLOY.md`): one process for a cloud machine, every file under one data folder, the gateway behind a platform's proxy. The step that removes the PC from the picture.

## What a billion-dollar game has that this does not

Nothing below is a line of code the assistant can write alone. Each is an owner's decision, an account, a contract or a year of work.

1. **A company and a bank account.** A legal entity to hold the copyright (the terms name "turqindustrial"), sign the API contract, take payments and carry liability. Also VAT or sales-tax registration where players live.
2. **Payments and a price.** The game costs about a tenth of a cent per turn and a few cents per tale on `gpt-6-luna`, plus pictures (`node dm-report.cjs`). A player taking 100 turns an evening costs about 10 cents of turns. A subscription of a few dollars a month covers an average player many times over; a free tier of a tale or two a week is affordable as marketing. Opening the gateway without an invite code needs payments in place first, or every visitor plays on the owner's key. The work: Stripe (or an app store), a `plan` on each account, the gateway's per-player limits set from the plan.
3. **Hosting that scales.** `serve.cjs` runs one machine. Past a few dozen players at once: several machines behind a load balancer, accounts and saves in a database (Postgres) instead of files, pictures in object storage, and the Dungeon Master's queue as a shared job queue. The code's seams are ready for this (every store is a module with a directory option) but it is weeks of work.
4. **An app in the stores.** The web build is installable (a PWA with icons and a manifest). App Store and Play Store presence needs a wrapped build (Capacitor or Expo's native build), store accounts, screenshots, review, and in-app purchase for the payments above. Apple takes 30%.
5. **Content and voice.** The tales are written live and differ every time; a hit also needs a few authored campaigns that are reliably excellent, a recognisable world, and a narrator voice better than the browser's (a paid text-to-speech service, a few cents a thousand characters).
6. **Live operations.** Someone on call when OpenAI has a bad day, a status page, backups of the data folder tested by restoring them, a way to ban a player, moderation of what people type at shared tables.
7. **Players.** The share card and the invite code are the start of a loop; a hit needs a community (Discord), creators playing it on camera, a trailer, a landing page, a mailing list, and patient weekly releases with a changelog. Nobody has heard of the game yet.
8. **Rights.** The rules text is licensed (CC-BY, the SRD notices are in the game); the name "Questbound" should be checked against trademarks in the owner's markets before money changes hands.

## The order to do it in

1. Run `DEPLOY.md` on a small cloud machine with a permanent address, so the PC can be turned off. (A day.)
2. Form the company; add Stripe and a plan to accounts; open the gateway to anyone with a plan. (Weeks.)
3. Author three excellent campaigns and a trailer; start the Discord; invite creators. (Months.)
4. Move stores to a database and run two machines. (When the first hundred daily players arrive.)
5. Wrap for the stores. (When the web game has a thousand monthly players.)

A billion dollars is a few million happy players paying a few dollars a month for years. The game is now something a player can love, share and come back to; the rest is a business, and it starts with the first paying player.
