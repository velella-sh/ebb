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

## Contract Guarantees

1. **Root Imports:** All stable APIs must be exported from the root `@velella/ebb` entry point.
2. **Synchronous Evaluation:** `check`, `checkAll`, `rulesFor`, `replacementFor`, and `parsePurl` operate synchronously without network I/O.
3. **Structured Results:** Return objects adhere to `schemaVersion: 1` with stable fields (`status`, `matches`, `version`).
4. **Resilience:** Unmatched packages or invalid purls return standard fallback structures (`status: "ok"`, `matches: []`, or throw well-typed errors).
