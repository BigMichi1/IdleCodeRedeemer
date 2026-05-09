# Project Structure

This Discord bot was converted from the Idle Champions Code Redeemer browser extension. All browser extension code has been removed; only the Discord bot remains.

## Directory Layout

```
idle-code-redeemer/
├── README.md              ← Start here
├── DEVELOPMENT.md         ← Dev setup & architecture
├── MISE.md                ← Optional: Mise tool management
├── LICENSE
├── .env.example           ← Configuration template
├── .gitignore
│
├── src/
│   ├── bot/               ← Discord bot (ACTIVE)
│   │   ├── bot.ts         ← Main Discord client & event handlers
│   │   ├── api/           ← Game server API client
│   │   ├── commands/      ← Slash command handlers (6 commands)
│   │   ├── database/      ← SQLite managers (users, codes, audit)
│   │   ├── handlers/      ← Message scanning for codes
│   │   └── utils/         ← Utilities (debug logging)
│   │
│   └── lib/               ← Type definitions (from game API)
│       ├── player_data.d.ts
│       ├── redeem_code_response.d.ts
│       ├── blacksmith_response.d.ts
│       ├── server_definitions.d.ts
│       └── chrome.d.ts    ← Not used (kept for reference)
│
├── data/                  ← SQLite database (git-ignored)
│   └── idle.db
│
├── debug/                 ← API response logs (auto-cleanup) (git-ignored)
│   └── *.json
│
├── scripts/               ← Utility scripts
│   └── get-credentials.js
│
├── node_modules/          ← Dependencies (git-ignored)
├── package.json           ← npm/Bun dependencies
├── tsconfig.json          ← Global TypeScript config
├── tsconfig.bot.json      ← Bot-specific TypeScript config
│
├── .mise.toml             ← Mise task definitions (optional)
├── Dockerfile             ← Docker container setup
├── docker-compose.yml     ← Multi-container orchestration
└── .dockerignore
```

## Key Files

### Core Bot
- **[src/bot/bot.ts](../src/bot/bot.ts)** - Discord client initialization, event handlers, command routing
- **[src/bot/api/idleChampionsApi.ts](../src/bot/api/idleChampionsApi.ts)** - Game server API client with query-parameter format

### Commands (6 slash commands)
- **[src/bot/commands/setup.ts](../src/bot/commands/setup.ts)** - `/setup user_id:<id> user_hash:<hash>`
- **[src/bot/commands/redeem.ts](../src/bot/commands/redeem.ts)** - `/redeem code:<code>`
- **[src/bot/commands/inventory.ts](../src/bot/commands/inventory.ts)** - `/inventory` (gold, rubies, equipment, progress)
- **[src/bot/commands/open.ts](../src/bot/commands/open.ts)** - `/open chest_type:<type> count:<count>`
- **[src/bot/commands/blacksmith.ts](../src/bot/commands/blacksmith.ts)** - `/blacksmith contract_type:<type> hero_id:<id> count:<count>`
- **[src/bot/commands/help.ts](../src/bot/commands/help.ts)** - `/help`

### Database
- **[src/bot/database/db.ts](../src/bot/database/db.ts)** - SQLite connection & schema
- **[src/bot/database/userManager.ts](../src/bot/database/userManager.ts)** - User credential storage
- **[src/bot/database/codeManager.ts](../src/bot/database/codeManager.ts)** - Code tracking & history

### Auto Features
- **[src/bot/handlers/codeScanner.ts](../src/bot/handlers/codeScanner.ts)** - Message scanning for codes (regex pattern)
- **[src/bot/utils/debugLogger.ts](../src/bot/utils/debugLogger.ts)** - API response logging with auto-cleanup

### Configuration
- **[.env.example](../.env.example)** - Template for environment variables
- **[.mise.toml](../.mise.toml)** - Task definitions for Mise (optional tool manager)
- **[package.json](../package.json)** - npm scripts & dependencies
- **[tsconfig.bot.json](../tsconfig.bot.json)** - TypeScript compiler options

## Dependencies

**Production**
- `discord.js` - Discord bot framework
- `dotenv` - Environment variable loader
- `node-fetch` - HTTP client
- `sqlite3` - Embedded database

**Development**
- `typescript` - Type checking
- `@types/*` - Type definitions

**Runtime (managed by Mise or manual install)**
- `bun` 1.0+ - JavaScript runtime (or Node.js 20+)

## Removed (Cleanup)

The following browser extension code has been permanently removed:
- `src/chestManagement/` - Extension chest management UI
- `src/inject/` - Extension content script
- `src/options/` - Extension options page
- `src/service_worker/` - Extension background service worker
- `src/shared/` - Shared extension code
- `extension/` - Extension manifest, assets, distribution files

Reason: Converted to Discord bot; extension code no longer needed.

## Build & Deployment

**For local development:**
```bash
npm install
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev
```

**For Docker deployment:**
```bash
docker-compose up
```

**For production:**
- Use Bun for 3-4x faster startup
- Configure `DISCORD_TOKEN` from Discord Developer Portal
- Set `DISCORD_GUILD_ID` to your server ID
- Runs 24/7 in the cloud

See [README.md](README.md) and [DEVELOPMENT.md](DEVELOPMENT.md) for details.
