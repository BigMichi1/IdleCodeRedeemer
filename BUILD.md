# Build Instructions

This document provides comprehensive instructions on how to build the Idle Champions Code Redeemer Bot from source, including all required libraries, frameworks, SDKs, and dependencies. [OSPS-DO-07.01]

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Building](#building)
- [Build Types](#build-types)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

The project requires the following software to be installed:

#### 1. **Mise** (Required - Task Runner)

Mise manages tool versions and automates build tasks.

```bash
# Linux/macOS
curl https://mise.jdx.dev/install.sh | sh

# OR with Homebrew (macOS)
brew install mise

# Verify installation
mise --version # Should be 2025.1+
```

**Why Mise?**: Automatically installs and manages Bun, Node.js, and other tools. Ensures consistent build environment across developers.

#### 2. **Bun** (Managed by Mise - Runtime)

Bun is installed and managed automatically by Mise. No manual installation required.

```bash
# Mise will install Bun automatically
mise run install

# Verify Bun works
bun --version # Should be 1.3.13+
```

**Why Bun?**: 3-4x faster JavaScript runtime than Node.js. Official package manager for this project.

#### 3. **Git** (Required - Version Control)

Git is needed to clone the repository.

```bash
# macOS
brew install git

# Linux (Ubuntu/Debian)
sudo apt-get install git

# Linux (Fedora/RHEL)
sudo dnf install git

# Verify installation
git --version # Should be 2.0+
```

#### 4. **Docker** (Optional - For Container Builds)

Docker is optional but recommended for production builds and deployments.

```bash
# Install Docker Desktop or Docker Engine
# macOS: https://docs.docker.com/desktop/install/mac-install/
# Linux: https://docs.docker.com/engine/install/
# Windows: https://docs.docker.com/desktop/install/windows-install/

# Verify installation
docker --version         # Should be 20.10+
docker-compose --version # Should be 1.29+
```

### Required Frameworks & Libraries

These are automatically installed as dependencies via Bun:

#### Production Dependencies

| Package          | Version | Purpose                              |
| ---------------- | ------- | ------------------------------------ |
| **discord.js**   | 14.26.4 | Discord bot framework                |
| **drizzle-orm**  | 0.45.2  | Type-safe ORM for SQLite             |
| **winston**      | 3.19.0  | Logging framework                    |

> **Note:** `dotenv`, `node-fetch`, and `sqlite3` were removed. Bun loads `.env` files natively, provides a built-in Fetch API, and includes `bun:sqlite` as a first-party module.

#### Development Dependencies

| Package          | Purpose                           |
| ---------------- | --------------------------------- |
| **typescript**   | TypeScript compiler (type-check)  |
| **@types/bun**   | Bun type definitions              |
| **eslint**       | Code quality linter               |
| **prettier**     | Code formatter                    |
| **drizzle-kit**  | Schema management & migrations    |
| **husky**        | Git hooks                         |
| **commitlint**   | Commit message validation         |
| **lint-staged**  | Pre-commit linting                |

> **Note:** `esbuild` was removed. The production build now uses `bun build --compile` which produces a self-contained native executable.

All dependencies are defined in `package.json` and locked in `bun.lock` for reproducible builds.

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/BigMichi1/idle-code-redeemer.git
cd idle-code-redeemer
```

### Step 2: Install Mise (if not already installed)

```bash
curl https://mise.jdx.dev/install.sh | sh

# Add Mise to your shell (follow the installer's instructions)
# Usually: add to ~/.bashrc, ~/.zshrc, etc.
```

### Step 3: Set Up Build Environment

```bash
# Mise automatically installs configured tools (Bun, Node.js)
mise trust # Trust the .mise.toml configuration

# Install all dependencies
mise run install
```

This will:

1. ✅ Install Bun 1.3.13 (if not present)
2. ✅ Install Gitleaks 8.30.1 (secret scanning)
3. ✅ Install all dependencies (production + development)
4. ✅ Create `node_modules/` directory
5. ✅ Generate `bun.lock` (lock file)

### Step 4: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# At minimum, set:
# - DISCORD_TOKEN=your_bot_token
# - DB_PATH=./data/idle.db (optional)
```

See [.env.example](.env.example) for all available configuration options.

## Building

### View Available Build Tasks

```bash
# List all available Mise tasks
mise tasks
```

Output shows all available commands like `install`, `dev`, `build`, `watch`, `lint`, etc.

### Development Build (Type Check Only)

**Purpose**: TypeScript is not compiled to JavaScript for development — the bot runs directly from `.ts` source via Bun. `tsc` is type-check only (`noEmit: true`).

```bash
# Type-check only (no output files)
mise run typecheck  # alias for: bun run typecheck

# Run bot directly from TypeScript source
mise run dev
```

**Output**:

- No compiled output files (Bun runs TypeScript natively)
- Type errors reported to console

### Production Build

**Purpose**: Compile the bot into a self-contained native binary using `bun build --compile --bytecode --minify --sourcemap`. The resulting binary embeds the Bun runtime — no Bun, Node.js, or `node_modules` needed at runtime.

```bash
# Build self-contained production binary
mise run prod:build
```

**Output**:

- Self-contained native executable: `dist-bundle/bot`
- Embeds Bun runtime, all source code, and dependencies
- Optimized for Docker and bare-metal deployment

**Files Generated**:

```
dist-bundle/
└── bot                 # Self-contained ELF binary (Linux) / executable
```

### Development Server

**Purpose**: Run bot in development mode with TypeScript support and auto-restart.

```bash
mise run dev
```

This runs:

1. TypeScript compiler in watch mode
2. Discord bot with auto-restart on file changes
3. Full debugging support

**Requirements**:

- `.env` file configured with DISCORD_TOKEN
- Discord bot application created (https://discord.com/developers)

### Running the Bot

After building, run the bot:

```bash
# Start production binary
mise run prod:start

# OR via Mise start task
mise run start

# OR directly (no Bun needed at runtime)
./dist-bundle/bot
```

## Build Types

### 1. Local Development Build

**When to use**: During feature development, debugging, testing

```bash
# Install dependencies
mise run install

# Run bot directly from TypeScript source (no compile step needed)
mise run dev

# Type-check only (no output files)
mise run build
```

**Characteristics**:

- Bun runs TypeScript natively — no compilation step required for development
- `tsc` used for type-checking only (`noEmit: true`)
- Automatic restart on file changes via `bun --watch`
- Good for development

### 2. Production Build

**When to use**: Before creating a release, building Docker image

```bash
# Install dependencies (includes dev deps for type-checking and drizzle-kit)
mise run install

# Production-optimized binary
mise run prod:build

# Run the bot
./dist-bundle/bot
```

**Characteristics**:

- Self-contained ELF binary with embedded Bun runtime
- Minified and bytecode-compiled
- No Bun, Node.js, or `node_modules` required at runtime
- Smaller deployment footprint
- Good for Docker images and bare-metal servers

### 3. Docker Container Build

**When to use**: Creating deployable Docker image

```bash
# Build Docker image
docker build -t idle-code-redeemer:latest .

# OR using Mise task
mise run docker-build

# Run container
docker run -e DISCORD_TOKEN=your_token idle-code-redeemer:latest

# OR with Docker Compose
mise run docker-up
docker logs -f idle-code-redeemer
```

**Dockerfile**:

- Multi-stage build (builder + production)
- Builder stage: Bun compile → self-contained binary
- Production stage: Only the binary + `ca-certificates` (no Bun/Node/npm)
- Frozen dependency lock file for reproducibility

See [Dockerfile](Dockerfile) for details.

## Building from Source - Step by Step

### Complete Build Example

```bash
# 1. Clone repository
git clone https://github.com/BigMichi1/idle-code-redeemer.git
cd idle-code-redeemer

# 2. Set up Mise
curl https://mise.jdx.dev/install.sh | sh
# (Follow installer instructions to add to shell)

# 3. Verify Mise installation
mise --version

# 4. Install tools and dependencies
mise trust
mise run install

# 5. Configure environment
cp .env.example .env
# Edit .env with your DISCORD_TOKEN

# 6. Type-check the project
mise run build

# 7. Build production binary
mise run prod:build

# 8. Verify binary was created
ls -la dist-bundle/bot

# 9. Run the bot
./dist-bundle/bot
```

## Linting & Code Quality

### Check Code Quality

```bash
# Run ESLint to check for issues
mise run lint

# Automatically fix issues
mise run lint:fix

# Check formatting
mise run format:check

# Auto-format code
mise run format
```

### Git Hooks (Pre-commit Checks)

Husky automatically runs checks before commits:

```bash
# Installed automatically with: mise run install
# Checks:
# 1. Secret scanning (Gitleaks)
# 2. ESLint linting
# 3. Prettier formatting
# 4. Commitlint validation

# If a check fails, fix the issue and try again
mise run lint:fix
git add .
git commit -m "type(scope): message"
```

## Auditing Dependencies

### Check for Vulnerabilities

```bash
# Audit dependencies for known vulnerabilities
mise run audit

# Update vulnerable dependencies
mise run update
```

**Output**:

- Lists all known vulnerabilities
- Severity levels (critical, high, medium, low)
- Recommended actions

## Cleaning Build Artifacts

### Remove Build Output

```bash
# Clean all build artifacts
mise run clean

# This removes:
# - dist/ directory
# - dist-bundle/ directory
# - node_modules/ directory

# Rebuilding after clean
mise run install && mise run prod:build
```

## Troubleshooting

### Issue: "Mise command not found"

**Solution**: Mise not installed or not in PATH

```bash
# Install Mise
curl https://mise.jdx.dev/install.sh | sh

# Add to shell (usually automatic, but check)
# For Bash: add to ~/.bashrc
# For Zsh: add to ~/.zshrc
# For Fish: add to ~/.config/fish/config.fish

# Reload shell
exec $SHELL

# Verify
mise --version
```

### Issue: "bun: command not found"

**Solution**: Bun not installed or installed by Mise but not in PATH

```bash
# Mise should handle this automatically
# Try refreshing Mise
mise install

# Or run through Mise
mise run build
```

### Issue: "Cannot find module 'discord.js'"

**Solution**: Dependencies not installed

```bash
# Install dependencies
mise run install

# Verify installation
ls -la node_modules/discord.js

# If still failing, clean and reinstall
mise run clean
mise run install
```

### Issue: Build fails with TypeScript errors

**Solution**: TypeScript compilation error

```bash
# Check for errors
mise run build

# Fix errors indicated by compiler
# Common issues:
# - Missing type imports: import type { X } from 'y'
# - Incorrect types: check parameter types
# - Undefined variables: ensure imports

# Re-run build
mise run build
```

### Issue: "DISCORD_TOKEN not set"

**Solution**: Environment variable not configured

```bash
# Check .env file exists
ls -la .env

# Verify contents
cat .env | grep DISCORD_TOKEN

# If missing or empty:
cp .env.example .env
# Edit .env and add your token
```

### Issue: "SSL certificate problem" when running bot

**Solution**: Game API has expired SSL certificate (known issue)

The code handles this automatically with:

```typescript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

This is set before any HTTPS requests. If you still see SSL errors:

1. Verify you're using Bun or Node.js 24+
2. Check that NODE_TLS_REJECT_UNAUTHORIZED is set
3. See [.instructions.md](.instructions.md#critical-project-constraints) for details

### Issue: Docker build fails

**Solution**: Docker dependencies or Dockerfile issue

```bash
# Build with verbose output
docker build -t idle-code-redeemer . --progress=plain

# Check Dockerfile for issues
cat Dockerfile | grep -E "^RUN|^COPY"

# Ensure .mise.toml is valid
mise validate

# Try building directly with mise
mise run prod:build
```

### Issue: Git hooks not running

**Solution**: Husky not initialized

```bash
# Reinstall Husky hooks
bun run prepare

# Or reinstall all dependencies
mise run install

# Verify hooks exist
ls -la .husky/
```

## Additional Resources

- **[Development Guide](docs/development.md)** - Architecture and database schema
- **[Dependency Management](docs/dependency-management.md)** - How dependencies are managed
- **[.instructions.md](.instructions.md)** - Project constraints and patterns
- **[Mise Documentation](https://mise.jdx.dev/)** - Mise task runner
- **[Bun Documentation](https://bun.sh/)** - Bun runtime and package manager
- **[Discord.js Guide](https://discord.js.org/#/docs/main/stable/general/welcome)** - Bot framework

## Getting Help

If you encounter issues building:

1. Check this BUILD.md file
2. See [Troubleshooting](#troubleshooting) section above
3. Check [.instructions.md](.instructions.md) for project-specific constraints
4. Review GitHub Issues: https://github.com/BigMichi1/idle-code-redeemer/issues
5. Open a new issue with:
   - OS and version
   - Build command you ran
   - Full error output
   - Contents of `mise tasks` output
