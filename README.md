# Ebb

**The open almanac of software end-of-life.**

Ebb is a dataset of lifecycle rules, covering what is deprecated, unsupported, end-of-life, or removed, and since when, plus a small TypeScript library for reading them. Each rule names a component by its [Package URL](https://github.com/package-url/purl-spec) and its versions by a [VERS](https://github.com/package-url/vers-spec) range, and cites the source that says so. Any tool that knows a purl and a version can use it.

- **752 rules across 25 ecosystems**: language runtimes, npm, PyPI, Maven, NuGet, Cargo, Go, containers, Kubernetes APIs, GitHub Actions, Terraform, and more.
- **Every rule cites its source and the date it was read**, and records who reviewed it and when.
- **Offline by default.** The rules ship inside the package. Newer rules arrive as signed data bundles, verified with Sigstore before use.

## Install

```bash
npm install @velella/ebb
```

Node.js 22 or newer. ESM only.

## Use

```ts
import { lookupProduct } from "@velella/ebb/lookup";

const node = await lookupProduct("node", "18.20.4");
node.status;    // "end-of-life"
node.deadline;  // "2025-04-30"

const request = await lookupProduct("pkg:npm/request", "2.88.2");
request.status;      // "deprecated"
request.replacement; // "Native fetch or a maintained HTTP client"
```

Working with the rules directly:

```ts
import { bundledRules } from "@velella/ebb/bundled-rules";
import { purlIdentity } from "@velella/ebb/purl";
import { versContains } from "@velella/ebb/vers/index";

const rules = await bundledRules();
const affected = rules.filter(
  (rule) => purlIdentity(rule.purl) === "pkg:generic/python" && versContains(rule.vers, "3.9.18"),
);
```

Each module is imported by its own path (`@velella/ebb/<module>`). Until 1.0 the module layout may still change; minor and patch releases add data, and anything that breaks an import is called out in the release notes.

## The data

| Path | What it is |
|---|---|
| [`registry/`](registry/) | The rules, one file per ecosystem (`ebb.registry.v2`). |
| [`schemas/`](schemas/) | JSON Schemas for the registry, a single rule, and the data bundle. |
| [`cases/`](cases/) | Behaviour cases: this purl at this version is judged by exactly these rules. |
| [`data/`](data/) | The Sigstore trusted root used to verify data bundles offline. |

- [Writing a rule](docs/RULES.md): the format, the evidence policy, and the review workflow.
- [Importers](docs/IMPORTERS.md): tools that draft rules from authoritative sources for a maintainer to review.
- [Data bundles, signing and trust](docs/DATA.md): how newer data is published, verified, and pinned.

## Contributing

Corrections and new rules are welcome. A rule needs an authoritative source; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The code is [MIT](LICENSE). The data (`registry/` and `schemas/`) is [CC BY 4.0](LICENSE-DATA). Credit it as described in [ATTRIBUTION.md](ATTRIBUTION.md).

Ebb is part of [Velella](https://velella.sh).
