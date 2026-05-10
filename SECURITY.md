# Security Policy

This document describes how to report security vulnerabilities and provides contact information for the Idle Champions Code Redeemer Bot project.

## Reporting Security Vulnerabilities

**Please do NOT open a public GitHub issue for security vulnerabilities.** This puts all users at risk until the vulnerability is fixed.

Instead, report security issues privately using one of the methods below:

### GitHub Security Advisory

Use GitHub's private vulnerability reporting feature:

1. Go to the [Security](https://github.com/BigMichi1/idle-code-redeemer/security) tab of this repository
2. Click **"Report a vulnerability"**
3. Fill in the vulnerability details
4. Submit the report

**This is the preferred method** and ensures direct communication with maintainers.

### Email Contact

For issues you cannot report via GitHub, contact the maintainer directly:

- **Email**: [Check repository contact methods]
- **Response time**: Security issues will be reviewed within 3 business days

## What to Include in a Report

When reporting a security vulnerability, please include:

1. **Description** - What is the vulnerability?
2. **Impact** - How severe is it? Can it leak user data, credentials, or compromise the Discord bot?
3. **Reproduction Steps** - How can the vulnerability be triggered?
4. **Affected Versions** - Which versions of the bot are affected?
5. **Suggested Fix** (optional) - Do you have a proposed fix?

## Security Best Practices for Users

When running this Discord bot, follow these security practices:

### Credentials

- **Never commit `.env` files** - Always use `.env.example` as a template
- **Keep Discord token secure** - Don't share your bot token with anyone
- **Rotate tokens** if they are ever exposed - Regenerate in Discord Developer Portal
- **Use environment variables** for all sensitive data

### Database

- **Back up `data/idle.db`** regularly - It contains user credentials
- **Restrict database file permissions** - Only the bot process should access it
- **Never commit the database to git** - It's already in `.gitignore`

### Deployment

- **Use HTTPS** when deploying to production
- **Keep dependencies updated** - Run `mise run update` regularly
- **Enable branch protection** - Require reviews before merging code
- **Scan for secrets** - Pre-commit hooks automatically scan for exposed credentials (Gitleaks + TruffleHog)

### Secrets Detection

This project uses multiple layers of secret scanning:

- **Pre-commit hooks** - Scan staged files for secrets (Gitleaks)
- **GitHub Actions** - Scan every push and PR (Gitleaks + TruffleHog)
- **Environment file checker** - Ensures `.env` files are never tracked

See [docs/github-secrets.md](docs/github-secrets.md) for detailed secret management information.

## Supported Versions

Security updates are provided for:

- **Current stable version** - Latest release on main branch
- **Previous minor versions** - Last 3 versions receive critical security fixes

Older versions are not actively supported. Please upgrade to the latest version for security patches.

## Security Measures in This Project

This project implements the following security controls:

### Access Control [OSPS-AC-02.01, OSPS-AC-03.01, OSPS-AC-03.02]

- ✅ Minimal permissions for collaborators (CODEOWNERS enforced)
- ✅ Direct commits to main blocked (branch protection required)
- ✅ Main branch cannot be deleted
- ✅ Only specified actors can push to main

### Build & Deployment [OSPS-BR-01.01, OSPS-BR-01.03]

- ✅ CI/CD metadata is sanitized (no injection vulnerabilities)
- ✅ Pull request code isolated from credentials
- ✅ Secret access only on main branch pushes

### Data Protection [OSPS-BR-07.01]

- ✅ Sensitive files excluded from git (.env, \*.db)
- ✅ Pre-commit hooks detect secrets (Gitleaks)
- ✅ GitHub Actions scan for credential leaks (Gitleaks + TruffleHog)
- ✅ Automatic environment file validation

### Dependencies [OSPS-QA-02.01]

- ✅ All dependencies tracked in package.json and bun.lock (with frozen-lockfile CI verification)
- ✅ Dependabot monitors for vulnerable packages
- ✅ Dependency review required on PRs

### Build Artifacts [OSPS-QA-05.01, OSPS-QA-05.02]

- ✅ No generated executable artifacts in git
- ✅ No unreviewable binary artifacts committed
- ✅ Build happens at deployment time

## Dependency Management [OSPS-BR-05.01]

Standardized tooling is used for all dependency ingestion:

- **Package Manager**: Bun (standardized for Node.js ecosystem)
- **Manifests**: `package.json` (declares dependencies), `bun.lock` (ensures reproducibility)
- **CI/CD**: All workflows use `--frozen-lockfile` to prevent unexpected dependency changes
- **Vulnerability Scanning**: `bun audit` on every push detects known vulnerabilities
- **Lock File Tracking**: `bun.lock` is tracked in git for bit-for-bit reproducible builds
- **Container Builds**: Docker uses frozen lock files to guarantee identical runtime environments
- **Update Process**: Documented safe dependency update procedures in [docs/dependency-management.md](docs/dependency-management.md)

For complete dependency management documentation, see [docs/dependency-management.md](docs/dependency-management.md).

## Cryptographic Signing & Release Attestation [OSPS-BR-06.01]

All official releases are cryptographically signed using **Cosign (Keyless OIDC)**:

- ✅ **Docker Images**: Signed at build time in GitHub Actions workflow
- ✅ **Release Attestations**: JSON manifest with all artifact hashes and metadata, signed with Cosign
- ✅ **Keyless Signing**: Uses GitHub OIDC tokens; no secrets stored
- ✅ **Transparent**: All signatures recorded in public Rekor transparency log
- ✅ **Verifiable**: Anyone can verify signatures offline using Sigstore public keys
- ✅ **Standards**: Aligns with SLSA framework and OpenSSF best practices

### Release Assets Signed

1. **Docker Images** (Published to GHCR)
   - Full version tag: `ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0`
   - Major.minor tag: `ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0`
   - Major tag: `ghcr.io/bigmichi1/idle-code-redeemer-bot:2`
   - All images signed using Cosign keyless method

2. **Release Attestation** (Attached to GitHub Release)
   - `attestation.json` - Complete release metadata with build info
   - `attestation.sig` - Cosign signature over attestation
   - `attestation.crt` - Cosign certificate for verification

### Verify Release Signatures

```bash
# Install Cosign
curl -sSL https://github.com/sigstore/cosign/releases/download/v2.2.0/cosign-linux-amd64 -o cosign
chmod +x cosign

# Enable keyless verification
export COSIGN_EXPERIMENTAL=1

# Verify Docker image
cosign verify ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0

# Verify attestation files (available in GitHub release)
cosign verify-blob \
  --signature attestation.sig \
  --certificate attestation.crt \
  attestation.json
```

For comprehensive signing verification instructions, see [docs/cryptographic-signing.md](docs/cryptographic-signing.md).

## Dependency Management & Tracking [OSPS-DO-06.01]

This documentation includes comprehensive information about how dependencies are selected, obtained, and tracked. This documentation is published with all releases to ensure transparency.

### How Dependencies Are Selected

Documented selection criteria in [docs/dependency-management.md](docs/dependency-management.md):

- ✅ **Necessity**: Solves a real problem
- ✅ **Maturity**: Production-ready (v1.0+)
- ✅ **Security**: No known vulnerabilities
- ✅ **Quality**: Well-documented, active maintenance
- ✅ **Size**: Reasonable bundle size
- ✅ **License**: Permissive licenses (MIT, Apache 2.0, BSD, ISC)

### How Dependencies Are Obtained

- **Package Manager**: Bun (standardized for Node.js ecosystem)
- **Installation Method**: `bun install` (via Mise wrapper task)
- **Manifests**:
  - `package.json` - Declares all dependencies (production + dev)
  - `bun.lock` - Locks exact versions for reproducibility
- **Verification**: `bun audit` scans for vulnerabilities on every push
- **Automation**: Dependabot creates PRs for dependency updates weekly

### How Dependencies Are Tracked

- **Git History**: Every dependency change tracked with commit message
- **Lock File**: `bun.lock` records exact versions of all packages
- **CHANGELOG.md**: Dependency updates documented in release notes
- **Rekor Log**: Cosign signatures recorded in public transparency log
- **GitHub**: Dependency graph visualization available in repo settings

### Published with Every Release

When a release is created:

1. **Release Notes Include**:
   - Link to [Dependency Management Documentation](docs/dependency-management.md)
   - Number of production and development dependencies
   - Vulnerability scan results
   - Summary of dependency updates

2. **Documentation Published**:
   - This file (SECURITY.md) - Available in GitHub repo
   - [docs/dependency-management.md](docs/dependency-management.md) - Full documentation
   - [CHANGELOG.md](CHANGELOG.md) - Dependency changes per version
   - [VERSIONING.md](VERSIONING.md) - Release process documentation

3. **Container Images Locked**:
   - Docker images include frozen dependency set
   - Only production dependencies included
   - Verifiable via `docker inspect` or attestation

For complete dependency management details, see [docs/dependency-management.md](docs/dependency-management.md).

## Code Contribution Requirements [OSPS-GV-03.02]

The project maintains comprehensive contributor guidelines that serve as the source of truth for both contributors and code reviewers.

**See [CONTRIBUTING.md](CONTRIBUTING.md) for:**
- ✅ Code quality requirements (linting, TypeScript strict mode, best practices) [OSPS-GV-03.02]
- ✅ Testing requirements (unit, integration, manual testing) [OSPS-GV-03.02]
- ✅ Documentation requirements (code docs, CHANGELOG, user docs) [OSPS-GV-03.02]
- ✅ Submission guidelines (PR description, checklist, automated checks) [OSPS-GV-03.02]
- ✅ Code review criteria for maintainers [OSPS-GV-03.02]
- ✅ Security standards for contributions [OSPS-GV-03.02]

**Acceptance Criteria:**
All contributions must pass code quality checks (ESLint, Prettier, TypeScript strict), include tests, update CHANGELOG.md, and pass code review.

## Project Members & Governance [OSPS-GV-01.01, OSPS-GV-01.02]

This project maintains comprehensive documentation of project members, their roles, and access to sensitive resources.

**See [GOVERNANCE.md](GOVERNANCE.md) for:**
- ✅ List of active maintainers and their roles [OSPS-GV-01.01]
- ✅ Detailed descriptions of roles and responsibilities [OSPS-GV-01.02]
  - Owner & Lead Maintainer: Code review, releases, security response, repository settings
  - Future Maintainer role: Code review, release approval, security triage
  - Security Officer role: Vulnerability response, security audits, secret management
  - Release Manager role: Versioning, changelog, release notes
- ✅ Access to sensitive resources (repository, secrets, Docker images, databases) [OSPS-GV-01.01]
- ✅ Decision-making process and code review procedures [OSPS-GV-01.02]
- ✅ Contact information for security issues [OSPS-VM-02.01]
- ✅ Future maintainer criteria and onboarding process [OSPS-GV-01.02]

**Current Leadership:**
- **Owner & Lead Maintainer**: @BigMichi1 (michael@bigmichi1.de)

For vulnerability reporting and sensitive inquiries, see [GOVERNANCE.md#communication](GOVERNANCE.md#communication).

## Build Instructions & Development Documentation [OSPS-DO-07.01]

This project provides comprehensive instructions on how to build the software from source, including all required libraries, frameworks, SDKs, and dependencies.

### Build Documentation

- **[BUILD.md](BUILD.md)** - Complete build instructions including:
  - Required software (Mise, Bun, Git, Docker)
  - Required frameworks (discord.js, TypeScript, etc.)
  - Installation and setup steps
  - Different build types (development, production, Docker)
  - Build troubleshooting

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Developer contribution guidelines including:
  - Development setup and environment configuration
  - Building the project for development
  - Code standards and best practices
  - Testing procedures
  - Git workflow and commit conventions

### Quick Build Command

```bash
# Install all required dependencies
mise run install

# Build the project
mise run build

# Run the bot
bun run dist/bot/bot.js
```

See [BUILD.md](BUILD.md) for comprehensive build instructions and troubleshooting.

## Acknowledgments

Thank you to anyone who responsibly reports security vulnerabilities to help keep this project secure.

## References

- [GitHub: Security Advisories](https://docs.github.com/en/code-security/security-advisories)
- [OWASP: Vulnerability Disclosure Checklists](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerability_Disclosure_Cheat_Sheet.html)
- [OpenSSF: Best Practices Badge](https://bestpractices.coreinfrastructure.org/)
- [Dependency Management](docs/dependency-management.md) - Standardized tooling and lock file strategy
- [Cryptographic Signing](docs/cryptographic-signing.md) - Release signatures and verification
