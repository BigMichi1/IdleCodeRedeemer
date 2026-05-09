# Idle Champions Code Redeemer Bot

A Discord bot that automatically scans for and redeems Idle Champions promo codes. Replaces the browser extension with a 24/7 cloud-ready bot that runs on your Discord server.

## Features

- 🤖 **Slash Commands** - `/setup`, `/redeem`, `/inventory`, `/open`, `/blacksmith`
- 🔄 **Auto Code Detection** - Scans Discord messages for codes automatically
- 🎁 **Code Redemption** - Submit codes and get rewards
- 📦 **Chest Management** - Open chests and view loot
- ⚒️ **Blacksmith** - Upgrade heroes with contracts
- 📊 **Inventory** - View gold, rubies, equipment, and progress
- 💾 **Secure Storage** - SQLite database keeps credentials safe and local
- 👥 **Multi-User** - Each user manages their own account
- ⚡ **Fast** - Built on Bun for 3-4x performance vs Node.js

## Quick Start

### Prerequisites

- Mise 2024+ (or Bun 1.3.9+ if you prefer to manage tools manually)
- Discord bot token

### Setup (5 minutes)

```bash
# 1. Clone and enter directory
git clone <repo> && cd idle-code-redeemer

# 2. Install dependencies (Mise manages Bun automatically)
mise run install

# 3. Configure environment
cp .env.example .env
# Edit .env and add:
# - DISCORD_TOKEN (from Discord Developer Portal)
# - DISCORD_GUILD_ID (your server ID)
# - DISCORD_CHANNEL_ID (where bot scans for codes)

# 4. Start the bot
mise run dev
```

**Don't have Mise?** [Install it first](https://mise.jdx.dev/getting-started.html)

```bash
# macOS/Linux
curl https://mise.jdx.dev/install.sh | sh

# Or with Homebrew
brew install mise
```

## Commands

| Command                                                       | Description                                           |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `/setup user_id:<id> user_hash:<hash>`                        | Save your Idle Champions credentials                  |
| `/redeem code:<code>`                                         | Manually redeem a code                                |
| `/inventory`                                                  | View your account (gold, rubies, equipment, progress) |
| `/open chest_type:<type> count:<count>`                       | Open chests (Gold, Sapphire, etc.)                    |
| `/blacksmith contract_type:<type> hero_id:<id> count:<count>` | Upgrade heroes                                        |
| `/help`                                                       | Show all commands                                     |

## Architecture

```
src/bot/
├── bot.ts                 # Main Discord client & event handlers
├── api/
│   └── idleChampionsApi.ts    # Game server API client
├── commands/              # Slash command handlers
├── database/              # SQLite management (users, codes, audit log)
├── handlers/              # Message scanning for codes
└── utils/                 # Helpers (debug logging, etc.)
lib/
├── *.d.ts                 # Type definitions from extension
```

## Configuration

### `.env` Example

```bash
DISCORD_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=1214259114725605436
DISCORD_CHANNEL_ID=1502624358055809104
DB_PATH=./data/idle.db
NODE_ENV=development
```

## Development

Use Mise for all development tasks. The environment is automatically configured:

```bash
mise run install     # Setup all tools & dependencies
mise run dev         # Start bot with auto-rebuild
mise run build       # Compile TypeScript
mise run watch       # Watch for changes and rebuild
mise run lint        # Check code quality
mise run lint:fix    # Auto-fix linting issues
mise tasks           # View all available tasks
```

## Database

SQLite database with 4 tables:

- **users** - Discord user credentials (encrypted)
- **redeemed_codes** - Code history and status
- **pending_codes** - Codes waiting to be redeemed
- **audit_log** - All bot actions

## Troubleshooting

**"CERT_HAS_EXPIRED" errors?**

- This is handled automatically by Mise (no manual setup needed)
- The environment variable `NODE_TLS_REJECT_UNAUTHORIZED=0` is set by `.mise.toml`

**Bot not responding?**

- Check DISCORD_TOKEN in .env
- Ensure bot is invited to your server with correct permissions

**Codes not detecting?**

- Verify DISCORD_CHANNEL_ID points to the right channel
- Bot must have message read permissions
- Run `mise run lint` to check for code issues

## Documentation

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development guide and architecture
- **[STRUCTURE.md](STRUCTURE.md)** - Complete project structure
- **[MISE.md](MISE.md)** - Mise tool setup and task reference

## Original Extension

This was originally a Chrome/Edge extension. The Discord bot version is vastly superior:

| Feature    | Extension         | Bot              |
| ---------- | ----------------- | ---------------- |
| Uptime     | Browser only      | 24/7             |
| Setup      | Popup UI          | Discord commands |
| Multi-user | No                | Yes              |
| Automatic  | Browser dependent | Always on        |
| Deployment | Install extension | Docker           |

## License

See LICENSE file
