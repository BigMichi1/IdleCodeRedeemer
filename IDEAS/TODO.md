# Ideas & TODO

Feature ideas and potential improvements for the bot.

Priority is rated from an end-user perspective:
- 🔴 **High** — directly improves core daily usage; most users would benefit immediately
- 🟡 **Medium** — noticeable improvement but not critical to the main workflow
- 🟢 **Low** — nice to have, niche use case, or primarily an admin/backend concern

---

## Code & Redemption

- 🟡 **`/stats` command** — Server-wide stats: total codes found, redemption counts, registered user count, aggregate loot earned. Data already exists in DB.
- 🟡 **Loot summary in `/codes`** — Show aggregate totals (gold, rubies, equipment) across all redeemed codes. `loot_detail` JSON is already stored per row.
- 🟢 **Code source tracking** — Store which channel/message ID a code was found in. Useful for auditing and showing users where codes originated.
- 🔴 **Multi-channel scanning** — `DISCORD_CHANNEL_ID` is a single channel. Support a comma-separated list or a `/setchannels` admin command. If codes get posted in other channels, users miss them entirely.
- 🟢 **Auto-purge expired pending codes** — Pending codes that fail globally should be cleaned up automatically; right now they stay in `pending_codes` forever.
- 🔴 **Scheduled catchup** — Run catchup automatically for all autoredeem-enabled users on a configurable timer (e.g. daily) as a safety net for missed codes. Prevents silently missing free loot.

---

## Notifications & UX

- 🔴 **DM notifications for new codes** — Opt-in per user to get a DM when a code is *detected*, independent of whether autoredeem is on. Users who want to redeem manually currently have no way to know a code appeared.
- 🔴 **Notification preferences command** — Let users configure: DM on success, DM on failure, DM when a code they haven't claimed is about to expire. High value as DM spam is a common complaint with bots.
- 🔴 **Better blacksmith UX** — `/blacksmith` requires a raw hero ID. Inventory data from `getUserDetails` includes hero names — show a hero picker or list. Current UX is nearly unusable without looking up IDs externally.
- 🟢 **Paginated `/codes`** — Replace the `count` cap (currently max 20) with Discord prev/next buttons for a cleaner experience.

---

## Admin & Operations

- 🟢 **`/admin` subcommand group** — Consolidate admin actions under one command:
  - View recent audit log entries
  - Force-expire or remove a specific code
  - Remove a specific pending code
  - View registered user count
- 🟢 **Config command** — Set bot config (scan channels, log level, autoredeem default) at runtime without restarting.

---

## API / Game Features

- 🟡 **`/buy` command** — `purchaseChests()` is already implemented in `idleChampionsApi.ts`. Just needs a command wired up. Convenient to do from Discord without opening the game.
- 🔴 **`/heroes` command** — List the user's champions with levels and upgrade costs from the player data response. Directly unblocks the blacksmith UX problem above.
- 🟡 **`/export` command** — Export redeemed code history as a CSV file attachment (`AttachmentBuilder`). Useful for personal tracking.

---

## Quality of Life

- ✅ **`/deleteaccount` command** *(implemented)* — Let users remove their credentials and history from the DB (GDPR-friendly self-service).
