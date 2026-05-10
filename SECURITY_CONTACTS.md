# Security Contacts & Vulnerability Reporting [OSPS-VM-03.01]

This document provides the means for security researchers and the general public to privately report security vulnerabilities to the Idle Champions Code Redeemer Bot project. Multiple reporting channels are available to accommodate different preferences and circumstances.

## Primary Security Contact

**Idle Champions Code Redeemer Bot Security Team**

| Role | Name | Email | Availability |
|------|------|-------|--------------|
| **Project Maintainer** | BigMichi1 | security@[contact-method] | Business days (UTC) |
| **Backup Contact** | See GitHub CODEOWNERS | See repository | Business days (UTC) |

**Note**: Exact email addresses are available through GitHub repository settings to prevent spam. Contact the project maintainers through the methods below.

## Vulnerability Reporting Methods [OSPS-VM-03.01]

Security vulnerabilities should NEVER be reported through public channels (GitHub issues, discussions, etc.). Use one of the following private reporting methods instead:

### Method 1: GitHub Security Advisory (PREFERRED) ⭐

**Best for**: All types of security vulnerabilities

GitHub's built-in private vulnerability reporting feature ensures direct, secure communication with maintainers.

**Steps**:
1. Go to the [Security](https://github.com/BigMichi1/idle-code-redeemer/security) tab
2. Click **"Report a vulnerability"**
3. Fill in vulnerability details:
   - **Title**: Brief description of vulnerability
   - **Description**: Detailed explanation of the issue
   - **Severity**: Choose severity level (Critical, High, Medium, Low)
   - **CVSS Score**: Provide CVSS v3.1 score if available
4. Click **"Send report"**

**Advantages**:
- ✅ **Private**: Only visible to repository maintainers
- ✅ **Tracked**: GitHub tracks report status and communications
- ✅ **Secure**: Uses GitHub's security infrastructure
- ✅ **Direct**: No intermediaries between researcher and maintainers
- ✅ **Verifiable**: Built-in authentication with GitHub account
- ✅ **Preferred**: Recommended by GitHub and OpenSSF

**Response Time**: Acknowledgment within 1 business day

### Method 2: Email to Security Contact

**Best for**: Researchers without GitHub account, or preference for email

Email communication with the project's security contact provides a direct line of communication.

**Email Address**: [Available via GitHub repository security settings]

To find the security contact email:
1. Check the repository's `.github/SECURITY.md` file (if custom exists)
2. Check [SECURITY.md](SECURITY.md) for contact information
3. Contact project maintainer through GitHub profile
4. Check [GOVERNANCE.md](GOVERNANCE.md) for team contacts

**Email Guidelines**:
- Use clear subject line: `[SECURITY] Vulnerability Report - {brief description}`
- Encrypt email if PGP key is available
- Include all information from "What to Include in a Report" section
- Send from professional email address
- Do NOT include actual exploit code in initial report

**Advantages**:
- ✅ **Traditional**: Works for all researchers
- ✅ **Flexible**: Can include attachments (proof-of-concept, logs)
- ✅ **Encryptable**: Can use PGP for additional security
- ✅ **Offline**: No internet connectivity needed for composition
- ✅ **Trackable**: Email receipt confirmation

**Response Time**: Acknowledgment within 1 business day

### Method 3: GitHub Private Messaging

**Best for**: Researchers who prefer GitHub-based communication

Private messages through GitHub can be used for initial contact or if preferred.

**Steps**:
1. Visit the maintainer's GitHub profile (BigMichi1)
2. Use GitHub's "Send message" feature (if available)
3. Mention "[SECURITY]" in the first message
4. Provide vulnerability details
5. Request response to GitHub Security Advisory for formal tracking

**Advantages**:
- ✅ **Integrated**: Uses familiar GitHub interface
- ✅ **Authenticated**: GitHub account verification
- ✅ **Linked**: Connected to maintainer's profile and history

**Response Time**: Acknowledgment within 1 business day (may request GitHub Security Advisory for formal tracking)

## Communication Preferences

### Privacy & Confidentiality

✅ **Commitment**: All vulnerability reports are treated as confidential until public disclosure.

- Report details shared only with the minimum necessary team members
- No information disclosed to third parties without researcher consent
- Public disclosure delayed 30 days minimum after patch release
- Researcher identity kept private if requested

### Encryption & Secure Communication

**For Email Reports**:

If you wish to encrypt your vulnerability report email:

1. **PGP/GPG Key**: [To be published when maintainer publishes key]
   - Key ID: [When available]
   - Fingerprint: [When available]
   - Available at: https://keys.openpgp.org/

2. **How to Encrypt**:
   ```bash
   # Install GnuPG
   gpg --keyserver keys.openpgp.org --recv-key [KEY_ID]
   
   # Encrypt email body or attachment
   echo "Vulnerability details..." | gpg --encrypt --armor --recipient [KEY_ID]
   
   # Paste encrypted message into email body
   ```

3. **Decryption**: Maintainer will decrypt and respond with encrypted reply

**For GitHub Reports**:
- GitHub Security Advisories use end-to-end encryption
- GitHub handles encryption/decryption automatically
- No additional action needed

### Language

Reports can be submitted in:
- English (preferred)
- Other languages (will be translated, may increase response time)

## What to Include in a Report

To help us assess and address the vulnerability quickly, please include:

### Essential Information

1. **Title** - Clear, brief description
   - ✅ "SQL Injection in code redemption handler"
   - ❌ "Security issue"

2. **Description** - Detailed explanation of the vulnerability
   - What is the vulnerability?
   - Where in the code does it occur?
   - Why is it a problem?
   - What is the impact?

3. **Affected Versions** - Which versions are vulnerable?
   - "v2.4.0 and earlier"
   - "All versions as of 2024-01-01"
   - "v2.2.0 through v2.4.5"

4. **Steps to Reproduce** - How can the vulnerability be triggered?
   - Specific commands or inputs
   - Configuration needed
   - Prerequisites or setup
   - Expected vs actual behavior

### Helpful Information

5. **CVSS Score** - Severity assessment using CVSS v3.1
   - Available at: https://www.first.org/cvss/calculator/3.1
   - Example: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" (Score 9.8)

6. **Proof of Concept** - Demonstration of the vulnerability
   - Minimal code example
   - Logs or output showing the issue
   - Screenshots (if applicable)
   - Test data or configuration

7. **Impact Assessment** - Consequences of the vulnerability
   - Can it leak user credentials?
   - Can it compromise the Discord bot?
   - Can it access the SQLite database?
   - Can it execute arbitrary commands?
   - How many users are affected?

8. **Suggested Fix** (optional) - Proposed solution
   - Code changes
   - Configuration updates
   - Workaround steps

### Not Needed

❌ Do NOT include:
- Fully functional exploits or payload delivery methods
- Personal information of affected users
- Company-specific data or secrets
- Detailed attack scenarios that could enable others

## Tracking & Status Updates

### Report Status

After submitting a vulnerability report, you can track its status:

**Via GitHub Security Advisory**:
- Log into GitHub
- Navigate to [Security](https://github.com/BigMichi1/idle-code-redeemer/security)
- View "Report a vulnerability" tab for submission history
- Status visible: "Draft", "Awaiting maintainer", "Acknowledged", etc.

**Via Email**:
- Maintainer provides tracking ID in first response
- Use ID in all follow-up communications
- Status updates sent via email at key milestones
- Can request status update at any time

### Receiving Updates

The project commits to providing:

✅ **Initial Acknowledgment** - Within 1 business day
- Confirmation of receipt
- Tracking ID (if applicable)
- Estimated timeline for assessment

✅ **Status Updates** - At key milestones
- Assessment complete
- Fix development started
- Patch ready for testing
- Release scheduled
- Public disclosure planned

✅ **Closure Notification** - Upon completion
- Public advisory link
- Patch version numbers
- CVE ID (if assigned)
- Credit confirmation

## Response Timeline

The project follows the Coordinated Vulnerability Disclosure (CVD) Policy defined in [SECURITY.md](SECURITY.md):

| Severity | Initial Response | Patch Target | Disclosure |
|----------|------------------|--------------|------------|
| **CRITICAL** (CVSS ≥ 9.0) | 1-2 business days | 5 days | Expedited |
| **HIGH** (CVSS 7.0-8.9) | 1-2 business days | 5 days | 30 days |
| **MEDIUM** (CVSS 4.0-6.9) | 2-3 business days | 10 days | 30 days |
| **LOW** (CVSS < 4.0) | 3-5 business days | 14 days | 30 days |

For complete details, see [SECURITY.md - Vulnerability Response Timeline](SECURITY.md#vulnerability-response-timeline-osps-vm-0101).

## Researcher Recognition

The project recognizes and appreciates security researchers who responsibly report vulnerabilities.

### Recognition Options

Researchers can request one or more of the following:

✅ **Public Credit** - Acknowledgment in security advisory
- Name and/or organization
- Link to website or profile
- Mention in CHANGELOG.md

✅ **Anonymous Credit** - Contribution without revealing identity
- Listed as "Anonymous Researcher"
- No identifying information disclosed
- Still recognized for contribution

✅ **CVE Credits** - Listing in Common Vulnerabilities and Exposures
- Researcher name included in CVE record
- Publicly searchable in CVE databases

✅ **No Recognition** - Preference for confidentiality
- Vulnerability fixed and disclosed
- No public mention of reporter
- Completely confidential

### How to Request Recognition

Mention your preference in the initial vulnerability report:

**Examples**:
- "Please credit me as: John Doe, Security Researcher"
- "Please use my company name: Acme Security Inc."
- "Please keep this anonymous"
- "No recognition needed"

## Frequently Asked Questions

### Q: Will my vulnerability report be public?

**A**: No. Vulnerability reports are completely private and confidential until public disclosure. Only the project maintainers will see your report details until the patch is released and the security advisory is published (minimum 30 days after patch).

### Q: How long will it take to fix my vulnerability?

**A**: The project commits to:
- **Initial response**: 1 business day
- **Patch development**: 5-21 days depending on severity
- **Public disclosure**: Minimum 30 days after patch release

For specific timelines by severity, see [Response Timeline](#response-timeline) above.

### Q: Will I be credited for finding this vulnerability?

**A**: Yes, if you request it. You can choose public credit, anonymous credit, no credit, or any combination. Let us know your preference in the initial report.

### Q: Should I contact the Discord bot server owner?

**A**: No. Please use the official vulnerability reporting channels (GitHub Security Advisory or email). The server owner cannot fix the code. Report directly to the project maintainers.

### Q: What if I find multiple vulnerabilities?

**A**: Submit separate reports for each vulnerability using the same reporting method. This allows each issue to be assessed and tracked independently.

### Q: Can I disclose the vulnerability publicly if the project doesn't respond?

**A**: The project is committed to responding within 1 business day. If you do not receive a response after 2 business days:

1. **Follow up** - Send a follow-up message to the same channel
2. **Try alternative channel** - If email, try GitHub Security Advisory (or vice versa)
3. **Contact backup** - Check [GOVERNANCE.md](GOVERNANCE.md) for alternative contacts
4. **Allow time** - Weekends and holidays may delay response

After making a good faith effort for 30 days with no response, public disclosure is acceptable. However, this is very unlikely as the project takes security seriously.

### Q: What if this is not a security vulnerability?

**A**: The project distinguishes between:

**Security Vulnerabilities** (use this process):
- Authentication bypass
- Authorization bypass
- Credential theft
- Data leakage
- Code injection
- Privilege escalation
- Denial of service with impact to data/functionality

**Non-security Issues** (use public channels):
- Feature requests
- User experience improvements
- Documentation improvements
- Bug reports that don't affect security
- Configuration issues
- Performance improvements

If you're unsure, submit via GitHub Security Advisory anyway - the maintainers will categorize it appropriately.

## Related Documentation

- **[SECURITY.md](SECURITY.md)** - Full security policy and CVD process
- **[GOVERNANCE.md](GOVERNANCE.md)** - Project leadership and decision-making
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute code (not vulnerability reports)
- **[docs/security-assessment.md](docs/security-assessment.md)** - Known vulnerabilities and threat model

## Version History

- **v1.0** (2026-05-10) - Initial security contacts document
  - GitHub Security Advisory reporting
  - Email reporting method
  - Private messaging method
  - Response timeline commitments
  - Recognition program
  - CVD Policy reference
  - [OSPS-VM-03.01] compliance

---

**Last Updated**: May 10, 2026
**Status**: Active
**Review Schedule**: Annually or upon significant changes
