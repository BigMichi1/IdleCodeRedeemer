# Mise Setup Guide

Mise is a polyglot version manager and task runner that makes development setup easier and more consistent across team members.

## What is Mise?

Mise:

- 🔧 Manages multiple language runtimes (Bun, Node.js, Python, etc.)
- 📋 Defines development tasks in `.mise.toml`
- 📦 Ensures everyone has the same tool versions
- ⚡ Fast and lightweight
- 🤝 Works with `direnv` for automatic environment setup

## Installation

### macOS / Linux

```bash
curl https://mise.jdx.dev/install.sh | sh
```

### macOS (Homebrew)

```bash
brew install mise
```

### Verify Installation

```bash
mise --version
```

## Project Setup

Once you have Mise installed, the project is fully configured via `.mise.toml`:

### Step 1: Install Tools

```bash
cd /home/bigmichi1/projects/codebot
mise install
```

This will:

- ✅ Install Bun 1.0
- ✅ Install Node.js 20 (as fallback)
- ✅ Set up the environment

### Step 2: Run Any Task

```bash
# View all available tasks
mise tasks

# Install dependencies
mise run install

# Start development
mise run dev

# Build the project
mise run build

# Start bot with Docker
mise run docker-up
```

## Available Tasks

### Development

```bash
mise run install # Install dependencies
mise run dev     # Run bot in dev mode (with TypeScript support)
mise run build   # Build TypeScript to JavaScript
mise run watch   # Watch & rebuild on file changes
mise run start   # Run production bot
```

### Docker

```bash
mise run docker-build   # Build Docker image
mise run docker-up      # Start with docker-compose
mise run docker-down    # Stop containers
mise run docker-logs    # View logs
mise run docker-restart # Restart bot
```

### Maintenance

```bash
mise run lint     # Check code quality with ESLint
mise run lint:fix # Auto-fix ESLint issues
mise run audit    # Check for vulnerabilities
mise run update   # Update all dependencies
mise run clean    # Remove build artifacts
```

### Help

```bash
mise run help # Show all tasks
```

## Manual Commands

If you prefer not to use Mise tasks, you can still run everything manually:

```bash
# Activate tools manually
eval "$(mise activate)"

# Then use bun/node directly
bun install
bun run dev

# Or use npm if you prefer
npm install
npm run dev
```

## Environment Setup (Optional: direnv)

Mise integrates with `direnv` for automatic environment loading:

```bash
# Install direnv
brew install direnv # or apt-get install direnv

# Setup direnv hook in your shell
# Add this to ~/.zshrc or ~/.bashrc:
eval "$(direnv hook zsh)" # or bash

# Allow direnv in this project
direnv allow
```

Now when you `cd` into the project, tools and environment variables load automatically!

## .mise.toml Structure

### Tools Section

```toml
[tools]
bun = "1.0" # Latest 1.x version
node = "20" # Latest 20.x version
```

## Troubleshooting

**Mise command not found?**

```bash
# Add to ~/.zshrc or ~/.bashrc and reload shell
export PATH="$HOME/.local/bin:$PATH"
```

**Tools not installed?**

```bash
mise install
mise cache clean # Clear cache if issues persist
```

**Environment not loading?**

```bash
eval "$(mise activate)"
```

## References

- [Mise Documentation](https://mise.jdx.dev/)
- [.mise.toml Configuration](https://mise.jdx.dev/config.html)
