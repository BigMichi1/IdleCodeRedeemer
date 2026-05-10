# Secret Management Guide

This repository has multiple layers of protection against accidentally committing secrets.

## What's Protected

### Automatic Blocking

- Discord tokens
- API keys and secrets
- Database credentials
- AWS keys
- Private keys

### Files Ignored

- `.env` - Environment file with secrets
- `.env.local` - Local overrides
- `.env.*.local` - Environment-specific secrets
- See `.gitignore` for the full list

## How to Handle Secrets

### 1. Never Commit Secrets

Use `.env.example` template instead of actual `.env`:

```bash
# WRONG ❌
echo "DISCORD_TOKEN=your_actual_token" > .env
git add .env

# RIGHT ✅
cp .env.example .env
# Edit .env with your real token (stays local)
# .env is already in .gitignore
```

### 2. Provide Examples

Update `.env.example` with placeholder values:

```env
# .env.example
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here
DISCORD_CHANNEL_ID=your_channel_id_here
DISCORD_CODE_AUTHOR_ID=your_code_author_bot_id_here
DB_PATH=/app/data/idle.db
NODE_ENV=development
```

### 3. Share Secrets Securely

For team members:

- Use GitHub Secrets (for CI/CD)
- Use encrypted password manager
- Share `.env` file via secure channel (Signal, 1Password, etc.)
- Never email or Slack secrets

## Pre-Commit Hooks

When you run `git commit`, the pre-commit hooks (in `.husky/`) run automatically to protect your code:

### What Runs

1. ✅ **Gitleaks** - Scans for hardcoded secrets (API keys, tokens, credentials)
2. ✅ **ESLint** - TypeScript/formatting checks via lint-staged
3. ✅ **Commitlint** (commit-msg hook) - Validates commit message format

### How It Works

The hooks use the local `bin/mise` to ensure consistent tool versions:

```bash
# In .husky/pre-commit:
"$PROJECT_ROOT/bin/mise" run gitleaks detect --source . --verbose
"$PROJECT_ROOT/bin/mise" run -- bunx lint-staged

# In .husky/commit-msg:
"$PROJECT_ROOT/bin/mise" run -- bunx commitlint --edit "$1"
```

If any check fails, the commit is rejected. Fix and retry:

```bash
# See what failed
git commit -m "..."

# Fix Gitleaks warnings
# - Remove secrets from files
# - Update .gitignore if needed

# Fix ESLint issues
mise run lint:fix

# Stage fixes and try again
git add .
git commit -m "..."
```

### Bypass (Emergency Only)

**⚠️ WARNING: NEVER use `--no-verify` in normal workflow**

If you absolutely must bypass (not recommended):

```bash
git commit --no-verify
```

This bypasses ALL hook checks including secret scanning. Only use in emergencies.

## GitHub Actions Scanning

Additional scanning runs on every push and PR:

### 1. **Gitleaks** - Detects known secret patterns

- Scans entire repository history
- Checks for API keys, tokens, credentials
- Runs on every push and PR

### 2. **TruffleHog** - Advanced entropy scanning

- Detects high-entropy strings (likely secrets)
- Searches for unused credentials
- Runs on every push and PR

### 3. **Environment File Checker**

- Ensures `.env` files are NOT tracked
- Warns if sensitive keywords appear in code
- Validates proper secret management

## If You Accidentally Committed a Secret

### Step 1: Stop Using It

Immediately:

- Rotate the token/key/password
- Revoke the old one in the service
- Update `.env` with new value

### Step 2: Remove from History

```bash
# Option A: Remove file completely
git filter-branch --tree-filter 'rm -f .env' HEAD
git push --force

# Option B: Edit history (smaller files)
git filter-branch --tree-filter 'sed -i "s/old_secret/NEW_SECRET/g" .env' HEAD
git push --force
```

### Step 3: Notify Team

- Tell team members to pull the updated history
- Ask them to reset their `.env` files
- Verify no one cached the old secret

### Step 4: Monitor

- Check where the old secret might be logged
- Monitor for unusual activity on that account
- Watch GitHub security alerts

## Configuration Files

### `.gitignore` - Files never tracked

```
.env
.env.local
.env.*.local
data/
logs/
```

### `.secrets.baseline` - Known safe patterns

Stores hash of "approved" or "test" secrets that are safe to have in code (e.g., placeholder tokens in docs). This file should be reviewed carefully.

### GitHub Secrets (`.github/workflows/`)

Use for CI/CD:

```yaml
env:
  DISCORD_TOKEN: ${{ secrets.DISCORD_TOKEN }}
```

## Best Practices

### ✅ DO

- Use `.env.example` as a template
- Add helpful comments to `.env.example`
- Keep secrets in environment variables
- Rotate secrets regularly
- Use GitHub Secrets for CI/CD

### ❌ DON'T

- Hardcode secrets in code
- Commit `.env` files
- Share secrets via email/chat
- Use the same secret in multiple places
- Leave debug tokens in production

## Testing Secret Detection

To test the hooks are working:

```bash
# Create a test file with a fake secret
echo "DISCORD_TOKEN=fake_token_12345" > test_secret.ts

# Try to commit it
git add test_secret.ts
git commit -m "test"

# Should be blocked by pre-commit hook ✅
# Fix: Remove the secret and try again
```

## Documentation

- [GitHub: Using secrets in workflows](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [Gitleaks: Detecting secrets](https://github.com/gitleaks/gitleaks)
- [TruffleHog: Secret scanning](https://github.com/trufflesecurity/trufflehog)

## Support

For questions about secrets management:

1. Check this guide
2. Review `.github/workflows/secrets.yml` for what's scanned
3. Ask team lead before committing sensitive data
4. When in doubt, assume it should NOT be committed
