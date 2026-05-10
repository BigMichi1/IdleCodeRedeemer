# API Reference & Software Interfaces

**OSPS-SA-02.01**: Project documentation includes descriptions of all external software interfaces of released software assets.

This document describes all software interfaces (APIs) exposed by the Idle Champions Code Redeemer Discord Bot, including parameters, responses, error handling, and data structures.

---

## Overview

The Idle Champions Code Redeemer Bot exposes two primary software interface categories:

1. **Discord Bot API** - Slash commands and message event handlers
2. **Message Event API** - Automatic code detection in channel messages

Both interfaces are text-based, asynchronous, and designed for interactive use within Discord.

---

## Part 1: Discord Bot API

### API Type: Discord Slash Commands

The Discord bot responds to slash commands in Discord channels. All commands return ephemeral responses (visible only to the invoking user) or public embeds.

**Authentication**: Requires the user to have invoked `/setup` previously to store credentials in the database.

**Base Protocol**: Discord Interaction API (Discord.js implementation)

**Response Format**: Discord Embeds (rich message format) or Ephemeral Text

---

## Command Reference

### 1. `/setup`

Store your Idle Champions account credentials securely.

**Invocation**:
```
/setup user_id:<user_id> user_hash:<user_hash>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Your Idle Champions user ID (numeric string, e.g., "12345") |
| `user_hash` | string | Yes | Your API authentication hash (alphanumeric, e.g., "abc123def456xyz789") |

**Where to Find Credentials**:
- Open Idle Champions game client
- Go to Settings → Account
- Your user ID and hash are displayed there

**Response** (Ephemeral):
```
✅ Setup Complete
Credentials saved securely.
Your user_id has been stored in the bot database.
```

**Error Responses**:

| Error | Cause | Resolution |
|-------|-------|-----------|
| `Missing user_id parameter` | Parameter not provided | Add `user_id:YOUR_ID` |
| `Missing user_hash parameter` | Parameter not provided | Add `user_hash:YOUR_HASH` |
| `Invalid user_id format` | Non-numeric or too long | Use numeric ID from game |
| `Invalid user_hash format` | Incorrect format | Use hash from game settings |

**Example**:
```
User: /setup user_id:316463 user_hash:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Bot (ephemeral): ✅ Setup Complete - Credentials saved securely
```

**Data Storage**:
- Credentials stored locally in SQLite database
- Encrypted at rest via operating system file permissions
- Never logged or transmitted insecurely
- One set of credentials per Discord user

---

### 2. `/redeem`

Manually redeem a single promo code and receive rewards immediately.

**Invocation**:
```
/redeem code:<code_string>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Promo code to redeem (e.g., "IDLE2024", case-insensitive) |

**Validation**:
- Code must be 4-20 alphanumeric characters
- Case-insensitive (IDLE2024 = idle2024)

**Response Format** (Public Embed):

**Success Response**:
```
┌─────────────────────────────────┐
│ ✅ Code Redeemed                │
│ Code: IDLE2024                  │
│ Rewards: Gold +1.5M, Rubies +50 │
│ Status: Success                 │
│ Time: 2026-05-10 15:30:45 UTC   │
└─────────────────────────────────┘
```

**Failure Responses**:

```
# Code Already Used
┌─────────────────────────────────┐
│ ❌ Code Not Redeemed            │
│ Code: IDLE2024                  │
│ Reason: Code already used       │
│ Status: Already Redeemed        │
│ Time: 2026-05-10 15:30:45 UTC   │
└─────────────────────────────────┘

# Invalid Code Format
┌─────────────────────────────────┐
│ ❌ Invalid Code Format          │
│ Code: INVALID@#$                │
│ Reason: Code contains invalid   │
│         characters              │
└─────────────────────────────────┘

# No Credentials Set Up
┌─────────────────────────────────┐
│ ❌ Not Set Up                   │
│ Please run /setup first with    │
│ your user_id and user_hash      │
└─────────────────────────────────┘

# API Error
┌─────────────────────────────────┐
│ ❌ API Error                    │
│ Code: IDLE2024                  │
│ Error: Server timeout           │
│ Try again in a moment           │
└─────────────────────────────────┘
```

**Error Codes**:

| Error | Cause | Resolution |
|-------|-------|-----------|
| `NO_CREDENTIALS` | User hasn't run `/setup` | Run `/setup` with credentials |
| `INVALID_CODE_FORMAT` | Code contains invalid characters | Use only alphanumeric characters |
| `CODE_ALREADY_USED` | Code was previously redeemed | Use a different code |
| `API_TIMEOUT` | Idle Champions API slow/down | Wait and retry |
| `INVALID_CREDENTIALS` | Credentials incorrect or expired | Update with `/setup` |
| `RATE_LIMITED` | Too many requests in short time | Wait 30 seconds before retrying |

**Data Returned** (in success embed):
- Rewards obtained (gold, rubies, chests, equipment)
- Confirmation message
- Timestamp of redemption
- Response time

**Example**:
```
User: /redeem code:IDLE2024
Bot (public): 
┌──────────────────────────────────┐
│ ✅ Code Redeemed                 │
│ Code: IDLE2024                   │
│ Rewards: Gold +1,234,567         │
│          Rubies +50              │
│          Sapphire Chest +5       │
│ Time: 2026-05-10 15:30:45 UTC    │
└──────────────────────────────────┘
```

---

### 3. `/inventory`

Display your complete account status including currency, progression, and equipment.

**Invocation**:
```
/inventory
```

**Parameters**: None

**Response Format** (Public Embed):

```
┌──────────────────────────────────────┐
│ 📊 Your Inventory                    │
├──────────────────────────────────────┤
│ **Currency**                         │
│ Gold: 1,234,567,890                 │
│ Rubies: 250                          │
│                                      │
│ **Progression**                      │
│ Level: 450                           │
│ Gold Find (Multiplier): 1.5x         │
│ Damage Multiplier: 2.3x              │
│                                      │
│ **Equipment Count**                  │
│ Common: 245                          │
│ Rare: 87                             │
│ Epic: 23                             │
│ Legendary: 5                         │
│                                      │
│ **Chests**                           │
│ Gold: 12                             │
│ Sapphire: 8                          │
│ Ruby: 3                              │
│                                      │
│ **Heroes**                           │
│ Roster Size: 45/50                   │
│ Max Level: 500                       │
│                                      │
│ Updated: 2026-05-10 15:30:45 UTC    │
└──────────────────────────────────────┘
```

**Error Responses**:

```
# No Credentials Set Up
┌────────────────────────────────┐
│ ❌ Not Set Up                  │
│ Please run /setup first        │
└────────────────────────────────┘

# API Error
┌────────────────────────────────┐
│ ❌ Could Not Fetch Inventory   │
│ Error: Server timeout          │
│ Try again in a moment          │
└────────────────────────────────┘
```

**Data Structure** (JSON equivalent):

```typescript
interface InventoryResponse {
  currency: {
    gold: number;
    rubies: number;
  };
  progression: {
    level: number;
    gold_find_multiplier: number;
    damage_multiplier: number;
    progress_percentage: number;
  };
  equipment: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  chests: {
    gold: number;
    sapphire: number;
    ruby: number;
    elite: number;
  };
  heroes: {
    roster_count: number;
    max_count: number;
    max_level: number;
  };
  last_updated: ISO8601_timestamp;
}
```

**Example**:
```
User: /inventory
Bot (public): [Embed showing all account details]
```

---

### 4. `/open`

Open chests of a specified type to obtain rewards.

**Invocation**:
```
/open chest_type:<type> count:<number>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chest_type` | enum | Yes | Type of chest: `GOLD`, `SAPPHIRE`, `RUBY`, `ELITE` |
| `count` | integer | Yes | Number of chests to open (1-100) |

**Chest Types**:
- `GOLD` - Basic chests (gold rewards)
- `SAPPHIRE` - Medium chests (equipment)
- `RUBY` - High-tier chests (rare equipment)
- `ELITE` - Legendary chests (epic rewards)

**Response Format** (Public Embed):

**Success Response**:
```
┌──────────────────────────────────┐
│ 🎁 Chests Opened                 │
│                                  │
│ Opened: 5 Sapphire Chests        │
│                                  │
│ **Rewards Obtained**              │
│ Gold: +567,890                   │
│ Common Equipment: 2              │
│ Rare Equipment: 1                │
│ Epic Equipment: 0                │
│                                  │
│ **Inventory After**              │
│ Sapphire Chests: 12 → 7         │
│                                  │
│ Time: 2026-05-10 15:30:45 UTC   │
└──────────────────────────────────┘
```

**Error Responses**:

| Error | Cause | Resolution |
|-------|-------|-----------|
| `INVALID_CHEST_TYPE` | Type not recognized | Use GOLD, SAPPHIRE, RUBY, or ELITE |
| `INVALID_COUNT` | Count out of range | Use 1-100 |
| `INSUFFICIENT_CHESTS` | Don't have that many | Open fewer chests |
| `NO_CREDENTIALS` | User hasn't run `/setup` | Run `/setup` first |
| `API_ERROR` | Game server error | Retry in a moment |

**Data Returned**:
- Number of chests opened
- Gold obtained
- Equipment breakdown (common/rare/epic/legendary)
- Inventory updates

---

### 5. `/blacksmith`

Upgrade heroes by applying contracts and earning perks.

**Invocation**:
```
/blacksmith contract_type:<type> hero_id:<id> count:<number>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contract_type` | enum | Yes | Contract type: `UPGRADE`, `SPEED` |
| `hero_id` | string | Yes | Hero ID to upgrade (numeric) |
| `count` | integer | Yes | Number of contracts (1-100) |

**Contract Types**:
- `UPGRADE` - Standard hero level upgrades
- `SPEED` - Ability cooldown reduction contracts

**Response Format** (Public Embed):

```
┌──────────────────────────────────┐
│ ⚒️ Blacksmith Upgrade Complete   │
│                                  │
│ Hero: Barb                       │
│ Contract Type: Upgrade           │
│ Contracts Applied: 5             │
│                                  │
│ **Results**                       │
│ Level: 100 → 125                 │
│ Stats Increased                  │
│ DPS Gained: +45%                 │
│                                  │
│ Time: 2026-05-10 15:30:45 UTC   │
└──────────────────────────────────┘
```

**Error Responses**:

| Error | Cause | Resolution |
|-------|-------|-----------|
| `INVALID_HERO_ID` | Hero not found | Use valid hero ID |
| `INVALID_CONTRACT_TYPE` | Type not recognized | Use UPGRADE or SPEED |
| `INSUFFICIENT_CONTRACTS` | Don't have enough | Obtain more contracts |
| `NO_CREDENTIALS` | Not set up | Run `/setup` first |
| `API_ERROR` | Server error | Retry later |

---

### 6. `/codes`

Display your code redemption history (last N codes).

**Invocation**:
```
/codes [count:<number>]
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `count` | integer | No | Number of codes to show (1-50, default: 10) |

**Response Format** (Public Embed):

```
┌──────────────────────────────────┐
│ 📋 Your Redeemed Codes (Last 10) │
├──────────────────────────────────┤
│ 1. IDLE2024      ✅ Redeemed     │
│    2026-05-10 15:30:45 UTC       │
│                                  │
│ 2. CHAMPIONS1    ✅ Redeemed     │
│    2026-05-09 14:22:10 UTC       │
│                                  │
│ 3. PROMO500      ❌ Already Used │
│    2026-05-08 09:15:33 UTC       │
│                                  │
│ 4. SPECIAL100    ✅ Redeemed     │
│    2026-05-07 22:44:01 UTC       │
│                                  │
│ ... (6 more codes)               │
└──────────────────────────────────┘
```

**Error Responses**:

```
# No Credentials Set Up
┌────────────────────────────────┐
│ ❌ Not Set Up                  │
│ Please run /setup first        │
└────────────────────────────────┘

# No Code History
┌────────────────────────────────┐
│ 📭 No Codes Yet                │
│ Redeem your first code with    │
│ /redeem or message with codes  │
└────────────────────────────────┘
```

**Data Returned** (per code):
- Code string
- Redemption status (✅ Success, ❌ Already Used, ⚠️ Failed)
- Timestamp (ISO 8601)
- Ordered by most recent first

---

### 7. `/makepublic`

Share one of your redeemed codes with other users in the channel.

**Invocation**:
```
/makepublic code:<code>
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Code you've previously redeemed |

**Response Format**:

**Success Response** (Public Message in Channel):
```
💎 @User shared a code:
Code: IDLE2024

[Other users can now use this code]
```

**Error Responses**:

```
# Code Not in Your History
┌────────────────────────────────┐
│ ❌ Code Not Found              │
│ Code: UNKNOWN                  │
│ Must have redeemed this code   │
│ previously                     │
└────────────────────────────────┘

# Code Already Shared
┌────────────────────────────────┐
│ ℹ️ Already Shared              │
│ This code was already shared   │
└────────────────────────────────┘
```

**Visibility**:
- Message posted in monitored channel
- Visible to all server members
- Code formatted for easy copying

---

### 8. `/backfill`

Scan message history to recover codes from the past N days.

**Invocation**:
```
/backfill [days:<number>] [channel:<channel>]
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | integer | No | Number of days to backfill (1-90, default: 30) |
| `channel` | channel | No | Channel to scan (default: current channel) |

**Response Format** (Public Embed):

**Initial Response**:
```
┌──────────────────────────────────┐
│ 🔄 Backfill Started              │
│                                  │
│ Scanning: #codes                 │
│ Time Range: Last 30 days         │
│ Status: In Progress              │
│                                  │
│ Updates will appear below        │
└──────────────────────────────────┘
```

**Progress Updates** (every 100 messages):
```
📊 Scanned: 500 messages
Found: 8 codes
Redeemed: 7 codes
Already Used: 1 code
```

**Final Response**:
```
┌──────────────────────────────────┐
│ ✅ Backfill Complete             │
│                                  │
│ Messages Scanned: 1,500          │
│ Codes Found: 42                  │
│ Successfully Redeemed: 38        │
│ Already Used: 4                  │
│ Failed: 0                        │
│                                  │
│ Time Duration: 12 minutes        │
│ Completed: 2026-05-10 15:45:00  │
└──────────────────────────────────┘
```

**Error Responses**:

| Error | Cause | Resolution |
|-------|-------|-----------|
| `BACKFILL_ALREADY_RUNNING` | Another backfill in progress | Wait for current to finish |
| `CHANNEL_NOT_FOUND` | Channel ID invalid | Use accessible channel |
| `NO_PERMISSIONS` | Bot can't read channel | Add read permissions |
| `INVALID_DAYS` | Days out of range | Use 1-90 |
| `NO_CREDENTIALS` | Not set up | Run `/setup` first |

**Rate Limiting**:
- Maximum 1 backfill per guild at a time
- Respects Discord API rate limits (100 messages/request)
- Respects Idle Champions API rate limits (~100ms between requests)
- Estimated speed: 50-100 messages/minute

---

### 9. `/help`

Display command reference and usage instructions.

**Invocation**:
```
/help
```

**Parameters**: None

**Response Format** (Public Embed):

```
┌──────────────────────────────────────────────┐
│ 📖 Idle Champions Code Redeemer Bot Help    │
├──────────────────────────────────────────────┤
│ **Setup**                                    │
│ /setup user_id:<id> user_hash:<hash>        │
│   Store your game credentials                │
│                                              │
│ **Redemption**                               │
│ /redeem code:<code>                         │
│   Redeem a single code manually              │
│ /codes [count:<num>]                        │
│   Show your redeemed code history            │
│ /makepublic code:<code>                     │
│   Share a code with other users              │
│                                              │
│ **Game Interaction**                         │
│ /inventory                                   │
│   View your account status                   │
│ /open chest_type:<type> count:<num>         │
│   Open chests for rewards                    │
│ /blacksmith contract_type:<type> ...        │
│   Upgrade your heroes                        │
│                                              │
│ **Utilities**                                │
│ /backfill [days:<num>]                      │
│   Recover codes from message history         │
│ /help                                        │
│   Show this message                          │
│                                              │
│ **Auto Features**                            │
│ The bot automatically:                       │
│ • Scans messages for codes (detects pattern)│
│ • Redeems codes for your account             │
│ • Tracks code history                        │
│ • Updates every 5 minutes                    │
│                                              │
│ Questions? See /help for details             │
└──────────────────────────────────────────────┘
```

---

## Part 2: Message Event API

### Event Type: Message Code Detection

The bot automatically scans all messages in the monitored channel for promo codes.

**Trigger**: Message posted in monitored Discord channel

**Pattern Matching**: Regular expression matching 4-20 alphanumeric character sequences

**Detection Pattern**:
```regex
\b([A-Z0-9]{4,20})\b
```

Matches:
- `IDLE2024` ✅
- `CHAMPIONS500` ✅
- `PROMO100` ✅

Does NOT match:
- `ABC` (too short, <4 chars) ❌
- `ABC-123` (contains hyphen) ❌
- `abc123` (all lowercase, needs validation per API) ⚠️

**Detection Behavior**:

```
Message Posted: "Free code: IDLE2024"
                        ↓
Bot scans message content
                        ↓
Pattern matches: IDLE2024
                        ↓
Retrieves message author credentials
                        ↓
Calls API: redeemCoupon(IDLE2024)
                        ↓
Records result in database
                        ↓
Silent success (no channel message)
or error logged to debug
```

**Response Behavior**:
- **Success**: Silent (no response message)
- **Already Used**: Silent (logs to database)
- **API Error**: Silent (logs error, continues scanning)
- **Not Found**: Silent (code not in history)

**Data Recorded** (per detected code):
```typescript
interface CodeDetectionRecord {
  code: string;
  message_id: string;
  channel_id: string;
  author_id: string;
  detection_timestamp: ISO8601_timestamp;
  redemption_attempt: boolean;
  redemption_result: "Success" | "Already Used" | "API Error" | "No Match";
  api_response: object;
}
```

**Example Flow**:
```
Channel: #codes

User A: "Use this: SPECIAL100"
Bot (internal): Detected SPECIAL100, redeemed, recorded ✓

User B: "Check IDLE2024 out"
Bot (internal): Detected IDLE2024, redeemed, recorded ✓

User C: "IDLE2024 again?"
Bot (internal): Detected IDLE2024, already used, recorded ✓
```

---

## Part 3: Response Data Structures

### Embed Response Format

All command responses use Discord Embed format with consistent styling:

```typescript
interface DiscordEmbed {
  title: string;
  description?: string;
  color: integer;  // RGB as integer (0xFF0000 for red, 0x00FF00 for green)
  fields: Array<{
    name: string;
    value: string;
    inline: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: ISO8601_timestamp;
}
```

**Color Scheme**:
- 🟢 Green (0x00AA00) - Success responses
- 🔴 Red (0xAA0000) - Error responses
- 🟡 Yellow (0xAAAA00) - Warning responses
- 🔵 Blue (0x0000AA) - Information responses

### Error Response Schema

```typescript
interface ErrorResponse {
  error_code: string;
  error_message: string;
  suggestions?: string[];
  timestamp: ISO8601_timestamp;
}
```

**Common Error Codes**:
- `NO_CREDENTIALS` - User hasn't run `/setup`
- `INVALID_PARAMETERS` - Wrong parameter format
- `API_TIMEOUT` - External API slow/down
- `RATE_LIMITED` - Too many requests
- `DATABASE_ERROR` - Local storage issue
- `PERMISSION_DENIED` - User lacks permission

### Success Response Schema

```typescript
interface SuccessResponse {
  status: "success";
  operation: string;
  data: object;
  timestamp: ISO8601_timestamp;
}
```

---

## Part 4: Rate Limiting & Throttling

### Discord Rate Limits (Built-in by Discord)

The Discord API enforces global rate limits:
- **Per-guild limits**: Commands processed sequentially per guild
- **Global limit**: 50 requests/second across all bots
- **Response**: HTTP 429 with Retry-After header

The bot respects these automatically via discord.js library.

### Idle Champions API Rate Limits

External Idle Champions API enforces per-user limits:
- **Per-user limit**: ~1 request per 100ms recommended
- **Burst limit**: Up to 5 requests within 1 second
- **Ban duration**: 5 minutes if exceeded

The bot implements:
```typescript
// Minimum 100ms between requests
await delay(100);

// Exponential backoff on 429 response
retry_delay = 100ms * (2 ^ attempt_count)
```

### Application-Level Throttling

The bot implements request throttling:

| Operation | Max Frequency | Throttle Window |
|-----------|---------------|-----------------|
| `/setup` | Unlimited | Per user |
| `/redeem` | 1 per 2 seconds | Per user |
| `/inventory` | 1 per 5 seconds | Per user |
| `/open` | 1 per 3 seconds | Per user |
| `/blacksmith` | 1 per 3 seconds | Per user |
| `/backfill` | 1 concurrent | Per guild |
| Code detection | Per message | Automatic |

---

## Part 5: Error Handling & Recovery

### Transient Errors (Retryable)

The bot automatically retries on these errors:

```
TIMEOUT (>30 seconds)
  → Retry up to 3 times with exponential backoff
  → Final delay: 100ms × 2³ = 800ms

HTTP 429 (Rate Limited)
  → Wait for Retry-After header
  → Max 5 retries with exponential backoff

HTTP 5XX (Server Error)
  → Retry up to 3 times with exponential backoff
  → 500ms base delay

Connection Errors
  → Retry up to 3 times
  → 100ms base delay
```

### Permanent Errors (No Retry)

These errors fail immediately without retry:

```
HTTP 400 (Bad Request)
  → Invalid parameters - user error

HTTP 401 (Unauthorized)
  → Invalid credentials - user must re-run /setup

HTTP 403 (Forbidden)
  → Permission denied - account restricted

HTTP 404 (Not Found)
  → Resource doesn't exist - invalid code/hero

Custom Validation Errors
  → Invalid format - user input error
```

### Error Reporting

Errors are reported to the user via Discord message:

```
❌ Error Occurred
Error Type: API_TIMEOUT
Message: Idle Champions server not responding
Suggestion: Try again in a moment
Status: This is a temporary issue
Time: 2026-05-10 15:30:45 UTC
```

---

## Part 6: Authentication & Security

### User Authentication

Users authenticate by storing credentials via `/setup`:

```typescript
interface UserCredentials {
  discord_id: string;           // Discord snowflake
  user_id: string;              // Idle Champions user ID
  user_hash: string;            // Idle Champions API hash
  stored_at: ISO8601_timestamp;
}
```

**Security Properties**:
- Credentials stored locally in SQLite database
- Encrypted at rest via OS file permissions
- No credentials logged to console
- No credentials sent in Discord messages
- Ephemeral responses for sensitive operations

### API Authentication

The bot authenticates to the Idle Champions API with query parameters:

```
https://idledragons.com/~idledragons/post.php
  ?call=redeemcoupon
  &user_id=316463
  &hash=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
  &instance_id=xyz123abc456
  &code=IDLE2024
```

**Security Properties**:
- HTTPS/TLS for transport (certificate validation disabled - known issue)
- Per-request instance_id for CSRF protection
- User credentials never transmitted to Discord servers
- API responses include game state, not credentials

---

## Part 7: Backward Compatibility & Breaking Changes

### Version 1.0+ API Stability

This API is stable as of version 1.0.0 (May 2026).

### Breaking Changes Tracking

No breaking changes have been made to the API since release.

### Planned Future Changes

The following changes are NOT breaking and are backwards compatible:
- Adding new optional command parameters
- Adding new optional fields to responses
- Increasing rate limits or changing throttle windows
- Adding new error codes

### Deprecation Policy

Commands will be deprecated with:
1. 1 major version notice in documentation
2. Command still functions (with warning)
3. Next major version: Command removed

---

## Part 8: Usage Examples

### Example 1: Setup and First Redemption

```bash
# User opens Idle Champions game, finds credentials
# User ID: 316463
# Hash: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Step 1: Store credentials
/setup user_id:316463 user_hash:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Bot: ✅ Setup Complete - Credentials saved

# Step 2: Redeem a code
/redeem code:IDLE2024
Bot (embed):
┌──────────────────────┐
│ ✅ Code Redeemed    │
│ Code: IDLE2024       │
│ Rewards:             │
│  Gold: +1,234,567   │
│  Rubies: +50         │
│ Time: 2026-05-10 ..  │
└──────────────────────┘

# Step 3: Check inventory
/inventory
Bot (embed): Shows current account status

# Step 4: Open some chests
/open chest_type:SAPPHIRE count:5
Bot (embed): Shows chest contents and rewards

# Step 5: View redemption history
/codes count:20
Bot (embed): Shows last 20 redeemed codes
```

### Example 2: Automatic Code Detection

```
Channel: #codes

User A: "New code released! CHAMPIONS100"
Bot: [Detects CHAMPIONS100, redeems silently]

User B: "Use SPECIAL50 too"
Bot: [Detects SPECIAL50, redeems silently]

User C: "IDLE2024 is active"
Bot: [Detects IDLE2024, redeems silently]

User D: "/codes"
Bot (embed):
┌────────────────────────────────┐
│ 📋 Your Redeemed Codes (10)    │
│ 1. CHAMPIONS100  ✅ 2026-05-10│
│ 2. SPECIAL50     ✅ 2026-05-10│
│ 3. IDLE2024      ✅ 2026-05-10│
│ ... (7 more)                  │
└────────────────────────────────┘
```

### Example 3: Error Handling

```
# User tries without credentials
/redeem code:IDLE2024
Bot (embed):
┌──────────────────────┐
│ ❌ Not Set Up       │
│ Run /setup first    │
│ with your:          │
│  - user_id          │
│  - user_hash        │
└──────────────────────┘

# User provides wrong code format
/redeem code:INVALID@#$
Bot (embed):
┌──────────────────────────┐
│ ❌ Invalid Code Format  │
│ Code: INVALID@#$        │
│ Use only letters/numbers│
│ Length: 4-20 chars      │
└──────────────────────────┘

# API timeout
/inventory
Bot (embed):
┌──────────────────────┐
│ ❌ API Error        │
│ Error: Timeout      │
│ Suggestion: Retry   │
│ Try again in 10 sec │
└──────────────────────┘
```

---

## Part 9: Related Documentation

- [System Design](system-design.md) - Architecture and actors
- [Development Guide](development.md) - Building and extending
- [Full Documentation](full-documentation.md) - User guide
- [Security Policy](../SECURITY.md) - Data handling
- [CONTRIBUTING.md](../CONTRIBUTING.md) - API changes procedures

---

## OSPS-SA-02.01 Compliance

✅ **Software Interfaces Documented**:
- 9 slash commands with parameters, responses, error codes
- Message event detection with pattern matching
- Response formats and data structures
- Error handling and recovery procedures
- Rate limiting and throttling
- Authentication and security
- Backward compatibility
- Usage examples

✅ **Expected Data**:
- Input parameters for each command
- Response formats (embeds, ephemeral, public)
- Error responses with codes
- Data structures returned

✅ **User Interaction**:
- How to use each command
- What responses to expect
- How to handle errors
- Examples of each operation

✅ **Updated for Features**:
- All 9 active commands documented
- All message handler features documented
- Breaking changes tracking system
- Version history

---

**API Version**: 1.0.0 (Stable, May 2026)
**Last Updated**: 2026-05-10
**Status**: Production Ready ✅
