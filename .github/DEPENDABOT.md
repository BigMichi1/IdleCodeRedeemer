# Dependabot Configuration

Dependabot automatically keeps your dependencies up-to-date by creating pull requests for new versions.

## Configuration

The configuration in `.github/dependabot.yml` covers three ecosystems:

### 1. **npm Dependencies** (Weekly)
- Checks for updates every Monday at 3:00 AM UTC
- Limits to 5 open PRs at a time
- Groups development and runtime dependencies separately
- Auto-rebases branches
- Targets: TypeScript, ESLint, Bun, Discord.js, and other npm packages

### 2. **GitHub Actions** (Weekly)
- Checks for updates every Monday at 4:00 AM UTC
- Auto-rebases branches
- Keeps CI/CD workflows up-to-date

### 3. **Docker** (Weekly)
- Checks for base image updates every Monday at 5:00 AM UTC
- Watches the `debian:13-slim` base image
- Auto-rebases branches

## Managing Dependabot PRs

### Enable Dependabot
Dependabot is enabled by default for all public repositories. For private repos:
1. Go to **Settings → Code security & analysis**
2. Enable **Dependabot version updates** and **Dependabot alerts**

### Review & Merge
1. **Actions tab** → View Dependabot PRs
2. Review the changelog and dependencies
3. Run tests (GitHub Actions will run automatically)
4. Approve and merge when confident

### Commands
Add these comments to Dependabot PRs:

```
@dependabot rebase         # Rebase this PR
@dependabot recreate       # Recreate this PR
@dependabot merge          # Merge this PR (if tests pass)
@dependabot squash and merge  # Squash and merge
@dependabot ignore this dependency  # Skip this dependency
@dependabot ignore this major version  # Skip major version bumps for this package
```

### Configure Intervals
Change update frequency by modifying the `schedule.interval` in `.github/dependabot.yml`:
- `daily` - Check every day
- `weekly` - Check every week (default)
- `monthly` - Check every month

### Disable for Specific Packages
Add to your `package.json`:

```json
{
  "dependabot": {
    "ignore": ["package-name", "another-package"]
  }
}
```

Or in `.github/dependabot.yml`:
```yaml
ignore:
  - dependency-name: "package-name"
  - dependency-name: "another-package"
```

## Security Updates

Dependabot will **always** create PRs for security vulnerabilities regardless of the schedule. These are high priority!

## Monitoring

- **Security alerts**: Settings → Security → Dependabot alerts
- **Dependency graph**: Insights tab
- **Update activity**: View PRs created by @dependabot

## Tips

1. **Auto-merge safe updates** - Consider enabling auto-merge for patch updates in non-critical paths
2. **Test before merging** - Always run tests on Dependabot PRs first
3. **Review changelogs** - Check the dependency's changelog for breaking changes
4. **Group related updates** - Already configured for major categories

## Troubleshooting

**Dependabot not creating PRs:**
- Check it's enabled in Settings
- Verify `.github/dependabot.yml` syntax
- Wait up to 24 hours for first run

**Too many PRs:**
- Reduce `open-pull-requests-limit` in `.github/dependabot.yml`
- Change `interval` to `monthly` instead of `weekly`

**Want to skip an update:**
- Comment `@dependabot ignore this dependency` on the PR
- Or add to `ignore` list in `.github/dependabot.yml`

## Resources

- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Configuration Reference](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-dependency-updates)
