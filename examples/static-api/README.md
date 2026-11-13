# Querying the Ebb Static JSON API

This example demonstrates how to query Ebb's public static JSON API directly from shell scripts, CI pipelines, or lightweight environments without installing Node.js packages or running an agent.

## Overview

Ebb maintains a pre-rendered static JSON API hosted on GitHub Pages:
`https://velella.sh/ebb/api/v1/`

Every component is accessible via standard HTTP GET at `/<type>/<name>.json`.

## Shell Script Example (`curl` + `jq`)

Run the included shell script:

```bash
./examples/static-api/check.sh pkg:npm/request
```

Or query directly with `curl`:

```bash
curl -sSL https://velella.sh/ebb/api/v1/npm/request.json | jq .
```

To extract just the recommended replacement:

```bash
curl -sSL https://velella.sh/ebb/api/v1/npm/request.json | jq -r '.rules[0].replacement'
```

## Programmatic Example (`fetch`)

Run the TypeScript fetch helper:

```bash
node --experimental-strip-types examples/static-api/fetch-rule.ts pkg:npm/left-pad
```

### TypeScript Code

```ts
import { fetchComponent, purlToApiPath } from "@velella/ebb/api";

const doc = await fetchComponent("pkg:npm/left-pad");
if (doc) {
  console.log(`Status rules:`, doc.rules);
}
```
