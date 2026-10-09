# Questbound: Privacy policy

_Last updated 8 October 2026. The same words are shown in the game under Settings → About. Written in legalText.js; `node verify-legal.cjs --write` regenerates this file._

## Privacy policy

### Who this is about

Questbound is an early-access browser game operated by the person or business hosting the copy you use. The host supplies your game link and handles your data and support requests. The software is developed under the name turqindustrial. The host may also be the developer. Contact the host through the in-game Feedback form or the dedicated game mailbox from which you receive verification emails.

### What stays on your device

Your browser stores your characters, adventures, roster, settings, recovery code, account display information, campaign membership and acceptance of the current terms. Saves are separated by account; guest progress is kept separately and may be imported deliberately. Local saves are not encrypted against someone with access to your device. Clearing site data removes local copies.

Account sign-in uses an HttpOnly cookie that game scripts cannot read. Remote game access also uses a pairing cookie. These are necessary service cookies, not advertising cookies. Old browser-readable account tokens are removed on startup.

### What is sent to the host's computer and kept there

- Accounts: a hash of your email address, a salted hash of your password, hashes of session tokens, verification status, terms acceptance and security timestamps. Your email address is used temporarily to send a requested verification message; it is not written in account records. Verification codes are stored only as hashes and expire after 10 minutes. No account saves or campaigns are accessible before verification.
- Account and recovery saves, including your hero and adventure. Current saves are readable by the host. Up to 20 encrypted historical versions per saved account, campaign or recovery code are also kept locally for recovery. These backups are on the host's machine, not an independent off-site backup.
- Shared campaigns: membership, host/player roles, player names, characters, story, game state and recent turn identifiers. Other members can see the shared story and party details. The server validates and commits shared actions and rolls dice.
- Feedback: your note, rating, optional name, hero name, game location and a description of your device. Feedback is kept by the host and, when configured, forwarded to the dedicated game mailbox.
- Service records: mechanical security events and timestamps, pseudonymous account/campaign identifiers, response status, request counts and AI usage totals (never the words themselves in usage logs). The services count requests, wrong pairing codes and wrong passwords. Daily usage counters survive restarts; shorter request windows are held in memory. Security logs rotate when they reach 1 MB.
### What goes to other companies

- OpenAI. The Dungeon Master is an AI model run by OpenAI. To write the next part of your story, the host's computer sends OpenAI what you type into the game, your hero (name, description, backstory, scores and gear), the story so far and the state of the game, and asks for story text. It also asks OpenAI to paint portraits of heroes and of the people you meet from their descriptions, and pictures of places. With each request from a phone or the tester link it sends that browser's label (see Service records), so that if anyone misuses the game, OpenAI can tell that player apart from the host and from everyone else. OpenAI processes this under its API terms; at the time of writing OpenAI says it does not use API data to train its models and keeps it for up to 30 days to watch for abuse. Check OpenAI's current policies. Do not type anything into the game that you would not want processed this way: it is a game, not a place for personal, financial or health information.
- Cloudflare. The internet (tester) link runs through Cloudflare's tunnel service, so your traffic passes through Cloudflare, which sees your network address as any website host would. Unencrypted remote play is disabled; use the HTTPS game link.
- Your browser's voices. If you turn on the narrator voice (Settings → Sound), your browser reads the Dungeon Master's words aloud. Some voices, marked online or natural, are spoken by the browser maker's servers (Microsoft for Edge, Google for Chrome, Apple for Safari), which then receive that text. The setting is off unless you turn it on.
- Google/Gmail. Verification emails contain your address and a one-use code. Feedback forwarded to the game mailbox contains the feedback and context listed above. Google processes this mail under its own policies; messages may remain in the game mailbox until the host deletes them. Transactional verification is not consent to marketing.
The game includes no advertising or tracking scripts. The services above receive only the data needed for their described functions.

### Why

The host processes this data to run the game you asked to play (to carry your adventure from one turn to the next, to let you sign in on another device, to let several people share a table), to keep the services safe from abuse (counting wrong codes and passwords) and to improve the game (your feedback notes). Where European or UK data-protection law applies, the legal bases are the performance of a contract with you (the game itself), the host's legitimate interests (security and improvement) and, for optional features such as accounts and feedback, your consent, which you give by using them and may withdraw by deleting your account or asking the host.

### How long

- Current saves remain until you or the host delete them. Recovery-code storage accepts up to 200 saves; when full, new saves are refused instead of deleting an existing save.
- Account sessions expire after 7 days, or after 12 hours without a server request. Sign out all devices revokes all account sessions immediately.
- Account deletion removes that account's current save, password, sessions and its account backup versions. Campaigns owned by that account are removed. Shared campaign content and recovery-code copies are separate: ask the host to remove those, including relevant historical copies.
- Backup history keeps up to 20 versions per save or campaign. The host must protect and periodically copy the backup key and data to a separate secure location if independent recovery is needed.
- Daily request counters are replaced when a new UTC day begins. Security logs retain the current and previous rotated file; feedback and Gmail messages remain until the host deletes them.
- Invitation and pairing lifetimes depend on the host's sharing settings. Campaign invites expire after 7 days and can be replaced by the campaign host.
### Your choices and rights

- Delete your account under Settings → Your account → Manage account: this removes the account and its saved adventure from the host's computer.
- Turn off the recovery-code copy under Settings → Recovery code.
- Clear your browser's site data to remove everything the game keeps on your device.
- Ask the host to delete your saved adventures, your feedback or anything else about you, to tell you what they hold, or to correct it: use the Feedback form in the game or contact the host directly. Where the law gives you rights of access, rectification, erasure, restriction, portability (Settings → Move your hero gives you your save as a code) and objection, the host will honour them, and you may complain to your data-protection authority.
### Children

Questbound tells stories with violence and, at the player's choice, graphic violence. It is for players aged 16 and over. The host does not knowingly keep accounts or data for anyone younger; if you believe a child has used the game, tell the host and the data will be deleted.

### Security

Passwords use salted scrypt hashes. Remote play requires HTTPS. Account cookies are HttpOnly and SameSite=Strict, and Secure over HTTPS. Campaign permissions are checked on the server. These safeguards reduce risk but do not guarantee that every vulnerability, outage or data loss is prevented. Do not share passwords or invite codes, and protect the devices you use. Local account folders separate ordinary gameplay; they do not prevent another person controlling your browser or computer from reading its local storage.

### Changes and contact

This policy may change as the game changes; the date at the top says when. The current version is always in the game under Settings → About → Privacy policy. Questions and requests go to the host: the person who gave you your link or code, or the Feedback form in the game.
