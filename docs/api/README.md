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

## Subpath Exports

- `@velella/ebb/purl`: Package URL parser and normalizer (`parsePurl`, `normalizePurl`).
- `@velella/ebb/vers`: Native VERS range evaluator (`parseVers`, `satisfiesVers`).
- `@velella/ebb/errors`: Error taxonomy and stable error codes (`EbbErrorCode`).
