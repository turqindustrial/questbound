# Hosting Questbound off your PC

The launcher (`Questbound.cmd`) runs the game on one Windows PC for friends on your Wi-Fi or through a tunnel. To run it on a machine that is always on, `serve.cjs` starts everything in one process: the Dungeon Master and the table service listen on loopback only, and the gateway listens on the port the host gives it. Players open the gateway's https address and enter the invite code, exactly as on the tester link.

## What you need

- A host that runs a Node 22 process or a Docker container and gives it an https address. Fly.io, Render, Railway and a plain VPS behind Caddy or nginx all work. The gateway refuses plain http for a public address.
- A persistent folder (a volume) for `/data`: accounts, saves, paired browsers, the invite code, pictures and the usage log live there. Lose it and every player is signed out and every cloud save is gone.
- Your OpenAI API key. The host's bill is yours: see "Costs" below.

## Settings (environment variables)

| Variable | Meaning |
|---|---|
| `QUESTBOUND_PUBLIC_ORIGIN` | The https address players open, for example `https://play.example.com`. Required. |
| `PORT` | The port the gateway listens on. Platforms set it; `8080` otherwise. |
| `QUESTBOUND_DATA` | The data folder. `/data` in the container. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | The key and the play model (`gpt-6-luna`). `OPENAI_STORY_MODEL` optionally names a different story writer. |
| `QUESTBOUND_INVITE_CODE` | Eight digits. Without it a code is made once and kept in the data folder, so a restart never changes it. The log prints it. |
| `QUESTBOUND_MAX_PLAYERS` | Paired browsers at once (500). |
| `QUESTBOUND_REQUIRE_ACCOUNTS` | `1` requires a signed-in, email-verified account to play, whatever `accountsRequired` in `accountRules.js` says. Without it the switch decides: during the beta it is off and players without an account play as anonymous guests. |
| `QUESTBOUND_TURNS_PER_PLAYER` | Dungeon Master turns per browser per ten minutes (60). `QUESTBOUND_TURNS_IN_ALL` caps the whole gateway (1200). |
| `QUESTBOUND_DM_CONCURRENCY`, `QUESTBOUND_DM_REASONING`, `QUESTBOUND_STORY_REASONING`, `QUESTBOUND_IMAGE_MODEL` | As for the PC (see AI-SETUP.md). |

Write `.questbound-story-effort` and `.questbound-dm-effort` into the data folder to set the story writer's and the Dungeon Master's effort, as on the PC.

### The place-art library

Every place the players reach is shown from a library of ready landscape paintings instead of being painted at the time (about 3 cents a place saved). The library is the PC's `.questbound-place-art/` folder (`library.json` and one `<id>.jpg` per picture, about 60 MB for 171 pictures). It is not in git and not in the Docker image (`.questbound-*` is ignored by both), so copy the whole folder into the data folder, as `/data/.questbound-place-art/` (for example `fly sftp`, `docker cp` or `scp` into the volume), before players arrive. Without it, or for a land it has no picture of yet, places are painted and paid for as before; `serve.cjs` says so in its log at start. The pictures each place was given are kept in `/data/.questbound-art/place-picks/`, with the other pictures. Copy a newer library over the old one at any time: places keep the picture they were given, and the Dungeon Master reads `library.json` again within half a minute.

## With Docker

```bash
docker build -t questbound .
docker run -d --name questbound -p 8080:8080 -v questbound-data:/data \
  -e OPENAI_API_KEY=... -e OPENAI_MODEL=gpt-6-luna \
  -e QUESTBOUND_PUBLIC_ORIGIN=https://play.example.com questbound
docker logs questbound     # prints the invite code
```

Put TLS in front (the platform's proxy, or Caddy with `reverse_proxy 127.0.0.1:8080`). The gateway must see the public hostname in the `Host` header and the visitor's address in a header the proxy sets and visitors cannot forge. By default it reads the last `X-Forwarded-For` entry (the one the nearest proxy added; anything a visitor wrote before it is ignored), or `Fly-Client-IP` on Fly.io. If your platform names the visitor in another header (`CF-Connecting-IP` behind Cloudflare, `True-Client-IP`, `X-Real-IP`), set `QUESTBOUND_CLIENT_IP_HEADER` to that header's name; never name one the platform passes through from visitors unchanged. Per-visitor brakes (wrong codes, sign-ups) are only as honest as that header; per-browser limits do not depend on it.

## Without Docker

```bash
npm ci
npx expo export --platform web --output-dir dist-phone
QUESTBOUND_PUBLIC_ORIGIN=https://play.example.com QUESTBOUND_DATA=/srv/questbound \
  OPENAI_API_KEY=... OPENAI_MODEL=gpt-6-luna node serve.cjs
```

## Updating

Pull, build, restart. The invite code, paired browsers, accounts and saves are in the data folder and survive. Players mid-turn see one failed request and try again.

## Costs

From the PC's own usage log (`node dm-report.cjs --days 7`, October 2026): a game turn costs about a tenth of a cent on `gpt-6-luna`; a new tale written at high effort costs a few cents; a picture costs more than either. A busy player taking 100 turns an evening costs about 10 cents of turns plus their pictures. The caps above are the only thing between a hostile visitor and your bill: keep them.

## What this does not solve

- Opening the game to anyone (no invite code) needs payments, or every visitor plays on your key. ROADMAP.md says what that takes.
- One process serves everyone: the Dungeon Master handles three turns at once and queues the rest. Past a few dozen players at the same time, run more machines behind a load balancer, each with its own data folder, or move accounts and saves to a shared database first.
- The host's key is in the process's environment, as on the PC. Use the platform's secret store, never a file in the repository.


## October 2026 verified-account release

Remote play requires HTTPS. Plain LAN links are disabled. Use `Questbound-Share.cmd` locally. The account service must be restarted together with the desktop and public gateways after the new export is built. Older account sessions are deliberately rejected until the email is verified.

For a separate host, `compose.production.yml` provides non-root, read-only, capability and resource restrictions. It binds the gateway to loopback for a trusted TLS proxy. Supply `QUESTBOUND_MAIL_SENDER` (the dedicated Gmail address) and `QUESTBOUND_MAIL_PASSWORD` (its app password) through protected deployment secrets/environment, alongside the existing provider secret. Do not put secret values in the compose file. `/data` must be writable by UID 1000 and persistent. Configure proxy hostname and client-IP trust for your actual host. Docker deployment has not been exercised in this environment.

Back up the persistent volume and encryption key securely off-device; rehearse recovery on a separate instance. See SECURITY.md for exact verification and backup behavior, rollout requirements and limits.
