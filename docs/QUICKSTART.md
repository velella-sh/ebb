---
title: "Quickstart"
description: "Get your first lifecycle answer with Ebb in under five minutes across the library, CLI, AI agents, static API, and GitHub Actions."
layout: doc
permalink: /quickstart/
---

# Ebb Quickstart

Get your first lifecycle answer with Ebb in under five minutes.

Ebb is the open almanac of software end-of-life. It answers whether a package, runtime, container image, or tool is **active**, **deprecated**, **unsupported**, or **end-of-life**, explains why with authoritative evidence, and suggests what to replace it with.

> [!TIP]
> Ebb runs completely offline with **zero runtime dependencies** and microsecond evaluation speed.

Choose your interface below:
- [1. Library Quickstart](#1-library-quickstart-typescript--javascript)
- [2. CLI Quickstart](#2-cli-quickstart)
- [3. AI Agent Quickstart (MCP & Skills)](#3-ai-agent-quickstart-mcp--skills)
- [4. Static JSON API Quickstart](#4-static-json-api-quickstart)
- [5. GitHub Action Quickstart](#5-github-action-quickstart)
- [What Ebb Is Not](#what-ebb-is-not)
- [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)

---

## 1. Library Quickstart (TypeScript / JavaScript)

### Installation

:::code-tabs{labels='["npm", "pnpm", "yarn", "bun", "deno"]'}
```bash
npm install @velella/ebb
```
```bash
pnpm add @velella/ebb
```
```bash
yarn add @velella/ebb
```
```bash
bun add @velella/ebb
```
```bash
deno add jsr:@velella/ebb
```
:::

### Checking a Component

```ts
import { check, replacementFor } from "@velella/ebb";

// Check a runtime
const nodeResult = check("node", "18.20.4");
console.log(nodeResult.status);           // "end-of-life"
console.log(nodeResult.matches[0]?.date); // "2025-04-30"

// Check a package
const leftPad = check("pkg:npm/left-pad", "1.3.0");
console.log(leftPad.status); // "deprecated"

// Get an actionable replacement
const replacement = replacementFor("pkg:npm/left-pad", "1.3.0");
console.log(replacement); // "String.prototype.padStart()"
```

### Batch Evaluation (`checkAll`)

Pass an array of components or CycloneDX items to evaluate them in sub-millisecond batch:

```ts
import { checkAll } from "@velella/ebb";

const batch = checkAll([
  { purl: "pkg:npm/left-pad", version: "1.3.0" },
  { purl: "pkg:npm/react", version: "18.2.0" },
  { purl: "pkg:pypi/django", version: "2.2.0" },
]);

console.log(`Evaluated ${batch.summary.total} items:`);
console.log(batch.summary.byStatus);
// { ok: 1, deprecated: 1, unsupported: 0, "end-of-life": 1, removed: 0, scheduled: 0 }
```

### Browser and Edge Runtimes

For Cloudflare Workers, Vercel Edge, or frontend browsers, import from the isomorphic subpath with zero Node.js dependencies:

```ts
import { check } from "@velella/ebb/browser";

const res = check("pkg:npm/request", "2.88.2");
```

---

## 2. CLI Quickstart

Run directly without installing via `npx`:

:::terminal
$ npx @velella/ebb check pkg:npm/request@2.88.2
✖ pkg:npm/request@2.88.2: deprecated
  Rule: npm.package.request.deprecated
  Event: deprecated (2020-02-11)
  Replacement: Native fetch or a maintained HTTP client
  Sources:
    - https://www.npmjs.com/package/request
  Offing can fix this: https://github.com/velella-sh/offing
:::

### Common CLI Tasks

```bash
# Check with custom output formatting (markdown, json, or text)
npx @velella/ebb check node 18.20.4 --format markdown

# Batch check a CycloneDX SBOM file
npx @velella/ebb check-all bom.json --fail-on deprecated

# Pipe a list of Package URLs from stdin
cat purls.txt | npx @velella/ebb check-all

# Discover suggested replacements
npx @velella/ebb replacement pkg:npm/node-sass 9.0.0
```

---

## 3. AI Agent Quickstart (MCP & Skills)

AI coding agents often generate outdated code or recommend abandoned dependencies. Ebb provides an official Model Context Protocol (MCP) server and agent skills that eliminate deprecated suggestions.

### Connect MCP Server

Add to your `claude_desktop_config.json`, Cursor, or Antigravity config:

```json
{
  "mcpServers": {
    "ebb": {
      "command": "npx",
      "args": ["-y", "@velella/ebb-mcp"]
    }
  }
}
```

The MCP server exposes:
- `ebb_check`: Check lifecycle status of a component.
- `ebb_replacement`: Retrieve upgrade guides and replacements.
- `ebb_rules`: Query registered lifecycle rules.

### Agent Skills (skills.sh)

Install the skill for Claude Code, Antigravity, or Cursor:

:::terminal
$ npx skills add velella-sh/ebb
:::

> [!NOTE]
> In benchmark evaluations, adding Ebb reduced agent picks of deprecated dependencies from **38% down to 0%**.

---

## 4. Static JSON API Quickstart

Ebb hosts a zero-dependency static JSON API updated on every release at:
`https://velella.sh/ebb/api/v1/`

You can query it from shell scripts, cURL, or `fetch` without installing any npm package:

:::terminal
$ curl -sSL https://velella.sh/ebb/api/v1/npm/request.json | jq .
$ curl -sSL https://velella.sh/ebb/api/v1/upcoming.json | jq .
:::

### Programmatic TypeScript Client

```ts
import { fetchComponent } from "@velella/ebb/api";

const doc = await fetchComponent("pkg:npm/left-pad");
console.log(doc?.rules[0]?.replacement); // "String.prototype.padStart()"
```

---

## 5. GitHub Action Quickstart

Gate CI builds against unsupported and deprecated dependencies using the official GitHub Action:

```yaml
# .github/workflows/lifecycle.yml
name: Lifecycle Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Audit SBOM Lifecycle
        uses: velella-sh/ebb@v0
        with:
          input: 'bom.json'
          fail-on: 'deprecated'
```

---

## What Ebb Is Not

Understanding what Ebb does *not* do helps position it correctly in your security and maintenance toolchain:

| Tool Category | What it does | Difference from Ebb |
| :--- | :--- | :--- |
| **Vulnerability Scanners** (Snyk, Dependabot, Trivy, OSV) | Detect known CVEs and security advisories. | A package can have zero CVEs while being abandoned for 5 years (`left-pad`, `request`). Ebb detects lifecycle abandonment before vulnerabilities are discovered. |
| **Automated Dependency Updaters** (Renovate, Dependabot) | Open PRs for patch and minor version bumps. | Automated tools bump versions within the same package. Ebb identifies when an entire package or runtime line is dead and guides cross-package migrations (e.g., `node-sass` → `sass`). |
| **Proprietary SaaS Scanners** | Cloud databases requiring accounts and API tokens. | Ebb is 100% open-source, runs completely offline, has zero runtime dependencies, and uses standard Package URL (purl) and VERS specifications. |

---

## Frequently Asked Questions (FAQ)

:::details{summary="Where do Ebb's lifecycle rules come from?"}
Every rule in Ebb is backed by authoritative primary sources: official release schedules, vendor deprecation notices, package registry metadata, and foundation roadmaps. Every rule records the exact source URL, retrieval date, and maintainer review date.
:::

:::details{summary="Does Ebb make network requests during check()?"}
No. All active rules are bundled directly into the package. Ebb executes completely offline and in-memory, evaluating packages in microseconds. Updates can be pinned or refreshed as cryptographically signed Sigstore bundles.
:::

:::details{summary="What do the lifecycle statuses mean?"}
- **`ok`**: The component version is currently maintained and supported.
- **`scheduled`**: A future end-of-life or deprecation date has been announced.
- **`deprecated`**: The author or registry has declared the package deprecated.
- **`unsupported`**: Maintenance, bug fixes, and security patches have ceased.
- **`end-of-life`**: The release line has reached terminal end-of-life.
- **`removed`**: The package or API has been removed from upstream registries or runtimes.
:::

:::details{summary="How does Ebb compare to endoflife.date?"}
Ebb is designed for developer tooling and programmatic automation:
1. **Standard Identifiers**: Uses Package URL (`pkg:npm/react`) and VERS version ranges (`vers:npm/<18.0.0`), eliminating ecosystem-specific naming guesswork.
2. **Microsecond Performance**: Precompiled ranges evaluate 600,000+ components per second offline.
3. **Actionable Replacements**: Rules include explicit migration constraints, steps, and verification commands.
4. **Agent-Native**: First-class MCP server and skills designed to constrain LLM generation.
:::

:::details{summary="Can I run Ebb in environments without Node.js?"}
Yes! Ebb runs natively on:
- **Deno** (`jsr:@velella/ebb`)
- **Bun** (`bun add @velella/ebb`)
- **Modern Browsers** (Chromium, Firefox, Safari)
- **Edge Runtimes** (Cloudflare Workers, Vercel Edge)
- **Shell / cURL** via the static JSON API.
:::
