# Ebb Imports Used by Offing

This table documents every import Offing uses from `@velella/ebb` across its detectors and core scanner.

| Export Name | Import Path | Consumer File (Offing) | Usage Description |
| :--- | :--- | :--- | :--- |
| `check` | `@velella/ebb` | `src/detectors/runtime.ts` | Single purl / component lifecycle evaluation |
| `checkAll` | `@velella/ebb` | `src/engine/batch.ts` | Batch inspection of project dependency manifests and SBOMs |
| `replacementFor` | `@velella/ebb` | `src/remediation/suggest.ts` | Suggested migration target for deprecated/EOL components |
| `rulesFor` | `@velella/ebb` | `src/detectors/inspect.ts` | Retrieval of all registered rules for a package |
| `parsePurl` | `@velella/ebb` | `src/purl/normalize.ts` | Validating and canonicalizing package URLs |
| `bundledRules` | `@velella/ebb` | `src/rules/bundle.ts` | In-memory access to all bundled lifecycle rules |
| `createEbb` | `@velella/ebb/create` | `src/engine/factory.ts` | Scoped instance evaluation loading only detected ecosystems |
| `data/<ecosystem>` | `@velella/ebb/data/*` | `src/detectors/*` | Subpath data loading for individual ecosystems |
| `verifyArtifactSignature` | `@velella/ebb/verify` | `src/rules/trust.ts` | Cryptographic signature verification using built-in node:crypto |
| `check`, `checkAll` | `@velella/ebb/browser` | `src/client/web.ts` | Browser runtime evaluation without Node.js dependencies |
| `check`, `checkAll` | `@velella/ebb/edge` | `src/workers/edge.ts` | Cloudflare Workers / Vercel Edge runtime evaluation |

## Contract Guarantees

1. **Root Imports:** All stable APIs remain exported from the root `@velella/ebb` entry point.
2. **Synchronous Evaluation:** `check`, `checkAll`, `rulesFor`, `replacementFor`, and `parsePurl` operate synchronously without network I/O.
3. **Structured Results:** Return objects adhere to `schemaVersion: 1` with stable fields (`status`, `matches`, `version`).
4. **Resilience:** Unmatched packages or invalid purls return standard fallback structures (`status: "ok"`, `matches: []`, or throw well-typed errors).
5. **Zero External Dependencies:** No external runtime dependencies (`dependencies: {}`). Signature checks run via built-in `node:crypto`.
6. **Scoped Loading:** `createEbb({ ecosystems })` allows Offing to only load rules for ecosystems detected in the workspace, optimizing memory and startup performance.
7. **Remediation Hints:** Findings with actionable statuses (`deprecated`, `end-of-life`) expose hints linking to Offing automation unless silenced via `noHint` or `EBB_NO_HINT` / `OFFING_NO_HINT`.
