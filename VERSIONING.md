# Versioning & Release Policy

This document describes how version identifiers are assigned to releases of the Idle Champions Code Redeemer Bot.

## Versioning Scheme

This project uses **Semantic Versioning (SemVer)** as defined by [semver.org](https://semver.org/).

### Version Format

```
MAJOR.MINOR.PATCH
```

### Version Components

- **MAJOR** - Increment when making incompatible API changes or breaking changes
  - Example: Removing a command, changing database schema breaking old installations
  - Reset MINOR and PATCH to 0 when incremented

- **MINOR** - Increment when adding new functionality in a backwards-compatible manner
  - Example: Adding a new command, new optional parameters
  - Reset PATCH to 0 when incremented

- **PATCH** - Increment when making backwards-compatible bug fixes
  - Example: Bug fixes, security patches, documentation updates
  - No reset needed

### Example Progression

```
1.0.0 → 1.0.1 (bug fix)
1.0.1 → 1.1.0 (new feature)
1.1.0 → 2.0.0 (breaking change)
```

## Creating a Release

### Prerequisites

1. **Update CHANGELOG.md** (REQUIRED)

   ```bash
   # Move "Unreleased" section to new version header
   # Change: ## [Unreleased] → ## [2.1.0] - 2026-05-15
   # Create new empty [Unreleased] section at top
   # See CHANGELOG.md for format guidelines
   ```

   **Include:**
   - Human-readable descriptions (not just commit messages)
   - Security impact for security changes
   - Separate sections: Added, Changed, Deprecated, Removed, Fixed, Security
   - Version tag and date in format: `## [X.Y.Z] - YYYY-MM-DD`

2. **Update version in package.json**

   ```bash
   # Edit package.json
   # Change "version": "2.0.0" to new version, e.g., "2.1.0"
   ```

3. **Commit version and changelog bump** (optional but recommended)

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore(release): bump version to 2.1.0"
   git push
   ```

4. **Create a git tag** (REQUIRED for release)
   ```bash
   # Tag format: v<MAJOR>.<MINOR>.<PATCH>
   git tag -a v2.1.0 -m "Release version 2.1.0"
   git push origin v2.1.0
   ```

### Automated Release Process

When you push a git tag matching `v*` pattern:

1. **GitHub Actions Triggers**
   - Docker workflow detects the version tag
   - Builds Docker image with SemVer metadata

2. **Image Publishing**
   - Published to GitHub Container Registry (GHCR)
   - Tags applied:
     - `v2.1.0` - Full version
     - `2.1` - Major.minor version
     - `2` - Major version only
     - `latest` - Only if tag is on main branch

3. **GitHub Release** (Create Manually)
   - Go to [GitHub Releases](https://github.com/BigMichi1/idle-code-redeemer/releases)
   - Click "Draft a new release"
   - Select the git tag you just pushed
   - **Title**: Use version: `2.1.0`
   - **Description**: Copy the changelog section from [CHANGELOG.md](CHANGELOG.md)
     - Include the version header and all change categories
     - Format as markdown with "## Changelog" header if using GitHub's auto-generated release notes
     - Add signature verification instructions (see Signed Releases below)
     - **Add Dependency Management Section** [OSPS-DO-06.01]:

       ```markdown
       ## Dependency Management

       For details on how dependencies are selected, obtained, and tracked, see [Dependency Management Documentation](docs/dependency-management.md).

       **This Release**:

       - Production dependencies: 5 (all versions pinned in bun.lock)
       - Development dependencies: 12 (for build tooling only)
       - Vulnerability scan: ✅ Passed (bun audit)
       - Lock file: tracked in git for reproducible builds

       See CHANGELOG.md for dependency updates in this release.
       ```
   - Publish the release
   - The `release-attestation.yml` workflow automatically:
     - Generates attestation.json with release metadata
     - Signs attestation with Cosign
     - Uploads attestation files to release
     - Posts verification instructions as comment

### Example Release Workflow

```bash
# 1. Update CHANGELOG.md with new version section
vim CHANGELOG.md
# Move [Unreleased] changes to [2.1.0] - 2026-05-15
# Create new empty [Unreleased] section

# 2. Update version in package.json
vim package.json
# Change: "version": "2.0.0" → "version": "2.1.0"

# 3. Commit and push
git add package.json CHANGELOG.md
git commit -m "chore(release): bump version to 2.1.0"
git push

# 4. Create and push git tag
git tag -a v2.1.0 -m "Release version 2.1.0: Add /makepublic command"
git push origin v2.1.0

# 5. Create GitHub Release (manual, in web interface)
# - Go to https://github.com/BigMichi1/idle-code-redeemer/releases/new
# - Select tag: v2.1.0
# - Title: 2.1.0
# - Description: Copy from CHANGELOG.md [2.1.0] section:
#   ## Changelog
#   ### Added
#   - ...
# - Publish

# 6. Verify
# - Docker image published: ghcr.io/bigmichi1/idle-code-redeemer-bot:2.1.0
# - GitHub release visible on releases page
# - CHANGELOG.md reflects new version
```

## Version Tags in Docker Images

When a release is created, Docker images are automatically published with these tags:

### Main Branch Builds

```
ghcr.io/bigmichi1/idle-code-redeemer-bot:main-<SHA>
ghcr.io/bigmichi1/idle-code-redeemer-bot:latest
```

### Version Tag Builds (Releases)

```
ghcr.io/bigmichi1/idle-code-redeemer-bot:v2.1.0      # Full version
ghcr.io/bigmichi1/idle-code-redeemer-bot:2.1         # Major.minor
ghcr.io/bigmichi1/idle-code-redeemer-bot:2           # Major only
ghcr.io/bigmichi1/idle-code-redeemer-bot:<SHA>       # Commit SHA
```

### Using Specific Versions

```bash
# Pull a specific release
docker pull ghcr.io/bigmichi1/idle-code-redeemer-bot:v2.1.0

# Pull major.minor (gets latest patch)
docker pull ghcr.io/bigmichi1/idle-code-redeemer-bot:2.1

# Pull latest stable
docker pull ghcr.io/bigmichi1/idle-code-redeemer-bot:latest
```

## Release Changelog Integration

All release changes are documented in [CHANGELOG.md](CHANGELOG.md) following the [Keep a Changelog](https://keepachangelog.com/) format.

### GitHub Release Notes Structure

When creating a GitHub Release, copy the relevant section from CHANGELOG.md:

```markdown
## Changelog

### Added

- Feature description with context and rationale

### Changed

- Changed functionality with migration guidance

### Deprecated

- Features marked for future removal

### Removed

- Features removed in this release

### Fixed

- Bug fix with impact description

### Security

- Security improvements with vulnerability details and severity
```

### Changelog Maintenance Guidelines

See [CHANGELOG.md](CHANGELOG.md) for:

- Format guidelines (good and bad examples)
- Security change documentation requirements
- How to write human-readable descriptions
- Machine-readable markdown header format
- Complete changelog maintenance instructions

## Automated Release Asset Signing [OSPS-BR-06.01]

### Build-Time Signing

All released assets are automatically signed during the build process using **Cosign (Keyless OIDC)**:

**Docker Images** (Signed automatically when pushed):

```bash
# In GitHub Actions docker.yml workflow:
# 1. Build and push image to GHCR
# 2. Install Cosign
# 3. Sign image with Cosign using OIDC token
# 4. Verify signature
```

**Release Attestations** (Signed automatically when release published):

```bash
# In GitHub Actions release-attestation.yml workflow:
# 1. Generate attestation.json with metadata
# 2. Sign with Cosign
# 3. Upload attestation.json, attestation.sig, attestation.crt to release
# 4. Post verification instructions
```

### Verify Released Assets

**Verify Docker Image Signature**:

```bash
# Enable keyless verification
export COSIGN_EXPERIMENTAL=1

# Verify image signed by our workflow
cosign verify \
  --certificate-identity-regexp "github.com/BigMichi1/idle-code-redeemer@refs/tags/v.*" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/bigmichi1/idle-code-redeemer-bot:2.1.0
```

**Verify Attestation Files** (Download from GitHub Release):

```bash
# Files in release: attestation.json, attestation.sig, attestation.crt
cosign verify-blob \
  --signature attestation.sig \
  --certificate attestation.crt \
  attestation.json

# View release metadata
cat attestation.json | jq .
```

### Signature Transparency

All signatures are recorded in the public [Rekor transparency log](https://rekor.sigstore.dev/):

- ✅ Immutable audit trail
- ✅ Searchable by image
- ✅ Detects unauthorized signatures
- ✅ Can be queried offline

### Release Notes Signatures

Each GitHub Release includes a comment with:

- ✅ Verification instructions
- ✅ Docker image tags
- ✅ Build metadata
- ✅ Attestation files
- ✅ Cryptographic signing documentation link

For comprehensive information, see [docs/cryptographic-signing.md](../docs/cryptographic-signing.md)

## Automated Tag Generation

The Docker metadata action automatically generates tags based on git tags:

**For git tag `v2.1.0`:**

- ✅ Extracts version: `2.1.0`
- ✅ Creates tags: `v2.1.0`, `2.1`, `2`
- ✅ Tags image with all variations

**For git tag `v2.1.0-beta.1`:**

- Pre-release version is published as-is (not tagged as `latest`)

## Version History

| Version | Date     | Changes                               |
| ------- | -------- | ------------------------------------- |
| 2.0.0   | May 2026 | Initial public release as Discord bot |

## References

- [Semantic Versioning](https://semver.org/)
- [GitHub: Creating Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [Docker Image Tagging Best Practices](https://docs.docker.com/build/building/best-practices/)
- [Keep a Changelog](https://keepachangelog.com/)
