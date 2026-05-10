# System Design & Architecture

**OSPS-SA-01.01**: Project documentation includes design documentation demonstrating all actions and actors within the system.

## Overview

The Idle Champions Code Redeemer Discord Bot is a **distributed system** with five primary actors:

1. **Discord Users** (human actors)
2. **Discord Server** (message bus & authentication)
3. **Discord Bot** (application logic & orchestration)
4. **Idle Champions Game Server** (external API provider)
5. **SQLite Database** (local persistent storage)

The bot reads promo codes from Discord messages, redeems them via the Idle Champions API, and stores code history locally.

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Discord Server (Guild)                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        Discord Channel                            │  │
│  │  ┌──────────┐  Code detected  ┌──────────────┐  Msg event       │  │
│  │  │   User   │────────────────▶│  Discord Bot │◀────────────────┐│  │
│  │  └──────────┘                 │              │                ││  │
│  │      ▲                         └──────────────┘                ││  │
│  │      │ Command response         │      │       │               ││  │
│  │      │                          │      │       ▼               ││  │
│  │      └──────────────────────────┘      │    ┌─────────────┐   ││  │
│  │                                        │    │ Code Scanner│   ││  │
│  │                                        │    │  Handler    │   ││  │
│  │                                        │    └──────┬──────┘   ││  │
│  │                                        │           │          ││  │
│  │                                        ▼           ▼          ││  │
│  │                                   ┌─────────────────────┐    ││  │
│  │                                   │ Backfill Handler    │    ││  │
│  │                                   │ (Message History)   │    ││  │
│  │                                   └────────┬────────────┘    ││  │
│  │                                            │                 ││  │
│  │                                            │                 ││  │
│  └────────────────────────────────────────────┼─────────────────┘│  │
│                                               │                    │
├───────────────────────────────────────────────┼────────────────────┤
│                                               │                    │
│  ┌─────────────────────────────────────────┐  │   Application      │
│  │        SQLite Database (Local)          │  │   Layer            │
│  │                                         │  │                    │
│  │  ┌──────────────┐  ┌──────────────┐   │  │  ┌──────────────┐  │
│  │  │ User Manager │  │ Code Manager │   │◀─┼─▶│ Idle Champions   │
│  │  │  - Creds     │  │ - History    │   │  │  │ API Client   │  │
│  │  │  - Instance  │  │ - Timestamps │   │  │  │              │  │
│  │  └──────────────┘  └──────────────┘   │  │  └────────┬─────┘  │
│  │                                        │  │           │        │
│  │  ┌──────────────┐   ┌──────────────┐  │  │           │        │
│  │  │Backfill Mgr  │   │  Debug Log   │  │  │           │        │
│  │  │  - State     │   │  - Responses │  │  │           │        │
│  │  │  - Locking   │   │  - Cleanup   │  │  │           │        │
│  │  └──────────────┘   └──────────────┘  │  │           │        │
│  └──────────────────────────────────────┘  │  │           │        │
│                         ▲                  │  │           │        │
│                         └──────────────────┼──┘           │        │
│                                            │              │        │
│                    HTTPS/TLS               │              │        │
│                    Query Params             │              │        │
│                    (Encrypted)             │              │        │
│                                            ▼              │        │
│                              ┌─────────────────────┐      │        │
│                              │ Idle Champions API  │      │        │
│                              │   (External Server) │      │        │
│                              │                     │      │        │
│                              │ - getUserDetails()  │      │        │
│                              │ - redeemCoupon()    │      │        │
│                              │ - openChests()      │      │        │
│                              │ - useBlacksmith()   │      │        │
│                              │ - purchaseChests()  │      │        │
│                              └─────────────────────┘      │        │
│                                                           │        │
└───────────────────────────────────────────────────────────┴────────┘
```

---

## Core Actors

### 1. Discord Users

**Role**: End-user interacting with the bot

**Actions**:
- Submit slash commands (`/setup`, `/redeem`, `/inventory`, `/open`, `/blacksmith`, `/codes`, `/makepublic`, `/backfill`, `/help`)
- Send messages containing promo codes in the monitored channel
- Receive responses and error messages from the bot

**Data Exchanged**:
- Credentials (user ID, hash) → to bot
- Account inventory data ← from bot
- Command responses (text/embeds) ← from bot

### 2. Discord Server (Guild)

**Role**: Message bus and authentication provider

**Actors Within**:
- **Guild**: Container for channels, permissions, and bot membership
- **Channel**: Monitored for code messages and command execution
- **Event Stream**: Delivers messageCreate, interactionCreate events to bot

**Actions**:
- Route user messages to bot
- Route user slash commands to bot
- Deliver event payloads with user authentication context
- Validate bot permissions before accepting responses

**Data Exchanged**:
- messageCreate events → to bot
- interactionCreate events → to bot
- Message content (text) → to bot
- Interaction data (command + args) → to bot

### 3. Discord Bot (This Application)

**Role**: Orchestrator and processor

**Subsystems**:
- **Command Handler** - Routes slash commands to handlers
- **Code Scanner** - Detects promo codes in messages
- **Backfill Handler** - Scans message history
- **API Client** - Communicates with Idle Champions API
- **Database Managers** - Persistence layer (users, codes, backfill state)

**Actions**:
- Listen for messageCreate events (channel-specific)
- Listen for interactionCreate events (global)
- Parse slash command invocations
- Extract promo codes from message content
- Query Idle Champions API
- Store/retrieve credentials and code history
- Generate command responses
- Manage rate limiting and backfill locking

**Data Processed**:
- Discord events (messages, interactions)
- Promo code strings
- User credentials
- API responses (JSON)
- Code history records

### 4. Idle Champions Game Server (External API)

**Role**: Authoritative source for game state

**Endpoints**:
- `POST /~idledragons/post.php?call=getUserDetails` - Get account status
- `POST /~idledragons/post.php?call=redeemcoupon` - Submit promo code
- `POST /~idledragons/post.php?call=openChests` - Open loot chests
- `POST /~idledragons/post.php?call=useBlacksmith` - Upgrade heroes
- `POST /~idledragons/post.php?call=purchaseChests` - Buy chests

**Actions**:
- Validate user credentials (user_id, hash)
- Process code submissions
- Return account state (inventory, progress)
- Return operation results (success/error)
- Enforce rate limits and business logic

**Data Exchanged**:
- Query parameters (user_id, hash, code, etc.) → from bot
- JSON response (player data, results) → to bot

**Security**:
- HTTPS/TLS for transport (certificate validation disabled - known issue)
- Query parameter format (no JSON body)
- User credentials required for all operations

### 5. SQLite Database

**Role**: Persistent local storage

**Tables**:
- **users** - User credentials (Discord ID, user_id, hash)
- **codes** - Code history (code, redeemer, timestamp, result)
- **backfill_state** - Backfill operation tracking (lock, last_message, status)
- **debug_log** - API response logging (call, timestamp, response, cleanup)

**Actions**:
- Store/retrieve user credentials
- Record code redemption history
- Track backfill operation state
- Log API responses for debugging

**Data Characteristics**:
- **Persistence**: Data survives bot restarts
- **Locality**: No network dependency
- **Isolation**: Each user's data accessible only via their Discord ID
- **Cleanup**: Debug logs auto-deleted after 7 days

---

## Core Data Flows

### Flow 1: User Submits `/setup` Command

**Actors**: Discord User → Discord Bot → Database

```
User ─ /setup <user_id> <hash> ─> Bot
       (slash command)               │
                                     ├─> Validate format
                                     ├─> Store in users table
                                     └─> Respond "Credentials saved"
                                     
User <─ Ephemeral response ─ Bot
   (only user sees)
```

**System Operations**:
1. User invokes `/setup` command with arguments
2. Discord delivers `interactionCreate` event to bot
3. Bot's command handler routes to `setup.ts`
4. Setup handler validates argument format
5. UserManager stores credentials in `users` table (encrypted at rest via OS)
6. Bot responds with ephemeral message (only user sees)

**Security**:
- Credentials never logged
- Ephemeral response (not visible to other users)
- HTTPS only over Discord API
- Stored in local SQLite (no cloud transmission)

---

### Flow 2: Message Scanner Detects Code

**Actors**: Discord User → Discord Server → Discord Bot → Idle Champions API → Database

```
User posts:     "Free code: ABC123"
                 │
                 ├─> Discord (messageCreate event)
                 │
                 └─> Bot
                     ├─> CodeScanner.scan()
                     │   ├─> Regex match: "ABC123"
                     │   ├─> Found: code matches pattern
                     │   └─> Code detected ✓
                     │
                     ├─> Get user creds from database
                     │
                     ├─> Call API: redeemCoupon(ABC123)
                     │   ├─> https://idledragons.../post.php?
                     │   │   call=redeemcoupon&
                     │   │   user_id=12345&
                     │   │   hash=abc...&
                     │   │   code=ABC123&
                     │   │   instance_id=xyz...
                     │   │
                     │   └─> Response: {"Success": 1, "Message": "Code redeemed"}
                     │
                     ├─> Store in codes table:
                     │   {code: "ABC123", redeemer: <user_id>, 
                     │    result: "Success", timestamp: now}
                     │
                     └─> Respond in channel (or quiet if in public mode)
```

**Key Design Decisions**:
1. **Code Detection**: Regex pattern matches known code format
2. **Automatic Redemption**: No user action required
3. **User Selection**: Scans message author for stored credentials
4. **API Resilience**: Retries on transient failures
5. **History Recording**: All attempts logged regardless of success

---

### Flow 3: User Submits `/redeem` Command

**Actors**: Discord User → Discord Bot → Idle Champions API → Database

```
User ─ /redeem <code> ─> Bot
       (slash command)      │
                           ├─> Get user creds from database
                           │
                           ├─> Validate code format
                           │
                           ├─> Call API: getUserDetails()
                           │   └─> Get fresh instance_id
                           │
                           ├─> Call API: redeemCoupon(code)
                           │
                           ├─> Store in codes table
                           │   {code, redeemer, result, timestamp}
                           │
                           └─> Respond with result
                               "✓ Code redeemed!" or 
                               "✗ Code already used"

User <─ Response (embed) ─ Bot
```

**Implementation Details**:
- Validates code string length and characters
- Fetches fresh `instance_id` (required by API)
- Uses user_id + hash from database
- Records all attempts (success or failure)
- Shows embed with color-coded result

---

### Flow 4: User Submits `/backfill` Command

**Actors**: Discord User → Discord Bot → Discord Server → Idle Champions API → Database

```
User ─ /backfill <days> ─> Bot
       (slash command)       │
                            ├─> Check backfill lock in database
                            │
                            ├─> Acquire lock (prevent concurrent runs)
                            │
                            ├─> Get channel message history
                            │   (fetch() 100 msgs at a time)
                            │   │
                            │   └─> For each message:
                            │       ├─> Scan for code patterns
                            │       ├─> Get code author's creds
                            │       ├─> Redeem via API
                            │       └─> Store in codes table
                            │
                            ├─> Release lock
                            │
                            └─> Respond with results
                                "Processed 1,500 messages
                                 Found 42 codes
                                 Redeemed 38 (4 already used)"

User <─ Response (embed) ─ Bot
```

**Rate Limiting**:
- Discord: 1 request per message (100 msgs/request)
- Idle Champions API: ~100ms between requests
- Bot: ~10ms sleep between Discord fetches
- Total: ~2-3 hours to backfill 1 month of history

**Locking**:
- Prevents two `/backfill` commands running simultaneously
- Lock state stored in `backfill_state` table
- Timeout: 6 hours (prevents stuck locks)

---

### Flow 5: User Submits `/inventory` Command

**Actors**: Discord User → Discord Bot → Idle Champions API

```
User ─ /inventory ─> Bot
       (command)     │
                    ├─> Get user creds from database
                    │
                    ├─> Call API: getUserDetails()
                    │   ├─> Get player state (level, gold, rubies, etc.)
                    │   ├─> Get inventory (equipment, chests, etc.)
                    │   └─> Get progress (formations, bosses beaten)
                    │
                    └─> Format and respond with embed
                        ┌─────────────────┐
                        │ Gold: 1.2M      │
                        │ Rubies: 500     │
                        │ Level: 450      │
                        │ ...             │
                        └─────────────────┘

User <─ Response (embed) ─ Bot
```

**Data Displayed**:
- Currency (gold, rubies)
- Progression (level, progress %)
- Equipment count
- Chest inventory (by type)
- Character roster

---

### Flow 6: User Submits `/open` or `/blacksmith` Command

**Actors**: Discord User → Discord Bot → Idle Champions API

```
User ─ /open <chest_type> <count> ─> Bot
       (command with args)              │
                                       ├─> Validate chest_type
                                       │
                                       ├─> Call API: getUserDetails()
                                       │   └─> Get fresh instance_id
                                       │
                                       ├─> Call API: openChests()
                                       │   └─> Execute operation
                                       │
                                       └─> Respond with loot
                                           "You opened 10 chests!
                                            Got: Gold +5.3M,
                                            Equipment drops: 4,
                                            ..."

User <─ Response (embed) ─ Bot
```

**Pattern**: Identical to `/open` but with `/blacksmith` API endpoint

---

## Data Models

### User Credentials (Persisted)

```typescript
interface UserCredentials {
  discord_id: string;      // Discord snowflake
  user_id: string;         // Idle Champions user ID
  hash: string;            // Idle Champions API hash
  instance_id?: string;    // Cached for efficiency
  last_updated: Date;      // For rotation if needed
}
```

**Storage**: SQLite `users` table
**Uniqueness**: One per Discord user
**Sensitivity**: Treated as secret (encrypted at rest by OS)

### Code History (Persisted)

```typescript
interface CodeRecord {
  code: string;
  redeemer: string;        // Discord ID of code author
  result: "Success" | "Failed" | "Already Used";
  timestamp: Date;
  api_response?: string;   // Debug field
}
```

**Storage**: SQLite `codes` table
**Index**: code (fast lookups), timestamp (history queries)
**Retention**: Indefinite (audit trail)

### Backfill State (Persisted)

```typescript
interface BackfillState {
  locked: boolean;
  last_message_id?: string;
  last_run_timestamp?: Date;
  status: "idle" | "running" | "paused";
  lock_acquired_at?: Date;
}
```

**Storage**: SQLite `backfill_state` table
**Purpose**: Prevent concurrent backfill runs
**Timeout**: 6 hours (safety reset)

### API Request (Persisted)

```typescript
interface DebugLogEntry {
  call: string;            // "redeemcoupon", "openChests", etc.
  timestamp: Date;
  request: string;         // Sanitized request (no hash)
  response: string;        // Full API response
  duration_ms: number;
}
```

**Storage**: SQLite `debug_log` table
**Rotation**: Auto-delete after 7 days
**Purpose**: Post-mortem debugging

---

## Command Handlers (Subsystem)

### Slash Command Registration

All handlers follow pattern:
- Exported `data` (SlashCommandBuilder)
- Exported `execute(interaction)` function
- Ephemeral responses for sensitive operations
- Embed responses for rich formatting

### Command Reference

| Command | Handler File | Purpose | User Facing |
|---------|--------------|---------|-------------|
| `/setup` | setup.ts | Store user credentials | Ephemeral |
| `/redeem` | redeem.ts | Submit single code | Embed |
| `/inventory` | inventory.ts | View account status | Embed |
| `/open` | open.ts | Open chests | Embed |
| `/blacksmith` | blacksmith.ts | Upgrade heroes | Embed |
| `/codes` | codes.ts | View code history | Embed |
| `/makepublic` | makepublic.ts | Share codes with users | Message |
| `/backfill` | backfill.ts | Scan message history | Embed |
| `/help` | help.ts | Command reference | Embed |

---

## Message Handlers (Subsystem)

### Code Scanner (`codeScanner.ts`)

```
messageCreate event
    ↓
Is in monitored channel? → Yes
    ↓
Scan message text with regex: /([A-Z0-9]{4,20})/g
    ↓
Codes found? → Yes
    ↓
For each code:
  - Get message author's credentials
  - Call API: redeemCoupon()
  - Store result in database
    ↓
Update message with reaction (optional)
```

**Key Features**:
- Runs on all messageCreate events
- Filters by guild/channel
- Non-blocking (async)
- Error resilient (logs failures, continues)

### Backfill Handler (`backfillHandler.ts`)

```
/backfill command invoked
    ↓
Acquire backfill lock
    ↓
Fetch message history (100 at a time)
    ↓
For each batch:
  - Scan for codes
  - Redeem codes
  - Update last_message_id
    ↓
Continue until:
  - Reached message limit (before N days ago)
  - Rate limited
  - Manually stopped
    ↓
Release lock
```

**Design Notes**:
- Lock-based concurrency (only one backfill at a time)
- Resumable (remembers last_message_id)
- Rate-limited (respects Discord & API limits)
- Status updates via messages (every 100 messages)

---

## Database Subsystem

### Connection Pool

```typescript
const db = new sqlite3.Database('./data/idle.db');

// Single connection per process
// Synchronous initialization
// Auto-create tables on first run
```

**Characteristics**:
- Single-threaded (SQLite 3 default)
- Journaled (ACID compliance)
- Local file storage
- No network I/O

### Tables

```sql
-- Users: Store Discord user credentials
CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- Codes: Store code history
CREATE TABLE IF NOT EXISTS codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  redeemer TEXT NOT NULL,  -- Discord ID
  result TEXT,             -- Success, Failed, Already Used
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  api_response TEXT
)

-- Backfill State: Track backfill operations
CREATE TABLE IF NOT EXISTS backfill_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  locked BOOLEAN DEFAULT 0,
  last_message_id TEXT,
  last_run_timestamp DATETIME,
  lock_acquired_at DATETIME
)

-- Debug Log: Store API request/response logs
CREATE TABLE IF NOT EXISTS debug_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  request TEXT,
  response TEXT,
  duration_ms INTEGER
)
```

---

## API Client Subsystem

### Configuration

```typescript
interface ApiOptions {
  server: string;          // "prod" or "test"
  user_id: string;         // From user credentials
  hash: string;            // From user credentials
  instanceId: string;      // Fresh per operation
}
```

**Base URLs**:
- Production: `https://idledragons.com/~idledragons/post.php`
- Test: `https://idledragons-test.com/~idledragons/post.php`

### HTTP Configuration

```typescript
const agent = new https.Agent({
  // Certificate validation disabled
  rejectUnauthorized: false,  // KNOWN ISSUE: Idle Champions has expired cert
});

const response = await fetch(url, {
  method: 'POST',
  agent,
  timeout: 30000,  // 30 sec
  headers: {
    'User-Agent': 'IdleChampionsBot/1.0.0'
  }
});
```

### Retry Logic

```
API Call
    ↓
Success (HTTP 200) → Parse JSON → Return data
    ↓
Timeout or 5xx → Retry (up to 3 times, exponential backoff)
    ↓
Error 4xx → Fail immediately (no retry)
```

---

## Security & Data Flow

### Credential Management

**Storage**:
- SQLite database at `./data/idle.db`
- Encrypted at OS level (file permissions)
- Never logged or transmitted insecurely

**Access Control**:
- Bot process only
- Read-only for external systems
- Deleted on user `/unsetup` (not yet implemented)

**Lifecycle**:
1. User provides via `/setup` command (ephemeral)
2. Stored in database
3. Retrieved for API calls
4. Never shown in responses

### Code History

**Logging**:
- All code submission attempts recorded
- Includes success/failure status
- Timestamp for audit trail
- Author (Discord ID) tracked

**Visibility**:
- User can view their own via `/codes` command
- Cross-user lookups not exposed
- No data leakage between users

### API Communication

**Encryption**:
- HTTPS/TLS for all outbound requests
- Query parameters (no sensitive data in URL beyond required)
- Response JSON includes game state

**Rate Limiting**:
- Bot respects Discord API limits
- Idle Champions API enforces per-user limits
- Backfill handler implements delays

### Database Access

**Isolation**:
- Single SQLite connection per process
- No distributed transactions
- No remote access

**Durability**:
- WAL (write-ahead log) for consistency
- ACID transactions on all writes
- Auto-cleanup of debug logs (7 days)

---

## Error Handling & Resilience

### API Failures

```
API Call Fails
    ↓
Is it transient (timeout, 5xx)? 
    ├─ Yes → Retry (3 attempts, exponential backoff)
    │         ├─ Success → Proceed
    │         └─ Failure → Log and respond to user
    │
    └─ No (4xx, 3xx) → Log and respond immediately
```

### Database Failures

```
Query Fails
    ├─ Connection lost → Attempt reconnect
    ├─ Table missing → Auto-create on startup
    └─ Constraint violation → Log validation error
```

### Message Handler Failures

```
Message Handler Error
    ├─ Code detection fails → Skip message, continue
    ├─ API call fails → Log, no user notification (silent)
    └─ Database write fails → Log error, user may not know
```

---

## System Properties

### Scalability

**Single Instance**:
- Handles 1-10 servers effectively
- ~1,000 users per instance
- Message processing: ~1,000/min (limited by rate limiting)

**Multi-Instance**:
- Not currently supported
- Database sharing would cause concurrency issues
- Future: Implement shared database with distributed locks

### Availability

**Downtime Impact**:
- Auto-code detection pauses (messages still readable)
- Manual `/redeem` unavailable
- Historical codes not recovered until backfill re-runs

**Recovery**:
- Bot restart: ~5 seconds
- Full state restored from database
- Backfill resumes from last_message_id

### Performance

**Latency**:
- Slash command: 200-500ms (API call + DB write)
- Message scanner: <100ms (non-blocking)
- Backfill: ~50-100 msgs/min (rate limited)

**Resource Usage**:
- Memory: ~50-100 MB
- CPU: <5% idle, 20-30% during backfill
- Disk: SQLite grows ~1MB per 10,000 codes

---

## Deployment Architecture

### Docker Container

```dockerfile
# Builder stage
FROM debian:13.4-slim AS builder
WORKDIR /app
COPY .mise.toml package.json bun.lock ./
RUN bin/mise install && bin/mise run install
COPY tsconfig.bot.json ./
COPY src/bot ./src/bot
COPY src/lib ./src/lib
RUN bin/mise run prod:build

# Production stage — only the binary needed
FROM debian:13.4-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates
COPY --from=builder /app/dist-bundle/bot ./dist-bundle/bot
RUN mkdir -p /app/data /app/api-logs
CMD ["/app/dist-bundle/bot"]
```

**Environment**:
- Self-contained ELF binary with embedded Bun runtime
- No Bun, Node.js, or `node_modules` required at runtime
- Discord bot token via ENV var
- Database persisted to volume

### Orchestration (Docker Compose)

```yaml
services:
  bot:
    image: ghcr.io/bigmichi1/idlecoderedeemer:latest
    volumes:
      - bot-data:/app/data          # SQLite persistence
    environment:
      - DISCORD_TOKEN=<token>
      - DISCORD_GUILD_ID=<id>
      - DISCORD_CHANNEL_ID=<id>
    restart: always
```

**Features**:
- Persistent volume for database
- Auto-restart on failure
- Environment configuration
- No manual port exposure needed

---

## Breaking Changes & Feature Updates

This document is updated when:

1. **Major Features**: New commands, handlers, or subsystems
2. **Architecture Changes**: Refactoring data flows or component boundaries
3. **New Integrations**: External services or APIs
4. **Security Updates**: Changes to credential handling or communication
5. **Database Schema Changes**: New tables or columns

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0+ | 2026-05 | Initial design documentation |

---

## Related Documentation

- [Development Guide](development.md) - Setup and local testing
- [Project Structure](structure.md) - Directory layout
- [Security Policy](../SECURITY.md) - Vulnerability reporting
- [Contributing Guide](../CONTRIBUTING.md) - Development workflow
- [Architecture Decisions](https://github.com/BigMichi1/IdleCodeRedeemer/wiki) - Design rationale (if available)

---

## OSPS-SA-01.01 Compliance

✅ **Actors Documented**:
- Discord Users (human actors)
- Discord Server (guild infrastructure)
- Discord Bot (application logic)
- Idle Champions Game Server (external service)
- SQLite Database (persistent storage)

✅ **Actions Documented**:
- 9 slash commands with full flows
- Message scanner code detection
- Backfill history scanning
- API request/response handling
- Database persistence
- Error handling and recovery

✅ **Design Diagrams**:
- System architecture overview
- Data flow diagrams for each major operation
- Database schema
- Component interactions

✅ **Updated for Features**:
- All active features documented (commands, handlers, subsystems)
- Breaking changes tracked
- Version history maintained
