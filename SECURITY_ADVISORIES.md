# Security Advisories [OSPS-VM-04.01]

This document publicly discloses known vulnerabilities and security issues in the Idle Champions Code Redeemer Bot project. Security advisories are published in this predictable location for user awareness and transparency.

This is the official source for security information, CVE details, vulnerability history, mitigation guidance, and remediation instructions for all versions of the project.

## Active Security Advisories

There are currently **0 active critical security advisories**. All identified vulnerabilities have been addressed or mitigated.

## Known Security Issues & Limitations

The following are known security issues or limitations that users should be aware of. These do not constitute vulnerabilities in the project code itself, but rather environmental or architectural limitations.

### Issue 1: Idle Champions API SSL Certificate (Known, Documented, Mitigated)

**Status**: ⚠️ Known Issue (Monitored)
**Severity**: MEDIUM (CVSS 5.5)
**Affected Versions**: All versions (v1.0+)
**CVE ID**: Not applicable (external service issue)
**Reported**: Not reported by external researcher
**First Identified**: v2.0 release
**Current Status**: Mitigated

#### Description

The Idle Champions game server API uses an **expired or self-signed SSL certificate**. This creates a theoretical vulnerability to man-in-the-middle (MITM) attacks during API communication.

**Technical Details**:
- SSL certificate validation is disabled: `NODE_TLS_REJECT_UNAUTHORIZED=0`
- Environment variable: `NODE_TLS_REJECT_UNAUTHORIZED=0`
- Purpose: Required because the game API server has certificate issues
- Impact: API communication vulnerable to MITM attacks
- Root Cause: External service limitation (not under our control)

#### Who Is Affected?

**Vulnerable To MITM Attack If**:
- ✓ Running the bot on an untrusted network
- ✓ Network traffic is not encrypted end-to-end
- ✓ Running on shared hosting with network visibility
- ✓ Bot running behind a proxy without TLS termination
- ✓ Network sniffer/packet capture tools on same network

**Not Vulnerable If**:
- ✓ Running behind a VPN
- ✓ Network is properly firewalled (corporate/home network)
- ✓ Running on dedicated/trusted infrastructure
- ✓ Using DNS over HTTPS (DoH)
- ✓ Running in a containerized environment with network isolation

#### How to Determine If Vulnerable

**Check your network setup**:

```bash
# Check if the environment variable is set
echo $NODE_TLS_REJECT_UNAUTHORIZED

# If output is "0", SSL validation is disabled (expected for this bot)
# If output is empty, check bot logs for SSL certificate errors

# Check Docker environment
docker inspect [container-name] | grep NODE_TLS_REJECT_UNAUTHORIZED

# Review deployment location
# - Home network: ✓ Secure
# - Corporate VPN: ✓ Secure
# - Shared hosting: ✗ At risk
# - Public cloud without private network: ⚠️ At risk
```

**Risk Assessment Checklist**:

```
Network Security Checklist:
□ Bot runs behind VPN? → YES = Lower risk
□ Bot on private network? → YES = Lower risk
□ Bot on shared hosting? → NO = Safer
□ Network monitoring active? → YES = Better detection
□ HTTPS everywhere in deployment? → YES = Better security
```

#### Mitigation Strategies

**Recommended Mitigation** (in order of effectiveness):

1. **Run Behind VPN** (Most Effective)
   ```bash
   # Use a VPN to encrypt all network traffic
   # VPN provider recommendations: NordVPN, Mullvad, Proton VPN
   # Cost: Typically $5-15/month
   # Effectiveness: Blocks MITM attacks by encrypting all traffic
   ```

2. **Use Private Network Infrastructure**
   ```bash
   # Run bot on dedicated/private infrastructure:
   # - Home server on private network (best)
   # - Corporate network with firewall (good)
   # - Private cloud (AWS private subnet, etc.)
   # - Docker with network isolation
   ```

3. **Enable DNS Over HTTPS (DoH)**
   ```bash
   # Configure system or application to use DoH
   # Prevents DNS spoofing attacks
   # Protects against some MITM scenarios
   # Linux example: cloudflared (Cloudflare WARP)
   ```

4. **Network Monitoring**
   ```bash
   # Monitor network traffic for suspicious activity
   tcpdump -i eth0 'tcp port 443'
   # Alert on unusual patterns to API server
   # Log all API requests for audit trail
   ```

5. **Regular Updates**
   ```bash
   # Keep bot updated to latest version
   # git pull origin main
   # bun install
   # Restart bot with latest code
   # Ensures any fixes are applied
   ```

#### Remediation Instructions

**For Users** (What You Should Do):

1. **Assess Your Risk Level**
   - Identify where the bot is running
   - Evaluate if the network is trusted
   - Determine exposure level

2. **Implement Mitigation**
   - If high risk: Use VPN or private network
   - If medium risk: Enable DoH and monitoring
   - If low risk: Monitor for suspicious activity

3. **Monitor for Attacks**
   - Review bot logs regularly
   - Check for unusual API responses
   - Monitor bot health metrics
   - Report suspicious activity

4. **Keep Bot Updated**
   - Check for bot updates regularly
   - Test updates in staging first
   - Deploy updates promptly
   - Track release notes for security patches

**For Project Maintainers** (What We're Doing):

✅ **Currently Implemented**:
- Issue documented and disclosed
- Mitigation strategies provided
- Risk level clearly communicated
- Environment variable clearly marked
- Code comments explain why required

✅ **Monitoring**:
- Track Idle Champions API status
- Monitor for certificate fixes
- Follow up with game developers
- Test for certificate updates

✅ **Future Actions**:
- Remove `NODE_TLS_REJECT_UNAUTHORIZED=0` if API certificate fixed
- Implement response signature verification as additional security
- Add response validation schema checking
- Consider DNS/HTTPS-only API option if available

#### Timeline

- **v2.0 Release** (2026-01-15): Issue discovered during development
- **v2.0 Launch** (2026-01-20): Documented in SECURITY.md
- **v2.1 Release** (2026-03-10): Mitigation strategies added
- **v2.3 Release** (2026-05-01): Moved to SECURITY_ADVISORIES.md
- **Ongoing**: Monitoring for API certificate updates

#### Workaround (Temporary)

If you cannot use VPN or private network:

```bash
# Option 1: Run bot with monitoring
# Monitor API responses for tampering
# Alert on unexpected data changes
# Validate response integrity

# Option 2: Use cloud private network
# AWS: Run in private subnet, use NAT
# Azure: Virtual Network with Network Security Group
# GCP: VPC with private service access

# Option 3: Application-level detection
# Implement response signature verification
# Hash critical response fields
# Alert on hash mismatches
```

#### Related Information

- **Security Assessment**: [docs/security-assessment.md](docs/security-assessment.md#external-api-communication) - Threat analysis
- **Deployment Guide**: [BUILD.md](BUILD.md) - Deployment recommendations
- **Vulnerability Policy**: [SECURITY.md](SECURITY.md) - CVD policy and procedures

---

## Fixed Vulnerabilities

The following vulnerabilities have been reported, fixed, and released. They are listed for historical reference and user awareness.

**Current Status**: No previously disclosed vulnerabilities to report

Future vulnerabilities that are fixed will be listed here with:
- CVE ID (if assigned)
- Description
- Affected versions
- Fixed versions
- Release date
- Detailed mitigation instructions

---

## Vulnerability Disclosure Timeline

### Legend

- 🔴 **CRITICAL** - Requires immediate action, serious impact
- 🟠 **HIGH** - Important to address soon, significant impact
- 🟡 **MEDIUM** - Should address, moderate impact
- 🟢 **LOW** - Consider addressing, low impact
- ⚠️ **KNOWN ISSUE** - Known limitation, not a code vulnerability

### 2026 Timeline

| Date | Type | Severity | Issue | Status |
|------|------|----------|-------|--------|
| 2026-01-15 | KNOWN ISSUE | 🟡 MEDIUM | Idle Champions API SSL Certificate | Documented & Mitigated |

---

## CVE Information

### CVE Database

- **CVE Authority**: MITRE CVE
- **CVE Search**: https://cve.mitre.org/
- **NVD Lookup**: https://nvd.nist.gov/vuln/

### CVE IDs for This Project

**Status**: No CVE IDs assigned yet

If vulnerabilities are found and fixed in the future, CVE IDs will be requested and published here with:
- CVE-XXXX-XXXXX format
- Description
- CVSS score
- Affected versions
- Fixed versions
- CWE classification

### Subscribing to CVE Notifications

To receive notifications about new CVEs:

1. **NVD Mailing List**: Subscribe at https://nvd.nist.gov/
2. **GitHub Security Alerts**: Enable in repository settings
3. **RSS Feed**: Monitor this file or repository releases
4. **Email Notifications**: Follow GitHub release emails

---

## How Consumers Can Determine If Vulnerable

### For Known Issues (Idle Champions API SSL Certificate)

**Check if you are running a vulnerable setup**:

```bash
# 1. Check your infrastructure
# - Are you on a trusted private network?
# - Are you using a VPN?
# - Is your network firewalled?

# 2. Check environment variable
echo $NODE_TLS_REJECT_UNAUTHORIZED
# Expected: "0" (means SSL validation disabled due to known API issue)

# 3. Check bot version
# Look at bot logs or command output
# Should show version number (v2.0+)

# 4. Check logs for API errors
# Look for SSL or certificate errors in logs
grep -i "certificate\|ssl\|tls" logs/*.log

# 5. Network diagnostic
# Check if API calls are succeeding
# Test from a different network to compare behavior
```

**Risk Assessment**:

```bash
# Run this script to assess your risk level
cat << 'EOF' > check_risk.sh
#!/bin/bash

RISK_LEVEL="LOW"

# Check 1: Are you on a shared network?
if ping -c 1 other-host.local 2>/dev/null; then
  echo "⚠️ Multiple hosts on network (shared hosting)"
  RISK_LEVEL="MEDIUM"
fi

# Check 2: Is VPN active?
if ip link show | grep -q "tun0\|wg0"; then
  echo "✅ VPN active (encrypted traffic)"
  RISK_LEVEL="LOW"
else
  echo "❌ No VPN detected"
fi

# Check 3: Check SSL variable
if [ "$NODE_TLS_REJECT_UNAUTHORIZED" = "0" ]; then
  echo "⚠️ SSL validation disabled (expected for this bot)"
fi

echo "Risk Level: $RISK_LEVEL"
EOF

chmod +x check_risk.sh
./check_risk.sh
```

### For Future Vulnerabilities

When vulnerabilities are published, they will include:

1. **Version Check**
   ```bash
   # Version of bot running
   # CVE advisory will list affected versions
   # Check your version against the list
   ```

2. **Condition Check**
   ```bash
   # Specific configuration or conditions required
   # Check if your setup matches vulnerable configuration
   # Example: "Only affects bots with feature X enabled"
   ```

3. **Automated Scanning**
   ```bash
   # Git log to check if patch is applied
   # Grep code for vulnerable patterns
   # Check for specific configuration flags
   ```

---

## Mitigation and Remediation Instructions

### General Remediation Process

**For Any Vulnerability**:

1. **Read Advisory**
   - Understand what is vulnerable
   - Check if it affects your version
   - Assess risk to your deployment

2. **Apply Patch**
   - Update to patched version
   - Or apply provided workaround
   - Test in staging environment first

3. **Deploy**
   - Deploy to production when ready
   - Monitor for issues
   - Verify vulnerability is fixed

4. **Report Success/Issues**
   - If issues arise, report them
   - Use GitHub Issues for bugs
   - Use SECURITY_CONTACTS.md for security issues

### Known Issue: Idle Champions API SSL Certificate

**Short-term Mitigation** (Immediate):
- Use VPN to encrypt all traffic
- Run on private/trusted network
- Enable DoH for DNS security
- Monitor logs for suspicious activity

**Long-term Remediation** (Ongoing):
- Monitor Idle Champions API status
- Test for certificate updates
- Remove `NODE_TLS_REJECT_UNAUTHORIZED=0` when safe
- Implement additional validation layers

**Step-by-Step Remediation**:

```bash
# Step 1: Assess your setup
# Determine if you need VPN protection

# Step 2: Implement mitigation
# If at risk:
#   - Set up VPN
#   - Configure network isolation
#   - Enable monitoring

# Step 3: Monitor bot
# Check logs for errors or unusual activity
# Monitor API response times and data
# Alert on anomalies

# Step 4: Stay updated
# Check for bot updates
# Review release notes for security fixes
# Deploy updates promptly
```

---

## Security Advisory Format

Future security advisories published here will follow this format:

```markdown
### Title: [Security Advisory] {Vulnerability Title} [CVE-XXXX-XXXXX]

**Status**: Reported / Fixed / Patched
**Severity**: CRITICAL / HIGH / MEDIUM / LOW
**CVSS Score**: X.X (Vector String)
**Affected Versions**: X.Y.Z and earlier
**Patched Versions**: X.Y.Z+
**CVE ID**: CVE-XXXX-XXXXX
**CWE ID**: CWE-XXX

#### Description
- What is the vulnerability?
- Why is it a problem?
- How can it be exploited?
- What is the impact?

#### Who Is Affected
- Specific versions listed
- Specific configurations
- Specific deployment scenarios

#### How to Determine If Vulnerable
- Check version number
- Check configuration
- Run diagnostic commands
- Look for indicators in logs

#### Mitigation Strategies
- Immediate workarounds
- Temporary fixes
- Long-term solutions

#### Remediation Instructions
- Step-by-step fix procedure
- Testing procedures
- Verification steps

#### Timeline
- When reported
- When fixed
- When released
- When publicly disclosed

#### References
- Related documentation
- External resources
- Similar issues
```

---

## Subscribing to Updates

### GitHub Security Advisories

Enable notifications:
1. Go to [Security Advisories](https://github.com/BigMichi1/idle-code-redeemer/security/advisories)
2. Click "Watch" button
3. Select "Security alerts"

### GitHub Releases

Subscribe to release notifications:
1. Go to [Releases](https://github.com/BigMichi1/idle-code-redeemer/releases)
2. Click "Watch" → "Releases only"
3. Get notified when new versions are released

### Email Notifications

- Enable GitHub notifications in account settings
- Subscribe to release mailing list (if available)
- Monitor this repository's activity feed

### RSS Feed

Subscribe to repository RSS feed:
```
https://github.com/BigMichi1/idle-code-redeemer/releases.atom
```

---

## Contact & Reporting

### Report a New Vulnerability

Do NOT open public GitHub issues for security vulnerabilities.

Instead, use the private reporting methods:
- GitHub Security Advisory (preferred)
- Email to security contact

See [SECURITY_CONTACTS.md](SECURITY_CONTACTS.md) for complete reporting instructions.

### Request Information

For questions about published advisories:
1. Check [SECURITY.md](SECURITY.md) for CVD policy
2. Check [SECURITY_CONTACTS.md](SECURITY_CONTACTS.md) for contact info
3. Open regular GitHub issue for non-security questions

---

## Compliance & Standards

This document follows:
- **CVSS v3.1** - Common Vulnerability Scoring System
- **CWE** - Common Weakness Enumeration
- **CVE** - Common Vulnerabilities and Exposures
- **OpenSSF Best Practices** - OSPS-VM-04.01

Related Security Documentation:
- [SECURITY.md](SECURITY.md) - Security policy and CVD process
- [SECURITY_CONTACTS.md](SECURITY_CONTACTS.md) - Vulnerability reporting
- [docs/security-assessment.md](docs/security-assessment.md) - Threat model

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-05-10 | Initial security advisories document [OSPS-VM-04.01] |

---

**Last Updated**: May 10, 2026
**Status**: Active
**Review Schedule**: Upon each release or when vulnerabilities are discovered
**Next Review**: 2026-06-01
