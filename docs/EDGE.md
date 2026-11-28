---
title: Running Ebb at the Edge
description: Running Ebb in Cloudflare Workers, Vercel Edge Functions, and modern edge environments.
layout: doc
permalink: /edge/
---

# Running Ebb at the Edge

Ebb is fully supported in serverless Edge runtimes, including **Cloudflare Workers (`workerd`)**, **Vercel Edge Functions (`edge-light`)**, Fastly Compute, and Deno Deploy.

---

## Why Ebb Works at the Edge

Edge runtimes execute code in V8 isolates without access to standard Node.js APIs like `node:fs` or `node:child_process`.

Ebb is architected for edge runtimes:
- **Zero Node Dependencies:** Core evaluation (`check`, `checkAll`, `replacementFor`, `rulesFor`) has zero platform dependencies.
- **Dedicated Export Conditions:** `package.json` maps `"workerd"`, `"worker"`, and `"edge-light"` conditions to `./dist/src/browser.js`.

---

## Edge Handlers

:::code-tabs{labels='["Cloudflare Workers", "Vercel Edge Functions"]'}
```typescript
// Cloudflare Worker (wrangler.jsonc)
import { check, checkAll } from "@velella/ebb";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const purl = url.searchParams.get("purl") ?? "pkg:npm/request";
    const version = url.searchParams.get("version") ?? "2.88.2";

    const result = check(purl, version);
    return Response.json(result);
  },
};
```
```typescript
// Vercel Edge Function (api/check.ts)
import { check } from "@velella/ebb";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const purl = url.searchParams.get("purl")!;
  const version = url.searchParams.get("version")!;

  return Response.json(check(purl, version));
}
```
:::

---

## Deployment size

Check the compiled function size against your platform limits. The [benchmark page](https://velella.sh/ebb/benchmarks/) links the separate npm package budget.

## Continuous Testing in CI

Edge compatibility is tested in CI under Cloudflare's native `workerd` runtime using Miniflare (`tests/edge/edge.test.ts`). These tests verify initialization and lifecycle evaluation.
