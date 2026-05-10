# Security Policy

This document describes how to report security vulnerabilities and provides contact information for the Idle Champions Code Redeemer Bot project. It outlines the project's **Coordinated Vulnerability Disclosure (CVD)** policy with clear timeframes for response and expectations for how the project will address reported security issues.

## Coordinated Vulnerability Disclosure Policy [OSPS-VM-01.01]

This project follows industry best practices for coordinated vulnerability disclosure. This policy ensures that security vulnerabilities are addressed responsibly with adequate time for patches before public disclosure.

### Policy Goals

The Idle Champions Code Redeemer Bot project is committed to:

1. **Responsible Disclosure** - All reported vulnerabilities are addressed responsibly and promptly
2. **User Protection** - Users are given adequate time to apply patches before vulnerabilities are publicly disclosed
3. **Transparency** - Clear communication about the vulnerability status and timeline
4. **Collaboration** - Work constructively with security researchers to resolve issues

### Vulnerability Response Timeline [OSPS-VM-01.01]

This project commits to the following response timeframes for security vulnerabilities:

| Phase | Timeframe | Description |
|-------|-----------|-------------|
| **Initial Response** | **1 business day** | Acknowledgment of vulnerability report; triage and severity assessment |
| **Investigation** | **2-5 business days** | Analysis of vulnerability; determination of affected versions and components |
| **Development** | **5-14 business days** | Creation and testing of security fix; verification that patch resolves issue |
| **Release** | **7-21 business days (total)** | Security patch released on main branch; all supported versions updated |
| **Disclosure** | **30 days after release** | Public disclosure in security advisory after users have time to patch |

**Critical/High Severity Vulnerabilities** (≥7.0 CVSS): 
- Target response: Within 1-2 business days
- Target patch: Within 5 business days
- Expedited release process (emergency releases permitted)

**Medium Severity Vulnerabilities** (4.0-6.9 CVSS):
- Target response: Within 2-3 business days
- Target patch: Within 10 business days
- Standard release process

**Low Severity Vulnerabilities** (<4.0 CVSS):
- Target response: Within 3-5 business days
- Target patch: Within 14 business days (can be bundled with next regular release)

### Reporting Process

**Step 1: Submit Vulnerability Report**
- Use GitHub's private vulnerability reporting (preferred)
- Or contact maintainer via email
- Do NOT open public GitHub issues for security vulnerabilities

**Step 2: Receive Acknowledgment**
- Project maintainer will acknowledge receipt within 1 business day
- You will receive a tracking ID for the vulnerability
- Estimated timeline for assessment provided

**Step 3: Assessment & Analysis**
- Vulnerability severity assessed using CVSS v3.1 scoring
- Affected versions and components identified
- Impact on users determined
- Mitigation options evaluated

**Step 4: Fix Development**
- Patch developed for all affected versions
- Patch tested thoroughly
- Verification that exploit is fixed

**Step 5: Patch Release**
- Emergency release created if severity warrants expedited timeline
- Security advisory drafted with CVE ID (if applicable)
- Users notified via GitHub security advisory
- Deployment guidance provided

**Step 6: Public Disclosure**
- Security advisory published after 30 days (minimum)
- Sufficient time given for users to apply patches
- Credit given to reporter (if desired)
- Post-incident analysis conducted

### Expectations & Commitments

#### What Reporters Can Expect

✅ **Prompt Response**: Initial acknowledgment within 1 business day
✅ **Professional Treatment**: Respectful, confidential handling of report
✅ **Clear Timeline**: Regular updates on status and estimated resolution
✅ **Credit**: Recognition in security advisory (if desired)
✅ **Safe Harbor**: Good faith disclosures are protected from legal action
✅ **Good Faith**: Commitment to timely patch development and release

#### What the Project Commits to

✅ **Serious Treatment**: All reports reviewed thoroughly regardless of perceived severity
✅ **Confidentiality**: Details kept confidential until 30 days after patch release
✅ **No Delays**: Patches released on schedule without unnecessary delays
✅ **Transparency**: Clear communication about status and timeline
✅ **Patching**: All supported versions updated (last 3 releases minimum)
✅ **Testing**: Security patches thoroughly tested before release
✅ **Documentation**: Security advisory includes clear explanation and mitigation steps
✅ **Monitoring**: Monitoring for public disclosure of unreported vulnerabilities

### Supported Versions for Security Updates

Security patches are provided for:

- **Current stable version** - Latest release on main branch
- **Previous minor versions** - Last 3 released versions receive security patches

**Example**:
- Version 2.5 (latest) - ✅ Receives patches
- Version 2.4 - ✅ Receives patches
- Version 2.3 - ✅ Receives patches
- Version 2.2 - ❌ No longer supported (upgrade to 2.3 or later)
- Version 1.x - ❌ No longer supported (upgrade to 2.x)

### Out-of-Scope Issues

The following are **not** considered security vulnerabilities and should be reported as regular bug reports:

- Social engineering issues (education/awareness)
- Documentation or configuration problems
- Application-specific issues (game-specific edge cases)
- Features requests or design improvements
- User error or misuse of the application
- Third-party service vulnerabilities (report to service provider)
- Already-known public vulnerabilities

### Security Researcher Recognition

This project recognizes and appreciates the work of security researchers. Reporters can request:

- ✅ Recognition in security advisory
- ✅ Credit in CHANGELOG.md
- ✅ Link to researcher's website/profile
- ✅ Public or anonymous disclosure (your choice)

**To Opt In**: Mention your preference in the initial vulnerability report.

### Contact Information for Security Issues

**Preferred Method**: GitHub Security Advisory
- Go to [Security](https://github.com/BigMichi1/idle-code-redeemer/security) tab
- Click **"Report a vulnerability"**
- Fill in vulnerability details
- Submit report (ensures direct maintainer contact)

**Alternative Method**: Email
- Email security reports to maintainer (check SECURITY_CONTACTS.md)
- Use clear subject: `[SECURITY] Vulnerability Report - {brief description}`
- Include all information from "What to Include in a Report" section
- Response time: Within 1 business day

### Vulnerability Disclosure Examples

#### Example 1: Critical SQL Injection

```
Timeline:
- Day 1 (Monday): Vulnerability reported via GitHub Security Advisory
- Day 1 (Monday): Acknowledgment sent; assessed as CRITICAL (CVSS 9.8)
- Day 2-3: Investigation completed; vulnerability confirmed in version 2.4
- Day 4: Patch developed and tested
- Day 5 (Friday): Emergency release 2.4.1 published with patch
- Day 6+: Users apply patch (30 days to patch)
- Day 36 (Tuesday): Public disclosure in security advisory
```

#### Example 2: Medium Severity API Issue

```
Timeline:
- Day 2 (Tuesday): Vulnerability reported via email
- Day 3 (Wednesday): Acknowledgment sent; assessed as MEDIUM (CVSS 5.5)
- Day 4-5: Investigation; affects versions 2.2, 2.3, 2.4
- Day 6-9: Patch developed and tested for all versions
- Day 10 (Thursday): Release 2.4.1 published with patch; 2.3.2, 2.2.4 updated
- Day 11+: Users apply patch (30 days to patch)
- Day 40: Public disclosure in security advisory
```

### Incident Response & Escalation

**If Vulnerability Is Publicly Disclosed**:

If a vulnerability is publicly disclosed before the 30-day disclosure period:

1. Patch release immediately accelerated (emergency release)
2. Users notified of urgent security update
3. Public advisory released immediately
4. Incident post-mortem conducted
5. Process improvements implemented to prevent future issues

**Critical Issues**:

For critical vulnerabilities (CVSS ≥ 9.0):

- Maintainer notified immediately upon report
- Response prioritized above all other work
- Expedited review and patching process
- Users proactively notified
- Public disclosure may be accelerated if needed for user safety

### Security Advisory Format

Each security advisory includes:

```
Title: [Security Advisory] {Vulnerability Title} [CVE-XXXX-XXXXX]
Severity: CRITICAL/HIGH/MEDIUM/LOW (CVSS Score)

Description:
- What is the vulnerability?
- Why is it important?
- Who is affected?

Affected Versions:
- 2.4.0 and earlier

Patched Versions:
- 2.4.1 (latest)
- 2.3.2
- 2.2.4

Workaround (if available):
- Interim mitigation steps

Fix Instructions:
- How to apply the patch
- Where to find security update

Impact:
- Potential attack scenarios
- User data at risk
- System compromise potential

Timeline:
- Reported: [Date]
- Assessed: [Date]
- Patched: [Date]
- Disclosed: [Date]

Credit:
- Reporter name (if desired)
- Organization (if applicable)
```

### Monitoring & Vulnerability Prevention

This project actively monitors for security issues:

✅ **Automated Scanning**:
- Gitleaks - Secrets detection in code
- GitHub dependency scanning - Vulnerable dependencies
- CodeQL - Security code analysis
- SBOM verification - Software bill of materials

✅ **Manual Review**:
- Code review process (CODEOWNERS requirement)
- Security architecture review
- Threat assessment for new features
- Dependency selection criteria

✅ **Public Vulnerability Tracking**:
- Monitor CVE databases for dependencies
- Subscribe to security mailing lists
- Track GitHub security advisories
- Review Common Weakness Enumeration (CWE) list

## Public Vulnerability Disclosures [OSPS-VM-04.01]

The project publicly discloses known vulnerabilities and security advisories in a predictable, accessible location for user awareness and transparency.

See [SECURITY_ADVISORIES.md](SECURITY_ADVISORIES.md) for:

- **Active Security Advisories** - Current vulnerabilities and their status
- **Known Security Issues** - Documented limitations and workarounds
- **Fixed Vulnerabilities** - Historical CVE information and remediation
- **Vulnerability Timeline** - Chronological history of security issues
- **CVE Information** - CVE IDs, CVSS scores, CWE classifications
- **Detection Instructions** - How to determine if you are vulnerable
- **Mitigation Strategies** - Workarounds and temporary fixes
- **Remediation Steps** - Step-by-step fixing procedures
- **Advisory Format** - Standard format for all future advisories
- **Subscription Information** - How to receive notifications

For private vulnerability reporting (not for public advisories), see [SECURITY_CONTACTS.md](SECURITY_CONTACTS.md).

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

For issues you cannot report via GitHub, contact the security team directly:

- **Email**: See [SECURITY_CONTACTS.md](SECURITY_CONTACTS.md) for actual contact information
- **Response time**: Security issues will be reviewed within 1 business day per CVD Policy
- **Privacy**: All reports are treated confidentially until 30 days after patch release

For complete contact information, multiple reporting methods, and FAQ, see [SECURITY_CONTACTS.md](SECURITY_CONTACTS.md).

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

## System Design & Architecture [OSPS-SA-01.01]

The project includes comprehensive design documentation describing all actors and actions within the system. See [docs/system-design.md](docs/system-design.md) for:

- **Actors**: Discord users, Discord servers, Discord bot, Idle Champions API, SQLite database
- **Actions**: 9 slash commands, message scanning, backfill operations, API interactions, database operations
- **Data Flows**: Complete flow diagrams for each major operation
- **Architecture**: Component interactions, subsystems, deployment
- **Data Models**: User credentials, code history, backfill state, API logs
- **Security**: Credential management, encryption, access control, data isolation
- **Error Handling**: API failures, database failures, message handler resilience

## External Software Interfaces & API Reference [OSPS-SA-02.01]

The project includes complete API documentation for all external software interfaces. See [docs/api-reference.md](docs/api-reference.md) for:

- **Discord Bot API**: 9 slash commands with parameters, responses, and error handling
- **Command Parameters**: Detailed description of each parameter and valid values
- **Response Formats**: Discord embeds, ephemeral responses, data structures
- **Error Responses**: Error codes, causes, and resolution steps
- **Message Event API**: Automatic code detection patterns and behavior
- **Rate Limiting**: Discord API limits, Idle Champions API limits, application throttling
- **Authentication**: User credential storage, API authentication, security properties
- **Data Structures**: JSON schemas for requests and responses
- **Usage Examples**: Complete examples for common workflows
- **Backward Compatibility**: API stability and breaking changes tracking

## Security Assessment [OSPS-SA-03.01]

The project performs a comprehensive security assessment to understand potential security threats and risks. See [docs/security-assessment.md](docs/security-assessment.md) for:

- **Threat Model**: Identified actors and attack vectors
- **Vulnerability Assessment**: 7 major threat areas analyzed
  - Credential Management (HIGH impact, MEDIUM likelihood)
  - External API Communication (MEDIUM impact, with known SSL issue)
  - Discord Integration (MEDIUM impact, LOW likelihood)
  - Dependency Vulnerabilities (LOW impact, MEDIUM likelihood)
  - Database Security (MEDIUM impact, MEDIUM likelihood)
  - Code & Build Security (LOW impact, MEDIUM likelihood)
  - Operational Security (MEDIUM impact, HIGH likelihood)
- **Risk Summary**: Risk matrix with likelihood, impact, and mitigation status
- **Security Controls**: Preventive, detective, and responsive controls
- **Known Issues**: SSL certificate issue, plaintext credentials, single admin
- **Recommendations**: CRITICAL, HIGH, MEDIUM, and LOW priority actions
- **Best Practices**: For both users and developers
- **Regulatory Compliance**: Data protection and policy considerations
- **Overall Risk Assessment**: MEDIUM (with strong mitigations)

## Automated Test Suites & CI/CD Testing [OSPS-QA-06.01]

All code is validated through automated test suites running in CI/CD pipelines before merging to the primary branch.

**See [docs/testing-strategy.md](docs/testing-strategy.md) for:**
- ✅ All automated test suites (build, lint, security, type checking, formatting) [OSPS-QA-06.01]
- ✅ How each test suite works and what it verifies [OSPS-QA-06.01]
- ✅ Running tests locally before submission [OSPS-QA-06.01]
- ✅ CI/CD pipeline flow and test execution [OSPS-QA-06.01]
- ✅ Test results visibility to all contributors [OSPS-QA-06.01]
- ✅ Consistent test environment (Docker) [OSPS-QA-06.01]
- ✅ Troubleshooting failed tests [OSPS-QA-06.01]

**Test Suites Required to Pass:**
1. Build & Compilation (TypeScript strict mode) - `mise run build`
2. Code Quality/Linting (ESLint) - `mise run lint`
3. Security Scanning (CodeQL, dependencies, secrets)
4. Type Safety (TypeScript strict mode) - part of build
5. Code Formatting (Prettier) - `mise run format`

**Local Testing Before PR:**
```bash
mise run build      # Compile and check types
mise run lint:fix   # Fix linting issues
mise run format     # Format code
bun audit           # Check for vulnerabilities
```

**Failing tests block PR merge.** Contributors must ensure all tests pass locally before submitting.

## Status Checks & Branch Protection [OSPS-QA-03.01]

All commits to the primary branch must pass automated status checks before merging. No commits can be merged if required checks fail.

**See [docs/status-checks.md](docs/status-checks.md) for:**
- ✅ Required status checks configuration [OSPS-QA-03.01]
  - DCO Sign-Off (legal authorization)
  - Docker Build (runtime validation)
  - CodeQL (security scanning)
  - Dependency Review (vulnerability prevention)
  - Secret Scanning (credential detection)
  - OpenSSF Scorecards (compliance tracking)
- ✅ Branch protection rules (cannot be bypassed by default) [OSPS-QA-03.01]
- ✅ How status checks work in pull requests [OSPS-QA-03.01]
- ✅ Troubleshooting failed checks [OSPS-QA-03.01]
- ✅ Manual bypass procedures (admin-only, logged) [OSPS-QA-03.01]

**Key Requirement:**
No pull request can be merged if:
- Any required status check is failing
- Optional checks not configured as blockers (only advisory)
- Pull request lacks required code review approval

**How It Helps:**
- Prevents defective code from being merged
- Ensures security checks are not skipped
- Detects vulnerable dependencies before release
- Verifies legal authorization (DCO)
- Maintains code quality standards

## Developer Certificate of Origin (DCO) [OSPS-LE-01.01]

This project requires all code contributors to assert that they are legally authorized to make the associated contributions.

**See [DCO.md](DCO.md) and [CONTRIBUTING.md#developer-certificate-of-origin](CONTRIBUTING.md#developer-certificate-of-origin) for:**
- ✅ Developer Certificate of Origin (DCO) requirements [OSPS-LE-01.01]
- ✅ How to sign off on commits (`git commit -s`) [OSPS-LE-01.01]
- ✅ Git configuration for easy sign-offs [OSPS-LE-01.01]
- ✅ Amendment procedures for unsigned commits [OSPS-LE-01.01]
- ✅ GitHub Actions status check enforcement [OSPS-LE-01.01]
- ✅ Legal assertions required in every commit [OSPS-LE-01.01]

**Enforcement:**
All commits must include a "Signed-off-by" trailer certifying the contributor has the legal right to submit the code. Pull requests with unsigned commits will fail CI/CD checks and cannot be merged.

**Example Sign-Off:**
```bash
git commit -s -m "feat: add new feature"
# Results in: Signed-off-by: Jane Doe <jane@example.com>
```

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
