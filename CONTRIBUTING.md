# Contributing to Idle Champions Code Redeemer

Thank you for your interest in contributing to the Idle Champions Code Redeemer Bot! This document provides guidelines and instructions for developers who want to contribute to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Building the Project](#building-the-project)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Code Standards](#code-standards)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How to Contribute

There are many ways to contribute:

### 1. **Report Bugs**

- Use GitHub Issues with a clear title and description
- Include steps to reproduce the bug
- Include expected vs actual behavior
- Include your environment (OS, Node/Bun version, Discord.js version)

### 2. **Suggest Features**

- Use GitHub Issues with label `enhancement`
- Describe the feature and why it's needed
- Include example use cases
- Be open to discussion and alternatives

### 3. **Write Code**

- Fork the repository
- Create a feature branch
- Make your changes following [Code Standards](#code-standards)
- Submit a Pull Request

### 4. **Improve Documentation**

- Documentation improvements are always welcome
- Fix typos, clarify explanations, add examples
- Test documentation instructions

### 5. **Improve Tests**

- Add tests for new features
- Improve test coverage
- Fix failing tests

## Development Setup

### Prerequisites

Before you start, you need:

- **Mise**: Task runner and tool version manager

  ```bash
  curl https://mise.jdx.dev/install.sh | sh
  ```

- **Git**: Version control

  ```bash
  # macOS
  brew install git
  
  # Linux
  sudo apt-get install git
  ```

- **Docker** (optional, for container development)
  ```bash
  # https://docs.docker.com/engine/install/
  ```

### Initial Setup

```bash
# 1. Fork the repository
# Go to https://github.com/BigMichi1/idle-code-redeemer
# Click "Fork" button

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/idle-code-redeemer.git
cd idle-code-redeemer

# 3. Add upstream remote (for staying in sync)
git remote add upstream https://github.com/BigMichi1/idle-code-redeemer.git

# 4. Set up Mise
mise trust
mise run install

# 5. Configure environment
cp .env.example .env
# Edit .env with your DISCORD_TOKEN for testing

# 6. Verify setup
mise tasks
```

## Building the Project

### Comprehensive Build Instructions

See [BUILD.md](BUILD.md) for complete build documentation including:

- Required libraries and frameworks
- Installation steps
- Different build types (development, production, Docker)
- Build troubleshooting

### Quick Reference

```bash
# Install dependencies
mise run install

# Development build (watch mode)
mise run watch

# Production build
mise run prod:build

# Run the bot
bun run dist/bot/bot.js
```

## Making Changes

### 1. Create a Feature Branch

```bash
# Update main branch
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring
- `test/description` - Test additions

### 2. Make Your Changes

```bash
# Edit files
# Run linting
mise run lint:fix

# Format code
mise run format

# Build to verify
mise run build
```

### 3. Update CHANGELOG

**IMPORTANT**: Every code change must update [CHANGELOG.md](CHANGELOG.md) in the `[Unreleased]` section.

```markdown
## [Unreleased]

### Added

- Brief description of new feature

### Changed

- Description of behavior change

### Fixed

- Description of bug fix

### Security

- Security improvement description (if applicable)
```

**Examples:**

```markdown
## [Unreleased]

### Added

- New /codes command to display redemption history

### Fixed

- Instance ID handling for API calls

### Security

- Updated discord.js to fix message content privilege escalation
```

### 4. Test Your Changes

```bash
# Run linting
mise run lint

# Run audits
mise run audit

# Manual testing
mise run dev
# Test your changes in Discord

# Production build test
mise run prod:build
```

### 5. Commit Changes

```bash
# Stage changes
git add .

# Commit with Conventional Commits format
git commit -m "type(scope): description"

# Examples:
# git commit -m "feat(commands): add new /inventory command"
# git commit -m "fix(api): handle instance_id correctly"
# git commit -m "docs: update BUILD.md with troubleshooting"
# git commit -m "refactor(database): simplify user queries"
```

**Commit Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting (ESLint, Prettier)
- `refactor` - Code restructuring (no functionality change)
- `perf` - Performance improvement
- `test` - Test additions/updates
- `chore` - Build system, dependencies

### Git Hooks (Automatic Checks)

When you commit, the following checks run automatically:

1. **Gitleaks** - Detects secrets and credentials
2. **ESLint** - Code quality checks
3. **Prettier** - Code formatting
4. **Commitlint** - Validates commit message format

If checks fail:

```bash
# Fix linting issues
mise run lint:fix

# Fix formatting
mise run format

# Try committing again
git commit -m "type(scope): message"
```

## Testing

### Unit Tests

```bash
# Run all tests
mise run test

# Run tests in watch mode
mise run test:watch

# Run specific test file
mise run test -- src/commands/__tests__/setup.test.ts
```

### Manual Testing

```bash
# Start development server
mise run dev

# In Discord:
# /setup user_id:YOUR_USER_ID user_hash:YOUR_HASH
# /help
# /inventory
```

### Integration Testing

For changes affecting the Idle Champions API:

1. Set up a test Discord guild
2. Add the bot with appropriate permissions
3. Test with real game API responses (see `api-logs/` directory)
4. Verify database operations

## Submitting Changes

### Create a Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Go to GitHub and create a Pull Request
# https://github.com/YOUR_USERNAME/idle-code-redeemer/pulls
```

### PR Title and Description

**Title Format**: `type(scope): description`

- Same format as commit messages
- Clear and descriptive

**Description Template**:

```markdown
## Description

Brief description of what this PR does.

## Related Issues

Fixes #123

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

How to test these changes:

1. Step 1
2. Step 2

## Screenshots (if applicable)

Screenshots of UI changes

## Checklist

- [x] Builds successfully (`mise run build`)
- [x] Passes linting (`mise run lint`)
- [x] Updated CHANGELOG.md
- [x] Added tests (if applicable)
- [x] Tested locally
- [x] Documentation updated (if applicable)
```

### Review Process

1. **Automated Checks**
   - GitHub Actions runs linting and tests
   - Coverage checks on changed files
   - Dependency vulnerability scans

2. **Code Review**
   - At least one maintainer reviews the PR
   - Discussion of design and implementation
   - Suggestions for improvements

3. **Approval and Merge**
   - Once approved, PR can be merged
   - Squash and merge (preferred) or rebase and merge

## Code Standards

### TypeScript

- Use strict TypeScript (`strict: true` in tsconfig.json)
- Add type annotations for function parameters and returns
- Use interfaces for object types
- Avoid `any` type

```typescript
// ✅ Good
function getUserData(userId: string): Promise<UserData> {
  // ...
}

// ❌ Avoid
function getUserData(userId): Promise<any> {
  // ...
}
```

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Classes/Types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `camelCase.ts` (with exceptions for classes: `ClassName.ts`)

```typescript
// ✅ Good
const maxRetries = 3;
function getUserById(id: string) {}
class UserManager {}
interface UserData {}

// ❌ Avoid
const MaxRetries = 3;
function get_user_by_id() {}
class user_manager {}
```

### Comments

- Add comments for complex logic
- Use JSDoc for public functions/classes
- Explain WHY, not WHAT

```typescript
// ✅ Good
/**
 * Handles the /inventory command
 * @param interaction - Discord slash command interaction
 */
function handleInventoryCommand(interaction: CommandInteraction) {
  // Fetch fresh user details to prevent stale instance_id
  const details = await getUserDetails();
}

// ❌ Avoid
// Get user details
const details = getUserDetails();
```

### Error Handling

- Always handle promise rejections
- Provide meaningful error messages
- Log errors with context

```typescript
// ✅ Good
try {
  await redeemCode(code);
} catch (error) {
  logger.error('Failed to redeem code', { code, error });
  await interaction.reply('❌ Failed to redeem code. Please try again.');
}

// ❌ Avoid
const result = await redeemCode(code); // Unhandled promise rejection
```

### Database Operations

- Always use parameterized queries (no string concatenation)
- Include error handling
- Log operations for auditing

```typescript
// ✅ Good
const user = await db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);

// ❌ Avoid
const user = await db.prepare(`SELECT * FROM users WHERE discord_id = '${discordId}'`).get(); // SQL injection risk!
```

### Discord.js Best Practices

- Use slash commands (not text commands)
- Always defer replies for long operations
- Handle ephemeral responses for sensitive data
- Use embeds for formatted responses

```typescript
// ✅ Good
await interaction.deferReply();
const result = await performLongOperation();
await interaction.editReply({ embeds: [createResultEmbed(result)] });

// ❌ Avoid
const result = await performLongOperation();
await interaction.reply(JSON.stringify(result)); // Takes too long, no deferral
```

## Security Considerations

### Never Commit Secrets

- Use `.env` files (in .gitignore)
- Gitleaks pre-commit hook prevents this
- Never hardcode tokens or API keys

### Dependency Updates

- Review dependency changelogs before updating
- Run `mise run audit` after updates
- Test thoroughly with new versions

### API Security

- Always extract fresh `instance_id` before API calls
- Use HTTPS/TLS (NODE_TLS_REJECT_UNAUTHORIZED=0 for known issues)
- Validate user input before API calls

## Questions?

- Check existing documentation in [docs/](docs/)
- Read [BUILD.md](BUILD.md) for build questions
- Review [.instructions.md](.instructions.md) for project constraints
- Open a GitHub Discussion for questions

## Thank You!

Thank you for contributing to make Idle Champions Code Redeemer Bot better! 🎉
