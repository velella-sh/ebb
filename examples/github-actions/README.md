# Checking GitHub Actions Workflows with Ebb

This example demonstrates how to evaluate GitHub Actions workflow files (`.github/workflows/*.yml`) for deprecated, unsupported, or retired Actions.

## Overview

GitHub periodically deprecates older action versions when runner environments retire older Node.js runtimes (such as Node 12, Node 16, or Node 20 runner deprecations). Workflows referencing old actions will fail or throw annotations during CI runs. Ebb maintains an authoritative catalog of GitHub Action lifecycle transitions.

## Running the Example

Run the workflow checker:

```bash
node --experimental-strip-types examples/github-actions/check-workflow.ts
```

Or pass your own workflow path:

```bash
node --experimental-strip-types examples/github-actions/check-workflow.ts .github/workflows/ci.yml
```

## How It Works

The script finds `uses: <owner>/<repo>@<ref>` statements, converts them to standard GitHub package URLs (`pkg:github/<owner>/<repo>@<ref>`), and calls `check()`:

```ts
import { check, replacementFor } from "@velella/ebb";

// Checks actions/checkout@v2
const result = check("pkg:github/actions/checkout", "v2");
console.log(result.status); // "unsupported"

const replacement = replacementFor("pkg:github/actions/checkout", "v2");
console.log(replacement);   // "actions/checkout@v5 or later"
```

## CLI Alternative

You can also evaluate individual actions via the Ebb CLI:

```bash
npx @velella/ebb check pkg:github/actions/checkout v2
npx @velella/ebb check pkg:github/actions/setup-node v1
```
