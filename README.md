# Idle Champions Code Redeemer Bot

A Discord bot that automatically scans for and redeems Idle Champions promo codes.

**📖 Quick Links to Documentation:**

- **[Full README](docs/README.md)** - Main documentation & all features
- **[Development Guide](docs/DEVELOPMENT.md)** - Setup, architecture & tech stack
- **[Project Structure](docs/STRUCTURE.md)** - Directory layout & key files
- **[Mise Setup Guide](docs/MISE.md)** - Tool management reference

## 🚀 Quick Start (5 minutes)

### Development (Local)

```bash
# 1. Install dependencies
mise run install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and server IDs

# 3. Start the bot
mise run dev
```

**Don't have Mise?** [Install it first](https://mise.jdx.dev/getting-started.html)

```bash
# macOS/Linux
curl https://mise.jdx.dev/install.sh | sh

# Or with Homebrew
brew install mise
```

### 🐳 Docker Deployment

Deploy the bot using the pre-built Docker image:

```bash
# 1. Copy the example compose file
cp docker-compose.example.yml docker-compose.yml

# 2. Set your Discord token
export DISCORD_TOKEN=your_bot_token_here

# 3. Start the bot
docker-compose up -d
```

See [docker-compose.example.yml](docker-compose.example.yml) for all available configuration options.

**Pull specific versions:**

- `ghcr.io/bigmichi1/IdleCodeRedeemer:latest` - Latest main branch build
- `ghcr.io/bigmichi1/IdleCodeRedeemer:v1.0.0` - Specific release
- `ghcr.io/bigmichi1/IdleCodeRedeemer:main-<sha>` - Specific commit

## ✨ Features

- 🤖 **Slash Commands** - `/setup`, `/redeem`, `/inventory`, `/open`, `/blacksmith`, `/codes`, `/makepublic`, `/redeempublic`, `/help`
- 🔄 **Auto Code Detection** - Scans Discord messages for codes automatically
- 🎁 **Code Redemption** - Submit codes and get rewards
- 📦 **Chest Management** - Open chests and view loot
- ⚒️ **Blacksmith** - Upgrade heroes with contracts
- 📊 **Inventory** - View gold, rubies, equipment, and progress
- 💾 **Secure Storage** - SQLite database keeps credentials safe and local
- 👥 **Multi-User** - Each user manages their own account
- ⚡ **Fast** - Built on Bun for 3-4x performance vs Node.js
- 🔄 **Auto Code Detection** - Scans Discord messages for codes automatically
- 🎁 **Code Redemption** - Submit codes and get rewards
- 📦 **Chest Management** - Open chests and view loot
- ⚒️ **Blacksmith** - Upgrade heroes with contracts
- 📊 **Inventory** - View gold, rubies, equipment, and progress
- 💾 **Secure Storage** - SQLite database keeps credentials safe and local
- 👥 **Multi-User** - Each user manages their own account
- ⚡ **Fast** - Built on Bun for 3-4x performance vs Node.js

## 📚 Full Documentation

For detailed information, please see:

- **[Full README](docs/README.md)** - All features, commands, architecture & troubleshooting
- **[Development Guide](docs/DEVELOPMENT.md)** - Development setup, structure & debugging
- **[Project Structure](docs/STRUCTURE.md)** - Complete directory layout & key files
- **[Mise Setup Guide](docs/MISE.md)** - Tool management & available tasks

## 📄 License

See [LICENSE](LICENSE) file
