# Idle Champions Code Redeemer Bot

A Discord bot that automatically scans for and redeems Idle Champions promo codes.

**📖 Quick Links to Documentation:**

- **[Full README](docs/README.md)** - Main documentation & all features
- **[Development Guide](docs/DEVELOPMENT.md)** - Setup, architecture & tech stack
- **[Project Structure](docs/STRUCTURE.md)** - Directory layout & key files
- **[Mise Setup Guide](docs/MISE.md)** - Tool management reference

## 🚀 Quick Start (5 minutes)

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
