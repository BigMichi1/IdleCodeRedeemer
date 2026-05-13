# Dependency Management Strategy

This document describes how the Idle Champions Code Redeemer Bot manages dependencies using standardized tooling and practices to ensure reproducible, secure builds.

This documentation is published with all releases to ensure users understand how dependencies are selected, obtained, and tracked. [OSPS-DO-06.01]

## Overview

The project uses **standardized tooling for the Node.js/Bun ecosystem** to manage all dependencies:

- **Package Manager**: Bun (standardized for this ecosystem)
- **Dependency Manifest**: `package.json` (standard Node.js format)
- **Lock File**: `bun.lock` (ensures reproducible builds)
- **Task Runner**: Mise (orchestrates standardized tasks)
- **Dependency Verification**: Bun audit for vulnerability scanning

## Dependency Selection & Evaluation [OSPS-DO-06.01]

### How Dependencies Are Selected

When introducing a new dependency, the following criteria are evaluated:

#### 1. **Necessity**

- ✅ Solves a real problem or reduces complexity
- ✅ No existing solution in the codebase or standard library
- ❌ Not added for convenience if maintainability cost is high
- ❌ Not added "just in case" without a use case

#### 2. **Maturity & Stability**

- ✅ Production-ready (v1.0.0 or higher)
- ✅ Active maintenance (recent commits within 3-6 months)
- ✅ Reasonable version history (not v0.x unless necessary)
- ✅ Used by other projects in the ecosystem
- ❌ Not beta/alpha versions unless unavoidable
- ❌ Not abandoned projects

#### 3. **Security**

- ✅ No known vulnerabilities (`bun audit` passes)
- ✅ Clear security policy and vulnerability disclosure process
- ✅ Regular dependency updates
- ✅ Maintained by reputable maintainers
- ❌ Not packages with history of security issues
- ❌ Not packages from unknown sources

#### 4. **Quality & Maintainability**

- ✅ Well-documented with clear examples
- ✅ TypeScript support (native or via @types/\*)
- ✅ Good test coverage
- ✅ Clear API design
- ✅ Active community (issues answered, PRs reviewed)
- ❌ Not packages with poor documentation
- ❌ Not unmaintained forks

#### 5. **Size & Performance**

- ✅ Reasonable bundle size
- ✅ No unnecessary transitive dependencies
- ✅ Compatible with Bun runtime
- ❌ Not bloated when lighter alternatives exist
- ❌ Not packages that conflict with our tech stack

#### 6. **License**

- ✅ Permissive licenses (MIT, Apache 2.0, BSD, ISC)
- ✅ Compatible with project license (ISC)
- ✅ No GPL/AGPL for production code
- ✅ Clear license headers in package
- ❌ Not unclear or proprietary licenses

### Current Production Dependencies

| Package          | Version | Purpose                      | Selection Notes                   |
| ---------------- | ------- | ---------------------------- | --------------------------------- |
| **discord.js**   | 14.26.4 | Discord bot framework        | Standard, active, well-maintained |
| **drizzle-orm**  | 0.45.2  | Type-safe ORM for SQLite     | Zero-query overhead, TS-first     |
| **winston**      | 3.19.0  | Logging framework            | Structured logging, rotation      |

> **Note:** `dotenv`, `node-fetch`, and `sqlite3` were removed. Bun loads `.env` natively, provides a built-in Fetch API, and includes `bun:sqlite` as a first-party module.

### Current Development Dependencies

| Package                 | Purpose              | Rationale                        |
| ----------------------- | -------------------- | -------------------------------- |
| **@typescript-eslint/** | Code quality         | Mandatory for TypeScript linting |
| **eslint**              | Linting              | Code consistency                 |
| **prettier**            | Formatting           | Code style consistency           |
| **typescript**          | Type-check only      | `noEmit: true`; Bun runs TS natively |
| **@types/bun**          | Bun type definitions | Required for `bun:sqlite` types  |
| **drizzle-kit**         | Schema management    | Generate SQL migrations from TS schema |
| **husky**               | Git hooks            | Mandatory for pre-commit checks  |
| **commitlint**          | Commit validation    | Enforce Conventional Commits     |
| **lint-staged**         | Pre-commit linting   | Quality gates                    |

### Adding New Dependencies

**Process**:

1. Evaluate against selection criteria above
2. Check `bun audit` for vulnerabilities
3. Test in development locally
4. If approved:
   ```bash
   bun add package-name
   # OR for dev dependencies:
   bun add --development package-name
   ```
5. Commit both `package.json` and `bun.lock`
6. Update CHANGELOG.md with reason for addition

**Decision Criteria Checklist**:

- [ ] Solves a real problem
- [ ] Production-ready (v1.0+)
- [ ] No known vulnerabilities
- [ ] Well-documented
- [ ] Active maintenance
- [ ] Reasonable size
- [ ] Compatible license
- [ ] Team consensus

### Evaluating Dependency Updates

**When Dependabot Creates PR**:

1. Check changelog for breaking changes
2. Review vulnerability details (if security update)
3. Verify tests pass (CI/CD runs)
4. Manual testing if significant changes
5. Merge if safe, comment with rationale

**Version Update Policy**:

- ✅ **Patch updates** (2.0.0 → 2.0.1): Auto-merge if tests pass
- ✅ **Minor updates** (2.0.0 → 2.1.0): Review changelog, auto-merge if backward compatible
- ⚠️ **Major updates** (2.0.0 → 3.0.0): Manual review required, test thoroughly

## Standardized Tooling

### Package Manager: Bun

**Why Bun?**

- Official JavaScript/TypeScript package manager for Node.js ecosystem
- 3-4x faster than npm/yarn
- Built-in dependency verification
- Excellent lock file support
- Zero-install capable with proper lock file tracking

**Key Commands:**

```bash
bun install              # Install all dependencies
bun install --production # Install only production dependencies
bun update               # Update dependencies
bun audit                # Security vulnerability scanning
```

**Standardized via Mise:**

```bash
mise run install      # Wrapper for: bun install
mise run prod:install # Production-only: bun install --production --frozen-lockfile
mise run audit        # Wrapper for: bun audit
mise run update       # Wrapper for: bun update
```

## Dependency Manifests

### package.json

**Purpose**: Declares all project dependencies and their versions.

**Location**: `package.json` (root)

**Structure**:

```json
{
  "dependencies": {
    "discord.js": "14.26.4",
    "drizzle-orm": "0.45.2",
    "winston": "3.19.0"
  },
  "devDependencies": {
    "@types/bun": "1.3.14",
    "@typescript-eslint/eslint-plugin": "8.59.2",
    "drizzle-kit": "0.31.10",
    "eslint": "10.3.0",
    "prettier": "3.8.3"
  },
  "peerDependencies": {
    "typescript": "6.0.3"
  }
}
```

**Key Requirements**:

- ✅ All production dependencies explicitly listed
- ✅ All development dependencies explicitly listed
- ✅ Pinned versions (not ranges) for reproducibility
- ✅ Tracked in git for auditability

### bun.lock

**Purpose**: Provides exact reproducible builds by locking all dependency versions (including transitive dependencies).

**Location**: `bun.lock` (root)

**Key Features**:

- Contains exact versions of all dependencies and sub-dependencies
- Guarantees bit-for-bit identical installs across environments
- Enables offline installation (when combined with proper cache)
- Eliminates "works on my machine" dependency issues

**Tracking in Git**:
✅ **bun.lock is tracked in git** (NOT in .gitignore)

- Ensures all developers and CI/CD systems use identical dependency versions
- Makes builds reproducible across machines and time
- Enables quick issue diagnosis (exact version of every package known)

**Lock File Workflow**:

```bash
# After modifying package.json:
bun install # Updates bun.lock with new dependency tree

# To commit changes:
git add package.json bun.lock
git commit -m "chore(deps): update dependency versions"
```

## Dependency Ingestion in Different Contexts

### 1. Local Development

**Setup**:

```bash
cd /path/to/idle-code-redeemer
mise run install # Installs from package.json + bun.lock
```

**Process**:

1. Mise reads `.mise.toml` and installs configured tools (Bun, Node.js)
2. `mise run install` executes: `bun install`
3. Bun reads `bun.lock` for exact versions
4. Creates `node_modules/` with locked versions
5. All developers have identical dependencies

### 2. Docker Build (Production)

**Builder Stage** (`Dockerfile` lines 1-45):

```dockerfile
# Copy dependency files
COPY package.json ./
COPY bun.lock ./

# Install all dependencies (for building)
RUN bin/mise run install
```

**Production Stage** (`Dockerfile` lines 46-80):

```dockerfile
# Copy dependency files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

# Install only production dependencies (frozen)
RUN bin/mise run prod:install
# Equivalent to: bun install --production --frozen-lockfile --ignore-scripts
```

**Guarantees**:

- ✅ Builder stage installs all dependencies (including dev) for TypeScript compilation
- ✅ Production stage installs only runtime dependencies
- ✅ `--frozen-lockfile` ensures no dependency changes mid-build
- ✅ Identical dependencies across all Docker builds

### 3. CI/CD Pipelines (GitHub Actions)

**Dependency Verification Workflow** (`.github/workflows/dependency-check.yml`):

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Setup Bun
    uses: oven-sh/setup-bun@v1
    with:
      bun-version: latest

  - name: Install dependencies
    run: bun install --frozen-lockfile

  - name: Vulnerability scan
    run: bun audit

  - name: Check lock file
    run: |
      if [[ -n $(git status -s) ]]; then
        echo "❌ Lock file mismatch! Run: bun install"
        exit 1
      fi
```

**Process**:

1. Checkout code with package.json and bun.lock
2. Install Bun runtime
3. Run `bun install --frozen-lockfile` (fails if versions don't match)
4. Run `bun audit` for known vulnerabilities
5. Verify lock file wasn't modified (no hidden changes)

## Dependency Update Process

### Safe Dependency Updates

**Step 1: Review Dependencies**

```bash
# Check for outdated dependencies
bun outdated

# Check for security vulnerabilities
bun audit
```

**Step 2: Update Specific Dependencies**

```bash
# Update a single dependency
bun update discord.js

# Update all dependencies
bun update

# Update to latest (be careful with major versions!)
bun update --latest
```

**Step 3: Test Thoroughly**

```bash
# Run full test suite
mise run build # Build TypeScript
mise run lint  # Check code quality
mise run dev   # Manual testing
```

**Step 4: Commit Changes**

```bash
git add package.json bun.lock
git commit -m "chore(deps): update dependencies for [reason]"
```

### Automated Dependency Updates

**Dependabot** integration (GitHub):

- Automatically scans for outdated dependencies weekly
- Creates pull requests with updated package.json
- CI/CD automatically tests before merge
- Updates are tracked in CHANGELOG.md

**Never**:

- ❌ Run `bun install` and commit without `bun.lock`
- ❌ Use wildcards in version numbers (use pinned versions)
- ❌ Manually edit `bun.lock`
- ❌ Use `--ignore-scripts` in production installs (except explicitly needed)

## Verification

### Verify Lock File Integrity

```bash
# After any dependency changes
bun install --frozen-lockfile

# This will error if package.json and bun.lock are out of sync
```

### Verify in Docker

```bash
# Build Docker image with frozen lock file
docker build .

# The build will fail if dependencies can't be installed from lock
```

### CI/CD Verification

All GitHub Actions workflows verify:

1. ✅ Lock file matches package.json
2. ✅ No vulnerable dependencies
3. ✅ Reproducible builds

## Dependency Audit Trail

### package.json vs bun.lock

| Aspect             | package.json          | bun.lock                      |
| ------------------ | --------------------- | ----------------------------- |
| **Purpose**        | Declares dependencies | Locks exact versions          |
| **Edited by**      | Developers manually   | Bun automatically             |
| **Tracked in Git** | ✅ Yes                | ✅ Yes                        |
| **Human readable** | ✅ Yes                | ❌ No (binary-like format)    |
| **Scope**          | Direct dependencies   | All dependencies + transitive |
| **Use case**       | Specification         | Reproducibility               |

### Adding New Dependencies

**Step 1: Add to package.json**

```bash
bun add package-name
# OR for dev dependencies:
bun add --development package-name
```

**Step 2: Verify bun.lock updated**

```bash
git status
# Should show:
# modified:   package.json
# modified:   bun.lock
```

**Step 3: Review and commit**

```bash
git diff package.json # Review version added
git add package.json bun.lock
git commit -m "feat: add new dependency [package-name]"
```

## Container Registry & Dependencies

### Docker Image Publishing

Images published to GitHub Container Registry (GHCR):

```
ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0
```

Each image includes:

- ✅ Frozen dependency set from bun.lock
- ✅ Only production dependencies
- ✅ No development tools or source code
- ✅ Exact reproducible runtime environment

## Security Considerations

### Dependency Vulnerability Management

1. **Automated Scanning**:
   - `bun audit` runs on every push
   - GitHub Dependabot scans weekly
   - TruffleHog checks for leaked credentials

2. **Vulnerability Response**:
   - Critical/High: Update immediately
   - Medium: Update within 1 week
   - Low: Update within 1 month
   - All updates tracked in CHANGELOG.md

3. **Lock File Security**:
   - Pinned versions prevent unexpected updates
   - Hash validation ensures downloaded packages match
   - Reproducible builds detect package tampering

### Supply Chain Security

- ✅ All dependencies pinned to specific versions
- ✅ Lock file prevents silent updates
- ✅ CI/CD validates every build with frozen lock
- ✅ Dependency audit trail in git history
- ✅ Pre-commit hooks prevent secrets in dependencies

## How Dependencies Are Tracked [OSPS-DO-06.01]

### Git History

Every dependency change is tracked in git:

```bash
# View dependency change history
git log --oneline -- package.json bun.lock

# See what dependencies changed in a commit
git show package.json bun.lock < commit-sha > --

# Diff dependencies between versions
git diff v2.0.0 v2.1.0 -- package.json
```

**Tracked Information**:

- ✅ When dependencies were added/updated
- ✅ Who made the change (git commit author)
- ✅ Why the change was made (commit message)
- ✅ What exact versions were installed
- ✅ All transitive dependencies (in bun.lock)

### CHANGELOG.md

Dependency changes are documented in the release changelog:

```markdown
## [2.1.0] - 2026-05-15

### Changed

- Update discord.js from 14.26.4 to 14.27.0 for bug fixes

### Security

- Update dependencies: sqlite3 6.0.1 → 6.0.2 (security patch)
```

**Benefits**:

- ✅ Human-readable description of dependency changes
- ✅ Security implications documented
- ✅ Explains why dependencies were updated
- ✅ Published with release on GitHub

### Dependency Lock File Tracking

`bun.lock` is the authoritative source for exact versions:

```bash
# View exact locked versions
cat bun.lock | head -50

# Verify production dependencies
bun ls --production

# Audit locked dependencies
bun audit
```

**Information in bun.lock**:

- ✅ Exact version of every package
- ✅ Hashes for integrity verification
- ✅ All transitive dependencies
- ✅ Resolution for conflicts
- ✅ Build metadata

### Automated Tracking

**Dependabot Integration**:

- Scans npm registry weekly
- Detects outdated packages
- Creates pull requests for updates
- Tracks vulnerability advisories

**GitHub's Dependency Graph**:

- Automatically analyzes package.json
- Shows dependency tree visualization
- Detects vulnerable packages
- Available at: `/network/dependencies`

**bun audit Output**:

```bash
$ bun audit
Audited 215 packages
0 vulnerabilities found
```

### Release Time Publishing

When a release is created, dependency information is published:

1. **GitHub Release Notes**
   - Link to CHANGELOG.md with dependency changes
   - Signature verification available

2. **Docker Image Metadata**
   - Lists dependency versions installed
   - Verification available via `docker inspect`

3. **This Documentation**
   - Published alongside release
   - Contains selection criteria
   - Explains tracking strategy

Example Release Notes:

```markdown
## Dependencies

For details on how dependencies are selected, obtained, and tracked, see:

- [Dependency Management Documentation](docs/dependency-management.md)
- [CHANGELOG.md](CHANGELOG.md) - Updated dependencies section
- [Security Policy](SECURITY.md) - Dependency vulnerability handling

All dependencies are locked in bun.lock for reproducible builds.
Current production dependencies: 5
Current development dependencies: 12
All pass security audit (bun audit).
```

## Tools and Configuration

### .mise.toml Tasks

```toml
[tasks.install]
description = "Install dependencies with Bun"
run = "bun install"

[tasks."prod:install"]
description = "Install production dependencies only"
run = "bun install --production --frozen-lockfile --ignore-scripts"

[tasks.audit]
description = "Audit dependencies for vulnerabilities"
run = "bun audit"

[tasks.update]
description = "Update all dependencies"
run = "bun update"
```

### ESLint Configuration

Lock files excluded from linting:

```javascript
// .eslintignore
bun.lock;
package - lock.json;
yarn.lock;
```

### .gitignore

```
# ✅ Track bun.lock for reproducible builds
# bun.lock (NOT ignored)

# ✅ Ignore generated node_modules
node_modules/

# ✅ Ignore lockfiles from other package managers
package-lock.json
yarn.lock
```

## References

- [Bun Package Manager](https://bun.sh/)
- [npm: Lock Files](https://docs.npmjs.com/cli/v8/configuring-npm/package-lock-json)
- [NIST: Supply Chain Security](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5)
- [OWASP: Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Snyk: Dependency Management Best Practices](https://snyk.io/learn/dependency-management/)
