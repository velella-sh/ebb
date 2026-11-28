<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/velella-sh/ebb/main/.github/assets/mark-night.svg">
    <img src="https://raw.githubusercontent.com/velella-sh/ebb/main/.github/assets/mark-day.svg" width="80" height="80" alt="Ebb">
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
  <a href="https://jsr.io/@velella/ebb"><img alt="JSR" src="https://img.shields.io/badge/JSR-@velella%2Febb-3F6E66?logo=jsr&logoColor=white&labelColor=1F1F28&style=flat"></a>
</p>

```bash
npm install @velella/ebb
```

> **Ask before you install.** AI coding agents and developers install dependencies without knowing when they will reach end of life. Ebb provides authoritative lifecycle answers before anything is added to the project.

[![Ebb terminal demo](https://velella.sh/ebb/demo/terminal.svg)](https://velella.sh/ebb/demo/)

---

## Three Ways In

- **TypeScript / JS Library**: Zero-dependency, offline in-memory lookups in microsecond time across Node.js, browsers, Edge workers, Deno, and Bun. See [Quickstart](docs/QUICKSTART.md).
- **Command Line (CLI)**: Inspect packages, query upcoming deadlines, find replacements, or audit CycloneDX SBOMs from the terminal. See [CLI Documentation](docs/cli.md).
- **AI Coding Agents (MCP & Skills)**: Equip Claude Code, Cursor, Codex, and Gemini with proactive check-before-install guardrails. See [MCP Server](docs/mcp.md) and [Agent Skills](docs/skills.md).

Coming from xeol? See the [one-minute migration guide](docs/from-xeol.md).

## Library Usage

```ts
import { check, replacementFor } from "@velella/ebb";

const request = check("pkg:npm/request", "2.88.2");
request.status;                              // "deprecated"
replacementFor("pkg:npm/request", "2.88.2"); // "Native fetch or a maintained HTTP client"

const node = check("node", "18.20.4");
node.status;           // "end-of-life"
node.matches[0]?.date; // "2025-04-30"
```

```ts
import { check } from "@velella/ebb";

check("pkg:npm/left-pad", "1.3.0");
check("pkg:generic/nodejs", "28.0.0");
check("node", "18.20.4");
check("pkg:generic/nodejs", "22.11.0", "2026-04-01");
```

```ts
import { checkAll, rulesFor } from "@velella/ebb";

const pythonEolRules = rulesFor("pkg:generic/python", { event: "end-of-life" });
pythonEolRules.some((rule) => rule.id === "python.runtime.eol-3.10-and-older");

const batch = checkAll([
  { purl: "pkg:npm/request", version: "2.88.2" },
  { purl: "pkg:generic/nodejs", version: "18.20.4" },
]);
batch.summary.total;
```

## CLI Usage

```bash
# Check lifecycle status for a package
npx @velella/ebb check pkg:npm/request@2.88.2

# Find which release line Ebb recommends
npx @velella/ebb versions node --as-of 2026-11-15

# Query upcoming deadlines
npx @velella/ebb upcoming --within 90d --ecosystem nodejs

# Evaluate lifecycle status as of a past or future date
npx @velella/ebb as-of 2027-05-01 node 22.11.0
```

## Why Ebb

- **Evidence, not opinion:** Every rule cites an authoritative vendor announcement or registry flag with reviewer provenance. See [Trust & Verification](docs/trust.md).
- **Standard identifiers:** [Package URLs (PURL)](https://github.com/package-url/purl-spec) and [VERS](https://github.com/package-url/vers-spec) ranges throughout, passing official test suites. See [VERS Guide](docs/vers.md).
- **Broad dataset:** 830 reviewed rules across 26 registry files. See [Writing a Rule](docs/RULES.md) and [Data Freshness](docs/freshness.md).
- **Zero runtime dependencies:** Pure ESM with a 569,000-byte packed size cap. See [package size](docs/SIZE.md) and [benchmark measurements](docs/benchmarks.md).
- **Offline by default:** Complete rules ship in the package; queries run without network round-trips. See [Offline Guide](docs/offline.md).
- **Cryptographic signing:** Updated data bundles are signed with Sigstore Cosign and verified offline. See [Data Bundles](docs/DATA.md) and [verify a published snapshot](docs/verify.md).

## Documentation

- **Guides**: [Quickstart](docs/QUICKSTART.md) · [CLI](docs/cli.md) · [Trust & Verification](docs/trust.md) · [Comparing Sources](docs/compare.md) · [Writing a Rule](docs/RULES.md) · [Importers](docs/IMPORTERS.md)
- **Features**: [Static JSON API](docs/static-api.md) · [Calendar Subscription](docs/calendar.md) · [Upcoming Deadlines](docs/upcoming.md) · [Time-Travel (`asOf`)](docs/as-of.md) · [GitHub Action](action/README.md)
- **Agents**: [MCP Server (`ebb mcp`)](docs/mcp.md) · [Agent Skills](docs/skills.md) · [Agent Demo](docs/demo/agent.md) · [Evaluations Report](docs/agent-evals.md)
- **Runtimes**: [Node.js](docs/QUICKSTART.md) · [Browsers](docs/BROWSER.md) · [Edge / Workers](docs/EDGE.md) · [Deno](docs/DENO.md) · [Bun](docs/BUN.md)
- **Reference**: [Result Model](docs/result-model.md) · [Batch Checking](docs/check-all.md) · [Evidence Sources](docs/sources-of.md) · [Confidence Levels](docs/confidence.md) · [API Stability](docs/API-STABILITY.md) · [Data Changelog](DATA-CHANGELOG.md)

## Contributing & License

Contributions are welcome. Every rule requires an authoritative source: see [CONTRIBUTING.md](CONTRIBUTING.md).
Code is [MIT](LICENSE); dataset is [CC BY 4.0](LICENSE-DATA). Part of [Velella](https://velella.sh).
