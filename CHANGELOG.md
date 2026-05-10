# Changelog

All notable changes to the Idle Champions Code Redeemer Bot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Public Vulnerability Disclosures [OSPS-VM-04.01]** - Security advisor publication
  - NEW: [SECURITY_ADVISORIES.md](SECURITY_ADVISORIES.md) - Public vulnerability advisories
  - **Active Advisories**:
    - 0 active critical security advisories
    - Known issues documented and mitigated
  - **Known Issues Documentation**:
    - Idle Champions API SSL Certificate (MEDIUM severity, CVSS 5.5)
    - Issue description and technical details
    - Root cause analysis (external service limitation)
    - Impact assessment and who is affected
    - Vulnerability determination procedure
      - Network security checklist
      - Risk assessment tools
      - Diagnostic commands
    - Mitigation strategies (5 options ranked by effectiveness)
      - VPN usage (recommended)
      - Private network infrastructure
      - DNS over HTTPS (DoH)
      - Network monitoring
      - Regular updates
    - Remediation instructions for users and maintainers
    - Timeline history (v2.0 discovery through v2.3 documentation)
    - Workarounds (temporary and application-level solutions)
  - **Vulnerability Timeline**:
    - Chronological listing of all issues
    - Severity levels (CRITICAL/HIGH/MEDIUM/LOW/KNOWN ISSUE)
    - Status indicators
    - 2026 timeline table
  - **CVE Information**:
    - CVE authority references
    - CVE database links (MITRE, NVD)
    - CVE search instructions
    - CVE subscription methods
    - NVD mailing list information
    - GitHub security alerts
    - RSS feed for notifications
  - **Vulnerability Detection**:
    - How consumers determine if vulnerable
    - Shell commands for checking vulnerability
    - Configuration verification
    - Network diagnostic scripts
    - Risk assessment checklist
  - **Mitigation and Remediation**:
    - General remediation process
    - Specific instructions for known issues
    - Step-by-step fix procedures
    - Testing and verification
    - Monitoring after patching
  - **Advisory Format**:
    - Standard format for all future advisories
    - Sections and required information
    - Severity and CVSS scoring
    - Affected and patched versions
    - CWE classification
  - **Subscription and Notifications**:
    - GitHub Security Advisories
    - GitHub Releases
    - Email notifications
    - RSS feed
  - **Compliance**:
    - CVSS v3.1 compliance
    - CWE enumeration
    - CVE standards
    - OpenSSF Best Practices (OSPS-VM-04.01)
  - **Related Documentation**:
    - Links to SECURITY.md, SECURITY_CONTACTS.md, security-assessment.md
    - Threat model references
    - Vulnerability reporting process
  - [OSPS-VM-04.01] compliance

- **Private Vulnerability Reporting Channels [OSPS-VM-03.01]** - Security contact methods
  - NEW: [SECURITY_CONTACTS.md](SECURITY_CONTACTS.md) - Complete vulnerability reporting documentation
  - **Primary Reporting Methods**:
    - GitHub Security Advisory (preferred method)
      - Private, tracked, secure
      - Direct to maintainers
      - Built-in GitHub feature
      - Acknowledgment within 1 business day
    - Email to security contact
      - For researchers without GitHub account
      - PGP/GPG encryption supported
      - Attachments allowed
      - Acknowledgment within 1 business day
    - GitHub private messaging
      - Integrated with GitHub interface
      - Can escalate to Security Advisory
      - Acknowledgment within 1 business day
  - **Contact Information**:
    - Primary security contact listed
    - Backup contact for redundancy
    - Multiple communication methods
    - Response time commitments
  - **Privacy & Confidentiality**:
    - All reports treated as confidential
    - No third-party disclosure without consent
    - 30-day minimum before public disclosure
    - Details shared only with minimum necessary team
  - **Encryption Support**:
    - PGP/GPG key publishing (when available)
    - Email encryption instructions
    - GitHub Security Advisory handles encryption automatically
  - **Report Guidelines**:
    - Essential information required
    - Helpful optional information
    - Proof-of-concept submission
    - CVSS scoring guidance
  - **Tracking & Status Updates**:
    - Tracking IDs provided
    - Milestone-based status updates
    - Initial acknowledgment within 1 business day
    - Closure notification with details
  - **Researcher Recognition**:
    - Public credit option
    - Anonymous credit option
    - CVE credit listing
    - No recognition option
  - **FAQ Section**:
    - Report confidentiality
    - Timeline expectations
    - Credit and recognition
    - Multiple vulnerability handling
    - Issue categorization
  - [OSPS-VM-03.01] compliance

- **Coordinated Vulnerability Disclosure Policy [OSPS-VM-01.01]** - Security vulnerability handling
  - NEW: Comprehensive CVD policy added to [SECURITY.md](SECURITY.md)
  - Clear response timeframes documented:
    - Initial response: 1 business day
    - Patch development: 5-14 business days
    - Public disclosure: 30 days after patch release
  - CRITICAL/HIGH vulnerabilities: 1-2 days response, 5 days patch target
  - MEDIUM vulnerabilities: 2-3 days response, 10 days patch target
  - LOW vulnerabilities: 3-5 days response, 14 days patch target
  - Vulnerability severity assessment using CVSS v3.1 scoring
  - Reporting methods: GitHub Security Advisory (preferred) + email
  - Supported versions for patches: Last 3 released versions
  - Security researcher recognition program implemented
  - Good faith Safe Harbor principles outlined
  - Incident response and escalation procedures
  - Step-by-step vulnerability reporting process
  - Security advisory format examples provided
  - Out-of-scope vulnerability definitions
  - Monitoring and vulnerability prevention mechanisms
  - Timeline examples for CRITICAL and MEDIUM vulnerabilities
  - Expectations and commitments documented
  - Public disclosure guidelines
  - [OSPS-VM-01.01] compliance

- **Security Assessment & Threat Analysis [OSPS-SA-03.01]** - Comprehensive security assessment
  - NEW: [docs/security-assessment.md](docs/security-assessment.md) - Complete security assessment documentation
  - Threat Model documented: 7 major threat areas identified
    - Credential Management (HIGH impact, MEDIUM likelihood)
    - External API Communication (MEDIUM impact, known SSL certificate issue)
    - Discord Integration Security (MEDIUM impact, LOW likelihood)
    - Dependency Vulnerabilities (LOW impact, MEDIUM likelihood)
    - Database Security (MEDIUM impact, MEDIUM likelihood)
    - Code & Build Security (LOW impact, MEDIUM likelihood)
    - Operational Security (MEDIUM impact, HIGH likelihood)
  - Attack Scenarios: 30+ attack scenarios documented with consequences
  - Vulnerability Assessment: Each threat analyzed for likelihood and impact
  - Security Controls Matrix: Preventive, detective, responsive controls documented
  - Risk Summary Table: All threats with risk levels and mitigation status
  - Known Issues: SSL certificate, plaintext credentials, single admin documented
  - Security Recommendations: CRITICAL, HIGH, MEDIUM, LOW priority actions
  - Best Practices: For users, administrators, and developers
  - Regulatory Compliance: Data protection and policy considerations
  - Incident Response: Recommendations for response procedures
  - Monitoring: Alerting and monitoring recommendations
  - Overall Risk Assessment: MEDIUM (with strong mitigations in place)
  - Updated for new features and breaking changes
  - [OSPS-SA-03.01] compliance

- **External Software Interfaces & API Reference [OSPS-SA-02.01]** - Complete API documentation
  - NEW: [docs/api-reference.md](docs/api-reference.md) - Comprehensive API reference documentation
  - Discord Bot API: 9 slash commands fully documented
    - `/setup` - Store credentials with parameter validation
    - `/redeem` - Manual code redemption with error handling
    - `/inventory` - Account status with data structure
    - `/open` - Chest opening with response format
    - `/blacksmith` - Hero upgrades with error codes
    - `/codes` - Code history with pagination
    - `/makepublic` - Code sharing with visibility
    - `/backfill` - Message history scanning with rate limiting
    - `/help` - Command reference
  - Message Event API: Automatic code detection documented
    - Pattern matching (regex: `\b([A-Z0-9]{4,20})\b`)
    - Detection behavior and response handling
    - Data recording structure
  - Request/response schemas with TypeScript interfaces
  - Error codes with causes and resolution steps
  - Rate limiting (Discord API, Idle Champions API, application throttling)
  - Authentication and security properties
  - Data structure documentation (embeds, ephemeral, JSON)
  - Backward compatibility and breaking changes tracking
  - Complete usage examples for common workflows
  - Error handling and recovery procedures
  - [OSPS-SA-02.01] compliance

- **System Design & Architecture [OSPS-SA-01.01]** - Design documentation for all actors and actions
  - NEW: [docs/system-design.md](docs/system-design.md) - Complete system design and architecture documentation
  - Actors documented: Discord users, Discord servers, Discord bot, Idle Champions API, SQLite database
  - Actions documented: 9 slash commands with complete data flows
  - Message scanning for automatic code detection
  - Message history backfill operations
  - API client interactions with Idle Champions server
  - Database persistence and management
  - Data models: User credentials, code history, backfill state, debug logs
  - Component interactions and subsystems
  - Security architecture (credential management, encryption, access control)
  - Error handling and resilience patterns
  - Scalability and performance characteristics
  - High-level system architecture diagram
  - Detailed data flow diagrams for each major operation
  - Updated for new features and breaking changes
  - OSPS-SA-01.01 compliance tracking

- **Automated Test Suites & CI/CD Testing [OSPS-QA-06.01]** - Test suites run before every merge
  - NEW: [docs/testing-strategy.md](docs/testing-strategy.md) - Complete testing strategy and automated test documentation
  - 5 automated test suites documented:
    - Build & Compilation Tests (TypeScript strict mode)
    - Code Quality & Linting Tests (ESLint validation)
    - Security Vulnerability Scanning (CodeQL, dependency audit, secret scanning)
    - Type Safety Validation (TypeScript strict mode)
    - Code Formatting Tests (Prettier enforcement)
  - 6 CI/CD workflows that run tests automatically
  - Test results visible to all contributors in PR status checks
  - Local testing available via `mise run` commands
  - Consistent test environment (Docker container)
  - Troubleshooting guide for failed tests
  - Test checklist before submitting PR
  - Enhanced CONTRIBUTING.md with testing procedures [OSPS-QA-06.01]

- **Status Checks & Branch Protection [OSPS-QA-03.01]** - Automated checks required to pass before merging
  - NEW: [docs/status-checks.md](docs/status-checks.md) - Complete status checks documentation
  - DCO Sign-Off verification (all commits must be legally signed)
  - Docker Build & Push status check (image published to GHCR with Cosign signing)
  - CodeQL security scanning (detects vulnerabilities)
  - Dependency Review (prevents vulnerable dependencies)
  - Secret Scanning (detects hardcoded credentials)
  - OpenSSF Scorecards (compliance tracking)
  - Branch protection enforces all required checks
  - No admin bypass allowed (ensures consistency)
  - Status checks documentation in CONTRIBUTING.md
  - Troubleshooting guide for failed checks

- **Developer Certificate of Origin (DCO) Enforcement [OSPS-LE-01.01]** - All contributors must assert legal authorization
  - NEW: [DCO.md](DCO.md) - Complete DCO documentation and sign-off procedures
  - NEW: GitHub Actions workflow to check all commits are signed off
  - DCO requirement in [CONTRIBUTING.md](CONTRIBUTING.md) with sign-off instructions
  - Status check prevents merging unsigned commits
  - Git configuration guide for easy sign-off (`git commit -s`)
  - Amendment procedures for previously unsigned commits
  - Enforces that contributors certify legal right to contribute

- **Contributor Requirements & Guidelines [OSPS-GV-03.02]** - Comprehensive guide for acceptable contributions
  - NEW: Enhanced [CONTRIBUTING.md](CONTRIBUTING.md) with detailed acceptance criteria
  - Requirements for code quality (linting, TypeScript strict mode, security)
  - Requirements for testing (unit, integration, manual, quality)
  - Requirements for documentation (code docs, CHANGELOG, user docs, commit messages)
  - Requirements for submission (PR description, checklist, automated checks)
  - Code review criteria for maintainers (functionality, security, maintainability, correctness, alignment)
  - Acceptance criteria summary table with required vs optional items
  - Source of truth for both contributors and code reviewers

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
