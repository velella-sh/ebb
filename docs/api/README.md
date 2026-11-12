# `@velella/ebb` API Reference

This document provides a concise reference for all public functions and types exported by `@velella/ebb`.

## Main Entry Points

### `check(purlOrName, version, asOf?)`
Judges a package at `version` against the active lifecycle rules without network access.

- **Parameters:**
  - `purlOrName`: A valid Package URL (e.g. `pkg:npm/left-pad`) or a recognized product name (e.g. `node`).
  - `version`: The version string to evaluate.
  - `asOf` *(optional)*: A target date (`YYYY-MM-DD`) to evaluate future or past status.
- **Returns:** [`CheckResult`](../TYPES.md#checkresult)

### `checkAll(items)`
Batch evaluation of multiple package URLs and versions.

- **Parameters:**
  - `items`: An array or iterable of [`CheckAllItem`](../TYPES.md#checkallitem) objects.
- **Returns:** [`CheckAllResult`](../TYPES.md#checkallresult)

### `replacementFor(purlOrName, version)`
Returns the modern replacement guidance string for a deprecated or end-of-life component, or `null` if none is recorded.

- **Parameters:**
  - `purlOrName`: Package URL or product name.
  - `version`: Component version.
- **Returns:** `string | null`

### `rulesFor(purl, options?)`
Returns all registered lifecycle rules matching the given component purl.

- **Parameters:**
  - `purl`: Package URL string.
  - `options` *(optional)*: Filter options `{ event?: RuleEvent }`.
- **Returns:** `Rule[]`

### `createEbb(options)`
Factory to create an isolated Ebb instance containing lifecycle rules for specific ecosystems only. Perfect for bundlers (esbuild, Vite), Edge functions (Cloudflare Workers), and browser applications where loading the entire multi-megabyte catalog is unnecessary.

- **Parameters:**
  - `options`: `{ ecosystems: (string | EcosystemDataInput | RegistryV2Rule[])[], asOf?: string }`
- **Returns:** [`EbbInstance`](../TYPES.md#ebbinstance) exposing scoped `check`, `checkAll`, `replacementFor`, and `rulesFor`.

Example:
```ts
import { createEbb } from "@velella/ebb";
import npmRules from "@velella/ebb/data/npm";

const ebb = createEbb({ ecosystems: [npmRules] });
const result = ebb.check("pkg:npm/request", "2.88.2");
```

### `preload(ecosystems?)`
Preloads ecosystem data in memory asynchronously. Useful for long-running servers and background services to eliminate cold-start lookup latency on subsequent synchronous calls.

- **Parameters:**
  - `ecosystems` *(optional)*: List of ecosystem names to preload (e.g. `["npm", "python"]`). When omitted, preloads all 25 bundled ecosystems.
- **Returns:** `Promise<void>`

Example:
```ts
import { preload, check } from "@velella/ebb";

// Server startup hook:
await preload(["npm", "python"]);

// Subsequent synchronous checks are served from memory:
const result = check("pkg:npm/left-pad", "1.3.0");
```

## Data Loading Model

Ebb utilizes on-demand lazy loading:
- Importing `@velella/ebb` performs **zero** disk I/O, keeping import times under 20ms.
- Checking a package (e.g. `check("pkg:npm/left-pad", "1.3.0")`) loads and indexes only the relevant ecosystem data (`npm.json` and `osv.json`). Other ecosystems remain unloaded.
- Concurrent calls to load the same ecosystem share a single in-flight asynchronous promise.
- Servers can call `await preload()` at startup to pre-warm the in-memory cache.

## Subpath Exports

- `@velella/ebb/data/<ecosystem>`: Standalone static data modules for each of the 25 ecosystems (e.g. `@velella/ebb/data/npm`, `@velella/ebb/data/python`). Exports `rules`, `data`, and `ecosystem`. Supports full bundler tree-shaking.
- `@velella/ebb/data/load`: Lazy loading and preloading primitives (`loadEcosystem`, `loadEcosystemSync`, `preload`, `purlToEcosystems`).
- `@velella/ebb/create`: Scoped instance factory (`createEbb`).
- `@velella/ebb/api`: Static JSON API client helpers (`fetchRule`, `fetchComponent`, `purlToApiPath`). See [Static API Reference](../static-api.md).
- `@velella/ebb/purl`: Package URL parser and normalizer (`parsePurl`, `normalizePurl`).
- `@velella/ebb/vers`: Native VERS range evaluator (`parseVers`, `satisfiesVers`).
- `@velella/ebb/errors`: Error taxonomy and stable error codes (`EbbErrorCode`).
