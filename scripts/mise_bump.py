#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mise-pin-check — report newer remote versions for exactly-pinned tools.

Reads mise config file(s), finds tools pinned to an exact version, queries
`mise ls-remote <tool>` for each, and reports the newest available patch,
minor and major release relative to the pin.

Nothing is ever written back to the config; this is read-only.

Requires Python 3.11+ (tomllib) and `mise` on PATH.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tomllib
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Literal

Scope = Literal["patch", "minor", "major"]
SCOPES: tuple[Scope, ...] = ("patch", "minor", "major")

DEFAULT_CONFIG_NAMES = (
    "mise.toml",
    ".mise.toml",
    "mise.local.toml",
    ".mise.local.toml",
    ".config/mise.toml",
    ".config/mise/config.toml",
)

# prefix = everything before the first run of digits (e.g. "temurin-")
# core   = the dotted numeric release ("25.0.0")
# rest   = build metadata / qualifiers ("+36", "-ea", "+11.0.LTS")
VERSION_RE = re.compile(r"^(?P<prefix>.*?)(?P<core>\d+(?:\.\d+)*)(?P<rest>.*)$")

PRERELEASE_TOKENS = frozenset(
    {"ea", "rc", "beta", "alpha", "snapshot", "dev", "nightly",
     "preview", "pre", "canary", "next", "insider", "milestone"}
)


def _is_prerelease(rest: str) -> bool:
    """True if the trailing qualifier looks like a pre-release marker."""
    for token in re.split(r"[^a-z0-9]+", rest.lower()):
        if token.rstrip("0123456789") in PRERELEASE_TOKENS:
            return True
    return False


@dataclass(frozen=True, slots=True)
class Version:
    raw: str
    prefix: str
    release: tuple[int, ...]
    rest: str
    prerelease: bool

    @classmethod
    def parse(cls, raw: str) -> Version | None:
        m = VERSION_RE.match(raw.strip())
        if not m:
            return None
        rest = m["rest"]
        return cls(
            raw=raw.strip(),
            prefix=m["prefix"],
            release=tuple(int(p) for p in m["core"].split(".")),
            rest=rest,
            prerelease=_is_prerelease(rest),
        )

    def padded(self, width: int) -> tuple[int, ...]:
        return self.release + (0,) * (width - len(self.release))

    def component(self, index: int) -> int:
        return self.release[index] if index < len(self.release) else 0


def compare_release(a: Version, b: Version) -> int:
    width = max(len(a.release), len(b.release))
    ka, kb = a.padded(width), b.padded(width)
    return (ka > kb) - (ka < kb)


def scope_of(pin: Version, candidate: Version) -> Scope | None:
    """Classify candidate relative to pin, or None if it is not newer."""
    if candidate.prefix != pin.prefix or compare_release(pin, candidate) >= 0:
        return None
    if candidate.component(0) != pin.component(0):
        return "major"
    return "patch" if candidate.component(1) == pin.component(1) else "minor"


# --------------------------------------------------------------------------
# config parsing
# --------------------------------------------------------------------------

def iter_requested(spec: object) -> Iterator[str]:
    """Yield version strings from a [tools] entry in any of its TOML shapes."""
    match spec:
        case str():
            yield spec
        case dict() if isinstance(spec.get("version"), str):
            yield spec["version"]
        case list():
            for item in spec:
                yield from iter_requested(item)


def discover_configs(explicit: list[Path], root: Path) -> list[Path]:
    if explicit:
        missing = [p for p in explicit if not p.is_file()]
        if missing:
            sys.exit(f"config file not found: {', '.join(map(str, missing))}")
        return explicit
    found = [root / name for name in DEFAULT_CONFIG_NAMES if (root / name).is_file()]
    if not found:
        sys.exit(f"no mise config found in {root} (looked for: {', '.join(DEFAULT_CONFIG_NAMES)})")
    return found


def load_tools(paths: list[Path]) -> dict[str, str]:
    """Merge [tools] across config files; later files win. First version only."""
    tools: dict[str, str] = {}
    for path in paths:
        with path.open("rb") as fh:
            data = tomllib.load(fh)
        for name, spec in (data.get("tools") or {}).items():
            for version in iter_requested(spec):
                tools[name] = version
                break
    return tools


# --------------------------------------------------------------------------
# mise interaction
# --------------------------------------------------------------------------

def ls_remote(tool: str, timeout: float) -> list[str]:
    proc = subprocess.run(
        ["mise", "ls-remote", tool],
        capture_output=True, text=True, timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip() or f"exit {proc.returncode}")
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


@dataclass(slots=True)
class Result:
    tool: str
    requested: str
    pin: Version | None = None
    newest: dict[Scope, Version] = None          # type: ignore[assignment]
    skipped: str | None = None
    error: str | None = None

    def __post_init__(self) -> None:
        if self.newest is None:
            self.newest = {}


def check_tool(tool: str, requested: str, *, min_components: int,
               include_prerelease: bool, timeout: float) -> Result:
    pin = Version.parse(requested)
    if pin is None:
        return Result(tool, requested, skipped="unparseable version")

    try:
        remote_raw = ls_remote(tool, timeout)
    except Exception as exc:                     # noqa: BLE001 - surfaced per tool
        return Result(tool, requested, pin=pin, error=str(exc))

    # An entry counts as an exact pin if mise lists it verbatim, or if it
    # carries at least `min_components` numeric parts (default 3: "25.0.0").
    exact = requested in remote_raw or len(pin.release) >= min_components
    if not exact:
        return Result(tool, requested, pin=pin, skipped="not an exact pin")

    newest: dict[Scope, Version] = {}
    for raw in remote_raw:
        candidate = Version.parse(raw)
        if candidate is None:
            continue
        if candidate.prerelease and not include_prerelease:
            continue
        scope = scope_of(pin, candidate)
        if scope is None:
            continue
        current = newest.get(scope)
        if current is None or compare_release(current, candidate) < 0:
            newest[scope] = candidate

    return Result(tool, requested, pin=pin, newest=newest)


# --------------------------------------------------------------------------
# output
# --------------------------------------------------------------------------

def render_table(results: list[Result], scopes: tuple[Scope, ...], show_all: bool) -> str:
    rows = [("TOOL", "PINNED", *(s.upper() for s in scopes))]
    body = []
    for r in results:
        if r.skipped or r.error:
            continue
        cells = [r.newest[s].raw if s in r.newest else "-" for s in scopes]
        if not show_all and all(c == "-" for c in cells):
            continue
        body.append((r.tool, r.requested, *cells))
    if not body:
        return "" if not show_all else "no tools to report"
    rows.extend(body)
    widths = [max(len(row[i]) for row in rows) for i in range(len(rows[0]))]
    return "\n".join("  ".join(c.ljust(w) for c, w in zip(row, widths)).rstrip() for row in rows)


def render_notes(results: list[Result]) -> str:
    lines = []
    for r in results:
        if r.error:
            lines.append(f"  {r.tool}: ls-remote failed — {r.error}")
    for r in results:
        if r.skipped:
            lines.append(f"  {r.tool}: skipped ({r.skipped}) — requested {r.requested!r}")
    return "\n".join(lines)


def to_json(results: list[Result], scopes: tuple[Scope, ...]) -> str:
    payload = {
        r.tool: {
            "requested": r.requested,
            "updates": {s: r.newest[s].raw for s in scopes if s in r.newest},
            **({"skipped": r.skipped} if r.skipped else {}),
            **({"error": r.error} if r.error else {}),
        }
        for r in results
    }
    return json.dumps(payload, indent=2, sort_keys=True)


# --------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="mise-pin-check",
        description="Show newer remote versions for exactly-pinned mise tools (read-only).",
    )
    parser.add_argument("-f", "--file", type=Path, action="append", default=[],
                        metavar="PATH", help="mise config file (repeatable; default: auto-discover)")
    parser.add_argument("-C", "--directory", type=Path, default=Path.cwd(),
                        help="directory to discover config files in (default: cwd)")
    parser.add_argument("-o", "--only", choices=SCOPES, action="append", default=[],
                        help="restrict output to these bump scopes (repeatable)")
    parser.add_argument("-t", "--tool", action="append", default=[], metavar="NAME",
                        help="limit to these tools (repeatable)")
    parser.add_argument("--include-prerelease", action="store_true",
                        help="consider ea/rc/beta/snapshot builds")
    parser.add_argument("--min-components", type=int, default=3, metavar="N",
                        help="numeric parts required to treat a version as an exact pin (default: 3)")
    parser.add_argument("-a", "--all", action="store_true",
                        help="also list tools that are already up to date")
    parser.add_argument("-j", "--jobs", type=int, default=8, help="parallel ls-remote calls (default: 8)")
    parser.add_argument("--timeout", type=float, default=60.0, help="per-tool timeout in seconds")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    parser.add_argument("-q", "--quiet", action="store_true", help="suppress skip/error notes")
    parser.add_argument("--exit-code", action="store_true",
                        help="exit 1 when any update was found (for CI)")
    args = parser.parse_args(argv)

    if shutil.which("mise") is None:
        sys.exit("mise not found on PATH")

    scopes: tuple[Scope, ...] = tuple(s for s in SCOPES if s in args.only) or SCOPES

    configs = discover_configs(args.file, args.directory)
    tools = load_tools(configs)
    if args.tool:
        wanted = set(args.tool)
        tools = {k: v for k, v in tools.items() if k in wanted}
    if not tools:
        sys.exit("no tools found in " + ", ".join(map(str, configs)))

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        results = list(pool.map(
            lambda kv: check_tool(
                *kv,
                min_components=args.min_components,
                include_prerelease=args.include_prerelease,
                timeout=args.timeout,
            ),
            sorted(tools.items()),
        ))

    if args.json:
        print(to_json(results, scopes))
    else:
        table = render_table(results, scopes, args.all)
        if table:
            print(table)
        elif not args.quiet:
            print("all pinned tools are up to date")
        if not args.quiet and (notes := render_notes(results)):
            print("\nnotes:", notes, sep="\n")

    found = any(r.newest.get(s) for r in results for s in scopes)
    return 1 if (args.exit_code and found) else 0


if __name__ == "__main__":
    sys.exit(main())
