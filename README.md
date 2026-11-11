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
  <a href="https://www.npmjs.com/package/@velella/ebb"><img alt="npm" src="https://img.shields.io/npm/v/@velella/ebb?label=npm&logo=npm&logoColor=white&labelColor=1F1F28&color=3F6E66&style=flat"></a>
  <a href="https://github.com/velella-sh/ebb/actions/workflows/ci.yml"><img alt="coverage" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fvelella-sh%2Febb%2Fbadges%2Fcoverage.json&labelColor=1F1F28&style=flat"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-a-rule-looks-like">Rules</a> ·
  <a href="#the-data">Data</a> ·
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
- **Offline by default.** The rules ship inside the package. Newer rules arrive as signed data bundles, verified with Sigstore before use.

## Quick start

```bash
npm install @velella/ebb
```

Requires Node.js 22 or newer. ESM only.

```ts
import { lookupProduct } from "@velella/ebb/lookup";

const node = await lookupProduct("node", "18.20.4");
node.status;    // "end-of-life"
node.deadline;  // "2025-04-30"

const request = await lookupProduct("pkg:npm/request", "2.88.2");
request.status;      // "deprecated"
request.replacement; // "Native fetch or a maintained HTTP client"
```

`check` answers the same question synchronously — a purl or a product name, plus a version — and returns every matching rule. Pass an optional `asOf` day (`YYYY-MM-DD`) to fill each match's `daysLeft`; omit it to keep the two-argument form (`daysLeft` stays `null`). The first call may block while it reads the active data file; later calls reuse the cached index:

```ts
import { check } from "@velella/ebb/check";

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

To work with the rules directly:

```ts
import { bundledRules } from "@velella/ebb/bundled-rules";
import { purlIdentity } from "@velella/ebb/purl";
import { versContains } from "@velella/ebb/vers/index";

const rules = await bundledRules();
const affected = rules.filter(
  (rule) => purlIdentity(rule.purl) === "pkg:generic/python" && versContains(rule.vers, "3.9.18"),
);
```

Each module is imported by its own path (`@velella/ebb/<module>`). Until 1.0 the module layout may still change. Minor and patch releases add data, and anything that breaks an import is called out in the release notes.

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

## Documentation

These pages are also published as a site, built with [Mizzen](https://velella.sh/mizzen/) and [Lateen](https://velella.sh/lateen/): <https://velella.sh/ebb/>.

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
