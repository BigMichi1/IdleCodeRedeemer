# Developer Certificate of Origin

This project requires all code contributors to assert that they are legally authorized to make the associated contributions. We use the Developer Certificate of Origin (DCO) to ensure this. [OSPS-LE-01.01]

## What is the DCO?

The Developer Certificate of Origin (DCO) is a lightweight way for contributors to certify that they wrote or otherwise have the legal right to submit the code they are contributing to the project.

## The Developer Certificate of Origin v1.1

By making a contribution to this project, I certify that:

```
(a) The contribution was created in whole or in part by me and I have
    the right to submit it under the open source license indicated in
    the file; or

(b) The contribution is based upon previous work that, to the best of
    my knowledge, is covered under an appropriate open source license
    and I have the right under that license to submit that work with
    modifications, whether created in whole or in part by me, under
    the same open source license (unless I am permitted to submit
    under a different license), as indicated in the file; or

(c) The contribution was provided directly to me by some other person
    who certified (a), (b) or (c) and I have not modified it.

(d) I understand and agree that this project and the contribution are
    public and that a record of the contribution (including all personal
    information I submit with it, including my sign-off) is maintained
    indefinitely and may be redistributed consistent with this project
    or the open source license(s) involved.
```

## How to Sign Your Commits

The DCO is enforced via commit sign-offs. To sign off on your commits, use the `-s` flag when committing:

```bash
git commit -s -m "type(scope): description"
```

This adds a "Signed-off-by" trailer to your commit message:

```
type(scope): description

Signed-off-by: Your Name <your.email@example.com>
```

### Example

```bash
# Before sign-off (incorrect)
git commit -m "feat: add new command"

# After sign-off (correct)
git commit -s -m "feat: add new command"

# Result in commit message:
# feat: add new command
#
# Signed-off-by: Jane Doe <jane@example.com>
```

## Configuring Git for Easy Sign-Off

To make signing off easier, you can configure Git with your name and email:

```bash
# Set globally (recommended)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Or set per repository
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

After configuration, `git commit -s` will automatically add your sign-off.

## Using a Git Alias

You can create a Git alias to simplify the process:

```bash
git config --global alias.cs 'commit -s'
```

Then use:
```bash
git cs -m "feat: description"
```

## DCO Enforcement

This project enforces DCO sign-offs via:

1. **Git Hooks** - Pre-commit hooks check for sign-offs locally
2. **GitHub Actions** - Status check verifies all commits are signed off
3. **Pull Request Checks** - CI/CD pipeline blocks PRs with unsigned commits

Every commit in a pull request must be signed off. If a commit is missing a sign-off, the pull request will fail CI/CD checks and cannot be merged.

## What If I Forgot to Sign Off?

If you've already made commits without sign-offs, you can amend them:

### Single Commit

```bash
git commit --amend -s
git push --force-with-lease
```

### Multiple Commits

```bash
# Rebase last N commits (e.g., last 3)
git rebase -i HEAD~3

# For each commit, change 'pick' to 'reword'
# In the editor, add '-s' flag and save:
# commit -s -m "existing message"

git push --force-with-lease
```

## Questions?

If you have questions about the DCO or sign-off process, please open a GitHub issue or discussion.

## Reference

- [Linux Kernel DCO](https://developercertificate.org/)
- [GitHub DCO Documentation](https://docs.github.com/en/github/managingwork-on-github/managing-your-work-on-github)
- [OpenSSF Best Practices Badge Requirements](https://bestpractices.coreinfrastructure.org/)

---

**Note**: The DCO is a legally binding assertion that you have the right to contribute the code. Please ensure you understand what you're asserting before signing off.
