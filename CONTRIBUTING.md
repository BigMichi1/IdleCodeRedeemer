# Contributing to Idle Champions Code Redeemer

Thank you for your interest in contributing to the Idle Champions Code Redeemer Bot! This document provides guidelines and instructions for developers who want to contribute to the project. This is the source of truth for both contributors and code reviewers. [OSPS-GV-03.02]

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Developer Certificate of Origin](#developer-certificate-of-origin)
- [Requirements for Acceptable Contributions](#requirements-for-acceptable-contributions)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Building the Project](#building-the-project)
- [Making Changes](#making-changes)
- [Status Checks & Branch Protection](#status-checks--branch-protection)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Code Standards](#code-standards)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Developer Certificate of Origin

This project requires all code contributors to assert that they are legally authorized to make the associated contributions. We enforce this through the **Developer Certificate of Origin (DCO)**. [OSPS-LE-01.01]

### What is the DCO?

The DCO is a lightweight way for contributors to certify that they have the legal right to submit their contributions.

### How to Sign Your Commits

All commits must be signed off with the `-s` flag:

```bash
git commit -s -m "type(scope): description"
```

This adds a "Signed-off-by" trailer to your commit message, legally asserting you have the right to submit the code.

### Sign-Off Example

```bash
# Commit with sign-off
git commit -s -m "feat(commands): add new /inventory command"

# Results in:
# feat(commands): add new /inventory command
#
# Signed-off-by: Jane Doe <jane@example.com>
```

### Configure Git for Easy Sign-Off

```bash
# Set your name and email globally
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Optional: Create an alias for faster commits
git config --global alias.cs 'commit -s'
# Then use: git cs -m "message"
```

### DCO Enforcement

This project enforces DCO via:

- ✅ **GitHub Actions** - Status check verifies all commits are signed off
- ✅ **Pre-commit Hooks** - Warn about unsigned commits
- ✅ **Pull Request Requirements** - Blocks merging if commits lack sign-offs

**If a commit is missing a sign-off, the pull request will fail CI/CD checks and cannot be merged.**

### If You Forgot to Sign Off

Amend your commits:

```bash
# Single commit
git commit --amend -s
git push --force-with-lease

# Multiple commits - rebase and sign
git rebase -i HEAD~<number-of-commits>
# Change 'pick' to 'reword', add '-s' flag when editing
git push --force-with-lease
```

### More Information

For complete DCO details, see [DCO.md](DCO.md).

## Requirements for Acceptable Contributions

All contributions must meet the following requirements to be accepted. This section is the source of truth for both contributors and code reviewers. [OSPS-GV-03.02]

### 1. Code Quality Requirements

Every code contribution must:

✅ **Lint & Format**
- Pass ESLint checks (`mise run lint`)
- Follow Prettier formatting (`mise run format`)
- No linting warnings or errors
- Automated pre-commit hooks enforce this

✅ **Type Safety**
- Use TypeScript strict mode (`strict: true`)
- Add type annotations for all function parameters and return types
- Use interfaces/types for object shapes
- No `any` type without explicit justification (// @ts-ignore)
- Avoid implicit `any`

✅ **Best Practices**
- Follow naming conventions (camelCase for functions/variables, PascalCase for classes)
- Use meaningful variable and function names
- Add JSDoc comments for public functions
- Explain WHY, not WHAT in comments
- Handle all promise rejections
- Provide meaningful error messages

✅ **Security Standards**
- No hardcoded secrets, tokens, or API keys
- Always use parameterized queries (prevent SQL injection)
- Validate user input before use
- Never log sensitive data
- Use environment variables for configuration
- Pass security scanning (Gitleaks)

✅ **Code Patterns**
- Follow Discord.js best practices (slash commands, defer replies, embeds)
- Use consistent error handling patterns
- Log operations for auditing
- No commented-out code (use git history instead)

### 2. Testing Requirements

Every contribution must include appropriate testing:

✅ **Unit Tests**
- Add tests for new functions and classes
- Add tests for bug fixes (regression tests)
- Tests must pass (`mise run test`)
- Aim for adequate coverage of changed code
- Tests must be maintainable and clear

✅ **Integration Tests** (if applicable)
- For features affecting external APIs (Idle Champions API, Discord)
- Test with real API responses
- Test error cases and edge cases
- Document test setup in PR description

✅ **Manual Testing**
- Test in development environment (`mise run dev`)
- Test in Discord server before submitting
- Include testing steps in PR description
- For database changes: verify data integrity
- For command changes: test command in Discord

✅ **Test Quality**
- Tests must be deterministic (no flaky tests)
- Tests must be isolated (no test dependencies)
- Clear test names describing what is tested
- Both happy path and error cases covered

### 3. Documentation Requirements

Every contribution must include appropriate documentation:

✅ **Code Documentation**
- Public functions/classes have JSDoc comments
- Complex logic has inline comments
- Comments explain WHY, not WHAT

✅ **CHANGELOG.md Update** (MANDATORY)
- Every code change updates [CHANGELOG.md](CHANGELOG.md)
- Add to [Unreleased] section
- Use appropriate category (Added, Changed, Fixed, Security)
- Clear, user-facing language

✅ **User Documentation**
- New commands documented in relevant docs
- API changes documented
- Configuration changes documented
- Breaking changes clearly noted

✅ **Commit Messages**
- Use Conventional Commits format (`type(scope): description`)
- Clear and descriptive
- Reference related issues (#123)
- Passed by commitlint hook

### 4. Submission Guidelines

Every pull request must:

✅ **PR Description**
- Clear title in Conventional Commits format
- Describe what changes and why
- Link to related issues
- Explain testing approach
- Include screenshots if UI changes

✅ **PR Checklist**
- Code builds successfully (`mise run build`)
- Passes linting (`mise run lint`)
- Passes security scans (Gitleaks)
- Tests pass and are included
- CHANGELOG.md updated
- Documentation updated
- Tested locally or in Discord
- PR description complete

✅ **Automatic Checks**
- GitHub Actions CI/CD passes
- ESLint checks pass
- Prettier formatting passes
- Commitlint validates commits
- Dependency scans pass (no vulnerabilities)
- Test coverage maintained or improved

### 5. Code Review Criteria

Maintainers use these criteria when reviewing contributions:

✅ **Does it work?**
- Tests pass
- No runtime errors
- Solves the stated problem

✅ **Is it secure?**
- No secrets in code
- Proper error handling
- Input validation present
- SQL injection prevention (parameterized queries)
- No privilege escalation

✅ **Is it maintainable?**
- Code is readable and clear
- Follows project standards
- No technical debt introduced
- Documented appropriately

✅ **Is it correct?**
- Correct algorithm/logic
- Handles edge cases
- Follows TypeScript best practices
- No type errors

✅ **Does it fit the project?**
- Aligns with project scope
- Doesn't break existing functionality
- Documentation is complete
- No unnecessary dependencies added

### 6. Acceptance Criteria Summary

A contribution is ready to merge when it meets ALL of the following:

| Criterion | Required | Status |
|-----------|----------|--------|
| **Code Quality** | ✅ | Linting passes, TypeScript strict, patterns followed |
| **Security** | ✅ | No secrets, SQL injection prevention, Gitleaks passes |
| **Tests** | ✅ | Unit + integration tests pass, adequate coverage |
| **Documentation** | ✅ | CHANGELOG updated, comments present, docs updated |
| **Review** | ✅ | At least one maintainer approval |
| **CI/CD** | ✅ | All automated checks pass |
| **Builds** | ✅ | `mise run build` succeeds |
| **Tested** | ✅ | Verified to work locally |

**If ANY criterion is not met, the PR cannot be merged.** Requesters must address feedback before re-review.

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

### Automated Test Suites

Before any code is merged to the primary branch, automated test suites run in CI/CD pipelines. These tests validate that code meets functional and quality expectations. [OSPS-QA-06.01]

**Test Suites That Run Automatically:**

1. **Build & Compilation Tests** - TypeScript strict mode compilation
   ```bash
   # Local: Compile your code
   mise run build
   ```

2. **Code Quality & Linting Tests** - ESLint validates code standards
   ```bash
   # Local: Run linting
   mise run lint
   
   # Local: Fix auto-fixable linting issues
   mise run lint:fix
   ```

3. **Security Vulnerability Scanning** - CodeQL, dependencies, secrets
   ```bash
   # Local: Check for vulnerable dependencies
   bun audit
   ```

4. **Type Safety Validation** - TypeScript strict mode
   - Runs as part of build process
   - No explicit command needed

5. **Code Formatting Tests** - Prettier enforces consistent formatting
   ```bash
   # Local: Format your code
   mise run format
   
   # Local: Check formatting without changing
   mise run format:check
   ```

**These tests run on every PR and must pass before merging. All contributors can see test results in the pull request status checks.**

### Running Tests Before Submitting PR

Run these commands locally to catch issues before submission:

```bash
# Install dependencies
mise run install

# Build and compile code
mise run build

# Fix linting issues
mise run lint:fix

# Format code
mise run format

# Check for vulnerabilities
bun audit

# Sign off on commits
git commit -s -m "message"
```

### Manual Testing

For Discord bot features, test manually:

```bash
# Start development bot
mise run dev

# In your test Discord server:
# /setup user_id:YOUR_USER_ID user_hash:YOUR_HASH
# /help
# /inventory
```

Verify that:
- Commands execute without errors
- Bot responds appropriately
- Database operations work
- API calls succeed

### Understanding Test Failures

If a test fails in CI/CD:

1. **Click "Details"** on the failed check in your PR
2. **Read the error message** carefully
3. **Fix the underlying issue** (don't bypass the test)
4. **Push corrections** - tests automatically re-run
5. **Verify all pass** before requesting review

For detailed troubleshooting, see [docs/testing-strategy.md](../../docs/testing-strategy.md#troubleshooting-failed-tests).

### For More Information

See [docs/testing-strategy.md](../../docs/testing-strategy.md) for complete testing documentation, including:
- All test suites and what they verify
- How to run tests locally
- CI/CD pipeline flow
- Test result visibility
- Best practices
- Troubleshooting failed tests

### Integration Testing

For changes affecting the Idle Champions API:

1. Set up a test Discord guild
2. Add the bot with appropriate permissions
3. Test with real game API responses (see `api-logs/` directory)
4. Verify database operations

## Status Checks & Branch Protection

All commits to the primary branch (`main`) must pass automated status checks before merging. These checks are enforced via branch protection and GitHub Actions. [OSPS-QA-03.01]

### Required Status Checks

The following automated checks MUST pass:

✅ **DCO Sign-Off** - All commits must be legally signed off
- Command: `git commit -s -m "message"`
- Failure: Unsigned commits block PR from merging
- Fix: Amend and sign off with `git commit --amend -s && git push --force-with-lease`

✅ **Docker Build** - Docker image must build successfully
- Triggers: Every push and PR
- Failure: Build errors shown in GitHub Actions logs
- Fix: Review Dockerfile, check dependencies, push corrections

✅ **CodeQL Security** - Security vulnerability scanning
- Triggers: Every push and PR
- Failure: Critical/high-severity issues block merge
- Fix: Address CodeQL alerts in GitHub Security tab

✅ **Dependency Review** - Check for vulnerable dependencies
- Triggers: When package.json is changed
- Failure: New vulnerable dependencies block merge
- Fix: Update to patched version or remove dependency

✅ **Secret Scanning** - Detect credentials in code
- Triggers: Every push and PR
- Failure: Hardcoded secrets block merge
- Fix: Remove secret, use .env instead, commit if needed

### Branch Protection Policy

The `main` branch is configured with:

- ✅ All status checks MUST pass before merge
- ✅ Branches must be up to date (rebase required)
- ✅ Pull request review required (1 approval)
- ✅ CODEOWNERS review required for sensitive files
- ❌ No force pushes allowed
- ❌ No deletion allowed
- ❌ Admin cannot bypass (ensures consistency)

### What If Checks Fail?

1. **Review the failure** - Click "Details" on failed check in PR
2. **Understand the issue** - Read error message or logs
3. **Fix the problem** - Correct the underlying issue
4. **Push corrections** - New commits trigger checks to re-run
5. **Wait for re-test** - GitHub Actions automatically re-run
6. **Once all pass** - PR becomes mergeable (with review approval)

### Before Submitting Your PR

Run these locally to catch issues early:

```bash
# Lint your code
mise run lint

# Format your code
mise run format

# Build to verify
mise run build

# Run tests
mise run test

# Sign off on commits
git commit -s -m "message"
```

**This prevents CI failures and keeps the PR process smooth.**

### For More Information

See [docs/status-checks.md](docs/status-checks.md) for complete details on:
- All required checks and what they verify
- How to interpret check results
- Troubleshooting specific failures
- Bypass procedures (rare, admin-only)

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
