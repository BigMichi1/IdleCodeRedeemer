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
mise run install      # Install dependencies
mise run dev          # Run bot in dev mode (with TypeScript support)
mise run build        # Build TypeScript to JavaScript
mise run watch        # Watch & rebuild on file changes
mise run start        # Run production bot
```

### Docker

```bash
mise run docker-build     # Build Docker image
mise run docker-up        # Start with docker-compose
mise run docker-down      # Stop containers
mise run docker-logs      # View logs
mise run docker-restart   # Restart bot
```

### Maintenance

```bash
mise run lint         # Check for syntax errors
mise run audit        # Check for vulnerabilities
mise run update       # Update all dependencies
mise run clean        # Remove build artifacts
```

### Help

```bash
mise run help         # Show all tasks
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
brew install direnv  # or apt-get install direnv

# Setup direnv hook in your shell
# Add this to ~/.zshrc or ~/.bashrc:
eval "$(direnv hook zsh)"  # or bash

# Allow direnv in this project
direnv allow
```

Now when you `cd` into the project, tools and environment variables load automatically!

## .mise.toml Structure

### Tools Section

```toml
[tools]
bun = "1.0"      # Latest 1.x version
node = "20"      # Latest 20.x version
```

### Tasks Section

```toml
[tasks.dev]
description = "Run bot in development"
run = "bun run dev"
env = { NODE_ENV = "development" }
```

**Task Features:**
- `description` - What the task does
- `run` - Command to execute (shell command)
- `depends` - Other tasks this depends on
- `env` - Environment variables for this task
- `dir` - Working directory

## Common Workflows

### Fresh Setup (New Developer)

```bash
# 1. Clone repo
git clone <repo> idle-code-redeemer
cd idle-code-redeemer

# 2. Install Mise
curl https://mise.jdx.dev/install.sh | sh

# 3. Install project tools
mise install

# 4. Complete setup
mise run setup

# 5. Start developing
mise run dev
```

### Daily Development

```bash
# In project directory, everything is ready
mise run dev

# Or just cd in if using direnv
cd /path/to/codebot
# Tools auto-load!
bun run dev
```

### Deploy to Production

```bash
# Build locally
mise run build

# Deploy with Docker
mise run docker-build
mise run docker-up

# Check logs
mise run docker-logs
```

## Team Collaboration

Benefits of Mise for teams:

1. **Consistency** - Everyone uses exact same tool versions
2. **No Setup Guides** - Just `mise install` and go
3. **Clear Tasks** - Common commands in `.mise.toml`
4. **Easy Onboarding** - New devs run 3 commands and start coding

## Troubleshooting

### Issue: "mise: command not found"

```bash
# Ensure Mise is in your PATH
export PATH="$HOME/.local/bin:$PATH"

# Add to ~/.zshrc or ~/.bashrc permanently
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Issue: Tools not found after installation

```bash
# Activate Mise in current shell
eval "$(mise activate)"

# Or start a new shell
bash
```

### Issue: Task not working

```bash
# List available tasks
mise tasks

# Run with verbose output
mise run task-name --verbose

# Check tool versions
mise versions
```

## Advanced Usage

### Custom Environment Variables

Edit `.mise.toml`:

```toml
[env]
NODE_ENV = "development"
DB_PATH = "./data/idle.db"
```

### Task Dependencies

```toml
[tasks.deploy]
description = "Build and deploy"
depends = ["build", "docker-build"]
run = "docker-compose up -d"
```

### Conditional Task Execution

```toml
[tasks.test]
description = "Run tests"
run = "bun test"
# Only run if test directory exists
#dir = "./tests"
```

## Integration with IDE

### VS Code

1. Install [direnv extension](https://marketplace.visualstudio.com/items?itemName=mkhl.direnv)
2. Add to `.vscode/settings.json`:

```json
{
  "direnv.enable": true,
  "terminal.integrated.shellArgs.linux": [],
  "terminal.integrated.shellArgs.osx": []
}
```

### Other IDEs

Mise works with any IDE that supports direnv or custom shell configurations.

## References

- [Mise Official Documentation](https://mise.jdx.dev)
- [Mise Tasks Guide](https://mise.jdx.dev/tasks/)
- [Mise Environment Setup](https://mise.jdx.dev/environments/)
- [direnv Documentation](https://direnv.net)

## Quick Reference

```bash
# Setup
curl https://mise.jdx.dev/install.sh | sh
mise install

# Development
mise run dev

# Docker
mise run docker-up
mise run docker-logs
mise run docker-down

# Tasks
mise tasks          # List all
mise run <task>     # Run task
mise run help       # Show all

# Tools
mise versions       # Show installed versions
mise install        # Install from .mise.toml
mise update         # Update tools
```

That's it! You're ready to develop. 🚀
