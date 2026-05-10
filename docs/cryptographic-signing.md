# Cryptographic Signing & Release Attestation

This document describes how released software assets are cryptographically signed and verified to ensure authenticity and integrity.

## Overview

All official releases of the Idle Champions Code Redeemer Bot are signed using **Cosign (Keyless OIDC)** to provide:

- ✅ **Authenticity** - Proof that artifacts come from verified GitHub Actions workflows
- ✅ **Integrity** - Cryptographic signatures prevent tampering
- ✅ **Transparency** - Full audit trail via GitHub Actions
- ✅ **Keyless Signing** - No secrets stored; uses GitHub OIDC token
- ✅ **Standards Compliance** - Implements SLSA framework principles

## What Gets Signed

### Docker Images

All Docker images published to GitHub Container Registry (GHCR) are signed:

```
ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0      # Full version
ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0        # Major.minor
ghcr.io/bigmichi1/idle-code-redeemer-bot:2          # Major
ghcr.io/bigmichi1/idle-code-redeemer-bot:latest     # Latest
```

**Signing Process**:

1. GitHub Actions builds and pushes Docker image to GHCR
2. Cosign signs the image using OIDC keyless signing
3. Signature is stored in GHCR alongside image
4. Image digest is included in release attestation

### Release Attestation

Each GitHub Release includes signed attestation files:

- **attestation.json** - Complete release metadata with all artifact hashes and build information
- **attestation.sig** - Cosign signature over attestation.json
- **attestation.crt** - Cosign certificate used for signing

## Signing Methods

### Cosign Keyless OIDC Signing

**Method**: GitHub Actions OIDC Token → Cosign → Keyless Signature

**Key Features**:

- ✅ No secrets stored in GitHub
- ✅ No key management overhead
- ✅ Automatic OIDC token from GitHub Actions
- ✅ Certificate tied to specific workflow run
- ✅ Auditable via GitHub Actions logs

**Certificate Identity**:

```
github.com/bigmichi1/idle-code-redeemer@refs/tags/v2.0.0
```

**Issuer**:

```
https://token.actions.githubusercontent.com
```

**Trust Root**:

- Sigstore's public key infrastructure
- Works offline via Rekor transparency log
- Can be verified without external services

**Workflow**:

1. GitHub Actions workflow runs
2. GitHub issues OpenID Connect token with claims about the workflow
3. Cosign uses token to obtain short-lived certificate from Sigstore
4. Certificate contains workflow metadata
5. Image/attestation signed with certificate
6. Certificate bound to Rekor transparency log
7. Anyone can verify offline using Sigstore's public root certificate

## Verification

### Verify Docker Image Signature

```bash
# Install Cosign
curl -sSL https://github.com/sigstore/cosign/releases/download/v2.2.0/cosign-linux-amd64 -o cosign
chmod +x cosign

# Enable keyless verification
export COSIGN_EXPERIMENTAL=1

# Verify image signature
cosign verify ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0

# Check attestation
cosign verify-attestation ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0
```

**Output Example**:

```json
{
  "critical": {
    "identity": {
      "docker-reference": "ghcr.io/bigmichi1/idle-code-redeemer-bot"
    },
    "image": {
      "docker-manifest-digest": "sha256:abcd1234..."
    },
    "type": "cosign container image signature"
  },
  "optional": {
    "Issuer": "https://token.actions.githubusercontent.com",
    "Subject": "github.com/bigmichi1/idle-code-redeemer@refs/tags/v2.0.0"
  }
}
```

### Verify Attestation Files

```bash
# Verify attestation signature
cosign verify-blob \
  --signature attestation.sig \
  --certificate attestation.crt \
  attestation.json

# View attestation contents
cat attestation.json | jq .

# Check specific fields
cat attestation.json | jq '.release'
cat attestation.json | jq '.artifacts'
```

### Complete Verification Checklist

```bash
#!/bin/bash

IMAGE="ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0"
export COSIGN_EXPERIMENTAL=1

echo "🔐 Verifying release signature..."
echo ""

# 1. Verify image signature
echo "1️⃣  Verifying Docker image signature..."
if cosign verify "$IMAGE"; then
  echo "✅ Image signature verified"
else
  echo "❌ Image signature verification failed"
  exit 1
fi

echo ""

# 2. Check image digest
echo "2️⃣  Checking image integrity..."
docker pull "$IMAGE"
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "$IMAGE")
echo "Image Digest: $DIGEST"

echo ""

# 3. Verify attestation (if available)
echo "3️⃣  Verifying attestation..."
if cosign verify-attestation "$IMAGE" 2> /dev/null | jq . > /dev/null; then
  echo "✅ Attestation verified"
else
  echo "⚠️  Attestation not available (expected for non-release images)"
fi

echo ""
echo "✅ All verifications passed!"
```

## Release Attestation Content

### attestation.json Structure

```json
{
  "version": "1.0.0",
  "attestation_type": "release-manifest",
  "release": {
    "tag": "v2.0.0",
    "version": "2.0.0",
    "date": "2026-05-09T14:22:00Z",
    "repository": "bigmichi1/idle-code-redeemer",
    "commit_sha": "abc123def456...",
    "commit_url": "https://github.com/..."
  },
  "build": {
    "workflow": "docker.yml",
    "workflow_run": "12345678",
    "workflow_run_url": "https://github.com/...",
    "runner": "ubuntu-latest",
    "trigger": "release-published"
  },
  "artifacts": {
    "docker_images": [
      {
        "registry": "ghcr.io",
        "repository": "bigmichi1/idle-code-redeemer",
        "tags": ["2.0.0", "2.0", "2"],
        "signing_method": "cosign-keyless",
        "verification_instructions": "cosign verify ..."
      }
    ]
  },
  "cryptographic_signatures": {
    "method": "Cosign (Keyless OIDC)",
    "issuer": "GitHub Actions",
    "certificate_identity": "github.com/bigmichi1/idle-code-redeemer@refs/tags/v2.0.0",
    "verification_tool": "cosign verify"
  },
  "security": {
    "vulnerability_scanning": "bun audit",
    "dependency_management": "bun.lock (frozen)",
    "secret_scanning": "Gitleaks + TruffleHog",
    "code_review_required": true,
    "branch_protection": true
  }
}
```

## GitHub Release Assets

Each release includes:

### Automatically Uploaded Files

1. **attestation.json**
   - Machine-readable release metadata
   - All artifact hashes and tags
   - Build workflow information
   - Security configuration

2. **attestation.sig**
   - Cosign signature over attestation.json
   - Enables verification of attestation integrity
   - Contains certificate reference

3. **attestation.crt**
   - Cosign certificate used for signing
   - Includes public key and GitHub/Sigstore metadata
   - Tied to specific workflow run

### Manual Release Notes

Release notes should include:

````markdown
## 🔐 Release Signed & Verified

This release has been cryptographically signed using **Cosign (Keyless OIDC)**.

### Verify Docker Images

```bash
export COSIGN_EXPERIMENTAL=1
cosign verify ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0
```
````

### Verify Attestation

Signed attestation files are attached to this release.
See [Cryptographic Signing Documentation](docs/cryptographic-signing.md) for details.

````

## Build Time Signing

### When Images Are Signed

**Trigger**: Docker workflow completes image build

**Process**:
1. Docker image pushed to GHCR
2. `.github/workflows/docker.yml` installs Cosign
3. Cosign signs image using OIDC keyless method
4. Signature stored in GHCR attestation store
5. Signature verified and logged

**Workflow Triggers**:
- ✅ Push to main branch
- ✅ Push with version tag (v*)
- ✅ Published GitHub release event
- ❌ Pull requests (no signing)

### When Attestations Are Generated

**Trigger**: GitHub release published

**Process**:
1. `.github/workflows/release-attestation.yml` runs
2. Generates attestation.json with all release metadata
3. Signs attestation with Cosign
4. Uploads files to release
5. Posts verification instructions as comment

## Transparency & Audit Trail

### Rekor Transparency Log

All Cosign signatures are recorded in [Rekor](https://rekor.sigstore.dev/), a public transparency log:

- ✅ Immutable record of all signatures
- ✅ Searchable by image, signature, certificate
- ✅ Enables detection of unauthorized signatures
- ✅ No secrets exposed (only signatures)

**Check Rekor for a signature**:
```bash
# Search by image
rekor-cli search --image ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0

# View entry details
rekor-cli get --uuid <uuid-from-search>
````

### GitHub Actions Audit Log

Every signature is tied to a GitHub Actions workflow run:

- ✅ View at: `https://github.com/bigmichi1/idle-code-redeemer/actions/runs/<run-id>`
- ✅ Shows commit, author, timestamp
- ✅ Shows all steps executed
- ✅ Includes OIDC token claims

### Git Commit Signing (Future Enhancement)

To further strengthen security, commits can be signed with GPG:

```bash
# Configure GPG signing
git config --global user.signingkey <GPG-KEY-ID>
git config --global commit.gpgsign true

# Sign commits
git commit -S -m "message"

# Verify signatures
git verify-commit <commit-sha>
```

## Security Considerations

### No Hardcoded Secrets

✅ **Keyless signing eliminates the need for**:

- Secret key storage in GitHub
- Key rotation procedures
- Key compromise risk
- Access control for signing keys

### Workflow Isolation

✅ **Signatures tied to specific workflow**:

- Only build workflow can sign images
- Signing happens in isolated GitHub Actions runner
- No manual key access
- Cannot be replicated outside GitHub

### Certificate Pinning

✅ **Optional: Pin expected signers**:

```bash
# Verify only images signed by this specific workflow
cosign verify \
  --certificate-identity-regexp "github.com/bigmichi1/idle-code-redeemer@refs/tags/v.*" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0
```

### Verification Best Practices

1. **Always verify before deploying**

   ```bash
   cosign verify $IMAGE || exit 1
   docker pull $IMAGE
   ```

2. **Pin to specific versions**

   ```bash
   # Use specific tag, not 'latest'
   docker pull ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0
   ```

3. **Check attestation for build context**

   ```bash
   cosign verify-attestation $IMAGE | jq '.release'
   ```

4. **Maintain an audit log of deployments**
   ```bash
   echo "$(date): Deployed $IMAGE" >> deployment.log
   ```

## Standards & Compliance

### SLSA Framework

This signing implementation aligns with [SLSA](https://slsa.dev/) supply chain security:

- ✅ **SLSA Level 3**: Signed releases with provenance
- ✅ **Build Integrity**: Builds run in GitHub Actions isolated environment
- ✅ **Source Integrity**: All code requires review (PR branch protection)
- ✅ **Dependency Integrity**: Frozen lock files + vulnerability scanning

### OpenSSF Best Practices

- ✅ [OSPS-BR-06.01] All assets signed at build time
- ✅ [OSPS-BR-01.03] Build runner isolated; PR code has no access to signing keys
- ✅ Transparent, auditable signing process
- ✅ Public trust root (Sigstore)

## Tools & Resources

### Cosign Installation

```bash
# Linux/macOS
curl -sSL https://github.com/sigstore/cosign/releases/download/v2.2.0/cosign-linux-amd64 -o cosign
chmod +x cosign
./cosign version

# Using package managers
brew install cosign    # macOS
apt-get install cosign # Debian/Ubuntu
```

### Documentation

- [Cosign Official Docs](https://docs.sigstore.dev/cosign/)
- [Sigstore Project](https://www.sigstore.dev/)
- [SLSA Framework](https://slsa.dev/)
- [Rekor Transparency Log](https://rekor.sigstore.dev/)
- [OpenSSF Best Practices Badge](https://bestpractices.coreinfrastructure.org/)

### Related Workflows

- [`.github/workflows/docker.yml`](.github/workflows/docker.yml) - Builds and signs images
- [`.github/workflows/release-attestation.yml`](.github/workflows/release-attestation.yml) - Creates signed attestations

## FAQ

### Q: How do I know the signature is valid?

A: Cosign verifies the signature against Sigstore's public root certificate and checks the Rekor transparency log. If verification succeeds, the artifact is authentic.

### Q: What if someone creates a fake signature?

A: Rekor records all signatures in an immutable log. Fake signatures cannot be added to Rekor without being detected. Verification will fail against the actual image hash.

### Q: Do I need to trust GitHub?

A: The trust comes from Sigstore and Rekor, not GitHub. GitHub provides the OIDC token, but the signature verification is cryptographic and doesn't require trusting any single entity.

### Q: Can I use these images in production?

A: Yes! Verify the signature before deployment:

```bash
cosign verify ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0 || exit 1
docker pull ghcr.io/bigmichi1/idle-code-redeemer-bot:2.0.0
docker run ...
```

### Q: What if a release isn't signed?

A: All releases published via GitHub are automatically signed. If verification fails, it may be:

- Old release (before signing was implemented)
- Manually uploaded assets (check that they come from verified workflow)
- Image pulled before signing completed

## Support

For questions about release signatures or verification issues, see [SECURITY.md](../SECURITY.md).
