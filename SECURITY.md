# Questbound security — 8 October 2026

These controls are implemented in the current source. Restart running services with `Apply-Security-Update.cmd` after rebuilding. This is not an independent penetration test or a promise that the game has no vulnerabilities.

Release handoff: the web export built successfully and 92 automated checks passed. Two isolated browser accounts confirmed separate heroes and the same committed combat outcome. The live account service still reports the previous protocol: the security update is **not active until the services restart**. Windows denied process inspection from the development sandbox, so the restart was not attempted. One additional launcher check could not finish because its nested PowerShell process was blocked; a direct PowerShell synthetic DPAPI encryption/decryption check passed. No paid AI requests, real verification emails or production save changes were made by these tests.

## Beta: local saves (10 October 2026)

While accounts are not offered (`accountsOffered()` in `accountRules.js`), the game shows no account, sign-in or recovery-code screen and uploads no save: `scheduleCloudSave` makes no `cloud-save` or `account-save` request, so adventures stay in the player's browser. The host keeps only guest identities, shared-table campaigns, feedback notes and service records. The account and cloud-save routes still exist on the server for when accounts return; a crafted request can still reach them. The privacy policy, terms and permissions agreement (`legalUpdated` 10 October 2026) describe this mode.

## Beta: guest play (9 October 2026)

Accounts are not required during the beta. `accountsRequired` in `accountRules.js` is `false`; the account service reads the same line (and `QUESTBOUND_REQUIRE_ACCOUNTS=1` forces it on for a hosted game). A browser without a session is given an anonymous guest identity: a random 64-hex id held in the same HttpOnly, SameSite=Strict `questbound_account` cookie (Secure on HTTPS), lasting 90 days and renewed on use. The server stores only the token hash and when the guest was created and last seen, under `.questbound-accounts/guests/`; no email, password or saved adventure. Guests are capped separately (5,000; unseen for 60 days they are removed with the campaigns they host), never count against the email account limit, and are created at most 20 an hour per caller and 300 an hour in all. A guest can take Dungeon Master turns (labelled and budgeted like an account), send feedback and create, join and play campaigns (recovery-code saves too, but the beta game no longer sends any); account saves, password changes, sign-out-all, deletion and host diagnostics refuse guests. Anyone who passes the share link's invite code can now play without an email, so the invite code, the per-guest and overall guest budgets and the request limits are the beta's protection against misuse. To require verified accounts again, set `accountsRequired=true`, rebuild `dist-phone` and restart the account service and gateways: guest cookies then stop being identities.

## Accounts and mail

- Email verification is required before any account session is issued, including older accounts (guest identities have no email and are not account sessions). Codes expire after ten minutes, have five attempts, and are usable once. A new email may be requested after one minute, up to five per address per UTC day. Pending registrations do not replace existing accounts.

- The dedicated Questbound mailbox has **not been connected**. The user chose to keep personal Gmail separate. `Connect-Game-Email.cmd` asks for a dedicated Gmail address and a hidden Google app password, then stores the password encrypted to the Windows account. Never put either an app password or API key in chat, source code, browser storage, or a command argument. Two-step verification is required to create a Google app password. No automatic emails have been sent or delivery-tested yet.

- Gmail SMTP uses certificate-verified TLS, a fixed endpoint, bounded replies and timeouts. Feedback is retained locally and optionally forwarded to the configured game mailbox; failed forwarding does not discard the local note. Review the local feedback file because delivery is not guaranteed.

- Passwords use salted scrypt hashes. Account cookies are HttpOnly and SameSite=Strict, Secure on HTTPS, with a seven-day absolute lifetime and twelve-hour inactivity expiry. Only token hashes are stored on the server. Password changes revoke other sessions; Sign out all devices revokes all account sessions. Browser storage holds public profile metadata only.

- Local characters, adventures, roster, graveyard, recovery settings and campaign membership are separated by account ID. Another tab changing accounts causes a reload. Requests include the expected account ID to prevent a stale tab saving into a newly signed-in account. This does not encrypt local files or protect against someone controlling the device.

- Existing pre-account saves are retained in a guest area. After verifying, explicitly use **Import my adventure from before accounts** to copy one into an account. An existing server save is held until the player chooses whether to load it.

## Campaign permissions and multiplayer

The gateway invite lets a browser open the site; it does not grant account or campaign access. Each player plays under their own identity (during the beta a guest identity, otherwise a signed-in, verified account) and uses a separate campaign invite supplied by its host. Those invites expire after seven days; issuing a new one revokes the previous code. Existing members can resume without rejoining.

Each campaign has an owner and authenticated members. A party supports four separate heroes; an optional shared-hero campaign lets its members control one hero. The owner can issue invitations and pass another hero's turn. Other members cannot issue invitations, read unrelated campaigns, impersonate a player ID, or replace a campaign snapshot.

The browser submits an intention and the version it has seen. The server constructs the DM context from its saved state, runs the same rules engine with server dice, validates the result, saves it, and publishes the new version. One turn runs at a time. Stale actions are rejected; request receipts prevent a lost reply from applying damage or spending resources twice. Clients poll every 2.5 seconds and display their own hero's view of the same world. Weapon changes, journal notes, quest updates and earned level-up choices also pass through server checks.

Moderation (13 October 2026). A player can mute another member on their own device (nothing is sent) or report them: the report reaches the host's playtest notes with both table names, seats and pseudonymous `mod-…` labels and the reported member's last five typed lines, never account or guest ids (ten an hour per player at the service, five an hour and one a member per ten minutes in the campaign). The campaign owner can remove a member and keep them out (a keyed hash of their identity in the campaign file; every invite refuses them) and let them back. The host of the game bans a browser from everything (Dungeon Master, campaigns, feedback, a fresh guest from the same cookie) with `node accounts.cjs ban <mod-label>`; bans are hashes in `.questbound-accounts/banned.json`, read live. A banned player who clears their cookies gets a new guest identity: bans stop a browser, not a person. What players type (turns, tale ideas, hero descriptions, table names) is first checked by OpenAI's moderation service in the Dungeon Master process (`moderation.cjs`); it fails open when the service is slow or down, and logs categories and labels only.

Hosts may import a locally created adventure when creating a campaign, and joining characters are validated game saves. This is not a competitive anti-cheat platform: locally imported character history is not independently attested. The original single-table file is kept but no longer writable through the old `/save` route; start a campaign from the local copy to continue it.

## Network and host

Remote HTTP play is disabled, including home Wi-Fi. Phones use the HTTPS shared link. The desktop uses loopback HTTP. DM and account/campaign services bind to loopback; only the gateway is exposed through the tunnel. Requests require allowed hosts and origins. Gateways, rather than the client, set identity and trusted forwarding headers. Only the local desktop gateway exposes host diagnostics, and those also require a verified account.

Static serving blocks hidden files, source maps, alternate streams and escaping links. CSP, frame restrictions, explicit origins, safe text rendering, bounded bodies, timeouts and bounded rate-limit maps remain enabled. Secrets, saves, mail settings and logs are git-ignored and excluded from container builds.

`compose.production.yml` prepares a separate Linux host/container with a non-root user, read-only application files, dropped capabilities, no privilege escalation and resource limits. It is **not deployed or tested under Docker here**. Use a trusted HTTPS reverse proxy and protected persistent volume before public hosting. The present Windows services still run under the signed-in Windows account, not a dedicated restricted service account.

## Limits, alerts and recovery

- Atomic counters persist across restarts and reset each UTC day. Defaults per account or guest: 150 campaign turns, 300 direct DM requests, 1,500 illustration checks and five new campaigns. Registration/login/verification also consume a persistent caller allowance. Aggregate caps and existing short-term gateway limits apply too.

- Existing dollar allowances are estimates. Request limits and cost estimates are **not a guaranteed billing ceiling**; provider billing controls and usage review remain necessary. A campaign turn can use multiple model requests. Testing this release used synthetic AI replies and no paid provider calls.

- The security log records mechanical events and IDs, not passwords, tokens, codes, email addresses or DM text. It rotates at about 1 MiB with one previous file. Developer checks show recent denials and mail failures; on the desktop Settings screen, five recent events produce a visible notice. There is no external alert delivery or unattended monitoring configured.

- Every successful account, cloud-recovery or campaign save creates an AES-256-GCM encrypted version before replacing the active save. Each resource retains its latest 20 versions. The Windows backup key is DPAPI-protected; on Linux it is restricted to the service user. Current saves remain ordinary host-readable JSON. Backups on the same disk do not cover disk loss or ransomware.

- `node backup-tool.cjs verify` decrypts and validates the latest copy for each resource. `list <backup-id>` lists versions; `export <backup-id> <version>` writes a validated review copy without overwriting live state. Stop services and preserve the current data before a host performs a live restore. Do not copy a historical account record containing old authentication tokens back into service.

- Keep a separate protected off-device backup of the data and a recovery plan for its encryption key. DPAPI files depend on the Windows account and machine; moving only the encrypted files to another host is insufficient. Off-device backup and actual-host disaster recovery remain setup work.

## Verification and remaining release gates

Isolated checks cover verification, cookies, separate account saves, concurrent actions, server attack damage and initiative, stale writes, retry across restart, membership checks, weapon/level validation, account deletion during a pending turn, restored campaign data and persistent limits. Browser testing with two synthetic accounts confirmed shared attacks and separate heroes. All six light/dark palettes were exercised, including a 390-pixel phone layout.

Connect the dedicated mailbox and test one real verification email plus feedback delivery. Confirm the operator's legal name and jurisdiction and have qualified counsel review the terms/privacy text. Complete restricted hosting, off-device backups and an independent security review before broad public access. No disclaimer can prevent every lawsuit or remove non-waivable rights.
