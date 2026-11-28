---
title: Structured successors
description: Read evidence-backed replacement packages, supported release lines, and API migration targets from Ebb.
layout: doc
permalink: /successors/
---

Ebb records structured migration targets when a lifecycle source identifies a package, supported release line, or API version. Each item supplies the target's canonical Package URL (PURL), display name, relationship, and a note where the migration needs context.

| Kind | Relationship |
| --- | --- |
| `successor` | The project directs users to a follow-up package, API, or managed runtime identifier. |
| `upgrade` | The same component has a newer supported release or API version. |
| `alternative` | A different package or product is an option for the same job. |

## Read the target

The library's [replacement helpers](/rules-for/) match a source PURL and version. `replacementFor()` returns a PURL or readable guidance. `replacementsFor()` returns the structured candidates from the first matching rule with such data.

```ts
import { replacementFor, replacementsFor, rulesFor } from "@velella/ebb";

const component = "pkg:pypi/superlinked";
const version = "5.0.0";
const guidance = replacementFor(component, version);
const candidates = replacementsFor(component, version);
const rule = rulesFor(component).find((entry) => entry.id === "python.package.superlinked.deprecated");

console.log(guidance, candidates[0]?.purl, rule?.requires?.python);
// The candidate is pkg:pypi/sie-sdk and requires Python 3.12 or later.
```

The [MCP server](/mcp/) exposes the same guidance and candidates in the `replacement_for` tool. Use the rule returned by `rulesFor()` or the [static API](/static-api/) when you need the rule's evidence and runtime requirements.

## Evaluate a migration

1. Match the source package and version, and read the relevant rule's sources and migration steps.
2. Resolve the target PURL in the package registry. If the candidate has a [VERS range](/vers/), select an available version within it and check the target's lifecycle status.
3. Check the rule's optional `requires.node` or `requires.python` against your pinned runtime. These fields record a minimum. Check the chosen release's package metadata for any further constraints. When the rule lists multiple alternatives, verify each candidate separately.
4. Verify changes to imports, APIs, and configuration in a clean install and with the project's tests. A Kubernetes API target represents a Kubernetes resource kind and API version. A Lambda target represents the provider's runtime identifier.

An empty candidate list leaves the text guidance as the consumer's starting point. A candidate without `vers` names a target whose compatible version still needs to be selected for the project.

## Coverage

The [successor audit](https://github.com/velella-sh/ebb/blob/main/tools/successors-audit.ts) inventories rules with text guidance and no structured items. Run `npm run build` and `node dist/tools/successors-audit.js --json` from a checkout to reproduce the counts or pass `--registry` to inspect a saved snapshot.

The following audit compares the 862-rule registry from November 28, 2026 before and after the structured successor update.

| Candidate class | Before | After |
| --- | ---: | ---: |
| Installable package | 1 | 0 |
| Same-component release line | 113 | 56 |
| API version | 34 | 2 |
| Product | 0 | 0 |
| Explicitly no target | 5 | 5 |
| Needs review | 483 | 372 |
| **Text-only total** | **636** | **435** |

The historic roadmap count of 757 used every non-empty text replacement in the November 26 snapshot, including 151 rules that had structured candidates. The text-only count for that snapshot was 606. See the [audit record](https://github.com/velella-sh/ebb/issues/693) for the revisions and replay command.

Remaining text-only guidance includes native functions and configuration changes, unnamed vendor targets, and intermediate API versions the vendor has since removed. For named package successors, the audit leaves the compatible version open when the source provides no shared API range. For example, the published migration notes for Pragmatic drag and drop, dnd-kit, tox, Celery, Hatch, PDM, runipy, and SIE SDK identify the targets and describe workflow changes.

The audit leaves 87 serverless, 27 Kubernetes, 25 Terraform, 28 database, and 46 container rules with text-only guidance. The 11 text-only GitHub Actions rules include workflow commands and actions with no tagged successor on a supported runtime. For example, the Go dependency submission action publishes v2 tags and its v2 manifest uses Node.js 20. Check the tagged release and its manifest before adding a successor. [Action releases](https://github.com/actions/go-dependency-submission/releases), [v2 manifest](https://github.com/actions/go-dependency-submission/blob/v2/action.yml)
