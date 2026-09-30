# Individual characters and runtime artwork — September 29, 2026

Questbound creates portraits for encountered NPCs, an illustration of the current location, and a creature portrait during combat. The work happens in the background; the player can continue playing while images appear. Conversation view uses the same portrait as that NPC's nearby-character card.

New adventures give each starting NPC a unique name, appearance, personality, and speaking manner. Visual descriptions include age, species, build, clothing, facial details, and distinguishing features. The adventure generator rejects identical names or appearance descriptions. The DM receives the same identity details used for the artwork. A creature has its own visual description. There is no longer a fixed male innkeeper/female courier portrait assignment.

Existing adventures remain compatible. Their portraits use the existing name, role, and setting, with unspecified visual details invented for the first illustration. Their lore and gameplay progress are preserved. This change covers characters represented by the current engine (two starting acquaintances and encounter creatures); arbitrary additional NPC creation and individual full NPC stat blocks remain future work.

## Saving and API behavior

- Each image is identified by campaign ID, subject type, and individual subject ID. Another character or another campaign gets a separate image; a repeated visit reuses the saved image.
- Images and descriptive metadata are stored locally in `.questbound-art/`, which is ignored by source control. They are separate from browser saves. Back up that folder along with the project to retain artwork when moving computers.
- The existing private DM service and its configured API key make the requests. No key is sent to the game browser, and no additional key is required.
- The Responses API uses the configured DM model with the `image_generation` tool. Default image model: `gpt-image-2.5-flare`, overridable by `QUESTBOUND_IMAGE_MODEL`. Portraits use 1024×1024; scenes use 1536×1024; low quality, JPEG, compression 80; `store: false`.
- Requests are deduplicated and queued one at a time. Only encountered subjects are requested, not the entire unvisited map. Failed generation is not automatically repeated; the full portrait/scene offers Retry illustration. Cached images survive browser and server restarts.
- New images use API credit. Images are downloaded once into the local cache and reused. Browser reloads and opening/closing the same conversation do not request another generation.
- Hidden motives and campaign secrets are excluded from portrait prompts. Provider error bodies and credential fragments are never displayed to the player.

## Verification

All 32 `verify-*.cjs` scripts passed after integration. The new artwork checks cover distinct NPC/campaign identities, subject validation, concurrent-request deduplication, single-worker queuing, disk-cache reuse after restart, invalid images, and safe error messages. Production web export succeeded.

A real image request through the existing localhost:8084 service generated an individual gnome portrait successfully. The updated localhost:8081 game then generated distinct portraits for Sella Vorn and Ilyan Reed and a matching scene for the Siltcup House in the player's existing adventure. Both portraits were visually inspected in their respective conversation screens, and the location scene was inspected in the region panel. After a full browser reload, all three images returned immediately from the saved cache. Veyra Ashscale's existing adventure and 9/9 HP remained intact; no gameplay action was submitted for these checks. The final artwork test also confirms dungeon guardians do not inherit the unrelated main creature's appearance; the final production export succeeded.

The initial direct Images API attempt returned an authorization error even though the same key passed authentication. The final implementation uses the documented Responses image-generation tool, which succeeded with that existing key.

Official references: [Image generation](https://developers.openai.com/api/docs/guides/image-generation), [Responses image-generation tool](https://developers.openai.com/api/docs/guides/tools-image-generation), [Image model](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).
