# Idle Champions Code Redeemer Bot

A Discord bot that automatically scans for and redeems Idle Champions promo codes. Replaces the browser extension with a 24/7 cloud-ready bot that runs on your Discord server.

## Features

- 🤖 **Slash Commands** - `/setup`, `/redeem`, `/inventory`, `/open`, `/blacksmith`, `/codes`, `/makepublic`, `/help`
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
| `/codes [count:<count>]`                                      | Show your redeemed codes history (last 10)            |
| `/makepublic code:<code>`                                     | Share one of your redeemed codes with other users     |
| `/help`                                                       | Show all commands                                     |

### Setup & Authentication

#### `/setup user_id:<id> user_hash:<hash>`

Initialize your account with the bot. You need your Idle Champions user ID and user hash to authenticate.

- **Required parameters:**
  - `user_id` - Your Idle Champions user ID (found in game settings)
  - `user_hash` - Your user hash token (also in game settings)
- **Security:** Credentials are encrypted and stored locally in SQLite
- **Example:** `/setup user_id:12345 user_hash:abc123def456`

### Code Redemption

#### `/redeem code:<code>`

Manually redeem a single code and immediately receive rewards.

- **Required parameters:**
  - `code` - The promo code to redeem (e.g., `IDLE2024`)
- **Response:** Shows rewards obtained (gold, rubies, chests, etc.)
- **Example:** `/redeem code:IDLE2024`

### Inventory & Progress

#### `/inventory`

View your complete account status including:

- **Gold** - Current gold balance
- **Rubies** - Gem currency for special items
- **Equipment** - Gear inventory with rarity levels
- **Progress** - Objectives completed, champions, areas unlocked
- **Example:** `/inventory`

#### `/open chest_type:<type> count:<count>`

Open chests to receive random loot. Different chest types contain different rewards.

- **Required parameters:**
  - `chest_type` - Type of chest (e.g., `Gold`, `Sapphire`, `Legendary`)
  - `count` - Number of chests to open (1+)
- **Common chest types:** Gold, Sapphire, Ruby, Epic, Legendary
- **Response:** Lists all items obtained from opened chests
- **Example:** `/open chest_type:Sapphire count:5`

#### `/blacksmith contract_type:<type> hero_id:<id> count:<count>`

Upgrade heroes using blacksmith contracts. Different contract types upgrade different hero abilities.

- **Required parameters:**
  - `contract_type` - Type of contract (e.g., `Damage`, `HP`, `Ability`)
  - `hero_id` - ID of the hero to upgrade
  - `count` - Number of contracts to use (1+)
- **Effect:** Permanently increases hero stats
- **Example:** `/blacksmith contract_type:Damage hero_id:42 count:10`

### Code Management

#### `/codes [count:<count>]`

View your personal code redemption history.

- **Optional parameters:**
  - `count` - Number of codes to show (1-20, default: 10)
- **Shows:** Code, redemption date, rewards received
- **Example:** `/codes` or `/codes count:20`

#### `/makepublic code:<code>`

Share one of your previously redeemed codes with other users. Other users can redeem the same code via `/redeem` and the rewards will be shared.

- **Required parameters:**
  - `code` - One of your redeemed codes (must be in your history)
- **Requirement:** You must have already redeemed this code
- **Note:** Codes automatically become public when a second user successfully redeems them
- **Example:** `/makepublic code:SHARED123`

### Help

#### `/help`

Display all available commands with brief descriptions.

- **Use when:** You need a quick reference of all bot commands
- **Example:** `/help`

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
mise run install  # Setup all tools & dependencies
mise run dev      # Start bot with auto-rebuild
mise run build    # Compile TypeScript
mise run watch    # Watch for changes and rebuild
mise run lint     # Check code quality
mise run lint:fix # Auto-fix linting issues
mise tasks        # View all available tasks
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
