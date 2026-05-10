# Changelog

All notable changes to the Idle Champions Code Redeemer Bot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Project Governance & Members [OSPS-GV-01.01, OSPS-GV-01.02]** - Documented project members, roles, and access to sensitive resources
  - NEW: [GOVERNANCE.md](GOVERNANCE.md) - Complete governance documentation
  - Lists active maintainers (@BigMichi1 as lead maintainer)
  - Detailed descriptions of roles and responsibilities (Owner & Lead Maintainer, Future Roles)
  - Documents access to sensitive resources (GitHub, Docker, secrets, database)
  - Describes decision-making and code review processes
  - Includes vulnerability response procedures
  - Future maintainer criteria documented
  - Audit trail and compliance verification procedures

- **Build Instructions [OSPS-DO-07.01]** - Comprehensive documentation on how to build the software
  - NEW: [BUILD.md](BUILD.md) - Complete build instructions with prerequisites, installation, and build procedures
  - NEW: [CONTRIBUTING.md](CONTRIBUTING.md) - Developer contribution guidelines with development setup
  - Detailed requirements for libraries, frameworks, SDKs (Mise, Bun, TypeScript, discord.js, etc.)
  - Instructions for development builds, production builds, and Docker container builds
  - Step-by-step build examples and troubleshooting
  - Integrated with CONTRIBUTING.md for developer documentation

- **Cryptographic Signing [OSPS-BR-06.01]** - All released assets now signed at build time
  - Docker images signed with Cosign (Keyless OIDC) during GitHub Actions build
  - Release attestations (JSON manifest with build metadata and hashes) generated and signed
  - Attestation files uploaded to GitHub Releases for verification
  - Public Rekor transparency log for audit trail
  - Comprehensive signing & verification documentation in [docs/cryptographic-signing.md](docs/cryptographic-signing.md)

- **Dependency Management Documentation [OSPS-DO-06.01]** - Complete transparency on dependency selection and tracking
  - Selection criteria documented (necessity, maturity, security, quality, size, license)
  - All 5 production + 12 dev dependencies listed with justification
  - How dependencies are obtained (Bun, package.json, bun.lock)
  - How dependencies are tracked (git history, CHANGELOG, lock file, Rekor)
  - Published with every release to ensure transparency
  - Comprehensive documentation in [docs/dependency-management.md](docs/dependency-management.md)

### Changed

- Docker workflow now includes Cosign signing step for all published images
- Release process now includes automatic attestation generation and signing
- Release notes now include dependency management section with vulnerability scan results
- VERSIONING.md updated to include dependency information in release notes

### Security

- **Build-Time Asset Signing**: All Docker images signed with Cosign keyless method
- **Release Attestation**: JSON manifest with cryptographic signatures for auditability
- **Keyless Signing**: Uses GitHub OIDC tokens (no secrets stored)
- **Transparency**: All signatures recorded in public Rekor transparency log
- **Dependency Tracking**: Complete audit trail of all dependency changes in git history

---

## [2.0.0] - 2026-05-09

### Added

#### New Features

- **Complete rewrite as Discord.js bot** - Migrated from browser extension to Discord bot for better accessibility
- **Code Redemption System** - `/redeem <code>` command to redeem game codes
- **User Statistics** - `/stats` command to view personal redemption statistics
- **Code History Tracking** - `/codes [count]` command to view history of redeemed codes
- **Admin Commands** - `/admin status` and `/admin refresh` for bot management
- **Message History Backfill** - `/backfill` command to recover missed codes from channel history
- **SQLite Database** - Local data persistence with automatic backups
- **Docker Deployment** - Containerized bot ready for production deployment
- **Comprehensive Logging** - Winston-based logging with daily rotation

#### Code Quality

- Full TypeScript implementation with strict type checking
- ESLint configuration for code consistency
- Prettier code formatting
- Comprehensive project documentation
- Development and production build configurations

#### Security Features

- **Input Validation** - Code format validation and sanitization
- **Rate Limiting** - Backfill command rate limiting to prevent abuse
- **Error Handling** - Graceful error handling without exposing sensitive information
- **Secure Secrets Management** - Environment variable support for API tokens
- **Git Hooks** - Husky pre-commit and commit-msg hooks with Gitleaks secret scanning
- **Dependency Scanning** - GitHub Actions workflow for dependency vulnerability checks

#### Development Infrastructure

- **Mise Configuration** - Task runner for standardized development commands
- **GitHub Actions** - 5 CI/CD workflows:
  - Pull Request validation
  - Code quality checks (ESLint, format validation)
  - Dependency vulnerability scanning
  - Docker image building and publishing
  - Secret scanning (Gitleaks + TruffleHog)
- **Husky Git Hooks** - Pre-commit Gitleaks secret detection and ESLint
- **CODEOWNERS** - Code ownership enforcement for critical files
- **Branch Protection** - Main branch protection requiring PR reviews

### Security Improvements

- **Secret Detection Pipeline** (Three-Layer Defense)
  - Layer 1: Pre-commit Gitleaks hook (local detection before push)
  - Layer 2: Gitleaks GitHub Actions (CI-level validation)
  - Layer 3: TruffleHog GitHub Actions (additional entropy-based detection)
  - **Impact**: Prevents accidental credential exposure to public repositories

- **Access Control**
  - Only specified actors can push to main branch
  - Code review requirement (1 approval) for all changes
  - Admin bypass prevented even for repository owners
  - **Impact**: Ensures all code changes are reviewed before deployment

- **Dependency Security**
  - Automated dependency updates via Dependabot
  - Vulnerability scanning via GitHub's dependency check
  - Manual review required for security updates
  - **Impact**: Reduces window of exposure to known vulnerabilities

- **Data Protection**
  - Secrets excluded from version control (.env in .gitignore)
  - Environment variable support for sensitive configuration
  - No hardcoded credentials in codebase
  - **Impact**: Credentials cannot be exposed through code review or git history

- **Build Security**
  - All GitHub Actions workflows use minimal required permissions
  - PR code runs without access to secrets
  - GITHUB_TOKEN restricted to read-only for PR jobs
  - **Impact**: Limits blast radius of compromised Actions workflows

### Changed

- Initial release - no changes from previous version

### Deprecated

- N/A for initial release

### Removed

- N/A for initial release

### Fixed

- N/A for initial release (initial release)

---

## Release Template

Use this section as a template when creating new releases. Replace [X.Y.Z] with your version, [Unreleased] with the date, and fill in the sections below.

### Added

- List of new features added in this release

### Changed

- List of changed functionality

### Deprecated

- Features marked for future removal

### Removed

- Features removed in this release

### Fixed

- Bug fixes in this release

### Security

- Security improvements and patches in this release

---

## How to Maintain This Changelog

### When Adding Commits

1. After merging a PR, add an entry under **[Unreleased]** section
2. Use appropriate category: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, or **Security**
3. Write in user-friendly language (not just commit messages)
4. Include context: "what changed" and "why it matters"

### When Creating a Release

1. Review all entries under **[Unreleased]**
2. Group related items for clarity
3. Expand commit messages into human-readable descriptions
4. Highlight security improvements explicitly
5. Move all changes under a new version header `## [X.Y.Z] - YYYY-MM-DD`
6. Create new empty **[Unreleased]** section
7. Create GitHub Release with same content
8. Link to this CHANGELOG in release notes

### Format Guidelines

**✅ Good Example:**

```markdown
### Fixed

- Prevent duplicate code submissions when multiple users redeem same code simultaneously (race condition in codeManager)
- Resolve 500 error when redeeming expired codes (now returns user-friendly message)

### Security

- Update discord.js to patch potential XSS vulnerability in message parsing
```

**❌ Poor Example:**

```markdown
### Fixed

- fix bug
- update deps
```

### Security Changes

Security changes require special attention:

1. **Include security impact** - Explain what vulnerability was fixed
2. **Include severity** - Critical/High/Medium/Low
3. **Include CVE if applicable** - Reference CVE numbers
4. **Include workarounds** - For users on older versions
5. **Include upgrade guidance** - How quickly they need to upgrade

**Example Security Entry:**

```markdown
### Security

- **Critical**: Fix authentication bypass in `/admin` commands [CVE-2026-12345]
  - Issue: Insufficient permission validation allowed unprivileged users to execute admin actions
  - Fix: Added explicit role-based access control checks
  - Impact: Affected users should upgrade immediately
  - Workaround: None - upgrade required

- **High**: Update dependencies for XSS vulnerability
  - Dependencies: discord.js 14.25.0 → 14.26.4
  - Impact: Potential code injection through user message content
```

---

## Version History

| Version | Release Date | Category               | Key Changes                                             |
| ------- | ------------ | ---------------------- | ------------------------------------------------------- |
| 2.0.0   | 2026-05-09   | Initial Public Release | Complete rewrite as Discord bot with security hardening |

---

## References

- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [GitHub: Managing Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
