# Status Checks & Branch Protection

This document describes the automated status checks that must pass before code can be merged into the primary branch. [OSPS-QA-03.01]

## Overview

All commits to the primary branch (`main`) must pass automated status checks before merging. These checks cannot be bypassed without explicit acknowledgement and authorization by maintainers.

**Branch Protection Policy**: 
- ✅ All required checks MUST pass
- ✅ Status checks cannot be bypassed without manual override
- ✅ Manual bypasses require admin access and are logged
- ✅ Optional checks are not configured as blockers

## Required Status Checks

All of these checks must pass. If any fail, the pull request cannot be merged:

### 1. **DCO Sign-Off Check** (`dco-check`)
- **Purpose**: Verify all commits are legally signed off
- **Triggers**: Pull requests, pushes to main
- **Requirement**: All commits must have "Signed-off-by" trailer [OSPS-LE-01.01]
- **Pass Criteria**: Every commit includes legal sign-off assertion
- **Fail Action**: List unsigned commits with amendment instructions
- **Bypass**: Not recommended; amend and re-push instead

**Reference**: See [DCO.md](../DCO.md) for sign-off procedures

### 2. **Docker Build & Push** (`docker`)
- **Purpose**: Build Docker images and publish to GitHub Container Registry
- **Triggers**: Pushes to main and release tags
- **Requirement**: Docker image builds successfully
- **Pass Criteria**: 
  - Multi-stage build completes without errors
  - Images published to ghcr.io/bigmichi1/idle-code-redeemer-bot
  - Images signed with Cosign keyless OIDC signatures
- **Fail Action**: Build logs indicate failure cause
- **What It Checks**:
  - Dockerfile syntax and build process
  - Base image availability
  - Runtime dependencies
  - Image size and layer efficiency

**Reference**: See [docs/cryptographic-signing.md](cryptographic-signing.md) for signing details

### 3. **CodeQL Security Scanning** (`codeql`)
- **Purpose**: Detect security vulnerabilities and code quality issues
- **Triggers**: Pull requests, pushes to main
- **Requirement**: No critical/high-severity CodeQL alerts introduced
- **Pass Criteria**: 
  - New code passes CodeQL analysis
  - No injection vulnerabilities
  - No hardcoded credentials
  - No unsafe crypto usage
- **Fail Action**: CodeQL report with specific alerts
- **Configuration**: `.github/workflows/codeql.yml`

**Reference**: [GitHub CodeQL Documentation](https://codeql.github.com/)

### 4. **Dependency Review** (`dependency-review`)
- **Purpose**: Prevent introduction of vulnerable dependencies
- **Triggers**: Pull requests with package.json changes
- **Requirement**: No new vulnerable dependencies added
- **Pass Criteria**:
  - All new dependencies have no known high/critical vulnerabilities
  - Dependency versions meet security policies
  - License compliance check
- **Fail Action**: List vulnerable dependencies with CVE details
- **Bypass**: Not recommended; update to patched version

**Reference**: See [docs/dependency-management.md](dependency-management.md)

### 5. **Secret Scanning** (`secrets`)
- **Purpose**: Prevent accidental credential leaks
- **Triggers**: All pushes and pull requests
- **Requirement**: No secrets detected in code
- **Pass Criteria**:
  - No GitHub tokens
  - No AWS/cloud credentials
  - No private keys
  - No Discord bot tokens
  - No API keys hardcoded
- **Fail Action**: Lists detected secrets with location
- **Bypass**: Not recommended; use .gitignore and .env files instead

**Reference**: See [SECURITY.md](../SECURITY.md#data-protection) for secret protection

### 6. **OpenSSF Scorecards** (`scorecards`)
- **Purpose**: Assess security practices and OpenSSF Best Practices compliance
- **Triggers**: Scheduled weekly scans, can run on demand
- **Requirement**: High security score maintained
- **Pass Criteria**:
  - Dependency management documented
  - Vulnerability disclosure policy in place
  - Branch protection enforced
  - Code review process documented
  - Security fixes included
- **Fail Action**: Report areas needing improvement
- **Status**: Advisory (required for compliance tracking)

**Reference**: [OpenSSF Best Practices Badge](https://bestpractices.coreinfrastructure.org/)

## Status Check Configuration

### Branch Protection Rules

The primary branch (`main`) is configured with:

```yaml
Branch: main

Requirements:
  - ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - ✅ Require pull request reviews before merging (1 approval required)
  - ✅ Require code owner review (CODEOWNERS file)
  - ✅ Require commit signature (optional, but recommended)
  - ❌ Dismiss stale pull request approvals (when new commits pushed)
  - ❌ Require status checks from specific contexts to pass

Restrictions:
  - ❌ Allow force pushes (disabled)
  - ❌ Allow deletions (disabled)
  - ❌ Admin can bypass (NOT allowed)
```

### Status Check Requirements

| Check | Required | Bypass Allowed | Notes |
|-------|----------|----------------|-------|
| DCO Sign-Off | ✅ YES | ❌ NO | Every commit must be signed |
| Docker Build | ✅ YES | ❌ NO | Must build successfully |
| CodeQL | ✅ YES | ⚠️ MANUAL | High security priority |
| Dependencies | ✅ YES | ⚠️ MANUAL | Vulnerability scan |
| Secrets | ✅ YES | ❌ NO | No credentials leaked |
| Scorecards | ⚠️ ADVISORY | N/A | Compliance tracking |

**Key Principle**: Required checks cannot be bypassed by anyone except repository admins, and any admin override is logged in GitHub audit logs for compliance.

## How Status Checks Work

### For Pull Requests

1. **Create PR** - GitHub Actions automatically trigger required checks
2. **Checks Run In Parallel** - Docker, CodeQL, Dependencies, DCO all run simultaneously
3. **Results Appear Below PR** - Each check shows pass/fail status
4. **Failures Block Merge** - Cannot merge if any required check fails
5. **Fix & Re-test** - Push additional commits to re-run checks
6. **All Pass = Mergeable** - Once all checks pass, PR can be merged after review approval

### For Commits to Main

Direct commits to main (if not blocked by branch protection) trigger:

1. DCO check (verify sign-off)
2. Docker build (compile and publish)
3. CodeQL scan (security analysis)
4. Dependency review (vulnerability check)
5. Secret scanning (credential detection)

If any check fails, the commit is marked as failed in GitHub UI and is visible in repository badge/status.

## Status Check Outputs

### When Checks Pass ✅

```
✅ All checks have passed
├── ✅ dco-check - All commits signed off
├── ✅ docker - Image published to GHCR
├── ✅ codeql - No security issues
├── ✅ dependency-review - No vulnerabilities
├── ✅ secrets - No credentials detected
└── ⓘ scorecards - Compliance score updated
```

### When Checks Fail ❌

```
❌ Some checks failed - PR cannot be merged
├── ❌ dco-check - 2 unsigned commits
├── ✅ docker - Image published
├── ❌ codeql - SQL injection vulnerability detected
├── ✅ dependency-review - No vulnerabilities
├── ❌ secrets - Hardcoded API key detected
└── ⓘ scorecards - Updated
```

**Next Steps**: 
1. View detailed failure logs
2. Fix underlying issue
3. Push corrections (new commits or amended commits)
4. Checks automatically re-run

## Manual Bypass Procedure

**Only for Repository Admins**

If a status check must be bypassed (rare emergency situation):

1. **Document Reason** - Create GitHub issue explaining why bypass is necessary
2. **Get Approval** - Project owner approval required
3. **Bypass via GitHub UI** - Admin can dismiss check (logged)
4. **Complete Post-Incident Review** - Ensure underlying issue is resolved later
5. **Re-enable Check** - Revert branch protection if it was changed

**Bypass Logging**:
- All bypasses appear in GitHub Audit Log
- Includes who bypassed, when, and what check
- Cannot be hidden or deleted
- Available for compliance reviews

**Important**: Bypasses should be exceptional; regular failures indicate bugs that need fixing, not checks to bypass.

## Recommended: Optional vs Required Checks

This project follows the recommendation that **optional checks are NOT configured as blockers**:

- ✅ **Required Checks** - Cannot bypass, must pass every time
  - DCO Sign-Off (legal requirement)
  - Docker Build (runtime requirement)
  - CodeQL (critical security)
  - Secrets (critical security)
  - Dependencies (vulnerability prevention)

- ⓘ **Advisory Checks** - Informational only, don't block merge
  - Scorecards (compliance tracking)
  - Coverage trends (quality metric)

This prevents "check fatigue" where developers bypass security checks due to false positives.

## Troubleshooting Failed Checks

### DCO Check Failed
```
Error: Unsigned commits detected
Fix: git commit --amend -s && git push --force-with-lease
Ref: DCO.md
```

### Docker Build Failed
```
Error: Build failed
Fix: Check Dockerfile syntax, base image availability
Ref: BUILD.md, Dockerfile
```

### CodeQL Failed
```
Error: Security vulnerability detected
Fix: Review CodeQL alert, fix vulnerability
Ref: GitHub Security tab for detailed alerts
```

### Dependency Failed
```
Error: Vulnerable dependency detected
Fix: Update to patched version
Ref: docs/dependency-management.md
```

### Secret Detected
```
Error: Credential found in code
Fix: Remove credential, commit to .env.example instead
Ref: SECURITY.md, .env.example
```

## OSPS-QA-03.01 Compliance

| Requirement | Status | Evidence |
|---|---|---|
| **All status checks configured** | ✅ | 6 workflows: DCO, Docker, CodeQL, Dependencies, Secrets, Scorecards |
| **Checks must pass or be bypassed** | ✅ | Branch protection: require status checks to pass |
| **Bypass requires acknowledgement** | ✅ | GitHub Audit Log tracks all bypasses |
| **Optional checks not blockers** | ✅ | Scorecards is advisory only, not required |
| **Documented** | ✅ | This file (status-checks.md) and CONTRIBUTING.md |
| **Enforced** | ✅ | Branch protection rules on main branch |

## References

- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions](https://docs.github.com/en/actions)
- [GitHub CodeQL](https://codeql.github.com/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
- [OpenSSF Best Practices](https://bestpractices.coreinfrastructure.org/)

---

**Note**: This configuration ensures that code quality and security are not compromised by accidental oversights. All contributors are expected to ensure their commits pass automated checks before requesting review.
