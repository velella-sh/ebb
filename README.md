<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/velella-sh/ebb/main/.github/assets/mark-night.svg">
    <img src="https://raw.githubusercontent.com/velella-sh/ebb/main/.github/assets/mark-day.svg" width="96" height="96" alt="Ebb">
  </picture>
</p>

<h1 align="center">Ebb</h1>

<p align="center">
  <strong>Nothing ships forever. Everything ebbs.</strong><br>
  The open almanac of software end-of-life.
</p>

<p align="center">
  <a href="https://github.com/velella-sh/ebb/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/velella-sh/ebb/ci.yml?branch=main&label=CI&logo=github&logoColor=white&labelColor=1F1F28&color=3F6E66&style=flat"></a>
  <a href="https://github.com/velella-sh/ebb/actions/workflows/ci.yml"><img alt="Coverage" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fvelella-sh%2Febb%2Fbadges%2Fcoverage.json&labelColor=1F1F28&style=flat"></a>
  <a href="https://www.npmjs.com/package/@velella/ebb"><img alt="npm" src="https://img.shields.io/npm/v/@velella/ebb?label=npm&logo=npm&logoColor=white&labelColor=1F1F28&color=3F6E66&style=flat"></a>
  <a href="https://jsr.io/@velella/ebb"><img alt="JSR" src="https://jsr.io/badges/@velella/ebb"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/velella-sh/ebb?labelColor=1F1F28&color=3F6E66&style=flat"></a>
  <a href="https://securityscorecards.dev/viewer/?uri=github.com/velella-sh/ebb"><img alt="OpenSSF Scorecard" src="https://img.shields.io/ossf-scorecard/github.com/velella-sh/ebb?label=openssf%20scorecard&labelColor=1F1F28&color=3F6E66&style=flat"></a>
  <a href="https://skills.sh/velella-sh/ebb/ebb"><img alt="skills.sh" src="https://skills.sh/b/velella-sh/ebb"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="docs/QUICKSTART.md">5-Min Guide</a> ·
  <a href="#examples">Examples</a> ·
  <a href="#static-json-api">Static API</a> ·
  <a href="#what-a-rule-looks-like">Rules</a> ·
  <a href="#the-data">Data</a> ·
  <a href="#performance">Performance</a> ·
  <a href="#documentation">Docs</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

Ebb is an open dataset of software lifecycle rules: what is deprecated, unsupported, end-of-life, or removed, since when, and what to move to. It comes with a small TypeScript library for reading it.

Every rule names a component by its [Package URL](https://github.com/package-url/purl-spec) and its versions by a [VERS](https://github.com/package-url/vers-spec) range, so any tool that knows a purl and a version can ask Ebb about it.

The library passes the official purl-spec suite: 586 of 586 tests ([fixtures](tests/purl/fixtures/), [CI](https://github.com/velella-sh/ebb/actions/runs/42812045096)), with one case (`types/maven-test.json[13]`, [purl-spec#1027](https://github.com/package-url/purl-spec/issues/1027)) counted through a documented alternative because the fixture is inconsistent upstream; see [tests/purl/README.md](tests/purl/README.md).

## Why Ebb

- **Evidence, not opinion.** Every rule cites the authoritative source behind it, the date that source was read, and who reviewed the rule and when.
- **Broad coverage.** 752 rules across 25 ecosystems: language runtimes, npm, PyPI, Maven, NuGet, Cargo, Go, containers, Kubernetes APIs, GitHub Actions, Terraform, and more.
- **Standard identifiers.** purl and VERS throughout, with no ecosystem-specific lookup tables to learn.
- **Actionable.** Rules carry a replacement and migration guidance: the constraints to keep, the steps to take, and how to verify the change.
- **Measured impact on AI agents.** Eliminates deprecated dependency picks entirely (dropping from 38% down to 0% across 100 benchmark tasks; see [evals/agents/REPORT.md](evals/agents/REPORT.md)).
- **LLMs and agents native.** Standard machine-readable documentation for models at [llms.txt](llms.txt) and [llms-full.txt](llms-full.txt), backed by an official MCP server and agent skills.
- **Zero dependencies.** Pure ESM with zero runtime dependencies. Instant installs, zero supply-chain risk.
- **Compact footprint.** ~268 KB packed tarball with a strict 500 KB budget enforced in CI ([docs/SIZE.md](docs/SIZE.md)).
- **Offline by default.** The rules ship inside the package. Newer rules arrive as signed data bundles, verified with Sigstore before use.

## Quick start

> For a 5-minute walkthrough across the library, CLI, AI agents (MCP & skills), static API, and GitHub Actions, see [**docs/QUICKSTART.md**](docs/QUICKSTART.md).

```bash
npm install @velella/ebb
```

Requires Node.js 22 or newer for Node environments, or modern Browsers / Edge runtimes. ESM only.

## Supported runtimes

| Runtime | Support | Notes |
| :--- | :--- | :--- |
| **Node.js** | `>=22` | Native CLI, local cache, Sigstore bundle verification |
| **Browsers** | Chromium, Firefox, WebKit / Safari | Zero Node dependencies, offline in-memory data, ~135 KB gzipped ([docs/BROWSER.md](docs/BROWSER.md)) |
| **Cloudflare Workers** | `workerd` | Fast execution under the free plan budget (< 15% limit) ([docs/EDGE.md](docs/EDGE.md)) |
| **Vercel Edge** | `edge-light` | Native V8 isolate support ([docs/EDGE.md](docs/EDGE.md)) |
| **Deno** | `>=1.40`, `2.x` | Native ESM support via `jsr:@velella/ebb` or `npm:` ([docs/DENO.md](docs/DENO.md)) |
| **Bun** | `>=1.0` | Full CLI and library compatibility ([docs/BUN.md](docs/BUN.md)) |

```ts
import { check, replacementFor } from "@velella/ebb";

const node = check("node", "18.20.4");
node.status;           // "end-of-life"
node.matches[0]?.date; // "2025-04-30"

const request = check("pkg:npm/request", "2.88.2");
request.status;                              // "deprecated"
replacementFor("pkg:npm/request", "2.88.2"); // "Native fetch or a maintained HTTP client"
```

`check` takes a purl or a product name plus a version and returns every matching rule synchronously. Pass an optional `asOf` day (`YYYY-MM-DD`) to fill each match's `daysLeft`; omit it to keep the two-argument form (`daysLeft` stays `null`). The first call may block while it reads the active data file; later calls reuse the cached index:

```ts
import { check } from "@velella/ebb";

// A deprecated package
// `date: null` means the rule has no deadline date.
// Without `asOf`, `daysLeft` is always null.
check("pkg:npm/left-pad", "1.3.0");
// {
//   schemaVersion: 1,
//   status: "deprecated",
//   matches: [
//     {
//       ruleId: "npm.package.left-pad.deprecated",
//       event: "deprecated",
//       date: null,
//       daysLeft: null,
//       replacement: "String.prototype.padStart()",
//       sources: [
//         {
//           title: "left-pad package deprecation notice",
//           url: "https://www.npmjs.com/package/left-pad",
//           accessedAt: "2026-10-13"
//         }
//       ],
//       reviewedAt: "2026-10-14"
//     }
//   ],
//   version: "1.3.0"
// }

// A safe version
check("pkg:generic/nodejs", "24.0.0");
// { schemaVersion: 1, status: "ok", matches: [], version: "24.0.0" }

// A product name
check("node", "18.20.4");
// {
//   schemaVersion: 1,
//   status: "end-of-life",
//   matches: [
//     {
//       ruleId: "nodejs.runtime.eol-18",
//       event: "end-of-life",
//       date: "2025-04-30",
//       daysLeft: null,
//       replacement: "Node.js 22 LTS or later",
//       sources: [
//         {
//           title: "Node.js Release Working Group schedule",
//           url: "https://github.com/nodejs/Release/blob/main/schedule.json",
//           accessedAt: "2026-10-17"
//         }
//       ],
//       reviewedAt: "2026-10-17"
//     }
//   ],
//   version: "18.20.4"
// }

// Pass `asOf` to measure daysLeft from that day (never from a clock).
check("pkg:generic/nodejs", "22.11.0", "2026-04-01");
// {
//   schemaVersion: 1,
//   status: "scheduled",
//   matches: [
//     {
//       ruleId: "nodejs.runtime.eol-22",
//       event: "scheduled",
//       date: "2027-04-30",
//       daysLeft: 394,
//       replacement: "Node.js 24 LTS or later",
//       sources: [ /* … */ ],
//       reviewedAt: "2026-10-24"
//     }
//   ],
//   version: "22.11.0",
//   asOf: "2026-04-01"
// }
```

To inspect a component's rules or check a batch of dependencies:

```ts
import { checkAll, rulesFor } from "@velella/ebb";

const pythonEolRules = rulesFor("pkg:generic/python", { event: "end-of-life" });
pythonEolRules.some((rule) => rule.id === "python.runtime.eol-3.10-and-older"); // true

const batch = checkAll([
  { purl: "pkg:npm/request", version: "2.88.2" },
  { purl: "pkg:generic/nodejs", version: "18.20.4" },
]);
batch.summary.total; // 2
```

Import from `@velella/ebb`. Legacy `0.1.x` subpaths keep resolving until `1.0` with `@deprecated` notices; see [docs/API-STABILITY.md](docs/API-STABILITY.md) for entry-point details.

## Command-Line Interface (CLI)

Verify dependencies, run batch SBOM checks, or find modern replacements directly from the terminal without external dependencies:

```bash
# Check a package URL with human-readable colored output
npx @velella/ebb check pkg:npm/request@2.88.2

# Output Markdown for pull request comments
npx @velella/ebb check pkg:npm/request@2.88.2 --format markdown

# Check dependencies from CycloneDX or JSON
npx @velella/ebb check-all bom.json --json

# Find recommended replacement
npx @velella/ebb replacement pkg:npm/request@2.88.2
```

```text
✖ pkg:npm/request@2.88.2: deprecated
  Rule: npm.package.request.deprecated
  Event: deprecated (2020-02-11)
  Replacement: Native fetch or a maintained HTTP client
  Sources:
    - https://www.npmjs.com/package/request
  Offing can fix this: https://github.com/velella-sh/offing
```

Supports `--format <text|markdown|json>`, `--fail-on <threshold>`, `--no-color` (respects `NO_COLOR`), and `--no-hint`. See [docs/cli.md](docs/cli.md) for complete options and exit codes.

## GitHub Action

Run continuous lifecycle checks across your pull requests and pipelines using the official GitHub Action:

```yaml
- name: Audit Dependencies with Ebb
  uses: velella-sh/ebb@v0
  with:
    purls: |
      pkg:npm/axios@1.6.0
      pkg:docker/library/node@22.0.0
    fail-on: deprecated
```

Or audit an entire CycloneDX SBOM:

```yaml
- uses: velella-sh/ebb@v0
  with:
    file: bom.json
    fail-on: unsupported
```

Automatically generates inline workflow annotations (`::warning::`, `::error::`), writes Markdown tables to the GitHub Actions Job Summary, and supports remediation hints. See [action/README.md](action/README.md) for details.

## AI Agents (MCP & Skills)

Ebb provides official guardrails for AI coding agents (Claude Code, Cursor, Codex, Gemini CLI, Antigravity) to prevent agents from recommending deprecated or end-of-life dependencies.

### Agent Skill (`skills.sh`)

Install the official Ebb skill across your agent environment using the `skills` CLI:

```bash
npx skills add velella-sh/ebb
```

The skill equips agents with a check-before-add workflow: discovering project runtimes (`.nvmrc`, `Dockerfile`), checking new packages before install, and verifying GitHub Actions runner deprecations. See [Agent Skills](docs/skills.md).

### MCP Server (`@velella/ebb-mcp`)

Connect Ebb directly to agent environments via the Model Context Protocol over stdio:

```bash
# Claude Code
claude mcp add ebb -- npx -y @velella/ebb-mcp

# Cursor / Codex / Gemini
# Declare in your mcp.json under mcpServers:
# "ebb": { "command": "npx", "args": ["-y", "@velella/ebb-mcp"] }
```

Exposes `check`, `check_all`, `replacement_for`, and the `ebb://upcoming` resource. See [MCP Server](docs/mcp.md).

## Static JSON API

Ebb provides an open, static JSON API served directly from GitHub Pages at `https://velella.sh/ebb/api/v1/`. Query any component lifecycle without installing any package or running a server:

```bash
# Query a package lifecycle with curl
curl -s https://velella.sh/ebb/api/v1/npm/request.json | jq .

# Query an ecosystem
curl -s https://velella.sh/ebb/api/v1/npm.json | jq '{ rulesCount, componentsCount }'

# Query upcoming deadlines
curl -s https://velella.sh/ebb/api/v1/upcoming.json | jq '.upcoming[:3]'
```

Features include global component indexing (`/index.json`), name prefix search (`/search-index.json`), upcoming EOL events (`/upcoming.json`), ETags for conditional caching, and zero-dependency client helpers (`fetchRule`, `fetchComponent`). See [docs/static-api.md](docs/static-api.md) for full endpoint specifications and client SDK examples.

## What a rule looks like

```json
{
  "id": "nodejs.runtime.eol-20",
  "purl": "pkg:generic/nodejs",
  "vers": "vers:semver/>=20.0.0|<21.0.0",
  "event": "end-of-life",
  "title": "Node.js 20 is end-of-life",
  "severity": "high",
  "replacement": "Node.js 22 LTS or later",
  "deadline": "2026-04-30",
  "sources": [
    {
      "title": "Node.js Release Working Group schedule",
      "url": "https://github.com/nodejs/Release/blob/main/schedule.json",
      "accessedAt": "2026-10-17"
    }
  ],
  "provenance": { "observedAt": "2026-10-17", "reviewedAt": "2026-10-17", "reviewer": "arminazimi" },
  "migration": { "constraints": ["…"], "steps": ["…"], "verification": ["…"] }
}
```

Shortened. The full format is in [docs/RULES.md](docs/RULES.md) and [`schemas/`](schemas/).

## The data

| Path | What it is |
|---|---|
| [`registry/`](registry/) | The rules, one file per ecosystem (`ebb.registry.v2`). |
| [`schemas/`](schemas/) | JSON Schemas for the registry, a single rule, and the data bundle. |
| [`cases/`](cases/) | Behaviour cases: this purl at this version is judged by exactly these rules. |
| [`data/`](data/) | The Sigstore trusted root used to verify data bundles offline. |

## Performance

Ebb is designed for CI pipelines and real-time dependency checks where lookups cannot add noticeable latency. Every rule lookup runs in sub-millisecond time.

Measured using `npm run bench`:

| Operation | Target | Median latency | Throughput |
|---|---|---|---|
| **`check` (single)** | Single component (`pkg:npm/left-pad`) | 0.0016 ms | ~625,000 ops/s |
| **`check` (per-component)** | 1,000 components | 0.0029 ms | ~345,000 ops/s |
| **`checkAll`** | 1,000 components batch | 0.0525 ms | ~19,000 batches/s |
| **Data load** | All 25 bundled registries (752 rules) | 12.7 ms | ~79 loads/s |

### Cold start overhead

Measured across fresh processes (ESM import + cold data load + first check):

- **Node.js 24:** ~88 ms total (31 ms import, 55 ms first check)
- **Node.js 22:** ~122 ms total (55 ms import, 65 ms first check)

Once loaded into memory, registries and precompiled VERS ranges remain cached, keeping per-component evaluations well under 1 ms.

## Examples

Runnable examples for common workflows and deployment environments are located in [`examples/`](examples/):

| Example | Description |
| :--- | :--- |
| [`package.json`](examples/package-json/) | Audit Node.js dependencies directly from application manifests |
| [CycloneDX SBOM](examples/cyclonedx/) | Evaluate software bills of materials directly via CLI or TypeScript API |
| [Dockerfile](examples/dockerfile/) | Check container base images (`FROM`) against upstream EOL schedules |
| [GitHub Actions](examples/github-actions/) | Audit `.github/workflows/*.yml` for retired runner action versions |
| [Upcoming EOL](examples/upcoming-eol/) | Forecast lifecycle deadlines and calculate days left (`asOf`) |
| [Static API](examples/static-api/) | Query Ebb from shell scripts with `curl` and `jq` without Node.js |
| [Browser](examples/browser/) | Interactive in-memory lifecycle inspection in client-side HTML |
| [Cloudflare & Vercel](examples/workers/) | Deploy Ebb on Edge isolates within free-tier budgets |
| [Deno](examples/deno/) | Native Deno 2.x and JSR import examples |
| [Bun](examples/bun/) | High-throughput lifecycle evaluations under Bun runtime |

## Documentation

These pages are also published as a site, built with [Mizzen](https://velella.sh/mizzen/) and [Lateen](https://velella.sh/lateen/): <https://velella.sh/ebb/>.

- [Quickstart](docs/QUICKSTART.md): 5-minute guide across library, CLI, AI agents, static API, and GitHub Actions.
- [CLI](docs/cli.md): command-line interface for offline checks and SBOM batch evaluation.
- [Agent Skills](docs/skills.md): guardrails for AI coding agents via skills.sh.
- [MCP server](docs/mcp.md): connect Ebb over standard stdio JSON-RPC 2.0.
- [Agent Evaluations](evals/agents/REPORT.md): benchmark report measuring agent accuracy with and without Ebb.
- [llms.txt](llms.txt) & [llms-full.txt](llms-full.txt): LLM-optimized documentation according to the llms.txt standard.
- [Writing a rule](docs/RULES.md): the format, the evidence policy, and the review workflow.
- [Importers](docs/IMPORTERS.md): tools that draft rules from authoritative sources for a maintainer to review.
- [Data bundles, signing and trust](docs/DATA.md): how newer data is published, verified, and pinned.
- [Design decisions](docs/decisions/): the records behind the registry format, importers, and data bundles.

## Using Ebb in your tool

If your project reads its lifecycle data from Ebb, you are welcome to show it:

[![eol data by ebb](https://img.shields.io/badge/eol%20data%20by-ebb-3F6E66?labelColor=1F1F28&style=flat&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJFYmIiPjx0aXRsZT5FYmI8L3RpdGxlPjxwYXRoIGQ9Ik0yNiAzNEg3MEE2IDYgMCAwIDEgNzYgNDBWNDBBNiA2IDAgMCAxIDcwIDQ2SDI2QTYgNiAwIDAgMSAyMCA0MFY0MEE2IDYgMCAwIDEgMjYgMzRaTTM4IDU0SDgyQTYgNiAwIDAgMSA4OCA2MFY2MEE2IDYgMCAwIDEgODIgNjZIMzhBNiA2IDAgMCAxIDMyIDYwVjYwQTYgNiAwIDAgMSAzOCA1NFpNNTAgNzRIOTRBNiA2IDAgMCAxIDEwMCA4MFY4MEE2IDYgMCAwIDEgOTQgODZINTBBNiA2IDAgMCAxIDQ0IDgwVjgwQTYgNiAwIDAgMSA1MCA3NFoiIGZpbGw9IiM3QUE4OUYiLz48L3N2Zz4K)](https://github.com/velella-sh/ebb)

```md
[![eol data by ebb](https://img.shields.io/badge/eol%20data%20by-ebb-3F6E66?labelColor=1F1F28&style=flat&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMTIwIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJFYmIiPjx0aXRsZT5FYmI8L3RpdGxlPjxwYXRoIGQ9Ik0yNiAzNEg3MEE2IDYgMCAwIDEgNzYgNDBWNDBBNiA2IDAgMCAxIDcwIDQ2SDI2QTYgNiAwIDAgMSAyMCA0MFY0MEE2IDYgMCAwIDEgMjYgMzRaTTM4IDU0SDgyQTYgNiAwIDAgMSA4OCA2MFY2MEE2IDYgMCAwIDEgODIgNjZIMzhBNiA2IDAgMCAxIDMyIDYwVjYwQTYgNiAwIDAgMSAzOCA1NFpNNTAgNzRIOTRBNiA2IDAgMCAxIDEwMCA4MFY4MEE2IDYgMCAwIDEgOTQgODZINTBBNiA2IDAgMCAxIDQ0IDgwVjgwQTYgNiAwIDAgMSA1MCA3NFoiIGZpbGw9IiM3QUE4OUYiLz48L3N2Zz4K)](https://github.com/velella-sh/ebb)
```

## Contributing

Corrections and new rules are welcome. A rule needs an authoritative source. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

The code is [MIT](LICENSE). The data (`registry/` and `schemas/`) is [CC BY 4.0](LICENSE-DATA). Credit it as described in [ATTRIBUTION.md](ATTRIBUTION.md).

---

<p align="center">Ebb is part of <a href="https://velella.sh">Velella</a>.</p>
