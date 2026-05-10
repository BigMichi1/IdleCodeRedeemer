# Project Governance

This document describes the project members, their roles, and their access to sensitive resources in the Idle Champions Code Redeemer Bot project. [OSPS-GV-01.01]

## Table of Contents

- [Project Members](#project-members)
- [Roles and Responsibilities](#roles-and-responsibilities)
- [Access to Sensitive Resources](#access-to-sensitive-resources)
- [Decision Making](#decision-making)
- [Communication](#communication)

## Project Members

### Active Maintainers

| Member | GitHub Account | Email | Role | Active Since |
|--------|---|---|---|---|
| Michael Cramer | @BigMichi1 | michael@bigmichi1.de | Owner & Lead Maintainer | 2025-04 |

### Inactive/Emeritus Members

Currently no emeritus members. This is a new project.

### Contributors

Community contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roles and Responsibilities

### Owner & Lead Maintainer (@BigMichi1)

**Responsibilities:**
- ✅ Final authority on all project decisions
- ✅ Code review and approval for all pull requests
- ✅ Release management and versioning
- ✅ Security vulnerability response and patching
- ✅ Dependency updates and security audits
- ✅ Repository settings and access control
- ✅ GitHub organization management
- ✅ Crisis management and incident response

**Availability:**
- Primary contact for urgent security issues
- Business hours response time for non-critical issues
- 3 business day response target for security reports

### Future Roles (If Project Expands)

These roles are reserved for future maintainers as the project grows:

#### Maintainer
- Code review and merge authority
- Release approval
- Security issue triage
- Documentation updates

#### Security Officer
- Vulnerability response coordination
- Dependency security audits
- Secret management and rotation
- Compliance monitoring

#### Release Manager
- Version tagging and releases
- Changelog management
- Release notes preparation
- Docker image publishing

## Access to Sensitive Resources

### GitHub Repository Access

**Owner Access** (@BigMichi1):
- ✅ Full administrative access
- ✅ Repository settings management
- ✅ Branch protection rules
- ✅ Workflow management
- ✅ Secret management
- ✅ Access control configuration

**Details:**
- Repository: https://github.com/BigMichi1/idle-code-redeemer
- Visibility: Public
- Protection: Branch protection on `main` (1 approval required, no admin bypass)

### GitHub Container Registry (GHCR)

**Owner Access** (@BigMichi1):
- ✅ Push Docker images
- ✅ Image signing with Cosign (keyless OIDC)
- ✅ Image deletion
- ✅ Visibility settings

**Details:**
- Registry: `ghcr.io/bigmichi1/idle-code-redeemer-bot`
- Authentication: GitHub OIDC tokens via Actions
- Signing: All images signed with Cosign keyless method
- Images publicly available for verification

### GitHub Actions Secrets

**Owner Access** (@BigMichi1):
- ✅ View all repository secrets (limited in GitHub UI)
- ✅ Create new secrets
- ✅ Update secrets
- ✅ Delete secrets
- ✅ Manage secret scope (Actions, Dependabot, Codespaces)

**Stored Secrets:**
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions (scoped to each workflow)
- No additional repository secrets required (OIDC tokens used for signing)

**Note**: GitHub OIDC tokens are preferred over stored secrets for authentication.

### Discord Bot Token

**Owner Access** (@BigMichi1):
- ✅ Stores in personal Discord Developer Portal
- ✅ Can rotate/regenerate token
- ✅ Not stored in repository or GitHub secrets
- ✅ Passed via environment variable in deployments

**Protection**:
- ✅ `.env` file in `.gitignore` (never committed)
- ✅ `.env.example` with placeholder tokens only
- ✅ Gitleaks pre-commit hooks detect accidental commits
- ✅ GitHub secret scanning (public key scanning)

### Database Access

**Owner Access** (@BigMichi1):
- ✅ Local SQLite database (`data/idle.db`)
- ✅ Backup management
- ✅ User data access
- ✅ Code redemption history access

**Details:**
- Type: SQLite (file-based, local)
- Location: `./data/idle.db` (in `.gitignore`)
- User data: Discord IDs and Idle Champions credentials
- Backup: Manual backups responsibility of deployer
- Protection: File permissions on server (mode 0600)

### Deployment Credentials

**Owner Access** (@BigMichi1):
- ✅ Docker Compose deployment configuration
- ✅ Environment variable management
- ✅ Server access and management
- ✅ Container orchestration

**Not Stored in Repository:**
- Server SSH keys
- Cloud provider credentials
- DNS credentials
- SSL certificates

### Keystore & Code Signing

**Owner Access** (@BigMichi1):
- ✅ GitHub OIDC tokens (ephemeral per workflow)
- ✅ Cosign keyless signing (no keys stored)
- ✅ Attestation file generation and signing

**Details:**
- Method: Cosign keyless OIDC signing
- Key Storage: GitHub OIDC tokens (automatically managed)
- Verification: Public Rekor transparency log
- No private keys stored in repository or secrets

## Access Control Matrix

| Resource | Owner (@BigMichi1) | Future Maintainers | Contributors | Public |
|----------|---|---|---|---|
| Repository (Read) | ✅ | ✅ | ✅ | ✅ |
| Repository (Write) | ✅ | ❌ (via PR) | ❌ (via PR) | ❌ |
| Repository (Admin) | ✅ | ❌ | ❌ | ❌ |
| Code Review Approval | ✅ | Planned | ❌ | ❌ |
| Merge Authority | ✅ | Planned | ❌ | ❌ |
| Branch Protection | ✅ | Planned | N/A | N/A |
| Release Management | ✅ | Planned | ❌ | ❌ |
| Secrets Management | ✅ | Planned | ❌ | ❌ |
| Docker Push (GHCR) | ✅ | Planned | ❌ | ❌ |
| Image Signing | ✅ | Planned | ❌ | ❌ |
| Security Triage | ✅ | Planned | ❌ | ❌ |

## Decision Making

### Major Decisions

**Definition**: Changes affecting architecture, security, or breaking changes.

**Process:**
1. Author opens GitHub issue or discussion
2. Lead maintainer (@BigMichi1) reviews
3. Decision made by owner
4. Documentation updated (CHANGELOG.md)
5. Implementation via pull request

### Code Review Process

**All changes (including owner's) follow this process:**

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/description
   ```

2. **Implement & Test**
   - Code follows project standards (see CONTRIBUTING.md)
   - Tests added for new features
   - CHANGELOG.md updated

3. **Create Pull Request**
   - Clear title and description
   - Links to related issues
   - Tests passing (CI/CD)
   - Linting passes

4. **Code Review**
   - @BigMichi1 reviews changes
   - May request changes
   - Approves if acceptable

5. **Merge**
   - Squash and merge (preferred)
   - Delete feature branch

### Security Decision Process

**High-Priority (Security Issues):**

1. Private report via GitHub Security Advisory or email
2. Immediate triage by @BigMichi1
3. Fix development in private security advisory
4. Testing and verification
5. Release with security advisory
6. Public disclosure after fix release

**Regular Security Updates:**

1. Automated Dependabot scans
2. @BigMichi1 reviews and tests
3. PR created and merged
4. CHANGELOG updated with CVE information
5. New release published

## Communication

### Contact Methods

**Security Issues** (PRIVATE):
- GitHub Security Advisory: https://github.com/BigMichi1/idle-code-redeemer/security
- Email: michael@bigmichi1.de

**General Questions & Bugs**:
- GitHub Issues: https://github.com/BigMichi1/idle-code-redeemer/issues
- GitHub Discussions: https://github.com/BigMichi1/idle-code-redeemer/discussions

**Response Times**:
- 🔴 Security vulnerabilities: 3 business days maximum
- 🟡 Bugs: 7 days
- 🟢 Features/Questions: Best effort

### Meeting Schedule

Currently no regular meetings (single maintainer). If/when additional maintainers are added, meetings will be scheduled.

## Adding New Members

**Criteria for Adding Maintainers:**

1. ✅ Demonstrated commitment (multiple merged PRs)
2. ✅ Understanding of codebase and architecture
3. ✅ Agreement with security and governance policies
4. ✅ Availability for ongoing maintenance
5. ✅ Agreement to follow Conventional Commits

**Process:**

1. GitHub issue proposing new maintainer
2. Public discussion and feedback
3. Decision by @BigMichi1
4. Grant appropriate GitHub access
5. Update GOVERNANCE.md
6. Announce in release notes or discussion

## Project Lifecycle

### Active Phase

**Current Status**: Active (as of May 2026)

**Definitions:**
- **Active**: Regular maintenance and updates
- **Maintenance**: Critical fixes only, no new features
- **Archived**: No longer maintained

**Current Activity Level**:
- Regular code updates
- Security patches applied promptly
- Dependabot-driven dependency updates
- New features as needed

### End of Life

**Currently**: No end-of-life date planned.

**If EOL Occurs**:
1. SECURITY.md updated with EOL notice
2. README.md marked as archived
3. Repository archived (read-only)
4. Last stable version documented
5. Users directed to alternatives

## Compliance & Auditing

### Audit Trail

**Access changes are logged:**
- Git commit history: All code changes
- GitHub action logs: All CI/CD executions
- Dependency updates: Tracked in CHANGELOG.md
- Security advisories: Public on GitHub

**To Review Access History:**

```bash
# View all commits
git log --oneline

# View changes to sensitive files
git log -p -- .github/workflows/
git log -p -- .gitleaks.toml
```

### Annual Review

- Governance document accuracy
- Access control verification
- Member activity levels
- Security policy effectiveness
- Dependency security status

### Vulnerability Response Review

After each security vulnerability:
1. Fix verification
2. Response time evaluation
3. Prevention process improvement
4. Documentation update

## License

This governance document is provided under the [ISC License](LICENSE) along with the project source code.

## Changes to This Document

**History:**
- Created May 10, 2026: Initial governance documentation for OSPS-GV-01.01

**Future Changes:**
- Will be updated when adding new members
- Updated with major policy changes
- Reviewed annually
- Changes tracked in git history
