/**
 * Submits the resolved dependency tree from bun.lock to GitHub's dependency
 * submission API.
 *
 * GitHub's dependency graph parses package.json but not bun.lock, so it only
 * ever saw this project's 19 direct dependencies. Every advisory this project
 * has had was in a transitive package, which meant Dependabot alerts had
 * nothing to match and stayed silent while `bun audit` reported 20 findings.
 *
 * Run from CI with GITHUB_TOKEN (contents: write). With --dry-run it prints the
 * snapshot instead of submitting, which is how you inspect it locally.
 */

interface LockEntry {
  0: string; // "name@version"
  1: string; // registry
  2: Record<string, unknown>; // dependency metadata
  3: string; // integrity
}

interface Manifest {
  workspaces: Record<
    string,
    {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    }
  >;
  packages: Record<string, LockEntry>;
}

/**
 * bun.lock is JSONC: it carries trailing commas that JSON.parse rejects. Strip
 * them rather than pulling in a JSONC parser for one file.
 */
function parseLockfile(text: string): Manifest {
  return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'));
}

/**
 * Entry keys are either a bare package name or a `parent/name` path for a
 * version that had to be duplicated. Only the trailing segment names the
 * package, and a scoped name keeps its own slash.
 */
function packageNameFromKey(key: string): string {
  if (key.startsWith('@')) return key;
  const segments = key.split('/');
  if (segments.length === 1) return key;
  const tail = segments.slice(-2).join('/');
  return tail.startsWith('@') ? tail : segments[segments.length - 1]!;
}

/** Split "name@version" on the version separator, not on a scope's leading @. */
function splitIdentifier(identifier: string): { name: string; version: string } {
  const at = identifier.lastIndexOf('@');
  if (at <= 0) return { name: identifier, version: '' };
  return { name: identifier.slice(0, at), version: identifier.slice(at + 1) };
}

/** purl for the npm ecosystem; the scope's @ has to be percent-encoded. */
function packageUrl(name: string, version: string): string {
  const encoded = name.startsWith('@') ? `%40${name.slice(1)}` : name;
  return version ? `pkg:npm/${encoded}@${version}` : `pkg:npm/${encoded}`;
}

function directDependencyNames(manifest: Manifest): {
  runtime: Set<string>;
  development: Set<string>;
} {
  const root = manifest.workspaces[''] ?? {};
  const runtime = new Set([
    ...Object.keys(root.dependencies ?? {}),
    ...Object.keys(root.optionalDependencies ?? {}),
  ]);
  const development = new Set(Object.keys(root.devDependencies ?? {}));
  return { runtime, development };
}

/**
 * A package is "runtime" scope when it is reachable from a production
 * dependency. Anything only reachable from devDependencies is "development",
 * which is what lets a reader tell a shipped advisory from a tooling one.
 */
function resolveRuntimeReachable(manifest: Manifest, roots: Set<string>): Set<string> {
  const byName = new Map<string, LockEntry>();
  for (const [key, entry] of Object.entries(manifest.packages)) {
    byName.set(packageNameFromKey(key), entry);
  }

  const reachable = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (reachable.has(name)) continue;
    reachable.add(name);

    const entry = byName.get(name);
    const metadata = (entry?.[2] ?? {}) as Record<string, Record<string, string> | undefined>;
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const child of Object.keys(metadata[field] ?? {})) {
        if (!reachable.has(child)) queue.push(child);
      }
    }
  }
  return reachable;
}

function buildResolved(manifest: Manifest): Record<string, unknown> {
  const { runtime, development } = directDependencyNames(manifest);
  const runtimeReachable = resolveRuntimeReachable(manifest, runtime);
  const resolved: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(manifest.packages)) {
    const { name, version } = splitIdentifier(entry[0]);
    const purl = packageUrl(name, version);
    // Duplicated versions share a name but not a purl; key on the purl so both
    // copies survive into the snapshot. That distinction is the whole point
    // here -- a stale second copy of undici was exactly what went unnoticed.
    if (resolved[purl]) continue;

    const isDirect = runtime.has(name) || development.has(name);
    const metadata = (entry[2] ?? {}) as Record<string, Record<string, string> | undefined>;
    const dependencies = Object.keys(metadata.dependencies ?? {});

    resolved[purl] = {
      package_url: purl,
      relationship: isDirect ? 'direct' : 'indirect',
      scope: runtimeReachable.has(name) ? 'runtime' : 'development',
      dependencies: dependencies.map((child) => {
        const childEntry = manifest.packages[child] ?? manifest.packages[`${key}/${child}`];
        const childVersion = childEntry ? splitIdentifier(childEntry[0]).version : '';
        return packageUrl(child, childVersion);
      }),
    };
  }

  return resolved;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const manifest = parseLockfile(await Bun.file('bun.lock').text());
  const resolved = buildResolved(manifest);

  const snapshot = {
    version: 0,
    job: {
      id: process.env.GITHUB_RUN_ID ?? 'local',
      correlator: `${process.env.GITHUB_WORKFLOW ?? 'local'}-${process.env.GITHUB_JOB ?? 'dependency-submission'}`,
    },
    sha: process.env.GITHUB_SHA ?? '',
    ref: process.env.GITHUB_REF ?? '',
    detector: {
      name: 'bun-lock-dependency-snapshot',
      version: '1.0.0',
      url: 'https://github.com/BigMichi1/IdleCodeRedeemer/blob/main/scripts/dependency-snapshot.ts',
    },
    scanned: new Date().toISOString(),
    manifests: {
      'bun.lock': {
        name: 'bun.lock',
        file: { source_location: 'bun.lock' },
        resolved,
      },
    },
  };

  const runtimeCount = Object.values(resolved).filter(
    (pkg) => (pkg as { scope: string }).scope === 'runtime'
  ).length;
  // Summary goes to stderr so --dry-run output stays pipeable into jq.
  console.error(
    `Resolved ${Object.keys(resolved).length} packages from bun.lock (${runtimeCount} runtime, ${Object.keys(resolved).length - runtimeCount} development)`
  );

  if (dryRun) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  const repository = requireEnv('GITHUB_REPOSITORY');
  const response = await fetch(
    `${process.env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repository}/dependency-graph/snapshots`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${requireEnv('GITHUB_TOKEN')}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snapshot),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Snapshot submission failed (${response.status}): ${body}`);
  }
  console.log(`Snapshot accepted: ${body}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
