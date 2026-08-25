# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All tasks run through the vendored Mise launcher `./bin/mise` (it pins Bun/gitleaks/rg into `.mise/` and ignores the user's global mise config). Do not call `bun run`, `npm`, or `npx` directly — if a task is missing, add it to `.mise.toml`.

```bash
./bin/mise run install       # bun install
./bin/mise run dev           # run bot from source (bun run --bun src/bot/bot.ts)
./bin/mise run typecheck     # tsc -p tsconfig.bot.json (noEmit)
./bin/mise run test          # bun test
./bin/mise run test:coverage # lcov -> coverage/lcov.info
./bin/mise run lint          # eslint src
./bin/mise run lint:fix
./bin/mise run format # syncpack + prettier
./bin/mise run format:check
./bin/mise run build    # compiled binary -> dist-bundle/bot
./bin/mise run gitleaks # secret scan
```

Extra args pass through to the underlying command:

```bash
./bin/mise run test src/bot/database/codeManager.test.ts # one file
./bin/mise run test -t "expired"                         # one test by name
./bin/mise run test --watch
```

Database migrations are generated, never hand-written first: edit `src/bot/database/schema/*.ts`, then `./bin/mise run db:generate` (drizzle-kit writes into `src/bot/database/migrations/` plus its `meta/` snapshots). `db:studio` opens the Drizzle browser.

### Pre-push gate

`typecheck`, `test`, and coverage must all pass before pushing; CI (`.github/workflows/test.yml`) enforces the same, and coverage is diffed against a baseline artifact from `main`. Every new non-test source file needs a matching `*.test.ts`. Never use `git commit --no-verify` / `git push --no-verify` — hooks run gitleaks, eslint, commitlint (Conventional Commits), and a DCO sign-off check. Commits must be signed off (`git commit -s`).

## Architecture

A Discord bot (discord.js 14) that watches a channel for Idle Champions promo codes and redeems them against the game's HTTP API on behalf of registered users. Runtime is Bun; TypeScript is never emitted (`tsc` is typecheck-only, production is a `bun build --compile` binary).

### Layers

- `src/bot/bot.ts` — the only entrypoint. Commands are imported **statically** into an array (dynamic directory scanning would break the compiled bundle), registered guild-scoped when `DISCORD_GUILD_ID` is set and globally otherwise. Holds the three event handlers: `InteractionCreate` for slash commands, a second `InteractionCreate` for `codes:` pagination buttons, and `MessageCreate` for live code scanning. Also owns startup backfill, SIGINT/SIGTERM shutdown, and `unhandledRejection`/`uncaughtException` guards.
- `src/bot/commands/*.ts` — one module per slash command, each exporting `data` (a `SlashCommandBuilder`) and `execute(interaction)`. `gameSession.ts` is not a command; it is the shared session resolver (see below).
- `src/bot/api/idleChampionsApi.ts` — static-method client for the game API. All calls are `POST` with **URL query parameters**, never a JSON body.
- `src/bot/database/` — `db.ts` (connection + migrator), `schema/` (Drizzle table definitions), and manager singletons (`userManager`, `codeManager`, `auditManager`, `backfillManager`) that are the only things touching the tables.
- `src/bot/handlers/` — `codeScanner.ts` (regex detection), `autoRedeemer.ts` (fan-out redemption), `backfillHandler.ts` (history sweep).
- `src/bot/utils/` — logger (winston), `apiRequestLogger`, `crypto`, `redact`, `interactionReply`, `sqliteTime`, `async`.

### Code flow

`MessageCreate` → channel + author allowlist filter (`DISCORD_CHANNEL_ID`, `DISCORD_CODE_AUTHOR_ID`) → `scanMessageForCodes` → `codeManager.addNewPendingCodes` (single batch insert with `onConflictDoNothing`, returns only genuinely new codes so DM fan-out cannot double-fire) → opt-in DM notifications → `enqueueAutoRedeem(codes)`.

`autoRedeemer` chains every job onto one module-level promise (`redeemQueue`), so redemption runs never overlap; between users it sleeps a random 2–5 s to stay under the game API's tolerance. Per user it skips codes already redeemed by that user or globally known-expired before making a call.

### Invariants that break things when ignored

- **instance_id is per-session.** Before any state-changing game call (`redeem`, `open`, `blacksmith`) you must resolve a fresh one. Use `resolveGameSession(discordId, credentials)` from `src/bot/commands/gameSession.ts` — it also handles the `SwitchServer` redirect (following it once and persisting the new server) and rejects the `'0'` no-session sentinel. Do not re-implement this; it was extracted from three verbatim copies.
- **TLS exception is host-scoped.** The game host has served an expired certificate. `NODE_TLS_REJECT_UNAUTHORIZED` must never be set — it would disable validation for the Discord gateway too, exposing `DISCORD_TOKEN`. The escape hatch is `IDLE_CHAMPIONS_INSECURE_TLS=1`, applied per-request in `apiFetch()`.
- **Credentials are encrypted at rest.** `users.userId` / `users.userHash` go through `utils/crypto.ts` (AES-256-GCM, `enc1:<iv>:<tag>:<ct>`). `ENCRYPTION_KEY` must be 64 hex chars and is validated at module load, so the process fails fast on startup. Changing the key makes existing rows undecryptable. `userManager.migratePlaintextCredentials()` upgrades pre-encryption rows at boot.
- **Never log credentials.** Redaction happens at write time, not display time: `bot.ts` runs command options through `isSensitiveOption()` before logging, and `/setup` logs nothing but an audit event. Anything logged lands in `logs/combined.log` and container stdout regardless of what `/logs` filters.
- **Code detection errs toward rejecting.** Each false positive costs one live `redeemcoupon` call per registered user. `codeScanner` strips URLs and Discord emoji tags, anchors the regex with lookarounds, and requires `looksLikeCode()` (a dash, or at least one digit) so 12/16-letter English words are not matched.
- **SQLite timestamps are UTC without a zone marker.** Always parse `CURRENT_TIMESTAMP` values with `parseSqliteTimestamp()` from `utils/sqliteTime.ts`; `new Date(raw)` parses them as local time and silently skews backfill rate limits and displayed dates.
- **Report command errors with `replyWithError()`** (`utils/interactionReply.ts`) rather than a bare `interaction.editReply` in a catch block — it picks reply vs. editReply from interaction state and never throws a second time.
- **`scanMessageForCodes` deliberately has no try/catch.** Returning `[]` on failure is indistinguishable from "no codes here" and would drop real codes permanently. Errors propagate to the handler in `bot.ts`.

### Database

`bun:sqlite` + Drizzle, `casing: 'snake_case'` (schema fields are camelCase, columns are snake_case). `PRAGMA foreign_keys = ON` and WAL are set on connect. `initializeDatabase()` runs migrations on boot and resolves the migrations folder differently for `bun` vs. the compiled binary (`MIGRATIONS_PATH` overrides). DB path is `DB_PATH` or `./data/idle.db`.

Tables: `users` (credentials + per-user `autoRedeem` / `dmOnCode` / `dmOnSuccess` / `dmOnFailure` toggles), `redeemed_codes` (per-user redemption results, public flag, expiry), `pending_codes`, `loot_totals`, `audit_log`, `backfill_operations`.

### Tests

`bun test` with `src/test/setup.ts` preloaded via `bunfig.toml`. That preload forces `DB_PATH=:memory:`, points the migrator at the source migrations folder, and sets a fixed non-secret `ENCRYPTION_KEY` — so tests exercise the real schema and real encryption path against a throwaway database. Test files live next to their subject as `*.test.ts`.

## Conventions

- Conventional Commits, enforced by commitlint. Scopes in use: `api`, `bot`, `database`, `commands`, `logging`, `ui`, `ci`, `docs`, `types`, `logs`.
- Comments in this codebase explain _why_ a non-obvious choice was made (usually the bug it prevents). Match that when touching the same code — do not strip those rationales.
- Documentation lives in `docs/` and is expected to change with the code; `README.md` links every doc.
- `.instructions.md` is the Copilot instruction file. Its policy sections (Mise-only, no `--no-verify`, pre-push gate, commit format, DCO/GPG) are authoritative, but its _code_ descriptions are partly stale (it still claims 6 commands, plaintext credentials, a global `NODE_TLS_REJECT_UNAUTHORIZED`, and a `lib/` directory). Trust the source over that file.
