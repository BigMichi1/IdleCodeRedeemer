# Development Guide

## Quick Start

**⚠️ IMPORTANT: Always use Mise. Never use npm or bun run directly.**

```bash
# Install dependencies
mise run install

# Start development server with auto-rebuild
mise run dev

# View all available tasks
mise tasks
```

### If You Don't Have Mise Installed

```bash
# Install Mise (macOS/Linux)
curl https://mise.jdx.dev/install.sh | sh

# Or with Homebrew
brew install mise

# Then follow "Quick Start" above
```

## Project Structure

```
src/bot/
├── bot.ts                      # Main Discord client & events
├── api/
│   └── idleChampionsApi.ts     # Game API client (query-param based)
├── commands/
│   ├── setup.ts                # Save user credentials
│   ├── redeem.ts               # Manual code redemption
│   ├── inventory.ts            # Show account info
│   ├── open.ts                 # Open chests
│   ├── blacksmith.ts           # Upgrade heroes
│   ├── codes.ts                # Show code history
│   ├── makepublic.ts           # Share codes with other users
│   ├── backfill.ts             # Recover missed codes from history
│   └── help.ts                 # Command help
├── database/
│   ├── db.ts                   # SQLite connection & queries
│   ├── userManager.ts          # User credentials storage
│   ├── codeManager.ts          # Code tracking & history
│   └── backfillManager.ts      # Backfill operations & locking
├── handlers/
│   ├── codeScanner.ts          # Message code detection
│   └── backfillHandler.ts      # Message history scanning & redemption
└── utils/
    └── debugLogger.ts          # Response logging & cleanup

lib/
└── *.d.ts                      # Type definitions from game API
```

## Key Technologies

- **Mise** - Task runner and tool version manager (MANDATORY)
- **Bun 1.3.9** - JavaScript runtime (3-4x faster than Node.js)
- **discord.js 14.26** - Discord bot framework
- **sqlite3** - Local database
- **node-fetch** - HTTP client (for game API)
- **TypeScript** - Type-safe development

## Important Notes

### SSL Certificate Issue

The Idle Champions API server has an expired SSL certificate. Always start the bot with:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Instance ID Problem

When calling game APIs (redeem, open chests, blacksmith), you must:

1. Fetch fresh user details via `getUserDetails()`
2. Extract `instance_id` from `details.instance_id`
3. Pass it to the API call

This prevents "Outdated instance id" errors from the server.

### API Pattern

All game API calls use URL query parameters, not JSON body:

```
POST /~idledragons/post.php?call=redeemcoupon&user_id=X&hash=Y&instance_id=Z&code=ABC
```

## Building

Use Mise for all build tasks:

```bash
# Build the project
mise run build

# Watch for changes and rebuild
mise run watch
```

## Common Tasks

All tasks are run through Mise. Use `mise tasks` to see all available commands:

```bash
mise run install  # Install dependencies
mise run dev      # Start development server
mise run build    # Build TypeScript
mise run watch    # Watch & rebuild on changes
mise run lint     # Check code quality
mise run lint:fix # Auto-fix linting issues
mise run audit    # Check for vulnerabilities
mise run clean    # Clean build artifacts
```

## Database

SQLite database (`./data/idle.db`) with the following structure:

```mermaid
erDiagram
    USERS ||--o{ REDEEMED_CODES : "has"
    USERS ||--o{ PENDING_CODES : "has"
    USERS ||--o{ AUDIT_LOG : "generates"
    
    USERS {
        string discord_id PK
        int user_id "Idle Champions user ID"
        string user_hash "Idle Champions auth token"
        string server "game server URL"
        string instance_id "deprecated"
        datetime created_at
        datetime updated_at
    }
    
    REDEEMED_CODES {
        int id PK
        string code
        string discord_id FK
        string status
        json loot
        datetime timestamp
    }
    
    PENDING_CODES {
        int id PK
        string code
        string discord_id FK
        datetime added_at
    }
    
    AUDIT_LOG {
        int id PK
        string discord_id FK
        string action
        json details
        datetime timestamp
    }
    
    BACKFILL_OPERATIONS {
        int id PK
        string initiated_by "user ID or 'system'"
        datetime started_at
        datetime completed_at
        int codes_found
        int codes_redeemed
        string status "in_progress, completed, failed"
    }
```

## Testing Commands

```
/setup user_id:123456 user_hash:abc123def456...

/redeem code:TESTCODE

/inventory

/open chest_type:Gold count:5

/blacksmith contract_type:Small hero_id:1 count:3

/help
```

## Debugging

The bot saves API responses to `debug/` folder automatically:

- Files older than 1 hour are deleted
- Useful for troubleshooting API issues
- Format: `endpoint_YYYY-MM-DDTHH-mm-ss-SSSZ.json`

## Environment Variables

```bash
DISCORD_TOKEN      # Bot token from Discord Developer Portal
DISCORD_GUILD_ID   # Server ID (for guild-specific commands)
DISCORD_CHANNEL_ID # Channel ID (for auto code scanning)
DB_PATH            # Database file path (default: ./data/idle.db)
NODE_ENV           # development or production
```
