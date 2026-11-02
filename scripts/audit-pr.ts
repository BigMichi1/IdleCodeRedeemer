/**
 * Pull-request dependency audit: fails only on advisories the PR introduces.
 *
 * `bun audit` checks the lockfile against advisories published *today*, so a
 * new advisory against a package already on main turned every open PR red at
 * once -- including Dependabot PRs for unrelated packages (a GitHub Action, the
 * Debian base image), which could never fix it and so never auto-merged.
 *
 * This audits the base branch's lockfile first and ignores whatever it already
 * reports, then runs the real `bun audit` on the PR tree. A PR whose lockfile
 * change brings in a vulnerable version still fails. Advisories already on main
 * are reported by the full `audit:ci` run in .github/workflows/audit.yml.
 *
 * Usage: bun run scripts/audit-pr.ts --base <git-ref> [bun audit flags...]
 * Flags other than --base are forwarded to the PR-tree `bun audit` run, so the
 * known-exception list lives only in .mise.toml.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Extract GHSA IDs from `bun audit --json` output, which maps each package name
 * to its advisory list. Throws on anything that is not that shape: a base audit
 * that could not be read must fail the gate, not silently ignore nothing.
 */
export function advisoryIds(auditJson: string): string[] {
  const parsed: unknown = JSON.parse(auditJson);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Unexpected bun audit output: ${auditJson.slice(0, 200)}`);
  }
  const ids = new Set<string>();
  for (const advisories of Object.values(parsed)) {
    if (!Array.isArray(advisories)) {
      throw new Error(`Unexpected bun audit output: ${auditJson.slice(0, 200)}`);
    }
    for (const advisory of advisories as Array<{ url?: unknown }>) {
      const match =
        typeof advisory.url === 'string' ? /GHSA(-[0-9a-z]{4}){3}$/.exec(advisory.url) : null;
      if (!match) throw new Error(`Advisory without a GHSA URL: ${JSON.stringify(advisory)}`);
      ids.add(match[0]);
    }
  }
  return [...ids].sort();
}

/** Split `--base <ref>` out of argv; everything else is forwarded to bun audit. */
export function parseArgs(argv: string[]): { base: string; forwarded: string[] } {
  const index = argv.indexOf('--base');
  if (index === -1 || !argv[index + 1]) throw new Error('Missing --base <git-ref>');
  return { base: argv[index + 1]!, forwarded: [...argv.slice(0, index), ...argv.slice(index + 2)] };
}

function gitShow(ref: string, path: string): string {
  const result = Bun.spawnSync(['git', 'show', `${ref}:${path}`], { stderr: 'inherit' });
  if (result.exitCode !== 0) throw new Error(`git show ${ref}:${path} failed`);
  return result.stdout.toString();
}

/**
 * bun audit only reads package.json and bun.lock, so the base tree can be
 * audited from a bare temp directory without installing it.
 */
function auditBase(ref: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'audit-base-'));
  try {
    writeFileSync(join(dir, 'package.json'), gitShow(ref, 'package.json'));
    writeFileSync(join(dir, 'bun.lock'), gitShow(ref, 'bun.lock'));
    const result = Bun.spawnSync([process.execPath, 'audit', '--json'], {
      cwd: dir,
      stderr: 'inherit',
    });
    return advisoryIds(result.stdout.toString());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const { base, forwarded } = parseArgs(process.argv.slice(2));
  const preexisting = auditBase(base);
  if (preexisting.length > 0) {
    console.log(
      `Ignoring ${preexisting.length} advisories already present on ${base}: ${preexisting.join(', ')}`
    );
  }
  const ignores = preexisting.flatMap((id) => ['--ignore', id]);
  const result = Bun.spawnSync([process.execPath, 'audit', ...forwarded, ...ignores], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  process.exit(result.exitCode ?? 1);
}
